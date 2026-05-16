---
phase: 07
plan: 03
subsystem: workout-session-finish
tags: [notes, avsluta-overlay, keyboard-avoiding-view, finish-session-payload, optimistic-update, f12]
linear_issue: FIT-71

dependency_graph:
  requires: ["07-02"]
  provides: ["notes-capture-on-finish", "session-finish-notes-payload"]
  affects: ["07-04"]

tech_stack:
  added: []
  patterns:
    - "useState-unmount-cleanup (Option A: useEffect cleanup in overlay component)"
    - "KeyboardAvoidingView behavior=padding/height wrap around inner stopPropagation Pressable"
    - "Trim-normalize notes at mutationFn + onMutate (D-N3 canonical form)"
    - "Optimistic notes write to sessionsKeys.detail(id) with backward-compat previousDetail.notes fallback"

key_files:
  modified:
    - app/lib/queries/sessions.ts
    - app/lib/query/client.ts
    - app/app/(app)/workout/[sessionId].tsx

decisions:
  - "D-N3: notes field wired end-to-end: SessionFinishVars optional notes, mutationFn normalizes trim/null, onMutate dual-writes to detail-cache"
  - "D-N4 Option A chosen: useEffect(() => () => setNotes(''), []) inside AvslutaOverlay — unmount-cleanup, no prop drilling"
  - "Backward-compat onMutate fallback: vars.notes undefined → previousDetail.notes ?? null (preserves existing notes on legacy callers)"

metrics:
  duration: "~30 minutes"
  completed: "2026-05-16"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
  files_created: 0
---

# Phase 7 Plan 03: F12 Notes Capture in AvslutaOverlay Summary

**One-liner:** Session finish notes capture wired end-to-end: SessionFinishVars widened, mutationFn normalizes via trim/null, AvslutaOverlay gets KeyboardAvoidingView + multiline TextInput + 0/500 counter + cleanup on unmount.

## What Was Built

F12 capture-delen landed in full. Users can now type optional session notes (up to 500 characters) inside the AvslutaOverlay before tapping Avsluta. The notes field is normalized at the mutation layer (empty/whitespace-only → NULL) and written optimistically to the detail cache.

### Task 1: SessionFinishVars + `['session','finish']` plumbing

- `SessionFinishVars` in `app/lib/queries/sessions.ts` line 39 widened from `{ id; finished_at }` to `{ id; finished_at; notes?: string | null }` — `notes` is optional so all prior callers remain type-safe.
- Same widening applied to the local `SessionFinishVars` alias in `app/lib/query/client.ts` (line 143).
- `['session','finish']` `mutationFn`: destructures `notes`, computes `const finalNotes = notes?.trim() ? notes.trim() : null`, and passes `{ finished_at, notes: finalNotes }` to the Supabase UPDATE in a single atomic write.
- `['session','finish']` `onMutate`: extends the detail-cache optimistic write with `notes: finalNotes`. The backward-compat fallback (`vars.notes?.trim() ? ... : (previousDetail.notes ?? null)`) ensures that if a legacy caller passes only `{ id, finished_at }` (vars.notes is undefined), the existing `previousDetail.notes` is preserved rather than clobbered to null.
- `onError` + `onSettled` left unchanged — existing `previousDetail` snapshot rollback already restores all fields including `notes`; existing invalidates on `sessionsKeys.detail(id)` + `sessionsKeys.listInfinite()` cover the notes refresh.

### Task 2: AvslutaOverlay UI

- `AvslutaOverlay` now declares `const [notes, setNotes] = useState<string>("")` for local draft state.
- `useEffect(() => () => setNotes(""), [])` resets the draft on unmount — fires when `showAvslutaOverlay` is set to false by backdrop-tap, Fortsätt, or Avsluta. Re-open of the overlay mounts the component fresh with empty state (Option A — chosen for minimal cross-component coupling, per D-N4).
- The inner `Pressable stopPropagation` wrapper is now wrapped by `<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%", maxWidth: 400 }}>` so the iOS keyboard shifts the card upward instead of covering the Fortsätt/Avsluta buttons (D-N1). The KAV is a layout primitive — it does not consume touch events or break the backdrop-dismiss chain.
- `<TextInput>` inserted between the body `<Text>` and the button row: `multiline`, `numberOfLines={3}`, `maxLength={500}`, `style={{ minHeight: 80, maxHeight: 160 }}`, `textAlignVertical="top"`, `placeholder="Anteckningar (valfri)"`, `accessibilityLabel="Anteckningar för passet, valfri"` (D-N2).
- Counter `<Text>` always visible below the TextInput: `{notes.length}/500` with `text-sm text-right text-gray-500 dark:text-gray-400`; flips to `text-red-600 dark:text-red-400` when `notes.length > 480` (D-N2 warning threshold).
- `handleConfirm` payload extended with `notes` (raw string; normalization happens in mutationFn). Uses `.mutate(vars, {...})` not `.mutateAsync` (Phase 4 commit `5d953b6` rule upheld).

## Verification Results

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | PASSED (exit 0) |
| `npm run lint` (expo lint) | PASSED (exit 0) |
| `npm run test:f13-brutal` | PASSED (no sessions in last 60 min — hot path unaffected) |
| grep: `notes?: string \| null` in sessions.ts | 1 match |
| grep: `type SessionFinishVars` in client.ts | 1 match |
| grep: `finalNotes` in client.ts | 4 matches (2 decl + 2 usage across mutationFn + onMutate) |
| grep: `update({ finished_at, notes: finalNotes })` in client.ts | 1 match |
| grep: `Anteckningar (valfri)` in workout/[sessionId].tsx | 1 match |
| grep: `KeyboardAvoidingView` in workout/[sessionId].tsx | 8 matches (imports + usage) |
| grep: `maxLength={500}` in workout/[sessionId].tsx | 1 match |
| grep: `notes.length > 480` in workout/[sessionId].tsx | 1 match |
| grep: `Anteckningar för passet, valfri` in workout/[sessionId].tsx | 1 match |
| grep: `finishSession.mutate` includes `notes` | Confirmed |
| grep: `.mutateAsync` in actual code (not comments) | 0 matches |

## Deviations from Plan

None — plan executed exactly as written.

**Notes on implementation choices:**
- Task 1 line 216 of PLAN.md specified the onMutate backward-compat pattern as `previousDetail.notes ?? null` when vars.notes is undefined. This was implemented as written — the fallback preserves any existing `notes` value rather than clobbering it to null, which is the correct behavior for the `useFinishSession` hook (the only caller in V1 is AvslutaOverlay, but the pattern is future-proof).
- The outer backdrop Pressable's `paddingHorizontal: 32` was moved to the outer Pressable (not duplicated on KAV) — KAV gets `width: "100%", maxWidth: 400` only, as specified in D-N1 and PATTERNS.md section 4b. The outer Pressable still owns `alignItems: "center"` + `justifyContent: "center"` for centering.

## Manual UAT Notes

The following manual verifications from the PLAN.md `<verification>` section require device/Expo Go and Supabase access:

1. **Online finish with notes** — type "Bra dag, ny PR på squat" → Avsluta → SQL: `SELECT notes FROM workout_sessions ORDER BY finished_at DESC LIMIT 1` should return the string. (Defer to human UAT.)
2. **Whitespace-only** → SQL should return NULL (trim-normalization in mutationFn). (Defer to human UAT.)
3. **Counter color flip at 481 chars** — counter turns red. (Defer to device test.)
4. **maxLength gate** — input hard-clipped at 500. (RN default behavior.)
5. **Keyboard avoidance on iPhone SE** — buttons remain visible. (Defer to device test.)
6. **Backdrop-tap dismiss + state cleanup** — type draft → backdrop → overlay closes → re-open → TextInput empty. (Defer to device test.)
7. **Offline finish with notes** — airplane mode → log sets → Avsluta with notes → reconnect → mutation replays → SQL confirms both `notes` and `finished_at` landed. (Defer to Plan 07-05 UAT gate.)

Offline replay is architecturally correct because `notes` flows through the existing `scope.id = session:${sessionId}` FIFO queue and the `['session','finish']` mutationFn handles the UPDATE atomically. No new offline patterns were introduced.

## Threat Model

All 4 threats from the plan's STRIDE register are dispositioned:

| Threat ID | Category | Disposition | Status |
|-----------|----------|-------------|--------|
| T-07-02 | XSS / Tampering | accept | React Native `<Text>` inherently safe — no innerHTML/JS evaluation. |
| T-07-11 | Tampering / Bypass | mitigate | Client `maxLength={500}` + `SessionRowSchema.parse(data)` on UPDATE response validates on read-side. |
| T-07-12 | Information Disclosure | accept | Single-user V1; RLS scopes at DB; iOS app sandbox is the trust boundary. |
| T-07-13 | Denial of Service | accept | `maxLength={500}` + text-base rendering; RN TextInput handles 500 chars without perf issue. |
| T-07-14 | Tampering | accept | TanStack persister uses LargeSecureStore (AES-encrypted via aes-js) — notes inherit at-rest encryption from Phase 3. |

threats_open: 0

## Known Stubs

None — notes TextInput is fully wired (state → payload → mutationFn → Supabase UPDATE → optimistic cache write). The history-detail notes-block (where the written notes are displayed) is Plan 07-04's scope and is intentionally not in this plan.

## Self-Check: PASSED

Files verified:
- `app/lib/queries/sessions.ts` — exists, contains `notes?: string | null` on line 39
- `app/lib/query/client.ts` — exists, contains widened `SessionFinishVars`, `finalNotes` in mutationFn + onMutate
- `app/app/(app)/workout/[sessionId].tsx` — exists, contains `KeyboardAvoidingView`, `Anteckningar (valfri)`, `notes.length > 480`

Commits verified:
- `359213e` — feat(07-03): widen SessionFinishVars + amend `['session','finish']` for notes
- `9e68741` — feat(07-03): add notes TextInput + KAV + counter to AvslutaOverlay
