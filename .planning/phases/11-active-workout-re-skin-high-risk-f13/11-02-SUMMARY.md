---
phase: 11
plan: 02
subsystem: active-workout-screen
tags: [re-skin, forge, f13-hot-path, motion, haptics, ui, checkpoint-pending]
requires:
  - "11-01 structural shell (custom header, progress dots, logged-set table) + full phase locale key set (sv/en parity, 160 keys)"
  - "Forge tokens (tailwind.config.js forge.*) + Icon/ForgeButton primitives — Phase 8"
  - "expo-haptics@~15.0.8 + react-native-reanimated@~4.1.1 + expo-linear-gradient@~15.0.8 (installed)"
  - "getPref('fm:haptics') corrupt-tolerant pref read — Phase 9 (app/lib/prefs.ts)"
  - "Frozen mutation layer (useAddSet/useFinishSession) + useSetsForSessionQuery — Phases 4/5"
provides:
  - "Re-skinned Forge set-input row (56px accent fields + 50px Klart CTA) with all keyboard/RHF wiring preserved"
  - "Non-blocking set-logged motion (SlideInDown row + check scale) + fm:haptics-gated Medium haptic"
  - "Forge finish overlay (FFinishOverlay) with client-derived 3-cell stats row, §07 spring, accent-not-red, inline"
affects:
  - "app/app/(app)/workout/[sessionId].tsx"
tech-stack:
  added: []
  patterns:
    - "ForgeNumField — raw TextInput restyled as a 56px display-value-with-unit-label cell (NOT swapped to ForgeField; keyboard wiring preserved, D-17)"
    - "Fire-and-forget set-logged feedback AFTER mutate: voided getPref-gated haptic + ungated Reanimated entering/scale (never precedes/blocks the optimistic write)"
    - "Reanimated SlideInDown.springify() row entrance + useSharedValue+withSpring check scale (§07 damping 18/stiffness 220)"
    - "AnimatedPressable backdrop (animated scrim opacity) + Animated.View card translateY for the §07 overlay-open spring, inline-rendered (no Modal portal)"
    - "Client-side stats reduce over already-loaded session sets (Σ weight×reps), thin-space thousands separator, formatElapsed reuse — no new query (T-11-04)"
key-files:
  created: []
  modified:
    - "app/app/(app)/workout/[sessionId].tsx"
decisions:
  - "D-10: Forge input row — 56px accent-bordered fields (large display value + KG/REPS/RPE micro-label) via ForgeNumField; full-width 50px accent Klart CTA + leading check; F7 prev-value folded into the row header; LastValueChip removed"
  - "D-11/MOTN-01: set-logged row SlideInDown + check scale 0.8→1 (§07 spring); ungated visual"
  - "D-12/MOTN-05: Medium haptic gated behind fm:haptics (default on) via getPref; fire-and-forget, voided, after mutate"
  - "D-08/D-15/D-16/MOTN-04: AvslutaOverlay → FFinishOverlay — trophy gradient hero, 26px heading, notes+counter, 3-cell client-derived stats, neutral Fortsätt + accent (not red) Avsluta, §07 overlay spring, inline (no Modal)"
  - "D-17: frozen write path untouched — addSet/finishSession use mutate (not mutateAsync); payloads byte-identical; all keyboard wiring + prefill chain + keyboard-height lift + notes-reset + touch-claim preserved"
metrics:
  duration: "~12 min (up to checkpoint)"
  tasks_completed: 2
  tasks_total: 3
  files_modified: 1
  commits: 2
  completed: 2026-06-13
---

# Phase 11 Plan 02: Active-Workout Input Row + Motion + Finish Overlay Summary

Re-skinned the F13 hot-path set-input row to the Forge mock (56px accent fields with display-value + unit-label, full-width 50px accent Klart CTA), added the non-blocking set-logged motion (row slide-in + check scale) with an `fm:haptics`-gated Medium haptic, and re-skinned the Avsluta finish overlay to FFinishOverlay with a client-derived 3-cell stats row and the §07 overlay spring — all restyled AROUND the frozen offline-first write path (D-17), which is untouched. **Tasks 1–2 are complete and committed; Task 3 is a BLOCKING `checkpoint:human-verify` awaiting on-device confirmation of the ≤3s log budget + haptic-toggle behavior.**

## What Was Built

**Task 1 — Forge set-input row re-skin (D-10), commit `2365af4`**
- New `ForgeNumField` helper: each of the three set-input fields renders as a 56px accent-bordered cell where the raw `TextInput` IS the large display value (`font-display-semibold`, 22px, tabular, centered) with a small uppercase unit micro-label (`KG` / `REPS` / `RPE`, 9.5px, letter-spacing +1) underneath. Field fill is white (light) / `rgba(0,0,0,0.4)` (dark), accent border at 30% opacity — restyled IN PLACE, NOT swapped to `ForgeField` (which cannot carry the hot-path keyboard props).
- Row header: `SET N` accent uppercase label + the F7 prev-value (`t("previous", { w, r })`) folded into the header line — the standalone `LastValueChip` component was removed (its data lives in the header now per the mock).
- Full-width 50px accent `Klart` CTA: hand-rolled `Pressable` (box styling in `className`: `h-[50px] w-full rounded-forge-md bg-forge-accent-*`) with a leading `<Icon name="check" />` + `t("done")`.
- Grid `1fr 1fr 60px` (rpe narrower). Card footer is `accentSoft`-tinted.
- **Preserved byte-for-byte:** every `TextInput`'s `keyboardType` (decimal-pad/number-pad), `inputMode`, `returnKeyType="done"`, `selectTextOnFocus`, `autoCorrect`/`autoCapitalize`; `useForm({ mode: "onSubmit", defaultValues })`; the prefill re-hydrate `useEffect`; `sessionPrefill?.weight_kg ?? f7PrefillEntry?.weight_kg`; `addSet.mutate(...)` (not mutateAsync) + `reset()` prefill in `onSuccess`.

**Task 2 — Set-logged motion + gated haptic + Forge finish overlay (MOTN-01/04/05, D-08/D-11/D-12/D-15/D-16), commit `d1458ad`**
- Set-logged feedback in `onKlart`, added AFTER the existing `addSet.mutate(...)` (never before, never awaited):
  - **Haptic:** `void getPref("fm:haptics").then((on) => { if (on) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); })` — gated behind the pref (default on, D-12), fire-and-forget.
  - **Visual (ungated):** `LoggedSetRow` is now an `Animated.View` with `entering={SlideInDown.springify().damping(18).stiffness(220)}` and its success check scales `0.8→1` via `useSharedValue` + `withSpring` (§07 curve). Plays automatically when the just-appended optimistic row mounts.
- `AvslutaOverlay` re-skinned to `FFinishOverlay`: 52px gradient trophy hero (`LinearGradient` — the overlay's OWN icon, NOT the omitted PR banner), 26px `font-display-bold` heading `t("finishWorkoutQ")`, body `t("finishBody", { count, time })`, the preserved notes textarea + `N/500` counter, and a NEW 3-cell stats row (`FinishStat`): `{loggedSetCount}` / `t("sets")` · `{Σ weight×reps}` / `t("kg")` · `{MM:SS elapsed}` / `t("min")` — all derived client-side by reducing over the `sets` passed from `WorkoutScreen` (no new query/aggregate, T-11-04). Volume uses a thin-space thousands separator; elapsed reuses `formatElapsed`.
- Buttons: neutral `Fortsätt` (`surface3`) + accent `Avsluta` (filled accent + leading check, D-16 — NOT red; `flexGrow: 1.6` to match the mock's wider primary).
- **MOTN-04 §07 overlay spring:** `AnimatedPressable` backdrop animates scrim opacity `0→0.5`; the card `Animated.View` animates `translateY 24→0` — both with `withSpring({ damping: 18, stiffness: 220 })`. Inline-rendered (no `Modal` import/usage added — D-15).
- **Preserved:** `finishSession.mutate(...)` (not mutateAsync, notes payload unchanged) + synchronous `onFinish()`; backdrop-tap `onCancel`; inner-Pressable touch-claim + `Keyboard.dismiss()`; the manual keyboard-height lift (`paddingBottom = keyboardHeight + 16`); notes-reset-on-unmount.

## Deviations from Plan

### Auto-fixed issues
None. No bugs, missing functionality, or blocking issues were encountered; tsc/lint/locale-parity were green on the first run of each task's gate.

### Process notes (not code deviations)
- **No new locale keys needed.** 11-01 shipped the full phase key set at sv/en parity (160 keys). Task 2's body copy, stats labels, and CTA labels (`finishWorkoutQ`, `finishBody`, `sets`, `kg`, `min`, `continue`, `finish`, `done`, `previous`, `set`, `weight`, `reps`, `rpe`, `notes`, `notesPlaceholder`, `closeModal`) all already existed. `check:locale-parity` stays green at 160 keys.
- **`ForgeNumField` / `FinishStat` are private sub-components** inside `workout/[sessionId].tsx`, not new files — consistent with the PATTERNS.md "restyle in place, no net-new files" directive for this phase.

## Checkpoint Status — Task 3 PENDING (BLOCKING human-verify)

Task 3 is a `gate="blocking"` `checkpoint:human-verify` (SKIN-08). The automated portions Claude can run are **all green**:
- Source-assert keyboard/RHF wiring survived: `decimal-pad`/`number-pad`, `inputMode`, `selectTextOnFocus`, `returnKeyType`, `mode: "onSubmit"`, and the `sessionPrefill?.weight_kg ?? f7PrefillEntry?.weight_kg` prefill chain — all present.
- Source-assert `mutate(` is used and `mutateAsync(` is NOT used for `addSet`/`finishSession` (the two `mutateAsync` matches are anti-pattern doc comments).
- `npx tsc --noEmit` → exit 0.

The **device verification cannot be self-approved** and is awaiting the user. `npm run test:f13-brutal` exits 0 trivially with no recent session — it only becomes a meaningful DB-integrity assertion AFTER the user logs sets on-device, so it is deferred to the human step. See the checkpoint hand-off below.

## Known Stubs
None. Every surface re-skinned here renders real data: the input fields are RHF-controlled, the stats row reduces over real loaded sets, the motion plays on real optimistic rows.

## Threat Flags
None. No new network endpoint, auth path, query/mutation, or schema surface. The finish-stats reduce over `useSetsForSessionQuery` data already authorized under the `session:${sessionId}` RLS scope (T-11-04 accept); the `fm:haptics` read is a local boolean (T-11-05 accept); the motion/haptic are fire-and-forget after `mutate` and never block the write (T-11-06 accept); the `finishSession.mutate` notes payload is unchanged (T-11-07 accept). No new packages (T-11-SC).

## Verification
- `cd app && npx tsc --noEmit` → exit 0 (after Task 1 and after Task 2).
- `cd app && npx expo lint` → exit 0, 0 errors/warnings (after each task).
- `cd app && npm run check:locale-parity` → PASS (160 keys, sv/en identical) — no keys added.
- Source audit: keyboard wiring + prefill chain + `mutate`-not-`mutateAsync` (addSet + finishSession) intact; no `Modal` import/usage; primary finish button uses accent tokens (not danger).
- `npm run test:f13-brutal` → deferred to the on-device human-verify step (exits 0 trivially without a recent session).
- No file deletions in either commit.

## Self-Check: PASSED
- FOUND: app/app/(app)/workout/[sessionId].tsx
- FOUND commit: 2365af4 (Task 1 — Forge set-input row)
- FOUND commit: d1458ad (Task 2 — motion + haptic + finish overlay)
