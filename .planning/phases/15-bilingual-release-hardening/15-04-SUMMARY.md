---
phase: 15-bilingual-release-hardening
plan: 04
subsystem: release-qa
tags: [i18n, uat, device-verification, I18N-03, I18N-02, D-05, D-06, SC3, SC4]
requires:
  - "Plan 01 i18n-coverage gate (test:i18n-coverage)"
  - "Plan 02 tab-icon scale animation (SC4 motion)"
  - "Plan 03 I18N-02 resolver close-out (test:locale-resolve)"
provides:
  - "I18N-03 manual half closed — device UAT sweep approved across 12 screens × 4 combos"
  - "I18N-02 runtime/device half confirmed (language-toggle on hardware)"
  - "SC3 final regression gate green (automated + device)"
  - "SC4 confirmed on device (tab-icon spring premium + ≤3s log-a-set budget)"
affects:
  - ".planning/phases/15-bilingual-release-hardening/15-UAT.md"
tech-stack:
  added: []
  patterns:
    - "Device-UAT iteration: blocking human-verify checkpoint walked on real iPhone (Expo Go), one fix per loop"
    - "Screen×combo matrix as auditable release-gate artifact (12 screens × 4 combos + hard-to-reach states)"
key-files:
  created:
    - ".planning/phases/15-bilingual-release-hardening/15-UAT.md"
  modified: []
decisions:
  - "D-05/D-06: device sweep approved with all hard-to-reach states driven; happy-path-only explicitly rejected as insufficient."
  - "FIT-107: test:f13-brutal no-op (no session in last 60 min) recorded as environmental fixture-window condition, not a regression."
metrics:
  duration: ~device sweep + close-out
  tasks_completed: 3
  files_modified: 1
  completed: 2026-06-17
---

# Phase 15 Plan 04: Release-Candidate Device UAT Summary

The manual half of I18N-03 — a four-combo (`sv-light` / `sv-dark` / `en-light` /
`en-dark`) device sweep across all 12 router screens — is complete and **approved on a
real iPhone**. The automated release-regression gate (SC3) is green, the I18N-02
runtime/device language-toggle (D-02) is confirmed on hardware, and SC4 (tab-icon spring
+ ≤3s log-a-set budget) is verified by feel. Phase 15 is now fully hardened for release.

## What Was Built

This plan delivered the auditable release-gate artifact `15-UAT.md` (NEW) and drove it to
a clean sign-off. It is the verification half of the phase — no application code changed
here; the value is the recorded, on-device proof that the bilingual work from Plans 01–03
holds across every screen, theme, and language combination, including the hard-to-reach
states that static analysis cannot reach.

## Tasks

### Task 1: Scaffold 15-UAT.md screen×combo matrix (auto)

- Created `15-UAT.md` — 12 router screens × 4 combo columns, plus a hard-to-reach-state
  roll-up (error / empty / offline / PR celebration / rest timer), an I18N-02
  language-toggle checklist, and an SC4 motion + hot-path-budget checklist.
- D-06 pass criteria documented in the header (no truncation, no fallback key, no
  theme-contrast miss; happy-path-only insufficient).
- `_forge-gallery.tsx` and all `_layout.tsx` correctly excluded as non-user-facing.
- Commit: `c019ebb`.

### Task 2: Run the final automated regression gate (auto)

Ran the full release-regression suite from `app/` and recorded each exit code in the
`15-UAT.md` "Regression gate" section:

| Command | Exit | Result |
|---------|:----:|--------|
| `test:i18n-coverage` | 0 | PASS — 34 files, 205 flat keys + namespaces; no missing `t()` key |
| `check:locale-parity` | 0 | PASS — sv/en key sets match (205 keys) |
| `test:locale-resolve` | 0 | PASS — all 7 D-11 resolver cases |
| `test:rls` | 0 | PASS — all cross-user assertions (access-control V4 intact) |
| `test:f13-brutal` | 0 | NO-OP — no session in last 60 min; environmental per FIT-107, not a regression |

Automated half of SC3 green. Commit: `ace92cb`.

### Task 3: Device UAT sweep — sv/en × light/dark across every screen (checkpoint:human-verify, blocking)

- Walked all 12 screens through all 4 combos on a real iPhone (Expo Go, SDK 54).
- All cells clean: no truncated text, no empty/fallback key, no theme-contrast miss.
- Hard-to-reach states (error, empty, offline, PR celebration, rest timer) deliberately
  driven in each combo — clean.
- No `[i18n] MISSING KEY` LogBox output observed (Plan 01's dev-only handler stayed quiet).
- **I18N-02** confirmed: Swedish device → `sv`; non-Swedish device → `en`; Settings
  override flips live and wins over device locale.
- **SC4** confirmed: tab-icon spring (0.92→1) feels premium; log-a-set commits in ≤3s with
  no lag; hot path untouched.
- `expo-notifications` Expo Go warnings noted as the known SDK 53 limitation (remote
  notifications removed from Expo Go) — not a regression; local rest-timer ping is
  unaffected in a dev/release build.
- Approved by user ("godkänt") on 2026-06-17. Commit: `5c8537f`.

## Verification Results

- `15-UAT.md` exists with 12 screen rows × 4 combos, all checked, plus the states/toggle/SC4
  checklists all checked and the Approval line marked APPROVED.
- Automated regression gate green (4/4 hard gates exit 0; `test:f13-brutal` no-op recorded
  as FIT-107 environmental).
- Device sweep approved across all combos including hard-to-reach states.

## Deviations from Plan

None — plan executed as written. Tasks 1–2 ran autonomously; Task 3 halted correctly at
the blocking human-verify checkpoint and resumed on user approval. No UAT misses were found,
so no Linear bug needed to be filed during the sweep.

## Decisions Made

- **Device sweep approved with full hard-to-reach-state coverage (D-05/D-06).** The sign-off
  is not happy-path-only; every listed state was driven in every combo.
- **`test:f13-brutal` no-op treated as environmental (FIT-107).** No workout session in the
  last 60 min means the fixture window is empty; the script imports nothing from `app/app/**`,
  so a count-only no-op is not a regression.

## Notes / Follow-ups

- For a positive `test:f13-brutal` count assertion (vs. the no-op), re-run within 60 min of a
  fresh 25-set device session.
- This plan ran inline (sequential, no worktree) as the resumed checkpoint; STATE.md and
  ROADMAP.md are updated by the orchestrator after this SUMMARY.

## Self-Check: PASSED

- FOUND: `.planning/phases/15-bilingual-release-hardening/15-04-SUMMARY.md`
- FOUND: commit `c019ebb` (Task 1 — matrix scaffold)
- FOUND: commit `ace92cb` (Task 2 — regression gate recorded)
- FOUND: commit `5c8537f` (Task 3 — device UAT sweep approved)
