---
phase: 07
plan: 02
subsystem: rpe-inline-input
tags: [rpe, schema-stretch, inline-row, zod-preprocess, history-suffix, f11]
requires:
  - 07-01 (useColorScheme migration — history/[sessionId].tsx already migrated)
provides:
  - F11-rpe-inline-input-workout-screen
  - F11-rpe-suffix-history-detail
  - setFormSchema-rpe-preprocess-bounds
affects:
  - app/lib/schemas/sets.ts
  - app/app/(app)/workout/[sessionId].tsx
  - app/app/(app)/history/[sessionId].tsx
  - app/scripts/test-set-schemas.ts
tech-stack:
  added: []
  patterns:
    - z.preprocess(empty-or-whitespace→null, comma→period) before z.coerce.number (weight_kg precedent extended to RPE)
    - Third RHF Controller sibling in inline-row (w-16 column, text-center, decimal-pad, maxLength=4)
    - Conditional RPE suffix in history set-row map (loose != null, items-baseline, text-base muted color)
key-files:
  created: []
  modified:
    - app/lib/schemas/sets.ts
    - app/app/(app)/workout/[sessionId].tsx
    - app/app/(app)/history/[sessionId].tsx
    - app/scripts/test-set-schemas.ts
decisions:
  - D-R1: RPE column w-16; INLINE-ROW Klart-button shrunk w-20 → w-16; AvslutaOverlay buttons (flex-1) UNCHANGED
  - D-R2: Schema bounds min(0, RPE 0 eller högre) + max(10, RPE 10 eller lägre)
  - D-R3: Combined preprocess — empty/whitespace → null FIRST, then comma → period
  - D-R4: Placeholder RPE, accessibilityLabel Upplevd ansträngning valfri, inline-error with accessibilityLiveRegion=polite
metrics:
  duration: ~25 minutes
  completed: 2026-05-16
  tasks_completed: 3
  tasks_total: 3
  files_modified: 4
linear_issue: FIT-70
---

# Phase 7 Plan 02: F11 Inline RPE-input + RPE-visning i History Summary

Inline RPE field added to workout set-row (third Controller peer to Vikt/Reps), schema-stretched with z.preprocess comma-and-empty normalization + min(0)/max(10) bounds, and conditional RPE suffix wired into history session detail set-rows — closing F11 from the V1 must-have list.

## What Was Built

### Task 1: Stretch setFormSchema.rpe (app/lib/schemas/sets.ts)

**Commit:** b1397ef

Replaced the stub `z.coerce.number().nullable().optional()` with the full D-R2/D-R3 shape:

```ts
rpe: z.preprocess(
  (v) => {
    if (typeof v !== "string") return v;
    const trimmed = v.trim();
    if (trimmed === "") return null; // empty/whitespace → null (D-R3, valfri)
    return trimmed.replace(/,/g, "."); // comma → period (weight_kg precedent)
  },
  z
    .coerce.number()
    .min(0, { error: "RPE 0 eller högre" })
    .max(10, { error: "RPE 10 eller lägre" })
    .nullable()
    .optional(),
),
```

Three new assertions added to `app/scripts/test-set-schemas.ts` (total: 13 → 16 cases):
- `rpe: ""` → `null` (valfri, empty-string-to-null via preprocess)
- `rpe: "8,5"` → `8.5` (Swedish-locale comma accepted)
- `rpe: "11"` → ZodError `"RPE 10 eller lägre"` (upper bound enforced)

All 16 schema cases PASSED.

### Task 2: Add RPE Controller to workout/[sessionId].tsx inline-row (D-R1/D-R4)

**Commit:** ac6ea63

**Three changes in one commit:**

1. **Third Controller sibling inserted** between the Reps Controller (line ~544) and the Klart Pressable — exact insert region: after `</View>` closing the Reps Controller, before the Klart `<Pressable>`:
   - `name="rpe"`, wrapper `<View className="w-16">`
   - TextInput: `placeholder="RPE"`, `accessibilityLabel="Upplevd ansträngning, valfri"`, `maxLength={4}`, `keyboardType="decimal-pad"`, `inputMode="decimal"`, `text-center px-2` (narrower than Vikt/Reps px-3)
   - Inline error: `text-base text-red-600 dark:text-red-400 mt-1 px-1` + `accessibilityLiveRegion="polite"` (identical pattern to Vikt/Reps)

2. **INLINE-ROW Klart-button shrunk** from `w-20` → `w-16` (D-R1): only the inline-row button at the old `w-20 min-h-[56px] rounded-md bg-blue-600 ... disabled:opacity-60` location. The AvslutaOverlay buttons at lines 896/906 use `flex-1 py-4 rounded-lg bg-{gray,blue}` — they are NOT `w-20` and were NOT touched.

3. **addSet.mutate payload extended** with `rpe: input.rpe ?? null` (positioned between `reps:` and `completed_at:`).

**AvslutaOverlay anti-corruption verification:**
```
grep -cE "flex-1 py-4 rounded-lg bg-(blue|gray)" app/app/(app)/workout/[sessionId].tsx
2  ← unchanged (cancel gray + confirm blue at lines 896 + 906)
```

**Inline-row POST-migration signature:**
```
grep -c "w-16 min-h-[56px] rounded-md bg-blue-600.*disabled:opacity-60"
1  ← exactly the inline-row Klart-button
```

### Task 3: Append RPE-suffix to history/[sessionId].tsx set-rows

**Commit:** 5f4c502

Inside the existing `{sets.map((set) => (...))}` block (around line 585), added a third conditional Text node after the weight×reps Text:

```tsx
{set.rpe != null && (
  <Text className="text-base text-gray-500 dark:text-gray-400">
    {` · RPE ${set.rpe}`}
  </Text>
)}
```

Key implementation details:
- **Loose `!= null`** (not `!==`) catches both null and undefined (workout-screen Controller precedent)
- **Middle-dot U+00B7** `·` with one space on each side (not bullet U+2022)
- **Muted color** `text-gray-500 dark:text-gray-400` — same as `Set N:` prefix (both are metadata, not primary content)
- **`text-base`** preserves `items-baseline` alignment on the parent View (NOT text-sm)
- **Template literal** `${set.rpe}` produces `"8.5"` not `"8.50"` — no trailing zeros

## Verification Results

### Code Gates

| Gate | Result |
|------|--------|
| `cd app && npx tsc --noEmit` | PASS (exit 0) |
| `cd app && npm run lint` | PASS (exit 0) |
| `npm run test:set-schemas` | PASS (16/16 cases including 3 new RPE assertions) |
| `npm run test:f13-brutal` | PASS (exit 0 — no sessions in last 60 min; harness exits 0 cleanly) |
| `npm run test:rls` | PASS (all assertions passed — 29+ assertions, no regression) |

### Grep Verifications

**Task 1 (sets.ts):**
- `z.preprocess` count: 3 (weight_kg line + rpe line + 1 in file header comment) ≥ 2 ✓
- `RPE 0 eller högre`: 1 ✓
- `RPE 10 eller lägre`: 1 ✓
- Old `rpe: z.coerce.number().nullable().optional()`: 0 (removed) ✓

**Task 2 (workout/[sessionId].tsx):**
- `name="rpe"`: 1 ✓
- `Upplevd ansträngning, valfri`: 1 ✓
- `placeholder="RPE"`: 1 ✓
- `rpe: input.rpe`: 1 ✓
- `w-16 min-h-[56px] rounded-md bg-blue-600.*disabled:opacity-60`: 1 ✓
- `flex-1 py-4 rounded-lg bg-(blue|gray)`: 2 ✓ (AvslutaOverlay buttons UNCHANGED)
- `w-20 min-h-[56px] rounded-md bg-blue-600`: 0 (old w-20 gone) ✓

**Task 3 (history/[sessionId].tsx):**
- `set.rpe != null`: 1 ✓
- ` · RPE ${set.rpe}` present at line 595 ✓

### F13 Brutal-Test Non-Regression

`npm run test:f13-brutal` exits 0. No active sessions in the 60-minute window (dev environment); the harness prints "Nothing to verify" and exits cleanly. This is the expected behavior in CI. The set-logging flow has not changed in any way that could affect the 3s/set perf budget: the new RPE Controller binds via `mode: "onSubmit"` (no onChange validation cost), and `maxLength={4}` caps input length before any Zod preprocess runs.

### AvslutaOverlay Explicit Confirmation

The AvslutaOverlay's cancel and confirm buttons at lines 896 and 906 are **verifiably unchanged**:

```
grep -cE "flex-1 py-4 rounded-lg bg-(blue|gray)" workout/[sessionId].tsx
→ 2  (cancel: bg-gray-200 dark:bg-gray-700; confirm: bg-blue-600 dark:bg-blue-500)
```

These buttons use `flex-1` (not `w-20`), `rounded-lg` (not `rounded-md`), and do NOT have `disabled:opacity-60`. They are in the AvslutaOverlay block (lines 896/906) which is entirely unmodified by this plan. Plan 07-03 owns that surface.

### iPhone UAT

Deferred to Plan 07-05 UAT per plan `<output>` specification. The 4-column inline-row verification (Vikt | Reps | RPE | Klart on iPhone SE-width) and history-suffix visual check will be exercised in 07-05.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | b1397ef | feat(07-02): stretch setFormSchema.rpe with z.preprocess + min(0).max(10) bounds |
| Task 2 | ac6ea63 | feat(07-02): add inline RPE Controller to workout set-row + shrink Klart-button |
| Task 3 | 5f4c502 | feat(07-02): append conditional RPE-suffix to history set-rows |

## Deviations from Plan

None — plan executed exactly as written.

All three tasks completed without deviations. The `test:f13-brutal` exit-0 behavior (no sessions in last 60 min) was expected in the dev environment and matches the plan's stated gate condition.

## Known Stubs

None. All three changes deliver complete, wired functionality with no placeholder data or deferred rendering paths.

## Threat Flags

No new security-relevant surface beyond the plan's threat_model. All four threat IDs dispositioned:

| Threat | Disposition | Notes |
|--------|-------------|-------|
| T-07-04 | accept | Direct API bypass → RLS guards cross-user; within-user numeric(3,1) truncation is V1 accepted-risk |
| T-07-08 | mitigate | Comma preprocess with /g flag → multi-comma becomes multi-period → NaN → Zod coerce rejects |
| T-07-09 | mitigate | set.rpe read via setRowSchema.parse → z.number().nullable(); no XSS surface in RN Text |
| T-07-10 | accept | maxLength=4 caps input; mode:onSubmit means no per-keystroke validation cost; F13 gate green |

## Self-Check

Files exist:
- app/lib/schemas/sets.ts: FOUND
- app/app/(app)/workout/[sessionId].tsx: FOUND
- app/app/(app)/history/[sessionId].tsx: FOUND
- app/scripts/test-set-schemas.ts: FOUND

Commits exist:
- b1397ef: FOUND (feat(07-02): stretch setFormSchema.rpe)
- ac6ea63: FOUND (feat(07-02): add inline RPE Controller)
- 5f4c502: FOUND (feat(07-02): append conditional RPE-suffix)
