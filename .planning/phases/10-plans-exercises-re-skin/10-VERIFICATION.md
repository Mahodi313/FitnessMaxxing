---
phase: 10-plans-exercises-re-skin
verified: 2026-06-12T12:00:00Z
status: passed
human_uat: approved 2026-06-12 (device UAT — all Forge screens, banner timer/progress, locale toggle, light+dark confirmed by user)
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/4
  gaps_closed:
    - "A signed-in user gets ~18 starter exercises seeded into their OWN table on first launch; re-launch doesn't duplicate; a second user on the same device ALSO gets seeded (CR-01)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Plans list, plan detail, new-plan visual match Forge design (SKIN-02)"
    expected: "All screens match forge-screens.jsx FHome plan-list / FPlanDetail / FNewPlan: brand-mark gradient tile in header, featured-card gradient on first plan card, Forge typographic hierarchy and token colors throughout — in both light and dark mode"
    why_human: "Visual correctness against the design reference requires a device running the app"
  - test: "Tab bar (Planer / Historik / Inställningar) matches Forge design in light + dark (SKIN-07)"
    expected: "Active tab = accent color + strokeWidth 2 + weight 600; inactive = text3 + lighter label; floating bar background (tabBg) visible. Both themes render correctly without flicker"
    why_human: "Tab bar appearance is not testable with file inspection"
  - test: "Exercise picker filter pills + AND-combined search on device (SKIN-03)"
    expected: "Tapping a muscle-group pill filters to that group; tapping the active pill or Alla/All clears; search within a group filters further. Seed exercise names translate (e.g. 'Bänkpress' in sv, 'Bench press' in en). User-created exercise names stay unchanged"
    why_human: "Interactive filter state and locale rendering requires device"
  - test: "Plan-exercise edit modal steppers — sets/clear targets, preview chip real-time (SKIN-03)"
    expected: "Steppers for sets / reps min / reps max are independently clearable to null; target chip updates in real time (e.g. '4 × 6–8 reps'); Stäng dismisses, Spara mål saves to DB"
    why_human: "Interactive stepper behavior + potential WR-03 regression (useFocusEffect re-seeds on cache update) only visible on device"
  - test: "Hard-delete — danger overflow row → confirm dialog → navigates back once (WR-01)"
    expected: "Overflow shows 'Ta bort' danger row; confirm dialog shows destructive 'Ta bort' + neutral 'Behåll plan'; plan deleted from list; history session for that plan still visible with snapshot name; navigation stack pops exactly once"
    why_human: "Navigation side-effects (double router.back WR-01) and history persistence need real device + real data"
  - test: "I18N-05 end-to-end — user-created content never auto-translated"
    expected: "A plan named 'Min plan' and exercise named 'My custom move' remain unchanged after locale flip sv→en. Only chrome strings change language"
    why_human: "End-to-end locale toggle behavior requires a running app"
  - test: "Draft-resume overlay copy in English locale (WR-02)"
    expected: "The draft-resume overlay should show translated English copy for the body text (e.g. 'You have an ongoing session from X with Y sets saved.'). Currently hardcoded Swedish confirmed at index.tsx:156 — confirmed I18N regression"
    why_human: "Mixed-language UI only visible with a running app in English locale with an active draft session"
  - test: "New-plan screen light + dark match FNewPlan"
    expected: "Back-chevron nav button, H1 title, focused name field with 2px accent border on focus, description box, Skapa plan CTA with arrowRight icon"
    why_human: "Visual correctness requires device"
---

# Phase 10: Plans & Exercises Re-skin — Verification Report

**Phase Goal:** Re-skin the plan/exercise CRUD screens and surface the schema fields v1 hid (muscle group, equipment, targets, descriptions).
**Verified:** 2026-06-12T12:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after CR-01 gap closure

## Re-verification Summary

| Item | Previous | Now |
|------|----------|-----|
| CR-01 blocker (seed UUID collision) | FAILED (BLOCKER) | CLOSED |
| Score | 3/4 | 4/4 |
| Status | gaps_found | human_needed |

The single BLOCKER gap from the initial verification (CR-01: globally-shared hardcoded UUIDs causing silent PK collision for every user after the first) has been fully resolved. All four must-have truths are now VERIFIED. The remaining open items are all visual/device-UAT items that require a running app and cannot be confirmed by static code inspection.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Plans list/Home, plan detail, and new-plan screens match the Forge design | VERIFIED | `index.tsx`, `plans/[id].tsx`, `new.tsx` all rebuilt with `TOKENS` light/dark hex bags, `dark:` class pairs, composing from Phase 8 barrel (ForgeButton/ForgeCard/ForgeStat). Box-decoration NativeWind rendering bug fixed across all 5 screens (inline `style()` callbacks replaced with `className`/ForgeButton primitives, device-confirmed on Planer empty state). |
| 2 | Exercise picker (browse + filters + create-new) and plan-exercise edit match the Forge design, exposing muscle group / equipment / target sets+reps / notes | VERIFIED | `exercise-picker.tsx` imports `resolveMuscleGroupKey`, renders 6-pill filter row (mgAll + 5 keys), AND-combines `activeGroup` with translated-name search (D-05). `edit.tsx` has `FStepperInput` for sets + Min/Max reps pair, all nullable (D-14), notes box. Both screens use `.mutate` (SP-2). |
| 3 | The tab bar (Planer / Historik / Inställningar) matches the Forge design in light + dark | VERIFIED | `(tabs)/_layout.tsx` has `ForgeTabBar` custom renderer over live `<Tabs>`, `text-forge-accent-light dark:text-forge-accent` for active, `text-forge-text3-light dark:text-forge-text3` for inactive, `bg-forge-tabBg-light dark:bg-forge-tabBg` background, icons barbell/clock/settings. |
| 4 | User-created names and notes are stored exactly as written, never auto-translated | VERIFIED (code; UAT pending) | Code path correct: seed rows (seed_key != null) resolve via `t('exercise.<seed_key>.name')`; user rows render `e.name` raw (D-16). No auto-translation logic found. Device UAT needed for end-to-end confirmation. |

**Score:** 4/4 truths verified

### CR-01 Gap Closure — Detailed Verification

The prior BLOCKER had three missing items. All three are now present:

**Missing 1 — Per-user deterministic IDs:** `app/lib/utils/uuid.ts` exports `deterministicUUID(name: string): Promise<string>` using expo-crypto SHA-256 with version/variant bits forced to v5-shaped RFC-4122. `app/lib/seed/exercises.ts` no longer carries any `id` field — the `SeedExercise` type has no `id`, and the file comment explicitly documents that "the row id is NOT stored here — it is derived PER USER at seed time." `_layout.tsx` derives ids via `deterministicUUID('fm-exercise-seed:${userId}:${seed_key}')` for each seed row before enqueueing.

**Missing 2 — Flag set only after confirmed success:** `_layout.tsx` lines 107-134: a `succeeded` counter increments in `onSuccess`; `AsyncStorage.setItem(flag, 'true')` fires only when `succeeded === total` (all 18 rows confirmed). An `onError` callback sets `failed = true`, leaving the flag unset so the next launch retries. The flag is never set unconditionally after the enqueue loop.

**Missing 3 — Two-user assertion in test-rls.ts:** `app/scripts/test-rls.ts` now seeds user B with `seed_key='bench_press'` (line 244), then attempts the same `seed_key` for user A and asserts: (a) insert succeeds (PGRST116 would be a fail), and (b) the resulting `id` differs from user B's id. Assertion label: `"CR-01: two users hold seed_key='bench_press' with distinct ids (no PK collision)"`.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/lib/utils/uuid.ts` | `deterministicUUID(name)` helper (CR-01) | VERIFIED | Exports both `randomUUID` and `deterministicUUID`; SHA-256 via expo-crypto; v5-shaped output; CR-01 commentary present |
| `app/lib/seed/exercises.ts` | No global hardcoded PKs; `SeedExercise` type without `id` | VERIFIED | `SeedExercise` type has no `id` field; 18 rows each carry only `name`, `muscle_group`, `equipment`, `seed_key`; comment documents per-user derivation at seed time |
| `app/app/(app)/_layout.tsx` | Per-user deterministic IDs + flag set on confirmed completion | VERIFIED | `ids` array derived via `Promise.all(SEED_EXERCISES.map(...deterministicUUID(...)))` before loop; `succeeded` counter + `failed` guard; `setItem` only when `succeeded === total` |
| `app/scripts/test-rls.ts` | CR-01 two-user PK collision assertion | VERIFIED | User B seeds bench_press; User A seeds same seed_key; assertion verifies distinct ids |
| `app/supabase/migrations/0010_seed_key_and_session_plan_snapshot.sql` | seed_key + plan_name_snapshot + coalesce re-deploy | VERIFIED | Contains `add column seed_key text`, `add column plan_name_snapshot text`, `coalesce(p.name, s.plan_name_snapshot)`, `security invoker`, `set search_path = ''` |
| `app/types/database.ts` | Regenerated with seed_key + plan_name_snapshot | VERIFIED | Lines 104, 235 confirm both columns present |
| `app/lib/query/client.ts` | `['plan','delete']` default + `plan_name_snapshot` on session-start | VERIFIED | `setMutationDefaults(["plan", "delete"]` at line 436; `plan_name_snapshot: vars.plan_name_snapshot ?? null` at line 720 |
| `app/lib/queries/plans.ts` | `useDeletePlan` exported | VERIFIED | Lines 136-145, `mutationKey: ["plan", "delete"] as const` |
| `app/lib/schemas/exercises.ts` | `seed_key` on ExerciseRowSchema | VERIFIED | Line 69: `seed_key: z.string().nullable()` |
| `app/lib/muscle-group.ts` | `MuscleGroupKey` + `resolveMuscleGroupKey` total function | VERIFIED | Exports confirmed; `MUSCLE_GROUP_MAP` covers sv/en legacy variants; `?? "other"` fallback |
| `app/app/(app)/_layout.tsx` | `ExerciseSeedBootstrap` auth-gated | VERIFIED | Line 77: `ExerciseSeedBootstrap` component; line 139: mounted as sibling to `<Stack>`; reads `session?.user.id`; gated on `fm:exercises_seeded:${userId}` |
| `app/app/(app)/plans/[id]/exercise-picker.tsx` | Forge re-skin with filter pills + bilingual display | VERIFIED | `resolveMuscleGroupKey` imported (line 76); `activeGroup` state (line 152); 6-pill row (line 584+); `displayName` using `t('exercise.<seed_key>.name')` (lines 168-170); GHRV wrapper present |
| `app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx` | `FStepperInput` re-skin with nullable targets | VERIFIED | `FStepperInput` defined (line 124); `useUpdatePlanExercise` (line 78); `useRemovePlanExercise` (line 79); `t('closeModal')` / `t('saveTargets')` (lines 383, 418); GHRV wrapper present |
| `app/app/(app)/(tabs)/index.tsx` | Plans list re-skin (FHome plan-list portion) | VERIFIED | `usePlansQuery` (line 59); `t('myPlans')` (line 249); `t('noPlans')` (line 324); Forge token bag present |
| `app/app/(app)/plans/new.tsx` | New-plan re-skin with description field | VERIFIED | `planFormSchema` + `useCreatePlan` (lines 61-62); `description` field exposed; `.mutate` not mutateAsync |
| `app/app/(app)/(tabs)/_layout.tsx` | Forge tab bar in light + dark | VERIFIED | `ForgeTabBar` custom renderer; active/inactive token pairs; barbell/clock/settings icons |
| `app/app/(app)/plans/[id].tsx` | Plan detail re-skin + hard-delete + snapshot | VERIFIED | `useDeletePlan` (line 70); `showDeleteConfirm` state (line 191); `plan_name_snapshot: plan.name` in `onStarta` (line 224); `deletePlanQ` / `keepPlan` via `t()` (lines 829, 855) |
| `app/locales/sv.json` | All required locale keys at sv↔en parity | VERIFIED | 141 keys confirmed (phase-final count); seed taxonomy (mgAll-mgOther, equip.*, exercise.<seed_key>.name for all 18), picker chrome, edit chrome, destructive dialog |
| `app/locales/en.json` | Parity with sv.json | VERIFIED | Same 141 keys at same line count (168 lines each) |
| `app/scripts/test-muscle-group.ts` | Unit test for resolveMuscleGroupKey | VERIFIED | Contains `resolveMuscleGroupKey` test cases |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/lib/utils/uuid.ts` `deterministicUUID` | `app/app/(app)/_layout.tsx` ExerciseSeedBootstrap | `import { deterministicUUID }` line 51 | WIRED | Used in `Promise.all` at lines 100-103 to derive per-user seed ids |
| `app/lib/seed/exercises.ts` SEED_EXERCISES | `app/app/(app)/_layout.tsx` ExerciseSeedBootstrap | `import { SEED_EXERCISES }` line 50 | WIRED | Iterated in `forEach` at line 110; each row's `seed_key` feeds `deterministicUUID` |
| `app/lib/queries/plans.ts` (useDeletePlan) | `['plan','delete']` default in client.ts | `mutationKey: ["plan", "delete"]` | WIRED | plans.ts line 142, client.ts line 436 |
| `app/supabase/migrations/0010_...sql` | get_session_summaries | `coalesce(p.name, s.plan_name_snapshot)` | WIRED | Migration lines 83-84, group-by line 94 |
| `app/app/(app)/_layout.tsx` | `app/lib/seed/exercises.ts` | `SEED_EXERCISES` + `useCreateExercise` loop | WIRED | `ExerciseSeedBootstrap` at line 77 imports seed data and fires mutations with per-user ids |
| `app/lib/seed/exercises.ts` | exercises.seed_key column | `row.seed_key` on every row | WIRED | All 18 rows carry `seed_key` field; types/database.ts confirms column exists |
| `app/app/(app)/plans/[id]/exercise-picker.tsx` | `app/lib/muscle-group.ts` | `import resolveMuscleGroupKey` | WIRED | Line 76; used in filtered memo (line 188) |
| `app/app/(app)/plans/[id]/exercise-picker.tsx` | `useCreateExercise(planId)` + `useAddExerciseToPlan(planId)` | shared `scope.id='plan:<planId>'` | WIRED | Lines 159-162; create followed by add under same scope |
| `app/app/(app)/plans/[id].tsx` | `useDeletePlan(planId).mutate({ id })` | hard-delete confirm dialog | WIRED | Line 166, 271-279 |
| `app/app/(app)/plans/[id].tsx` | `['session','start']` plan_name_snapshot | `plan_name_snapshot: plan.name` on mutate | WIRED | Line 224 |
| `app/app/(app)/(tabs)/index.tsx` | `usePlansQuery` (archived_at is null) | list query | WIRED | Line 59 import, line 101 usage |
| `app/app/(app)/plans/new.tsx` | `useCreatePlan().mutate` | create submit | WIRED | Line 62 import, line 100 hook, line 129 `.mutate()` call |
| `app/scripts/test-rls.ts` CR-01 assertion | two-user distinct-PK check | user B seeds bench_press; user A seeds same seed_key; ids compared | WIRED | Line 244 (user B seed), lines 305-327 (CR-01 assertion block) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `exercise-picker.tsx` | `exercises` (filtered list) | `useExercisesQuery()` → Supabase exercises table | Yes — RLS-scoped SELECT, seed rows delivered via Plan 02 bootstrap | FLOWING |
| `(tabs)/index.tsx` | `plans` | `usePlansQuery()` → Supabase workout_plans WHERE archived_at IS NULL | Yes — real DB query | FLOWING |
| `plans/[id].tsx` | `plan`, `planExercises` | `usePlanQuery(id)` + `usePlanExercisesQuery(id)` | Yes — real DB queries; `target_*` fields surfaced from plan_exercises | FLOWING |
| `edit.tsx` | `target_sets`, `target_reps_min`, `target_reps_max` | `useFocusEffect` seeds from `usePlanExercisesQuery` cache | Yes — data flows from real DB cache | FLOWING (with caveat: WR-03 re-seeds on every cache update, not just on focus — can wipe in-progress edits) |
| `_layout.tsx` ExerciseSeedBootstrap | `SEED_EXERCISES` → Supabase exercises table | Static seed array + `useCreateExercise` upsert with per-user deterministicUUID ids | Yes — per-user ids derived before loop; upsert idempotent; flag set only on confirmed success | FLOWING (CR-01 CLOSED) |

### Behavioral Spot-Checks

Step 7b: SKIPPED — no runnable entry points (Expo Go app; cannot run without device).

### Probe Execution

Step 7c: No probe scripts declared in PLAN frontmatter; no conventional `scripts/*/tests/probe-*.sh` for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SKIN-02 | Plans 05, 06 | Plans list/Home, plan detail, and new-plan screens match Forge design | VERIFIED | index.tsx, new.tsx, plans/[id].tsx all re-skinned with Forge tokens; NativeWind box-decoration bug fixed and device-confirmed |
| SKIN-03 | Plans 03, 04 | Exercise picker (browse + filters + create-new) and plan-exercise edit match Forge design | VERIFIED | exercise-picker.tsx filter pills + bilingual display; edit.tsx FStepperInput + nullable targets |
| SKIN-07 | Plan 05 | Tab bar (Planer / Historik / Inställningar) matches Forge design in light + dark | VERIFIED | ForgeTabBar custom renderer, active/inactive styling, light+dark parity, OfflineBanner preserved |
| I18N-05 | Plans 02, 03, 04, 05, 06 | User-created content stored exactly as written, never auto-translated | SATISFIED (code; UAT pending) | Seed rows use `t('exercise.<seed_key>.name')`; user rows render raw `e.name`/`e.equipment`/`notes`; no auto-translate path in codebase. Device UAT needed for end-to-end confirmation. |

### Security

10-SECURITY.md landed: 22/22 threats closed, `threats_open: 0`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/app/(app)/plans/[id].tsx` | 275, 280 | Double `router.back()` — one immediate + one in `onSuccess` | WARNING | Navigation stack can pop twice on fast networks (WR-01) |
| `app/app/(app)/(tabs)/index.tsx` | 154-157 | Hardcoded Swedish in `draftBody` template literal | WARNING | I18N regression inside an I18N phase — English-locale users see Swedish draft-resume copy (WR-02) |
| `app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx` | 287-295 | `useFocusEffect` dep on `planExercises` re-seeds on every cache update | WARNING | Background refetch wipes in-progress edits silently (WR-03) |
| `app/app/(app)/plans/[id].tsx` | 583 | `t("noPlans")` as empty-exercises placeholder | WARNING | Wrong locale key — shows "Inga planer än" inside a plan's exercise list (WR-10) |
| `app/lib/query/client.ts` | 436-467 | `['plan','delete']` does not clear `plansKeys.detail(id)` or `planExercisesKeys.list(id)` | WARNING | Stale cache survives for 24h after deletion; re-entry to deleted plan's route renders it as alive (WR-05) |

Note: The previous BLOCKER (`app/lib/seed/exercises.ts` globally-shared hardcoded UUID PKs, `app/app/(app)/_layout.tsx` unconditional flag set) is RESOLVED. No remaining BLOCKER anti-patterns. No TBD/FIXME/XXX debt markers found in phase-modified files.

### Human Verification Required

#### 1. Plans list, plan detail, new-plan visual match Forge design (SKIN-02)

**Test:** Navigate through Planer tab, open a plan, create a new plan in both light + dark mode.
**Expected:** All screens match the Forge reference (`forge-screens.jsx` FHome plan-list portion / FPlanDetail / FNewPlan). Brand-mark gradient tile visible in header; featured-card barbell tile gradient on first plan card only; Forge typographic hierarchy and token colors throughout.
**Why human:** Visual correctness against the design reference requires a device running the app.

#### 2. Tab bar appearance in light + dark (SKIN-07)

**Test:** Switch device appearance between light and dark mode while on the plans/history/settings tabs.
**Expected:** Active tab = accent color + bold label; inactive = text3 + lighter label; floating bar background (tabBg) visible. Both themes render correctly without flicker.
**Why human:** Tab bar appearance is not testable with file inspection.

#### 3. Exercise picker filter pills + AND-combined search

**Test:** Open the exercise picker from a plan, tap filter pills, type in the search field, switch locale sv↔en.
**Expected:** Tapping a muscle-group pill filters to that group; tapping the active pill or "Alla/All" clears; search within a group filters further. Seed exercise names translate (e.g. "Bänkpress" in sv, "Bench press" in en). User-created exercise names stay unchanged.
**Why human:** Interactive filter state and locale rendering requires device.

#### 4. Plan-exercise edit modal steppers (SKIN-03)

**Test:** Tap a plan exercise to open the edit modal, interact with all three steppers, verify preview chip, save.
**Expected:** Steppers for sets / reps min / reps max are independently clearable to null; target chip updates in real time (e.g. "4 × 6–8 reps"); Stäng dismisses, Spara mål saves to DB. Note: WR-03 re-seed bug may reset edits if a background refetch occurs during editing — confirm this is not happening.
**Why human:** Interactive stepper behavior + potential WR-03 regression only visible on device.

#### 5. Hard-delete: navigation behavior + history preservation (WR-01)

**Test:** Create a plan, log a session against it, then hard-delete the plan via the overflow menu.
**Expected:** Confirmation dialog appears (danger "Ta bort" + neutral "Behåll plan"). After confirming, user is navigated back to plans list exactly ONCE. The logged session still appears in History with the plan's former name.
**Why human:** Navigation side-effects (double router.back WR-01) and history persistence need real device + real data.

#### 6. I18N-05 end-to-end — user content never translated

**Test:** Create a plan named "Min plan" and an exercise named "My custom move". Switch locale from sv to en.
**Expected:** Plan name "Min plan" and exercise name "My custom move" remain unchanged. Only chrome strings (tab labels, button text, error messages) change language.
**Why human:** End-to-end locale toggle behavior requires a running app.

#### 7. Draft-resume overlay copy in English locale (WR-02)

**Test:** Start a workout session, background the app without finishing, switch locale to English, return to Planer tab.
**Expected:** The draft-resume overlay should show translated English copy for the body text. Currently hardcoded Swedish ("Du har ett pågående pass från…") is confirmed in `index.tsx:156` — this is an I18N regression (WR-02) that needs device confirmation to see the user-facing impact.
**Why human:** Mixed-language UI only visible with a running app in English locale with an active draft session.

#### 8. New-plan screen light + dark match FNewPlan

**Test:** Navigate to create a new plan in both light and dark mode.
**Expected:** Back-chevron nav button, H1 title, focused name field with 2px accent border on focus, description box, Skapa plan CTA with arrowRight icon.
**Why human:** Visual correctness requires device.

---

_Verified: 2026-06-12T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
