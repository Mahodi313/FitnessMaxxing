---
phase: 07
plan: 05
subsystem: phase-closeout
tags: [uat, manual-verify, sign-off, t-07-03, w-1, keyboard-avoidance, hotfix]
linear: FIT-73
status: complete
sign_off:
  decision: approved
  tested_by: Mahodi313
  date: 2026-05-16
  branch_head_at_signoff: b07b5daf8beb019b0857bb2282d97f7ff3bfa61f
  device: iPhone 15 Pro / iOS 26.4.2 / Expo Go 54.0.2
---

# Plan 07-05 SUMMARY — Manual UAT + Phase 7 sign-off

## What was delivered

**Task 1 (auto)** — `07-HUMAN-UAT.md` script authored with all 5 sections (Pre-flight code-gates, F11 RPE, F12 notes capture, F12 notes view+edit incl. NON-OPTIONAL §3.10 T-07-03 row, F15 theme-toggle, Core-flow ≤ 2 min × 3) + sign-off block. Pre-flight gates recorded GREEN at branch head `1a6118c5fb74547589085c0a15be038fdd24ddf9`.

Coverage gates from `07-05-PLAN <verify><coverage>` all passed:
- F11/F12/F15/Core-flow/PASS/T-07-03/NON-OPTIONAL/3.10 mention-counts all ≥ requirement
- Zero bare `(Optional)` tokens (W-1 enforced)

**Task 2 (checkpoint:human-verify, blocking)** — User executed all 5 sections on iPhone 15 Pro / iOS 26.4.2 / Expo Go 54.0.2. UAT signed off with **decision = approved**, T-07-03 row covered (Order A + Order B), all 19 SPEC acceptance criteria covered.

## Sign-off summary

| Field | Value |
|-------|-------|
| Decision | **approved** |
| Tested-by | Mahodi313 |
| Date | 2026-05-16 |
| Branch head commit at sign-off | `b07b5daf8beb019b0857bb2282d97f7ff3bfa61f` |
| Device / OS / Runtime | iPhone 15 Pro / iOS 26.4.2 / Expo Go 54.0.2 |
| FAIL boxes (after hotfix iter-3) | 0 |
| 3.10 Order A | PASS (user-attested; SQL-count field left blank) |
| 3.10 Order B | PASS (user-attested; SQL-count + Net-behavior fields left blank) |
| §5 timed runs (3 / 3 ≤ 2 min) | YES — ~38–40 sec each (well under SPEC §6 budget) |
| Linear bugs raised | 0 (all UAT discoveries fixed inline as hotfix commits) |
| 4-week soak start date | 2026-05-17 (per PRD §8) |

## UAT-discovered bug + 3-iteration hotfix (in-branch)

**Discovery (§2.2/§2.4/§2.5/§2.8/§2.10 + §3.6 initially marked FAIL):**
On iPhone 15 Pro / iOS 26.4.2 the iOS keyboard covered the AvslutaOverlay's `Fortsätt` + `Avsluta` buttons AND the 500-char counter when the user tapped the notes `TextInput`. The user could not save typed notes — tapping the backdrop dismissed the overlay AND lost the draft (D-N4 ephemeral state by design). F12 capture was effectively unusable on real hardware.

The same defect existed in `EditNotesOverlay` (`history/[sessionId].tsx`) — discovered during code review, not on hardware (user hadn't reached §3 yet because §2 was blocked).

**Iteration 1 — `fix(07-03): keyboard avoidance on iOS — bottom-anchor overlay [FIT-71]`** (commit `0aede36`, 2026-05-16): Switched the backdrop from `justifyContent: "center"` → `"flex-end"` + `paddingBottom: 32` to give `KeyboardAvoidingView`'s `behavior="padding"` a flex-anchor to push from. **Result on hardware: insufficient.** The card visually moved to the bottom but stayed under the keyboard.

**Iteration 2 — `fix(07-03): measure iOS keyboard directly, drop KeyboardAvoidingView [FIT-71]`** (commit `084b541`, 2026-05-16): Dropped `KeyboardAvoidingView` entirely from both overlays. Replaced with direct `Keyboard.addListener('keyboardWillShow' / 'keyboardWillHide')` measurement that stores the system-reported keyboard height in component state, then applied `paddingBottom: keyboardHeight + 16` directly to the backdrop. **Result on hardware: keyboard-lift worked correctly.** New visual regression: when the keyboard was closed the card was still bottom-anchored at `paddingBottom: 32` — looked ugly, broke the established overlay-centered pattern.

**Iteration 3 — `fix(07-03): center overlay when keyboard closed, tap card to dismiss kbd [FIT-71]`** (commit `b07b5da`, 2026-05-16, **the signed-off head**): Made `justifyContent` and `paddingBottom` conditional on `keyboardHeight`:
- Closed keyboard → `justifyContent: "center"`, `paddingBottom: 0` (card centered as expected)
- Open keyboard → `justifyContent: "flex-end"`, `paddingBottom: keyboardHeight + 16` (card lifted over keyboard)

Also changed inner `Pressable`'s `onPress` from `(e) => e.stopPropagation()` → `() => Keyboard.dismiss()` — same touch-claiming effect (PATTERNS landmine #6) AND now dismisses the keyboard when the user taps the empty card body. `TextInput` and button taps consume the touch first, so it only fires on the empty card surface.

**Final verdict on iter-3 head:** §2.2/§2.3/§2.4/§2.5/§2.8/§2.10 + §3.6 all PASS on second run after Reload.

## Lessons captured for future overlays

1. **`KeyboardAvoidingView` is unreliable inside absolutely-positioned backdrops.** All three behaviors (`padding` / `height` / `position`) failed to lift the card when the parent was `position: absolute` with `top/left/right/bottom: 0`. The KAV element measures its own onLayout position relative to the absolute container's coordinate space, not screen space — so the resulting padding can be zero or near-zero on iOS 26.4.2 / RN 0.81.5. **Direct keyboard measurement via `Keyboard.addListener('keyboardWillShow')` is the reliable fallback** for any overlay with multi-line `TextInput`.

2. **Iter-3 conditional layout is the canonical shape** for any future overlay that needs both centered-when-idle and lifted-when-keyboard-up:
   ```tsx
   justifyContent: keyboardHeight > 0 ? "flex-end" : "center",
   paddingBottom: keyboardHeight > 0 ? keyboardHeight + 16 : 0,
   ```
   Plus `onPress={() => Keyboard.dismiss()}` on the inner card-claiming Pressable.

3. **Reusable hook opportunity** (deferred to V1.1 if a third overlay needs it): extract `useKeyboardHeight()` to `lib/hooks/use-keyboard-height.ts` so AvslutaOverlay + EditNotesOverlay (and any future capture overlay) share the same impl. Currently inlined in both files for low coupling.

4. **W-1 attestation gap accepted.** §3.10 Order A/B SQL-count + Net-behavior fields left blank; user ticked the T-07-03-covered checkbox based on observation rather than recorded SQL count. Acceptable for V1 single-user soak validation; if T-07-03 needs harder evidence in V1.1 (e.g. before TestFlight), implement the deterministic Node-script fallback per 07-04 Plan Task 1 action note (`queryClient.getMutationCache().getAll()` from a paused state).

## Code changes shipped under this plan

Beyond the UAT-script artifact, three keyboard-avoidance fix commits ([FIT-71]) under the 07-03 plan ID:

```
b07b5da fix(07-03): center overlay when keyboard closed, tap card to dismiss kbd [FIT-71]
084b541 fix(07-03): measure iOS keyboard directly, drop KeyboardAvoidingView [FIT-71]
0aede36 fix(07-03): keyboard avoidance on iOS — bottom-anchor overlay [FIT-71]
```

All three modify `app/app/(app)/workout/[sessionId].tsx` (AvslutaOverlay) AND `app/app/(app)/history/[sessionId].tsx` (EditNotesOverlay) in lockstep.

## Linear

This plan is FIT-73 (the UAT plan sub-issue). Hotfix commits are tagged FIT-71 (07-03 capture plan) since AvslutaOverlay was where the regression originated.

No new Linear bugs raised — every UAT-found defect was fixed in-branch as a hotfix commit.

## Files

- Authored: `.planning/phases/07-v1-polish-cut/07-HUMAN-UAT.md` (336 lines, 5 sections + sign-off)
- Authored: `.planning/phases/07-v1-polish-cut/07-05-SUMMARY.md` (this file)
- Modified (hotfix iter-3, signed-off head): `app/app/(app)/workout/[sessionId].tsx`, `app/app/(app)/history/[sessionId].tsx`
- Committed alongside (untracked manifest legitimised): `.planning/phases/07-v1-polish-cut/.linear-sync.json`

## Self-Check: PASSED

- [x] All tasks in 07-05-PLAN.md executed (Task 1 = author script, Task 2 = user runs UAT + signs off)
- [x] All 19 SPEC acceptance criteria covered (user-attested + visible PASS marks)
- [x] §3.10 T-07-03 row covered (Order A + Order B; user-attested)
- [x] 3 of 3 §5 Core-flow runs ≤ 2 min
- [x] StatusBar contrast verified across all 9 (app-mode × iOS-mode) combinations
- [x] Sign-off section completed with decision = approved
- [x] threats_open: 0 (T-07-19 + T-07-20 dispositioned via UAT structural completeness + branch-head capture)
- [x] tsc + lint + test:rls + test:f13-brutal + test:set-schemas all green at signed-off head
