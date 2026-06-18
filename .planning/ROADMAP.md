# Roadmap: FitnessMaxxing

**Last reorganized:** 2026-06-17 (v2.0 Forge Redesign milestone shipped)

## Milestones

- ✅ **v1.0 — MVP** — Phases 1-7 (shipped 2026-05-16, 33 plans, all 15 V1 requirements validated)
- ✅ **v2.0 — Forge Redesign** — Phases 8-15 (shipped 2026-06-17, 41 plans, all 48 requirements validated)
- 📋 **Future — App Store Launch** — TBD (Apple Sign-In/TestFlight, EAS Windows credential flow, App-Store-grade DB design; needs Apple Developer license)

For full v1.0 phase breakdown + accomplishments + stats: [`.planning/MILESTONES.md`](./MILESTONES.md). Archived planning artifacts: v1.0 [`.planning/milestones/v1.0-ROADMAP.md`](./milestones/v1.0-ROADMAP.md) + [`.planning/milestones/v1.0-phases/`](./milestones/v1.0-phases/); v2.0 [`.planning/milestones/v2.0-ROADMAP.md`](./milestones/v2.0-ROADMAP.md) + [`.planning/milestones/v2.0-REQUIREMENTS.md`](./milestones/v2.0-REQUIREMENTS.md). v2.0 research: [`.planning/research/`](./research/).

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-7) — SHIPPED 2026-05-16</summary>

- [x] Phase 1: Bootstrap & Infra Hardening (3/3 plans) — completed 2026-05-08
- [x] Phase 2: Schema, RLS & Type Generation (6/6 plans) — completed 2026-05-09 (27/27 SECURED)
- [x] Phase 3: Auth & Persistent Session (4/4 plans) — completed 2026-05-09 (UAT 9/11; F1.1 deep-link → future / FIT-46)
- [x] Phase 4: Plans, Exercises & Offline-Queue Plumbing (4/4 plans) — completed 2026-05-10 (29/29 RLS PASS; airplane-mode UAT signed off)
- [x] Phase 5: Active Workout Hot Path — F13 lives or dies (7/7 plans) — completed 2026-05-14 (F13 brutal-test green; ≤3s/set verified)
- [x] Phase 6: History & Read-Side Polish (4/4 plans) — completed 2026-05-15 (paginated history + Victory Native XL chart)
- [x] Phase 7: V1 Polish Cut (5/5 plans) — completed 2026-05-16 (F11 RPE + F12 notes + F15 toggle; iPhone UAT signed off)

</details>

<details>
<summary>✅ v2.0 Forge Redesign (Phases 8-15) — SHIPPED 2026-06-17</summary>

- [x] Phase 8: Forge Foundation (5/5 plans) — completed 2026-06-10 (tokens + fonts + i18n scaffold + component library)
- [x] Phase 9: Auth, Settings & Preferences (3/3 plans) — completed 2026-06-11 (Settings screen + units/goal/language/toggles; live language switch)
- [x] Phase 10: Plans & Exercises Re-skin (6/6 plans) — completed 2026-06-12 (surfaced muscle group / equipment / targets / notes)
- [x] Phase 11: Active Workout Re-skin — HIGH RISK F13 (3/3 plans) — completed 2026-06-13 (hot-path re-skin; F13 brutal-test stayed green)
- [x] Phase 12: History, Detail, Chart & Home Dashboard (11/11 plans) — completed 2026-06-14 (activity-ring dashboard via RLS-scoped RPCs; FIT-109/110/111 gap-closure)
- [x] Phase 13: PR Celebration — F18 (5/5 plans) — completed 2026-06-14 (offline-safe Epley e1RM detection + trophies + banner)
- [x] Phase 14: Rest Timer — F19 (4/4 plans) — completed 2026-06-15 (background-surviving countdown + scheduled OS notification)
- [x] Phase 15: Bilingual & Release Hardening (4/4 plans) — completed 2026-06-17 (zero missing i18n keys; RC device UAT approved 12 screens × 4 combos)

Full detail: [`.planning/milestones/v2.0-ROADMAP.md`](./milestones/v2.0-ROADMAP.md).

</details>

### 📋 Future — App Store Launch (sketched)

Deferred to a later milestone (needs Apple Developer license + tooling). Mapped at that milestone's planning. Start with `/gsd:new-milestone`.

- Apple Sign-In (F14 / FIT-45), TestFlight via EAS Build (Windows-only credential flow)
- Email-confirmation deep-link handler (F1.1 / FIT-46)
- App-Store-grade DB design — expanded user/account data model
- Set-type toggling under active workout (F17-UI; schema exists since Phase 2)
- Alternate themes (Atlas / Volt) — Forge only for v2.0

## Progress

| Phase | Milestone | Plans Complete | Status      | Completed   |
| ----- | --------- | -------------- | ----------- | ----------- |
| 1. Bootstrap & Infra Hardening                | v1.0 | 3/3 | ✓ Complete | 2026-05-08 |
| 2. Schema, RLS & Type Generation              | v1.0 | 6/6 | ✓ Complete | 2026-05-09 |
| 3. Auth & Persistent Session                  | v1.0 | 4/4 | ✓ Complete | 2026-05-09 |
| 4. Plans, Exercises & Offline-Queue Plumbing  | v1.0 | 4/4 | ✓ Complete | 2026-05-10 |
| 5. Active Workout Hot Path                    | v1.0 | 7/7 | ✓ Complete | 2026-05-14 |
| 6. History & Read-Side Polish                 | v1.0 | 4/4 | ✓ Complete | 2026-05-15 |
| 7. V1 Polish Cut                              | v1.0 | 5/5 | ✓ Complete | 2026-05-16 |
| 8. Forge Foundation                           | v2.0 | 5/5 | ✓ Complete | 2026-06-10 |
| 9. Auth, Settings & Preferences               | v2.0 | 3/3 | ✓ Complete | 2026-06-11 |
| 10. Plans & Exercises Re-skin                 | v2.0 | 6/6 | ✓ Complete | 2026-06-12 |
| 11. Active Workout Re-skin (F13 risk)         | v2.0 | 3/3 | ✓ Complete | 2026-06-13 |
| 12. History, Detail, Chart & Dashboard        | v2.0 | 11/11 | ✓ Complete | 2026-06-14 |
| 13. PR Celebration (F18)                      | v2.0 | 5/5 | ✓ Complete | 2026-06-14 |
| 14. Rest Timer (F19)                          | v2.0 | 4/4 | ✓ Complete | 2026-06-15 |
| 15. Bilingual & Release Hardening             | v2.0 | 4/4 | ✓ Complete | 2026-06-17 |

**v1.0:** 7/7 phases · 33/33 plans · 15/15 requirements validated · 79 STRIDE threats SECURED.
**v2.0:** 8/8 phases (8-15) · 41/41 plans · 48/48 requirements validated.

## Phase Ordering Rationale

**v1.0 (shipped):**

- Phases 1 → 5 were strictly sequential; Phase 5 composed the F13 promise (highest risk).

**v2.0 (shipped):**

- **Foundation (8) before any screen** — tokens, fonts, i18n scaffold, and the component library were load-bearing for every later phase; building them once prevented per-screen rework and the Tailwind-v4 pitfall.
- **Preferences early (9)** — units and language are cross-cutting and consumed by every later screen, so the preference layer (and the `profiles.weekly_goal` migration) existed before the data-heavy re-skins.
- **Re-skin low-risk → high-risk (10 → 11)** — plans/exercises (read/CRUD) before the active-workout re-skin, which sits next to the F13 write path and was quarantined as its own phase.
- **New features after re-skin (12 → 14)** — dashboard, PR, and rest timer built on already-modernized screens; the rest timer was sequenced last among features because its notification / JS-suspension risk must not destabilize the re-skin.
- **Hardening last (15)** — full bilingual + light/dark device UAT and the final F13/RLS regression gate closed the milestone.

## Research

- v1.0 + v2.0 milestone research complete: `.planning/research/{STACK,FEATURES,ARCHITECTURE,PITFALLS,SUMMARY}.md`.
- Future milestone research (App Store Launch): EAS Build credential flow on Windows-only dev; Apple Sign-In; App-Store-grade DB design.

---
*Roadmap created: 2026-05-07*
*v1.0 shipped + reorganized: 2026-05-16*
*v2.0 Forge Redesign roadmap (Phases 8-15): 2026-06-09*
*v2.0 shipped + reorganized: 2026-06-17*
