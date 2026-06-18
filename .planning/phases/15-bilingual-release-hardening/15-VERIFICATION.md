---
phase: 15-bilingual-release-hardening
verified: 2026-06-17T22:10:00Z
status: passed
score: 4/4 must-haves verified
verdict: VERIFIED-WITH-CAVEATS
overrides_applied: 0
re_verification: # No previous VERIFICATION.md existed
  previous_status: null
caveats:
  - "test:f13-brutal exits 0 as a NO-OP (no workout_session in the last 60 min) — the FIT-107 environmental fixture-window condition, NOT a code regression. The script imports nothing from app/app/**; a positive count assertion requires re-running within 60 min of a fresh 25-set device session."
  - "Device UAT (SC2) is a human-approved artifact (15-UAT.md, signed APPROVED 2026-06-17). On-device 'feel'/visual correctness across 12 screens × 4 combos cannot be re-verified programmatically by the verifier; it is trusted on the recorded human sign-off."
  - "REQUIREMENTS.md still shows I18N-03 as Pending / unchecked (lines 70, 157) even though the phase that owns it is now complete (4/4 plans, device UAT approved). This is a requirements-bookkeeping lag — the implementation evidence is fully present — but the row was not flipped to Complete the way I18N-02 was in Plan 03. Recommend flipping I18N-03 → Complete to match the closed phase."
---

# Phase 15: Bilingual & Release Hardening — Verification Report

**Phase Goal:** Close i18n coverage to zero missing keys and run the full release-candidate UAT across both languages and themes.
**Verified:** 2026-06-17T22:10:00Z
**Status:** passed
**Top-line verdict:** ✅ **VERIFIED-WITH-CAVEATS**
**Re-verification:** No — initial verification.

The phase goal is achieved in the codebase. All four ROADMAP success criteria are backed by real, substantive, wired artifacts — confirmed by the verifier running the gates in its own process (not by trusting SUMMARY claims). Three caveats apply, none of which block the goal: the f13-brutal fixture-window no-op (FIT-107, environmental), the human-only nature of the device UAT, and a REQUIREMENTS.md bookkeeping lag on the I18N-03 row.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every screen renders complete in both Swedish and English with no missing keys or layout breakage | ✓ VERIFIED | Verifier ran `npm run test:i18n-coverage` → **PASS, exit 0** (34 files, 205 flat keys + `exercise.`/`equip.` namespaces; zero missing `t()` keys, zero bypassed JSX literals). `check:locale-parity` → **PASS, exit 0** (sv/en key sets match at 205 keys). Layout/visual completeness across all 12 screens covered by the human-approved 15-UAT.md (caveat 2). |
| 2 | A full sv/en × light/dark device UAT passes on real iPhone hardware | ✓ VERIFIED (human-approved) | `15-UAT.md` = 12 router screens × 4 combos (`sv-light`/`sv-dark`/`en-light`/`en-dark`), all cells ☑, hard-to-reach states (error/empty/offline/PR celebration/rest timer) driven in every combo, I18N-02 language-toggle checklist all ☑, SC4 motion checklist all ☑. Sign-off line: **✅ APPROVED on device (2026-06-17)**. No `[i18n] MISSING KEY` LogBox output observed. (Human-verified artifact — caveat 2.) |
| 3 | `npm run test:f13-brutal` and the cross-user RLS test pass as the final regression gate | ✓ VERIFIED | Verifier ran `npm run test:rls` → **"ALL ASSERTIONS PASSED", exit 0** (Phase 2→13 cross-user batteries incl. Phase 13 PR RPCs). Verifier ran `npm run test:f13-brutal` → **exit 0** (NO-OP: "No workout_sessions found in the last 60 min" — the FIT-107 environmental fixture-window condition, not a regression; caveat 1). |
| 4 | Remaining design motion-table animations are applied and feel premium without breaching the hot-path budget | ✓ VERIFIED | `app/app/(app)/(tabs)/_layout.tsx`: `ForgeTabButton` child component owns per-tab `useSharedValue`/`useEffect`/`useAnimatedStyle`; active icon springs `0.92 → 1` via `withSpring(SPRING)` where `SPRING = { damping: 18, stiffness: 220 }` (Forge §07 curve). `<Icon>` wrapped in `<Animated.View style={iconStyle}>`. Hot path (`(tabs)/index.tsx`) untouched (D-08). "Premium feel" + ≤3s log-a-set budget confirmed on device in 15-UAT.md SC4 section. |

**Score:** 4/4 truths verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/scripts/check-i18n-coverage.ts` | t()-coverage + hardcoded-string scan (Node-only exit-code gate) | ✓ VERIFIED | 177 lines. Contains `NESTED_PREFIXES = ["exercise.", "equip."]`, literal-only regex `\bt\(\s*['"]([^'"]+)['"]`, `keyIsCovered()`, hardcoded-string exclusion header comment, `EXCLUDED_FILES` + `EXPR_ARTIFACT` guards (the documented auto-fixes), Node-only header note. Runs green live (exit 0). |
| `app/package.json` (script) | `test:i18n-coverage` npm script | ✓ VERIFIED | Line 36: `"test:i18n-coverage": "tsx scripts/check-i18n-coverage.ts"` (no env file — pure source scan). |
| `app/lib/i18n.ts` | `__DEV__`-gated `missingKeyHandler` + `saveMissing` | ✓ VERIFIED | Lines 53–58: `saveMissing: __DEV__` and `missingKeyHandler: __DEV__ ? (...) => console.error(\`[i18n] MISSING KEY: "${key}"\`) : undefined` (console.error, NOT throw). `fallbackLng: "sv"`, `compatibilityJSON: "v4"`, `interpolation.escapeValue: false`, the `lng:` line, and `resolveLanguage` export all unchanged. |
| `.github/workflows/phase-branch.yml` | hard i18n coverage CI step | ✓ VERIFIED | Lines 64–65: `- name: i18n coverage gate / run: npm run test:i18n-coverage` in the `test` job, sibling of the RLS step. NO `continue-on-error`, NO `|| true`, no env block. Fails the job on exit 1 exactly like `test:rls` (T-15-02 honored). |
| `app/app/(app)/(tabs)/_layout.tsx` | tab-icon scale spring (ForgeTabButton) | ✓ VERIFIED | `ForgeTabButton` extracted at module scope; `withSpring`/`useSharedValue`/`useAnimatedStyle` present; `SPRING = { damping: 18, stiffness: 220 }`; accessibility props (`tab`/`selected`/label) preserved; FIT-66 className-not-style rule honored. |
| `app/scripts/test-locale-resolve.ts` | D-11 resolver test (I18N-02) | ✓ VERIFIED | 7-case table covering explicit sv/en, explicit-wins-over-device, system→sv (Swedish device), system→en (en/de/empty). Runs green live (7/7, exit 0). Imports the pure `resolveLanguageCore`. |
| `.planning/REQUIREMENTS.md` (I18N-02) | row flipped to Complete | ✓ VERIFIED | Line 69 `- [x] **I18N-02**`; line 128 `\| I18N-02 \| Phase 9 \| Complete \|`. `grep "I18N-02.*Pending"` → 0. |
| `.planning/phases/15-.../15-UAT.md` | screen×combo UAT matrix, signed | ✓ VERIFIED | 12 screens × 4 combos, all checked; states/toggle/SC4/regression sections all ☑; APPROVED 2026-06-17. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `check-i18n-coverage.ts` | `app/locales/sv.json` | `import sv from "../locales/sv.json"` | ✓ WIRED | Line 58; `flatKeys = new Set(Object.keys(sv))` is the assertion source. |
| `phase-branch.yml` test job | `test:i18n-coverage` | hard run step, no suppression | ✓ WIRED | Lines 64–65, no `continue-on-error`/`|| true`. |
| `app/lib/i18n.ts` | app runtime | `import "@/lib/i18n"` (side-effect) | ✓ WIRED | `app/app/_layout.tsx:41` imports for side-effect; `:47`/`:52` import the engine + resolveLanguage; `settings.tsx:74` uses `resolveLanguage` for the live language toggle. |
| `ForgeTabBar` | `ForgeTabButton` | per-tab child in `state.routes.map()` | ✓ WIRED | `_layout.tsx:176` renders `<ForgeTabButton>` per route; hooks isolated per instance (Rules-of-Hooks safe). |
| `test-locale-resolve.ts` | `resolve-language.ts` | `import resolveLanguageCore` | ✓ WIRED | Line 16; covers the engine resolver 1:1. |

### Behavioral Spot-Checks (verifier-run)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| i18n coverage = zero missing keys | `npm run test:i18n-coverage` | exit 0 — 34 files, 205 keys + namespaces | ✓ PASS |
| sv/en key parity | `npm run check:locale-parity` | exit 0 — 205 keys match | ✓ PASS |
| D-11 resolver mapping | `npm run test:locale-resolve` | exit 0 — 7/7 cases | ✓ PASS |
| Cross-user RLS regression | `npm run test:rls` | exit 0 — ALL ASSERTIONS PASSED | ✓ PASS |
| Hot-path budget gate | `npm run test:f13-brutal` | exit 0 — NO-OP (no session <60 min) | ✓ PASS (FIT-107 environmental) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| I18N-03 | 15-01, 15-04 | Both Swedish and English complete, no missing keys across every screen | ✓ SATISFIED (impl) / ⚠️ row not flipped | Automated half: `test:i18n-coverage` green + CI-wired. Manual half: 15-UAT.md APPROVED. **But REQUIREMENTS.md still shows `- [ ] I18N-03` (line 70) and `\| I18N-03 \| Phase 15 \| Pending \|` (line 157).** Implementation evidence is complete; only the bookkeeping row was not updated (caveat 3). |
| I18N-02 | 15-03 | App language follows device locale by default + Settings override | ✓ SATISFIED | `test:locale-resolve` 7/7 green; row flipped to Complete (lines 69, 128); device toggle confirmed in 15-UAT.md. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | No `TBD`/`FIXME`/`XXX`/`HACK`/`PLACEHOLDER` in any phase-modified file | — | Clean. No unreferenced debt markers, no stubs, no orphaned artifacts. |

### Human Verification

The device UAT (SC2) was completed and signed by the user on 2026-06-17 (15-UAT.md "✅ APPROVED on device"). No further human verification is required — the recorded sign-off satisfies SC2. On-device visual/feel correctness is inherently human-verified and is trusted on that sign-off (caveat 2).

### Gaps Summary

No goal-blocking gaps. The phase goal — zero missing i18n keys plus a full sv/en × light/dark release-candidate UAT — is achieved and independently re-confirmed by the verifier running every automatable gate (i18n-coverage, locale-parity, locale-resolve, RLS) to green exit codes, plus the human-approved device UAT artifact.

Three non-blocking caveats:
1. **FIT-107 f13-brutal no-op** — environmental fixture window (no workout session in last 60 min), explicitly recognised in project memory and the phase context; not a regression.
2. **Device UAT is human-approved** — visual/feel cells cannot be re-run by the verifier; trusted on the recorded sign-off.
3. **I18N-03 bookkeeping lag** — the requirement row in REQUIREMENTS.md (lines 70, 157) is still `Pending`/unchecked despite the phase being complete and all implementation evidence present. Recommend flipping I18N-03 → Complete (mirroring the I18N-02 flip done in Plan 03) so the requirements ledger matches the closed phase. This is a documentation update, not a code gap.

---

_Verified: 2026-06-17T22:10:00Z_
_Verifier: Claude (gsd-verifier)_
