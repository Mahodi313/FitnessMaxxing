---
phase: 10
slug: plans-exercises-re-skin
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-12
---

# Phase 10 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Client → Supabase PostgREST | All plan/exercise/session CRUD goes through the RLS-enforced REST surface | User-owned rows (exercises, workout_plans, plan_exercises, workout_sessions) |
| Client → Supabase RPC | `get_session_summaries` re-deployed by migration 0010 | Aggregated own-user session summaries (SECURITY INVOKER) |
| Tampered local cache / offline queue | AES-encrypted React Query persist + paused mutations | seed_key, muscle_group, target values, plan_name_snapshot |
| First-run seed bootstrap | Auth-gated client seed of 18 starter exercises | `user_id = session.user.id` rows only |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-10-01 | Tampering/Info disclosure | exercises.seed_key cross-user access | mitigate | Column-agnostic own-row RLS covers seed_key (migration 0010); test-rls asserts A cannot SELECT/UPDATE B's seed_key | closed |
| T-10-02 | Tampering/Denial | Hard-delete of another user's plan | mitigate | `['plan','delete']` under RLS `for all using (user_id=(select auth.uid()))`; FK SET NULL only on owner's sessions; test-rls "A cannot DELETE B's workout_plan" | closed |
| T-10-03 | Elevation | get_session_summaries RPC re-deploy | mitigate | `security invoker` + `set search_path=''` + fully-qualified names verbatim (0010); verify-deploy asserts INVOKER + search_path | closed |
| T-10-04 | Tampering | Malformed seed_key/muscle_group from tampered cache | mitigate | ExerciseRowSchema.parse() at wire boundary includes seed_key; test-exercise-schemas covers shape | closed |
| T-10-05 | Security misconfiguration | Stale types/database.ts after ADD COLUMN | mitigate | gen:types co-committed with 0010; verify-deploy asserts column existence + FK confdeltype='n' | closed |
| T-10-06 | Spoofing | Seed insert with spoofed/null user_id | mitigate | Seed via useCreateExercise `user_id=session.user.id`; RLS `with check` rejects other user_id; bootstrap gated on userId in auth tree | closed |
| T-10-07 | Tampering | Tampered fm:exercises_seeded flag causes re-seed | accept | Re-seed is idempotent (per-user deterministic UUIDs + upsert ignoreDuplicates); non-sensitive marker, single-user V1. Strengthened by the CR-01 fix (per-user ids + flag-after-confirm) | closed |
| T-10-08 | Denial | Seed batch blocks first render | mitigate | Bootstrap no-op render + fire-and-forget async (fail-open); never awaited | closed |
| T-10-09 | Tampering | Malformed muscle_group from legacy/tampered data | mitigate | resolveMuscleGroupKey total (`?? 'other'`); test-muscle-group covers unknown/null/empty | closed |
| T-10-10 | Tampering | Off-list muscle_group from tampered client | mitigate | Dropdown emits only the 5 D-01 keys; form schema `z.enum(MUSCLE_GROUP_KEYS)`; resolver total | closed |
| T-10-11 | Tampering/Info disclosure | Picker reads/adds another user's exercise | mitigate | useExercisesQuery + create/add under own-row RLS; chained scope is FK-safe replay only, not authz bypass | closed |
| T-10-12 | Denial | mutateAsync stall under offlineFirst (picker) | mitigate | All call sites use `.mutate(payload,{onError})` (SP-2) | closed |
| T-10-13 | Tampering | Editing/removing another user's plan_exercises row | mitigate | useUpdatePlanExercise/useRemovePlanExercise under own-row RLS (via owning plan's user_id); test-rls cross-user blocked | closed |
| T-10-14 | Tampering | Out-of-range/non-numeric target values | mitigate | z.coerce.number form schema + nullable bounds; steppers clamp input; nulls allowed (D-14) | closed |
| T-10-15 | Denial | mutateAsync stall under offlineFirst (edit) | mitigate | `.mutate(payload,{onError})` (SP-2) | closed |
| T-10-16 | Tampering | Creating/listing another user's plan | mitigate | useCreatePlan/usePlansQuery under own-row RLS; list filters archived_at; test-rls cross-user insert blocked | closed |
| T-10-17 | Denial | mutateAsync stall under offlineFirst (new-plan) | mitigate | new-plan submit uses `.mutate(payload,{onError})` (SP-2) | closed |
| T-10-18 | Info disclosure | Tab bar / list leaks another user's plans | mitigate | usePlansQuery RLS-scoped; ForgeTabBar reads only navigation state (no data query) | closed |
| T-10-19 | Tampering/Denial | Hard-delete of another user's plan or its sessions | mitigate | useDeletePlan under RLS for-all; FK SET NULL nulls only OWNER's sessions; exercise_sets untouched; test-rls re-affirms | closed |
| T-10-20 | Repudiation/Info loss | A logged set lost on plan delete | mitigate | FK SET NULL preserves sessions/sets; `coalesce(p.name, s.plan_name_snapshot)` keeps history readable | closed |
| T-10-21 | Tampering | Snapshot value spoofed at session-start | accept | plan_name_snapshot is the user's OWN plan name (non-sensitive); RLS gates the session insert to the owner | closed |
| T-10-22 | Denial | mutateAsync stall under offlineFirst (delete/start) | mitigate | Hard-delete + Starta-pass use `.mutate(payload,{onError})` (SP-2) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-10-01 | T-10-07 | The `fm:exercises_seeded:<userId>` flag is a non-sensitive client marker. Tampering at worst re-enqueues idempotent, per-user, duplicate-free upserts. Single-user V1; no cross-user surface. | Mahodi313 | 2026-06-12 |
| AR-10-02 | T-10-21 | `plan_name_snapshot` is the user's own plan name (non-sensitive). RLS gates the session insert to the owner, so a spoofed value only mislabels the user's own history. | Mahodi313 | 2026-06-12 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-12 | 22 | 22 | 0 | gsd-security-auditor (opus) |

Note: T-10-07's mitigation was strengthened after plan time by the CR-01 fix (commit `[FIT-89]`) — the seed id is now per-user deterministic (`deterministicUUID(\`fm-exercise-seed:${userId}:${seed_key}\`)`) and the seeded flag is set only after all 18 rows confirm success. This closed a data-loss bug (global hardcoded ids starved later users) without opening any new cross-user surface (RLS `with check` still gates `user_id`). Regression covered by `test-rls.ts` ("two users hold seed_key='bench_press' with distinct ids").

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-12
