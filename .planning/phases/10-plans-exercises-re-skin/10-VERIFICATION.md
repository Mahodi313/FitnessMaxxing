---
phase: 10-plans-exercises-re-skin
verified: 2026-06-12T00:00:00Z
status: gaps_found
score: 3/4 must-haves verified
overrides_applied: 0
gaps:
  - truth: "A signed-in user with the seed flag unset gets ~18 curated bilingual exercises seeded into their own exercises table on first launch — and re-launching after a successful seed does not duplicate rows"
    status: failed
    reason: "Seed uses globally shared hardcoded UUIDs as PKs (5e0d0001... etc). The first user to run inserts 18 rows. Any second user's seed hits PK conflicts: upsert ignoreDuplicates silently skips, .single() errors PGRST116, the error is swallowed, but AsyncStorage.setItem(flag,'true') still runs unconditionally after the enqueue loop — leaving user 2 permanently seeded with zero rows and no retry path. This is CR-01 from the code review."
    artifacts:
      - path: "app/lib/seed/exercises.ts"
        issue: "All 18 SEED_EXERCISES rows carry globally-unique hardcoded UUIDs (5e0d0001-…). These PKs are not per-user. Once user 1 owns them, user 2's upsert ON CONFLICT DO NOTHING skips, .single() returns PGRST116."
      - path: "app/app/(app)/_layout.tsx"
        issue: "AsyncStorage.setItem(flag, 'true') runs unconditionally after the enqueue loop (line ~96-107), not after confirmed success. Any persistent failure (PK collision, RLS rejection) leaves the flag set with zero seed rows."
    missing:
      - "Make seed IDs deterministic per-user (e.g. derive UUIDv5 from userId:seed_key) OR add UNIQUE(user_id, seed_key) index and drop client-supplied PKs"
      - "Set the seed flag only on confirmed completion (count onSuccess callbacks), not after enqueue"
      - "Add a 2-user seed assertion to test-rls.ts"

human_verification:
  - test: "Plans list light + dark match FHome plan-list portion"
    expected: "Brand-mark gradient tile in header, MINA PLANER section, featured-card gradient barbell on first plan card (gradient), surface icon on rest, Forge colors throughout"
    why_human: "Visual correctness against forge-screens.jsx reference requires device UAT"
  - test: "Tab bar (Planer / Historik / Inställningar) matches Forge design in light + dark"
    expected: "Active tab = accent color + strokeWidth 2 + weight 600, inactive = text3 + strokeWidth 1.6, floating bg-forge-tabBg, correct icons (barbell/clock/settings)"
    why_human: "Tab bar appearance and animation cannot be verified by grep"
  - test: "Exercise picker filter pills + AND-combined search works on device"
    expected: "Tapping a muscle-group pill filters the list; tapping the active pill or Alla clears it; search AND-combines with the active pill filter; Swedish + English seed names both translate on locale flip"
    why_human: "Interactive filter state behavior requires device"
  - test: "Plan-exercise edit modal — steppers set/clear targets, preview chip updates in real time"
    expected: "Sets, RepsMin, RepsMax steppers independently clearable to null; target chip (4 × 6–8 reps) tracks live stepper values; Stäng dismisses, Spara mål saves"
    why_human: "Interactive stepper UX requires device"
  - test: "Hard-delete path — danger overflow row → confirm dialog → navigates back once"
    expected: "Overflow shows 'Ta bort' danger row below 'Arkivera plan'; confirm dialog shows destructive 'Ta bort' + neutral 'Behåll plan'; plan deleted from list; history session for that plan still visible (snapshot name)"
    why_human: "Navigation side-effect (double router.back WR-01) needs real device to confirm; history readability needs a test case with prior sessions"
  - test: "User-created plan/exercise names stored as written across language flip"
    expected: "A plan named 'Axel-dag' stays 'Axel-dag' in both sv and en locale; an exercise named 'My custom exercise' stays unchanged; only seed names and chrome translate"
    why_human: "Requires creating user content and switching locale on device"
  - test: "Draft-resume overlay body copy in English locale"
    expected: "Should render translated copy (not hardcoded Swedish 'Du har ett pågående pass från…')"
    why_human: "WR-02 hardcoded Swedish in draftBody (index.tsx:156) cannot be seen with grep alone but is a confirmed i18n regression — needs device in English locale to see the mixed-language UI"
  - test: "New-plan screen light + dark match FNewPlan"
    expected: "Back-chevron nav button, H1 title, focused name field with 2px accent border on focus, description box, Skapa plan CTA with arrowRight icon"
    why_human: "Visual correctness requires device"
---

# Phase 10: Plans & Exercises Re-skin — Verification Report

**Phase Goal:** Re-skin the plan/exercise CRUD screens and surface the schema fields v1 hid (muscle group, equipment, targets, descriptions).
**Verified:** 2026-06-12
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Plans list/Home, plan detail, and new-plan screens match the Forge design | VERIFIED | `index.tsx`, `plans/[id].tsx`, `new.tsx` all rebuilt with `TOKENS` light/dark hex bags, `dark:` class pairs, composing from Phase 8 barrel (ForgeButton/ForgeCard/ForgeStat). Visual match requires UAT. |
| 2 | Exercise picker (browse + filters + create-new) and plan-exercise edit match the Forge design, exposing muscle group / equipment / target sets+reps / notes | VERIFIED | `exercise-picker.tsx` imports `resolveMuscleGroupKey`, renders 6-pill filter row (mgAll + 5 keys), AND-combines `activeGroup` with translated-name search (D-05). `edit.tsx` has `FStepperInput` for sets + Min/Max reps pair, all nullable (D-14), notes box. Both screens use `.mutate` (SP-2). |
| 3 | The tab bar (Planer / Historik / Inställningar) matches the Forge design in light + dark | VERIFIED | `(tabs)/_layout.tsx` has `ForgeTabBar` custom renderer over live `<Tabs>`, `text-forge-accent-light dark:text-forge-accent` for active, `text-forge-text3-light dark:text-forge-text3` for inactive, `bg-forge-tabBg-light dark:bg-forge-tabBg` background, icons barbell/clock/settings. |
| 4 | User-created names and notes are stored exactly as written, never auto-translated | UNCERTAIN | Code path is correct: seed rows (seed_key != null) resolve via `t('exercise.<seed_key>.name')`; user rows render `e.name` raw (D-16). No auto-translation logic found. However, needs device UAT to confirm end-to-end. |

**Score:** 3/4 truths verified (1 UNCERTAIN — blocked on UAT, not on a code gap)

### Deferred Items

None identified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/supabase/migrations/0010_seed_key_and_session_plan_snapshot.sql` | seed_key + plan_name_snapshot + coalesce re-deploy | VERIFIED | Contains `add column seed_key text`, `add column plan_name_snapshot text`, `coalesce(p.name, s.plan_name_snapshot)`, `security invoker`, `set search_path = ''` |
| `app/types/database.ts` | Regenerated with seed_key + plan_name_snapshot | VERIFIED | Lines 104, 235 confirm both columns present |
| `app/lib/query/client.ts` | `['plan','delete']` default + `plan_name_snapshot` on session-start | VERIFIED | `setMutationDefaults(["plan", "delete"]` at line 436; `plan_name_snapshot: vars.plan_name_snapshot ?? null` at line 720 |
| `app/lib/queries/plans.ts` | `useDeletePlan` exported | VERIFIED | Lines 136-145, `mutationKey: ["plan", "delete"] as const` |
| `app/lib/schemas/exercises.ts` | `seed_key` on ExerciseRowSchema | VERIFIED | Line 69: `seed_key: z.string().nullable()` |
| `app/lib/muscle-group.ts` | `MuscleGroupKey` + `resolveMuscleGroupKey` total function | VERIFIED | Exports confirmed; `MUSCLE_GROUP_MAP` covers sv/en legacy variants; `?? "other"` fallback |
| `app/lib/seed/exercises.ts` | 18-row seed array with seed_key + D-01 muscle keys | VERIFIED | 18 rows confirmed (lines 47-69); each has `seed_key`, D-01 `muscle_group`, `equip.*` key, deterministic UUID |
| `app/app/(app)/_layout.tsx` | `ExerciseSeedBootstrap` auth-gated | VERIFIED | Line 77: `ExerciseSeedBootstrap` component; line 139: mounted as sibling to `<Stack>`; reads `session?.user.id`; gated on `fm:exercises_seeded:${userId}` |
| `app/app/(app)/plans/[id]/exercise-picker.tsx` | Forge re-skin with filter pills + bilingual display | VERIFIED | `resolveMuscleGroupKey` imported (line 76); `activeGroup` state (line 152); 6-pill row (line 584+); `displayName` using `t('exercise.<seed_key>.name')` (lines 168-170); GHRV wrapper present |
| `app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx` | `FStepperInput` re-skin with nullable targets | VERIFIED | `FStepperInput` defined (line 124); `useUpdatePlanExercise` (line 78); `useRemovePlanExercise` (line 79); `t('closeModal')` / `t('saveTargets')` (lines 383, 418); GHRV wrapper present |
| `app/app/(app)/(tabs)/index.tsx` | Plans list re-skin (FHome plan-list portion) | VERIFIED | `usePlansQuery` (line 59); `t('myPlans')` (line 249); `t('noPlans')` (line 324); Forge token bag present |
| `app/app/(app)/plans/new.tsx` | New-plan re-skin with description field | VERIFIED | `planFormSchema` + `useCreatePlan` (lines 61-62); `description` field exposed; `.mutate` not mutateAsync |
| `app/app/(app)/(tabs)/_layout.tsx` | Forge tab bar in light + dark | VERIFIED | `ForgeTabBar` custom renderer; active/inactive token pairs; barbell/clock/settings icons |
| `app/app/(app)/plans/[id].tsx` | Plan detail re-skin + hard-delete + snapshot | VERIFIED | `useDeletePlan` (line 70); `showDeleteConfirm` state (line 191); `plan_name_snapshot: plan.name` in `onStarta` (line 224); `deletePlanQ` / `keepPlan` via `t()` (lines 829, 855) |
| `app/locales/sv.json` | All required locale keys at sv↔en parity | VERIFIED | 141 keys confirmed (phase-final count); seed taxonomy (mgAll-mgOther, equip.*, exercise.<seed_key>.name for all 18), picker chrome (searchExercise, createAndAdd, noExercisesMatch), edit chrome (saveTargets, editTargets, repsMin, repsMax, removeFromPlan), destructive dialog (deletePlanQ, deletePlanBody, delete, keepPlan) |
| `app/locales/en.json` | Parity with sv.json | VERIFIED | Same 141 keys at same line count (168 lines each) |
| `app/scripts/test-muscle-group.ts` | Unit test for resolveMuscleGroupKey | VERIFIED | Contains `resolveMuscleGroupKey` test cases |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/lib/queries/plans.ts` (useDeletePlan) | `['plan','delete']` default in client.ts | `mutationKey: ["plan", "delete"]` | WIRED | plans.ts line 142, client.ts line 436 |
| `app/supabase/migrations/0010_...sql` | get_session_summaries | `coalesce(p.name, s.plan_name_snapshot)` | WIRED | Migration lines 83-84, group-by line 94 |
| `app/app/(app)/_layout.tsx` | `app/lib/seed/exercises.ts` | `SEED_EXERCISES` + `useCreateExercise` loop | WIRED | `ExerciseSeedBootstrap` at line 77 imports seed data and fires mutations |
| `app/lib/seed/exercises.ts` | exercises.seed_key column | `row.seed_key` on every row | WIRED | All 18 rows carry `seed_key` field; types/database.ts confirms column exists |
| `app/app/(app)/plans/[id]/exercise-picker.tsx` | `app/lib/muscle-group.ts` | `import resolveMuscleGroupKey` | WIRED | Line 76; used in filtered memo (line 188) |
| `app/app/(app)/plans/[id]/exercise-picker.tsx` | `useCreateExercise(planId)` + `useAddExerciseToPlan(planId)` | shared `scope.id='plan:<planId>'` | WIRED | Lines 159-162; create followed by add under same scope |
| `app/app/(app)/plans/[id].tsx` | `useDeletePlan(planId).mutate({ id })` | hard-delete confirm dialog | WIRED | Line 166, 271-279 |
| `app/app/(app)/plans/[id].tsx` | `['session','start']` plan_name_snapshot | `plan_name_snapshot: plan.name` on mutate | WIRED | Line 224 |
| `app/app/(app)/(tabs)/index.tsx` | `usePlansQuery` (archived_at is null) | list query | WIRED | Line 59 import, line 101 usage |
| `app/app/(app)/plans/new.tsx` | `useCreatePlan().mutate` | create submit | WIRED | Line 62 import, line 100 hook, line 129 `.mutate()` call |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `exercise-picker.tsx` | `exercises` (filtered list) | `useExercisesQuery()` → Supabase exercises table | Yes — RLS-scoped SELECT, seed rows delivered via Plan 02 bootstrap | FLOWING |
| `(tabs)/index.tsx` | `plans` | `usePlansQuery()` → Supabase workout_plans WHERE archived_at IS NULL | Yes — real DB query | FLOWING |
| `plans/[id].tsx` | `plan`, `planExercises` | `usePlanQuery(id)` + `usePlanExercisesQuery(id)` | Yes — real DB queries; `target_*` fields surfaced from plan_exercises | FLOWING |
| `edit.tsx` | `target_sets`, `target_reps_min`, `target_reps_max` | `useFocusEffect` seeds from `usePlanExercisesQuery` cache | Yes — data flows from real DB cache | FLOWING (with caveat: WR-03 re-seeds on every cache update, not just on focus — can wipe in-progress edits) |
| `_layout.tsx` ExerciseSeedBootstrap | `SEED_EXERCISES` → Supabase exercises table | Static seed array + `useCreateExercise` upsert | BROKEN for 2nd+ users — hardcoded global PKs cause silent PK collision | HOLLOW (CR-01) |

### Behavioral Spot-Checks

Step 7b: SKIPPED — no runnable entry points (Expo Go app; cannot run without device).

### Probe Execution

Step 7c: No probe scripts declared in PLAN frontmatter; no conventional `scripts/*/tests/probe-*.sh` for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SKIN-02 | Plans 05, 06 | Plans list/Home, plan detail, and new-plan screens match Forge design | VERIFIED | index.tsx, new.tsx, plans/[id].tsx all re-skinned with Forge tokens; behavior preserved |
| SKIN-03 | Plans 03, 04 | Exercise picker (browse + filters + create-new) and plan-exercise edit match Forge design | VERIFIED | exercise-picker.tsx filter pills + bilingual display; edit.tsx FStepperInput + nullable targets |
| SKIN-07 | Plan 05 | Tab bar (Planer / Historik / Inställningar) matches Forge design in light + dark | VERIFIED | ForgeTabBar custom renderer, active/inactive styling, light+dark parity, OfflineBanner preserved |
| I18N-05 | Plans 02, 03, 04, 05, 06 | User-created content stored exactly as written, never auto-translated | SATISFIED (code) | Seed rows use `t('exercise.<seed_key>.name')`; user rows render raw `e.name`/`e.equipment`/`notes`; no auto-translate path in codebase. Device UAT needed for end-to-end confirmation. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/lib/seed/exercises.ts` | 47-69 | Globally-shared hardcoded UUID PKs | BLOCKER | Silently prevents 2nd user from ever getting seed exercises (CR-01) |
| `app/app/(app)/_layout.tsx` | 96-107 | Seed flag set unconditionally after enqueue, not after confirmed success | BLOCKER | User 2 permanently stuck with zero seed exercises, no retry path (CR-01 + WR-11) |
| `app/app/(app)/plans/[id].tsx` | 275, 280 | Double `router.back()` — one immediate + one in `onSuccess` | WARNING | Navigation stack can pop twice on fast networks (WR-01) |
| `app/app/(app)/(tabs)/index.tsx` | 154-157 | Hardcoded Swedish in `draftBody` template literal | WARNING | I18N regression inside an I18N phase — English-locale users see Swedish draft-resume copy (WR-02) |
| `app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx` | 287-295 | `useFocusEffect` dep on `planExercises` re-seeds on every cache update | WARNING | Background refetch wipes in-progress edits silently (WR-03) |
| `app/app/(app)/plans/[id].tsx` | 583 | `t("noPlans")` as empty-exercises placeholder | WARNING | Wrong locale key — shows "Inga planer än" inside a plan's exercise list (WR-10) |
| `app/lib/query/client.ts` | 436-467 | `['plan','delete']` does not clear `plansKeys.detail(id)` or `planExercisesKeys.list(id)` | WARNING | Stale cache survives for 24h after deletion; re-entry to deleted plan's route renders it as alive (WR-05) |

Note: Debt markers (TBD/FIXME/XXX) were not found in phase-modified files. The anti-patterns above are logic/behavior issues, not unreferenced debt markers.

### Human Verification Required

#### 1. Plans list, plan detail, new-plan visual match (SKIN-02)

**Test:** Navigate through Planer tab, open a plan, create a new plan in both light + dark mode.
**Expected:** All screens match the Forge reference (`forge-screens.jsx` FHome plan-list portion / FPlanDetail / FNewPlan). Brand-mark gradient tile visible in header; featured-card barbell tile gradient on first plan only; Forge typographic hierarchy and token colors throughout.
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

#### 5. Hard-delete: navigation behavior + history preservation

**Test:** Create a plan, log a session against it, then hard-delete the plan via the overflow menu.
**Expected:** Confirmation dialog appears (danger "Ta bort" + neutral "Behåll plan"). After confirming, user is navigated back to plans list exactly ONCE (WR-01 double router.back may cause a double-pop on fast networks). The logged session still appears in History with the plan's former name.
**Why human:** Navigation side-effects and history persistence need real device + real data.

#### 6. I18N-05 end-to-end — user content never translated

**Test:** Create a plan named "Min plan" and an exercise named "My custom move". Switch locale from sv to en.
**Expected:** Plan name "Min plan" and exercise name "My custom move" remain unchanged. Only chrome strings (tab labels, button text, error messages) change language.
**Why human:** End-to-end locale toggle behavior requires a running app.

#### 7. Draft-resume overlay copy in English locale (WR-02)

**Test:** Start a workout session, background the app without finishing, switch locale to English, return to Planer tab.
**Expected:** The draft-resume overlay should show translated English copy for the body text (e.g. "You have an ongoing session from X with Y sets saved."). Currently hardcoded Swedish ("Du har ett pågående pass från…") is confirmed in `index.tsx:156` — this is an I18N regression (WR-02) that needs device confirmation to see the user-facing impact.
**Why human:** Mixed-language UI only visible with a running app in English locale with an active draft session.

### Gaps Summary

**1 BLOCKER gap found** (CR-01 — seed UUID collision):

The `ExerciseSeedBootstrap` uses globally-shared hardcoded UUIDs (`5e0d0001-0000-4000-8000-000000000001` through `5e0d0012-...`) as `exercises` primary keys. These PKs are not per-user. The first user inserts all 18 rows with these global IDs. Every subsequent user's seed attempt silently fails:

- `upsert(..., { onConflict: 'id', ignoreDuplicates: true })` fires `ON CONFLICT DO NOTHING` — regardless of RLS visibility (PK conflict is evaluated before RLS)
- `.select().single()` returns PGRST116 (0 rows)
- The per-row `onError` swallows the error
- `AsyncStorage.setItem(flag, "true")` fires unconditionally after the enqueue loop
- User 2 is permanently flagged as "seeded" with zero starter exercises, and no retry path exists

This is a multi-user correctness failure. While the app is V1 for a single user, the code explicitly comments "a second user on the same device still gets seeded" (`_layout.tsx:64-65`) and the plan's truth ("A signed-in user… gets ~18 curated bilingual exercises seeded") fails for any user after the first.

**The gap must be fixed before the seed-bilingual-display truth (SC2) and I18N-05 are fully satisfied for multi-user scenarios.**

**7 human verification items** prevent status from being `human_needed` alone — the BLOCKER takes precedence.

---

_Verified: 2026-06-12_
_Verifier: Claude (gsd-verifier)_
