# Phase 4: Plans, Exercises & Offline-Queue Plumbing — Pattern Map

**Mapped:** 2026-05-10
**Files analyzed:** 28 (new + modified + deleted)
**Analogs found:** 17 with strong matches / 8 partial-match / 3 marked `analog: NONE`

> Pattern source for `gsd-planner`. Every new file in the Phase 4 scope (RESEARCH.md §6 file outline + UI-SPEC component map + CONTEXT.md `<code_context>` integration points) is classified by role + data-flow direction and mapped to the closest existing analog in the repo. Where the analog is partial or missing, the recommended scaffold is given inline rather than a generic template.

---

## File Classification

### Infrastructure (`app/lib/query/*` — refactor of Phase 1 `app/lib/query-client.ts`)

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/lib/query/client.ts` | infra (QueryClient + setMutationDefaults registry) | UI → mutation → Supabase | `app/lib/query-client.ts` (Phase 1) | exact for QueryClient; **partial** — analog has zero `setMutationDefaults` calls (the load-bearing Phase 4 add) |
| `app/lib/query/persister.ts` | infra (AsyncStorage dehydrate/hydrate) | persister ↔ AsyncStorage | `app/lib/query-client.ts` (Phase 1, lines 25-33) | exact (move 9 lines verbatim) |
| `app/lib/query/network.ts` | infra (focusManager + onlineManager + `useOnlineStatus()` + `resumePausedMutations` subscription) | NetInfo/AppState → onlineManager/focusManager → queryClient | `app/app/_layout.tsx` (Phase 1+3, lines 36-52) | exact for `setEventListener` blocks; **partial** — the `onlineManager.subscribe(resume)` block + `useOnlineStatus()` hook are NEW (no analog in repo per RESEARCH.md §8.12) |
| `app/lib/query/keys.ts` | infra (typed query-key factory) | n/a — pure type structures | NONE | `analog: NONE` — first key factory in repo. Use RESEARCH.md §4 scaffold verbatim. |

### Schemas (`app/lib/schemas/*`)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/lib/schemas/plans.ts` | schema (Zod 4 form-input + Insert/Update parse) | form → Zod parse → mutation; Supabase resp → Zod parse → cache | `app/lib/schemas/auth.ts` (Phase 3) | role-match (Zod 4 idioms); content is fully new |
| `app/lib/schemas/exercises.ts` | schema (Zod 4) | same | `app/lib/schemas/auth.ts` | role-match |
| `app/lib/schemas/plan-exercises.ts` | schema (Zod 4 + cross-field `.refine` for `reps_min ≤ reps_max`) | same | `app/lib/schemas/auth.ts` (already uses `.refine` w/ `path:` for confirmPassword) | exact for `.refine`-with-`path:` idiom |

### Utilities (`app/lib/utils/*`)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/lib/utils/uuid.ts` | utility (`expo-crypto.randomUUID()` wrapper) | imported by every mutationFn that creates rows | NONE | `analog: NONE` — first util module in repo. Trivial 2-line file (RESEARCH.md §5 spec). |

### Resource hooks (`app/lib/queries/*`)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/lib/queries/plans.ts` | hooks (useQuery + useMutation per resource — `mutationKey` only, no `mutationFn`) | UI → useMutation → defaults registry → Supabase | NONE | `analog: NONE` — first resource-hooks file in repo. Use RESEARCH.md §4 (TanStack v5 setMutationDefaults pattern) + this doc's `Pattern Assignments` excerpts. |
| `app/lib/queries/exercises.ts` | hooks | same | NONE | `analog: NONE` |
| `app/lib/queries/plan-exercises.ts` | hooks (incl. `useReorderPlanExercises` two-phase update) | UI → drag → snapshot → N mutations w/ `scope.id` → Supabase | NONE | `analog: NONE` — see RESEARCH.md §3 "unique constraint trap" for the two-phase write algorithm |

### Components (`app/components/*`)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/components/offline-banner.tsx` | component (binary banner; ✕ close-affordance) | `useOnlineStatus()` → conditional render | `app/app/(auth)/sign-in.tsx` lines 130-157 (banner + ✕ pattern, Phase 3 quick-task commit 4af7462) | exact for the banner+✕ structure; only color tokens flip (red→yellow per UI-SPEC) |

### Tab routes (`app/app/(app)/(tabs)/*`)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/app/(app)/(tabs)/_layout.tsx` | layout (Tabs + dark-mode tints + OfflineBanner mount) | request-response (route render) | `app/app/(app)/_layout.tsx` (Phase 3) | role-match for the layout-with-`useAuthStore` pattern; Tabs config is NEW (no Tabs in repo yet — first one) |
| `app/app/(app)/(tabs)/index.tsx` | screen (Planer list + empty-state + FAB) | `usePlansQuery()` → FlatList + Pressable → `router.push` | `app/app/(app)/index.tsx` (Phase 3 placeholder — to be DELETED) | partial (screen container shell + dark-mode classes); list/FAB NEW |
| `app/app/(app)/(tabs)/history.tsx` | screen (placeholder) | static | `app/app/(app)/index.tsx` | exact for the trivial-placeholder structure |
| `app/app/(app)/(tabs)/settings.tsx` | screen (placeholder + sign-out, moved from `(app)/index.tsx`) | tap → `useAuthStore.signOut()` | `app/app/(app)/index.tsx` (Phase 3 — sign-out lives here today, lines 22-49) | exact (move sign-out logic verbatim, restructure copy + heading) |

### Plan CRUD routes (`app/app/(app)/plans/*`)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/app/(app)/plans/new.tsx` | screen (RHF + zodResolver create form) | RHF submit → `useCreatePlan().mutate({ id: randomUUID(), ... })` → optimistic insert → `router.replace` | `app/app/(auth)/sign-in.tsx` (Phase 3 — RHF + Controller + Zod + banner pattern) | exact for the form + Controller + banner shell; mutation call replaces `supabase.auth.signInWithPassword` |
| `app/app/(app)/plans/[id].tsx` | screen (read + edit meta + DraggableFlatList for plan_exercises + overflow menu archive) | `usePlanQuery` + `usePlanExercisesQuery` → DraggableFlatList → drag → reorder mutations | `app/app/(auth)/sign-up.tsx` (most complex existing form — RHF + multiple banners + multi-error mapping) | role-match for the form-with-multiple-affordances shell; DraggableFlatList + overflow menu are NEW |
| `app/app/(app)/plans/[id]/exercise-picker.tsx` | screen (modal route — search + inline create form) | `useExercisesQuery` → `.filter()` → tap → `useAddExerciseToPlan().mutate(...)` → `router.back()` | `app/app/(auth)/sign-up.tsx` (RHF inline form pattern) | role-match for the inline form; modal-route + search list are NEW |
| `app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx` | screen (modal route — target_sets/reps_min/reps_max/notes form) | RHF → `useUpdatePlanExercise().mutate(...)` → `router.back()` | `app/app/(auth)/sign-in.tsx` | role-match for the RHF form |

### Test scripts (`app/scripts/*`)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/scripts/test-plan-schemas.ts` | test (Zod parse round-trip) | n/a | `app/scripts/test-auth-schemas.ts` (Phase 3) | exact (replicate structure verbatim, swap schemas) |
| `app/scripts/test-exercise-schemas.ts` | test | n/a | `app/scripts/test-auth-schemas.ts` | exact |
| `app/scripts/test-plan-exercise-schemas.ts` | test (incl. cross-field `.refine` cases) | n/a | `app/scripts/test-auth-schemas.ts` (already covers `.refine` for confirmPassword) | exact |
| `app/scripts/test-reorder-constraint.ts` | test (DB integration — proves two-phase reorder doesn't violate `unique (plan_id, order_index)`) | tsx → admin client → seed → reorder → assert | `app/scripts/test-rls.ts` (Phase 2 — Node-only Supabase admin client + seed/cleanup harness) | exact for env-load + admin-client + seed/cleanup; assertions are reorder-specific |
| `app/scripts/test-upsert-idempotency.ts` | test (DB integration — replay safety) | tsx → admin client → upsert twice with same id → assert no duplicate, no error | `app/scripts/test-rls.ts` | exact for harness shell |
| `app/scripts/manual-test-phase-04-airplane-mode.md` | doc (human-runner checklist) | n/a | NONE | `analog: NONE` — first manual checklist file. Markdown checklist per RESEARCH.md §10 K-slice spec. |
| `app/scripts/test-rls.ts` (MODIFIED — extend) | test (extend cross-user assertions for archive flow + plan_exercises CRUD per CLAUDE.md "Cross-user verification is a gate") | n/a | self (existing structure) | exact (add new assertion blocks in the existing harness) |

### Modified / Deleted

| File | Action | Reason |
|---|---|---|
| `app/app/_layout.tsx` | MODIFIED | Remove inline `focusManager.setEventListener` + `onlineManager.setEventListener` (lines 36-52); add `import "@/lib/query/network"` for module-load side-effects. Update `import { queryClient } from "@/lib/query-client"` → `from "@/lib/query/client"`. |
| `app/lib/auth-store.ts` | MODIFIED | One-line import path change: `from "@/lib/query-client"` → `from "@/lib/query/client"` (line 26). No logic changes. |
| `app/lib/query-client.ts` | DELETED | Replaced by `app/lib/query/{client,persister,network,keys}.ts` split. |
| `app/app/(app)/index.tsx` | DELETED | Phase 3 placeholder; `(app)/(tabs)/index.tsx` becomes default route via Expo Router 6 group resolution. Sign-out logic (lines 22-49) moves to `(tabs)/settings.tsx`. |
| `app/package.json` | MODIFIED | Add `expo-crypto` (~15.0.9) via `npx expo install` and `react-native-draggable-flatlist` (^4.0.3) via `npm install`. Add npm scripts: `test:plan-schemas`, `test:exercise-schemas`, `test:plan-exercise-schemas`, `test:reorder-constraint`, `test:upsert-idempotency` (mirror Phase 3's `test:auth-schemas` script naming). |

---

## Pattern Assignments

### `app/lib/query/client.ts` (infra, refactor of Phase 1)

**Analog:** `app/lib/query-client.ts` lines 1-23 (the `QueryClient` constructor)

**Imports + QueryClient pattern** (lines 1-23, COPY VERBATIM, then add):
```typescript
// app/lib/query-client.ts (Phase 1 — being moved to app/lib/query/client.ts)
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      gcTime: 1000 * 60 * 60 * 24,  // matches persister maxAge
    },
  },
});
```

**REQUIRED ADDITION (per CONTEXT.md D-04, D-07; RESEARCH.md §4 + §8.12):**
- Set `defaultOptions.queries.networkMode: 'offlineFirst'` AND `defaultOptions.mutations.networkMode: 'offlineFirst'` AND `defaultOptions.mutations.retry: 1` (RESEARCH.md "What the planner must NOT do" item 5).
- Register all 8 `setMutationDefaults` blocks at module top-level (after `queryClient` is constructed, before any export). Mutation keys: `['plan','create']`, `['plan','update']`, `['plan','archive']`, `['exercise','create']`, `['plan-exercise','add']`, `['plan-exercise','update']`, `['plan-exercise','remove']`, `['plan-exercise','reorder']`. Each default specifies `mutationFn`, `onMutate`, `onError`, `onSettled`, `retry: 1`, and (for create + child) `scope: { id: vars => 'plan:<planId>' }` per RESEARCH.md §5.

**Mutation default shape (TanStack v5 + Supabase upsert) — RESEARCH.md §4 + §5:**
```typescript
queryClient.setMutationDefaults(['plan', 'create'], {
  mutationFn: async (vars: PlanInsert) => {
    const { data, error } = await supabase
      .from('workout_plans')
      .upsert(vars, { onConflict: 'id', ignoreDuplicates: true })  // §5 replay safety
      .select()
      .single();
    if (error) throw error;
    return PlanRowSchema.parse(data);  // §8.13 — Zod parse, NOT cast
  },
  onMutate: async (vars, context) => {
    await context.client.cancelQueries({ queryKey: plansKeys.list() });
    const previous = context.client.getQueryData(plansKeys.list());
    context.client.setQueryData(plansKeys.list(), (old: Plan[] = []) => [...old, vars]);
    return { previous };
  },
  onError: (_err, _vars, ctx, context) => {
    if (ctx?.previous) context.client.setQueryData(plansKeys.list(), ctx.previous);
  },
  onSettled: (_d, _e, _v, _c, context) => {
    void context.client.invalidateQueries({ queryKey: plansKeys.list() });
  },
  retry: 1,
  scope: { id: (vars: PlanInsert) => `plan:${vars.id}` },  // serial replay (§5)
});
```

**DO NOT regress:**
- Phase 1 has NO `setMutationDefaults` (verified). The new file MUST add all 8 BEFORE the persister hydrates (Pitfall 8.2) — guaranteed by import order in `_layout.tsx`.
- Phase 1 has NO `networkMode: 'offlineFirst'` setting (verified). Must add both query+mutation defaults.

---

### `app/lib/query/persister.ts` (infra)

**Analog:** `app/lib/query-client.ts` lines 25-33 (move verbatim)

**Pattern (COPY VERBATIM):**
```typescript
// Move from app/lib/query-client.ts lines 25-33:
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { queryClient } from "./client";  // <-- import order: client.ts MUST execute first

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
});

persistQueryClient({
  queryClient,
  persister: asyncStoragePersister,
  maxAge: 1000 * 60 * 60 * 24, // 24h per Phase 1 D-08
});
```

**No changes:** Phase 1 D-08 settings (24h `maxAge`, default 1000ms throttle) carry over verbatim per CONTEXT.md inheritance. AsyncStorage-flush-on-background hook is Phase 5 (D-02).

---

### `app/lib/query/network.ts` (infra — NEW behavior)

**Analog:** `app/app/_layout.tsx` lines 36-52 (move verbatim) + RESEARCH.md §6 scaffold for the new pieces

**Move verbatim** (from `app/app/_layout.tsx` lines 36-52):
```typescript
focusManager.setEventListener((setFocused) => {
  const sub = AppState.addEventListener("change", (s) => {
    if (Platform.OS !== "web") setFocused(s === "active");
  });
  return () => sub.remove();
});

onlineManager.setEventListener((setOnline) => {
  const unsubscribe = NetInfo.addEventListener((state) => {
    // Phase 1 invariant: state.isConnected can be null on cold-start; treat as online.
    setOnline(state.isConnected !== false);
  });
  return unsubscribe;
});
```

**ADD (NEW — RESEARCH.md §6 + §8.12):**
```typescript
import { useSyncExternalStore } from "react";
import { queryClient } from "./client";  // import order: client.ts must run first

// Resume paused mutations on every offline→online transition.
// Phase 1 had NO such call (verified — Pitfall 8.12). Without this, queued
// mutations from the SAME app session don't replay when network returns.
let wasOnline = onlineManager.isOnline();
onlineManager.subscribe((online) => {
  if (online && !wasOnline) {
    void queryClient.resumePausedMutations();
  }
  wasOnline = online;
});

// useOnlineStatus() — consumed by OfflineBanner. Per RESEARCH.md "Claude's
// Discretion: useOnlineStatus() placement" + §6, lives here (not in lib/hooks/).
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
    () => true,  // SSR fallback (unused on RN)
  );
}
```

**DO NOT regress:**
- Preserve `state.isConnected !== false` (NetInfo `null`-handling) per Phase 1 invariant (Pitfall 8.8 — verified at `app/app/_layout.tsx:49`).
- The `wasOnline` guard prevents `resumePausedMutations()` from firing on every NetInfo event (e.g., wifi→cellular transition while still online).

---

### `app/lib/query/keys.ts` (infra) — `analog: NONE`

**Recommended scaffold** (RESEARCH.md §4 — copy verbatim):
```typescript
export const plansKeys = {
  all: ['plans'] as const,
  list: () => [...plansKeys.all, 'list'] as const,
  detail: (id: string) => [...plansKeys.all, 'detail', id] as const,
};

export const exercisesKeys = {
  all: ['exercises'] as const,
  list: () => [...exercisesKeys.all, 'list'] as const,
};

export const planExercisesKeys = {
  all: ['plan-exercises'] as const,
  list: (planId: string) => [...planExercisesKeys.all, 'list', planId] as const,
};
```

Hierarchical keys allow `invalidateQueries({ queryKey: plansKeys.all })` to invalidate every plan-related query at once (used in `onSettled` after archive).

---

### `app/lib/utils/uuid.ts` (utility) — `analog: NONE`

**Recommended scaffold** (CONTEXT.md D-06 + RESEARCH.md §5):
```typescript
// Thin wrapper for one-line swap if expo-crypto changes API in SDK 55+.
import * as Crypto from 'expo-crypto';
export const randomUUID = (): string => Crypto.randomUUID();
```

**Install (per RESEARCH.md §1, NOT `npm install`):**
```bash
# From app/ cwd
npx expo install expo-crypto
```

This pins SDK 54's `~15.0.9`; `npm install` would resolve to SDK 55's `55.0.14` and break Expo Go.

---

### `app/lib/schemas/plans.ts` (schema)

**Analog:** `app/lib/schemas/auth.ts` (Phase 3, lines 1-37)

**Imports + Zod 4 idiom pattern** (lines 15-37):
```typescript
// Phase 3 idioms verified:
//   - z.email() top-level (z.string().email() is deprecated in v4)
//   - `error:` parameter on issue locales (`message:` is deprecated)
//   - `.refine` with `path: ['confirmPassword']` for cross-field validation
import { z } from "zod";

export const signUpSchema = z
  .object({
    email: z.email({ error: "Email måste vara giltigt" }),
    password: z.string().min(12, { error: "Minst 12 tecken" }),
    confirmPassword: z.string().min(1, { error: "Bekräfta ditt lösenord" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Lösenord matchar inte",
    path: ["confirmPassword"],
  });

export type SignUpInput = z.infer<typeof signUpSchema>;
```

**Apply to plans.ts** (per CONTEXT.md scope + UI-SPEC error copy):
- `name`: `z.string().min(1, { error: "Namn krävs" }).max(80, { error: "Max 80 tecken" })`
- `description`: `z.string().max(500, { error: "Max 500 tecken" }).optional().nullable()`
- Optional `archived_at`: `z.string().datetime().nullable().optional()` (timestamp)
- Export both a **form-input shape** (`PlanFormInput`) and **DB Insert/Row shapes** that mirror `Tables<'workout_plans'>` from `app/types/database.ts`.
- Use Zod 4 `.parse()` at every Supabase response boundary per Pitfall 8.13 — NEVER cast.

---

### `app/lib/schemas/exercises.ts` (schema)

**Analog:** `app/lib/schemas/auth.ts` (same Zod 4 idiom block above)

**Apply (per CONTEXT.md + UI-SPEC):**
- `name`: `z.string().min(1).max(80)`
- `muscle_group`: `z.string().max(40).optional().nullable()`
- `equipment`: `z.string().max(40).optional().nullable()`
- `notes`: `z.string().max(500).optional().nullable()`
- Error copy verbatim from UI-SPEC "Inline error states" table.

---

### `app/lib/schemas/plan-exercises.ts` (schema)

**Analog:** `app/lib/schemas/auth.ts` lines 17-26 (the `.refine` cross-field pattern)

**Pattern to copy** (lines 17-26 — exact):
```typescript
export const signUpSchema = z
  .object({ ... })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Lösenord matchar inte",
    path: ["confirmPassword"],  // <-- attaches error to specific field
  });
```

**Apply to plan-exercises.ts** (CONTEXT.md scope + UI-SPEC error copy):
- `target_sets`: `z.coerce.number().int().min(0, { error: "Måste vara 0 eller högre" }).optional().nullable()`
- `target_reps_min` / `target_reps_max`: same
- `notes`: `z.string().max(500).optional().nullable()`
- `order_index`: `z.number().int().min(0)` (NOTE: V1 dense ints — but the two-phase reorder algorithm temporarily uses negative indexes per RESEARCH.md §3 / A1; if you constrain `>= 0` here it'll break that path. Recommendation: leave as `z.number().int()` only at this layer; the UI form layer can apply `min(0)`.)
- Cross-field: `.refine(d => !d.target_reps_min || !d.target_reps_max || d.target_reps_min <= d.target_reps_max, { error: "Min får inte vara större än max", path: ['target_reps_min'] })`

---

### `app/lib/queries/plans.ts` (resource hooks) — `analog: NONE`

**Recommended scaffold** (CONTEXT.md scope + RESEARCH.md §4):

Each `useMutation` call site MUST specify ONLY `mutationKey` (no `mutationFn`) — defaults own the function (Pitfall 8.1):
```typescript
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { plansKeys } from '@/lib/query/keys';
import { PlanRowSchema } from '@/lib/schemas/plans';

export function usePlansQuery() {
  return useQuery({
    queryKey: plansKeys.list(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_plans')
        .select('*')
        .is('archived_at', null)             // CONTEXT.md D-12 — list filter
        .order('created_at', { ascending: false });  // UI-SPEC plan-list ordering
      if (error) throw error;
      return data.map(r => PlanRowSchema.parse(r));  // Pitfall 8.13
    },
  });
}

export function useCreatePlan() {
  return useMutation({
    mutationKey: ['plan', 'create'] as const,  // <-- ONLY this; mutationFn lives in setMutationDefaults
  });
}
```

Hooks to export: `usePlansQuery`, `usePlanQuery(id)`, `useCreatePlan`, `useUpdatePlan`, `useArchivePlan`. All mutation hooks return only `useMutation({ mutationKey })`.

---

### `app/lib/queries/exercises.ts` (resource hooks) — `analog: NONE`

Same pattern as plans.ts. Hooks: `useExercisesQuery`, `useCreateExercise`. List query filter: `user_id = (select auth.uid())` is enforced by RLS (verified in `0001_initial_schema.sql:117`); the client just calls `supabase.from('exercises').select('*')` — RLS scopes it.

**Scope override for picker-chained create** (RESEARCH.md §5): when `useCreateExercise` is fired from the exercise-picker (followed immediately by `useAddExerciseToPlan`), the call site must pass `meta: { scopeOverride: 'plan:<planId>' }` — the `setMutationDefaults` for `['exercise','create']` reads `meta.scopeOverride` to pick the scope, defaulting to `'exercise:create'` when absent. This ensures the chained add-to-plan mutation runs after the create-exercise mutation in the same scope.

---

### `app/lib/queries/plan-exercises.ts` (resource hooks) — `analog: NONE`

Hooks: `usePlanExercisesQuery(planId)`, `useAddExerciseToPlan`, `useUpdatePlanExercise`, `useRemovePlanExercise`, `useReorderPlanExercises`.

**`useReorderPlanExercises` two-phase update** (RESEARCH.md §3 — load-bearing):

The `unique (plan_id, order_index)` constraint at `0001_initial_schema.sql:59` forces this:
```typescript
function handleDragEnd(newOrder: PlanExercise[]) {
  // 1. Snapshot once.
  const previous = queryClient.getQueryData(planExercisesKeys.list(planId));
  // 2. Apply new order to cache immediately (one cache write).
  queryClient.setQueryData(planExercisesKeys.list(planId), newOrder);

  const changed = diff(previous, newOrder);
  // 3. Phase 1 of two-phase write: move all changed rows to negative indexes.
  for (const row of changed) {
    updatePlanExerciseMutation.mutate({ id: row.id, order_index: -(row.idx + 1) });
  }
  // 4. Phase 2: write final positions (TanStack scope.id='plan:<id>' guarantees serial replay).
  for (const row of changed) {
    updatePlanExerciseMutation.mutate({ id: row.id, order_index: row.newIndex });
  }
}
```

All mutations carry `scope: { id: \`plan:\${planId}\` }` per CONTEXT.md D-09. **Plan 02 must verify A1** (Postgres `int` allows negative values — no `CHECK >= 0` exists per `0001_initial_schema.sql:54`) with a 30s SQL smoke test before scaling.

---

### `app/components/offline-banner.tsx` (component)

**Analog:** `app/app/(auth)/sign-in.tsx` lines 130-157 (banner+✕ pattern, Phase 3 quick-task commit 4af7462)

**Pattern to copy** (lines 130-157 — verbatim structure, swap red→yellow per UI-SPEC):
```typescript
{bannerError && (
  <Pressable
    onPress={() => setBannerError(null)}
    accessibilityRole="button"
    accessibilityLabel={bannerError}
    accessibilityHint="Tryck för att stänga"
  >
    <View className="flex-row items-start justify-between gap-2">
      <Text
        className="flex-1 text-base text-red-600 dark:text-red-400"
        accessibilityLiveRegion="polite"
      >
        {bannerError}
      </Text>
      <Pressable
        onPress={() => setBannerError(null)}
        accessibilityRole="button"
        accessibilityLabel="Stäng"
        className="px-2 py-1"
        hitSlop={8}
      >
        <Text className="text-base font-semibold text-red-600 dark:text-red-400">
          ✕
        </Text>
      </Pressable>
    </View>
  </Pressable>
)}
```

**Adapt for OfflineBanner (per UI-SPEC §Visuals + CONTEXT.md D-05):**
- Color tokens: `text-red-600 dark:text-red-400` → `text-yellow-900 dark:text-yellow-100`; add `bg-yellow-100 dark:bg-yellow-900` to outer wrapper.
- Outer wrapper: add `bg-yellow-*` + `px-4 py-3 mx-4 mt-2 rounded-lg` per UI-SPEC.
- Replace `accessibilityRole="button"` on outer Pressable with `accessibilityRole="alert"` on a `<View>` (banner is informational, not actionable; only ✕ is a button).
- Visibility logic per UI-SPEC: `useOnlineStatus()` returns `false` AND local `dismissed` state is `false`. `useEffect` cleanup resets `dismissed` when `useOnlineStatus()` flips back to `true` so the next offline event re-shows the banner.
- Mount in `(tabs)/_layout.tsx`, ABOVE `<Tabs>`, INSIDE `SafeAreaView edges={['top']}` (RESEARCH.md §6 + UI-SPEC §Visuals).
- Copy: `Du är offline — ändringar synkar när nätet är tillbaka.` (CONTEXT.md D-05 verbatim).

---

### `app/app/(app)/(tabs)/_layout.tsx` (layout)

**Analog:** `app/app/(app)/_layout.tsx` (Phase 3) for the `useAuthStore` selector + Stack pattern; UI-SPEC §"Tab-bar" for the Tabs config.

**Pattern from analog** (lines 17-26):
```typescript
import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "@/lib/auth-store";

export default function AppLayout() {
  const session = useAuthStore((s) => s.session);
  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

**Apply (per UI-SPEC §Visuals + RESEARCH.md §6):**
- Wrap in `<SafeAreaView edges={['top']} className="flex-1">` from `react-native-safe-area-context` (already installed `~5.6.0`).
- Mount `<OfflineBanner />` ABOVE `<Tabs>`.
- `<Tabs screenOptions={{ ... }}>` with `useColorScheme()` bound dark-mode tints per UI-SPEC §Color: `tabBarStyle.backgroundColor` (`#1F2937` dark / `#F3F4F6` light), `tabBarActiveTintColor` (`#60A5FA` dark / `#2563EB` light), `tabBarInactiveTintColor` (`#9CA3AF` dark / `#6B7280` light), `headerShown: false`.
- Per-tab `<Tabs.Screen options={{ tabBarIcon: ({ focused, color }) => <Ionicons name={focused ? 'barbell' : 'barbell-outline'} size={24} color={color} /> }} />` — Ionicons table per UI-SPEC §Copywriting Contract.
- DO NOT include the `if (!session) <Redirect>` block here — `(app)/_layout.tsx` already guards (defense-in-depth). The (tabs) group is rendered INSIDE `(app)`, so the parent guard already fired.

---

### `app/app/(app)/(tabs)/index.tsx` (screen — Planer list)

**Analog:** `app/app/(app)/index.tsx` lines 18-49 (Phase 3 placeholder — being replaced; reuse the screen-container shell only)

**Screen container shell to copy** (lines 26-48):
```typescript
import { Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AppHome() {
  // ...
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-1 items-center justify-center gap-6 px-4">
        {/* content */}
      </View>
    </SafeAreaView>
  );
}
```

**Apply (per UI-SPEC §"Screen container" tab-screens variant + §Copywriting Contract Planer-tab):**
- Heading: `<Text className="text-3xl font-semibold text-gray-900 dark:text-gray-50">Mina planer</Text>` (when ≥1 plan exists).
- `usePlansQuery()` from `@/lib/queries/plans`.
- `<FlatList>` with `contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 }}` (bottom pad clears FAB).
- `ItemSeparatorComponent={() => <View className="h-2" />}`.
- Plan-row per UI-SPEC §Visuals "Plan-list row" — `Pressable` with `flex-row items-center justify-between rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-4 mb-2 active:opacity-80`, accessibilityLabel `Öppna plan ${plan.name}`. Tap → `router.push(\`/plans/\${plan.id}\`)`.
- `ListEmptyComponent`: per UI-SPEC §"Empty states" (Ionicons `barbell-outline` accent-tinted size 64, "Inga planer än", "Skapa din första plan.", primary CTA `Skapa plan` → `router.push('/plans/new')`).
- Floating `Skapa ny plan` button (UI-SPEC §Visuals "Floating add button"): `absolute bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 dark:bg-blue-500 ...`, `accessibilityLabel="Skapa ny plan"`.

---

### `app/app/(app)/(tabs)/history.tsx` (screen — placeholder)

**Analog:** `app/app/(app)/index.tsx` lines 26-48 (the screen-container shell)

**Pattern (reduce to placeholder):**
```typescript
return (
  <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
    <View className="flex-1 items-center justify-center gap-6 px-4">
      <Text className="text-3xl font-semibold text-gray-900 dark:text-gray-50">Historik</Text>
      <Text className="text-base text-gray-500 dark:text-gray-400">
        Historik kommer i Phase 6.
      </Text>
    </View>
  </SafeAreaView>
);
```

---

### `app/app/(app)/(tabs)/settings.tsx` (screen — sign-out + placeholder)

**Analog:** `app/app/(app)/index.tsx` lines 18-49 (sign-out logic VERBATIM — this file is being deleted and the sign-out logic moves here per CONTEXT.md D-16)

**Pattern to copy** (lines 18-49 — keep selectors + sign-out tap handler exactly):
```typescript
import { Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@/lib/auth-store";

export default function AppHome() {
  const email = useAuthStore((s) => s.session?.user.email);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-1 items-center justify-center gap-6 px-4">
        {/* heading + email + sign-out button */}
        <Pressable
          onPress={signOut}
          accessibilityRole="button"
          accessibilityLabel="Logga ut"
          className="w-full rounded-lg bg-blue-600 dark:bg-blue-500 py-4 items-center justify-center active:opacity-80"
        >
          <Text className="text-base font-semibold text-white">Logga ut</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
```

**Apply (per UI-SPEC + CONTEXT.md D-15/D-16):**
- Heading: `Inställningar` (`text-3xl font-semibold ...`)
- Body placeholder: `Mer kommer i Phase 7.` (`text-base text-gray-500 dark:text-gray-400`)
- Sign-out button: copy verbatim (label `Logga ut`, accessibilityLabel `Logga ut`, no confirm dialog — per UI-SPEC "No destructive confirmation for: Sign-out").

---

### `app/app/(app)/plans/new.tsx` (screen — create plan form)

**Analog:** `app/app/(auth)/sign-in.tsx` (Phase 3 — the most polished short RHF form in repo)

**Imports + RHF setup pattern** (lines 20-53):
```typescript
import { useState } from "react";
import {
  Text, TextInput, View, Pressable, ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInSchema, type SignInInput } from "@/lib/schemas/auth";

export default function SignInScreen() {
  const router = useRouter();
  const [bannerError, setBannerError] = useState<string | null>(null);
  const {
    control, handleSubmit, setError,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    mode: "onSubmit",  // per Phase 3 D-15 amendment + UI-SPEC plan-edit decision
    defaultValues: { email: "", password: "" },
  });
```

**Screen container + form layout pattern** (lines 107-235):
```typescript
return (
  <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingVertical: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-6">
          {/* Heading block */}
          {/* Banner error block */}
          {/* Field block (gap-4) — Controller-wrapped TextInputs */}
          {/* Primary CTA */}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>
);
```

**Controller + TextInput pattern** (lines 162-197 — exact class strings; copy verbatim, swap props):
```typescript
<Controller
  control={control}
  name="email"
  render={({ field: { onChange, onBlur, value } }) => (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Email
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        onBlur={onBlur}
        placeholder="du@example.com"
        placeholderTextColor="#9CA3AF"  /* Pitfall 7 — not via NativeWind */
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        accessibilityLabel="Email"
        className={`w-full rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-3 text-base text-gray-900 dark:text-gray-50 border ${
          errors.email
            ? "border-red-600 dark:border-red-400"
            : "border-gray-300 dark:border-gray-700"
        } focus:border-blue-600 dark:focus:border-blue-500`}
      />
      {errors.email && (
        <Text
          className="text-base text-red-600 dark:text-red-400"
          accessibilityLiveRegion="polite"
        >
          {errors.email.message}
        </Text>
      )}
    </View>
  )}
/>
```

**Primary CTA pattern** (lines 238-248 — verbatim):
```typescript
<Pressable
  onPress={handleSubmit(onSubmit)}
  disabled={isSubmitting}
  accessibilityRole="button"
  accessibilityLabel={isSubmitting ? "Loggar in" : "Logga in"}
  className="w-full rounded-lg bg-blue-600 dark:bg-blue-500 py-4 items-center justify-center disabled:opacity-60 active:opacity-80"
>
  <Text className="text-base font-semibold text-white">
    {isSubmitting ? "Loggar in…" : "Logga in"}
  </Text>
</Pressable>
```

**Apply for plans/new.tsx (per UI-SPEC):**
- Heading: `Ny plan`. Header back-arrow via `<Stack.Screen options={{ headerShown: true, title: 'Ny plan' }} />` (CLAUDE.md per-screen header opt-in).
- Fields: `name` (placeholder `t.ex. Push, Pull, Ben`, `autoCapitalize="sentences"`, `autoComplete="off"`, `textContentType="none"`); `description` (placeholder `(valfritt)`, `multiline`, `numberOfLines={3}`, `textAlignVertical="top"`, `style={{ minHeight: 80 }}`). Helper text per UI-SPEC.
- CTA: `Skapa plan` / `Skapar plan…`.
- onSubmit: `useCreatePlan().mutate({ id: randomUUID(), name, description, user_id: session.user.id }, { onSuccess: () => router.replace(\`/plans/\${id}\`) })`. (RLS rejects if `user_id` is wrong — see Pitfall §5.)
- Error mapping: catch Supabase errors via `useMutation`'s `onError`; surface generic `Något gick fel. Försök igen.` banner copy (UI-SPEC error states).

---

### `app/app/(app)/plans/[id].tsx` (screen — plan detail/edit + DraggableFlatList)

**Analog:** `app/app/(auth)/sign-up.tsx` for the multi-banner + multi-error RHF shell. NO existing analog for DraggableFlatList — see RESEARCH.md §3 and UI-SPEC §"Screen container" plan-detail variant.

**RHF + multi-banner pattern from analog** (sign-up.tsx lines 30-105):
- Same `useForm` setup with `mode: "onSubmit"`, `zodResolver(plansSchema)`, `defaultValues: { name: plan.name, description: plan.description ?? "" }`.
- Same banner+✕ pattern (sign-up.tsx lines 162-189).

**DraggableFlatList layout pattern** (NEW — RESEARCH.md §3 + UI-SPEC §"Screen container" plan-detail variant):
```typescript
import DraggableFlatList from 'react-native-draggable-flatlist';

return (
  <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
    <Stack.Screen options={{
      headerShown: true,
      title: planNameTruncated,  // 24 chars
      headerRight: () => <OverflowMenuButton />,
      headerStyle: { backgroundColor: useColorScheme() === 'dark' ? '#111827' : '#FFFFFF' },
      headerTintColor: useColorScheme() === 'dark' ? '#F9FAFB' : '#111827',
    }} />
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <DraggableFlatList
        data={planExercises}
        keyExtractor={(item) => item.id}
        onDragEnd={handleReorder}  // see useReorderPlanExercises pattern above
        renderItem={({ item, drag }) => <PlanExerciseRow item={item} drag={drag} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 96 }}
        ListHeaderComponent={
          <View>
            {/* Plan-meta form: name + description fields + Spara button when dirty */}
            {/* Section header: "Övningar" + "Lägg till övning" CTA */}
          </View>
        }
        ListEmptyComponent={EmptyExercisesState}
      />
    </KeyboardAvoidingView>
  </SafeAreaView>
);
```

**Plan-exercise row pattern** (NEW — UI-SPEC §Visuals "Plan_exercise row"):
```typescript
function PlanExerciseRow({ item, drag }: { item: PlanExercise; drag: () => void }) {
  return (
    <View className="flex-row items-center bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-4 mb-2">
      <Pressable
        onLongPress={drag}
        className="p-3 active:opacity-80"
        accessibilityLabel="Drag för att ändra ordning"
      >
        <Ionicons name="reorder-three-outline" size={24} color={mutedTextColor} />
      </Pressable>
      <View className="flex-1 mx-2">
        <Text className="text-base font-semibold text-gray-900 dark:text-gray-50" numberOfLines={1}>
          {exercise.name}
        </Text>
        {hasTargets && (
          <Text className="text-sm text-gray-500 dark:text-gray-400" numberOfLines={1}>
            {targetChip}  {/* "3×8–12" */}
          </Text>
        )}
      </View>
      {/* edit chevron + remove ✕ */}
    </View>
  );
}
```

**DO NOT regress (RESEARCH.md §8.5):** Do NOT wrap `<DraggableFlatList>` in a `<ScrollView>` or another `<FlatList>` — drag gestures bubble. Use `ListHeaderComponent` for everything that would have been "above" the list.

**Archive overflow menu** (UI-SPEC §"Destructive confirmation"):
```typescript
import { Alert } from 'react-native';

function onArchivePress() {
  Alert.alert(
    `Arkivera "${plan.name}"?`,
    'Planen tas bort från listan. Pass som använt planen behåller sin historik.',
    [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Arkivera', style: 'destructive', onPress: () => archivePlan.mutate({ id: plan.id }) },
    ],
  );
}
```

---

### `app/app/(app)/plans/[id]/exercise-picker.tsx` (modal route)

**Analog:** `app/app/(auth)/sign-up.tsx` for the inline-form-toggle pattern (the `infoBanner` toggle state at line 50 + the show/hide branch at lines 192+).

**Pattern (modal-route + inline form expansion):**
```typescript
// app/app/(app)/plans/[id]/exercise-picker.tsx
export default function ExercisePicker() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { data: exercises } = useExercisesQuery();

  // Client-side filter per UI-SPEC search decision
  const filtered = exercises?.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase())) ?? [];

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <Stack.Screen options={{ presentation: 'modal', title: 'Lägg till övning' }} />
      {/* "+ Skapa ny övning" toggle button */}
      {/* Search input */}
      {/* If showCreateForm: inline create form (RHF + zodResolver(exercisesSchema)) */}
      {/* Else: FlatList of filtered exercises with tap → useAddExerciseToPlan */}
    </SafeAreaView>
  );
}
```

**Chained mutation flow** (UI-SPEC §"Interaction Contracts" — inline create-form `Skapa & lägg till`):
```typescript
async function onCreateAndAdd(formInput: ExerciseFormInput) {
  const exerciseId = randomUUID();
  // BOTH mutations carry scope.id='plan:<planId>' so the create-exercise replays
  // before the add-to-plan (RESEARCH.md §5).
  createExerciseMutation.mutate(
    { id: exerciseId, ...formInput, user_id: session.user.id },
    { meta: { scopeOverride: `plan:${planId}` } },  // see exercises.ts hook spec
  );
  addExerciseToPlanMutation.mutate({
    id: randomUUID(), plan_id: planId, exercise_id: exerciseId, order_index: maxIndex + 1,
  });
  router.back();
}
```

---

### `app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx` (modal route)

**Analog:** `app/app/(auth)/sign-in.tsx` (the simpler RHF form analog).

**Apply:** RHF form with target_sets / target_reps_min / target_reps_max / notes fields per UI-SPEC §Copywriting Contract. Numeric fields use `keyboardType="number-pad"`, `inputMode="numeric"`, `z.coerce.number().int()` in the schema. Modal route: `<Stack.Screen options={{ presentation: 'modal', title: 'Redigera mål' }} />`. CTA: `Spara` / `Sparar…`. onSubmit: `useUpdatePlanExercise().mutate(...)` → `router.back()`.

---

### `app/scripts/test-plan-schemas.ts`, `test-exercise-schemas.ts`, `test-plan-exercise-schemas.ts`

**Analog:** `app/scripts/test-auth-schemas.ts` (Phase 3 — exact structure)

**Pattern to copy (lines 1-130, verbatim shell):**
```typescript
// app/scripts/test-auth-schemas.ts (Phase 3)
import { signUpSchema, signInSchema } from "../lib/schemas/auth";

type Case = {
  name: string;
  schema: typeof signUpSchema | typeof signInSchema;
  input: unknown;
  expectSuccess: boolean;
  expectErrorIncludes?: string;
  expectErrorPath?: string[];
};

const cases: Case[] = [
  // happy path + N rejection cases per Zod constraint
];

let failed = 0;
for (const c of cases) {
  const result = c.schema.safeParse(c.input);
  // ... pass/fail messaging ...
}
if (failed > 0) {
  console.error(`\n${failed} of ${cases.length} cases FAILED`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} schema cases passed.`);
process.exit(0);
```

**Apply per phase:**
- `test-plan-schemas.ts`: cases for `name` (min 1, max 80), `description` (max 500), happy path.
- `test-exercise-schemas.ts`: cases for `name` (min 1, max 80), `muscle_group/equipment` (max 40), `notes` (max 500).
- `test-plan-exercise-schemas.ts`: cases for `target_sets/reps_min/reps_max` (int, ≥0), `notes` (max 500), and the cross-field `.refine` (`target_reps_min > target_reps_max` → error path `['target_reps_min']`).
- Add `npm run test:plan-schemas`, `test:exercise-schemas`, `test:plan-exercise-schemas` scripts to `app/package.json` mirroring line 14: `"tsx scripts/test-*.ts"` (no `--env-file` needed; pure schema parse).

---

### `app/scripts/test-reorder-constraint.ts`, `test-upsert-idempotency.ts`

**Analog:** `app/scripts/test-rls.ts` (Phase 2 — Node-only Supabase admin client + seed/cleanup harness)

**Header + env-load + admin-client pattern** (test-rls.ts lines 1-72, copy structurally):
```typescript
// File: app/scripts/test-rls.ts
//
// Cross-user RLS verification harness for Phase 2.
// ...
// Run via: cd app && npm run test:rls
//   (which expands to: tsx --env-file=.env.local scripts/test-rls.ts)
//
// This script is Node-only. It MUST NEVER be imported from app/lib/, app/app/,
// or any other Metro-bundled path (PITFALLS 2.3 — service-role-key isolation).

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  throw new Error("Missing env. Behöver EXPO_PUBLIC_SUPABASE_URL, ...");
}

const admin: SupabaseClient<Database> = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
```

**Assertion harness pattern** (lines 77-118 — copy `pass()`, `fail()`, `assertEmpty()`, `assertWriteBlocked()` helpers verbatim).

**Cleanup pattern** (lines 134-166 — `purgeUserData()` + `cleanupTestUsers()` — copy verbatim; needed for both new scripts since they create test data).

**Apply to test-reorder-constraint.ts:** Seed 1 user + 1 plan + 5 plan_exercises via admin client, then call the two-phase reorder algorithm directly against Postgres (via the typed admin client), assert (a) no `23505 unique_violation` raised, (b) final `order_index` values match expected new order.

**Apply to test-upsert-idempotency.ts:** Seed 1 user, then `.upsert({ id: 'fixed-uuid', name: 'X' }, { onConflict: 'id', ignoreDuplicates: true })` twice in a row from clientA, assert (a) both calls succeed (no error), (b) `select count(*)` returns 1, (c) row content matches the FIRST call (not overwritten).

**`npm run` script pattern** (package.json line 13 — exact form):
```json
"test:reorder-constraint": "tsx --env-file=.env.local scripts/test-reorder-constraint.ts",
"test:upsert-idempotency": "tsx --env-file=.env.local scripts/test-upsert-idempotency.ts",
```

---

### `app/scripts/manual-test-phase-04-airplane-mode.md` — `analog: NONE`

**Recommended scaffold** (RESEARCH.md §10 K-slice + CLAUDE.md "Cross-user verification is a gate" mindset):

A markdown checklist with sections:
1. **Pre-test setup** (Expo Go on iPhone, fresh sign-in, plans-list cleared)
2. **Airplane mode → create plan + 3 exercises + drag-reorder** (numbered tap steps)
3. **Force-quit Expo Go** (verify cache hydration on relaunch — all rows visible offline)
4. **Reconnect** (`onlineManager.subscribe` triggers `resumePausedMutations()`)
5. **Verify Supabase Studio Tables view** (workout_plans / exercises / plan_exercises rows landed; no dubbletter; no FK errors; `order_index` matches the dragged order)
6. **Captive-portal scenario** (RESEARCH.md A3 mitigation — enable wifi without internet, verify queue stays parked instead of failing)

PASS gate per RESEARCH.md success #4.

---

### `app/scripts/test-rls.ts` (MODIFIED — extend for Phase 4 cross-user gate)

**Analog:** self (existing harness)

**Existing pattern to extend** (lines 134-166 + 200-260):
- `purgeUserData()` already cascades through workout_plans → plan_exercises (verified).
- Pattern for "clientA tries cross-user write" assertions exists at lines 245+.

**Apply (per CLAUDE.md "Cross-user verification is a gate"):**
- Add cross-user CRUD assertions for the ARCHIVE flow on `workout_plans` (clientA UPDATEs `archived_at` on userB's plan → expect `assertWriteBlocked`).
- Add cross-user assertions for the full `plan_exercises` CRUD via clientA against userB's plan (insert/update/remove — all expected to be RLS-blocked).
- The existing `Users can manage own plan exercises` policy at `0001_initial_schema.sql:131-134` already covers these — the test gate just verifies it's NOT regressed.

---

### `app/app/_layout.tsx` (MODIFIED)

**Current state** (lines 1-104, verified): inline `focusManager.setEventListener` (lines 36-41) + inline `onlineManager.setEventListener` (lines 43-52) + `import { queryClient } from "@/lib/query-client"` (line 15).

**Apply changes:**
1. Remove lines 4 (`AppState, Platform`), 11-13 (`focusManager, onlineManager`, `NetInfo`), 36-52 (the two `setEventListener` blocks).
2. Replace line 15 import:
   ```typescript
   // Phase 4 import order is LOAD-BEARING (RESEARCH.md §"Module-load order").
   // client.ts MUST execute first (registers setMutationDefaults), then persister
   // (hydrates from AsyncStorage), then network (wires NetInfo + AppState +
   // resumePausedMutations subscription).
   import { queryClient } from "@/lib/query/client";
   import "@/lib/query/persister";  // side-effect: persistQueryClient()
   import "@/lib/query/network";    // side-effect: focusManager + onlineManager + resume subscription
   ```
3. KEEP all SplashScreen / SplashScreenController / RootNavigator / Stack.Protected code verbatim. Phase 3 owns this surface and CONTEXT.md does not touch it.

---

### `app/lib/auth-store.ts` (MODIFIED — single-line)

**Pattern (line 26 — only this changes):**
```typescript
// Before
import { queryClient } from "@/lib/query-client";

// After
import { queryClient } from "@/lib/query/client";
```

All other logic preserved verbatim (CONTEXT.md "Modified: `app/lib/auth-store.ts` — bara import-path-uppdatering").

---

## Shared Patterns

### Authentication / RLS

**Source:** RLS policies in `app/supabase/migrations/0001_initial_schema.sql` (no client-side code — RLS is enforced server-side by Supabase).

**Apply to:** every `lib/queries/*.ts` mutation. The mutations send `user_id: session.user.id` for create-mutations on `workout_plans` and `exercises`; the `plan_exercises` table has no `user_id` column (ownership is transitive via `plan_id` → `workout_plans.user_id`, enforced by the `EXISTS` subquery RLS policy at `0001_initial_schema.sql:131-134`).

**The auth-store selector pattern** (Phase 3, used in 3 places):
```typescript
const userId = useAuthStore((s) => s.session?.user.id);
```

### Error handling — Supabase-error → user-facing

**Source:** `app/app/(auth)/sign-in.tsx` lines 65-105 (the `switch (error.code)` mapping)

**Apply to:** every mutation hook's `onError` callback. For Phase 4 (per UI-SPEC inline-error states), the surface is simpler:
- All mutation errors when online → show `Något gick fel. Försök igen.` banner (UI-SPEC error states).
- Offline mutations are NOT errors — they pause via `networkMode: 'offlineFirst'`. The OfflineBanner is the system-state communication path (UI-SPEC).

**Pattern excerpt** (sign-in.tsx lines 88-93 — the AuthRetryableFetchError detection — informative for the planner that "fetch error" needs distinct handling from API error):
```typescript
if (error.name === "AuthRetryableFetchError") {
  setBannerError("Du verkar vara offline. Kontrollera din anslutning.");
  break;
}
```

For Phase 4 mutations that DO surface errors, mirror this discriminator.

### Validation — Zod 4 at the boundary

**Source:** `app/lib/schemas/auth.ts` (Zod 4 idioms) + sign-in.tsx line 33 / line 46 (zodResolver wiring) + RESEARCH.md §8.13 (response-boundary parse)

**Apply to all Phase 4 surfaces:**
1. **Form-input boundary** — `useForm({ resolver: zodResolver(SchemaName), mode: "onSubmit" })`.
2. **Supabase-response boundary** — `RowSchema.parse(data)` in every queryFn AND every mutationFn. NEVER cast.

```typescript
// In a queryFn:
queryFn: async () => {
  const { data, error } = await supabase.from('workout_plans').select('*');
  if (error) throw error;
  return data.map(r => PlanRowSchema.parse(r));  // §8.13
},
```

### Banner with ✕ close-affordance (Phase 3 quick-task convention 4af7462)

**Source:** `app/app/(auth)/sign-in.tsx` lines 130-157 (verbatim copy block above)

**Apply to:**
- `app/components/offline-banner.tsx` (warning/info color override per UI-SPEC).
- `app/app/(app)/plans/new.tsx` `bannerError` state (when mutation rejected online).
- `app/app/(app)/plans/[id].tsx` `bannerError` state.
- `app/app/(app)/plans/[id]/exercise-picker.tsx` `bannerError` state.

### Screen container shell

**Source:** `app/app/(auth)/sign-in.tsx` lines 107-120 + `app/app/(app)/index.tsx` lines 26-28 (the simpler placeholder variant)

**Apply per UI-SPEC §"Screen container":**
- Form screens (plans/new, plans/[id], picker, edit): full shell — `SafeAreaView` → `KeyboardAvoidingView` → `ScrollView` (or `DraggableFlatList` for plans/[id]).
- Tab screens: `SafeAreaView` + `View` + `FlatList` for index; `SafeAreaView` + centered `View` for placeholder tabs.

### Touch targets ≥ 44pt

**Source:** Phase 3 convention — `py-4` on primary CTAs (sign-in.tsx line 243), `px-2 py-1 + hitSlop={8}` on ✕ buttons (sign-in.tsx lines 148-149).

**Apply (per UI-SPEC §Accessibility Floor):**
- Primary CTAs: `py-4`.
- Drag-handle: `p-3` around 24pt icon.
- ✕ on banners: `px-2 py-1` + `hitSlop={8}`.
- List rows: `py-4`.
- FAB: `w-14 h-14` (56pt).

### `placeholderTextColor` workaround

**Source:** `app/app/(auth)/sign-in.tsx` line 175 (NativeWind 4 placeholder text-color cannot be reliably classed; use the prop)

**Apply to every TextInput in Phase 4:** `placeholderTextColor="#9CA3AF"` (the gray-400 hex). Phase 3 Pitfall 7.

### Module-scope side-effects + Zustand selectors

**Source:** `app/lib/auth-store.ts` (Phase 3) — module-scope `onAuthStateChange` listener + bootstrap `getSession()`.

**Apply to `app/lib/query/client.ts`:** Register all 8 `setMutationDefaults` at module top-level (NOT inside a function or React component). Per Pitfall 8.5 + RESEARCH.md "What the planner must NOT do" item 2.

**Apply to `app/lib/query/network.ts`:** Wire `focusManager.setEventListener`, `onlineManager.setEventListener`, AND `onlineManager.subscribe(resume)` at module top-level. The import in `_layout.tsx` triggers them.

---

## No Analog Found

| File | Role | Data Flow | Reason / Recommended scaffold source |
|---|---|---|---|
| `app/lib/query/keys.ts` | infra (typed key factory) | n/a | First key factory in repo. Use RESEARCH.md §4 verbatim (3 factories: `plansKeys`, `exercisesKeys`, `planExercisesKeys`). |
| `app/lib/utils/uuid.ts` | utility | imported by mutationFns | First util module in repo. Trivial — RESEARCH.md §5 spec is 2 lines. Note: install via `npx expo install expo-crypto` (NOT `npm install`). |
| `app/lib/queries/plans.ts` | resource hooks | UI → useMutation → defaults registry | First resource-hooks file. Use RESEARCH.md §4 (TanStack v5 setMutationDefaults pattern) + the per-mutation excerpts in this doc's Pattern Assignments. |
| `app/lib/queries/exercises.ts` | resource hooks | same | Same as plans.ts. |
| `app/lib/queries/plan-exercises.ts` | resource hooks | UI → drag → snapshot → N mutations | Same as plans.ts; PLUS the two-phase reorder algorithm from RESEARCH.md §3 + this doc's `useReorderPlanExercises` excerpt. |
| `app/scripts/manual-test-phase-04-airplane-mode.md` | doc | n/a | First manual-test checklist file. RESEARCH.md §10 K-slice gives the structure. |

For all six, the gap is filled by RESEARCH.md spec + this doc's per-file scaffold. The planner does NOT need to invent patterns.

---

## Where the analog DOES NOT apply (DO NOT copy the gap)

| Analog | What NOT to copy | Reason |
|---|---|---|
| `app/lib/query-client.ts` (Phase 1) | The lack of `setMutationDefaults` (zero calls today) | RESEARCH.md §8.12: Phase 1 has NO `resumePausedMutations()` AND NO `setMutationDefaults`. The new `lib/query/client.ts` MUST add 8 defaults BEFORE the persister hydrates (Pitfall 8.2). The new `lib/query/network.ts` MUST add `onlineManager.subscribe(resume)`. These are the load-bearing Phase 4 additions. |
| `app/lib/query-client.ts` (Phase 1) | The lack of `networkMode: 'offlineFirst'` | RESEARCH.md §1 + CONTEXT.md D-07: must be set on BOTH `defaultOptions.queries` AND `defaultOptions.mutations` in the new client.ts. |
| `app/app/_layout.tsx` (Phase 1+3) | Inline `focusManager` + `onlineManager` blocks (lines 36-52) | Per CONTEXT.md D-01: these MUST move to `lib/query/network.ts`. Leaving them inline + duplicating in `network.ts` would register two NetInfo listeners. |
| `app/app/(app)/index.tsx` (Phase 3) | The whole file | DELETED per CONTEXT.md D-16. Sign-out logic moves to `(tabs)/settings.tsx`; the file itself has no successor (Expo Router 6 group-default-resolution makes `(tabs)/index.tsx` the default route inside `(app)`). |
| `app/app/(auth)/sign-in.tsx` (Phase 3 — RHF auth-error switch lines 65-105) | The full Supabase auth-error code mapping | Phase 4 mutations don't return `AuthApiError` — they return PostgrestError. Error mapping shape is different (no `.code` enum like `'invalid_credentials'` etc.). For Phase 4: collapse to the single banner copy `Något gick fel. Försök igen.` per UI-SPEC error states. |
| `app/app/(auth)/sign-up.tsx` (Phase 3 — `infoBanner` for email-confirmation) | The infoBanner second-state | Phase 4 has no equivalent two-state success path. UI-SPEC's offline behavior is "no banner — optimistic update + global OfflineBanner is the only signal". |
| `app/scripts/test-rls.ts` (Phase 2) | `purgeUserData()` deletion order assuming exercises has no FK from sets | Verbatim copy is fine — the existing order (sessions → plans → exercises) already handles cascades correctly. Don't reorder. |

---

## Metadata

**Analog search scope:**
- `app/lib/**/*.ts` — recursive (3 existing files: supabase.ts, query-client.ts, auth-store.ts, schemas/auth.ts)
- `app/app/**/*.tsx` — recursive (5 existing files: _layout.tsx, (app)/_layout.tsx, (app)/index.tsx, (auth)/sign-in.tsx, (auth)/sign-up.tsx, (auth)/_layout.tsx)
- `app/scripts/**/*.ts` — recursive (3 existing files: test-rls.ts, test-auth-schemas.ts, verify-deploy.ts)
- `app/components/**/*` — empty (no components folder yet — Phase 4 creates it via `offline-banner.tsx`)
- `app/types/database.ts` — read for Tables/TablesInsert/TablesUpdate helper-type pattern
- `app/supabase/migrations/0001_initial_schema.sql` — read for the `unique (plan_id, order_index)` constraint that drives §3 two-phase reorder
- `app/package.json` — read for installed versions + npm script naming convention

**Files scanned:** 16 source files + 1 migration + package.json

**Pattern extraction date:** 2026-05-10

**Cross-references:**
- CLAUDE.md `## Conventions` → Navigation header (per-screen opt-in for plans/[id] header)
- CLAUDE.md `## Conventions` → Database conventions (no schema changes — Phase 4 inherits Phase 2's complete schema)
- CLAUDE.md `## Conventions` → Security conventions → Forms phase (T-04-* threat IDs in Plan 02 `<threat_model>`)
- RESEARCH.md §3 — drag-to-reorder unique-constraint trap (load-bearing for Plan that owns plan-exercises hooks)
- RESEARCH.md §4 — TanStack v5 setMutationDefaults canonical pattern
- RESEARCH.md §5 — UUID + upsert + scope.id semantics
- RESEARCH.md §6 — NetInfo wiring + useOnlineStatus
- RESEARCH.md §8.12 — the load-bearing gap Phase 1 left (no resumePausedMutations call)
- RESEARCH.md §8.13 — Zod parse at response boundary (not cast)
- UI-SPEC §Visuals — concrete component class strings (banner, plan-list row, plan-exercise row, exercise-picker row, FAB)
- UI-SPEC §Copywriting Contract — Swedish copy for every label, placeholder, error, empty-state
- UI-SPEC §Interaction Contracts — every tap → mutation/route mapping
