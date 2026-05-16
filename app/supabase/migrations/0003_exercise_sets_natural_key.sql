-- ============================================================================
-- Phase 5 gap-closure (FIT-7) — Migration 0003
--
-- Adds the natural-key UNIQUE constraint that D-16 (Phase 5 CONTEXT.md)
-- accepted the risk of. D-16 is SUPERSEDED by Plan 05-04 (deviates_from
-- block) — UAT 2026-05-13 disproved "mer data > förlust": duplicates
-- produce silent volume/last-value skew, not preserved data.
--
-- Must follow Migration 0002 (dedupe). Combined with Migration 0004
-- (server-side set_number trigger) this closes the F13 "får aldrig
-- duplicera ett set" contract gap.
--
-- Constraint name `exercise_sets_session_exercise_setno_uq` is referenced
-- by app/scripts/test-rls.ts (Phase 5 gap-closure assertion) and by
-- app/scripts/inspect-duplicate-sets.ts (pg_constraint dump).
-- ============================================================================

alter table public.exercise_sets
  add constraint exercise_sets_session_exercise_setno_uq
  unique (session_id, exercise_id, set_number);
