# Phase 15: Bilingual & Release Hardening - Context

**Gathered:** 2026-06-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Close i18n coverage to **zero missing keys across every screen** and run the
full release-candidate UAT across both languages and both themes
(sv/en × light/dark) on real iPhone hardware. The final regression gate
(`test:f13-brutal` + cross-user RLS) must be green, and any genuinely-missing
Forge motion-table micro-interactions are applied without breaching the
≤3s log-a-set hot-path budget.

**This is a hardening/closeout phase — no new features.** The i18n key-parity
gate (`check-locale-parity.ts`, sv↔en) already exists and passes; all
MOTN-01…05 are already marked Complete. The work is *proving* completeness and
closing the few remaining gaps, not building new capabilities. New capabilities
(Apple Sign-In, TestFlight, set-type toggling, email deep-link) belong to the
future App-Store-launch milestone.

**Requirements:** I18N-03 (primary). I18N-02 reconciliation folded in (see D-02).
</domain>

<decisions>
## Implementation Decisions

### i18n Coverage Audit
- **D-01:** Prove "zero missing keys" with **tooling + manual device sweep (both)**.
  - **Tooling:** a new static scan that extracts every `t('...')` key referenced
    in `app/app/**` + `app/components/**`, asserts each key exists in
    `app/locales/sv.json` (the authored primary), AND flags user-visible JSX
    string literals that bypass `t()`. This is a NEW check — `check-locale-parity.ts`
    only verifies sv↔en parity, not `t()`-call coverage or hardcoded strings.
  - **Manual:** the device UAT (D-05/D-06) catches what static analysis cannot —
    right-key-wrong-translation, context/inflection, and layout breakage.
- **D-02:** **Verify & close I18N-02 in this phase.** The device-locale-default +
  Settings-override resolver code (`resolveLanguage` + the Phase-9 LocaleBootstrap)
  already exists but I18N-02 is still marked *Pending*. Confirm it actually works
  during the sv/en UAT, ensure `test:locale-resolve` covers the D-11 mapping
  (Swedish device → sv, anything else → en), and mark I18N-02 Complete so the
  i18n requirement rows are clean at milestone close.

### Missing-Key Regression Gate
- **D-03:** The new coverage check becomes a **persistent CI + final-regression
  gate**. Add it as an npm script (e.g. `test:i18n-coverage`), require it in
  `.github/workflows/phase-branch.yml` alongside tsc/lint/RLS, AND count it as
  one of the final release-regression gates together with `test:f13-brutal` and
  the cross-user RLS test. Future missing keys are caught automatically.
- **D-04:** Add a **`missingKeyHandler` in `__DEV__`** to `app/lib/i18n.ts` that
  `console.error`s (or throws in `__DEV__`) when a key is missing, so gaps surface
  immediately on device during development — not just in CI as a silent sv
  fallback. **`fallbackLng: 'sv'` stays unchanged** for production behavior; only
  the dev-time loudness is added. Keep the change minimal — do not disturb the
  synchronous module-load init.

### Release UAT (sv/en × light/dark)
- **D-05:** Track the sweep with a **`15-UAT.md` screen×combo matrix** — one row
  per screen, one column per combo (sv-light / sv-dark / en-light / en-dark),
  checked off on real device. Produces the auditable closeout artifact for the
  milestone and matches the established device-UAT-iteration pattern.
- **D-06:** **Pass criteria = layout-breakage + all states.** Focus on where
  bilingual UIs actually break: Swedish strings run longer than English →
  truncation / wrap / button overflow; AND reaching hard-to-hit states (error,
  empty, offline, PR celebration, rest timer) where a missing key hides. Pass =
  no truncated text, no empty/fallback key, no theme-contrast miss in ANY of the
  four combos. Happy-path-only is NOT sufficient.

### Remaining Motion Animations
- **D-07:** **Audit-driven — apply only confirmed gaps.** 6 of the 8 Forge
  motion-table rows are already implemented (set-logged, PR celebration, activity
  ring, sheet/overlay, toast, chart-line draw). Researcher/planner review all 8
  rows against the code and apply ONLY genuinely-missing items — likely just the
  **tab-bar icon scale 0.92→1** on tab switch and the **`ScaleDecorator`** on
  plan-row reorder. Do not reinvent motion work where the table is already
  satisfied; this stays a hardening pass, not a rebuild.
- **D-08:** **Hot-path guard — don't touch the hot path; UI-thread/worklets only.**
  The two candidate animations sit OUTSIDE the log-a-set path. Apply only
  animations that run on the Reanimated UI thread (worklets); never anything that
  blocks the set write. No change to the `(tabs)/index.tsx` write passage.
  (MOTN-01: ≤3s log-a-set budget must hold.)

### Claude's Discretion
- Exact form of the static-scan tool (regex-based grep vs lightweight AST/parse)
  — pick whatever reliably enumerates `t('...')` keys and JSX literals across
  `app/app/**` + `app/components/**`.
- The precise screen list / ordering inside `15-UAT.md` — enumerate from the
  router tree; the matrix shape (4 combos × every screen) is fixed.
- Whether `missingKeyHandler` `console.error`s vs `throw`s in `__DEV__` — choose
  the loudest option that doesn't crash legitimate dev flows.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 15: Bilingual & Release Hardening" — goal, 4 success criteria, ordering rationale ("Hardening last").
- `.planning/REQUIREMENTS.md` §Internationalization (I18N-01…05) + §Motion & Haptics (MOTN-01…05) — I18N-03 is primary; I18N-02 reconciliation (D-02); all MOTN already Complete (informs D-07).
- `.planning/research/SUMMARY.md` — phase 15 "Delivers" line (motion + English-coverage audit + full sv/en × light/dark device UAT).

### i18n implementation (existing)
- `app/lib/i18n.ts` — i18next module-singleton; `fallbackLng: 'sv'`, `escapeValue: false`, sync module-load init. **D-04 modifies this (add `__DEV__` missingKeyHandler) — keep init untouched.**
- `app/lib/resolve-language.ts` — pure D-11 mapping core (Swedish device → sv, else → en); Node-importable for tests.
- `app/locales/sv.json` + `app/locales/en.json` — flat single-namespace key maps (D-09/D-10). sv is the authored primary the audit asserts against.
- `app/scripts/check-locale-parity.ts` — EXISTING sv↔en parity gate. The new `test:i18n-coverage` (D-01/D-03) is a separate, stronger check (t()-call coverage + hardcoded-string flagging), not a replacement.
- `app/scripts/test-locale-resolve.ts` — EXISTING D-11 resolver test; extend to fully cover I18N-02 (D-02).
- LocaleBootstrap component (Phase 9, Plan 09-01) — pipes stored `fm:language` pref through `resolveLanguage` at startup; the runtime side of I18N-02 to verify (D-02).

### CI / regression gates
- `.github/workflows/phase-branch.yml` — CI workflow to extend with the new i18n-coverage gate (D-03), alongside tsc/lint/RLS.
- `app/package.json` §scripts — `test:f13-brutal`, `test:rls`, `test:locale-resolve`, `check:locale-parity` are the existing gate scripts; add `test:i18n-coverage` here.

### Design / motion
- `app/design v2/Sources/design/Forge Design Spec.html` §07 "Motion & micro-interactions" — the 8-row motion table (surface · animation · why · duration). Default curve: spring damping 18 / stiffness 220. Source of truth for D-07's gap audit.
- `app/design v2/Sources/design/lib.jsx` — Forge tokens/copy (I18N map mirrored into the locale JSON).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `check-locale-parity.ts` — proven Node-only tsx-script pattern + exit-code gate to clone for `test:i18n-coverage` (D-01).
- `test-locale-resolve.ts` — existing D-11 unit test to extend for I18N-02 (D-02).
- `resolveLanguage` / `resolve-language.ts` — the I18N-02 resolver already exists; this phase verifies, doesn't build.

### Established Patterns
- Node-only scripts are NEVER imported from a Metro-bundled path (CLAUDE.md service-role / Node-script convention) — the new coverage script follows this.
- Motion uses Reanimated 4 worklets on the UI thread; spring (damping 18, stiffness 220) is the default Forge curve (D-08).
- Device-UAT-iteration is the established loop for frontend phases (one fix per loop, read the design source before guessing).

### Integration Points
- `app/lib/i18n.ts` `init()` block — D-04 adds a `missingKeyHandler` without altering the synchronous module-load init.
- `.github/workflows/phase-branch.yml` — D-03 wires the new gate into existing CI.
- `(tabs)/index.tsx` log-a-set write passage — explicitly OFF-LIMITS for motion changes (D-08).
</code_context>

<specifics>
## Specific Ideas

- The i18n audit must catch BOTH failure shapes: (a) a `t('key')` whose key is
  absent from the locale files, and (b) a user-visible string that never went
  through `t()` at all. Parity-only checking misses both.
- Swedish-longer-than-English is the expected layout-break vector — prioritize
  button overflow, single-line truncation, and tab-bar/label wrap in the UAT.
- Hard-to-reach states (error, empty, offline, PR celebration, rest timer) are
  where missing keys hide — the UAT must deliberately drive into them.
</specifics>

<deferred>
## Deferred Ideas

Future App-Store-launch milestone (per ROADMAP "Future — App Store Launch"):
- Apple Sign-In (F14 / FIT-45)
- TestFlight via EAS Build (Windows-only credential flow)
- Email-confirmation deep-link handler (F1.1 / FIT-46)
- App-Store-grade expanded user/account data model
- Set-type toggling under active workout (F17-UI; schema exists since Phase 2)

None of these are in Phase 15 scope — discussion stayed within the hardening boundary.
</deferred>

---

*Phase: 15-bilingual-release-hardening*
*Context gathered: 2026-06-16*
