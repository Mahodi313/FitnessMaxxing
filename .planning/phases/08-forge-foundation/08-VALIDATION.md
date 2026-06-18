---
phase: 8
slug: forge-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-09
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> **D-07 reality:** there is NO RN component-render test harness in the stack. The dev-only
> gallery route (`app/(app)/_forge-gallery.tsx`) IS the test surface; primary verification is
> manual device UAT in Expo Go. This file pins the *cheap automatable* checks that still apply
> (tsc, lint, locale-parity, F13 regression) so execution never goes 3 tasks without a signal.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None for RN component rendering (D-07). Static analysis (tsc + expo lint) + the gallery-as-UAT surface. |
| **Config file** | none — type/lint configs already in `app/` |
| **Quick run command** | `cd app && npx tsc --noEmit` |
| **Full suite command** | `cd app && npx tsc --noEmit && npm run lint && npm run test:f13-brutal` |
| **Estimated runtime** | ~30–60 seconds (tsc + lint); f13-brutal adds its existing runtime |

---

## Sampling Rate

- **After every task commit:** Run `cd app && npx tsc --noEmit` (catches token-class typos, prop-type mismatches, bad font/locale `require()`s)
- **After every plan wave:** Run `cd app && npx tsc --noEmit && npm run lint` + manual gallery smoke (open gallery, flip dark/light, flip sv↔en)
- **Before `/gsd:verify-work`:** Full suite green — `npx tsc --noEmit && npm run lint && npm run test:f13-brutal` — AND full gallery UAT in Expo Go on a physical iPhone (every section renders in both themes + both locales)
- **Max feedback latency:** ~60 seconds (static checks)

---

## Per-Task Verification Map

> Filled per task during execution. Most rows are `manual` (gallery UAT) by D-07; the
> `static` rows below are the always-available automated signal.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (per-plan) | — | — | DSGN-01 | — | tokens resolve | static | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| (per-plan) | — | — | I18N-01 | T-08 (tamper) | sv/en key parity | static | `npx tsx scripts/check-locale-parity.ts` | ❌ W0 | ⬜ pending |
| (per-plan) | — | — | I18N-04 | — | `fmtNum`/`fmtDate` correct | static (pure fn) | gallery + (optional) pure-fn check | ❌ W0 | ⬜ pending |
| (per-plan) | — | — | DSGN-02..06 | — | primitives render | manual | — (gallery UAT) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `app/components/ui/` — directory does not exist yet (create)
- [ ] `app/assets/fonts/` — directory + 4 OFL font files (InterDisplay-Regular/SemiBold/Bold + JetBrainsMono-Regular), committed not gitignored
- [ ] `app/locales/` — directory + `sv.json`/`en.json` transcribed from `lib.jsx` I18N (D-09)
- [ ] `app/scripts/check-locale-parity.ts` — asserts `Object.keys(sv)` ≡ `Object.keys(en)`; the **one genuinely automatable i18n test**, reused in Phase 15 (recommend adding)
- [ ] react-i18next / expo-localization / react-native-svg installed via `npx expo install` (no manual version bumps)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Inter Display + JetBrains Mono render correctly | DSGN-02 | Font rendering only observable on device | Open gallery type-scale section in Expo Go; confirm display headings + mono cells use the bundled faces (not system) |
| Numerals align (tabular) | DSGN-03 | Visual alignment | Gallery: a column of stacked numbers must align digit-for-digit |
| Every primitive renders in every variant/size, light+dark | DSGN-04 | No RN render harness (D-07) | Gallery component matrix; toggle theme; confirm each variant/size |
| ProgressRing + Sparkline render via Skia | DSGN-05 | Skia canvas visual | Gallery: ring at several `value`s; sparkline with sample data; static (no animation — that's Phase 12) |
| Logo (gradient + white) + AppIcon render | DSGN-06 | Visual | Gallery brand section, both variants |
| sv↔en string flip + locale number/date format | I18N-01, I18N-04 | On-device locale behaviour | Gallery toggle flips sample string; numbers show `1 234,5` (sv) vs `1,234.5` (en); dates format per locale |
| F13 offline queue undisturbed | (cross-cutting) | Regression guard | `npm run test:f13-brutal` stays green (additive change must not touch mutation defaults/query keys/persister) |

---

## Validation Sign-Off

- [ ] Every requirement has either an automated static check OR an explicit gallery-UAT step (D-07 manual rows above)
- [ ] Sampling continuity: no 3 consecutive tasks without `npx tsc --noEmit`
- [ ] Wave 0 covers all MISSING directories/assets/scripts above
- [ ] No watch-mode flags in any command
- [ ] Feedback latency < 60s for static checks
- [ ] `nyquist_compliant: true` set in frontmatter (after plans wired)

**Approval:** pending
