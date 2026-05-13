# Phase 5: Active Workout Hot Path (F13 lives or dies) - Pattern Map

**Mapped:** 2026-05-12
**Files analyzed:** 21 (12 NEW + 9 MODIFIED, per 05-RESEARCH.md § File List)
**Analogs found:** 21 / 21 — every file has an exact or strong Phase 4 analog

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| **NEW — Zod schemas** | | | | |
| `app/lib/schemas/sessions.ts` | Zod schema (Form + Row split) | validation boundary | `app/lib/schemas/plans.ts` | exact (single-table, nullable text fields) |
| `app/lib/schemas/sets.ts` | Zod schema (Form + Row split) | validation boundary (strict numeric) | `app/lib/schemas/plan-exercises.ts` | exact (z.coerce.number + nullable patterns + ENUM consumer) |
| **NEW — Resource hooks** | | | | |
| `app/lib/queries/sessions.ts` | resource-hook (queries + mutations) | CRUD via setMutationDefaults | `app/lib/queries/plans.ts` | exact (initialData seed + scope-bound hook constructors) |
| `app/lib/queries/sets.ts` | resource-hook (queries + mutations) | CRUD via setMutationDefaults | `app/lib/queries/plan-exercises.ts` | exact (planId→sessionId rebind; add/update/remove triplet) |
| `app/lib/queries/last-value.ts` | resource-hook (read-only) | request-response with PostgREST !inner join | `app/lib/queries/exercises.ts` (shape) + `app/lib/queries/plan-exercises.ts` queryFn (parse loop) | role-match (no exact analog — first 2-step !inner query in codebase) |
| **NEW — UI** | | | | |
| `app/components/active-session-banner.tsx` | global banner component | read-only subscriber (TanStack hook) | `app/components/offline-banner.tsx` | exact (slot-pattern, useColorScheme, accessibilityLiveRegion) |
| `app/app/(app)/workout/_layout.tsx` (optional) | route-group layout | layout-only (no data flow) | `app/app/(app)/_layout.tsx` (Stack screenOptions block) | role-match (centralized header styling already lives in (app); this file is OPTIONAL per File List) |
| `app/app/(app)/workout/[sessionId].tsx` | dynamic route screen | mixed (read multiple queries + write 4 mutations + RHF form per card) | `app/app/(app)/plans/[id].tsx` | exact (Stack.Screen headerRight, freezeOnBlur+useFocusEffect, inline-overlay-confirm, RHF Controllers, FlatList rows) |
| **NEW — Wave 0 test scripts** | | | | |
| `app/scripts/test-session-schemas.ts` | Wave 0 schema round-trip | Node-only Zod safeParse | `app/scripts/test-plan-schemas.ts` | exact (same `Case` shape, same exit-code reporting) |
| `app/scripts/test-set-schemas.ts` | Wave 0 schema round-trip (strict) | Node-only Zod safeParse | `app/scripts/test-plan-schemas.ts` | exact (extend with multipleOf(0.25) / int / ENUM cases) |
| `app/scripts/test-last-value-query.ts` | Wave 0 integration test (DB) | Node-only Supabase + cross-user | `app/scripts/test-rls.ts` (clientA/clientB harness + admin purge) + `app/scripts/test-upsert-idempotency.ts` (DB integration shape) | role-match (combines RLS harness with query correctness assertion) |
| `app/scripts/manual-test-phase-05-f13-brutal.md` | manual test checklist | doc | `app/scripts/manual-test-phase-04-airplane-mode.md` | exact (same 6-step structure, same automated-gates preamble) |
| **MODIFIED** | | | | |
| `app/lib/query/client.ts` | mutation defaults registry | offline-first mutation plumbing | itself (Phase 4 — 8 existing keys); APPEND 5 new blocks | exact (literal copy-paste of Phase 4 pattern with names rebound) |
| `app/lib/query/keys.ts` | query-key factory | const-export | itself (Phase 4); APPEND 3 new factories | exact |
| `app/lib/query/persister.ts` | TanStack persister wrapper | persistence | itself (Phase 4); add `{ throttleTime: 500 }` option + export instance | exact |
| `app/lib/query/network.ts` | NetInfo/AppState listeners | side-effect module | itself (Phase 4); EXTEND AppState listener with background-flush | exact |
| `app/app/(app)/(tabs)/_layout.tsx` | route-group layout | component composition | itself (Phase 4); mount `<ActiveSessionBanner />` between OfflineBanner and Tabs | exact |
| `app/app/(app)/(tabs)/index.tsx` | tab screen | read + inline-overlay | itself (Phase 4); mount `useActiveSessionQuery` + draft-resume overlay | exact (overlay = Phase 4 plans/[id].tsx archive-confirm pattern) |
| `app/app/(app)/plans/[id].tsx` | screen | extend with CTA | itself (Phase 4 plan-detail); INSERT "Starta pass" Pressable | exact (same Pressable + mutate-not-mutateAsync convention) |
| `app/scripts/test-rls.ts` | RLS regression harness | Node-only cross-user | itself (Phase 4 extension block at line 437+); APPEND Phase 5 extension block | exact (literal mirror of Phase 4 extension shape — "Phase 5 extension: A cannot…") |
| `app/package.json` | manifest | script registry | itself; add 3 npm-script entries | trivial |

---

## Pattern Assignments

### `app/lib/schemas/sessions.ts` (Zod schema, validation boundary)

**Analog:** `app/lib/schemas/plans.ts` (53 LOC, full file already read)

**File-header docblock pattern** (lines 1-18):
```typescript
// app/lib/schemas/sessions.ts
//
// Phase 5: Zod 4 schemas for workout_sessions.
//
// Two schema flavors per surface (mirrors plans.ts):
//   - SessionFormInput: what the RHF form yields (notes only — F12 schema-ready).
//   - SessionRowSchema: Zod equivalent of `Tables<'workout_sessions'>` — used at
//     the Supabase-response boundary inside lib/queries/sessions.ts to parse,
//     NOT cast, incoming JSON (Pitfall 8.13).
//
// Zod 4 idioms (verified via plans.ts/auth.ts analogs):
//   - `error:` parameter on issue locales (`message:` deprecated)
//   - .nullable() at the end of optional chains
```

**Row schema pattern** (mirror lines 41-49 from plans.ts):
```typescript
export const sessionRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  plan_id: z.string().uuid().nullable(),
  started_at: z.string(),                  // ISO timestamp, not-null in schema
  finished_at: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string().nullable(),
});
export type SessionRow = z.infer<typeof sessionRowSchema>;
```

**Form schema pattern** (mirror lines 24-35 from plans.ts):
```typescript
// notes ≤ 500 chars — F12 schema-ready (Phase 7 wires UI)
export const sessionFormSchema = z.object({
  notes: z.string().max(500, { error: "Max 500 tecken" }).nullable().optional(),
});
export type SessionFormInput = z.infer<typeof sessionFormSchema>;

// Aliases for downstream consumption (mirrors plans.ts line 51-53)
export const SessionFormSchema = sessionFormSchema;
export const SessionRowSchema = sessionRowSchema;
```

**Schema column truth source:** `app/supabase/migrations/0001_initial_schema.sql` lines 62-70:
```sql
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.workout_plans(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  notes text,
  created_at timestamptz default now()
);
```

---

### `app/lib/schemas/sets.ts` (Zod schema, strict validation boundary)

**Analog:** `app/lib/schemas/plan-exercises.ts` (79 LOC, full file already read)

**Row schema pattern** (mirror lines 65-74 from plan-exercises.ts, adapted to exercise_sets columns):
```typescript
export const setRowSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  set_number: z.number().int(),
  reps: z.number().int(),
  weight_kg: z.number(),                                  // numeric(6,2) — see Pitfall below
  rpe: z.number().nullable(),                             // numeric(3,1), F11 schema-ready
  set_type: z.enum(["working", "warmup", "dropset", "failure"]),
  completed_at: z.string().nullable(),
  notes: z.string().nullable(),
});
export type SetRow = z.infer<typeof setRowSchema>;
```

**Form schema pattern** (strict per CONTEXT.md D-15 — required idioms cited verbatim from CONTEXT.md):
```typescript
export const setFormSchema = z.object({
  weight_kg: z.coerce
    .number({ error: "Vikt krävs" })
    .min(0, { error: "Vikt måste vara 0 eller högre" })
    .max(500, { error: "Vikt över 500kg verkar fel — kontrollera" })
    .multipleOf(0.25, { error: "Vikt i steg om 0.25kg" }),
  reps: z.coerce
    .number()
    .int()
    .min(1, { error: "Minst 1 rep" })
    .max(60, { error: "Över 60 reps verkar fel — kontrollera" }),
  set_type: z
    .enum(["working", "warmup", "dropset", "failure"])
    .default("working"),
  rpe: z.coerce.number().nullable().optional(),
  notes: z.string().max(500, { error: "Max 500 tecken" }).nullable().optional(),
});
// Type split mirrors plan-exercises.ts line 63 + edit.tsx line 85:
export type SetFormInput = z.input<typeof setFormSchema>;
export type SetFormOutput = z.output<typeof setFormSchema>;
```

**Why both `z.input` and `z.output`** — copied from `app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx` line 62-63 (verbatim comment):
> The schema uses z.coerce.number() on the numeric fields, so its INPUT type is `unknown` and its OUTPUT type is `number | null`. RHF v7's third generic (TTransformedValues) lets handleSubmit hand us the parsed output shape while the form values themselves carry the input shape.

**Schema column truth source:** `app/supabase/migrations/0001_initial_schema.sql` lines 72-83:
```sql
create table public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  set_number int not null,
  reps int not null,
  weight_kg numeric(6,2) not null,
  rpe numeric(3,1),
  set_type public.set_type not null default 'working',
  completed_at timestamptz default now(),
  notes text
);
```

**Anti-pattern to AVOID:** PITFALLS §1.5 — `weight_kg` is `numeric(6,2)` so client values like `52.501` truncate to `52.50` server-side. `multipleOf(0.25)` is the load-bearing guard; do NOT relax it.

---

### `app/lib/queries/sessions.ts` (resource hooks, CRUD)

**Analog:** `app/lib/queries/plans.ts` (131 LOC, full file already read)

**File-header docblock — mirror lines 1-24 from plans.ts** (replace plan→session vocabulary):
```typescript
// app/lib/queries/sessions.ts
//
// Phase 5: Resource hooks for workout_sessions.
//
// Conventions:
//   - Pitfall 8.1: every useMutation specifies ONLY mutationKey + scope. The
//     mutationFn + onMutate/onError/onSettled live in lib/query/client.ts
//     setMutationDefaults so paused mutations re-hydrate against the same
//     logic the developer wrote (Pitfall 8.2).
//   - scope.id correction: TanStack v5's MutationScope.id is a STATIC string.
//     useStartSession(sessionId) / useFinishSession(sessionId) bake
//     `scope: { id: 'session:<id>' }` into the hook instance.
//
// Query-side: Pitfall 8.13 — every Supabase response is fed through
// SessionRowSchema.parse() (NOT cast as Database type).
```

**`useActiveSessionQuery` — list-query pattern** (mirror lines 36-49 from plans.ts):
```typescript
export function useActiveSessionQuery() {
  return useQuery<SessionRow | null>({
    queryKey: sessionsKeys.active(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_sessions")
        .select("*")
        .is("finished_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? SessionRowSchema.parse(data) : null;
    },
  });
}
```

**`useSessionQuery(id)` — initialData seed pattern** (mirror lines 67-85 from plans.ts verbatim; UAT 2026-05-10 commentary is load-bearing — keep the comment):
```typescript
// initialData seeds the detail cache from the active-session cache on first read.
// (Phase 4 UAT: an offline-created plan rendered "Laddar…" forever the first time
// the user navigated into it — initialData closes that gap.)
export function useSessionQuery(id: string) {
  return useQuery<SessionRow>({
    queryKey: sessionsKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_sessions").select("*").eq("id", id).single();
      if (error) throw error;
      return SessionRowSchema.parse(data);
    },
    enabled: !!id,
    initialData: () => {
      const active = queryClient.getQueryData<SessionRow | null>(sessionsKeys.active());
      return active && active.id === id ? active : undefined;
    },
  });
}
```

**Mutation hook constructors** (mirror lines 112-131 from plans.ts):
```typescript
// scope.id is set at useMutation() time. CONTEXT.md D-02: useStartSession is
// called with the new session's id so the optimistic onMutate dual-writes
// active + detail caches.
export function useStartSession(sessionId?: string) {
  return useMutation<SessionRow, Error, SessionInsertVars>({
    mutationKey: ["session", "start"] as const,
    scope: sessionId ? { id: `session:${sessionId}` } : undefined,
  });
}

export function useFinishSession(sessionId?: string) {
  return useMutation<SessionRow, Error, SessionFinishVars>({
    mutationKey: ["session", "finish"] as const,
    scope: sessionId ? { id: `session:${sessionId}` } : undefined,
  });
}
```

**Critical convention** — every call site of `useStartSession(...).mutate(...)` MUST use `mutate(payload, { onError, onSuccess })`, NOT `mutateAsync`. See `app/app/(app)/plans/new.tsx` lines 26-39 (verbatim UAT comment about why mutateAsync hangs forever under `networkMode: 'offlineFirst'`).

---

### `app/lib/queries/sets.ts` (resource hooks, CRUD with sessionId scope)

**Analog:** `app/lib/queries/plan-exercises.ts` (208 LOC, full file already read). Phase 5 mirrors the planId→sessionId rebind: every hook accepts `sessionId` and bakes `scope: { id: 'session:<sessionId>' }`.

**Query — list pattern** (mirror lines 42-56 from plan-exercises.ts):
```typescript
export function useSetsForSessionQuery(sessionId: string) {
  return useQuery<SetRow[]>({
    queryKey: setsKeys.list(sessionId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercise_sets")
        .select("*")
        .eq("session_id", sessionId)
        .order("exercise_id", { ascending: true })
        .order("set_number", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => SetRowSchema.parse(row));
    },
    enabled: !!sessionId,
  });
}
```

**Mutation hook triplet — copy lines 82-101 from plan-exercises.ts** with these renames:
- `planId` → `sessionId`
- `'plan-exercise'` → `'set'`
- `plan_id` → `session_id`
- ENUM scope prefix `plan:` → `session:`

```typescript
export function useAddSet(sessionId: string) {
  return useMutation<SetRow, Error, SetInsertVars>({
    mutationKey: ["set", "add"] as const,
    scope: { id: `session:${sessionId}` },
  });
}
export function useUpdateSet(sessionId: string) {
  return useMutation<SetRow, Error, SetUpdateVars>({
    mutationKey: ["set", "update"] as const,
    scope: { id: `session:${sessionId}` },
  });
}
export function useRemoveSet(sessionId: string) {
  return useMutation<void, Error, SetRemoveVars>({
    mutationKey: ["set", "remove"] as const,
    scope: { id: `session:${sessionId}` },
  });
}
```

**Anti-pattern to AVOID:** PITFALLS §3 (RESEARCH §Pitfall 3) — scope.id MUST be a static string at useMutation() time. NEVER `scope: { id: (vars) => 'session:' + vars.session_id }` (function shape silently fails the `typeof === "string"` check and breaks serial replay). See verbatim warning in `app/lib/query/client.ts` lines 137-166.

---

### `app/lib/queries/last-value.ts` (resource hook, read-only with !inner join)

**Analog:** `app/lib/queries/exercises.ts` (56 LOC, hook shape) + `app/lib/queries/plan-exercises.ts` queryFn structure (lines 42-56). No exact analog for the 2-step PostgREST `!inner` join — `05-RESEARCH.md` §"Set-Position-Aligned Last Value Query" lines 665-718 is the canonical reference.

**Hook body — copy verbatim from RESEARCH.md lines 666-718:**
```typescript
// app/lib/queries/last-value.ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { lastValueKeys } from "@/lib/query/keys";
import { SetRowSchema } from "@/lib/schemas/sets";
import { useAuthStore } from "@/lib/auth-store";

export function useLastValueQuery(exerciseId: string, currentSessionId: string) {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery<Map<number, { weight_kg: number; reps: number; completed_at: string }>>({
    queryKey: lastValueKeys.byExercise(exerciseId),
    queryFn: async () => {
      if (!userId) return new Map();

      // STEP 1: find the most-recent finished session that contains this exercise
      const { data: sessionRow, error: sessionErr } = await supabase
        .from('exercise_sets')
        .select('session_id, completed_at, workout_sessions!inner(id, user_id, finished_at, started_at)')
        .eq('exercise_id', exerciseId)
        .eq('set_type', 'working')
        .not('workout_sessions.finished_at', 'is', null)
        .neq('session_id', currentSessionId)
        .eq('workout_sessions.user_id', userId)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sessionErr) throw sessionErr;
      if (!sessionRow) return new Map();
      const targetSessionId = sessionRow.session_id;

      // STEP 2: fetch all working sets from that session for this exercise
      const { data: sets, error: setsErr } = await supabase
        .from('exercise_sets')
        .select('set_number, weight_kg, reps, completed_at')
        .eq('session_id', targetSessionId)
        .eq('exercise_id', exerciseId)
        .eq('set_type', 'working')
        .order('set_number', { ascending: true });
      if (setsErr) throw setsErr;

      const map = new Map<number, { weight_kg: number; reps: number; completed_at: string }>();
      for (const s of sets ?? []) {
        const parsed = SetRowSchema.partial().parse(s);
        if (parsed.set_number != null && parsed.weight_kg != null && parsed.reps != null && parsed.completed_at != null) {
          map.set(parsed.set_number, {
            weight_kg: parsed.weight_kg,
            reps: parsed.reps,
            completed_at: parsed.completed_at,
          });
        }
      }
      return map;
    },
    enabled: !!exerciseId && !!userId,
    staleTime: 1000 * 60 * 15, // 15 min per CONTEXT.md D-20
  });
}
```

**Index coverage** (RESEARCH.md line 721): `idx_exercise_sets_exercise(exercise_id, completed_at desc)` covers STEP 1; `idx_exercise_sets_session(session_id)` covers STEP 2. Verified in `0001_initial_schema.sql` lines 88-89.

**Anti-pattern to AVOID:** RESEARCH §Pitfall 4 — DO NOT return the last set of the last session (set_number-agnostic). MUST be set-position-aligned via STEP 2's `.order('set_number')` + `Map<number, ...>` shape.

---

### `app/components/active-session-banner.tsx` (global banner, read-only subscriber)

**Analog:** `app/components/offline-banner.tsx` (69 LOC, full file already read)

**Pattern — copy structure from offline-banner.tsx lines 33-69** with this delta table:

| offline-banner.tsx | active-session-banner.tsx |
|--------------------|----------------------------|
| `useOnlineStatus() === false` triggers visibility | `useActiveSessionQuery().data != null` triggers visibility |
| `dismissed` local state for close-✕ | NO close affordance (UI-SPEC line 507) |
| `bg-yellow-200 dark:bg-yellow-900 border-yellow-400 dark:border-yellow-700` | `bg-blue-100 dark:bg-blue-950 border-blue-300 dark:border-blue-800` (UI-SPEC line 490) |
| `accessibilityRole="alert"` (passive) | `accessibilityRole="button"` (tap routes to /workout/<id>) |
| Pure `<View>` (no tap target) | `<Pressable onPress={() => router.push('/workout/<id>')}>` |

**Concrete excerpt** (UI-SPEC lines 487-505 + offline-banner.tsx structure):
```typescript
// app/components/active-session-banner.tsx
import { View, Text, Pressable } from "react-native";
import { useRouter, useSegments, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "react-native";
import { useActiveSessionQuery } from "@/lib/queries/sessions";

export function ActiveSessionBanner() {
  const router = useRouter();
  const segments = useSegments();
  const { data: activeSession } = useActiveSessionQuery();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const iconColor = isDark ? "#DBEAFE" : "#1E3A8A"; // blue-100 dark / blue-900 light

  // Hide-on-workout-route logic (UI-SPEC line 509): don't double-stack header.
  const onWorkoutRoute = segments.some((s) => s === "workout");
  if (!activeSession || onWorkoutRoute) return null;

  return (
    <Pressable
      onPress={() => router.push(`/workout/${activeSession.id}` as Href)}
      accessibilityRole="button"
      accessibilityLabel="Återgå till pågående pass"
      className="flex-row items-center justify-between gap-2 bg-blue-100 dark:bg-blue-950 border border-blue-300 dark:border-blue-800 px-4 py-3 mx-4 mt-2 rounded-lg active:opacity-80"
    >
      <View className="flex-row items-center gap-2 flex-1">
        <Ionicons name="time" size={20} color={iconColor} />
        <View className="flex-1">
          <Text className="text-base font-semibold text-blue-900 dark:text-blue-100" accessibilityLiveRegion="polite">
            Pågående pass
          </Text>
          <Text className="text-base text-blue-900 dark:text-blue-100 opacity-80">
            Tryck för att återgå
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={iconColor} />
    </Pressable>
  );
}
```

---

### `app/app/(app)/workout/[sessionId].tsx` (dynamic route screen)

**Analog:** `app/app/(app)/plans/[id].tsx` (759 LOC). This is the **largest pattern-copy target** in Phase 5. Read sections by topic — do not re-read the whole file.

#### Topic A: Screen scaffold + Stack.Screen + freezeOnBlur reset

**Source range:** lines 99-156, 250-270 of `plans/[id].tsx`.

```typescript
// Imports (lines 43-79 of plans/[id].tsx — adapt for workout):
import { useState, useEffect, useMemo, useCallback } from "react";
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

// Local state + freezeOnBlur reset (mirror lines 142-155):
const [showAvslutaOverlay, setShowAvslutaOverlay] = useState(false);
const [draftDismissed, setDraftDismissed] = useState(false); // local to workout for sub-overlays

useFocusEffect(
  useCallback(() => {
    setShowAvslutaOverlay(false);
    // reset any per-card edit state here too
  }, []),
);

// Header right "Avsluta" button (mirror lines 252-270):
<Stack.Screen
  options={{
    headerShown: true,
    title: planNameTruncated,   // session.started_at HH:MM or plan-name
    headerRight: () => (
      <Pressable
        onPress={() => setShowAvslutaOverlay(true)}
        accessibilityRole="button"
        accessibilityLabel="Avsluta passet"
        hitSlop={8}
        className="px-2 py-1"
      >
        <Text className="text-base font-semibold text-blue-600 dark:text-blue-500">
          Avsluta
        </Text>
      </Pressable>
    ),
  }}
/>
```

**Why useFocusEffect** — verbatim from `plans/[id].tsx` lines 146-149 comment:
> freezeOnBlur (set on the (app) Stack screenOptions) keeps this screen mounted across navigation. Without this hook a modal left open before navigating away would still be visible when returning to this screen.

#### Topic B: Loading gate (initialData + `!session` not `isPending`)

**Source range:** `plans/[id].tsx` lines 232-248. Mirror verbatim:
```typescript
// Loading state intentionally gates on `!session` only (not isPending). With
// initialData seeding useSessionQuery from the active-session cache + the
// dual-write optimistic onMutate in setMutationDefaults['session','start'],
// `session` is populated from millisecond zero for any session the user just
// started or that is in active cache. Tying the loading branch to isPending
// would re-blank the screen on every background refetch.
if (!session) {
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-1 items-center justify-center">
        <Text className="text-base text-gray-500 dark:text-gray-400">Laddar…</Text>
      </View>
    </SafeAreaView>
  );
}
```

#### Topic C: Inline-overlay-confirm (Avsluta button + draft-resume modal)

**Source range:** `plans/[id].tsx` lines 541-641 (archive-confirm overlay) — copy structure verbatim. Replace strings per UI-SPEC line 519-551:

| `plans/[id].tsx` archive overlay | workout Avsluta overlay |
|----------------------------------|--------------------------|
| Title: `Arkivera "{plan.name}"?` | Title: `Avsluta passet?` |
| Body: "Planen tas bort från listan…" | Body: `${loggedSetCount} set sparade. Avsluta passet?` (or empty-session variant per CONTEXT.md D-23) |
| Primary button: red `Arkivera` | Primary button: red `Avsluta` |
| Secondary button: `Avbryt` | Secondary button: `Fortsätt` |

**Why inline overlay, not Modal** — verbatim from `plans/[id].tsx` lines 535-541:
> Themed archive-confirm dialog. Inline absolute-positioned overlay (not a Modal) — same pattern as the overflow popover, for the same reason: NativeWind/flex layout inside the Modal portal silently collapsed (UAT 2026-05-10 — no scrim, dialog rendered at top-left). Explicit RN styles on the layout primitives; NativeWind retained for the inner card content where it works reliably.

#### Topic D: RHF set-input form (per exercise-card)

**Analog source — RHF z.input/z.output split:** `app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx` lines 62-94:
```typescript
type SetFormValues = z.input<typeof setFormSchema>;

const {
  control,
  handleSubmit,
  reset,
  formState: { errors, isSubmitting },
} = useForm<SetFormValues, undefined, SetFormOutput>({
  resolver: zodResolver(setFormSchema),
  mode: "onSubmit",                              // CONTEXT.md Discretion → Phase 3 D-15 precedent
  defaultValues: {
    weight_kg: prefillWeight ?? null,            // CONTEXT.md D-10 pre-fill
    reps: prefillReps ?? null,
  },
});

// Hydrate defaults via useEffect (mirror edit.tsx lines 99-108):
useEffect(() => {
  reset({ weight_kg: prefillWeight, reps: prefillReps });
}, [prefillWeight, prefillReps, reset]);
```

**TextInput per field — mirror `edit.tsx` lines 169-205**, with `keyboardType="decimal-pad"` per UI-SPEC line 433 and CONTEXT.md D-11.

#### Topic E: Klart-tap → useAddSet.mutate

**Source — RESEARCH.md lines 744-777 (verbatim):**
```typescript
const onKlart = (input: SetFormOutput) => {
  if (!sessionId || !exerciseId) return;
  const allSets = queryClient.getQueryData<SetRow[]>(setsKeys.list(sessionId)) ?? [];
  const setsForThisExercise = allSets.filter((s) => s.exercise_id === exerciseId);
  const setNumber = setsForThisExercise.length + 1;

  addSet.mutate(
    {
      id: randomUUID(),
      session_id: sessionId,
      exercise_id: exerciseId,
      set_number: setNumber,
      weight_kg: input.weight_kg,
      reps: input.reps,
      completed_at: new Date().toISOString(),
      set_type: 'working',
    },
    {
      onSuccess: () => reset({ weight_kg: input.weight_kg, reps: input.reps }),
      onError: () => setBannerError('Något gick fel när set sparades. Försök igen.'),
    },
  );
};
```

**Anti-pattern to AVOID:** Do NOT use `mutateAsync` — see `app/app/(app)/plans/new.tsx` lines 26-39 verbatim comment about offline-paused mutations leaving CTAs stuck at "Sparar…".

#### Topic F: Exercise-name lookup via Map

**Source:** `plans/[id].tsx` lines 116-121:
```typescript
const { data: exercises } = useExercisesQuery();
const exerciseNameById = useMemo(() => {
  const m = new Map<string, string>();
  for (const e of exercises ?? []) m.set(e.id, e.name);
  return m;
}, [exercises]);
```
Then `exerciseNameById.get(planExercise.exercise_id) ?? "(övning saknas)"` per line 444. Phase 4 commit `3bfaba8` justifies this over a PostgREST embedded-resource join.

---

### `app/app/(app)/plans/[id].tsx` (MODIFIED — add "Starta pass" CTA)

**Insertion site:** between the existing `Lägg till övning` block (lines 403-414) and the FlatList tail. The CTA goes inside the `ListHeaderComponent` View or as a footer (Plan 02 chooses).

**Pattern — copy lines 403-414 Pressable shape verbatim**, swap label + onPress:
```typescript
import { useStartSession } from "@/lib/queries/sessions";
import { useAuthStore } from "@/lib/auth-store";
import { randomUUID } from "@/lib/utils/uuid";

// Inside component:
const userId = useAuthStore((s) => s.session?.user.id);
const startSession = useStartSession();           // scope is bound at mutate-call time per ID
const canStart = (planExercises?.length ?? 0) > 0;

const onStarta = () => {
  if (!userId || !plan) return;
  const newId = randomUUID();
  // mutate (NOT mutateAsync) per plans/new.tsx UAT lesson (lines 26-39).
  startSession.mutate(
    {
      id: newId,
      user_id: userId,
      plan_id: plan.id,
      started_at: new Date().toISOString(),
    },
    { onError: () => setBannerError("Kunde inte starta passet. Försök igen.") },
  );
  router.push(`/workout/${newId}` as Href);
};

// JSX (mirror Lägg till övning Pressable line 403-414):
<Pressable
  onPress={onStarta}
  disabled={!canStart}
  accessibilityRole="button"
  accessibilityLabel={canStart ? "Starta pass" : "Lägg till minst en övning först"}
  className="rounded-lg bg-blue-600 dark:bg-blue-500 px-4 py-4 active:opacity-80 disabled:opacity-60"
>
  <Text className="text-base font-semibold text-white">Starta pass</Text>
</Pressable>
```

---

### `app/app/(app)/(tabs)/index.tsx` (MODIFIED — draft-resume overlay)

**Analog:** existing file (lines 1-154). Insertion: mount `useActiveSessionQuery()` at the top and render an inline-overlay-confirm when a hit returns and the user hasn't dismissed.

**Pattern — overlay structure copy from `plans/[id].tsx` lines 541-641** (archive-confirm), with these string swaps:
- Title: `Återuppta passet?`
- Body: `Du har ett pågående pass från ${HH:MM} med ${count} set sparade.`
- Buttons: `Avsluta sessionen` (destructive red, calls `useFinishSession`) / `Återuppta` (primary blue, routes to `/workout/<id>`)

**`useFocusEffect` reset** — same pattern as `plans/[id].tsx` lines 150-155:
```typescript
const [draftDismissed, setDraftDismissed] = useState(false);
useFocusEffect(
  useCallback(() => {
    return () => setDraftDismissed(false);  // re-show on re-focus
  }, []),
);
```

---

### `app/app/(app)/(tabs)/_layout.tsx` (MODIFIED — mount ActiveSessionBanner)

**Insertion site:** between `<OfflineBanner />` (line 37) and `<Tabs>` (line 38). One-line change:
```typescript
import { ActiveSessionBanner } from "@/components/active-session-banner";
// …
<SafeAreaView edges={["top"]} className="flex-1 bg-white dark:bg-gray-900">
  <OfflineBanner />
  <ActiveSessionBanner />     {/* NEW — below offline, above tabs */}
  <Tabs ...>
```

---

### `app/lib/query/client.ts` (MODIFIED — append 5 new setMutationDefaults blocks)

**Insertion site:** after line 495 (end of `['plan-exercise','reorder']` no-op default).

**Source:** RESEARCH.md lines 240-417 contain the literal code. Each new block mirrors the Phase 4 blocks at lines 168-478 verbatim — same structure (`cancelQueries → snapshot → setQueryData → return previous` → `onError rollback` → `onSettled invalidate` → `retry: 1`).

**Required `Type aliases` additions** (mirror lines 88-118 from existing client.ts):
```typescript
import { SessionRowSchema, type SessionRow } from "@/lib/schemas/sessions";
import { SetRowSchema, type SetRow } from "@/lib/schemas/sets";
import { sessionsKeys, setsKeys, lastValueKeys } from "@/lib/query/keys";

type SessionInsertVars = Partial<SessionRow> & {
  id: string;
  user_id: string;
  plan_id?: string | null;
  started_at?: string;
};
type SessionFinishVars = { id: string; finished_at: string };
type SetInsertVars = Partial<SetRow> & {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  reps: number;
  weight_kg: number;
};
type SetUpdateVars = { id: string; session_id: string } & Partial<Pick<SetRow, "reps" | "weight_kg" | "rpe" | "notes" | "set_type">>;
type SetRemoveVars = { id: string; session_id: string };
```

**5 new blocks — copy verbatim from 05-RESEARCH.md lines 247-417** (file already cited). Each block mirrors:
- `['plan','create']` (lines 171-222) for `['session','start']` — dual-write active + detail
- `['plan','update']` (lines 227-272) for `['session','finish']` — single-record update
- `['plan-exercise','add']` (lines 351-387) for `['set','add']` — append to list cache
- `['plan-exercise','update']` (lines 393-437) for `['set','update']` — map-replace in list cache
- `['plan-exercise','remove']` (lines 442-478) for `['set','remove']` — filter from list cache

**Required scope.id contract comments** — append to the existing contract docblock at lines 137-166:
```
//   ['session','start']    → scope.id = `session:${vars.id}`
//   ['session','finish']   → scope.id = `session:${vars.id}`
//   ['set','add']          → scope.id = `session:${vars.session_id}`
//   ['set','update']       → scope.id = `session:${vars.session_id}`
//   ['set','remove']       → scope.id = `session:${vars.session_id}`
```

**Anti-pattern to AVOID:** RESEARCH §Pitfall 1 — these `setMutationDefaults` MUST register at module top-level (NEVER inside a function/hook). Phase 4's existing 8 blocks all live at top-level; Phase 5 appends in the same scope.

---

### `app/lib/query/keys.ts` (MODIFIED — append 3 new key-factories)

**Insertion site:** after line 24 (end of `planExercisesKeys`).

**Pattern — copy lines 10-14 (plansKeys) for sessions, lines 16-19 (exercisesKeys) for sets, lines 21-24 (planExercisesKeys) for lastValue.**

```typescript
export const sessionsKeys = {
  all: ["sessions"] as const,
  list: () => [...sessionsKeys.all, "list"] as const,
  detail: (id: string) => [...sessionsKeys.all, "detail", id] as const,
  active: () => [...sessionsKeys.all, "active"] as const,
};

export const setsKeys = {
  all: ["sets"] as const,
  list: (sessionId: string) => [...setsKeys.all, "list", sessionId] as const,
};

export const lastValueKeys = {
  all: ["last-value"] as const,
  byExercise: (exerciseId: string) => [...lastValueKeys.all, "by-exercise", exerciseId] as const,
};
```

---

### `app/lib/query/persister.ts` (MODIFIED — add throttleTime + export instance)

**Existing file** (30 LOC, full file already read). Two edits:

1. Pass `{ throttleTime: 500 }` to `createAsyncStoragePersister` (per CONTEXT.md D-25 + RESEARCH.md A1):
```typescript
const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  throttleTime: 500,    // Phase 5 D-25 — closes Phase 4 D-02 deferral
});
```

2. Export the instance so `network.ts` can call `.persistClient()` (RESEARCH.md A2):
```typescript
export { asyncStoragePersister };
```

**Anti-pattern to AVOID:** RESEARCH §Pitfall 2 — force-quit within the persister throttle window drops the most-recent set. The 500ms throttle + AppState background-flush is the two-belt mitigation.

---

### `app/lib/query/network.ts` (MODIFIED — AppState background-flush listener)

**Existing file** (88 LOC, full file already read). **Insertion site:** after line 45 (end of existing `focusManager.setEventListener` block).

**Pattern — mirror the existing `AppState.addEventListener` block at lines 41-44**, but trigger persister flush instead of focus:
```typescript
import { asyncStoragePersister } from "@/lib/query/persister";   // NEW import — note module-load-order: persister.ts must load FIRST, which it does per app/_layout.tsx lines 22-24

// Phase 5 D-25: flush persister on background/inactive so the most-recent
// set survives a force-quit within the throttleTime window (PITFALL 2).
AppState.addEventListener("change", (s) => {
  if (Platform.OS !== "web" && (s === "background" || s === "inactive")) {
    void asyncStoragePersister.persistClient(queryClient);
  }
});
```

**Verify Assumption A1/A2** before shipping — the exact API name (`persistClient` vs another) needs verification per RESEARCH.md Assumptions Log lines 1313-1314. Plan 02 verifies via Context7 `/tanstack/query`.

---

### `app/scripts/test-session-schemas.ts` (NEW — Wave 0 schema test)

**Analog:** `app/scripts/test-plan-schemas.ts` (112 LOC, full file already read). Copy file verbatim, swap imports + cases.

**Imports + boilerplate — copy lines 1-21 from test-plan-schemas.ts**, swap `planFormSchema` → `sessionFormSchema`.

**Cases — focus on notes ≤ 500 chars + nullable**:
```typescript
const cases: Case[] = [
  { name: "happy: notes null", input: { notes: null }, expectSuccess: true },
  { name: "happy: notes omitted", input: {}, expectSuccess: true },
  { name: "happy: notes 500 chars", input: { notes: "x".repeat(500) }, expectSuccess: true },
  { name: "reject: notes 501 chars", input: { notes: "y".repeat(501) }, expectSuccess: false, expectErrorIncludes: "Max 500 tecken", expectErrorPath: ["notes"] },
];
```

**Reporting harness — copy lines 67-112 verbatim.**

---

### `app/scripts/test-set-schemas.ts` (NEW — Wave 0 schema test, strict)

**Analog:** `app/scripts/test-plan-schemas.ts` (same harness shape).

**Cases — must cover all CONTEXT.md D-15 constraints:**
```typescript
const cases: Case[] = [
  // happy
  { name: "happy: valid working set", input: { weight_kg: 82.5, reps: 8, set_type: "working" }, expectSuccess: true },
  { name: "happy: weight 0", input: { weight_kg: 0, reps: 1, set_type: "working" }, expectSuccess: true },
  { name: "happy: set_type default to working", input: { weight_kg: 50, reps: 5 }, expectSuccess: true },
  // strict rejections (CONTEXT.md D-15)
  { name: "reject: weight 1255", input: { weight_kg: 1255, reps: 5 }, expectSuccess: false, expectErrorIncludes: "över 500kg" },
  { name: "reject: weight not multipleOf(0.25)", input: { weight_kg: 82.501, reps: 5 }, expectSuccess: false, expectErrorIncludes: "0.25kg" },
  { name: "reject: negative weight", input: { weight_kg: -1, reps: 5 }, expectSuccess: false, expectErrorIncludes: "0 eller högre" },
  { name: "reject: reps 0", input: { weight_kg: 50, reps: 0 }, expectSuccess: false, expectErrorIncludes: "Minst 1 rep" },
  { name: "reject: reps non-int", input: { weight_kg: 50, reps: 5.5 }, expectSuccess: false },
  { name: "reject: reps 61", input: { weight_kg: 50, reps: 61 }, expectSuccess: false, expectErrorIncludes: "Över 60 reps" },
  // ENUM
  { name: "reject: invalid set_type", input: { weight_kg: 50, reps: 5, set_type: "bogus" }, expectSuccess: false },
];
```

---

### `app/scripts/test-last-value-query.ts` (NEW — Wave 0 integration test)

**Analog:** `app/scripts/test-rls.ts` lines 1-100 (client A/B harness + admin purge) + `app/scripts/test-upsert-idempotency.ts` (DB-touching test structure).

**Pattern — copy harness boilerplate from test-rls.ts:**
- lines 27-71 (env guard + 3 isolated clients)
- lines 79-118 (pass/fail/assertEmpty/assertWriteBlocked helpers)
- lines 134-166 (`purgeUserData` + `cleanupTestUsers`)
- lines 172-198 (createUser × 2)

**Then add Phase 5-specific assertions** verifying:
1. `useLastValueQuery(exerciseId, currentSessionId)` query (via direct supabase calls, not the hook) returns set-position-aligned data when User A has a finished session.
2. Cross-user gate (RESEARCH.md A3): when clientB calls the same query for User A's exercise, the Map is empty (RLS scopes via `workout_sessions!inner`).
3. Empty Map when no prior finished session exists.

---

### `app/scripts/manual-test-phase-05-f13-brutal.md` (NEW — manual brutal-test checklist)

**Analog:** `app/scripts/manual-test-phase-04-airplane-mode.md` (112 LOC, full file already read). Copy structure verbatim with these substitutions:

| Phase 4 manual test | Phase 5 brutal-test |
|---------------------|---------------------|
| 6 steps | 6 steps (per CONTEXT.md F13 acceptance) |
| Step 1 "Pre-flight automated gates" lists 10 scripts | Update to include `test:session-schemas`, `test:set-schemas`, `test:last-value-query`, plus all Phase 4 scripts |
| Step 2 negative-index smoke test | Step 2: verify `idx_exercise_sets_exercise` is being used (EXPLAIN ANALYZE on the F7 STEP 1 query) |
| Step 3: airplane + create plan + drag | Step 3: airplane + start session + log 25 set across ≥3 exercises (CONTEXT.md F13 acceptance) |
| Step 4: force-quit + cache hydration | Step 4: force-quit + reopen offline (all 25 sets MUST be in cache) |
| Step 5: reconnect + Studio verify | Step 5: reconnect → Studio: all 25 sets land in correct set_number order, no FK violations, no dupes |
| Step 6: captive-portal | Step 6: edge cases (multi-unfinished session, set_number race) |

**Source content blueprint:** RESEARCH.md lines 912-1027 (§F13 Brutal-Test Recipe) — Plan 02 ships exactly this content as a markdown checklist.

---

### `app/scripts/test-rls.ts` (MODIFIED — append Phase 5 extension block)

**Existing file** (639 LOC). **Insertion site:** after line 600 (end of Phase 4 extension block "defense-in-depth: count plan_exercises").

**Pattern — mirror the Phase 4 extension block at lines 437-600 verbatim**, swap names:
- `Phase 4 extension:` → `Phase 5 extension:`
- `workout_plans archive` → `workout_sessions own (start/finish) cross-user`
- `plan_exercises` parent-FK → `exercise_sets` parent-FK (via workout_sessions)

**Concrete additions:**
```typescript
// ---- workout_sessions UPDATE finished_at cross-user (F8 finish path) ----
assertWriteBlocked(
  "Phase 5 extension: A cannot UPDATE finished_at on B's workout_session (F8 cross-user)",
  await clientA.from("workout_sessions").update({ finished_at: new Date().toISOString() }).eq("id", sessB.id).select(),
);

// ---- workout_sessions INSERT with B's user_id (F5 start path) ----
assertWriteBlocked(
  "Phase 5 extension: A cannot INSERT workout_session with B's user_id (F5 start cross-user)",
  await clientA.from("workout_sessions").insert({ user_id: userB.id, plan_id: planB.id }).select(),
);

// ---- exercise_sets parent-FK regression (already partially covered, restate F6 shape) ----
// Already at lines 411-422; restate with realistic F6 payload + completed_at.
assertWriteBlocked(
  "Phase 5 extension: A cannot INSERT exercise_set into B's session (F6 cross-user)",
  await clientA.from("exercise_sets").insert({
    session_id: sessB.id, exercise_id: exA.id, set_number: 99,
    reps: 5, weight_kg: 100, completed_at: new Date().toISOString(), set_type: 'working',
  }).select(),
);

// ---- Defense-in-depth: confirm session/sets unchanged ----
// Mirror lines 532-580: admin SELECT to verify B's session + set rows survived.
```

---

### `app/package.json` (MODIFIED — add 3 npm scripts)

Add to `"scripts"`:
```json
"test:session-schemas": "tsx scripts/test-session-schemas.ts",
"test:set-schemas": "tsx scripts/test-set-schemas.ts",
"test:last-value-query": "tsx --env-file=.env.local scripts/test-last-value-query.ts"
```

Existing scripts (per `test-rls.ts` line 17): RLS test runs as `tsx --env-file=.env.local scripts/test-rls.ts`. Schema-only tests don't need `--env-file` (no Supabase calls); query test needs it.

---

## Shared Patterns

### Module-load order (load-bearing)

**Source:** `app/app/_layout.tsx` lines 16-24 (verbatim):
> LOAD-BEARING import order — client.ts MUST execute first (registers all setMutationDefaults), THEN persister.ts (hydrates the cache from AsyncStorage — paused mutations rehydrate against already-registered defaults), THEN network.ts (wires NetInfo + AppState + the onlineManager.subscribe(resumePausedMutations) block).

**Apply to:** All 5 new `setMutationDefaults` blocks MUST be registered at module top-level in `client.ts` (NOT inside a function or hook). This is RESEARCH §Pitfall 1 — module-load-order breakage drops paused set mutations.

### mutate-not-mutateAsync convention

**Source:** `app/app/(app)/plans/new.tsx` lines 26-39 (verbatim UAT comment):
> mutateAsync was used originally but it does NOT resolve while a mutation is paused — pressing "Skapa plan" in airplane mode left the button stuck on "Skapar plan…" forever (UAT regression). mutate + onError surfaces server-side errors when online; offline rollback is not needed because paused mutations don't error.

**Apply to:** ALL Phase 5 submit flows — `useStartSession.mutate`, `useFinishSession.mutate`, `useAddSet.mutate`, `useUpdateSet.mutate`, `useRemoveSet.mutate`. Pattern: `mutate(payload, { onError, onSuccess })`.

### Pitfall 8.13 — Zod parse boundary

**Source:** `app/lib/queries/plans.ts` line 47, line 77:
```typescript
return (data ?? []).map((row) => PlanRowSchema.parse(row));
```
**Apply to:** Every Supabase response in `sessions.ts`, `sets.ts`, `last-value.ts` MUST `.parse()` through the matching `*RowSchema` — NEVER cast as `Tables<'…'>`.

### Inline-overlay-confirm (NOT Modal portal)

**Source:** `app/app/(app)/plans/[id].tsx` lines 535-641 (archive-confirm). Pattern: full-screen `<Pressable>` backdrop with `position: 'absolute'` inset-0, centered child `<Pressable>` with `e.stopPropagation()`, explicit RN `StyleSheet` values (NOT NativeWind classes on layout primitives — see line 538-540 verbatim about NativeWind silently collapsing inside Modal portals).

**Apply to:** Avsluta-pass confirm + draft-resume modal on (tabs)/index.tsx.

### useFocusEffect reset under freezeOnBlur

**Source:** `app/app/(app)/plans/[id].tsx` lines 150-155 (verbatim):
```typescript
useFocusEffect(
  useCallback(() => {
    setShowOverflowMenu(false);
    setShowArchiveConfirm(false);
  }, []),
);
```
**Apply to:** Every screen with local overlay state — workout/[sessionId].tsx (Avsluta overlay, per-card edit-mode), (tabs)/index.tsx (draft-resume overlay).

### scope.id = static string (never function)

**Source:** `app/lib/query/client.ts` lines 137-166 — full scope.id contract block. TanStack v5 reads `mutation.options.scope?.id` and applies a `typeof === "string"` check; function-shape scope silently fails serial replay.

**Apply to:** All 5 new mutation hooks in `sessions.ts` + `sets.ts` MUST bake the scope at `useMutation()` call time via `scope: { id: 'session:<id>' }`, accepting the id as a hook parameter.

### Idempotent upsert with client-UUID

**Source:** `app/lib/queries/plans.ts` line 92, `plan-exercises.ts` line 354. Pattern: `randomUUID()` at call site (NEVER inside `mutationFn`), payload includes `id`, `mutationFn` calls `.upsert({...}, { onConflict: 'id', ignoreDuplicates: true })`.

**Apply to:** `useStartSession`, `useAddSet`.

### Banner slot-pattern in (tabs)/_layout

**Source:** `app/app/(app)/(tabs)/_layout.tsx` lines 31-38: `<SafeAreaView edges={['top']}>` wraps `<OfflineBanner />` directly above `<Tabs>`. Phase 5 adds `<ActiveSessionBanner />` as a sibling between OfflineBanner and Tabs (UI-SPEC line 485 + line 511).

### Stack.Screen headerRight per-screen opt-in

**Source:** `app/app/(app)/plans/[id].tsx` lines 252-270 (Pressable inside `headerRight: () =>`). Inherits `headerStyle`/`headerTintColor` from `app/app/(app)/_layout.tsx` lines 37-58 — no per-screen styling needed.

**Apply to:** workout/[sessionId].tsx Avsluta button.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `app/lib/queries/last-value.ts` (queryFn body) | 2-step PostgREST `!inner` join query | request-response with cross-table RLS scope | First instance of `!inner` embedded resource in the codebase. RESEARCH.md lines 666-718 is the canonical reference. Plan 02 verifies A3 (PostgREST `!inner` + RLS) via the `test-last-value-query.ts` cross-user assertion. |
| `app/scripts/test-last-value-query.ts` (query-correctness assertions) | DB-integration test for set-position-aligned shape | Node-only | No existing test combines RLS harness with query-shape correctness. Compose from `test-rls.ts` (harness) + `test-upsert-idempotency.ts` (DB-touching pattern). |
| Toast on (tabs)/index.tsx | Auto-dismissing UI affordance | one-shot | RESEARCH Open Q#3 — no existing toast pattern in codebase. UI-SPEC §Toast (lines 555-569) specifies Reanimated `Animated.View` with `entering={FadeIn}` + `exiting={FadeOut.delay(2000)}` triggered by router-state or Zustand flag. Plan 02 picks. |

---

## Metadata

**Analog search scope:**
- `app/lib/queries/` (all 3 files read fully)
- `app/lib/schemas/` (3 files read fully)
- `app/lib/query/` (all 4 files read fully)
- `app/lib/utils/uuid.ts` (read fully)
- `app/components/` (1 file, read fully)
- `app/app/_layout.tsx` (read fully)
- `app/app/(app)/_layout.tsx` (read fully)
- `app/app/(app)/(tabs)/_layout.tsx` (read fully)
- `app/app/(app)/(tabs)/index.tsx` (read fully)
- `app/app/(app)/plans/[id].tsx` (read fully — 759 LOC; the largest pattern source)
- `app/app/(app)/plans/new.tsx` (read fully)
- `app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx` (read fully — RHF z.input/z.output split source)
- `app/scripts/test-plan-schemas.ts` (read fully)
- `app/scripts/test-rls.ts` (head + tail read; Phase 4 extension block at lines 437-600 confirmed as the Phase 5 mirror target)
- `app/scripts/manual-test-phase-04-airplane-mode.md` (read fully)
- `app/supabase/migrations/0001_initial_schema.sql` (workout_sessions + exercise_sets DDL confirmed)

**Files scanned:** 16 source files + 1 SQL migration + 2 phase-context markdowns

**Pattern extraction date:** 2026-05-12

**Confidence:**
- Pattern reuse for sessions.ts/sets.ts/schemas: HIGH (exact Phase 4 analogs)
- Pattern reuse for client.ts/keys.ts: HIGH (literal extension)
- Pattern reuse for workout/[sessionId].tsx: HIGH (plans/[id].tsx is the master analog)
- Pattern reuse for last-value.ts: MEDIUM (no exact analog — RESEARCH.md is canonical)
- Pattern reuse for test-last-value-query.ts: MEDIUM (composed from two analogs)
