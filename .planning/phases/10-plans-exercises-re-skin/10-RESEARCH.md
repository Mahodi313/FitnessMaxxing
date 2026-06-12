# Phase 10: Plans & Exercises Re-skin - Research

**Researched:** 2026-06-12
**Domain:** Frontend re-skin (Forge design system) of plan/exercise CRUD screens + two schema mechanism decisions (hard-delete FK/snapshot, `exercises.seed_key` bilingual seed) + first-run client seed delivery.
**Confidence:** HIGH (every claim verified by reading the actual repo source — schema, query hooks, mutation defaults, screens, scripts. No external research needed; stack is locked and unchanged.)

## Summary

This is a re-skin phase with two genuinely new mechanisms layered on top. The design direction, i18n stack, offline-queue machinery, and migration discipline are all **locked** from Phases 4/6/8/9 — this research did not re-derive them. The research budget went to the two flagged open mechanisms and to inventorying the exact existing code the planner must preserve.

**The single most important finding (D-11):** `workout_sessions.plan_id` is **already `ON DELETE SET NULL`** in `0001_initial_schema.sql` line 65. The "never lose a set" guarantee for hard-delete is therefore **already satisfied at the schema level** — deleting a `workout_plans` row nulls the session's `plan_id` and leaves every `workout_session` + `exercise_set` untouched. The history list (`(tabs)/history.tsx` line 228) **already** renders `"— ingen plan"` when `plan_name` is null (Phase 6 D-08). So the ONLY open decision is whether to add a denormalized `plan_name_snapshot` column to make history read the plan's *former name* instead of the generic "— ingen plan" fallback. **This research recommends ADDING the snapshot column** — it is cheap, it materially improves history readability (a user who deletes "Push/Pull/Ben" still sees that label on past sessions), and it is the only way to surface the plan name post-delete since the JOIN source row is gone. But the planner must understand it is a **UX enhancement, not a data-integrity fix** — the integrity is already there.

**The second mechanism (D-06):** Adding a nullable `exercises.seed_key text` column needs **no new RLS policy** — the existing own-row `exercises` policies from `0001` (lines 117-124) are column-agnostic (they gate on `user_id`, never enumerate columns), so they cover the new column for free. It needs a `gen:types` regen and a `test:rls` assertion that touches the column. The seed is delivered client-side via the normal RLS-respecting offline-queue mutation behind a `fm:exercises_seeded` AsyncStorage flag, mounted as a bootstrap effect inside the authenticated `(app)` tree (NOT in the root `_layout.tsx`, which runs pre-auth).

**Primary recommendation:** Ship **one cohesive migration `0010`** carrying BOTH `exercises.seed_key` AND the `workout_sessions.plan_name_snapshot` column + the explicit FK re-confirmation. Both are additive `ALTER TABLE ... ADD COLUMN` operations on the same migration theme ("surface fields v1 hid + preserve history on delete"); splitting them buys nothing and doubles the gen:types/verify-deploy/test:rls ceremony. The FK does **not** need a drop+recreate (it is already `SET NULL`) — only a verify-deploy assertion to lock it against regression.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Re-skin plan/exercise screens to Forge | Client (RN components) | — | Pure presentation over existing query hooks; no API/DB change |
| Muscle-group taxonomy (5 keys + display) | Client (i18n `t()` + util map) | — | Stored as language-neutral key; legacy→key map is client-side best-effort (D-03) |
| Filter pills + search AND-combine | Client (local component state) | — | Client-side `.filter()` over `useExercisesQuery` result; no query change (D-04/D-05) |
| Hard-delete preserves history | Database (FK `ON DELETE SET NULL` — already present) | Database (snapshot column on session) | "Never lose a set" is owned by the FK; readable history owned by the snapshot column |
| Seed library delivery | Client (offline-queue mutation + AsyncStorage flag) | Database (RLS-scoped INSERT) | First-run client seed via normal mutation (D-07); no superuser/trigger backfill |
| `seed_key` storage + bilingual render | Database (nullable column) | Client (`t('exercise.<key>...')` render) | Column marks seed rows; client flips name/equipment via i18n |
| Per-screen i18n strings | Client (`locales/{sv,en}.json` + `t()`) | — | Flat 1:1 keys (Phase 8 D-10); user content stored raw, never translated (D-16) |

---

<user_constraints>
## User Constraints (from 10-CONTEXT.md)

### Locked Decisions
- **D-01:** Muscle group = fixed 5-key list (`chest`/`back`/`legs`/`shoulders`/`arms`) + implicit `other` bucket. Stored as stable language-neutral key; displayed via `t()`. Create-form uses a dropdown.
- **D-02:** Equipment stays free-text for user-created exercises, stored as written (I18N-05). Only seed rows render equipment via `t()`.
- **D-03:** Existing free-text `muscle_group` values get a best-effort map to the 5 keys; unmatched → Other / raw string. Mapping mechanism = planner's call.
- **D-04:** Muscle-group filter pills: "Alla/All" (default) + 5 single-select group pills. Tapping active pill or "All" clears.
- **D-05:** Filters AND-combine with the search box. Search matches the displayed (translated) name.
- **D-06:** Curated bilingual starter library (~15–20 exercises) seeded into the user's own `exercises`. New nullable `seed_key` column marks seed rows; set → render name/equipment via `t('exercise.<seed_key>...')`. Editing a seed row clears `seed_key`. Muscle group on seed rows uses D-01 keys.
- **D-07:** Seed delivery = client first-run seed behind `fm:exercises_seeded` AsyncStorage flag; insert via normal client mutation (RLS-respecting, through offline queue), then set the flag. Idempotent. No superuser/migration backfill, no signup trigger.
- **D-08:** Seed list is a guide, not a hard contract (~15–20 total, compounds first). Candidate set + bilingual equipment values listed in CONTEXT.
- **D-09:** Preserve all existing plan-detail behavior, re-skinned to Forge: drag-to-reorder, per-exercise remove, soft archive (no confirm), "Starta pass" CTA. Overflow menu may be re-skinned.
- **D-10:** Add a hard-delete path for plans (in addition to archive). Destructive + irreversible → requires a confirmation dialog.
- **D-11:** Hard delete always preserves workout history. Plan row + `plan_exercises` removed; all logged sessions/sets survive; live plan link nulled; history reads sensibly. **Mechanism flagged for research.**
- **D-12:** New-plan screen exposes name (required) + description (optional). `description` already exists — no migration for this field.
- **D-13:** Plan detail surfaces targets as a chip (`4 × 6–8 reps`) from `plan_exercises.target_*`, and exposes the edit-targets screen.
- **D-14:** Targets fully optional (nullable — range, one bound, or none). "Add now, set targets later" flow; no targets prompt on add.
- **D-15:** Fully i18n every screen re-skinned this phase. All chrome + error copy gets sv+en keys added to `locales/{sv,en}.json`. These per-screen strings are NOT yet in the locale files.
- **D-16:** I18N-05 — user-created content stored as written, never auto-translated. Only keyed values flip (muscle-group keys + seed rows' name/equipment).

### Claude's Discretion
- Muscle-group legacy-value → key mapping mechanism (D-03).
- Whether archive/delete affordances stay an iOS action-sheet or become inline Forge controls (D-09).
- Exact `seed_key` values, translation-key namespace, and seed equipment modeling (D-06/D-08).
- Exact Forge token/class choices per control.
- Tab-bar wiring (SKIN-07): Phase 8 `TabBar` shell vs styling Expo Router `Tabs`.
- Empty-state styling.

### Deferred Ideas (OUT OF SCOPE)
- Global read-only exercise library / build-time import of free-exercise-db (own phase).
- Home activity-ring dashboard (Phase 12, DASH-01..05).
- Active-workout screen re-skin + "Starta pass" destination (Phase 11, SKIN-04/05).
- Global i18n zero-missing-keys audit (Phase 15, I18N-03).
- Editing the profile display name (carried from Phase 9; still deferred).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SKIN-02 | Plan screens (list, detail, new-plan) match Forge; surface description + targets; add hard-delete | Re-skin over `usePlansQuery`/`usePlanQuery`/`useArchivePlan` + new `['plan','delete']` mutation. FK already `SET NULL` (history preserved). New snapshot column for readable history. |
| SKIN-03 | Exercise picker browse + filters + create-new; plan-exercise edit exposes muscle group / equipment / targets / notes | Filter pills + dropdown = client-side state over `useExercisesQuery`. Muscle-group taxonomy = 5 i18n keys + legacy map util. `seed_key` column for bilingual seed. |
| SKIN-07 | Tab bar light + dark | Re-skin `TabBar` shell or style live `Tabs`; dark/light parity required. |
| I18N-05 | User-created content stored as written, never auto-translated | Equipment/name/notes stored raw (already true in `exercises` schema). Only muscle-group keys + seed rows flip. Per-screen keys added to `locales/{sv,en}.json`. |
| SKIN-08 (constraint) | F13 hot path no-regression | `workout_sessions` schema touched (snapshot column add only — additive, no behavior change). `test:f13-brutal` must stay green. Session-logging path (`exercise_sets`) untouched. |
</phase_requirements>

---

## Priority Research Answer 1 — Hard-delete FK preservation (D-11)

### Current state (verified by reading source)

**The FK is already `ON DELETE SET NULL`.** From `app/supabase/migrations/0001_initial_schema.sql` line 62-70:

```sql
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.workout_plans(id) on delete set null,   -- ← line 65
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  notes text,
  created_at timestamptz default now()
);
```

Confirmed in `app/types/database.ts`: `workout_sessions.plan_id` is `string | null`, FK `workout_sessions_plan_id_fkey` on `["plan_id"]` (lines 231, 255-256). `[VERIFIED: codebase — 0001_initial_schema.sql + types/database.ts]`

**`exercise_sets.session_id` is `ON DELETE CASCADE`** referencing `workout_sessions` (0001 line 74). This means deleting a *session* purges its sets — but we are NOT deleting sessions on a plan hard-delete; we are deleting a `workout_plans` row, which only touches `workout_sessions.plan_id` (nulls it) and `plan_exercises` (cascades). **No `exercise_sets` are touched by a plan delete.** `[VERIFIED: codebase]`

**`plan_exercises.plan_id` is `ON DELETE CASCADE`** referencing `workout_plans` (0001 line 52). So a plan hard-delete automatically removes the plan's template rows — exactly what D-11 wants. `[VERIFIED: codebase]`

**`plan_exercises.exercise_id` is `ON DELETE RESTRICT`** (0001 line 53) — irrelevant to plan delete, but note it means you cannot delete an `exercises` row that is still referenced by any plan. (Not in scope this phase; flagged for awareness.) `[VERIFIED: codebase]`

### How history reads the plan reference today

Two read paths, both verified:

1. **History list** (`app/app/(app)/(tabs)/history.tsx`) consumes `get_session_summaries` RPC (migration `0006`), which does `LEFT JOIN public.workout_plans p ON p.id = s.plan_id` and returns `p.name AS plan_name` (0006 lines 74, 78-79). The row renderer (line 228) already does:
   ```ts
   const planLabel = session.plan_name ?? "— ingen plan";
   ```
   So after a plan delete: `plan_id` → null → LEFT JOIN yields no plan row → `plan_name` → null → UI renders **"— ingen plan"**. **No dangling/blank/crash.** `[VERIFIED: codebase — history.tsx line 228 + 0006 line 74]`

2. **Session detail** (`app/app/(app)/history/[sessionId].tsx`) does **NOT display the plan name at all** — it shows the date (title), summary chips (set count / volume / duration), and per-exercise cards. Plan name is irrelevant here. **Nothing to fix on the detail screen.** `[VERIFIED: codebase — history/[sessionId].tsx, full read]`

### The actual open decision

The "never lose a set" guarantee is **already met**. The only question is readability of the history *list* after a delete:

- **Without a snapshot:** past sessions of a deleted plan render "— ingen plan" (generic, loses which plan it was).
- **With a snapshot:** past sessions render the plan's *former name* (e.g. "Push/Pull/Ben"), which is materially better history.

### Recommendation: add `workout_sessions.plan_name_snapshot text` (nullable)

**Why this wins over the alternatives:**

| Alternative | Verdict | Why |
|-------------|---------|-----|
| **Snapshot column + keep SET NULL** (recommended) | ✅ WIN | History reads the former plan name forever; integrity already guaranteed by SET NULL; additive column = no FK surgery; trivial backfill |
| Soft-delete-only (no hard delete) | ❌ | Contradicts D-10 (user explicitly wants a hard-delete path distinct from archive) |
| Tombstone table (deleted_plans) | ❌ | New table + new RLS policy + a JOIN change in the RPC — far more surface area for the same read benefit a denormalized column gives directly |
| Change FK to `ON DELETE RESTRICT` (block delete if sessions exist) | ❌ | Defeats the purpose — user wants to delete the plan AND keep history; RESTRICT would make delete impossible once any session used the plan |
| Accept "— ingen plan" (no snapshot) | ⚠️ ACCEPTABLE FALLBACK | Zero schema change; history is functional but loses the plan label. Viable if the planner wants to minimize migration surface, but the snapshot is cheap and the user values history quality ("never lose a set" ethos extends to "never lose context") |

### Exactly what migration `0010` must do (snapshot half)

```sql
-- workout_sessions: denormalized plan-name snapshot so history reads the
-- former plan name after a hard-delete nulls plan_id (D-11).
alter table public.workout_sessions
  add column plan_name_snapshot text;

-- Backfill existing sessions from their still-live plan (one-time).
update public.workout_sessions s
  set plan_name_snapshot = p.name
  from public.workout_plans p
  where p.id = s.plan_id
    and s.plan_name_snapshot is null;
```

- **FK:** NO drop+recreate needed — already `ON DELETE SET NULL`. (Optionally re-affirm it in the migration as a comment so future readers know it is load-bearing for D-11.)
- **RLS:** No change. `workout_sessions` policy "Users can manage own sessions" (0001 line 137-138) is `for all using (user_id = (select auth.uid()))` — column-agnostic, covers the new column for free. `[VERIFIED: codebase — 0001 lines 137-138]`
- **RPC update:** `get_session_summaries` (0006) should `coalesce(p.name, s.plan_name_snapshot)` so a LIVE plan shows its current (possibly-renamed) name and a DELETED plan falls back to the snapshot. This is a `create or replace function` in `0010` — same SECURITY INVOKER + `set search_path = ''` discipline as 0006. Recommended select fragment:
  ```sql
  coalesce(p.name, s.plan_name_snapshot) as plan_name,
  ```
  (The client `SessionSummary` shape and the `"— ingen plan"` fallback stay unchanged — only sessions with *neither* a live plan nor a snapshot render the generic label.)

### Session-CREATE path: populate the snapshot at session start

A snapshot is only useful if it is written at session-creation time. The insert happens in **two places that must both populate `plan_name_snapshot`**:

1. **Mutation default** `['session','start']` in `app/lib/query/client.ts` (lines 625-685). The `mutationFn` upserts `vars` directly into `workout_sessions`. The cleanest approach: **add `plan_name_snapshot` to the `SessionInsertVars` payload** and have the call site pass it. The optimistic `onMutate` builds `optimisticRow` (lines 651-659) — add `plan_name_snapshot: vars.plan_name_snapshot ?? null` there too. `[VERIFIED: codebase — client.ts lines 625-685]`

2. **Call site** `app/app/(app)/plans/[id].tsx` `onStarta` (lines 233-257). The `startSession.mutate({...})` call (line 236) currently passes `{ id, user_id, plan_id, started_at }`. Add `plan_name_snapshot: plan.name` — `plan` is already in scope (loaded via `usePlanQuery`). `[VERIFIED: codebase — plans/[id].tsx lines 233-257]`

> **Trade-off note for the planner:** an alternative is a Postgres trigger `before insert on workout_sessions` that copies `plan_name` from the referenced plan. This avoids touching the client. BUT the repo convention strongly favors keeping logic in the client mutation layer (the offline-queue requires the optimistic cache row to match the DB row shape — see the `satisfies SessionRow` discipline at client.ts line 659, WR-03). A trigger would write a value the optimistic row doesn't know about, creating a brief cache/DB divergence on the new `/workout/<id>` screen. **Recommend the client-populated approach** (payload field) for cache-shape consistency, with the migration's one-time backfill covering all pre-existing rows. If the planner prefers belt-and-braces, a trigger as a server-side safety net is acceptable but adds the divergence caveat.

### F13 no-regression (SKIN-08)

The snapshot column add is **additive and does not touch the session-logging hot path** (`exercise_sets` INSERT via `['set','add']`). The only `workout_sessions` write changed is the START insert, which adds one nullable text field to the payload — no change to logging latency or the `set_number` trigger path. `npm run test:f13-brutal` exercises the `exercise_sets` brutal-insert path, which is untouched. **Confirm green after migration + client change.** The verify step belongs in the Validation Architecture section below. `[VERIFIED: reasoning over client.ts mutation set — no `set`/`exercise_sets` default touched]`

---

## Priority Research Answer 2 — `exercises.seed_key` column (D-06)

### Column shape

```sql
-- exercises: marks curated bilingual seed rows. NULL = user-created free-text
-- row (rendered raw). Non-null = curated seed; client renders name + equipment
-- via t('exercise.<seed_key>.name') / t('equip.<key>') and flips sv↔en (D-06).
alter table public.exercises
  add column seed_key text;
```

Nullable, no default, no constraint. `[CITED: D-06 + verified column-agnostic RLS]`

### RLS: no new policy needed (verified)

The existing `exercises` policies in `0001` (lines 117-124) are:
- SELECT: `using (user_id is null or user_id = (select auth.uid()))`
- INSERT: `with check (user_id = (select auth.uid()))`
- UPDATE: `using (...) with check (...)`
- DELETE: `using (user_id = (select auth.uid()))`

**None of them enumerate columns** — they gate purely on `user_id`. Adding a `seed_key` column is invisible to RLS; the policies cover reads and writes of the new column automatically. **No policy change required.** `[VERIFIED: codebase — 0001 lines 116-124]`

A `test:rls` assertion that *touches* the column is still required (per CLAUDE.md gate): extend the existing exercises cross-user block in `app/scripts/test-rls.ts` (lines 335-355) to assert User A cannot read/write User B's seed row, e.g. seed an exercise for B with `seed_key='bench_press'` and assert A's SELECT returns empty and A's UPDATE of `seed_key` on B's row is blocked. `[VERIFIED: codebase — test-rls.ts lines 335-355]`

### "Editing a seed row clears seed_key" = client-side mutation concern (confirmed)

D-06's rule "editing a seed row clears `seed_key`" is **not a DB constraint**. It is enforced in the client: when the user edits a seed exercise (via the picker create/edit form path), the update mutation sets `seed_key: null` in the payload. There is no existing `useUpdateExercise` mutation — the repo only has `useCreateExercise` (exercises.ts line 51). **A new `['exercise','update']` mutation default + hook is needed** if seed-row editing must persist (currently the picker create-form only *creates*; there is no edit-existing-exercise screen in scope). 

> **Planner flag:** Re-read the scope. The in-scope screens edit *plan_exercises targets* (`edit.tsx`), NOT the underlying `exercises` row. There is no "edit exercise name/muscle/equipment" screen in the Phase 10 scope list. So "editing a seed row clears seed_key" may be **latent** (no UI triggers it yet) — the rule is a forward-looking invariant. If the planner adds no exercise-edit UI, the clear-on-edit rule has nothing to fire against this phase, and `seed_key` only ever transitions null←(never) or is set once at seed time. **Recommend:** document the rule as a contract for whenever an exercise-edit mutation lands (this phase or later), and if no exercise-edit UI is built, note it as deferred. `[ASSUMED — scope interpretation; planner should confirm whether seed-row editing UI is in or out]`

### Translation-key namespace + seed_key convention

Cross-checked against the **flat 1:1 key convention** (Phase 8 D-10) confirmed by reading `locales/sv.json` (all top-level flat keys). The UI-SPEC Copywriting Contract already specifies the seed namespaces as the **only** nested keys:
- Seed names: `exercise.<seed_key>.name` (e.g. `exercise.bench_press.name` = "Bänkpress" / "Bench press")
- Seed equipment: `equip.<key>` (e.g. `equip.barbell` = "Skivstång" / "Barbell")

**Recommended `seed_key` values** (snake_case, language-neutral, derived from the D-08 candidate list):

| seed_key | sv name | en name | muscle_group (D-01 key) | equipment (equip.* key) |
|----------|---------|---------|-------------------------|-------------------------|
| `bench_press` | Bänkpress | Bench press | `chest` | `barbell` |
| `incline_db_press` | Lutande hantelpress | Incline DB press | `chest` | `dumbbell` |
| `dips` | Dips | Dips | `chest` | `bodyweight` |
| `deadlift` | Marklyft | Deadlift | `back` | `barbell` |
| `pull_ups` | Chins | Pull-ups | `back` | `bodyweight` |
| `barbell_row` | Skivstångsrodd | Barbell row | `back` | `barbell` |
| `lat_pulldown` | Latsdrag | Lat pulldown | `back` | `cable` |
| `squat` | Knäböj | Squat | `legs` | `barbell` |
| `leg_press` | Benpress | Leg press | `legs` | `machine` |
| `romanian_deadlift` | Rumänsk marklyft | Romanian deadlift | `legs` | `barbell` |
| `lunges` | Utfall | Lunges | `legs` | `dumbbell` |
| `overhead_press` | Axelpress | Overhead press | `shoulders` | `barbell` |
| `lateral_raise` | Sidolyft | Lateral raise | `shoulders` | `dumbbell` |
| `face_pull` | Face pull | Face pull | `shoulders` | `cable` |
| `db_curl` | Stående hantelcurl | DB curl | `arms` | `dumbbell` |
| `hammer_curl` | Hammercurl | Hammer curl | `arms` | `dumbbell` |
| `triceps_pushdown` | Triceps pushdown | Triceps pushdown | `arms` | `cable` |
| `skullcrusher` | Skullcrusher | Skullcrusher | `arms` | `barbell` |

(18 rows. Equipment keys: `barbell`, `dumbbell`, `cable`, `machine`, `bodyweight` — 5 keys mapping to the D-08 bilingual set Skivstång/Hantlar/Kabel/Maskin/Kroppsvikt. Note UI-SPEC uses `equip.barbell` etc.; I recommend singular `dumbbell` to match the singular `barbell` even though the Swedish display is plural "Hantlar" — the *key* is language-neutral, the *value* carries the plural.) `[CITED: D-08 candidate list + UI-SPEC Copywriting Contract]`

**Storage:** the seed row's `muscle_group` column stores the D-01 key string (e.g. `"chest"`), the `equipment` column stores the `equip.*` key (e.g. `"barbell"`), and the client renders `t('equip.' + row.equipment)` ONLY when `seed_key` is non-null; for user rows it renders `equipment` raw. **Decision point for planner:** should seed rows store the *key* in `equipment` (and render via `t()`), or store nothing in `equipment` and derive everything from `seed_key`? Recommend storing the `equip.*` key in `equipment` so the muscle-group/equipment subtitle render logic has a uniform source, with a single branch `seed_key ? t('equip.'+equipment) : equipment`. `[ASSUMED — storage shape for seed equipment; reasonable but planner confirms]`

### First-run client seed delivery (D-07)

**The `fm:exercises_seeded` flag** follows the established `fm:*` AsyncStorage convention (`app/lib/prefs.ts`). It is a one-shot boolean-ish flag, NOT a typed pref — recommend a tiny dedicated helper rather than extending `prefs.ts` (which is for user preferences). A simple pattern:
```ts
// idempotent guard
const seeded = await AsyncStorage.getItem("fm:exercises_seeded");
if (seeded === "true") return;
// ... insert seed rows via the offline-queue mutation ...
await AsyncStorage.setItem("fm:exercises_seeded", "true");
```
`[VERIFIED: codebase — prefs.ts fm:* idiom + _layout.tsx LocaleBootstrap precedent]`

**Insert mechanism:** the seed rows go in via the **normal `['exercise','create']` mutation default** (client.ts lines 416-447), which is already idempotent (`.upsert({ onConflict: 'id', ignoreDuplicates: true })`). This gives offline-safety + optimistic cache for free. Two viable shapes:
- **(a)** Fire 18 individual `useCreateExercise().mutate(...)` calls in a loop with deterministic UUIDs (so replay is idempotent even if the flag write fails mid-batch).
- **(b)** A single batch upsert. The existing mutation default does `.single()` so it expects one row — a batch needs either a new `['exercise','seed-batch']` default or N individual mutates. **Recommend (a)** — reuses the existing default verbatim, idempotent per-row, and the AsyncStorage flag only flips after the batch is enqueued. Use **deterministic seed UUIDs** (e.g. `uuidv5` from a fixed namespace + seed_key, or hardcoded UUIDs in the seed-data module) so a re-run before the flag persists upserts the same IDs (no duplicates). `[VERIFIED: codebase — client.ts ['exercise','create'] upsert idempotency lines 416-447]`

> **Important idempotency subtlety:** `useCreateExercise` (exercises.ts) requires `user_id` in the payload (RLS `with check (user_id = auth.uid())`). The seed must run **after auth resolves** (the `user_id` must be the signed-in user). It therefore CANNOT mount in the root `app/_layout.tsx` (which runs the LocaleBootstrap/FontBootstrap during the pre-auth splash window). It must mount inside the authenticated `(app)` tree. `[VERIFIED: codebase — _layout.tsx runs pre-auth; (app)/_layout.tsx is session-gated]`

**Where the launch effect mounts (exact wiring):** The root `app/app/_layout.tsx` bootstrap components (`ThemeBootstrap`, `FontBootstrap`, `LocaleBootstrap` — lines 109-183, mounted at 265-267) all run during the pre-auth splash hold. The seed is **auth-dependent**, so it must mount one level down, inside `app/app/(app)/_layout.tsx` (the session-gated group layout — verified it renders `<Redirect>` when no session and is keyed to `session.user.id`). 

**Recommended:** add an `ExerciseSeedBootstrap` component rendered inside `(app)/_layout.tsx` (alongside the Stack), reading `useAuthStore((s) => s.session?.user.id)`, gated on the `fm:exercises_seeded` flag, firing the seed mutations once per signed-in user. It must:
- Be a no-op render (`return null`).
- Run its effect only when `userId` is present.
- Be idempotent (flag + deterministic UUIDs).
- Not block the splash or any render (fire-and-forget, like LocaleBootstrap's fail-open `.finally`).

`[VERIFIED: codebase — (app)/_layout.tsx is the correct auth-gated mount point; root bootstraps are pre-auth]`

> **Edge case for planner:** the flag is device-local, not per-user. If two different users sign in on the same device, the second user would be skipped (flag already "true") and get no seed. For a single-user personal tool (V1 constraint), this is acceptable — but the cleaner key is **`fm:exercises_seeded:<userId>`** (namespaced per user) to future-proof. Recommend the namespaced key. `[ASSUMED — multi-user-on-device is out of V1 scope; namespaced key is cheap insurance]`

---

## Migration `0010` cohesion recommendation

**Ship ONE migration `0010_seed_key_and_session_plan_snapshot.sql`** carrying:
1. `alter table public.exercises add column seed_key text;`
2. `alter table public.workout_sessions add column plan_name_snapshot text;`
3. One-time backfill: `update workout_sessions set plan_name_snapshot = p.name from workout_plans p where p.id = plan_id and plan_name_snapshot is null;`
4. `create or replace function public.get_session_summaries(...)` with `coalesce(p.name, s.plan_name_snapshot) as plan_name` (re-deploys the 0006 function body with the one-line coalesce change; keep SECURITY INVOKER + `set search_path = ''` + grants verbatim from 0006).

**Why one migration, not 0010+0011:** Both are additive `ADD COLUMN` operations under the same phase theme ("surface hidden fields + preserve delete history"). They share the gen:types regen, the verify-deploy run, and the test:rls extension. Splitting doubles the ceremony (two type-gens, two pushes, two verify runs) with no isolation benefit — neither column depends on the other, and neither is risky enough to warrant an independent rollback boundary. The RPC `create or replace` (item 4) belongs with the snapshot column it reads. `[VERIFIED: reasoning over CLAUDE.md migration discipline + 0006/0007 precedent]`

**Post-migration checklist (CLAUDE.md gate, non-negotiable):**
- `npm run gen:types` → regenerate `app/types/database.ts` → commit in the SAME commit as the migration.
- `npx tsx --env-file=.env.local scripts/verify-deploy.ts` after push (Windows-no-Docker path per CLAUDE.md). **NOTE:** verify-deploy.ts currently checks RLS/policies/triggers/functions/enums/tables but does **NOT** assert FK `ON DELETE` rules or new columns. **Recommend adding** a `pg_attribute`/`information_schema.columns` check for `exercises.seed_key` + `workout_sessions.plan_name_snapshot` existence, AND a `pg_constraint`/`confdeltype` check that `workout_sessions_plan_id_fkey` is still `SET NULL` (confdeltype = 'n'), so the D-11 guarantee is locked against regression. `[VERIFIED: codebase — verify-deploy.ts has no FK/column assertions today]`
- Extend `app/scripts/test-rls.ts` with: (a) `exercises.seed_key` cross-user assertion, (b) a hard-delete cross-user assertion (A cannot delete B's plan — already covered at line 374-377; verify it still passes with the cascade/SET-NULL behavior).
- `npm run test:f13-brutal` → must stay green (SKIN-08).
- `npm run check:locale-parity` → sv↔en key parity after adding the new screen keys (script exists, package.json line 29).

---

## Hard-delete mutation (new `['plan','delete']`)

A new mutation default + hook is required (the repo has `['plan','archive']` but no hard-delete). Pattern mirrors `['session','delete']` (client.ts lines 993-1065):

```ts
// client.ts — new default
queryClient.setMutationDefaults(["plan", "delete"], {
  mutationFn: async (vars: { id: string }) => {
    const { error } = await supabase.from("workout_plans").delete().eq("id", vars.id);
    if (error) throw error;
    return undefined as void;
  },
  onMutate: async (vars) => {
    await queryClient.cancelQueries({ queryKey: plansKeys.list() });
    const previous = queryClient.getQueryData<PlanRow[]>(plansKeys.list());
    queryClient.setQueryData<PlanRow[]>(plansKeys.list(), (old = []) =>
      old.filter((r) => r.id !== vars.id));
    // Also clear detail cache + invalidate sessionsKeys.listInfinite() so the
    // history list re-fetches plan_name (now coalesces to snapshot).
    return { previous };
  },
  onError: (_e, _v, ctx) => { /* rollback */ },
  onSettled: () => {
    void queryClient.invalidateQueries({ queryKey: plansKeys.list() });
    void queryClient.invalidateQueries({ queryKey: sessionsKeys.listInfinite() });
  },
  retry: 1,
});
```

```ts
// plans.ts — new hook
export function useDeletePlan(planId?: string) {
  return useMutation<void, Error, { id: string }>({
    mutationKey: ["plan", "delete"] as const,
    scope: planId ? { id: `plan:${planId}` } : undefined,
  });
}
```

**Module-load-order invariant:** the new default MUST register at module top-level in client.ts (Pitfall 8.5 — before persister hydrates). It is registered automatically by being in the same file. `[VERIFIED: codebase — mirrors ['session','delete'] + ['plan','archive'] patterns]`

**Server-side cascade on hard-delete (verified behavior):** `DELETE FROM workout_plans WHERE id = ?` → `plan_exercises` cascades away (FK CASCADE) → `workout_sessions.plan_id` nulls (FK SET NULL) → `exercise_sets` untouched (they hang off sessions, not plans). RLS `for all using (user_id = auth.uid())` gates the delete to the owner. **No client-side child cleanup needed.** `[VERIFIED: codebase — 0001 FK rules]`

---

## Secondary Research

### Muscle-group legacy-value → 5-key map (D-03)

Existing `exercises.muscle_group` is **free text today** (schema `text`, no constraint; the old picker create-form stored `t.ex. Bröst` raw — exercise-picker.tsx line 226, 545 in test-rls seeds `"Bröst"`). Recommend a **pure client-side best-effort map** in a new util `app/lib/muscle-group.ts`:

```ts
// Maps legacy free-text (sv OR en) → D-01 key; unknown → 'other'.
const MUSCLE_GROUP_MAP: Record<string, MuscleGroupKey> = {
  // chest
  "bröst": "chest", "brost": "chest", "chest": "chest", "bröstmuskler": "chest",
  // back
  "rygg": "back", "back": "back", "lats": "back",
  // legs
  "ben": "legs", "legs": "legs", "lår": "legs",
  // shoulders
  "axlar": "shoulders", "axel": "shoulders", "shoulders": "shoulders",
  // arms (biceps+triceps collapsed)
  "armar": "arms", "arms": "arms", "biceps": "arms", "triceps": "arms",
};
export function resolveMuscleGroupKey(raw: string | null): MuscleGroupKey | null {
  if (!raw) return null;
  return MUSCLE_GROUP_MAP[raw.trim().toLowerCase()] ?? "other";
}
```
The display layer renders `t('mg' + capitalize(key))` (`mgChest`, `mgBack`, ... `mgOther` per UI-SPEC keys). Unmatched raw values surface under "Other" / can optionally show the raw string. Filter pills filter on the *resolved key*. `[VERIFIED: codebase — muscle_group is free text; UI-SPEC mg* keys]`

> Subtlety: a seed row stores the canonical key already (`"chest"`), so `resolveMuscleGroupKey("chest")` → `"chest"` (idempotent). User rows store legacy free text and get mapped. Both flow through the same util.

### Exercise picker filter pills (D-04/D-05)

Confirmed **straightforward local component state over the existing `useExercisesQuery` result** — no query change. The current picker already does client-side `.filter()` for search (exercise-picker.tsx lines 90-95). Add:
- `const [activeGroup, setActiveGroup] = useState<MuscleGroupKey | null>(null)` (null = "Alla").
- The `filtered` memo AND-combines: `exercises.filter(e => (!activeGroup || resolveMuscleGroupKey(e.muscle_group) === activeGroup) && matchesSearch(e))`.
- Search matches the **displayed** name: for seed rows that's `t('exercise.'+seed_key+'.name')`, for user rows it's `e.name` raw. Build the display name once per row and filter on it (D-05). `[VERIFIED: codebase — picker filter pattern lines 90-95]`

**Invariants to preserve in the re-skin (verified):**
- The RHF create-form + chained `useCreateExercise(planId)` → `useAddExerciseToPlan(planId)` under **shared `scope.id='plan:<planId>'`** for FK-safe offline replay (exercise-picker.tsx lines 87-88, 127-159). The new muscle-group **dropdown** and **filter pills** are pure UI additions — they do not change the mutation scope contract.
- `mutate(payload, { onError })` not `mutateAsync` (Phase 4 lesson — exercise-picker.tsx line 140-150 comment).
- Modal needs its own `GestureHandlerRootView` wrapper (exercise-picker.tsx lines 161-168, UAT 2026-05-10).

### Re-skin invariants that MUST NOT regress (verified against source)

| Invariant | Source proof | Applies to |
|-----------|-------------|------------|
| `mutate(payload, {onError, onSuccess})` NOT `mutateAsync` under offlineFirst | plans/[id].tsx line 210-222, exercise-picker.tsx 140-150 | All mutation call sites this phase touches |
| Inline absolute-`View` overlays, NOT Modal portals, for confirms/menus | plans/[id].tsx overflow (563-619) + archive-confirm (627-727); history/[sessionId].tsx (436-601) | Hard-delete confirm dialog (D-10), overflow menu |
| Modal screens need own `GestureHandlerRootView` wrapper | exercise-picker.tsx 168; root only wraps the main tree (_layout.tsx 237) | picker, picker-create, new-plan, edit |
| `useFocusEffect` resets modal/overlay state on blur (freezeOnBlur) | plans/[id].tsx 168-173; history/[sessionId].tsx 158-167 | Any screen with overlay-state local state |
| Dark/light NativeWind `dark:` coverage on every surface | every screen reads `useColorScheme()` + pairs `bg-white dark:bg-gray-900` | All re-skinned screens incl. tab bar (SKIN-07) |
| `useState(() => randomUUID())` lazy-init for stable session/scope id | plans/[id].tsx 145 | "Starta pass" CTA preservation |
| Loading gate on `!data` not `isPending` (initialData seeds detail caches) | plans/[id].tsx 298; sessions.ts initialData 96-102 | plan detail re-skin |

The hard-delete confirmation dialog (D-10) **must** use the inline-overlay pattern (verified twice in-repo: archive-confirm in plans/[id].tsx and delete-confirm in history/[sessionId].tsx are byte-for-byte the template). The UI-SPEC mandates a danger-styled `Ta bort` confirm + neutral `Behåll plan` secondary (NOT generic "Avbryt"). `[VERIFIED: codebase — both overlay templates]`

### Files in scope + closest analog

| File (to re-skin / create) | Status | Closest existing analog |
|----------------------------|--------|-------------------------|
| `app/app/(app)/(tabs)/index.tsx` | re-skin | itself (plans list) → `FHome` plan-list portion |
| `app/app/(app)/plans/[id].tsx` | re-skin + add hard-delete | itself → `FPlanDetail`; hard-delete mirrors archive-confirm overlay already in this file |
| `app/app/(app)/plans/new.tsx` | re-skin | itself → `FNewPlan` |
| `app/app/(app)/plans/[id]/exercise-picker.tsx` | re-skin + filter pills + dropdown | itself → `FExercisePicker`/`FExercisePickerNew` |
| `app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx` | re-skin | itself → `FExerciseEdit` |
| `app/app/(app)/(tabs)/_layout.tsx` | re-skin tab bar | Phase 8 `TabBar` shell / live `Tabs` |
| `app/supabase/migrations/0010_*.sql` | NEW | `0007_profiles_weekly_goal.sql` (additive column + RLS-unchanged + gen:types pattern) |
| `app/lib/queries/plans.ts` | add `useDeletePlan` | existing `useArchivePlan` in same file |
| `app/lib/query/client.ts` | add `['plan','delete']` default + `plan_name_snapshot` to `['session','start']` payload | existing `['session','delete']` + `['plan','archive']` |
| `app/lib/schemas/exercises.ts` | extend `exerciseRowSchema` with `seed_key`, form schema with muscle-group key | existing schema in same file |
| `app/lib/muscle-group.ts` | NEW (legacy→key map util) | new — no analog, but trivial pure function |
| `app/lib/seed/exercises.ts` (or similar) | NEW (seed data module) | new — static data array |
| `app/app/(app)/_layout.tsx` | add `ExerciseSeedBootstrap` mount | root `_layout.tsx` LocaleBootstrap pattern (but auth-gated) |
| `app/locales/{sv,en}.json` | add per-screen + seed namespace keys | existing flat keys + new `exercise.*`/`equip.*` nested |
| `app/scripts/test-rls.ts` | extend (seed_key + delete assertions) | existing exercises/plans blocks lines 335-377 |
| `app/scripts/verify-deploy.ts` | extend (column + FK confdeltype assertions) | existing Phase 6 RPC assertion block lines 81-119 |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Preserve sets on plan delete | Soft-delete flag + filtering everywhere | The existing `ON DELETE SET NULL` FK (already there) | Schema already guarantees it; filtering would be a regression risk |
| Plan-name in history after delete | A `deleted_plans` tombstone table + JOIN | Denormalized `plan_name_snapshot` column | One column vs a table+RLS+RPC-join change |
| Bilingual seed render | Storing both sv+en strings in DB columns | `seed_key` + i18n `t()` keys | Keeps DB language-neutral; flips with the app locale; matches I18N-05 |
| First-run seed | A signup DB trigger / superuser backfill | Client offline-queue mutation + `fm:*` flag | D-07 explicit; offline-safe; idempotent via upsert |
| Idempotent seed | Manual "does it exist" SELECT before insert | `.upsert({onConflict:'id', ignoreDuplicates:true})` (existing default) + deterministic UUIDs | Already the repo's idempotency mechanism (client.ts) |
| Confirm dialog | `Modal` portal or `Alert.alert` | Inline absolute-`View` overlay | NativeWind/flex silently collapses in Modal portals on iOS (UAT 2026-05-10) |
| New mutation lifecycle | Inline `mutationFn` in component | `setMutationDefaults` at module top-level | Paused mutations rehydrate without a fn otherwise (Pitfall 8.12) |

**Key insight:** the heavy lifting for D-11 was done in Phase 1 (the FK) and Phase 6 (the null-fallback in history). This phase's job is a thin enhancement (snapshot column) + the missing hard-delete mutation — not a new history-preservation system.

---

## Runtime State Inventory (rename/data-shape phase — partial trigger)

This is a re-skin + additive-schema phase, not a rename. But D-03 (legacy muscle-group values) and D-07 (seed) touch stored data, so:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `exercises.muscle_group` holds legacy free-text (e.g. "Bröst") for any exercises the dev user already created. New seed rows store D-01 keys. | Client-side `resolveMuscleGroupKey` map (read-time, no data migration — D-03 is best-effort display, NOT a backfill). `workout_sessions.plan_name_snapshot` IS backfilled in the migration for existing rows. |
| Live service config | None — no external service holds plan/exercise state. Supabase is the only datastore; it is schema-migrated. | None. |
| OS-registered state | None — no Task Scheduler / launchd / pm2 entries reference plan or exercise data. | None — verified by scope (mobile app, no host daemons). |
| Secrets/env vars | None new. `SUPABASE_SERVICE_ROLE_KEY` used only by `test-rls.ts` (unchanged). | None. |
| Build artifacts | `app/types/database.ts` becomes stale after the `0010` ADD COLUMN — MUST regen via `npm run gen:types` and co-commit. | `npm run gen:types` after migration; commit together. |

**`fm:exercises_seeded` AsyncStorage flag** is device-local runtime state introduced by D-07. Recommend namespacing per user (`fm:exercises_seeded:<userId>`) to avoid a second device-user being skipped. The flag is set-once after the seed batch enqueues.

---

## Common Pitfalls

### Pitfall 1: Mounting the seed bootstrap in the root `_layout.tsx`
**What goes wrong:** the seed mutation needs `user_id = auth.uid()` (RLS `with check`), but root `_layout.tsx` bootstraps run during the pre-auth splash hold — `session` is null/loading there.
**How to avoid:** mount `ExerciseSeedBootstrap` inside `(app)/_layout.tsx` (session-gated), reading `session.user.id`. Gate the effect on `userId` presence.
**Warning sign:** seed rows fail to insert silently (RLS rejects null user_id) or insert with a null user_id and never appear (SELECT filters them).

### Pitfall 2: Assuming the snapshot is a data-integrity requirement
**What goes wrong:** over-engineering a tombstone/soft-delete system when the FK already preserves sets.
**How to avoid:** recognize SET NULL already guarantees "never lose a set"; the snapshot is pure UX readability.
**Warning sign:** a plan that touches `workout_sessions` row deletion or `exercise_sets` — it should touch NEITHER.

### Pitfall 3: Tailwind arbitrary classes for optical values
**What goes wrong:** NativeWind 4 on Tailwind 3 purges arbitrary classes off the configured scale (`h-[64px]`, `gap-[6px]` silently drop). The UI-SPEC enumerates many optical exceptions.
**How to avoid:** apply non-4-multiple optical values as literal inline `style={{ }}` numbers (UI-SPEC Implementation note, Phase 4/9 precedent).
**Warning sign:** a control renders at the wrong/zero size in Expo Go but the class "looks right" in source.

### Pitfall 4: Function-shaped `scope.id`
**What goes wrong:** TanStack v5 reads `mutation.options.scope?.id` with a `typeof === 'string'` gate; a function-shaped scope silently fails and serial replay breaks (lost FK ordering).
**How to avoid:** bake the scope string at hook-construction time (`useDeletePlan(planId)` → `scope: { id: 'plan:'+planId }`). Same contract as every existing hook.
**Warning sign:** offline-created-then-deleted plan replays out of order on reconnect.

### Pitfall 5: Forgetting gen:types co-commit / verify-deploy after migration
**What goes wrong:** `database.ts` goes stale; type-checks pass against the old shape; the new columns are invisible to the client types.
**How to avoid:** the CLAUDE.md gate — `npm run gen:types` in the SAME commit as the migration; `verify-deploy.ts` after push.
**Warning sign:** `seed_key` / `plan_name_snapshot` not appearing in `types/database.ts`.

### Pitfall 6: Generic blocked CTA labels
**What goes wrong:** using "Avbryt/Cancel" or bare "Spara/Save" — explicitly forbidden by the UI-SPEC Copywriting Contract. (Note: the *existing* archive-confirm overlay in plans/[id].tsx still uses "Avbryt" — the re-skin must replace it with the scoped keys.)
**How to avoid:** modal-dismiss = `Stäng` (`closeModal`); delete-decline = `Behåll plan` (`keepPlan`); edit-confirm = `Spara mål` (`saveTargets`).
**Warning sign:** a new screen references a legacy `cancel`/`save` key.

---

## State of the Art

| Old (current code) | New (this phase) | Impact |
|--------------------|------------------|--------|
| Picker create-form: free-text `muscle_group` (`t.ex. Bröst`) | Dropdown over 5 D-01 keys + legacy map for old rows | Keyed, bilingual, filterable |
| History list shows `"— ingen plan"` for null plan | `coalesce(p.name, plan_name_snapshot)` → former plan name | Readable history post-delete |
| Plans: archive only | Archive + hard-delete (confirmed) | D-10 destructive path |
| No exercise library content on first run | 18 curated bilingual seed rows | Picker never feels empty |
| Per-screen strings hardcoded in `s` objects (forge-screens) / inline Swedish | All routed through `t()` with sv+en keys | Full i18n of touched screens |

**Nothing deprecated** — all changes are additive. The stack is unchanged (verified package.json: no new deps needed). If the planner finds a need for a new dependency, that is a **deviation requiring loud justification** — none was identified in this research.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Editing a seed row clears seed_key" may be latent — no exercise-edit UI is in the Phase 10 scope list (only plan_exercises target edit) | Priority Answer 2 | If an exercise-edit screen IS in scope, a new `['exercise','update']` mutation + clear-seed_key logic is needed; planner must confirm |
| A2 | Seed equipment stored as the `equip.*` key in the `equipment` column (rendered via `t()` when seed_key set) | Priority Answer 2 | If planner prefers deriving equipment purely from seed_key, the storage shape differs; low risk, cosmetic |
| A3 | Namespaced `fm:exercises_seeded:<userId>` flag (vs bare flag) | Priority Answer 2 / D-07 | Bare flag works for single-user V1; namespaced is insurance for multi-user-on-device (out of V1 scope) |
| A4 | Client-populated `plan_name_snapshot` (payload field) preferred over a DB trigger, for cache-shape consistency | Priority Answer 1 | A trigger is acceptable but introduces a brief optimistic-cache/DB divergence on the new workout screen |
| A5 | One cohesive migration `0010` (not 0010+0011) | Migration cohesion | If a future reviewer wants independent rollback boundaries, split; no functional difference |
| A6 | The recommended 18-row seed list + snake_case seed_key values | Priority Answer 2 / D-08 | D-08 says the list is a guide; planner may refine names/counts — keys are illustrative |

**These six assumptions are the decisions needing user/planner confirmation.** Everything else in this research is `[VERIFIED: codebase]`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase project (remote) | migration 0010, verify-deploy, test:rls | ✓ (project-id `mokmiuifpdzwnceufduu`) | — | — |
| `npx supabase` CLI (gen:types) | type regen | ✓ (used by `gen:types` script) | — | — |
| `tsx` | test:rls, verify-deploy, test:f13-brutal | ✓ | ^4.21.0 | — |
| `postgres` (npm) | verify-deploy.ts direct pg_catalog query | ✓ | ^3.4.9 | — |
| Docker | NOT required (CLAUDE.md D-04 — verify-deploy.ts replaces `supabase db diff`) | ✗ (intentionally) | — | `verify-deploy.ts` (already the standard) |
| Expo Go (iOS device) | UAT of re-skin | ✓ (dev workflow) | SDK 54 | — |

**No new package dependencies.** All work uses the locked stack (Expo SDK 54, NativeWind 4.2 + Tailwind 3, Supabase, TanStack Query v5, Zod 4, react-i18next). `[VERIFIED: package.json]`

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `tsx`-run standalone Node scripts (no Jest/Vitest in repo — verified package.json) |
| Config file | none — scripts in `app/scripts/*.ts`, run via `npm run test:*` |
| Quick run command | `npm run test:exercise-schemas` (Zod schema unit-ish) |
| Full suite command | `npm run test:rls && npm run test:f13-brutal && npm run check:locale-parity` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| SKIN-02 | Hard-delete preserves history; A cannot delete B's plan | RLS / cross-user | `npm run test:rls` (extend with seed_key + re-affirm plan-delete) | ✅ test-rls.ts (extend) |
| SKIN-02 | FK still `ON DELETE SET NULL` (confdeltype='n') | deploy assertion | `npx tsx --env-file=.env.local scripts/verify-deploy.ts` (add FK + column check) | ✅ verify-deploy.ts (extend) |
| SKIN-03 | `seed_key` column exists + RLS covers it | RLS / deploy | `npm run test:rls` + verify-deploy | ✅ (extend both) |
| SKIN-03 | Muscle-group map resolves sv/en → key, unknown → other | unit | new `npm run test:muscle-group` (tsx script over `resolveMuscleGroupKey`) | ❌ Wave 0 |
| SKIN-03 | exercise form schema accepts muscle-group key + seed_key shape | unit | `npm run test:exercise-schemas` (extend) | ✅ (extend) |
| I18N-05 | sv↔en key parity after new per-screen + seed keys | parity | `npm run check:locale-parity` | ✅ check-locale-parity.ts |
| SKIN-08 | F13 hot path no-regression | brutal integration | `npm run test:f13-brutal` | ✅ |
| SKIN-07 | Tab bar light + dark | manual UAT (Expo Go) | device screenshot round (light + dark) | manual-only — UI |

### Sampling Rate
- **Per task commit:** `npm run lint` + the relevant `test:*-schemas` quick script.
- **Per wave merge:** `npm run test:rls && npm run test:f13-brutal && npm run check:locale-parity`.
- **Phase gate (post-migration):** `npm run gen:types` (clean diff committed) → `verify-deploy.ts` (all assertions PASS) → full suite green → device UAT light+dark → `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `app/scripts/test-muscle-group.ts` — unit-tests `resolveMuscleGroupKey` (covers SKIN-03 D-03)
- [ ] `app/scripts/test-rls.ts` — add `exercises.seed_key` cross-user block (extend, not new file)
- [ ] `app/scripts/verify-deploy.ts` — add column-existence (`seed_key`, `plan_name_snapshot`) + FK `confdeltype='n'` assertion for `workout_sessions_plan_id_fkey`
- [ ] `app/scripts/test-exercise-schemas.ts` — extend for muscle-group-key + seed_key shape
- [ ] No framework install needed — `tsx` already present.

---

## Security Domain

`security_enforcement` is enabled (CLAUDE.md Security conventions). The per-phase `<threat_model>` STRIDE register is the planner's contract.

### Applicable ASVS / OWASP Categories

| Category | Applies | Standard Control (this phase) |
|----------|---------|-------------------------------|
| API1 / V4 — Broken object-level authz | yes | RLS on `exercises`/`workout_plans`/`workout_sessions` with `(select auth.uid())` + `with check`; new `seed_key` column covered by existing column-agnostic policy; hard-delete gated by `for all using (user_id = auth.uid())`. Cross-user `test:rls` extension is the gate. |
| API3 — Excessive data exposure | yes | `seed_key` is non-sensitive (a translation key); history `plan_name_snapshot` is the user's own plan name. No cross-user aggregation. |
| API8 / V14 — Security misconfiguration | yes | Migration-as-truth (0010 numbered SQL); gen:types co-commit; verify-deploy after push; the new RPC `get_session_summaries` stays SECURITY INVOKER + `set search_path = ''`. |
| V5 — Input validation | yes | Zod at every boundary: `exerciseFormSchema` (extend for muscle-group key + seed_key), `ExerciseRowSchema` parse on the wire (Pitfall 8.13). Muscle-group dropdown constrains to the 5 keys; legacy map is total (`?? 'other'`). |
| M2 — Insecure data storage | partial | `fm:exercises_seeded` flag is non-sensitive (a boolean marker); no PII. Sessions stored via LargeSecureStore (unchanged). |
| V6 — Cryptography | no | No crypto introduced this phase. |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User A seeds/reads/deletes B's exercise via `seed_key` row | Tampering / Info disclosure | Existing own-row RLS (column-agnostic); test:rls assertion on seed_key row |
| Hard-delete leaks/destroys another user's plan or sessions | Tampering / Denial | RLS `using (user_id = auth.uid())` on the delete; FK SET NULL only touches the *owner's* sessions; test:rls "A cannot DELETE B's workout_plan" (already present, re-affirm) |
| Seed insert bypasses RLS (null user_id) | Spoofing | Seed runs through the normal client mutation with `user_id = session.user.id`; `with check (user_id = auth.uid())` rejects spoofed user_id |
| Malformed muscle_group / seed_key from a tampered cache | Tampering | Zod parse on wire (`ExerciseRowSchema`); `resolveMuscleGroupKey` total fallback to `'other'` |
| RPC search-path injection via `get_session_summaries` re-deploy | Elevation | Keep `set search_path = ''` + fully-qualified names (verbatim from 0006) |

---

## Sources

### Primary (HIGH confidence — all in-repo, read this session)
- `app/supabase/migrations/0001_initial_schema.sql` — FK rules (SET NULL on plan_id, CASCADE on plan_exercises/exercise_sets, RESTRICT on exercise refs), exercises/plans/sessions RLS policies
- `app/supabase/migrations/0006_phase6_chart_rpcs.sql` — `get_session_summaries` LEFT JOIN plan name, SECURITY INVOKER + search_path discipline
- `app/types/database.ts` — confirmed column shapes (plan_id nullable, FK names, no seed_key/plan_name_snapshot yet)
- `app/lib/query/client.ts` — all 15 setMutationDefaults, scope.id contract, `['session','start']` + `['session','delete']` + `['plan','archive']` patterns, upsert idempotency
- `app/lib/queries/{plans,sessions,exercises,plan-exercises}.ts` — hook signatures, scope binding
- `app/app/(app)/plans/[id].tsx` — plan detail (archive overlay template, Starta pass flow, mutate-not-mutateAsync)
- `app/app/(app)/history/[sessionId].tsx` + `(tabs)/history.tsx` — history read paths, `"— ingen plan"` null fallback, inline-overlay delete-confirm
- `app/app/(app)/plans/[id]/exercise-picker.tsx` — picker filter pattern, chained create+add scope, GHRV wrapper
- `app/app/_layout.tsx` + `app/app/(app)/_layout.tsx` — bootstrap mount points (root = pre-auth; (app) = session-gated)
- `app/lib/prefs.ts` — `fm:*` AsyncStorage idiom
- `app/scripts/{test-rls,verify-deploy}.ts` — RLS test extension points, deploy-assertion patterns (no FK/column check today)
- `app/package.json` — locked deps + test scripts (gen:types, test:rls, test:f13-brutal, check:locale-parity)
- `app/locales/sv.json` — flat 1:1 key convention
- `.planning/phases/10-CONTEXT.md` + `10-UI-SPEC.md` — decisions + design contract
- `CLAUDE.md` — migration/security conventions

### Secondary / Tertiary
- None — no external research was required; the stack is locked and every mechanism question was answerable from the codebase.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — locked, unchanged, verified package.json.
- D-11 FK/snapshot mechanism: HIGH — FK behavior + history read path read directly from source.
- D-06 seed_key + RLS-no-change: HIGH — policy text read; column-agnostic confirmed.
- D-07 seed delivery wiring: HIGH — bootstrap mount points + mutation idempotency verified; multi-user-on-device flag namespacing is the one ASSUMED nuance.
- Re-skin invariants: HIGH — each invariant traced to a specific line in existing screens.
- Seed list contents (A6) + storage-shape (A2): MEDIUM — D-08 explicitly a guide; planner refines.

**Research date:** 2026-06-12
**Valid until:** 2026-07-12 (stable — all findings are repo-internal; only invalidated by intervening commits to the named files)
