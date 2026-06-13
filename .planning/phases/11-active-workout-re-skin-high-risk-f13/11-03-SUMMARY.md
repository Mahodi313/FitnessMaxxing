---
phase: 11
plan: 03
subsystem: active-workout-overlays
tags: [re-skin, forge, overlay, toast, motion, f13-hot-path, ui]
requires:
  - "Forge tokens (tailwind.config.js forge.* — success/danger/accentSoft/borderStrong) — Phase 8"
  - "Icon primitive (clock/play/check) + ForgeButton (primary/destructive variants) — Phase 8"
  - "Phase locale keys at sv/en parity (resume/resumeSession/finishSession/sessionSaved/sets) — Plan 11-01"
  - "Reanimated 4 (useSharedValue/withSpring) — installed in stack"
provides:
  - "Re-skinned draft-resume overlay (FDraftResumeOverlay) with danger ghost End-session button + §07 spring"
  - "Re-skinned saved-toast (FSavedToast) forge-success pill"
affects:
  - "app/app/(app)/(tabs)/index.tsx"
tech-stack:
  added: []
  patterns:
    - "Inline-rendered overlay (no Modal portal) with a §07 spring entrance: a single useSharedValue progress drives backdrop opacity (0→0.55) + card translateY (24→0) via withSpring(damping 18 / stiffness 220)"
    - "Animated.createAnimatedComponent(Pressable) at module scope so a backdrop Pressable can ride a shared-value opacity"
    - "ForgeButton variant=destructive (transparent + danger text/border) for the one data-loss-adjacent action (D-16); variant=primary + play icon for Resume"
    - "Forge-success toast pill (box styling via className, position + glow shadow inline) keeping the existing FadeIn/FadeOut + edge-trigger logic"
key-files:
  created: []
  modified:
    - "app/app/(app)/(tabs)/index.tsx"
decisions:
  - "D-16: draft-resume End-session button switched from neutral surface2 to a DANGER GHOST (ForgeButton variant=destructive) — the one place red is correct (data-loss-adjacent)"
  - "D-15: both overlay + toast stay inline-rendered (no Modal portal); spring/FadeIn ride layout primitives"
  - "D-11/MOTN-04: §07 overlay spring (damping 18 / stiffness 220) on the draft-resume overlay; toast kept its proven FadeIn/FadeOut (per-Discretion, both acceptable)"
  - "Offline-critical logic (cold-start detection, finishSession.mutate not mutateAsync, touch-claim, no-onPress force-decision backdrop, previousActiveRef + 2s toast timer) preserved byte-for-byte"
metrics:
  duration: "~12 min"
  tasks_completed: 2
  files_modified: 1
  commits: 2
  completed: 2026-06-13
---

# Phase 11 Plan 03: Draft-Resume Overlay + Saved-Toast Re-skin Summary

Re-skinned the two overlays Phase 10 left verbatim inside `(tabs)/index.tsx` — the draft-resume overlay to the full `FDraftResumeOverlay` mock (pulsing-dot icon block, clock/plan-name/N-set/Live meta strip, accent Resume above a danger ghost End-session button, §07 spring entrance) and the saved-toast to the `FSavedToast` forge-success pill — as a chrome-only re-skin over the frozen offline-critical overlay/toast logic.

## What Was Built

**Task 1 — DraftResumeOverlay → FDraftResumeOverlay + danger ghost End session + §07 spring (D-16/D-15/D-11)**
- Rebuilt the overlay card to the full mock: a 52px accentSoft pulsing-dot icon block (glowing accent core dot + faint accent ring), a 26px display heading (`t("resumeSession")`), body copy, a meta strip (`<Icon name="clock" />` + plan name + `{time} · {N} {t("sets")}` tabular line + an accent "Live" pill), then a primary `ForgeButton variant="primary" icon="play"` Resume above a `ForgeButton variant="destructive"` (transparent + danger text/border) End-session button.
- Changed the End-session button from the prior neutral `surface2` styling to a **danger ghost** (D-16 — closing an orphaned draft is data-loss-adjacent, the one place red is correct).
- Added the MOTN-04 §07 spring entrance: one `useSharedValue` progress driven by `withSpring(1, { damping: 18, stiffness: 220 })` drives the backdrop opacity (0→0.55) and the card `translateY` (24→0) + opacity. Added a module-scope `AnimatedPressable = Animated.createAnimatedComponent(Pressable)` so the backdrop Pressable can ride the shared-value opacity. Inline-rendered (no Modal — D-15).
- New props `planName` / `setsCount` / `startedAt` passed from the call site (derived from `activeSession.plan_name_snapshot` + the already-computed `setsCount`/`startedAt` — no new fetch, T-11-09 accept).
- **Preserved byte-for-byte:** `shouldShowDraftOverlay`/`isColdStartDraft`/`coldStartSessionId` cold-start detection; `handleAvslutaSession` (`finishSession.mutate` NOT mutateAsync + `onDismiss()` after); the `onStartShouldSetResponder` touch-claim; the NO-onPress force-decision backdrop.

**Task 2 — saved-toast → FSavedToast success pill (D-11)**
- Re-skinned the toast from the neutral `surface` pill to a `forge-success` bg pill (box styling via className per the NativeWind rule; position + a success-tinted glow shadow inline), with a white `<Icon name="check" strokeWidth={3} />` inside a translucent-white circle, bottom-centered above the tab bar (`bottom: 92` kept — UAT-tuned TabBar clearance).
- Kept the existing `Animated.View entering={FadeIn} exiting={FadeOut}` wrapper (per Claude's Discretion — either FadeIn or the §07 spring is acceptable; FadeIn is the proven precedent and stays inline). Copy `t("sessionSaved")` unchanged.
- Added a `success` token to the file-local `TOKENS` hex map (light `#1E9E45` / dark `#30D158`, mirroring `tailwind.config.js`) for the pill's glow shadow color.
- **Preserved byte-for-byte:** the `previousActiveRef` transition watcher and the 2s `setTimeout` edge-trigger (the offline-critical toast logic).

## Deviations from Plan

None — plan executed as written. Both tasks are chrome-only re-skins; no auto-fixes were required (tsc + lint + locale-parity were green on first run for each task).

### Minor additive notes (not deviations)
- Added a module-scope `AnimatedPressable` and a `success` entry to the local `TOKENS` map — both are mechanical enablers for the spring backdrop and the toast glow respectively, fully within Task scope.
- No new locale keys were added (the plan consumes keys 11-01 shipped); `check:locale-parity` stays at 160 keys, sv/en identical.

## Out of Scope (intentional)
- The active-workout screen overlay (`AvslutaOverlay`) finish re-skin is **plan 11-02's** domain. This plan only touched `(tabs)/index.tsx`.

## Known Stubs
None. Both surfaces render real data (draft session plan name / set count / start time; the toast fires on the real finish-session edge). No placeholder/hardcoded values introduced.

## Threat Flags
None. No new network endpoint, auth path, query/mutation, or schema surface — presentational re-skin only. Threat register T-11-08/09/10 dispositions (all `accept`) hold: `finishSession.mutate` (not mutateAsync) unchanged with the force-decision backdrop preserved; the meta strip renders the user's own already-authorized draft data (no new fetch); the §07 spring + FadeIn are inline Reanimated entrances that never touch the write path or the 2s timer. T-11-SC: no new packages installed.

## Verification
- `cd app && npx tsc --noEmit` → exit 0 (both tasks).
- `cd app && npx expo lint` → exit 0 (0 errors, 0 warnings, both tasks).
- `cd app && npm run check:locale-parity` → PASS (160 keys, sv/en identical — no keys added).
- Source audit: `shouldShowDraftOverlay`/`isColdStartDraft` present; `finishSession.mutate` (not mutateAsync) unchanged; `previousActiveRef` watcher + `setTimeout(..., 2000)` unchanged; `variant="destructive"` End-session + `icon="play"` Resume + `name="clock"` meta strip + "Live" pill present; `withSpring` / `damping: 18` spring present; no `Modal` import/usage (both `Modal` string matches are in comments).
- No file deletions in either commit.

## Self-Check: PASSED
- FOUND: app/app/(app)/(tabs)/index.tsx
- FOUND commit: 4d3afdd (DraftResumeOverlay re-skin)
- FOUND commit: 6bbb0fd (saved-toast re-skin)
