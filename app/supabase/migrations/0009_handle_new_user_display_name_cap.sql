-- File: app/supabase/migrations/0009_handle_new_user_display_name_cap.sql
--
-- Phase 9 (Plan 09-03, code-review WR-01) — defense-in-depth cap on the
-- captured sign-up display name at the DB layer.
--
-- Context: 0008 made handle_new_user write raw_user_meta_data->>'display_name'
-- into public.profiles.display_name. The trust boundary there is the Zod
-- signUpSchema.name.max(80) at the FORM boundary only. But
-- supabase.auth.signUp({ options: { data: { display_name } } }) is an
-- unauthenticated public endpoint — a direct API caller (or buggy client) can
-- bypass the client-side Zod guard and submit unbounded text, which 0008 would
-- write verbatim into the unbounded `text` column.
--
-- This migration mirrors the defense-in-depth pattern the team applied to
-- weekly_goal in 0007 (`check (weekly_goal between 1 and 7)`, explicitly to stop
-- a tampered client write). Here we use `left(..., 80)` rather than a CHECK so
-- the cap never FAILS the signup insert — a too-long name is truncated to 80
-- chars instead of rejecting account creation. Closes review WR-01 / security
-- residual T-09-16-R / Linear FIT-86.
--
-- This adds NO new column and NO new policy — it only redefines the trigger
-- function. The body is IDENTICAL to 0008 (SECURITY DEFINER + SET search_path =
-- '' + fully-qualified public.profiles) except for the `left(...)` cap.
--
-- Security:
--   - handle_new_user stays SECURITY DEFINER with SET search_path = '' and
--     fully-qualified names — same signature/security/search_path as 0001/0008;
--     defends against search-path injection (PITFALLS Pitfall 7).
--   - The INSERT bypasses RLS by design (SECURITY DEFINER) — canonical Supabase
--     provisioning pattern.
--   - display_name is user-supplied; nullif(left(trim(...), 80), '') normalizes
--     empty/whitespace metadata back to NULL and caps length at 80 to match the
--     Zod bound at the DB layer.
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
    nullif(left(trim(new.raw_user_meta_data->>'display_name'), 80), '')
  );
  return new;
end;
$$;
