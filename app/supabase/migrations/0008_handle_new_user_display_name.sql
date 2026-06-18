-- File: app/supabase/migrations/0008_handle_new_user_display_name.sql
--
-- Phase 9 (Plan 09-03, UAT fix) — store the sign-up display name.
--
-- Context: profiles.display_name (text) ALREADY EXISTS (0001) and profiles is
-- ALREADY RLS-enabled with own-row SELECT/UPDATE policies (0001). This migration
-- adds NO new column and NO new policy. It only updates the handle_new_user
-- trigger function so that, instead of inserting just `id` (leaving display_name
-- NULL), it reads the display name the client passed as auth user metadata
-- (raw_user_meta_data->>'display_name') and writes it into profiles.display_name
-- on the auth.users insert.
--
-- Security:
--   - handle_new_user is SECURITY DEFINER with SET search_path = '' and
--     fully-qualified names — same signature/security/search_path as 0001;
--     defends against search-path injection (PITFALLS Pitfall 7).
--   - The INSERT bypasses RLS by design (SECURITY DEFINER) — this is the
--     canonical Supabase pattern for provisioning a profile row on signup.
--   - display_name is user-supplied. The trust boundary is the Zod
--     signUpSchema.name.max(80) at the form boundary; stored as plain text
--     (RN has no HTML-injection surface). nullif(trim(...), '') normalizes
--     empty/whitespace metadata back to NULL so a blank name does not persist
--     an empty string.
--
-- create or replace keeps the existing on_auth_user_created trigger pointed at
-- the same function — no trigger DDL needed.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data->>'display_name'), '')
  );
  return new;
end;
$$;
