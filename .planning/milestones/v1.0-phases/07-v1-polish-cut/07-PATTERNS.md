# Phase 7: V1 Polish Cut — Pattern Map

**Mapped:** 2026-05-15
**Files analyzed:** 14 modifications across 13 distinct file paths (0 new files)
**Analogs found:** 14/14 (100% — every change anchored in an existing pattern in the same codebase)
**Note:** Skip-Research phase. All file paths and line ranges verified by reading the live source files.

---

## File Classification

All Phase 7 changes are **modifications to existing files**. Three categories:

| Modified File | Role | Data Flow | Closest Analog (in-file unless noted) | Match Quality |
|---------------|------|-----------|----------------------------------------|---------------|
| `app/lib/schemas/sets.ts` (extend `setFormSchema.rpe`) | schema | transform (Zod preprocess + validation) | `setFormSchema.weight_kg` (same file, lines 44-53) — the `z.preprocess` comma→period precedent | **exact** (same schema, same comma→period invariant, same numeric bound chain) |
| `app/lib/queries/sessions.ts` (extend `useFinishSession` payload type) | resource-hook (mutation wrapper) | request-response (Supabase UPDATE) | `useFinishSession` itself (current shape, lines 127-132) + `SessionFinishVars` decl line 39 | **exact** (one-line type extension) |
| `app/lib/queries/sessions.ts` (add `useUpdateSessionNotes(sessionId)`) | resource-hook (new mutation wrapper) | request-response (Supabase UPDATE) | `useFinishSession` (same file, lines 127-132) + `useDeleteSession` (same file, lines 245-250) | **exact** (same shape: variables-typed wrapper, scope.id `session:${id}`, mutationKey-only — Pitfall 8.1) |
| `app/lib/query/client.ts` (14th `setMutationDefaults(['session','update-notes'], ...)`) | mutation-defaults registration | request-response (optimistic UPDATE with rollback) | `['session','finish']` block in same file, lines 682-741 | **exact** (same target table, same optimistic shape on `sessionsKeys.detail(id)`, same retry:1, same onSettled invalidate) |
| `app/app/(app)/workout/[sessionId].tsx` inline-row RPE Controller (lines 476-554) | UI screen (form-row) | request-response (RHF Controller → mutate) | `weight_kg` + `reps` Controllers in the SAME inline-row (same file, lines 477-544) | **exact** (third sibling of an established two-sibling Controller pattern) |
| `app/app/(app)/workout/[sessionId].tsx` AvslutaOverlay notes TextInput (lines 806-917) | UI overlay (form-field add) | request-response (local state → finishSession.mutate payload) | AvslutaOverlay scaffold (same file, lines 806-917) + `Controller` TextInput shape from inline-row | **exact** (overlay scaffold is intact; surface area is "insert new TextInput + counter between body Text and button row") |
| `app/app/(app)/history/[sessionId].tsx` notes-block above SummaryHeader | UI screen (display + edit-affordance) | request-response (display) | overflow-menu Pressable + accent/muted color sourcing (same file, lines 108-111, 262-269) | **role-match** (the SHAPE is genuinely new but every primitive — `useColorScheme()` hex extraction, Ionicons + hitSlop Pressable, `bg-gray-100 dark:bg-gray-800 rounded-lg` shell — exists in the same file already) |
| `app/app/(app)/history/[sessionId].tsx` RPE-suffix on set-rows (lines 585-594) | UI screen (display) | display (string interpolation) | The set-row render itself (same file, lines 585-594) | **exact** (in-place text concat extension) |
| `app/app/(app)/history/[sessionId].tsx` edit-notes overlay | UI overlay (modal-equivalent) | request-response (local state → useUpdateSessionNotes.mutate) | delete-confirm overlay (same file, lines 417-516) — the **verbatim Phase 4 commit `e07029a` inline-overlay pattern** | **exact** (literal copy of overlay scaffold, swap inner body from delete-warning Text to TextInput + counter + Spara CTA) |
| `app/app/(app)/(tabs)/settings.tsx` Tema-section | UI screen (settings control) | event-driven (segment-change → setColorScheme + AsyncStorage write) | `(tabs)/settings.tsx` existing email + sign-out layout (same file, lines 27-52) + `SegmentedControl` consumer pattern (chart route — see "External Analog" below) | **role-match** (the settings.tsx file is mostly a placeholder; the SegmentedControl consumption pattern is owned by the chart route which already uses the same generic primitive twice) |
| `app/app/_layout.tsx` ThemeBootstrap component | UI/effect (cold-start side-effect) | event-driven (mount → AsyncStorage read → setColorScheme) | `SplashScreenController` in same file (lines 62-72) — `useAuthStore` state + `useEffect` + side-effect-before-splash-hides | **exact** (same module-load-order invariant, same effect-before-hide gating) |
| `app/app/_layout.tsx` dynamic StatusBar | UI/effect (root layout) | display (color-scheme reactive) | Existing `<StatusBar style="auto" />` (same file, line 156) + isDark computation already in scope (lines 84, 111-112) | **exact** (replace one prop value; isDark already computed in same render) |
| `app/app/_layout.tsx` + 9 others: `useColorScheme` import migration | mechanical refactor | n/a | Every one of the 10 files currently imports from `'react-native'`; **same hook shape** in `'nativewind'` per CLAUDE.md → drop-in rename | **exact** (API-compatible drop-in; 6 of 10 files even use the value for runtime hex selection per UI-SPEC §Color audit) |

---

## Pattern Assignments

### 1. `app/lib/schemas/sets.ts` — extend `setFormSchema.rpe`

**Role:** schema (transform + validation boundary)
**Data flow:** Zod preprocess → coerce → bounded number → nullable optional
**Analog:** `setFormSchema.weight_kg` (SAME FILE, lines 44-53)

**Imports pattern** (already in file, no new imports — line 36):
```typescript
import { z } from "zod";
```

**Core preprocess + bound pattern to copy** (lines 44-53 — the weight_kg precedent that D-R2/D-R3 mirrors verbatim):
```typescript
weight_kg: z.preprocess(
  // Plan 05-06 / FIT-9: Swedish-locale comma → JS-parsable period.
  // /g flag so "102,5,5" → "102.5.5" → NaN → schema rejects.
  (val) => (typeof val === "string" ? val.replace(/,/g, ".") : val),
  z
    .coerce.number({ error: "Vikt krävs" })
    .min(0, { error: "Vikt måste vara 0 eller högre" })
    .max(500, { error: "Vikt över 500kg verkar fel — kontrollera" })
    .multipleOf(0.25, { error: "Vikt i steg om 0.25kg" }),
),
```

**Current RPE shape to extend** (line 62-63):
```typescript
// F11 schema-ready (Phase 7 wires UI). rpe is numeric(3,1) in the DB.
rpe: z.coerce.number().nullable().optional(),
```

**Target shape for Phase 7** (D-R2 + D-R3 combined — empty-string-and-comma preprocess + min/max bounds + retained `.nullable().optional()`):
```typescript
rpe: z.preprocess(
  (v) => {
    if (typeof v !== "string") return v;
    const trimmed = v.trim();
    if (trimmed === "") return null;   // empty → null (D-R3, D-R4 valfri)
    return trimmed.replace(/,/g, ".");  // comma → period (D-R3, weight_kg precedent)
  },
  z
    .coerce.number()
    .min(0, { error: "RPE 0 eller högre" })
    .max(10, { error: "RPE 10 eller lägre" })
    .nullable()
    .optional(),
),
```

**Landmines:**
- `setFormSchema` already uses `useForm<SetFormInput, undefined, SetFormOutput>` 3-generic shape (`workout/[sessionId].tsx` line 353). The Zod-input vs Zod-output split MUST be preserved — do NOT change `setFormSchema`'s `SetFormInput`/`SetFormOutput` export names (lines 74-75).
- **Do NOT add `.multipleOf(0.5)`** even though Strong/Hevy use 0.5 steps. SPEC §1 acceptance (d) explicitly accepts decimaler; CONTEXT.md Deferred Ideas explicitly defers `multipleOf(0.5)` to V1.1.
- The DB column is `numeric(3,1)` — server will silently truncate `8.55` to `8.5`. Phase 7 SPEC accepts this (no client `multipleOf(0.1)`); document the trade-off but don't add the guard.

---

### 2. `app/lib/queries/sessions.ts` — extend `useFinishSession` payload + add `useUpdateSessionNotes`

**Role:** resource-hook (variables-typed mutation wrapper, Pitfall 8.1 conformance)
**Data flow:** request-response (Supabase UPDATE on `workout_sessions`)
**Analog (extend `useFinishSession`):** SAME hook in same file, lines 39 + 127-132
**Analog (add `useUpdateSessionNotes`):** `useFinishSession` (lines 127-132) + `useDeleteSession` (lines 245-250) — both in the same file

**Imports pattern** (already in file, no new imports — lines 23-29):
```typescript
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/query/client";
import { sessionsKeys } from "@/lib/query/keys";
import { SessionRowSchema, type SessionRow } from "@/lib/schemas/sessions";
import { useAuthStore } from "@/lib/auth-store";
```

**Existing `SessionFinishVars` and `useFinishSession`** (lines 39, 127-132 — verbatim):
```typescript
type SessionFinishVars = { id: string; finished_at: string };

// useFinishSession — UPDATE finished_at. Plan 01's setMutationDefaults for
// ['session','finish'] invalidates lastValueKeys.all on onSettled so a
// back-to-back session's F7 chips surface within milliseconds (Open Q#2).
export function useFinishSession(sessionId?: string) {
  return useMutation<SessionRow, Error, SessionFinishVars>({
    mutationKey: ["session", "finish"] as const,
    scope: sessionId ? { id: `session:${sessionId}` } : undefined,
  });
}
```

**Extension for D-N3** (one-line widen on the type alias):
```typescript
type SessionFinishVars = { id: string; finished_at: string; notes?: string | null };
```
(The hook body itself does not change — it stays a Pitfall 8.1 mutationKey-only wrapper. The `notes` field flows through to `['session','finish']` mutationFn in `lib/query/client.ts` block 10, where the UPDATE statement and onMutate-optimistic must be amended — see analog 4 below.)

**`useDeleteSession` (lines 245-250) — the structural sibling for `useUpdateSessionNotes`:**
```typescript
type SessionDeleteVars = { id: string };

export function useDeleteSession(sessionId?: string) {
  return useMutation<void, Error, SessionDeleteVars>({
    mutationKey: ["session", "delete"] as const,
    scope: sessionId ? { id: `session:${sessionId}` } : undefined,
  });
}
```

**New `useUpdateSessionNotes` (D-E3) — copy `useDeleteSession` shape, swap return type + vars + mutationKey:**
```typescript
type SessionUpdateNotesVars = { id: string; notes: string | null };

export function useUpdateSessionNotes(sessionId?: string) {
  return useMutation<SessionRow, Error, SessionUpdateNotesVars>({
    mutationKey: ["session", "update-notes"] as const,
    scope: sessionId ? { id: `session:${sessionId}` } : undefined,
  });
}
```

**Landmines:**
- `scope.id` is a **static string** at `useMutation()` time (Pitfall 3 — function-shaped scope.id silently fails the `typeof === "string"` gate in v5 `mutationCache.scopeFor`). The optional `sessionId` parameter pattern is the established workaround: hook accepts the id at construction, bakes it into the scope.
- `mutationKey: [...] as const` — the `as const` is non-optional. TanStack v5's setMutationDefaults registry uses structural equality on the literal tuple; without `as const`, TS widens to `string[]` and `setMutationDefaults` matching fails at runtime.
- Vars MUST be `Partial<SessionRow>`-compatible for the mutationFn payload — but here we intentionally keep `SessionUpdateNotesVars` narrow (`{ id; notes }`) because the UPDATE statement only touches the notes column. The type alias for this hook lives at the top of the file (lines 33-39 region) per the same-file convention used by every other hook in this file.

---

### 3. `app/lib/query/client.ts` — 14th `setMutationDefaults(['session','update-notes'], ...)` + amend `['session','finish']` notes-write

**Role:** mutation-defaults registration (module-scope side-effect, Pitfall 8.5)
**Data flow:** request-response (Supabase UPDATE with optimistic onMutate + rollback)
**Analog:** `['session','finish']` block in SAME FILE, lines 682-741. Also useful: `['session','delete']` block 14 (lines 973-1045) for the onMutate cancelQueries pattern.

**Imports already present** (lines 32-62 — no additions needed; both `SessionRowSchema` and `sessionsKeys` already imported):
```typescript
import { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
// ... PlanRowSchema, ExerciseRowSchema, PlanExerciseRowSchema ...
import { SessionRowSchema, type SessionRow } from "@/lib/schemas/sessions";
import { SetRowSchema, type SetRow } from "@/lib/schemas/sets";
import {
  plansKeys, exercisesKeys, planExercisesKeys,
  sessionsKeys, setsKeys, lastValueKeys,
} from "@/lib/query/keys";
```

**Existing `['session','finish']` block — the optimistic-update + finish-side-effect template** (lines 682-741):
```typescript
queryClient.setMutationDefaults(["session", "finish"], {
  mutationFn: async (vars: SessionFinishVars) => {
    const { id, finished_at } = vars;
    const { data, error } = await supabase
      .from("workout_sessions")
      .update({ finished_at })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return SessionRowSchema.parse(data);
  },
  onMutate: async (vars: SessionFinishVars) => {
    await queryClient.cancelQueries({ queryKey: sessionsKeys.active() });
    await queryClient.cancelQueries({ queryKey: sessionsKeys.detail(vars.id) });
    const previousActive = queryClient.getQueryData<SessionRow | null>(
      sessionsKeys.active(),
    );
    const previousDetail = queryClient.getQueryData<SessionRow>(
      sessionsKeys.detail(vars.id),
    );
    if (previousActive && previousActive.id === vars.id) {
      queryClient.setQueryData<SessionRow | null>(sessionsKeys.active(), null);
    }
    if (previousDetail) {
      queryClient.setQueryData<SessionRow>(sessionsKeys.detail(vars.id), {
        ...previousDetail,
        finished_at: vars.finished_at,
      });
    }
    return { previousActive, previousDetail };
  },
  onError: (_err, vars, ctx) => {
    const c = ctx as
      | { previousActive?: SessionRow | null; previousDetail?: SessionRow }
      | undefined;
    if (c?.previousActive !== undefined)
      queryClient.setQueryData(sessionsKeys.active(), c.previousActive);
    if (c?.previousDetail)
      queryClient.setQueryData(sessionsKeys.detail(vars.id), c.previousDetail);
  },
  onSettled: (_d, _e, vars) => {
    void queryClient.invalidateQueries({ queryKey: sessionsKeys.active() });
    void queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(vars.id) });
    void queryClient.invalidateQueries({ queryKey: lastValueKeys.all });
    void queryClient.invalidateQueries({ queryKey: sessionsKeys.listInfinite() });
  },
  retry: 1,
});
```

**Two diffs needed in this file:**

**Diff A — amend `['session','finish']` to accept + persist `notes`** (D-N3):

1. Widen the type alias at line 143:
```typescript
type SessionFinishVars = { id: string; finished_at: string; notes?: string | null };
```
2. Inside the mutationFn UPDATE call (line 687 region), add `notes`-normalization + include in the `.update(...)`:
```typescript
const { id, finished_at, notes } = vars;
const finalNotes = notes?.trim() ? notes.trim() : null;
const { data, error } = await supabase
  .from("workout_sessions")
  .update({ finished_at, notes: finalNotes })
  .eq("id", id)
  ...
```
3. In `onMutate` (line ~709), also write the optimistic `notes` into the detail cache:
```typescript
if (previousDetail) {
  queryClient.setQueryData<SessionRow>(sessionsKeys.detail(vars.id), {
    ...previousDetail,
    finished_at: vars.finished_at,
    notes: vars.notes?.trim() ? vars.notes.trim() : (previousDetail.notes ?? null),
  });
}
```
4. The active-cache (line 705-707) only clears `previousActive` — leave that branch unchanged; `notes` does not live on the active-banner shape.

**Diff B — add block 15 `['session','update-notes']`** (D-E3) — copy the `['session','finish']` block shape verbatim, swap UPDATE column + invalidate set:

```typescript
// ===========================================================================
// 15) ['session','update-notes'] — workout_sessions UPDATE notes only.
// Optimistic onMutate writes the notes into sessionsKeys.detail(id) so the
// history-detail notes-block re-renders before the server-trip completes.
// onSettled additionally invalidates sessionsKeys.listInfinite() because
// V1.1 may surface a notes-snippet on list rows; the invalidate keeps the
// cache uniform regardless. retry: 1 — Pitfall 5.4.
// scope.id = `session:${id}` at the call-site (lib/queries/sessions.ts
// useUpdateSessionNotes) so it serializes after any in-flight ['session','finish']
// or ['session','delete'] under the same session scope.
// ===========================================================================

type SessionUpdateNotesVars = { id: string; notes: string | null };

queryClient.setMutationDefaults(["session", "update-notes"], {
  mutationFn: async (vars: SessionUpdateNotesVars) => {
    const finalNotes = vars.notes?.trim() ? vars.notes.trim() : null;
    const { data, error } = await supabase
      .from("workout_sessions")
      .update({ notes: finalNotes })
      .eq("id", vars.id)
      .select()
      .single();
    if (error) throw error;
    return SessionRowSchema.parse(data);
  },
  onMutate: async (vars: SessionUpdateNotesVars) => {
    await queryClient.cancelQueries({ queryKey: sessionsKeys.detail(vars.id) });
    const previousDetail = queryClient.getQueryData<SessionRow>(
      sessionsKeys.detail(vars.id),
    );
    if (previousDetail) {
      const finalNotes = vars.notes?.trim() ? vars.notes.trim() : null;
      queryClient.setQueryData<SessionRow>(sessionsKeys.detail(vars.id), {
        ...previousDetail,
        notes: finalNotes,
      });
    }
    return { previousDetail };
  },
  onError: (_err, vars, ctx) => {
    const c = ctx as { previousDetail?: SessionRow } | undefined;
    if (c?.previousDetail)
      queryClient.setQueryData(sessionsKeys.detail(vars.id), c.previousDetail);
  },
  onSettled: (_d, _e, vars) => {
    void queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(vars.id) });
    void queryClient.invalidateQueries({ queryKey: sessionsKeys.listInfinite() });
  },
  retry: 1,
});
```

**Landmines:**
- **Module-load order (Pitfall 8.5 + Pitfall 8.12):** The new block MUST register at module top-level (NOT inside a function). If a paused `['session','update-notes']` is rehydrated from AsyncStorage before block 15 registers, the mutationFn reference is lost and the mutation silently never replays — D-E3 lock specifically calls out "module-load-invariant gäller". Place block 15 after block 14 (line ~1046), with all imports already at file-top.
- **Trim normalization MUST happen in mutationFn AND onMutate** — both write to the same `notes` field; an empty-string-saved overlay must produce `notes: null` in both the optimistic cache write and the persisted UPDATE.
- **`cancelQueries` is non-optional** — without it, a concurrent useSessionQuery refetch can race with the optimistic setQueryData and overwrite the optimistic value. The `['session','finish']` block calls cancelQueries on both active() and detail(); the new block only needs detail() (notes don't surface on active-banner).
- **Type alias `SessionUpdateNotesVars` MUST be declared at the file's Phase 5/6 type-alias band** (lines 132-169 region) — NOT inline. The other 14 blocks all declare their `*Vars` type at the top, near their family of types.

---

### 4. `app/app/(app)/workout/[sessionId].tsx` — RPE inline-row Controller + AvslutaOverlay notes TextInput

#### 4a. Inline RPE Controller (D-R1 + D-R4)

**Role:** UI screen (RHF inline-row form field)
**Data flow:** request-response (Controller → form-state → handleSubmit → addSet.mutate)
**Analog:** the `weight_kg` and `reps` Controllers in the SAME inline-row (lines 477-544)

**Form setup already in scope** (lines 348-361 — `useForm` 3-generic with rpe already in `setFormSchema`, so no defaults change needed; the new field key `rpe` is already in the schema):
```typescript
const {
  control,
  handleSubmit,
  reset,
  formState: { errors, isSubmitting },
} = useForm<SetFormInput, undefined, SetFormOutput>({
  resolver: zodResolver(setFormSchema),
  mode: "onSubmit",
  defaultValues: {
    weight_kg: prefillWeight ?? undefined,
    reps: prefillReps ?? undefined,
    set_type: "working",
  },
});
```

**Inline-row scaffold to extend** (lines 476-554):
```tsx
{/* Always-visible inline set-input row */}
<View className="flex-row items-center gap-2 mt-3">
  <Controller
    control={control}
    name="weight_kg"
    render={({ field: { onChange, value }, fieldState: { error } }) => (
      <View className="flex-1">
        <TextInput
          value={value == null ? "" : String(value)}
          onChangeText={onChange}
          placeholder="Vikt"
          placeholderTextColor="#9CA3AF"
          keyboardType="decimal-pad"
          inputMode="decimal"
          returnKeyType="done"
          autoCorrect={false}
          autoCapitalize="none"
          selectTextOnFocus={true}
          accessibilityLabel="Vikt i kilo"
          className={`rounded-md bg-white dark:bg-gray-900 border px-3 py-3 text-base font-semibold text-gray-900 dark:text-gray-50 min-h-[56px] ${
            error
              ? "border-red-600 dark:border-red-400"
              : "border-gray-300 dark:border-gray-700"
          } focus:border-blue-600 dark:focus:border-blue-500`}
        />
        {error && (
          <Text
            className="text-base text-red-600 dark:text-red-400 mt-1 px-1"
            accessibilityLiveRegion="polite"
          >
            {error.message}
          </Text>
        )}
      </View>
    )}
  />
  {/* … Reps Controller is identical-structure, swap name="reps", placeholder="Reps", keyboardType="number-pad" … */}
  <Pressable
    onPress={handleSubmit(onKlart)}
    disabled={isSubmitting}
    accessibilityRole="button"
    accessibilityLabel="Spara set"
    className="w-20 min-h-[56px] rounded-md bg-blue-600 dark:bg-blue-500 items-center justify-center disabled:opacity-60 active:opacity-80"
  >
    <Text className="text-base font-semibold text-white">Klart</Text>
  </Pressable>
</View>
```

**Insert RPE Controller as a third sibling between Reps and Klart** (D-R1) — copy weight_kg structure, swap to fixed-width `w-16`, decimal-pad, `text-center`, maxLength 4, accessibilityLabel "Upplevd ansträngning, valfri":
```tsx
<Controller
  control={control}
  name="rpe"
  render={({ field: { onChange, value }, fieldState: { error } }) => (
    <View className="w-16">
      <TextInput
        value={value == null ? "" : String(value)}
        onChangeText={onChange}
        placeholder="RPE"
        placeholderTextColor="#9CA3AF"
        keyboardType="decimal-pad"
        inputMode="decimal"
        returnKeyType="done"
        autoCorrect={false}
        autoCapitalize="none"
        selectTextOnFocus
        accessibilityLabel="Upplevd ansträngning, valfri"
        maxLength={4}
        className={`rounded-md bg-white dark:bg-gray-900 border px-2 py-3 text-base font-semibold text-gray-900 dark:text-gray-50 min-h-[56px] text-center ${
          error
            ? "border-red-600 dark:border-red-400"
            : "border-gray-300 dark:border-gray-700"
        } focus:border-blue-600 dark:focus:border-blue-500`}
      />
      {error && (
        <Text
          className="text-base text-red-600 dark:text-red-400 mt-1 px-1"
          accessibilityLiveRegion="polite"
        >
          {error.message}
        </Text>
      )}
    </View>
  )}
/>
```

**Klart-button shrink** (D-R1): change `className="w-20 min-h-[56px] ..."` to `className="w-16 min-h-[56px] ..."` (line 550).

**Wire RPE into addSet.mutate payload** (lines 380-389 region — `onKlart` handler):
```typescript
addSet.mutate(
  {
    id: randomUUID(),
    session_id: sessionId,
    exercise_id: planExercise.exercise_id,
    weight_kg: input.weight_kg,
    reps: input.reps,
    rpe: input.rpe ?? null,   // ADD THIS LINE — input.rpe is already typed as number|null|undefined from SetFormOutput
    completed_at: new Date().toISOString(),
    set_type: "working",
  },
  { ... },
);
```
**Also extend `reset({...})`** (lines 397-401 + 366-372 useEffect re-hydrate) — preserve rpe pre-fill behavior; default to `undefined` so the placeholder shows for the next set (D-N4 "Re-open of overlay after cancel = fresh empty state" precedent applies here — Phase 7 deliberately does NOT pre-fill RPE from prior set because soaking the same RPE is a poor default; default to undefined).

**Landmines:**
- The form is built with `useForm<SetFormInput, undefined, SetFormOutput>` (line 353). After D-R2/D-R3 stretch, `SetFormOutput.rpe` becomes `number | null | undefined`. The Controller's `value == null ? "" : String(value)` already handles both null and undefined safely (line 483 precedent).
- **iPhone SE width math** (UI-SPEC §A): 320pt content − 16pt padding × 2 = 288pt − 8pt gap × 3 = 264pt for inputs. Vikt + Reps stay `flex-1` and absorb (264−64−64)/2 = 68pt each. Vikt fits 3-digit weights at `text-base font-semibold` + `px-3`. Tested precedent: Phase 5 already rendered the 3-input row at this density on SE.
- **Inline-error stacking** — wrap RPE in `<View className="w-16">` (NOT bare TextInput) so the error stacks below the input within the column. Matches weight_kg/reps sibling pattern verbatim. Outer flex-row `items-center` keeps non-erroring siblings vertically centered when one column grows taller.
- **Empty input must produce `null`, not `undefined`** — D-R3 preprocess handles this server-bound; the Controller value-stringification handles UI display. The `?? null` in addSet payload is the safety net at the call site.
- **DO NOT use `z.coerce.number()` 3-arg signature `z.coerce.number({ error: "..." }, "...")`** — Plan 04-03 metric showed this Zod 3 → 4 footgun produced confusing TS errors when the second positional was a message. Stick to the chain-message `.min(0, { error: "..." })` style.

#### 4b. AvslutaOverlay notes TextInput (D-N1 + D-N2 + D-N3 + D-N4)

**Role:** UI overlay (form-field add)
**Data flow:** request-response (local state → finishSession.mutate payload)
**Analog:** AvslutaOverlay scaffold itself (lines 806-917) + the multi-line TextInput shape from form-shape conventions

**Existing scaffold to extend** (lines 806-917 — see "Existing AvslutaOverlay" excerpt in the Read above): Backdrop Pressable → maxWidth 400 wrapper Pressable with `stopPropagation` → inner card `bg-gray-100 dark:bg-gray-800 rounded-2xl p-6` with `gap:16`. The card currently has:
1. `<View style={{ gap: 8 }}>` with title `<Text>` (text-2xl font-semibold) + body `<Text>`
2. `<View className="flex-row gap-3">` with Fortsätt + Avsluta buttons

**Per D-N1: wrap the inner wrapper Pressable in `<KeyboardAvoidingView>`** so iOS keyboard doesn't cover the buttons:
```tsx
<Pressable style={{ position: "absolute", ... }} onPress={onCancel} ...>
  <KeyboardAvoidingView
    behavior={Platform.OS === "ios" ? "padding" : "height"}
    style={{ width: "100%", maxWidth: 400, paddingHorizontal: 32 }}
  >
    <Pressable
      style={{ width: "100%" }}
      onPress={(e) => e.stopPropagation()}
    >
      <View className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-6" style={{ gap: 16 }}>
        {/* … title + body unchanged … */}
        {/* … INSERT notes TextInput + counter HERE … */}
        {/* … existing flex-row gap-3 button row … */}
      </View>
    </Pressable>
  </KeyboardAvoidingView>
</Pressable>
```

**Per D-N2 — TextInput shape** (insert between body Text and button row, before the closing `</View>` of the inner card):
```tsx
<TextInput
  value={notes}
  onChangeText={setNotes}
  placeholder="Anteckningar (valfri)"
  placeholderTextColor="#9CA3AF"
  multiline
  numberOfLines={3}
  maxLength={500}
  style={{ minHeight: 80, maxHeight: 160 }}
  textAlignVertical="top"
  accessibilityLabel="Anteckningar för passet, valfri"
  className="rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 px-3 py-2 text-base text-gray-900 dark:text-gray-50"
/>
<Text
  className={`text-sm text-right ${notes.length > 480 ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400"}`}
>
  {`${notes.length}/500`}
</Text>
```

**Local state inside AvslutaOverlay (D-N4)** — add at the top of the component body:
```typescript
const [notes, setNotes] = useState<string>("");
```

**Wire into `handleConfirm`** (D-N3 — line 827-841 region):
```typescript
const handleConfirm = () => {
  finishSession.mutate(
    {
      id: sessionId,
      finished_at: new Date().toISOString(),
      notes,            // ADD — empty/whitespace normalization happens in client.ts mutationFn
    },
    { /* no onError override */ },
  );
  onFinish();
};
```

**State reset on blur (D-N4)** — extend the existing parent `useFocusEffect` (lines 118-124):
- **Option A (planner discretion):** keep state inside AvslutaOverlay component, reset via `useEffect(() => () => setNotes(""), [])` — fires only when the overlay component unmounts (i.e. when `showAvslutaOverlay` flips to false). Simpler, no cross-component coupling.
- **Option B:** lift `notes` state to the parent WorkoutScreen alongside `showAvslutaOverlay`, reset in the existing `useFocusEffect` cleanup. Pattern-symmetric with how `showAvslutaOverlay` itself is reset.

Either is correct per CONTEXT.md Claude's Discretion.

**Landmines:**
- **KeyboardAvoidingView positioning:** the existing AvslutaOverlay uses absolute-position styling on the outer Pressable (lines 853-864). KeyboardAvoidingView needs `style={{ width: "100%", maxWidth: 400 }}` and the inner wrapper Pressable needs `width: "100%"` (NOT maxWidth) so the layout stays centered. Behavior `"padding"` on iOS shifts the card up; `"height"` on Android shrinks the avoidance region — Platform.OS check is non-optional.
- **`e.stopPropagation()` chain:** the existing pattern relies on a 2-level Pressable nest (line 869-874). Adding KeyboardAvoidingView in the middle does NOT break stopPropagation as long as the inner Pressable still owns the stopPropagation handler — KeyboardAvoidingView is a layout primitive, not a touch consumer.
- **`maxLength={500}` is the hard client gate** — the server-side `setFormSchema.notes`/`sessionFormSchema.notes` `.max(500)` is defense-in-depth. The counter color flip at `> 480` is a soft warning before the hard limit.
- **Modal portal is NOT allowed** (PITFALLS §6.6 + workout/[sessionId].tsx lines 793-797 — "NativeWind/flex layout inside Modal portal silently collapsed"). Phase 7 inherits this constraint: every overlay is inline Pressable + absolute-position scrim, never `<Modal>`.

---

### 5. `app/app/(app)/history/[sessionId].tsx` — notes-block + RPE-suffix + edit-overlay

#### 5a. RPE-suffix on set-rows (D-2 / SPEC §2)

**Role:** UI screen (text display)
**Data flow:** display (template string concat)
**Analog:** the set-row render itself (SAME file, lines 585-594)

**Current set-row** (lines 585-594 — verbatim):
```tsx
{sets.map((set) => (
  <View key={set.id} className="flex-row items-baseline">
    <Text className="text-base text-gray-500 dark:text-gray-400">
      {`Set ${set.set_number}: `}
    </Text>
    <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">
      {`${set.weight_kg} × ${set.reps}`}
    </Text>
  </View>
))}
```

**Target — append RPE-suffix when `set.rpe != null`** (UI-SPEC §Copy "F11 — RPE-suffix"):
```tsx
{sets.map((set) => (
  <View key={set.id} className="flex-row items-baseline">
    <Text className="text-base text-gray-500 dark:text-gray-400">
      {`Set ${set.set_number}: `}
    </Text>
    <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">
      {`${set.weight_kg} × ${set.reps}`}
    </Text>
    {set.rpe != null && (
      <Text className="text-base text-gray-500 dark:text-gray-400">
        {` · RPE ${set.rpe}`}
      </Text>
    )}
  </View>
))}
```

**Landmines:**
- `set.rpe` is `number | null` per `SetRowSchema.rpe = z.number().nullable()` (sets.ts line 100). `!= null` (loose equality) catches both null and undefined — safer than `!== null` if a future schema variation makes rpe optional. Matches the existing `value == null` precedent in the workout-screen Controller.
- `String(set.rpe)` is the right format — JS stringifies `8` as `"8"`, `8.5` as `"8.5"`, never `"8.0"` or `"8.50"` (UI-SPEC §F11 RPE-suffix explicit decision). The leading `·` is U+00B7 middle-dot (not a regular bullet), with one space on each side.
- The `items-baseline` on the parent row is load-bearing — the RPE Text must inherit `text-base` so the baseline aligns across all three Text nodes.

#### 5b. Notes-block above SummaryHeader (D-E4 / SPEC §4)

**Role:** UI screen (display + edit-affordance)
**Data flow:** request-response (display + tap-to-edit-handoff)
**Analog:** the muted/accent color sourcing pattern (same file, lines 108-111) + Ionicons-Pressable with hitSlop (lines 262-269) + `bg-gray-100 dark:bg-gray-800 rounded-lg` shell (used throughout same file)

**Color sourcing already in scope** (lines 108-111 — `useColorScheme` will migrate to `'nativewind'` per D-T4 but the call shape is identical):
```typescript
const scheme = useColorScheme();
const isDark = scheme === "dark";
const muted = isDark ? "#9CA3AF" : "#6B7280";
const accent = isDark ? "#60A5FA" : "#2563EB";
```

**Existing Ionicons-Pressable with hitSlop precedent** (lines 259-269 — the ellipsis-overflow Pressable in headerRight):
```tsx
<Pressable
  onPress={() => setShowOverflowMenu(true)}
  accessibilityRole="button"
  accessibilityLabel="Pass-menyn"
  hitSlop={8}
  className="px-2 py-1"
>
  <Ionicons name="ellipsis-horizontal" size={24} color={muted} />
</Pressable>
```

**Target notes-block** (insert ABOVE the SummaryHeader chip-row at line 307 — within the same `<View className="gap-6">` parent at line 279, as the first child before the `bannerError` block):

```tsx
<View className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3 flex-row items-start gap-2">
  {session.notes ? (
    <>
      <Text className="flex-1 text-base text-gray-900 dark:text-gray-50">
        {session.notes}
      </Text>
      <Pressable
        onPress={() => setShowEditNotesOverlay(true)}
        accessibilityRole="button"
        accessibilityLabel="Redigera anteckning"
        hitSlop={8}
      >
        <Ionicons name="pencil-outline" size={18} color={muted} />
      </Pressable>
    </>
  ) : (
    <Pressable
      onPress={() => setShowEditNotesOverlay(true)}
      accessibilityRole="button"
      accessibilityLabel="Lägg till anteckning"
      hitSlop={8}
      className="flex-row items-center gap-2 flex-1"
    >
      <Ionicons name="add-circle-outline" size={18} color={accent} />
      <Text className="text-base text-gray-500 dark:text-gray-400">
        Lägg till anteckning
      </Text>
    </Pressable>
  )}
</View>
```

**Landmines:**
- **Position is "above SummaryHeader chiparna"** per SPEC §4 + UI-SPEC §B. The natural insertion point is inside `<View className="gap-6">` at line 279, between line 304 (closing `bannerError`-conditional) and line 307 (opening SummaryHeader chip-row). The `gap-6` parent absorbs the spacing naturally — no `mt-2`/`mx-4` overrides needed (UI-SPEC mentions `mx-4 mt-2` but those are inherited from the parent ScrollView's `paddingHorizontal: 16` + the `gap-6` between siblings, so they are NOT applied directly on this View).
- **Pencil vs add-circle icon discriminator:** SPEC §4 acceptance (a) and (b) — when `notes !== null` show text + pencil; when `notes === null` show plus-icon + label. Both Pressables call `setShowEditNotesOverlay(true)`. The `+` icon uses `color={accent}`, the pencil uses `color={muted}` (UI-SPEC §Color "Accent must NOT be used for: pencil-icon tint…" + §"New Phase 7 additions: Add-anteckning + icon tint…").
- **`hitSlop={8}` is non-optional** — the icon is 18pt, well below the 44pt floor; hitSlop guarantees ≥34pt visible + 16pt slop = ~50pt effective.

#### 5c. Edit-notes overlay (D-E2 / SPEC §4 acceptance b)

**Role:** UI overlay (modal-equivalent inline-overlay)
**Data flow:** request-response (local draft state → useUpdateSessionNotes.mutate)
**Analog:** the **delete-confirm overlay in the SAME file** (lines 417-516) — verbatim Phase 4 commit `e07029a` inline-overlay-pattern

**Existing delete-confirm overlay** (lines 417-516 — verbatim copy of the structural template):
```tsx
{showDeleteConfirm && (
  <Pressable
    style={{
      position: "absolute",
      top: 0, left: 0, right: 0, bottom: 0,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.5)",
      paddingHorizontal: 32,
      zIndex: 2000,
    }}
    onPress={() => setShowDeleteConfirm(false)}
    accessibilityRole="button"
    accessibilityLabel="Stäng dialog"
  >
    <Pressable
      style={{
        width: "100%",
        maxWidth: 400,
        backgroundColor: isDark ? "#1F2937" : "#FFFFFF",
        borderRadius: 12,
        padding: 24,
        gap: 16,
      }}
      onPress={(e) => e.stopPropagation()}
    >
      <Text style={{ fontSize: 18, fontWeight: "600", color: isDark ? "#F9FAFB" : "#111827" }}
            accessibilityRole="header">
        Ta bort detta pass?
      </Text>
      <Text style={{ fontSize: 16, color: isDark ? "#9CA3AF" : "#6B7280" }}>
        {`${setCount} set och ${formatNumber(totalVolumeKg)} kg total volym försvinner permanent. Det går inte att ångra.`}
      </Text>
      <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
        <Pressable onPress={() => setShowDeleteConfirm(false)} accessibilityRole="button" accessibilityLabel="Avbryt"
                   style={{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: isDark ? "#F9FAFB" : "#111827" }}>Avbryt</Text>
        </Pressable>
        <Pressable onPress={onDeleteConfirm} accessibilityRole="button" accessibilityLabel="Ta bort pass"
                   style={{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8,
                            backgroundColor: isDark ? "#EF4444" : "#DC2626" }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}>Ta bort</Text>
        </Pressable>
      </View>
    </Pressable>
  </Pressable>
)}
```

**Target edit-notes overlay** — copy the scaffold verbatim, swap inner body for TextInput + counter, swap Ta bort-button for Spara-button (UI-SPEC §C):

```tsx
{showEditNotesOverlay && (
  <Pressable
    style={{
      position: "absolute",
      top: 0, left: 0, right: 0, bottom: 0,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.5)",
      paddingHorizontal: 32,
      zIndex: 2000,
    }}
    onPress={() => setShowEditNotesOverlay(false)}
    accessibilityRole="button"
    accessibilityLabel="Stäng dialog"
  >
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ width: "100%", maxWidth: 400 }}
    >
      <Pressable onPress={(e) => e.stopPropagation()}>
        <View className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-6" style={{ gap: 16 }}>
          <Text className="text-2xl font-semibold text-gray-900 dark:text-gray-50"
                accessibilityRole="header">
            Redigera anteckning
          </Text>
          <TextInput
            value={draftNotes}
            onChangeText={setDraftNotes}
            placeholder="Anteckningar (valfri)"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            maxLength={500}
            style={{ minHeight: 80, maxHeight: 160 }}
            textAlignVertical="top"
            autoFocus
            accessibilityLabel="Anteckningar för passet, valfri"
            className="rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 px-3 py-2 text-base text-gray-900 dark:text-gray-50"
          />
          <Text
            className={`text-sm text-right ${draftNotes.length > 480 ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400"}`}
          >
            {`${draftNotes.length}/500`}
          </Text>
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => setShowEditNotesOverlay(false)}
              accessibilityRole="button"
              accessibilityLabel="Avbryt"
              className="flex-1 py-4 rounded-md bg-gray-200 dark:bg-gray-700 items-center justify-center active:opacity-80"
            >
              <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">Avbryt</Text>
            </Pressable>
            <Pressable
              onPress={onSaveNotes}
              accessibilityRole="button"
              accessibilityLabel="Spara anteckning"
              className="flex-1 py-4 rounded-md bg-blue-600 dark:bg-blue-500 items-center justify-center active:opacity-80"
            >
              <Text className="text-base font-semibold text-white">Spara</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </KeyboardAvoidingView>
  </Pressable>
)}
```

**Wire `useUpdateSessionNotes` + handlers** — at the top of `SessionDetailScreen` (after line 116 `useDeleteSession`):
```typescript
const updateNotes = useUpdateSessionNotes(sessionId);
const [showEditNotesOverlay, setShowEditNotesOverlay] = useState(false);
const [draftNotes, setDraftNotes] = useState("");

// Open-overlay handler — seed draftNotes from current session.notes
const openEditNotes = useCallback(() => {
  setDraftNotes(session?.notes ?? "");
  setShowEditNotesOverlay(true);
}, [session?.notes]);

const onSaveNotes = useCallback(() => {
  setShowEditNotesOverlay(false);
  updateNotes.mutate(
    { id: session.id, notes: draftNotes },
    { onError: () => setBannerError("Kunde inte spara anteckningen. Försök igen.") },
  );
}, [draftNotes, session?.id, updateNotes]);
```

**Update the existing useFocusEffect cleanup** (lines 130-137) to also reset the new overlay state:
```typescript
useFocusEffect(
  useCallback(() => {
    return () => {
      setShowOverflowMenu(false);
      setShowDeleteConfirm(false);
      setShowEditNotesOverlay(false);    // ADD
      setDraftNotes("");                  // ADD (per Phase 4 D-N4 pattern)
    };
  }, []),
);
```

**Landmines:**
- **Phase 4 commit `e07029a` is the source of truth, not a fresh Modal portal.** The delete-confirm scaffold is the verbatim template — `position: "absolute"` + `zIndex: 2000` + `rgba(0,0,0,0.5)` backdrop + 2-level Pressable nest with stopPropagation. Any deviation (e.g. using `<Modal>` for keyboard handling) WILL regress to the bug Phase 4 documented (NativeWind/flex layout silently collapsing inside Modal portals — UAT 2026-05-10).
- **`autoFocus` mount-timing risk:** CONTEXT.md Claude's Discretion calls this out. iOS sometimes mounts the keyboard before the KeyboardAvoidingView has finished positioning, producing a brief jump. If observed during plan-04 testing, fall back to `autoFocus={false}` + `useEffect(() => inputRef.current?.focus(), [])` triggered post-mount.
- **Two `useColorScheme` imports per file** (when migrating to nativewind): The same-file already calls `useColorScheme()` at line 108. Use the SAME scheme/isDark/muted/accent values for the edit-overlay icon-colors and Spara/Avbryt button surfaces — do NOT re-derive locally.
- **Need to import `KeyboardAvoidingView`, `Platform`, `TextInput`** from `react-native` — the current import block (lines 64-70) only has `Pressable, ScrollView, Text, View, useColorScheme`. ADD the three new names to that destructure.
- **`useUpdateSessionNotes` MUST be imported** from `@/lib/queries/sessions` — extend the existing import (line 83): `import { useDeleteSession, useSessionQuery, useUpdateSessionNotes } from "@/lib/queries/sessions";`.

---

### 6. `app/app/(app)/(tabs)/settings.tsx` — Tema-section

**Role:** UI screen (settings control with persisted state)
**Data flow:** event-driven (segment-change → NativeWind setColorScheme + AsyncStorage write)
**Analog:** Existing settings.tsx layout (lines 23-52) + the SegmentedControl primitive in `app/components/segmented-control.tsx`

**Existing settings.tsx** (lines 1-53 — see full Read above): SafeAreaView → `<View className="flex-1 px-4 pt-12 gap-6">` → Heading "Inställningar" + optional email Text + placeholder "Mer kommer i Phase 7." + spacer + sign-out Pressable.

**SegmentedControl consumer pattern** (consume the primitive verbatim — no copy of component internals; pattern already documented in chart route via `MetricToggle`/`WindowToggle`):
```tsx
import { SegmentedControl } from "@/components/segmented-control";

<SegmentedControl<"system" | "light" | "dark">
  options={[
    { label: "System", value: "system" },
    { label: "Ljust",  value: "light"  },
    { label: "Mörkt",  value: "dark"   },
  ]}
  value={stored}
  onChange={onChange}
  accessibilityLabel="Välj appens tema"
/>
```

**Target — replace line 38-40 placeholder Text with Tema-section** (UI-SPEC §D):
```tsx
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "nativewind";
import { z } from "zod";
import { SegmentedControl } from "@/components/segmented-control";

// inside SettingsTab:
const { setColorScheme } = useColorScheme();
const [stored, setStored] = useState<"system" | "light" | "dark">("system");

useEffect(() => {
  void AsyncStorage.getItem("fm:theme").then((v) => {
    const parsed = z.enum(["system", "light", "dark"]).catch("system").parse(v);
    setStored(parsed);
  });
}, []);

const onChange = (value: "system" | "light" | "dark") => {
  setStored(value);
  setColorScheme(value);
  void AsyncStorage.setItem("fm:theme", value).catch(() => {
    console.warn("[settings] AsyncStorage write failed — theme not persisted");
  });
};

// in JSX (replacing lines 38-40):
<View className="gap-2">
  <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">Tema</Text>
  <SegmentedControl
    options={[
      { label: "System", value: "system" },
      { label: "Ljust",  value: "light"  },
      { label: "Mörkt",  value: "dark"   },
    ]}
    value={stored}
    onChange={onChange}
    accessibilityLabel="Välj appens tema"
  />
</View>
```

**Landmines:**
- **`setColorScheme` is ONLY available from `nativewind` `useColorScheme()`** — NOT from `react-native`. NativeWind's hook returns `{ colorScheme, setColorScheme }`; RN's returns `'light' | 'dark' | null`. This is the load-bearing reason for D-T4 migration.
- **`AsyncStorage.getItem` returns `string | null`** — Zod's `.catch('system')` handles both null (key absent) AND any corrupted string (T-07-01 mitigation). The `z.enum(...).catch(...)` pattern is the Zod 4 idiom; do NOT use `safeParse` + manual fallback (uglier, same behavior).
- **`onChange` order is load-bearing:** `setStored(value)` first (so the SegmentedControl reflects the new selection synchronously), THEN `setColorScheme(value)` (flips NativeWind root class), THEN `AsyncStorage.setItem` (async, fire-and-forget). If AsyncStorage write fails, the in-memory state stays correct for this session — only persistence breaks.
- **No new install of `@react-native-async-storage/async-storage`** — already in stack (LargeSecureStore). CLAUDE.md TL;DR lists it pinned at 2.2.0.
- **Generic typing on SegmentedControl** — TypeScript can infer `<"system" | "light" | "dark">` from the `options` literal when typed as `as const`. If TS widens, add the explicit generic `<SegmentedControl<"system" | "light" | "dark">>` per the chart-route precedent.

---

### 7. `app/app/_layout.tsx` — ThemeBootstrap + dynamic StatusBar + useColorScheme migration

**Role:** UI/effect (root layout — splash-gate + status-bar)
**Data flow:** event-driven (cold-start AsyncStorage read → setColorScheme before splash hides)
**Analog:** `SplashScreenController` in SAME file, lines 62-72

**Existing `SplashScreenController` pattern** (verbatim):
```typescript
function SplashScreenController() {
  const status = useAuthStore((s) => s.status);
  useEffect(() => {
    if (status !== "loading") {
      SplashScreen.hideAsync().catch(() => {
        // Already hidden / not visible — safe to ignore.
      });
    }
  }, [status]);
  return null;
}
```

**Target — add `ThemeBootstrap` as a sibling** (mounted INSIDE `<PersistQueryClientProvider>` so the cache-hydration onSuccess + theme read can run independently):

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "nativewind";   // post-D-T4 migration
import { z } from "zod";

function ThemeBootstrap() {
  const { setColorScheme } = useColorScheme();
  useEffect(() => {
    void AsyncStorage.getItem("fm:theme")
      .then((v) => {
        const parsed = z.enum(["system", "light", "dark"]).catch("system").parse(v);
        setColorScheme(parsed);
      })
      .catch(() => {
        // T-07-01: silent fallback to 'system'. Default colorScheme is 'system'
        // out of the box; no need to call setColorScheme on read failure.
        console.warn("[theme] AsyncStorage read failed — defaulting to system");
      });
  }, [setColorScheme]);
  return null;
}
```

**Mount it** (line 153-157 region):
```tsx
<PersistQueryClientProvider ...>
  <ThemeBootstrap />              {/* ADD — sibling to SplashScreenController */}
  <SplashScreenController />
  <RootNavigator />
  <StatusBar style={isDark ? "light" : "dark"} />   {/* CHANGE from style="auto" */}
</PersistQueryClientProvider>
```

**Dynamic StatusBar (D-T3)** — the existing `isDark` value computed inside `RootLayout` (line 112) is already in scope; just swap the StatusBar prop:
```tsx
// Before (line 156):
<StatusBar style="auto" />
// After:
<StatusBar style={isDark ? "light" : "dark"} />
```

**Landmines:**
- **Module-load ordering (line 16-31 region):** Phase 7 MUST NOT disturb the existing top comment block. Theme-bootstrap is a Provider-child, NOT a module-side effect — it runs AFTER `client.ts` + `persister.ts` + `network.ts` have all loaded, which is the correct order. The splash is held by `SplashScreen.preventAutoHideAsync()` (line 49) and only released by `SplashScreenController` after auth status flips out of 'loading' — `ThemeBootstrap` runs in parallel, completes well before auth resolves (AsyncStorage round-trip is ~tens of ms; auth resolution is ~hundreds of ms).
- **`setColorScheme` is stable across renders** (NativeWind 4 contract — it's a `useCallback`-wrapped setter); the `[setColorScheme]` dependency keeps the effect from re-firing.
- **`isDark` in `RootLayout`** (line 112) uses `useColorScheme()` from `react-native` today. After D-T4 migration, the same call returns NativeWind's hook value — which now reflects the manual override AND falls through to system when set to 'system'. This is the load-bearing semantic difference: `react-native`'s useColorScheme reads iOS directly, NativeWind's resolves to either the override or iOS-system fallback.
- **Two `useColorScheme()` call sites in `_layout.tsx`** (lines 84 in `RootNavigator`, 111 in `RootLayout`). Both migrate to nativewind. The two-hook pattern stays — RootNavigator reads its own value because the Stack screenOptions need it; RootLayout reads its own for GestureHandlerRootView background.

---

### 8. Mechanical migration — 10 files: `useColorScheme` import-source migration (D-T4)

**Role:** mechanical refactor (drop-in API-compatible rename)
**Data flow:** n/a
**Analog:** Drop-in replacement — every call site already uses only `.colorScheme`, never `setColorScheme`. NativeWind 4's `useColorScheme()` returns the same `{ colorScheme }`-readable shape.

**Two import-form patterns** observed in the codebase:

**Form A — solo import line** (3 files: `app/_layout.tsx:4`, `(app)/_layout.tsx:44`, `(tabs)/_layout.tsx:28`):
```typescript
// Before:
import { useColorScheme } from "react-native";
// After:
import { useColorScheme } from "nativewind";
```

**Form B — destructured inside a multi-name `react-native` import** (7 files: `(app)/(tabs)/index.tsx:87`, `(app)/(tabs)/history.tsx:64`, `(app)/plans/[id].tsx:51`, `(app)/plans/[id]/exercise-picker.tsx:49`, `(app)/history/[sessionId].tsx:69`, `(app)/exercise/[exerciseId]/chart.tsx:47`, `components/active-session-banner.tsx:27`):
```typescript
// Example before (history/[sessionId].tsx lines 64-70):
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useColorScheme,    // ← remove this line
} from "react-native";
// After: remove `useColorScheme` from RN destructure + add a separate line:
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useColorScheme } from "nativewind";
```

**Verified — every call site reads only `.colorScheme`** (grep confirms 11 read-sites, zero write-sites in current code):
- `app/app/_layout.tsx:84` — `const scheme = useColorScheme(); const isDark = scheme === "dark";`
- `app/app/_layout.tsx:111` — same
- `app/components/active-session-banner.tsx:37` — same
- `app/app/(app)/_layout.tsx:61` — same
- `app/app/(app)/exercise/[exerciseId]/chart.tsx:103` — same
- `app/app/(app)/history/[sessionId].tsx:108` — same
- `app/app/(app)/plans/[id].tsx:105` — same
- `app/app/(app)/(tabs)/_layout.tsx:33` — same
- `app/app/(app)/plans/[id]/exercise-picker.tsx:73` — same
- `app/app/(app)/(tabs)/index.tsx:103` — same
- `app/app/(app)/(tabs)/history.tsx:82` + `:275` — same

All 11 read-sites in 10 files use the form `const scheme = useColorScheme(); const isDark = scheme === "dark";`. NativeWind's `useColorScheme()` returns `{ colorScheme, setColorScheme }`; reading `useColorScheme()` as a single value via destructure-less assignment yields the **object**, not the string. This means **the call-sites MUST also change** from:
```typescript
const scheme = useColorScheme();
const isDark = scheme === "dark";
```
to:
```typescript
const { colorScheme } = useColorScheme();
const isDark = colorScheme === "dark";
```

**This is the load-bearing detail that turns "mechanical rename" into a real diff per file.** The planner MUST update both the import statement AND the destructure of the call.

**Landmines:**
- **One commit per CONTEXT.md D-T4** — "atomic commit" lock. All 10 files migrate in one commit so no intermediate state has mixed sources. If split into commits, a middle state would have inconsistent dark-mode behavior depending on which file was already migrated.
- **The destructure rename is REQUIRED, not optional** — calling `useColorScheme()` from `nativewind` and assigning the whole return-value to a variable named `scheme` then comparing `scheme === "dark"` will silently always be false (object never equals a string). This is the single highest-risk regression in Phase 7 — every migrated file MUST be re-verified.
- **`components/active-session-banner.tsx` is the only file in `app/components/`** in the migration list — it's pulled in by the layout, so the migration covers all renderers regardless of which tab is active. No dynamic-import workaround needed.
- **`(tabs)/history.tsx` has TWO call sites** (lines 82 + 275) — both must update.

---

## Shared Patterns

### A. Optimistic-update + scope.id contract (TanStack v5 + Pitfall 8.1)

**Source:** `app/lib/query/client.ts` — all 14 existing `setMutationDefaults` blocks
**Apply to:** the new 15th block `['session','update-notes']` (analog 4) + the amended block 10 `['session','finish']`
**Concrete excerpt** (from `['session','finish']`, lines 694-740 — the canonical Session-mutation shape):

```typescript
onMutate: async (vars) => {
  await queryClient.cancelQueries({ queryKey: sessionsKeys.detail(vars.id) });
  const previousDetail = queryClient.getQueryData<SessionRow>(sessionsKeys.detail(vars.id));
  if (previousDetail) {
    queryClient.setQueryData<SessionRow>(sessionsKeys.detail(vars.id), {
      ...previousDetail,
      /* … merged fields … */
    });
  }
  return { previousDetail };
},
onError: (_err, vars, ctx) => {
  const c = ctx as { previousDetail?: SessionRow } | undefined;
  if (c?.previousDetail)
    queryClient.setQueryData(sessionsKeys.detail(vars.id), c.previousDetail);
},
onSettled: (_d, _e, vars) => {
  void queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(vars.id) });
  /* … other invalidates … */
},
retry: 1,
```

**Why it matters in Phase 7:** D-E3 useUpdateSessionNotes inherits this exact onMutate-snapshot-rollback shape. The scope.id `session:${id}` is baked at the hook construction site (in `lib/queries/sessions.ts`), not in client.ts — Pitfall 3.

### B. mutate-not-mutateAsync (Phase 4 commit 5d953b6)

**Source:** `app/app/(app)/workout/[sessionId].tsx` line 380 (addSet.mutate); `app/app/(app)/history/[sessionId].tsx` line 236 (deleteSession.mutate)
**Apply to:** AvslutaOverlay `finishSession.mutate({ id, finished_at, notes }, ...)` + edit-notes overlay `updateNotes.mutate({ id, notes }, { onError: ... })`
**Why:** `mutateAsync` never resolves under `networkMode: 'offlineFirst'` when the mutation is paused offline (CONTEXT.md `<canonical_refs>` Phase 4 Plan 04-04). Use `.mutate(vars, { onError, onSuccess })` callbacks — they fire deterministically regardless of network state.

### C. Inline-overlay (NOT Modal portal) (Phase 4 D-13 / commit e07029a)

**Source:** AvslutaOverlay in `workout/[sessionId].tsx` lines 851-916; delete-confirm in `history/[sessionId].tsx` lines 417-516
**Apply to:** new edit-notes overlay in `history/[sessionId].tsx`
**Excerpt — the canonical 2-Pressable nest with absolute-position scrim** (verbatim from delete-confirm):
```tsx
{showOverlay && (
  <Pressable
    style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
             alignItems: "center", justifyContent: "center",
             backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 32, zIndex: 2000 }}
    onPress={dismiss}
    accessibilityRole="button"
    accessibilityLabel="Stäng dialog"
  >
    <Pressable style={{ width: "100%", maxWidth: 400, ... }}
               onPress={(e) => e.stopPropagation()}>
      {/* card content */}
    </Pressable>
  </Pressable>
)}
```
**Wrap with `KeyboardAvoidingView`** when the overlay contains a TextInput (per D-N1 and D-E2 — the edit-overlay needs this; the delete-confirm does not).

### D. useFocusEffect cleanup for overlay state (Phase 4 commit af6930c / Pitfall 5 + 7)

**Source:** `app/app/(app)/history/[sessionId].tsx` lines 130-137; `app/app/(app)/workout/[sessionId].tsx` lines 118-124
**Apply to:** extend both files' existing `useFocusEffect` cleanup with the new overlay-state-resets
**Excerpt — the canonical cleanup return** (verbatim from history/[sessionId].tsx):
```typescript
useFocusEffect(
  useCallback(() => {
    return () => {
      setShowOverflowMenu(false);
      setShowDeleteConfirm(false);
    };
  }, []),
);
```
**Why:** Expo Router's `freezeOnBlur` retains React state across navigation; without the cleanup, a re-focus flashes a stale overlay open (Pitfall 7). New Phase 7 state to add to cleanup: `setShowEditNotesOverlay(false)`, `setDraftNotes("")`, optional `setNotes("")` if the AvslutaOverlay's draft state is lifted to the parent.

### E. `z.preprocess(comma→period→null-on-empty)` (Plan 05-06 / FIT-9)

**Source:** `app/lib/schemas/sets.ts` lines 44-53 (`setFormSchema.weight_kg`)
**Apply to:** `setFormSchema.rpe` (D-R2 + D-R3) — same comma-period locale-tolerance, extended with empty-string→null branch
**Why:** Swedish-locale iPhones render `,` on decimal-pad; JS Number parser only accepts `.`. The `.replace(/,/g, ".")` with /g flag intentionally rejects multi-comma strings ("8,5,5" → "8.5.5" → NaN → schema rejects). For RPE, the empty-string branch comes FIRST so a tap-but-don't-fill produces `set.rpe = null`.

### F. Svensk inline-kopia (Phase 3 D-15)

**Apply to:** every new copy string in Phase 7. Inventory (per UI-SPEC):
- `"RPE"` (placeholder, 64pt-narrow)
- `"Upplevd ansträngning, valfri"` (a11y label)
- `"RPE 0 eller högre"` / `"RPE 10 eller lägre"` (schema error messages)
- `"Anteckningar (valfri)"` (TextInput placeholder)
- `"Anteckningar för passet, valfri"` (a11y label)
- `"Lägg till anteckning"` (add-affordance)
- `"Redigera anteckning"` (edit-overlay title + pencil a11y label)
- `"Avbryt"` (existing convention — neutral cancel)
- `"Spara"` / `"Spara anteckning"` (save CTA visible + a11y)
- `"Tema"` (section heading)
- `"System"` / `"Ljust"` / `"Mörkt"` (segment labels)
- `"Välj appens tema"` (SegmentedControl a11y label)
- `"Kunde inte spara anteckningen. Försök igen."` (bannerError on update fail — matches plans/[id].tsx convention)

### G. AAA-kontrast on color flips (Pitfall 6.4)

**Apply to:** Notes counter `text-red-600 dark:text-red-400` on `bg-gray-100 dark:bg-gray-800` (both overlay surfaces). AA verified; AAA documented as deferred-to-tooling if UI-review runs (CONTEXT.md Claude's Discretion).

---

## No Analog Found

**Zero files in this category.** Every Phase 7 modification has at least one in-codebase analog — most have an exact-match analog in the same file. This reflects the polish-cut nature of the phase: all stack, all primitives, all patterns are inherited; only feature surfaces are new.

---

## Phase-7-specific Landmines (cross-file — re-stated for planner emphasis)

1. **scope.id must be a STATIC string at useMutation() time** (Pitfall 3 — TanStack v5 `mutationCache.scopeFor` reads `mutation.options.scope?.id` with a `typeof === "string"` gate). Function-shaped scope.id silently fails. The `useUpdateSessionNotes(sessionId?: string)` hook bakes `scope: { id: 'session:${sessionId}' }` at construction. Matches `useDeleteSession`/`useFinishSession`/`useStartSession` precedent.
2. **Module-load order in `lib/query/client.ts`** (Pitfall 8.5 + 8.12) — the new 15th `setMutationDefaults` block MUST be at module top-level (NOT inside a hook or function) AND MUST execute before any paused mutation rehydrates from AsyncStorage. The file's first comment block (lines 1-31) documents this contract — preserve the comment, append block 15 AFTER block 14 (line ~1046).
3. **Modal portal forbidden** (Phase 4 D-13 + workout/[sessionId].tsx lines 793-797 + history/[sessionId].tsx implementation): NativeWind/flex layout collapses silently inside `<Modal>`. The new edit-overlay MUST use inline absolute-position Pressable scaffold + zIndex 2000. Verified pattern in 3 existing overlays (AvslutaOverlay, overflow-menu, delete-confirm).
4. **useColorScheme migration is two-part per file** — change import source AND change destructure shape (`const { colorScheme } = useColorScheme()`). Read-sites currently use `const scheme = useColorScheme(); scheme === "dark"` which silently fails after migration (object never equals string). Highest-risk regression vector in Phase 7.
5. **AsyncStorage `fm:theme` write/read MUST tolerate corruption + absence silently** (T-07-01) — Zod `.enum([...]).catch('system').parse(v)` handles both null (key absent) and any tampered string. Console.warn on write failure; no UI surface per SPEC accepted-risk.
6. **AvslutaOverlay's KeyboardAvoidingView is inserted between the outer scrim Pressable and the inner stopPropagation Pressable** — it is a layout primitive, not a touch consumer, so the 2-Pressable stopPropagation chain still works. Confirmed via the existing inline-overlay convention.
7. **`setFormSchema.rpe` extension preserves `.nullable().optional()` chain** (current line 63) — D-R2 mandates this. The `useForm<SetFormInput, undefined, SetFormOutput>` 3-generic in workout/[sessionId].tsx line 353 depends on the input/output type split exported from sets.ts; do NOT collapse the type aliases.
8. **D-R3 preprocess order is `empty → null` FIRST, then `comma → period`** — if a user types just `,`, the trim removes nothing but the replace produces `.` which coerces to NaN which the schema rejects. If a user types `8,5`, the trim is no-op and replace produces `8.5` which coerces correctly. The order is load-bearing.
9. **Server-side `numeric(3,1)` will silently truncate** — `8.55` becomes `8.5`. SPEC accepts this in V1 (Deferred: `multipleOf(0.5)` for V1.1). Do NOT add multipleOf or extra client decimals guard.
10. **`useFinishSession.mutate` payload is amended, NOT replaced** — existing `{ id, finished_at }` callers (if any beyond AvslutaOverlay) MUST continue to work. The `notes?: string | null` is OPTIONAL on the type alias so non-AvslutaOverlay call-sites compile unchanged. Verified: only AvslutaOverlay calls finishSession.mutate in the current codebase.

---

## Metadata

**Analog search scope:**
- `app/lib/schemas/sets.ts` (full read — 110 lines)
- `app/lib/schemas/sessions.ts` (full read — 64 lines)
- `app/lib/queries/sessions.ts` (full read — 250 lines)
- `app/lib/query/client.ts` (full read — 1046 lines)
- `app/app/(app)/workout/[sessionId].tsx` (targeted reads — 1-120, 280-375, 370-590, 780-950 of 950 lines)
- `app/app/(app)/history/[sessionId].tsx` (full read — 598 lines)
- `app/app/_layout.tsx` (full read — 160 lines)
- `app/app/(app)/(tabs)/settings.tsx` (full read — 53 lines)
- `app/components/segmented-control.tsx` (full read — 117 lines)
- `app/components/active-session-banner.tsx` (grep — confirmed useColorScheme import shape)

**Cross-file Grep audits:**
- `useColorScheme` — confirmed 10 files, 11 call sites (history.tsx has 2), all read-only access on `.colorScheme`
- `from "react-native"` — confirmed migration affects only `useColorScheme` named export; other RN imports stay

**Files scanned:** 10 source files + 6 phase artifacts (CONTEXT.md, SPEC.md, UI-SPEC.md)
**Pattern extraction date:** 2026-05-15

---

*Phase: 07-v1-polish-cut*
*Patterns mapped: 2026-05-15*
*Next step: gsd-planner consumes this file to write per-plan PLAN.md `<read_first>` and `<action>` blocks*
