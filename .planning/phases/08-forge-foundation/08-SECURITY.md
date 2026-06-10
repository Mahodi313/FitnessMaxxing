---
phase: 08
slug: forge-foundation
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-10
---

# Phase 08 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan-time across all 5 plans (`register_authored_at_plan_time: true`).
> Audit verified each plan-time mitigation against the implementation — no retroactive STRIDE needed.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| npm/expo registry → build | New dependency code enters the build at install time | Third-party package code (5 net-new deps) |
| bundled JSON → i18n engine | Static first-party locale resources; no runtime external input | App-controlled locale strings + numeric interpolations |
| AsyncStorage `fm:language` → LocaleBootstrap | Persisted device value, can be corrupted/injected | Locale preference string ('sv'/'en') |
| font release zip → bundled asset | Binary font files enter the build | OFL font binaries (Inter Display, JetBrains Mono) |
| component props → render | App-controlled props (sample/numeric); no external/user input in Phase 8 | Sample data only |
| TabBar shell vs live navigation | Build-only component must not alter live routing | None (presentational, gallery-only) |
| dev route → release build | Gallery must not be reachable / show no real data in a release build | Sample data behind `(app)` session guard + `__DEV__` guard |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-08-01 | Tampering (supply chain) | npm/expo install of 5 net-new deps | mitigate | Blocking-human gate: all 5 publishers verified against live npm (i18next-org / Expo / software-mansion) before install; native pinned via `npx expo install`. Deps present at SDK-54 versions in `app/package.json`; commit `bdf8e09`. | closed |
| T-08-SC | Tampering (supply chain) | all installs | mitigate | Same human-approved gate; no `[SLOP]`/`[SUS]` packages in `package.json`. | closed |
| T-08-02 | Tampering/Injection | i18next interpolation `{{n}}`/`{{kg}}`/`{{reps}}` | accept | `escapeValue:false` safe (`i18n.ts:43`): only app-controlled numeric values interpolate; locale JSON has no markup; RN `<Text>` renders no markup. | closed |
| T-08-03 | Tampering | `fm:language` read in LocaleBootstrap | mitigate | `z.enum(["sv","en"]).catch("sv").parse(v)` at `_layout.tsx:159`; corrupt → 'sv', no crash. WR-01 fix added a write of the same literal union but left read-side validation unchanged. | closed |
| T-08-04 | Denial of Service (self) | splash gate on fontsReady/localeReady | mitigate | Both bootstraps fail-open: `FontBootstrap` flips ready on `.then`+`.catch` (`_layout.tsx:140-141`), `LocaleBootstrap` via `.finally()` (`:166`); splash gate `fontsReady && localeReady` (`:87`) cannot hang. | closed |
| T-08-05 | Tampering | malicious/corrupt font file | mitigate | Fonts sourced from official OFL releases (Inter v4.1, JetBrains Mono v2.304); 5 exact files committed in `app/assets/fonts/` (+ `OFL.txt`); loaded by `Font.loadAsync` (`_layout.tsx:135-138`). | closed |
| T-08-06 | Denial of Service (render) | ProgressRing value / Sparkline data | mitigate | `ProgressRing` clamps value 0..1 with finite guard (`ProgressRing.tsx:69`); `Sparkline` guards `data.length < 2` (`:52`) and zero-range `max-min || 1` (`:56`). | closed |
| T-08-07 | Information disclosure | rendered sample data | accept | Components + gallery render only literal sample data; no real user/PII flows in Phase 8. | closed |
| T-08-08 | Tampering (stability) | pressable primitives | mitigate | FIT-66: pressed feedback via `Pressable` style-callback + explicit iOS shadow object (`ForgeButton.tsx:143-146`/`:54-59`, `ForgeCard.tsx:82`, `SettingsRow.tsx:71,141`); zero `active:opacity-*`/`shadow-*` classes (css-interop recursion crash avoided). | closed |
| T-08-09 | Elevation/behavior drift | TabBar vs live `<Tabs>` | mitigate | OQ-5: `TabBar.tsx` standalone presentational (gallery-only); live `(tabs)/_layout.tsx` not modified by any Phase 08 commit (last touched in Phase 07 `009c194`). | closed |
| T-08-10 | Information disclosure (minor) | dev-only gallery reachable in release | mitigate | Route outside `(tabs)` with leading underscore, inside `(app)` session guard; screen body `__DEV__`-guarded (`_forge-gallery.tsx:426-437`); dev entry button `__DEV__`-wrapped (`settings.tsx:92`). Defense-in-depth, low severity. | closed |
| T-08-11 | Tampering | i18n sv↔en toggle in gallery | accept | Toggle calls `setLanguage('sv'|'en')` → `i18n.changeLanguage` with a hardcoded literal union; no free text into engine or AsyncStorage (`_forge-gallery.tsx:346-353,371,377`). WR-01 fix preserves this. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-08-01 | T-08-02 | `escapeValue:false` is safe in this stack: only app-controlled numeric values interpolate in Phase 8 and RN `<Text>` renders no markup (no XSS surface). Re-evaluate if user-supplied strings ever interpolate into translations. | gsd-security-auditor + user | 2026-06-10 |
| AR-08-02 | T-08-07 | Forge primitives + gallery render only sample/literal data in Phase 8; no real user/PII flows through them yet. Re-evaluate when real data binds in Phase 9+. | gsd-security-auditor + user | 2026-06-10 |
| AR-08-03 | T-08-11 | Gallery language toggle passes only a hardcoded `'sv'|'en'` literal union to the i18n engine and to `fm:language` — no free-text path. | gsd-security-auditor + user | 2026-06-10 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-10 | 12 | 12 | 0 | gsd-security-auditor (opus) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-10
