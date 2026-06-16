---
phase: 15-bilingual-release-hardening
plan: 01
subsystem: i18n / build-gates / CI
tags: [i18n, coverage-gate, ci, dev-loudness, release-hardening]
requires:
  - app/locales/sv.json (assertion source — 205 flat keys + exercise./equip. namespaces)
  - app/scripts/check-locale-parity.ts (Node-only exit-code gate analog)
  - i18next missingKeyHandler/saveMissing config surface
provides:
  - test:i18n-coverage (t()-coverage + hardcoded-string scan, hard CI gate)
  - __DEV__-gated missingKeyHandler (dev-time missing-key console.error, sv-fallback preserved)
  - phase-branch.yml i18n coverage gate step (release-regression protection)
affects:
  - app/app/** and app/components/** (now scanned for t() coverage + hardcoded copy on every CI run)
tech-stack:
  added: []
  patterns:
    - Node-only tsx exit-code build-gate (cloned from check-locale-parity.ts)
    - __DEV__-gated i18next options (Metro dead-code-strip in release)
key-files:
  created:
    - app/scripts/check-i18n-coverage.ts
  modified:
    - app/package.json
    - app/lib/i18n.ts
    - .github/workflows/phase-branch.yml
decisions:
  - D-01 (coverage gate proves zero missing keys; nested exercise./equip. namespaces allow-listed)
  - D-03 (gate is a hard CI step — no continue-on-error / || true)
  - D-04 (dev-time missing-key signal via console.error, NOT throw; both options __DEV__-gated)
metrics:
  duration: ~22min
  completed: 2026-06-16
  tasks: 3
  files: 4
---

# Phase 15 Plan 01: i18n Coverage Gate & Dev-Time Missing-Key Signal Summary

Built the persistent i18n coverage gate (`test:i18n-coverage`) that asserts every
statically-resolvable `t('literal')` key exists in `sv.json` and flags user-visible JSX
text that bypasses `t()`, added a `__DEV__`-gated `missingKeyHandler` to `i18n.ts` for
loud dev-time missing-key signals, and wired the gate into `phase-branch.yml` as a hard
CI step — the automatable half of I18N-03.

## What Was Built

### Task 1 — `check-i18n-coverage.ts` + npm script (commit c22f07d)
- New Node-only `tsx` script cloning the `check-locale-parity.ts` header convention,
  `sv.json` import, and exit-code gate shape.
- **Assertion 1 (t() coverage):** literal-only regex `\bt\(\s*['"]([^'"]+)['"]` collects
  keys; `keyIsCovered()` passes when the key is a flat `sv.json` key OR begins with a
  `NESTED_PREFIXES` entry (`"exercise."` / `"equip."` — runtime-concatenated namespaces).
  The literal-only pattern naturally skips `t(variable)` / `t(exerciseNameKey(...))`
  (Pitfall 2 — dynamic args are not resolved).
- **Assertion 2 (hardcoded copy):** flags letter-bearing JSX text children not wrapped in
  `{t(...)}` / `{variable}` / pure punctuation.
- Header comment documents the hardcoded-string exclusion list: `testID`, icon `name=`,
  `key=`, `href`, `className`/`style`, `console.*`, `format()` date patterns, single-glyph
  punctuation.
- `app/package.json`: `"test:i18n-coverage": "tsx scripts/check-i18n-coverage.ts"`
  (no env file — pure source scan, like `check:locale-parity`).
- Result: scans 34 files, 205 flat keys + 2 namespaces → **PASS, exit 0** (no genuine
  missing keys or bypassed literals — confirms CONTEXT/RESEARCH Open Q2: few-to-none).

### Task 2 — `__DEV__` missingKeyHandler in `i18n.ts` (commit 4b26a1a)
- Added `saveMissing: __DEV__` + a `missingKeyHandler` that is `__DEV__ ? (...) =>
  console.error(\`[i18n] MISSING KEY: "${key}"\`) : undefined`.
- `console.error`, NOT `throw` (D-04 discretion) — sv-fallback still renders; the whole
  screen surfaces all gaps in one pass.
- Both options `__DEV__`-gated so Metro dead-code-strips them from the release bundle
  (T-15-01 / Pitfall 4).
- `fallbackLng: "sv"`, `interpolation.escapeValue: false`, `compatibilityJSON: "v4"`, the
  `lng:` line, the synchronous init structure, and the `resolveLanguage` export are all
  unchanged.

### Task 3 — CI wiring in `phase-branch.yml` (commit 1ebc4c8)
- New `i18n coverage gate` step (`run: npm run test:i18n-coverage`) in the existing `test`
  job, sibling of the RLS tester.
- No env block (scan reads source + `sv.json` only, no secrets).
- No `continue-on-error`, no `|| true` — fails the job on exit 1 exactly like `test:rls`
  (D-03 / T-15-02). `defaults.run.working-directory: app` scopes `npm run` to `app/`.

## Verification

| Check | Result |
|-------|--------|
| `npm run test:i18n-coverage` | PASS — exit 0 (34 files, 205 keys + exercise./equip.) |
| `npx tsc --noEmit` | exit 0 (i18n.ts + new script type-clean) |
| `npm run check:locale-parity` (regression) | PASS — 205 keys, no drift |
| `npx expo lint` | exit 0 |
| `phase-branch.yml` hard step present | `npm run test:i18n-coverage` at line 65 |
| `continue-on-error` / `|| true` in CI file | 0 (no relaxation introduced) |
| Service-role audit (new script) | clean — no import/use; only a comment referencing the audit gate |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Scan false positives] Excluded dev-only gallery + JS-expression operator artifacts**
- **Found during:** Task 1 (first gate run reported 3 flagged literals).
- **Issue:** Assertion 2 flagged (a) `<ForgeChip>default</ForgeChip>` in `_forge-gallery.tsx`
  — a `__DEV__`-only component-demo gallery PATTERNS explicitly excludes from the UAT scan;
  and (b) `"= 0 && idx"` twice in `chart.tsx` where the `>(...)<` JSX-text regex straddled
  the comparison expression `idx >= 0 && idx < arr.length` (non-JSX TS code, not copy).
- **Fix:** Added `EXCLUDED_FILES = ["app/(app)/_forge-gallery.tsx"]` to the file enumeration
  and an `EXPR_ARTIFACT` guard that skips candidates containing JS operators (`&&`, `||`,
  `==`, `=>`, `>=`, `<=`, `??`, `idx`, `.length`, `= `).
- **Files modified:** `app/scripts/check-i18n-coverage.ts`
- **Commit:** c22f07d (folded into Task 1 before commit)

No other deviations — i18n.ts and CI wiring executed exactly as written.

## TDD Gate Compliance

Task 2 carries `tdd="true"`, but its `<verify>` block is `tsc --noEmit` (a typecheck gate),
NOT a runnable test script, and its `<behavior>` (Metro dead-code-strip + render-time
`console.error`) cannot be exercised by a Node unit test: `lib/i18n.ts` imports
`expo-localization`, which breaks under Node `tsx` (documented STATE decision 2026-06-11 —
the i18n boundary is why `resolveLanguageCore` was extracted to a pure module). The change
is a config-options edit on the i18next `.init()` object whose correctness is a build-time
(`__DEV__` gate) and inspection concern, not a behavioral assertion a RED test could express.
No `test(...)` commit was created for this task because no Node-executable test surface exists
for it. Verified instead by `tsc --noEmit` (exit 0) + the acceptance-criteria string checks
(`missingKeyHandler` + `saveMissing: __DEV__` + `console.error` not `throw` + `fallbackLng`/
`compatibilityJSON` unchanged). This is a known, documented limitation of the i18n module
boundary — not a skipped gate.

## Known Stubs

None. The coverage gate is fully wired and green; no placeholder data, no unwired
components, no TODO/FIXME introduced.

## Self-Check: PASSED

- FOUND: app/scripts/check-i18n-coverage.ts
- FOUND: app/package.json (test:i18n-coverage)
- FOUND: app/lib/i18n.ts (missingKeyHandler + saveMissing: __DEV__)
- FOUND: .github/workflows/phase-branch.yml (i18n coverage gate step)
- FOUND commit c22f07d (Task 1)
- FOUND commit 4b26a1a (Task 2)
- FOUND commit 1ebc4c8 (Task 3)
