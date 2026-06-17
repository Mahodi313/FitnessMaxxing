---
phase: 15
slug: bilingual-release-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-16
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 15-RESEARCH.md §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Project convention: standalone `tsx` scripts with table-of-cases + exit-code gate (no Jest/Vitest) |
| **Config file** | none — each gate is an npm script in `app/package.json` |
| **Quick run command** | `cd app && npm run test:i18n-coverage` (new) |
| **Full suite command** | `cd app && npm run test:i18n-coverage && npm run check:locale-parity && npm run test:locale-resolve && npm run test:rls && npm run test:f13-brutal` |
| **Estimated runtime** | ~60–120 seconds (f13-brutal + RLS dominate) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:i18n-coverage` (the new gate) + the relevant existing gate for the touched area.
- **After every plan wave:** Run the full suite above.
- **Before `/gsd:verify-work`:** Full suite must be green AND `15-UAT.md` fully checked across all 4 combos.
- **Max feedback latency:** ~120 seconds.

---

## Per-Task Verification Map

| Task Area | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|-----------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| i18n coverage scan (t() + hardcoded) | coverage | 1 | I18N-03 | T-15-02 | CI gate is a hard step, no `continue-on-error` | unit (tsx) | `npm run test:i18n-coverage` | ❌ W0 | ⬜ pending |
| dev missingKeyHandler | coverage | 1 | I18N-03 | T-15-01 | dev-only; no production leak | manual + build | `__DEV__` gate present; prod `expo export` shows no missing-key output | ❌ W0 | ⬜ pending |
| I18N-02 resolver close-out | i18n-recon | 1 | I18N-02 | — | resolver returns only `'sv'\|'en'` | unit (tsx) | `npm run test:locale-resolve` | ✅ | ⬜ pending |
| CI gate wiring | coverage | 2 | I18N-03 | T-15-02 | gate fails job on exit 1 | CI | `phase-branch.yml` `test` job contains `test:i18n-coverage` | ✅ | ⬜ pending |
| tab-bar icon scale motion | motion | 1 | MOTN (already Complete) | — | UI-thread worklet, hot-path untouched | manual + automated | visual UAT (tab switch) + `npm run test:f13-brutal` | ✅ | ⬜ pending |
| sv/en × light/dark device UAT | uat | 2 | I18N-03 / I18N-02 | — | every screen renders in 4 combos | manual device | `15-UAT.md` matrix all-checked | ❌ W0 | ⬜ pending |
| final regression gate | uat | 2 | I18N-03 | T-15-02 | F13 + cross-user RLS green | automated | `npm run test:f13-brutal` + `npm run test:rls` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Success Criteria → Validation Map

| Success Criterion | Behavior | Validation Type | Command / Artifact |
|-------------------|----------|-----------------|--------------------|
| SC1 (zero missing keys, every screen) | every `t()` key exists + no bypassed literal | automated | `npm run test:i18n-coverage` (exit 0) |
| SC1 (right translation, no layout break) | wrong-translation / truncation / wrap | manual device | `15-UAT.md` rows × 4 combos |
| SC2 (full sv/en × light/dark UAT) | every screen renders in 4 combos | manual device | `15-UAT.md` matrix all-checked |
| SC3 (final regression gate) | F13 + cross-user RLS green | automated | `npm run test:f13-brutal` + `npm run test:rls` (both exit 0) |
| SC4 (motion applied, hot-path intact) | tab-icon scale present; ≤3s log-a-set holds | manual + automated | visual UAT (tab switch) + `npm run test:f13-brutal` (budget gate) |
| I18N-02 (D-02 close-out) | D-11 device→engine mapping | automated + manual | `npm run test:locale-resolve` (7 cases) + UAT language-toggle |
| I18N-03 (primary) | both languages complete | automated + manual | `test:i18n-coverage` + `15-UAT.md` |

---

## Wave 0 Requirements

- [ ] `app/scripts/check-i18n-coverage.ts` — NEW; covers SC1 / I18N-03 (t()-coverage + hardcoded-string gate). Clone the `check-locale-parity.ts` tsx exit-code pattern.
- [ ] `app/package.json` script `test:i18n-coverage` → `tsx scripts/check-i18n-coverage.ts`.
- [ ] `15-UAT.md` matrix scaffold (every router screen × 4 combos) — covers SC2.
- [ ] `test-locale-resolve.ts` — already covers all 7 D-11 cases; **no gap** unless UAT reveals an uncovered device-locale case. Existing coverage is sufficient to mark I18N-02 Complete.
- [ ] Framework install: none — `tsx` already present.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Right-key-wrong-translation / context / inflection | I18N-03 | Static scan proves key presence, not correctness | Device sweep per `15-UAT.md`, all 4 combos |
| Layout breakage (Swedish-longer truncation, button overflow, tab/label wrap) | I18N-03 | Layout depends on rendered string length × theme | `15-UAT.md` — prioritize buttons, single-line truncation, tab-bar labels |
| Hard-to-reach states (error, empty, offline, PR celebration, rest timer) | I18N-03 | Missing keys hide in states static analysis can't drive | Deliberately drive into each state in each combo |
| Tab-bar icon scale 0.92→1 feel | SC4 / MOTN | Animation "feel" is subjective + UI-thread | Switch tabs on device, confirm premium spring, no hot-path lag |
| Language-toggle resolver runtime behavior | I18N-02 | Runtime device-locale path can't be fully unit-tested | UAT: set device sv/en + Settings override, confirm resolved language |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`check-i18n-coverage.ts`, `15-UAT.md` scaffold)
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
