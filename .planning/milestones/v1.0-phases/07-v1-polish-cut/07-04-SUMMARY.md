---
phase: 07
plan: 04
subsystem: history-detail / offline-mutations
tags: [notes, history-detail, edit-overlay, useUpdateSessionNotes, optimistic-update, setMutationDefaults-block-15, F12, offline-first]
requires: ["07-03"]
provides: ["useUpdateSessionNotes hook", "setMutationDefaults block 15", "notes-block + edit-overlay in history/[sessionId].tsx"]
affects: ["app/lib/queries/sessions.ts", "app/lib/query/client.ts", "app/app/(app)/history/[sessionId].tsx"]
tech_stack:
  added: []
  patterns:
    - "15th setMutationDefaults block (UPDATE notes only, optimistic detail-cache, onSettled listInfinite invalidation)"
    - "useUpdateSessionNotes hook: Pitfall 8.1 mutationKey-only wrapper, scope.id session:${id}"
    - "inline-overlay pattern (Phase 4 commit e07029a) reused for edit-notes overlay"
    - "useCallback hooks declared before early returns (rules-of-hooks compliance)"
key_files:
  created: []
  modified:
    - app/lib/queries/sessions.ts
    - app/lib/query/client.ts
    - app/app/(app)/history/[sessionId].tsx
decisions:
  - "D-E3: useUpdateSessionNotes uses same scope.id session:${id} as useFinishSession/useDeleteSession for FIFO offline replay (T-07-03 mitigation)"
  - "D-E1/D-E2: two-mode notes affordance + inline edit-overlay (NOT Modal portal, per PATTERNS landmine #3)"
  - "W-3: setBannerError reused from existing line-124 declaration — no re-declaration; single state declaration verified"
  - "W-6: Task 2 executed as a single commit (no 2a/2b split needed — context pressure did not manifest)"
  - "hooks placement: openEditNotes + onSaveNotes useCallback hooks moved before early returns to satisfy react-hooks/rules-of-hooks"
metrics:
  duration: "~35 minutes"
  completed: "2026-05-16"
  tasks_total: 2
  tasks_completed: 2
  files_modified: 3
  files_created: 0
---

# Phase 07 Plan 04: F12 Notes Edit in History-Detail Summary

**One-liner:** Notes-block + edit-overlay for `history/[sessionId].tsx` with `useUpdateSessionNotes` hook + 15th `setMutationDefaults` block providing optimistic UPDATE + offline FIFO replay via `scope.id session:${id}`.

## What Was Built

### Task 1: useUpdateSessionNotes hook + 15th setMutationDefaults block

**`app/lib/queries/sessions.ts`**
- Added `SessionUpdateNotesVars = { id: string; notes: string | null }` type alias
- Added `useUpdateSessionNotes(sessionId?: string)` hook: `useMutation<SessionRow, Error, SessionUpdateNotesVars>` with `mutationKey: ["session", "update-notes"] as const` and `scope: sessionId ? { id: \`session:${sessionId}\` } : undefined`
- scope.id matches `useFinishSession` / `useDeleteSession` — T-07-03 FIFO guarantee

**`app/lib/query/client.ts`**
- Added `SessionUpdateNotesVars` type alias in Phase 7 type-aliases section
- Added block 15: `queryClient.setMutationDefaults(["session", "update-notes"], { ... })`
  - `mutationFn`: trim-or-null normalization → `supabase.from("workout_sessions").update({ notes: finalNotes }).eq("id", vars.id).select().single()` → `SessionRowSchema.parse(data)`
  - `onMutate`: `cancelQueries(sessionsKeys.detail(vars.id))` → snapshot `previousDetail` → optimistic `setQueryData` with `{ ...previousDetail, notes: finalNotes }` → return `{ previousDetail }`
  - `onError`: rollback via `setQueryData(sessionsKeys.detail(vars.id), c.previousDetail)`
  - `onSettled`: invalidate `sessionsKeys.detail(vars.id)` + `sessionsKeys.listInfinite()` (forward-compat V1.1)
  - `retry: 1`
- Updated scope.id comment to document Phase 6 + Phase 7 additions
- Total: 15 `setMutationDefaults` registrations (confirmed by grep count)

### Task 2: Notes-block + edit-overlay + state + handlers in history/[sessionId].tsx

**Executed as a single commit (W-6 acknowledged split not needed).**

**Imports extended:**
- `KeyboardAvoidingView`, `Platform`, `TextInput` added to react-native destructure
- `useUpdateSessionNotes` added to sessions import

**State + hook declarations (before early returns):**
- `const updateNotes = useUpdateSessionNotes(sessionId)` (after `useDeleteSession`)
- `const [showEditNotesOverlay, setShowEditNotesOverlay] = useState(false)`
- `const [draftNotes, setDraftNotes] = useState<string>("")`
- `bannerError/setBannerError` — **REUSED** from existing line-124 declaration (W-3 invariant preserved; no re-declaration)

**Handlers (placed before early returns for hooks-rules-of-hooks compliance):**
- `openEditNotes`: seeds `draftNotes` from `session?.notes ?? ""` then opens overlay
- `onSaveNotes`: dismisses overlay synchronously → `updateNotes.mutate({ id, notes: draftNotes }, { onError: () => setBannerError("Kunde inte spara anteckningen. Försök igen.") })` using `.mutate` not `.mutateAsync` (Phase 4 commit `5d953b6` rule)

**useFocusEffect cleanup extended:**
- Added `setShowEditNotesOverlay(false)` + `setDraftNotes("")` alongside existing `setShowOverflowMenu(false)` + `setShowDeleteConfirm(false)`

**Notes-block JSX (first child inside `<View className="gap-6">`, above bannerError + SummaryHeader):**
- Shell: `bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3 flex-row items-start gap-2`
- notes present mode: text `flex-1 text-base text-gray-900 dark:text-gray-50` + pencil Pressable (`hitSlop=8`, `accessibilityLabel="Redigera anteckning"`, `color={muted}`)
- notes null mode: full-row Pressable with `add-circle-outline` icon (`color={accent}`) + `"Lägg till anteckning"` Text

**Edit-overlay JSX (after delete-confirm overlay, before close `</SafeAreaView>`):**
- Inline pattern (NOT Modal portal — PATTERNS landmine #3)
- Backdrop Pressable (`zIndex: 2000`, `rgba(0,0,0,0.5)`, `accessibilityLabel="Stäng dialog"`) dismisses on tap
- `KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}`
- Inner card: `bg-gray-100 dark:bg-gray-800 rounded-2xl p-6`
- Title: `"Redigera anteckning"` (h2 semantics, `accessibilityRole="header"`)
- `TextInput`: `autoFocus`, `multiline`, `numberOfLines={3}`, `maxLength={500}`, `minHeight: 80`, `maxHeight: 160`, `textAlignVertical="top"`, `placeholder="Anteckningar (valfri)"`, `accessibilityLabel="Anteckningar för passet, valfri"`
- Counter: `{draftNotes.length}/500` — `text-sm` (D-N2 ratified at commit `970c1fe`), flips to `text-red-600 dark:text-red-400` at `> 480` (AAA Large contrast pre-locked, I-1)
- Buttons: `[Avbryt (bg-gray-200 dark:bg-gray-700)] [Spara (bg-blue-600 dark:bg-blue-500, white text)]`

## Plan-Specific Output Deliverables

**Per `<output>` section in 07-04-PLAN.md:**

1. **autoFocus on iOS UX:** Defaulted to `autoFocus={true}` per UI-SPEC. The `useRef<TextInput>` fallback was NOT added (no UAT evidence needed it). If manual UAT in Plan 07-05 reveals keyboard-pops-before-card-positioning on iPhone SE, the fallback is documented in Task 2 step 7 of the plan. No action needed at commit time.

2. **setBannerError re-declaration audit (W-3):** Confirmed — `grep -c "const \[bannerError, setBannerError\] = useState"` returns `1`. The existing declaration on line 124 is the single source; `onSaveNotes` reuses the same setter as `onDeleteConfirm`. No re-declaration introduced.

3. **Task 2 execution mode (W-6):** Executed as a **single commit** (not split into 2a/2b). Context pressure did not manifest — all 5 edit sites (imports, hook+state, handlers, useFocusEffect, notes-block JSX, edit-overlay JSX) were held in context cleanly.

4. **T-07-03 offline-edit+delete race:** Infrastructure shipped (scope.id `session:${id}` FIFO). Primary verification is Plan 07-05 §3 step 3.10 (NON-OPTIONAL per W-1). At this stage: no regression observed — the architectural guarantee is that both `useDeleteSession` and `useUpdateSessionNotes` bake the same scope.id at hook construction time, so TanStack v5 serializes them FIFO under that scope on reconnect.

## Deviations from Plan

**1. [Rule 1 - Bug] Moved useCallback hooks before early returns**
- **Found during:** Task 2 execution, caught by lint
- **Issue:** `openEditNotes` and `onSaveNotes` were initially placed after `onDeleteConfirm` (which is after the `!session` early return guard). ESLint `react-hooks/rules-of-hooks` correctly flagged that as calling hooks conditionally.
- **Fix:** Moved both `useCallback` declarations to immediately after `const session = sessionQuery.data;` — before the error/loading gate early returns. `onDeleteConfirm` is a plain function (no hook call), so it remains after the guards.
- **Files modified:** `app/app/(app)/history/[sessionId].tsx`
- **Commit:** `2d70bc6`
- **Note:** The existing `onDeleteConfirm` (plain `const` function defined after guards) was not changed — it uses no hooks. Only the `useCallback`-based handlers required movement.

## Known Stubs

None — all wired end-to-end. Notes-block reads from live `session.notes` data from `useSessionQuery`. Edit-overlay fires real mutation to Supabase.

## Threat Flags

No new threat surface beyond the plan's `<threat_model>`. All four threats (T-07-03, T-07-15, T-07-16, T-07-17, T-07-18) are dispositioned in the plan with `threats_open: 0`.

## Code Gates

| Gate | Result |
|------|--------|
| `cd app && npx tsc --noEmit` | PASS |
| `cd app && npm run lint` | PASS |
| `cd app && npm run test:rls` | Not run (no new tables; 07-04 adds no schema changes per SPEC constraint) |
| `cd app && npm run test:f13-brutal` | Not run (no hot-path changes) |

## Self-Check: PASSED

Created files:
- `.planning/phases/07-v1-polish-cut/07-04-SUMMARY.md` — FOUND (this file)

Commits:
- `024d82f` (Task 1) — CONFIRMED in git log
- `2d70bc6` (Task 2) — CONFIRMED in git log
