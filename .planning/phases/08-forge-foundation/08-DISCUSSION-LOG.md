# Phase 8: Forge Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-09
**Phase:** 8-Forge Foundation
**Areas discussed:** Component library scope, Font sourcing & fallback, Verification surface, i18n scaffold depth, App-icon handling (DSGN-06), Skia primitive animation

---

## Component library scope

| Option | Description | Selected |
|--------|-------------|----------|
| Named requirements only | Build exactly DSGN-04/05/06 named components; later phases add chips/rows/tab-bar as hit | |
| Named + obvious shared pieces | Named set PLUS ForgeChip, SettingsRow, re-skinned TabBar shell (all in lib.jsx) | ✓ |
| Full primitive sweep | Everything across all 17 reference screens | |

**User's choice:** Named + obvious shared pieces
**Notes:** Build the foundational pieces phases 9–12 clearly need now to minimize per-screen rework; still no production-screen behavior change.

## Variant API

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit variant props | `variant`/`size` props per component | ✓ |
| className passthrough only | Single base style, override via NativeWind className | |
| You decide | Planner picks from forge-screens.jsx usage | |

**User's choice:** Explicit variant props
**Notes:** Exact enum values derived from forge-screens.jsx usage.

---

## Font sourcing & fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Inter Display 3 weights | InterDisplay R/SB/B + JetBrains Mono R (ARCHITECTURE §2's 4 files) | ✓ |
| Inter (standard) as Display | Standard Inter for body + display roles; no manual .otf sourcing | |
| Inter Display + extra weights | Add Medium/Black for finer hierarchy | |

**User's choice:** Inter Display 3 weights

| Option | Description | Selected |
|--------|-------------|----------|
| Fall back to standard Inter | Missing Display weight → matching standard Inter weight (@expo-google-fonts/inter) | ✓ |
| Inter Tight | Roadmap's suggested Display substitute | |
| System font | iOS SF Pro for missing weights | |

**User's choice:** Fall back to standard Inter
**Notes:** Safer/more-available than the roadmap's Inter-Tight note; layers on the architecture's fail-open splash gate.

---

## Verification surface

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated dev gallery route | New dev-only route with swatches/fonts/charts/i18n toggle; kept as living reference | ✓ |
| Reuse existing smoke-test screen | Extend Phase-1 smoke test | |
| Temporary route, removed at close | Throwaway verification screen deleted before commit | |

**User's choice:** Dedicated dev gallery route

| Option | Description | Selected |
|--------|-------------|----------|
| Manual UAT on device | Verify visually in Expo Go (v1 convention); gallery is the test surface | ✓ |
| Add a render smoke-test | Lightweight mount test on top of manual UAT | |

**User's choice:** Manual UAT on device
**Notes:** No RN component-testing harness in the stack; gallery doubles as UAT surface.

---

## i18n scaffold depth

| Option | Description | Selected |
|--------|-------------|----------|
| Full I18N transcription now | Transcribe entire I18N.sv/en into locales now (fns → {{n}}) | ✓ |
| Minimal scaffold + sample only | Wire i18next + one sample key; later phases add keys | |

**User's choice:** Full I18N transcription now

| Option | Description | Selected |
|--------|-------------|----------|
| Flat keys mirroring I18N | Exact flat keys, single default namespace, easiest completeness diff | ✓ |
| Nested namespaces | Group by area (auth./plans./workout.) | |

**User's choice:** Flat keys mirroring I18N

---

## App-icon handling (DSGN-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Components only this phase | Build Logo/AppIcon components + gallery; defer real app.json icon/splash swap | ✓ |
| Also swap real app icon + splash | Generate + wire gradient app icon/splash now | |

**User's choice:** Components only this phase
**Notes:** Keeps Phase 8 to "no app-shell change"; avoids native asset-regen risk.

---

## Skia primitive animation

| Option | Description | Selected |
|--------|-------------|----------|
| Static now, animate in Phase 12 | DSGN-05 only requires render; animation is Phase 12 MOTN-02/03 | ✓ |
| Animate on mount now | Bake mount animation into primitives in Phase 8 | |

**User's choice:** Static now, animate in Phase 12
**Notes:** Avoids tuning motion before the consuming dashboard screen exists.

---

## Claude's Discretion

- Exact `variant`/`size` enum values per component — derive from `forge-screens.jsx`.
- `tailwind.config.js` token mechanics — follow ARCHITECTURE.md §1.
- `FontBootstrap`/`LocaleBootstrap`/`useFontStore`/splash-gate wiring — follow ARCHITECTURE.md §2/§7.

## Deferred Ideas

- Real iOS app-icon + splash asset swap → later polish step.
- ProgressRing/Sparkline mount + draw animations → Phase 12 (MOTN-02/03).
- Sweep of existing hardcoded Swedish literals → `t()` → Phase 11/15 (per ARCHITECTURE.md).
- Automated RN render/smoke test for the gallery → deferred (no RN component-testing harness).
