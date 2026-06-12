# Phase 10: Plans & Exercises Re-skin - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Re-skin the plan/exercise CRUD screens to the Forge design and surface the schema fields v1 hid. Screens in scope: **Plans list (Planer tab / `index.tsx`)**, **plan detail (`plans/[id].tsx`)**, **new-plan (`plans/new.tsx`)**, **exercise picker (`plans/[id]/exercise-picker.tsx`)** including its inline create-new state, **plan-exercise edit (`plans/[id]/exercise/[planExerciseId]/edit.tsx`)**, and the **tab bar** (Planer / Historik / Inställningar). Surfaces existing-but-hidden fields: `workout_plans.description`, `exercises.muscle_group/equipment/notes`, `plan_exercises.target_sets/target_reps_min/target_reps_max/notes`.

**In scope:** SKIN-02, SKIN-03, SKIN-07, I18N-05. Plus the net-new capabilities decided in discussion: a **fixed bilingual muscle-group taxonomy** (5 keys), **muscle-group filter pills** on the picker, a **curated bilingual starter exercise library** seeded client-side, **hard-delete for plans** (in addition to existing archive), and **full i18n** of every touched screen (sv+en keys added to `locales/*.json`).

**Out of scope (own phases):**
- **Active-workout screen** — Phase 10 re-skins the **"Starta pass" CTA** on plan detail and preserves its navigation to `/workout/[id]`, but the workout screen itself is re-skinned in **Phase 11** (SKIN-04/05).
- **Home activity-ring dashboard** — Phase 10's "Plans list / Home" is the **Planer tab showing plans**. The activity ring + streak + volume widgets layered onto Home are **Phase 12** (DASH-01..05). Do not build dashboard aggregates here.
- **Global read-only exercise library / full public-dataset import** (e.g. free-exercise-db) — deferred (see Deferred Ideas). Phase 10 ships only a small curated seed into the user's own `exercises`.
- **Global i18n zero-missing-keys audit** — Phase 15 (I18N-03). Phase 10 fully i18ns the screens it touches; Phase 15 audits the whole app.
- **F13 hot path** — untouched. `npm run test:f13-brutal` must stay green (SKIN-08).
- Applying the kg↔display unit helper / haptics gate to these screens beyond what already exists — those retrofits ride with their screen re-skins per Phase 9 D-02/D-08 (weight display on plan/exercise screens is target-reps, not logged weight; no unit conversion needed here).

</domain>

<decisions>
## Implementation Decisions

### Muscle-group taxonomy (SKIN-03)
- **D-01:** Muscle group becomes a **fixed 5-key list** matching the mockup: `chest` (Bröst), `back` (Rygg), `legs` (Ben), `shoulders` (Axlar), `arms` (Armar — biceps+triceps collapsed), plus an implicit **`other`** bucket for legacy/unmapped values. Stored as a **stable, language-neutral key**; displayed via `t()` so it flips sv↔en. The exercise create-form uses the mockup's **dropdown** (`Välj muskelgrupp` + chevron).
- **D-02:** **Equipment stays free-text** for user-created exercises (mockup shows a free `ForgeField`, `t.ex. Skivstång, Hantlar`), stored as written (I18N-05). Only **seed** rows render equipment via `t()` (see D-06).
- **D-03:** Existing exercises with free-text `muscle_group` get a **best-effort map** to the 5 keys (e.g. `"Bröst"→chest`, `"Ben"→legs`); anything that doesn't match a key renders under **Other** / shows the raw stored string. Mapping mechanism is the planner's call.

### Exercise picker filters (SKIN-03)
- **D-04:** Build the **muscle-group filter pills** (resolves the SKIN-03 "browse + create-new" vs ROADMAP criterion-2 "browse + filters + create-new" conflict in favor of filters, now that the taxonomy is keyed). Behavior: an **"Alla / All" pill (default, shows everything) + the 5 single-select group pills**. Selecting a group filters to it; tapping the active pill or "All" clears it.
- **D-05:** Filters **AND-combine with the search box** (text match within the selected group). Search matches the displayed (translated) name.

### Starter exercise library (seed)
- **D-06:** Ship a **curated bilingual starter library (~15–20 exercises)** seeded into the user's **own `exercises`** table (not a global table). Seed rows are **truly bilingual** on name + equipment: a new nullable **`seed_key`** column (migration `0010`) marks seed rows; when set, the row renders `name` and `equipment` via `t('exercise.<seed_key>...')` and flips sv↔en. User-created rows (`seed_key` null) render raw free-text. **Editing a seed row clears `seed_key`** → it becomes a normal free-text exercise. Muscle group on seed rows uses the D-01 keys.
- **D-07:** **Seed delivery = client first-run seed.** On app launch, if AsyncStorage flag **`fm:exercises_seeded`** is unset, insert the seed rows via the **normal client mutation** (RLS-respecting, through the offline queue), then set the flag. Idempotent; works identically for the existing user (backfills on next launch) and future fresh installs. **No superuser/migration backfill, no signup trigger.**
- **D-08:** Seed list is a **guide, not a hard contract** (~15–20 total, compounds first). Approved candidate set (planner may refine names/counts):
  - **Chest:** Bänkpress·Bench press (Skivstång), Lutande hantelpress·Incline DB press (Hantlar), Dips (Bodyweight)
  - **Back:** Marklyft·Deadlift (Skivstång), Chins·Pull-ups (Bodyweight), Skivstångsrodd·Barbell row (Skivstång), Latsdrag·Lat pulldown (Kabel)
  - **Legs:** Knäböj·Squat (Skivstång), Benpress·Leg press (Maskin), Rumänsk marklyft·Romanian deadlift (Skivstång), Utfall·Lunges (Hantlar)
  - **Shoulders:** Axelpress·Overhead press (Skivstång), Sidolyft·Lateral raise (Hantlar), Face pull (Kabel)
  - **Arms:** Stående hantelcurl·DB curl (Hantlar), Hammercurl·Hammer curl (Hantlar), Triceps pushdown (Kabel), Skullcrusher (Skivstång)
  - Equipment value set (bilingual keys for seed): Skivstång/Barbell, Hantlar/Dumbbells, Kabel/Cable, Maskin/Machine, Bodyweight/Kroppsvikt.

### Plan actions & removal (SKIN-02)
- **D-09:** **Preserve all existing plan-detail behavior**, re-skinned to Forge: drag-to-reorder (`useReorderPlanExercises`), per-exercise remove (✕ / "Ta bort från planen"), soft **archive** (`useArchivePlan` → `archived_at`, reversible, no confirm), and the **"Starta pass"** CTA (`useStartSession` → `router.push('/workout/[id]')`). The overflow-menu pattern (currently `ActionSheetIOS`) may be re-skinned to an inline Forge control per the mockup — planner's call.
- **D-10:** **Add a hard-delete path for plans** (in addition to archive). Hard delete is **destructive and irreversible → requires a confirmation dialog** (contrast with Phase 9 D-16 sign-out, which is non-destructive and has no confirm).
- **D-11:** **Hard delete always preserves workout history** (honors the "never lose a set" core value). Deleting a plan removes the plan row + its `plan_exercises` template, but **all logged `workout_sessions` / `exercise_sets` survive**; the live plan link on past sessions is nulled and history still reads sensibly. **Mechanism flagged for research** — likely a migration changing `workout_sessions.plan_id` FK to `ON DELETE SET NULL` plus a stored **plan-name snapshot** on the session so history doesn't show a dangling/blank plan. (See Canonical Refs → research flag.)

### New-plan & plan detail fields (SKIN-02)
- **D-12:** New-plan screen exposes **name (required) + description (optional)** per the mockup (`FNewPlan`). `workout_plans.description` **already exists** — no migration for this field.
- **D-13:** Plan detail **surfaces targets** as the mockup's chip (e.g. `4 × 6–8 reps`) from `plan_exercises.target_*`, and exposes the **edit-targets** screen (`FExerciseEdit`): sets stepper + reps min/max steppers + notes + remove affordance.

### Targets behavior
- **D-14:** **Targets are fully optional** (`target_sets/reps_min/reps_max` nullable — a range, one bound, or none). Adding an exercise from the picker uses the **current "add now, set targets later"** flow: tap inserts the `plan_exercises` row with null targets and dismisses; the user optionally edits targets later via the edit screen. No targets prompt on add.

### i18n (I18N-05)
- **D-15:** **Fully i18n every screen re-skinned this phase.** All chrome strings (labels, placeholders, buttons, **error copy** like the picker's `"Något gick fel"` / `"Du måste vara inloggad"`) get **sv+en keys added to `locales/{sv,en}.json`** and routed through `t()` — same approach as Phase 9. These per-screen strings are **not yet in the locale files** (Phase 8 D-09 only transcribed `lib.jsx`'s `I18N` map, not the per-screen `s` objects in `forge-screens.jsx`), so the phase adds them.
- **D-16:** **I18N-05 — user-created content is stored as written and never auto-translated.** Plan names, plan descriptions, exercise names (user-created), notes, and free-text equipment are stored raw and rendered verbatim in both languages. Only **keyed values flip**: muscle-group keys (D-01) and seed rows' name/equipment (D-06).

### Claude's Discretion
- Muscle-group legacy-value → key mapping mechanism (D-03).
- Whether the archive/delete affordances stay an iOS action-sheet or become inline Forge controls (D-09).
- Exact `seed_key` values, translation-key namespace, and seed equipment modeling (D-06/D-08).
- Exact Forge token/class choices per control — follow `lib.jsx` `THEMES.forge` + the spec + how `forge-screens.jsx` composes the primitives.
- Tab-bar wiring (SKIN-07): use the Phase 8 `TabBar` shell vs styling the Expo Router `Tabs` — design-driven, follow the mockup.
- Empty-state styling: re-skin the existing patterns (plans list "Inga planer än" + CTA + FAB-hidden-when-empty; picker empty-state) to Forge.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase definition
- `.planning/ROADMAP.md` → "Phase 10: Plans & Exercises Re-skin" — goal + 4 success criteria (plan screens match Forge; exercise picker browse+filters+create-new + plan-exercise edit exposing muscle group / equipment / targets / notes; tab bar light+dark; user content stored as written).
- `.planning/REQUIREMENTS.md` → rows **SKIN-02, SKIN-03, SKIN-07, I18N-05** (and the SKIN-08 / F13 no-regression constraint).

### Design source of truth (read first)
- `app/design v2/Sources/design/forge-screens.jsx` — the in-scope reference screens: `FHome` (plan list, line 88), `FPlanDetail` (line 223), `FNewPlan` (line 1113), `FExercisePicker` (line 1215, search + filter pills + create-new CTA + list), `FExercisePickerNew` (line 1334, name/muscle-dropdown/equipment/notes), `FExerciseEdit` (line 1438, sets/reps steppers + target chip + notes + remove). `FStepperInput` (line 1553). The authoritative source for layout + component variant/size API.
- `app/design v2/Sources/design/lib.jsx` — `THEMES.forge` tokens, `numStyle` (tabular nums), `Icon` paths, `TabBar` reference.
- `app/design v2/Sources/design/Forge Design Spec.html` — annotated spec (scope to plans/exercise/tab-bar sections).
- `app/design v2/Sources/design/README.md` — migration order + brand (Ascend) vs content-icon (barbell) rules. Barbell is a content icon for plan cards + Planer tab.

### Architecture & stack (locked — do not re-derive)
- `.planning/research/ARCHITECTURE.md` — §1 tokens, §2 fonts, §7 i18n (`react-i18next` + `expo-localization`, `lib/i18n.ts`, `changeLanguage`, `fallbackLng`).
- `.planning/research/STACK.md` — pinned versions (NativeWind 4.2 + Tailwind 3, Skia 2.2.12). No new charting/library deps needed this phase.
- `.planning/research/PITFALLS.md` — Tailwind-v4-breaks-NativeWind (stay on Tailwind 3).

### Database conventions (MUST follow for migration 0010 + any FK change)
- `CLAUDE.md` → "Database conventions" + "Security conventions" — migration-as-truth (numbered SQL in `app/supabase/migrations/`, next = `0010_*`), RLS `(select auth.uid())` + `with check`, `npm run gen:types` co-committed, `verify-deploy.ts` after push, **cross-user `test:rls` assertion** extended for the new `exercises.seed_key` column and any `workout_sessions.plan_id` FK change.

### Phase carry-forward (locked)
- `.planning/phases/08-forge-foundation/08-CONTEXT.md` — component library (`components/ui/*`: `ForgeButton/Field/Card/Chip`, `SettingsRow`, `TabBar`), tokens, fonts, i18n scaffold, `fm:*` AsyncStorage convention, flat 1:1 i18n keys (D-10).
- `.planning/phases/09-auth-settings-preferences/09-CONTEXT.md` — live-`t()` re-skin precedent (D-12/D-17/D-18), `fm:*` Zod-catch pref pattern, `SegmentedControl` re-skin, the `0007`..`0009` migration discipline this phase mirrors for `0010`.

### ⚠ Research flags (open mechanism decisions for the phase-researcher)
- **Hard-delete FK preservation (D-11):** determine how to preserve workout history when a plan is hard-deleted. Inspect `workout_sessions` → `workout_plans` FK (current `ON DELETE` behavior in `0001_initial_schema.sql`) and decide between `ON DELETE SET NULL` + a plan-name snapshot column vs an alternative. Migration `0010` (or a sibling) must adjust this. Verify history (session list + detail) still renders after a plan delete.
- **`exercises.seed_key` (D-06):** confirm column shape, nullable, and that adding it needs no RLS change (still user-scoped) but DOES need a `test:rls` assertion + `gen:types`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/app/(app)/(tabs)/index.tsx` — Planer tab / plans list. Already has empty-state ("Inga planer än" + CTA), populated FlatList, "Skapa ny plan" FAB, `usePlansQuery` (filters `archived_at is null`), active-session banner. Re-skin to Forge `FHome`.
- `app/app/(app)/plans/[id].tsx` — plan detail. Already has `DraggableFlatList` reorder (`useReorderPlanExercises`), `useArchivePlan`, per-row remove, `useStartSession` "Starta pass" → `router.push('/workout/[id]')`. Re-skin to `FPlanDetail`; ADD hard-delete (D-10/D-11).
- `app/app/(app)/plans/new.tsx` — new-plan screen. Re-skin to `FNewPlan`; expose existing `description` field.
- `app/app/(app)/plans/[id]/exercise-picker.tsx` — picker (search + create-new inline RHF form: name/muscle_group/equipment/notes; `useExercisesQuery`, `useCreateExercise(planId)` + `useAddExerciseToPlan(planId)` with shared `scope.id='plan:<planId>'` for FK-safe offline replay; `GestureHandlerRootView` wrapper required for modal). Re-skin to `FExercisePicker`/`FExercisePickerNew`; ADD filter pills + muscle-group dropdown.
- `app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx` — plan-exercise edit. Re-skin to `FExerciseEdit` (sets/reps steppers + notes + remove).
- `app/components/ui/*` (Phase 8) — `ForgeButton`, `ForgeField`, `ForgeCard`, `ForgeChip`, `SettingsRow`, `TabBar`, `ProgressRing`, `Sparkline`, `Icon`. Compose all re-skins from these.
- `app/lib/queries/exercises.ts`, `app/lib/queries/plans.ts`, `app/lib/queries/plan-exercises.ts` — existing TanStack query/mutation hooks (offline-queue-aware). Seed insert (D-07) and hard-delete (D-10) add new mutations following these patterns.
- `app/lib/schemas/exercises.ts` — `exerciseFormSchema` (Zod) for the create-form; extend for the muscle-group key + `seed_key` shape.
- `app/lib/i18n.ts`, `app/locales/{sv,en}.json` — i18n scaffold; add the per-screen keys (D-15).
- `app/types/database.ts` — `workout_plans.description` ✓, `exercises.muscle_group/equipment/notes` ✓ (no `seed_key` yet — added by 0010), `plan_exercises.target_sets/target_reps_min/target_reps_max/notes` ✓.

### Established Patterns
- **AsyncStorage `fm:*` prefs/flags** with Zod-guarded reads (Phase 9) — `fm:exercises_seeded` flag for first-run seed (D-07).
- **Offline-first mutation queue** — seed insert (~18 rows) and hard-delete go through the same TanStack `scope`/persister machinery; safe offline, replay on reconnect. Seed flag set only after local optimistic insert.
- **Migration discipline** — numbered SQL (`0010_*`), `gen:types` co-commit, `verify-deploy.ts` after push, `test:rls` extension. Studio read-only.
- **Modal screens** need their own `GestureHandlerRootView` wrapper (picker UAT 2026-05-10) — preserve when re-skinning.
- **Dark/light** via NativeWind `dark:` variants — every re-skinned screen covers both (SKIN-07 light+dark).

### Integration Points
- `app/supabase/migrations/0010_*.sql` (new) → `exercises.seed_key` + (research-flagged) `workout_sessions.plan_id` FK change / plan-name snapshot → `app/types/database.ts` (regen) → `app/scripts/test-rls.ts` (new assertions).
- New seed data module + `fm:exercises_seeded` first-run insert wiring (D-07) — likely a `LocaleBootstrap`-style bootstrap or a launch effect.
- Picker ← muscle-group filter pills + dropdown over the 5 keys (D-01/D-04).
- Locale files ← per-screen sv+en keys (D-15).
- `plans/[id].tsx` ← hard-delete mutation + confirmation dialog (D-10/D-11).
- **F13 risk: NONE for the hot path** (SKIN-08) — these are template/CRUD screens, not the active-workout logging path; no mutation defaults, query keys, or persister for `exercise_sets` logging are touched. `test:f13-brutal` stays green. (Caveat: the hard-delete FK change touches `workout_sessions` schema — verify it doesn't alter session-logging behavior.)

</code_context>

<specifics>
## Specific Ideas

- Muscle group = the mockup's 5 filter pills exactly (Bröst/Rygg/Ben/Axlar/Armar); arms collapses biceps+triceps; "Armar" not "Biceps/Triceps".
- The picker should never feel empty for the user — the curated seed lands on first launch so browse/filters have content immediately.
- Seed names render bilingually because the whole milestone is about EN/SV fidelity; the user trains primarily in Swedish but flips to English to sanity-check i18n.
- "Starta pass" is the user's primary action on a plan — keep it prominent in the re-skin even though the destination screen is Phase 11.
- Hard delete is opt-in and guarded; archive remains the low-friction default. Deleting a plan must never cost you a logged set.

</specifics>

<deferred>
## Deferred Ideas

- **Global read-only exercise library / build-time import of free-exercise-db** (~870 exercises, English-only, MIT) into a shared table the picker merges with the user's own. Richer browse + true bilingual-on-mapping, but a new capability (new table + RLS + merged query) — own phase if hundreds of options are ever wanted. (Runtime exercise API ruled out: conflicts with offline-first + free-tier.)
- **Home activity-ring dashboard** (streak, weekly volume, sparkline consuming `profiles.weekly_goal`) — Phase 12 (DASH-01..05).
- **Active-workout screen re-skin** + the destination of "Starta pass" — Phase 11 (SKIN-04/05).
- **Global i18n zero-missing-keys audit** across all screens + both languages — Phase 15 (I18N-03).
- **Editing the profile display name** — carried from Phase 9; still deferred.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 10-Plans & Exercises Re-skin*
*Context gathered: 2026-06-12*
