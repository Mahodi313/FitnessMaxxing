# Phase 10: Plans & Exercises Re-skin - Pattern Map

**Mapped:** 2026-06-12
**Files analyzed:** 17 (6 re-skin screens · 1 migration · 4 query/schema modules · 2 new utils/data · 1 bootstrap mount · 1 locale pair · 2 script extensions)
**Analogs found:** 17 / 17 (every file has a verified in-repo analog; only `lib/muscle-group.ts` + `lib/seed/exercises.ts` are "new static logic with a structural analog, not a copy-source")

> Every excerpt below was read from live source this session. Line numbers are verified against the working tree on branch `gsd/phase-10-plans-exercises-re-skin`. This is a **re-skin phase**: most "new" files are *modifications* that compose the Phase 8 Forge primitives over existing query hooks. Two genuinely new mechanisms (migration `0010` + first-run seed) have direct structural analogs in `0007` and the root `LocaleBootstrap`.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/app/(app)/(tabs)/index.tsx` | screen (plans list) | request-response (read) | itself + `settings.tsx` (Phase 9 live-`t()` re-skin) | exact (self) |
| `app/app/(app)/plans/[id].tsx` | screen (plan detail) | request-response + CRUD | itself (archive overlay, Starta-pass) | exact (self) |
| `app/app/(app)/plans/new.tsx` | screen (form) | request-response (create) | `plans/[id].tsx` RHF + `exercise-picker.tsx` create form | exact |
| `app/app/(app)/plans/[id]/exercise-picker.tsx` | screen (modal, browse+create) | CRUD + transform (filter) | itself | exact (self) |
| `app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx` | screen (modal, form) | CRUD (update) | `exercise-picker.tsx` (RHF/GHRV) + `plan-exercises.ts` update hook | exact |
| `app/app/(app)/(tabs)/_layout.tsx` | layout (tab bar) | n/a | `components/ui/TabBar.tsx` + `(app)/_layout.tsx` Stack styling | role-match |
| `app/supabase/migrations/0010_*.sql` | migration | n/a | `0007_profiles_weekly_goal.sql` + `0006_phase6_chart_rpcs.sql` (RPC re-deploy) | exact |
| `app/lib/queries/plans.ts` (add `useDeletePlan`) | data-hook | CRUD (delete) | `useArchivePlan` (same file) | exact |
| `app/lib/query/client.ts` (`['plan','delete']` + snapshot payload) | mutation-default | CRUD (delete) | `['session','delete']` (same file, ln 993-1065) | exact |
| `app/lib/queries/exercises.ts` (seed insert reuse) | data-hook | CRUD (insert) | `useCreateExercise` (same file) | exact |
| `app/lib/schemas/exercises.ts` (extend `seed_key` + mg key) | schema | validation | `exerciseRowSchema`/`exerciseFormSchema` (same file) | exact |
| `app/lib/muscle-group.ts` | utility (pure) | transform | `lib/resolve-language.ts` (pure Node-safe core) | role-match |
| `app/lib/seed/exercises.ts` | data module (static) | n/a | new (static array); shape mirrors `ExerciseInsertVars` | structural |
| `app/app/(app)/_layout.tsx` (add `ExerciseSeedBootstrap`) | provider/bootstrap | event-driven (launch effect) | root `_layout.tsx` `LocaleBootstrap`/`ThemeBootstrap` | role-match |
| `app/locales/{sv,en}.json` | config (i18n) | n/a | existing flat keys + Phase 9 additions | exact |
| `app/scripts/test-rls.ts` (extend) | test | RLS cross-user | exercises/plans blocks (ln 335-377) | exact (self) |
| `app/scripts/verify-deploy.ts` (extend) | test | deploy assertion | Phase 6 RPC block (ln 81-119) | exact (self) |

---

## Shared Patterns

These cross-cutting conventions apply to **every** file this phase touches. Copy them verbatim; do not invent new variants.

### SP-1 · Mutation hooks: `mutationKey` + `scope` ONLY (the `mutationFn` lives in `client.ts`)

**Source:** `app/lib/queries/plans.ts` lines 112-131 + `app/lib/query/client.ts` header (lines 20-30).
**Apply to:** new `useDeletePlan`, seed-insert reuse, any new mutation.

```typescript
// app/lib/queries/plans.ts — hooks declare ONLY key + static scope.
export function useArchivePlan(planId?: string) {
  return useMutation<PlanRow, Error, ArchiveVars>({
    mutationKey: ["plan", "archive"] as const,
    scope: planId ? { id: `plan:${planId}` } : undefined,
  });
}
```

The `mutationFn`/`onMutate`/`onError`/`onSettled` MUST live in `setMutationDefaults` at **module top-level** in `client.ts` — never inline in a component or hook (Pitfall 8.5: a paused mutation rehydrated from disk without a registered default has lost its `mutationFn` and silently never replays).

### SP-2 · `mutate(payload, { onError })` — NEVER `mutateAsync` (offline-stall lesson)

**Source:** `app/app/(app)/plans/[id].tsx` lines 213-222 (save) + 236-247 (Starta pass); `exercise-picker.tsx` lines 140-150.
**Apply to:** every mutation call site this phase adds (hard-delete confirm, seed insert, target edit, create-and-add).

```typescript
// plans/[id].tsx onSaveMeta — mutate() returns synchronously even when PAUSED
// under networkMode:'offlineFirst'. mutateAsync left "Sparar…" stuck forever
// in airplane mode (UAT 2026-05-10).
updatePlan.mutate(
  { id: plan.id, name: input.name, description: input.description ?? null },
  { onError: () => setBannerError("Något gick fel. Försök igen.") },
);
```

### SP-3 · Static `scope.id` baked at hook-construction (never function-shaped)

**Source:** `app/lib/queries/plan-exercises.ts` lines 82-87; `plans/[id].tsx` lines 145-147 (`useState(() => randomUUID())` lazy-init for a STABLE id).
**Apply to:** `useDeletePlan(planId)`, the seed mutation scope, and the preserved Starta-pass flow.

TanStack v5 reads `mutation.options.scope?.id` with a `typeof === 'string'` gate. A function-shaped scope silently fails and breaks serial replay (lost FK ordering — Pitfall 4). Bake the string at construction time.

### SP-4 · Zod parse at the wire boundary (Pitfall 8.13) — never bare cast

**Source:** `app/lib/queries/exercises.ts` lines 31-33; `plans.ts` line 46.
**Apply to:** the extended `ExerciseRowSchema` (must add `seed_key`), the seed insert path, and the new `['plan','delete']` (returns `void`, no parse needed).

```typescript
return (data ?? []).map((row) => ExerciseRowSchema.parse(row));
```

### SP-5 · Live `t()` via `useTranslation()` — never capture `t` in module scope

**Source:** `app/app/(app)/(tabs)/settings.tsx` lines 10-11, 54, 60 (the Phase 9 live-re-skin precedent).
**Apply to:** all 6 re-skinned screens. Every visible label/placeholder/error routes through `t()` so the language toggle re-renders text LIVE. Flat 1:1 keys (Phase 8 D-10); seed namespaces (`exercise.<seed_key>.name`, `equip.<key>`) are the ONLY nested keys. User content (plan/exercise names, notes, free-text equipment) is stored raw and rendered verbatim (D-16) — only keyed values flip.

### SP-6 · Forge primitive composition + explicit-prop API + light/dark parity

**Source:** `app/components/ui/ForgeButton.tsx` lines 39-49 (variant/size enum props), `ForgeField.tsx` lines 32-61; barrel `app/components/ui/index.ts`.
**Apply to:** every re-skinned surface.

- Import from the single barrel: `import { ForgeButton, ForgeField, ForgeCard, ForgeChip, ForgeStat, SettingsRow, TabBar, Icon } from "@/components/ui";`
- Primitives take **variant/size enums**, NOT `className` passthrough.
- Every color class pairs a `-light` base with a `dark:` DEFAULT sibling (e.g. `bg-forge-accent-light dark:bg-forge-accent`).
- **FIT-66:** pressed feedback + shadows MUST bypass NativeWind className — use `style={({ pressed }) => [...]}` and explicit iOS shadow STYLE objects (ForgeButton ln 51-59, 143-146). NEVER `active:opacity-*` / `shadow-*` classes.
- **NativeWind purge (Pitfall 3):** off-scale optical values (`18`, `14`, `6`, `64`, `120`, etc.) go in inline `style={{}}` numbers, NOT Tailwind arbitrary classes (`h-[64px]` silently drops).

### SP-7 · Inline absolute-`View` overlay for confirms/menus — NOT a Modal portal

**Source:** `app/app/(app)/plans/[id].tsx` lines 563-619 (overflow popover) + 627-727 (archive-confirm dialog).
**Apply to:** the new hard-delete confirmation dialog (D-10) and the re-skinned overflow menu.

NativeWind/flex layout collapses inside a Modal portal on iOS (UAT 2026-05-10 — no scrim, dialog at top-left). Use an absolute-positioned `<Pressable>` scrim + inner card. Reset overlay state on focus via `useFocusEffect` (plans/[id].tsx ln 168-173) because `freezeOnBlur` keeps the screen mounted.

### SP-8 · Modal screens carry their own `GestureHandlerRootView`

**Source:** `app/app/(app)/plans/[id]/exercise-picker.tsx` lines 161-169.
**Apply to:** picker, picker-create, new-plan, edit. iOS presents modals in a separate `UIViewController` that does NOT inherit the root GHRV.

---

## Pattern Assignments

### `app/supabase/migrations/0010_seed_key_and_session_plan_snapshot.sql` (migration)

**Analog:** `app/supabase/migrations/0007_profiles_weekly_goal.sql` (additive `ADD COLUMN` + RLS-unchanged rationale) and `0006_phase6_chart_rpcs.sql` (the `create or replace function` re-deploy with SECURITY INVOKER + `search_path`).

**Additive ADD COLUMN + RLS-unchanged comment** (copy the `0007` doc-comment shape, lines 6-21):
```sql
-- RLS: NO new policy. public.exercises / public.workout_sessions are already
-- RLS-enabled (0001) with own-row policies that gate on user_id and enumerate
-- NO columns — ADD COLUMN inherits them. Per CLAUDE.md DB conventions, one
-- policy pair per table; a per-column policy is forbidden.
alter table public.exercises
  add column seed_key text;

alter table public.workout_sessions
  add column plan_name_snapshot text;
```

**One-time backfill** (per RESEARCH ln 147-152):
```sql
update public.workout_sessions s
  set plan_name_snapshot = p.name
  from public.workout_plans p
  where p.id = s.plan_id
    and s.plan_name_snapshot is null;
```

**RPC re-deploy** — copy `get_session_summaries` VERBATIM from `0006` lines 49-91, changing ONE line: `p.name as plan_name` → `coalesce(p.name, s.plan_name_snapshot) as plan_name`. Keep `language sql / security invoker / stable / set search_path = ''` and the `revoke all … from public; grant execute … to authenticated;` pair exactly. Note: `s.plan_name_snapshot` must be added to the `group by` (it is functionally dependent on `s.id` which is already grouped — Postgres allows it under `group by s.id`).

**FK:** NO drop+recreate. `workout_sessions.plan_id` is ALREADY `on delete set null` (`0001` line 65). Add a `-- load-bearing for D-11` comment only.

**Post-migration gate (CLAUDE.md, non-negotiable):** `npm run gen:types` co-committed; `npx tsx --env-file=.env.local scripts/verify-deploy.ts`; extend `test:rls`; `npm run test:f13-brutal` stays green; `npm run check:locale-parity`.

---

### `app/lib/query/client.ts` — new `['plan','delete']` default + `plan_name_snapshot` on `['session','start']`

**Analog:** `['session','delete']` (lines 993-1065) for the delete shape; `['session','start']` (lines 625-685) for the snapshot payload addition.

**New `['plan','delete']` default** — mirror `['session','delete']` (registered at module top-level alongside the other defaults). The delete `mutationFn` shape (ln 994-1001):
```typescript
mutationFn: async (vars: SessionDeleteVars) => {
  const { error } = await supabase
    .from("workout_sessions")   // → "workout_plans" for the plan variant
    .delete()
    .eq("id", vars.id);
  if (error) throw error;
  return undefined as void;
},
```
`onMutate` must optimistically filter `plansKeys.list()` (flat array — NOT the infinite-query envelope) AND invalidate `sessionsKeys.listInfinite()` `onSettled` so history re-fetches the now-coalesced `plan_name`. Server cascade does the rest: `plan_exercises` CASCADE away, `workout_sessions.plan_id` → null, `exercise_sets` untouched. `retry: 1`.

**`plan_name_snapshot` on `['session','start']`** — add the field to `SessionInsertVars` and to the `optimisticRow` (ln 651-659), preserving the `satisfies SessionRow` discipline (WR-03):
```typescript
const optimisticRow = {
  id: vars.id,
  user_id: vars.user_id,
  plan_id: vars.plan_id ?? null,
  plan_name_snapshot: vars.plan_name_snapshot ?? null,  // ← NEW
  started_at: vars.started_at ?? new Date().toISOString(),
  finished_at: vars.finished_at ?? null,
  notes: vars.notes ?? null,
  created_at: vars.created_at ?? null,
} satisfies SessionRow;
```
The `SessionInsertVars` / `PlanInsertVars` type aliases live at lines 100-119 — extend `SessionRow` schema first so the `satisfies` still type-checks.

---

### `app/lib/queries/plans.ts` — add `useDeletePlan`

**Analog:** `useArchivePlan` (same file, lines 126-131).

```typescript
export function useDeletePlan(planId?: string) {
  return useMutation<void, Error, { id: string }>({
    mutationKey: ["plan", "delete"] as const,
    scope: planId ? { id: `plan:${planId}` } : undefined,
  });
}
```
Same `ArchiveVars`-style `{ id: string }` var shape (ln 105). Returns `void` (no row to parse).

---

### `app/app/(app)/plans/[id].tsx` (re-skin + hard-delete) — controller, request-response + CRUD

**Analog:** itself. The archive-confirm overlay (lines 627-727) is the **byte-for-byte template** for the new hard-delete dialog.

**Hard-delete confirm dialog** — clone the archive-confirm `<Pressable>` scrim + inner card (ln 627-727), changing:
- Title → `t('deletePlanQ')` ("Ta bort planen?"), body → `t('deletePlanBody')`.
- Primary action → **danger-styled** `t('delete')` (the `#EF4444`/`#DC2626` filled button already in the template at ln 703-723).
- Secondary action → **neutral** `t('keepPlan')` ("Behåll plan") — copy the neutral text button at ln 683-702 but **replace the literal `"Avbryt"`** (ln 686, 700) with the `keepPlan` key. (UI-SPEC forbids generic "Avbryt".)
- Overlay state: add `showDeleteConfirm` alongside `showOverflowMenu`/`showArchiveConfirm` (ln 161-162) and reset it in the `useFocusEffect` (ln 168-173).
- The overflow menu (ln 563-619) gains a second `<Pressable>` row for hard-delete below "Arkivera plan".

**Starta-pass preservation + snapshot** — keep `onStarta` (ln 233-257) intact; add `plan_name_snapshot: plan.name` to the `startSession.mutate({...})` payload (ln 236-242) — `plan` is already in scope via `usePlanQuery`. Preserve the `useState(() => randomUUID())` lazy session id (ln 145) and `router.push('/workout/${newSessionId}')` (ln 256).

**Re-skin chrome** — replace raw `<View>`/`<Text>` chrome with `ForgeCard`/`ForgeButton`/`ForgeStat`/`ForgeChip`. Target chip (`4 × 6–8 reps`) renders null-safe from `plan_exercises.target_*`. Preserve `DraggableFlatList` + `useReorderPlanExercises` + per-row remove + `useArchivePlan` (no confirm). Loading gate stays `!plan` (ln 298), NOT `isPending` (initialData seeds the cache — plans.ts ln 80-84).

---

### `app/app/(app)/plans/[id]/exercise-picker.tsx` (re-skin + filter pills + mg dropdown) — modal, CRUD + transform

**Analog:** itself. Filter logic extends the existing `filtered` memo (lines 90-95).

**Filter pills + search AND-combine** (D-04/D-05) — extend the memo at ln 90-95:
```typescript
// existing:
const filtered = useMemo(() => {
  const q = searchQuery.toLowerCase().trim();
  if (!exercises) return [];
  if (!q) return exercises;
  return exercises.filter((e) => e.name.toLowerCase().includes(q));
}, [exercises, searchQuery]);
// →  add `activeGroup` state + resolveMuscleGroupKey() + display-name match:
//   exercises.filter(e =>
//     (!activeGroup || resolveMuscleGroupKey(e.muscle_group) === activeGroup)
//     && displayName(e).toLowerCase().includes(q))
```
`displayName(e)` = `e.seed_key ? t('exercise.'+e.seed_key+'.name') : e.name` (search matches the *translated* name, D-05).

**Preserve the chained create→add scope contract** (ln 87-88, 127-159) — `useCreateExercise(planId)` + `useAddExerciseToPlan(planId)` share `scope.id='plan:<planId>'` for FK-safe offline replay. Both fired with `mutate` (SP-2). The new **muscle-group dropdown** writes the D-01 key into `muscle_group`; equipment stays free-text (D-02). GHRV wrapper preserved (ln 168, SP-8).

**"Du måste vara inloggad" / "Något gick fel"** error copy (ln 129, 149) → route through `t('errorNotSignedIn')` / `t('errorGeneric')` (D-15; these keys are new this phase).

---

### `app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx` (re-skin) — modal, CRUD update

**Analog:** `exercise-picker.tsx` for the RHF/GHRV/modal shell; `plan-exercises.ts` `useUpdatePlanExercise` (ln 89-94) for the mutation.

`FStepperInput` (sets + reps min/max) writes into `target_sets`/`target_reps_min`/`target_reps_max` (all nullable, D-14 — clearable to null). Submit via `useUpdatePlanExercise(planId).mutate({ id, plan_id, target_*, notes }, { onError })`. Remove-from-plan = danger ghost `ForgeButton` → `useRemovePlanExercise`. Header dismiss `t('closeModal')` (accent) + confirm `t('saveTargets')` (accent bold) — NOT generic "Spara". GHRV wrapper + own `useFocusEffect` reset.

---

### `app/app/(app)/plans/new.tsx` + `(tabs)/index.tsx` (re-skin) — form / list

**Analog:** the RHF form block in `plans/[id].tsx` (ln 189-222) for new-plan; `settings.tsx` for the live-`t()` list re-skin idiom.

New-plan: `ForgeField` name (focused = `2px accent` border, already the `ForgeField` `state="focused"` behavior, ForgeField.tsx ln 68-72) + multiline description; submit `useCreatePlan().mutate(...)` (SP-2). `description` already exists — no migration (D-12). Plans list: re-skin to `FHome`'s **plan-list portion ONLY** (omit the Phase-12 activity-ring hero per UI-SPEC reconciliation note). Preserve `usePlansQuery` (`archived_at is null`), empty-state, active-session banner.

---

### `app/app/(app)/(tabs)/_layout.tsx` (re-skin tab bar) — layout

**Analog:** `app/components/ui/TabBar.tsx` (Phase 8 shell) + `(app)/_layout.tsx` Stack `screenOptions` light/dark idiom (ln 61-89). Planner's call (D / discretion): style the live expo-router `Tabs` or mount the `TabBar` shell. Active = `text-forge-accent` + `strokeWidth 2` + label 600; inactive = `text3` + `strokeWidth 1.6`. Light+dark parity REQUIRED (SKIN-07). Use `useColorScheme()` for any raw-color props.

---

### `app/lib/schemas/exercises.ts` (extend) — schema, validation

**Analog:** same file (lines 17-57).

Add `seed_key: z.string().nullable()` to `exerciseRowSchema` (after `notes`, ln 50) — mandatory so `ExerciseRowSchema.parse()` at the wire boundary (exercises.ts ln 32) accepts the new column. For the form schema, constrain `muscle_group` to the 5 D-01 keys (the dropdown only emits keys) while keeping it nullable/optional for legacy rows. Update `app/scripts/test-exercise-schemas.ts` (cases array, ln 16+) with a muscle-group-key case + a `seed_key` row case.

---

### `app/lib/muscle-group.ts` (NEW) — pure utility, transform

**Analog:** `app/lib/resolve-language.ts` (pure, Node-importable, no RN imports — so a `tsx` test can import it).

Follow the `resolveLanguageCore` shape (resolve-language.ts ln 24-27): a total function with a `?? 'other'` fallback, NO React/Expo imports. Per RESEARCH ln 347-366:
```typescript
export type MuscleGroupKey = "chest" | "back" | "legs" | "shoulders" | "arms" | "other";
const MUSCLE_GROUP_MAP: Record<string, MuscleGroupKey> = { "bröst": "chest", "rygg": "back", "ben": "legs", "axlar": "shoulders", "armar": "arms", "biceps": "arms", "triceps": "arms", /* + en variants */ };
export function resolveMuscleGroupKey(raw: string | null): MuscleGroupKey | null {
  if (!raw) return null;
  return MUSCLE_GROUP_MAP[raw.trim().toLowerCase()] ?? "other";
}
```
A `seed_key` row stores the canonical key already (`"chest"`) → idempotent. Add `app/scripts/test-muscle-group.ts` (Wave 0 gap) following the `test-exercise-schemas.ts` plain-array harness shape (ln 8-50). Display layer renders `t('mg' + Capitalized(key))` (`mgChest`…`mgOther`).

---

### `app/lib/seed/exercises.ts` (NEW) — static data module

**Analog:** none for the array itself; the row shape mirrors `ExerciseInsertVars` (client.ts ln 112-116) — `{ id, user_id, name, muscle_group, equipment, seed_key }`. Use **deterministic UUIDs** per `seed_key` so an upsert re-run (before the flag persists) is idempotent (the `['exercise','create']` default already does `.upsert({ onConflict:'id', ignoreDuplicates:true })`, client.ts ln 420). The 18-row candidate set + `seed_key`/`equip.*` mapping is in RESEARCH ln 219-240. Seed `muscle_group` stores the D-01 key; `equipment` stores the `equip.*` key (rendered via `t()` only when `seed_key` is non-null).

---

### `app/app/(app)/_layout.tsx` (add `ExerciseSeedBootstrap`) — provider/bootstrap, event-driven

**Analog:** root `_layout.tsx` `LocaleBootstrap`/`ThemeBootstrap` (lines 109-183) for the no-op-render fire-and-forget effect; `prefs.ts` (lines 75-96) for the `fm:*` AsyncStorage read/write idiom.

MUST mount inside the **session-gated `(app)/_layout.tsx`** (NOT root — root runs pre-auth; the seed needs `user_id = session.user.id` for RLS `with check`). Add a no-op `<ExerciseSeedBootstrap />` component sibling to `<Stack>` (the `(app)` layout already reads `useAuthStore((s) => s.session)`, ln 60). Pattern (copy `LocaleBootstrap` ln 168-183 fail-open `.finally` shape):
```typescript
function ExerciseSeedBootstrap() {
  const userId = useAuthStore((s) => s.session?.user.id);
  useEffect(() => {
    if (!userId) return;
    const flag = `fm:exercises_seeded:${userId}`;       // namespaced (RESEARCH A3)
    void AsyncStorage.getItem(flag).then((v) => {
      if (v === "true") return;
      // fire the 18 seed mutations via useCreateExercise (deterministic UUIDs),
      // then setItem(flag, "true").  Fire-and-forget; never blocks render.
    }).catch(() => {/* fail-open */});
  }, [userId]);
  return null;
}
```
Idempotency comes from deterministic UUIDs + the upsert default — the flag is just the fast-path skip.

---

### `app/scripts/test-rls.ts` (extend) — RLS cross-user test

**Analog:** the exercises + workout_plans blocks (lines 335-377).

Extend the exercises block (ln 336-355) with a `seed_key` cross-user assertion: seed B an exercise with `seed_key='bench_press'`, assert A's SELECT returns empty and A's UPDATE of `seed_key` on B's row is blocked (reuse the existing `assertEmpty` / `assertWriteBlocked` helpers). The "A cannot DELETE B's workout_plan" assertion (ln 374-377) already covers the hard-delete authz path — re-affirm it passes under the new cascade/SET-NULL behavior.

---

### `app/scripts/verify-deploy.ts` (extend) — deploy assertion

**Analog:** the Phase 6 RPC `pg_proc` assertion block (lines 81-119).

Add (RESEARCH ln 288): an `information_schema.columns` check for `exercises.seed_key` + `workout_sessions.plan_name_snapshot` existence, and a `pg_constraint.confdeltype = 'n'` check that `workout_sessions_plan_id_fkey` is still SET NULL (locks D-11 against regression). Follow the existing `sql\`…\`` query + failure-count + `process.exit(1)` shape (ln 88-119). Re-deployed `get_session_summaries` is already covered by the `phase6Functions` loop (ln 82-86) — it stays INVOKER + `search_path`.

---

## No Analog Found

| File | Role | Reason | Mitigation |
|------|------|--------|------------|
| `app/lib/seed/exercises.ts` | static data | No existing static seed array in the repo (V1 had no global seed by design — exercises.ts header ln 5). | Trivial static `const` array; row shape copies `ExerciseInsertVars`. Not risky. |
| `app/lib/muscle-group.ts` (the MAP itself) | pure data | No existing legacy-value taxonomy map. | Structure copies `resolve-language.ts`'s pure-core + total-fallback idiom; only the lookup table is new. |

Both are net-new *logic*, but each has a **structural analog** to copy the file shape, test harness, and import discipline from. The planner should not reach for RESEARCH.md code examples over these — the in-repo structural analogs are stronger.

---

## Metadata

**Analog search scope:** `app/lib/queries/*`, `app/lib/query/client.ts`, `app/lib/schemas/`, `app/lib/prefs.ts`, `app/lib/resolve-language.ts`, `app/components/ui/*`, `app/app/(app)/**` screens + layouts, `app/supabase/migrations/000{1,6,7}*.sql`, `app/scripts/{test-rls,verify-deploy,test-exercise-schemas}.ts`, `app/locales/sv.json`.
**Files read this session:** 21 (all excerpts line-verified against the working tree).
**Pattern extraction date:** 2026-06-12
**Branch:** `gsd/phase-10-plans-exercises-re-skin`
