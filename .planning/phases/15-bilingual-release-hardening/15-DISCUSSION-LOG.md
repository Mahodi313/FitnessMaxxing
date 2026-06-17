# Phase 15: Bilingual & Release Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-16
**Phase:** 15-bilingual-release-hardening
**Areas discussed:** i18n coverage audit, Missing-key regression gate, UAT matrix & tracking, Remaining motion animations

---

## i18n Coverage Audit — method

| Option | Description | Selected |
|--------|-------------|----------|
| Verktyg + manuell (båda) | New static scan extracting t() keys from app/app/** + app/components/**, assert each in sv.json, flag JSX literals bypassing t(); device UAT catches the rest | ✓ |
| Endast verktyg | Static scan only; misses right-key-wrong-translation + layout breakage | |
| Endast manuell | Device sweep only; no regression gate, risks missing keys in hard-to-reach states | |

**User's choice:** Verktyg + manuell (båda)
**Notes:** Parity gate (sv↔en) already exists; the new tool targets the two gaps it can't see — t()-call coverage and hardcoded strings.

## i18n Coverage Audit — I18N-02 reconciliation

| Option | Description | Selected |
|--------|-------------|----------|
| Verifiera & stäng i Fas 15 | Confirm device-locale-default + Settings-override during UAT, cover D-11 in test:locale-resolve, mark I18N-02 Complete | ✓ |
| Lämna utanför scope | Touch only I18N-03; leaves a Pending requirement dangling into milestone close | |

**User's choice:** Verifiera & stäng i Fas 15
**Notes:** Resolver code (resolveLanguage + LocaleBootstrap) already exists; this verifies + marks complete rather than building.

---

## Missing-Key Regression Gate — placement

| Option | Description | Selected |
|--------|-------------|----------|
| CI + slutregressionssvit | npm script (test:i18n-coverage), required in phase-branch.yml CI, AND a final regression gate alongside test:f13-brutal + RLS | ✓ |
| Endast lokalt npm-script | Script but not wired to CI; no future regression protection | |
| Engångsaudit, ingen grind | Run once, keep no script; no protection at all | |

**User's choice:** CI + slutregressionssvit

## Missing-Key Regression Gate — dev-time alarm

| Option | Description | Selected |
|--------|-------------|----------|
| missingKeyHandler i __DEV__ | console.error/throw on missing key in __DEV__; keep fallbackLng:'sv' for prod | ✓ |
| Ingen ändring av i18n.ts | Rely on CI + UAT only; missing keys surface late as silent sv fallback | |

**User's choice:** missingKeyHandler i __DEV__
**Notes:** Keep the synchronous module-load init untouched; only add dev-time loudness.

---

## UAT Matrix & Tracking — tracking format

| Option | Description | Selected |
|--------|-------------|----------|
| UAT.md skärm×kombo-matris | 15-UAT.md, row per screen × column per combo (sv-light/sv-dark/en-light/en-dark), device checklist, auditable artifact | ✓ |
| Bara en skärmlista, ett tema-pass | Screen list, one sweep, no formal 4-combo matrix; easier to miss a combo | |
| Ad hoc, ingen artefakt | Test by feel, no checklist; no auditable proof | |

**User's choice:** UAT.md skärm×kombo-matris

## UAT Matrix & Tracking — pass criteria

| Option | Description | Selected |
|--------|-------------|----------|
| Layout-brott + alla states | Focus Swedish-longer truncation/wrap/overflow + reach error/empty/offline/PR/rest-timer states; pass = no truncated text / empty key / contrast miss in any combo | ✓ |
| Endast happy-path-skärmar | Sweep main screens in normal state; misses where missing keys + breaks hide | |

**User's choice:** Layout-brott + alla states

---

## Remaining Motion Animations — scope

| Option | Description | Selected |
|--------|-------------|----------|
| Audit-driven, applicera bara gap | Review all 8 motion-table rows vs code, apply only confirmed gaps (likely tab-bar icon scale + reorder ScaleDecorator); no reinvented motion | ✓ |
| Anta klart, bara verifiera i UAT | Treat motion done, only observe in UAT; risks silently-missing micro-interactions | |
| Full motion-pass-genomgång | Polish all 8 rows regardless of status; approaches scope creep for a hardening phase | |

**User's choice:** Audit-driven, applicera bara gap
**Notes:** 6/8 table rows demonstrably already implemented; only tab-bar icon scale 0.92→1 + reorder ScaleDecorator are likely candidates.

## Remaining Motion Animations — hot-path guard

| Option | Description | Selected |
|--------|-------------|----------|
| Rör ej hot-path; UI-thread only | Candidate animations sit outside log-a-set path; apply only Reanimated UI-thread worklets; no change to (tabs)/index.tsx write passage | ✓ |
| Mät set-logg-tid efteråt | Allow changes but time-measure log-a-set afterward to confirm ≤3s | |

**User's choice:** Rör ej hot-path; UI-thread only
**Notes:** MOTN-01 ≤3s budget must hold.

---

## Claude's Discretion

- Exact form of the static-scan tool (regex/grep vs lightweight AST) — pick whatever reliably enumerates t('...') keys + JSX literals.
- Precise screen list/ordering inside 15-UAT.md — enumerate from the router tree; the 4-combo × every-screen shape is fixed.
- Whether missingKeyHandler console.errors vs throws in __DEV__ — choose loudest non-crashing option.

## Deferred Ideas

Future App-Store-launch milestone (none in Phase 15 scope):
- Apple Sign-In (F14 / FIT-45)
- TestFlight via EAS Build (Windows-only credential flow)
- Email-confirmation deep-link handler (F1.1 / FIT-46)
- App-Store-grade expanded user/account data model
- Set-type toggling under active workout (F17-UI)
