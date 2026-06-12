---
phase: 10-plans-exercises-re-skin
plan: 02
subsystem: exercise-taxonomy-and-seed
tags: [muscle-group, seed, i18n, bootstrap, react-query, pure-module, idempotent]

# Dependency graph
requires:
  - phase: 10-plans-exercises-re-skin
    plan: "01"
    provides: "exercises.seed_key column + ExerciseRowSchema.seed_key + ['exercise','create'] upsert default (idempotent onConflict:'id')"
  - phase: 09-auth-settings-preferences
    provides: "lib/resolve-language.ts pure Node-importable boundary pattern; fm:* AsyncStorage idiom (lib/prefs.ts)"
provides:
  - "lib/muscle-group.ts — MuscleGroupKey (5 D-01 keys + other) + resolveMuscleGroupKey total resolver (D-01/D-03), pure Node-importable"
  - "lib/seed/exercises.ts — SEED_EXERCISES 18-row deterministic-UUID bilingual seed (seed_key + D-01 muscle keys + equip.* keys)"
  - "ExerciseSeedBootstrap in (app)/_layout.tsx — auth-gated first-run seed, fm:exercises_seeded:<userId> flag, fire-and-forget idempotent"
  - "CreateVars.seed_key widening on useCreateExercise so seed rows thread seed_key"
  - "Seed + taxonomy locale keys: mgAll..mgOther (flat) + equip.* + exercise.<seed_key>.name (nested) in sv.json + en.json"
  - "test:muscle-group npm script + unit test (16 cases)"
affects: [exercise-picker, exercise-filter-pills, seed-bilingual-display]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure Node-importable taxonomy resolver (no Expo/RN imports) — same boundary as resolve-language.ts; tsx test imports it directly"
    - "Deterministic hardcoded UUIDs (no uuidv5 dep) + upsert ignoreDuplicates = idempotent client seed; flag is fast-path skip only"
    - "Auth-gated no-op-render bootstrap mounted inside (app) tree (not root) so user_id satisfies RLS with check; fail-open .catch()"
    - "Seed namespaces (equip.*, exercise.<seed_key>.name) are the ONLY nested locale keys; per-screen chrome stays flat + owned by screen plans"

key-files:
  created:
    - app/lib/muscle-group.ts
    - app/lib/seed/exercises.ts
    - app/scripts/test-muscle-group.ts
  modified:
    - app/app/(app)/_layout.tsx
    - app/lib/queries/exercises.ts
    - app/package.json
    - app/locales/sv.json
    - app/locales/en.json

key-decisions:
  - "Hardcoded 18 fixed v4-shaped UUIDs (vs uuidv5) — zero new dependency (T-10-SC), still deterministic for idempotent re-run"
  - "MUSCLE_GROUP_MAP includes 'other' as a canonical self-map so a stored 'other' round-trips; unknown non-empty -> 'other'; null/empty -> null"
  - "seed_key added to CreateVars (Rule 3) — the ['exercise','create'] default already accepts it via Partial<ExerciseRow>; the hook type was the only blocker"
  - "Task 3 scope held to seed+taxonomy keys only; screen-chrome keys (closeModal/searchExercise/etc) deferred to Plans 03-06 per UI-SPEC ownership"

requirements-completed: [SKIN-03, I18N-05]

# Metrics
duration: ~4min
completed: 2026-06-12
---

# Phase 10 Plan 02: Muscle-Group Taxonomy, Bilingual Seed & First-Run Bootstrap Summary

**Ships the pure `resolveMuscleGroupKey` taxonomy resolver (D-01/D-03, 16-case unit-tested), an 18-row deterministic-UUID bilingual starter-exercise seed delivered via an auth-gated idempotent first-run `ExerciseSeedBootstrap`, and the seed + taxonomy locale keys (`mgAll..mgOther`, `equip.*`, `exercise.<seed_key>.name`) at sv↔en parity — all additive, all gates green.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-12T18:44:35Z
- **Completed:** 2026-06-12T18:48:44Z
- **Tasks:** 3
- **Files modified:** 8 (3 created, 5 modified)

## Accomplishments
- **Pure muscle-group taxonomy (Task 1)** — `lib/muscle-group.ts` exports `MuscleGroupKey` (5 D-01 keys + `other`) and the total `resolveMuscleGroupKey(raw)`: maps sv/en/canonical free-text (`Bröst`/`chest`/`Triceps`→`arms`), unknown non-empty → `other`, null/empty → `null`. NO `react`/`expo`/`react-native` import (Node-importable boundary, Phase 9 lesson). `test-muscle-group.ts` (16 cases) green; `test:muscle-group` npm script wired.
- **18-row bilingual seed (Task 2)** — `lib/seed/exercises.ts` `SEED_EXERCISES`: 18 curated compound-first rows, each with a hardcoded deterministic UUID, a D-01 `muscle_group` key, an `equip.*` `equipment` key, a snake_case `seed_key`, and a canonical English `name` fallback.
- **Auth-gated first-run bootstrap (Task 2)** — `ExerciseSeedBootstrap` (no-op render) mounted as a sibling to `<Stack>` inside the session-gated `(app)/_layout.tsx`. Reads `session?.user.id`, gated on `fm:exercises_seeded:${userId}`, fires the 18 seed mutations via `.mutate(...)` (SP-2, not `mutateAsync`), then flips the flag. Fail-open `.catch()` — never blocks render (T-10-08). Idempotent via deterministic UUIDs + the `['exercise','create']` upsert `ignoreDuplicates` default (T-10-07).
- **Seed + taxonomy locale keys (Task 3)** — `mgAll..mgOther` (flat taxonomy), `equip.barbell..bodyweight` (5 nested), and `exercise.<seed_key>.name` for all 18 seed keys, added to BOTH `sv.json` and `en.json`. Leaf-parity verified 130=130; `check:locale-parity` green at 109 top-level keys.

## Task Commits

1. **Task 1: pure muscle-group taxonomy resolver + Wave 0 unit test** — `caa2522` (feat)
2. **Task 2: 18-row bilingual seed + auth-gated first-run bootstrap** — `1bfa531` (feat)
3. **Task 3: seed + taxonomy bilingual locale keys (sv + en)** — `993f918` (feat)

**Plan metadata:** _(final docs commit)_

## Files Created/Modified
- `app/lib/muscle-group.ts` (created) — `MuscleGroupKey` + `MUSCLE_GROUP_MAP` + total `resolveMuscleGroupKey` (D-01/D-03), pure
- `app/lib/seed/exercises.ts` (created) — `SEED_EXERCISES` 18-row deterministic-UUID bilingual seed array (D-06/D-08)
- `app/scripts/test-muscle-group.ts` (created) — 16-case unit test for the resolver
- `app/app/(app)/_layout.tsx` (modified) — `ExerciseSeedBootstrap` component + sibling mount inside the session-gated layout (D-07)
- `app/lib/queries/exercises.ts` (modified) — widened `CreateVars` with `seed_key`
- `app/package.json` (modified) — `test:muscle-group` script
- `app/locales/sv.json` (modified) — `mg*` + `equip.*` + `exercise.<seed_key>.name` (sv)
- `app/locales/en.json` (modified) — same keys (en); leaf-parity-equal

## Decisions Made
- **Hardcoded 18 fixed UUIDs instead of uuidv5.** RESEARCH offered uuidv5-from-namespace OR hardcoded UUIDs. Chose hardcoded `5e0d00XX-...` constants — deterministic by being literal, idempotent under the upsert, and adds ZERO package dependency (T-10-SC: no install surface, no slopsquat risk).
- **`'other'` self-maps in MUSCLE_GROUP_MAP.** A stored `'other'` (the resolve-time bucket key) round-trips idempotently, matching how canonical D-01 keys self-map; unknown non-empty values still fall to `'other'` via `?? "other"`.
- **Task 3 scope held tight.** Only the seed + taxonomy keys were added. Per-screen chrome keys (`closeModal`, `searchExercise`, `createAndAdd`, `deletePlanQ`, etc. from UI-SPEC) are explicitly owned by Plans 03–06 and were NOT added here, keeping the namespaces disjoint and avoiding cross-plan key churn.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Widened `CreateVars` with `seed_key`**
- **Found during:** Task 2
- **Issue:** The plan's bootstrap calls `createExercise.mutate({ ..., seed_key })`, but `useCreateExercise`'s `CreateVars` type (in `lib/queries/exercises.ts`) did not include `seed_key` — `tsc` would reject the payload. The underlying `['exercise','create']` mutation default already accepts `seed_key` (its `ExerciseInsertVars = Partial<ExerciseRow> & {...}` and `ExerciseRow` carries `seed_key` since Plan 01); only the hook's narrower call-site type was the blocker.
- **Fix:** Added `seed_key?: string | null` to `CreateVars` with a doc comment explaining the seed path vs. user-created path.
- **Files modified:** `app/lib/queries/exercises.ts`
- **Commit:** `1bfa531`

## Issues Encountered
None. All four gates (`test:muscle-group`, `tsc --noEmit`, `lint`, `check:locale-parity`) plus the cross-check `test:exercise-schemas` exit 0.

## Known Stubs
None. `ExerciseSeedBootstrap` is a no-op *render* by design (D-07 — it only runs an effect, never paints UI); it is fully wired to `SEED_EXERCISES` + `useCreateExercise` + the namespaced flag. No empty/placeholder data flows to UI.

## Threat Flags
None. No new network endpoint, auth path, or schema change introduced beyond the threat register. The seed insert (T-10-06) flows through the existing RLS-gated `['exercise','create']` path with `user_id = session.user.id`; the device-local `fm:exercises_seeded:<userId>` flag (T-10-07) is non-sensitive and tamper-tolerant via idempotent upsert.

## User Setup Required
None — no external service configuration. The seed delivers automatically on first launch per signed-in user; manual device UAT (fresh install / cleared flag → picker populated; sv↔en flip → seed names + equipment translate) is deferred to Plan-level UAT once the picker (Plan 03) consumes these artifacts.

## Next Phase Readiness
- Plan 03 (picker re-skin) can now consume `resolveMuscleGroupKey` for filter pills, `SEED_EXERCISES`/`seed_key` for bilingual display, and the `mg*`/`equip.*`/`exercise.*` locale keys.
- The seed lands before the picker so browse/filters have content on first run.
- All verification gates green; no blockers.

## Self-Check: PASSED

- FOUND: `app/lib/muscle-group.ts`
- FOUND: `app/lib/seed/exercises.ts`
- FOUND: `app/scripts/test-muscle-group.ts`
- FOUND: `.planning/phases/10-plans-exercises-re-skin/10-02-SUMMARY.md`
- FOUND: commit `caa2522` (Task 1)
- FOUND: commit `1bfa531` (Task 2)
- FOUND: commit `993f918` (Task 3)

---
*Phase: 10-plans-exercises-re-skin*
*Completed: 2026-06-12*
