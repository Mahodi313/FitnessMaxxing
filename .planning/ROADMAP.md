# Roadmap: FitnessMaxxing

**Last reorganized:** 2026-06-09 (v2.0 Forge Redesign milestone started)

## Milestones

- ✅ **v1.0 — MVP** — Phases 1-7 (shipped 2026-05-16, 33 plans, all 15 V1 requirements validated)
- 🚧 **v2.0 — Forge Redesign** — Phases 8-15 (active; design-system rewrite + dashboard + PR + rest timer + i18n)
- 📋 **Future — App Store Launch** — TBD (Apple Sign-In/TestFlight, EAS Windows credential flow, App-Store-grade DB design; needs Apple Developer license)

For full v1.0 phase breakdown + accomplishments + stats: [`.planning/MILESTONES.md`](./MILESTONES.md). Archived v1.0 planning artifacts: [`.planning/milestones/v1.0-phases/`](./milestones/v1.0-phases/) (phase dirs + research). v2.0 research: [`.planning/research/`](./research/) (STACK/FEATURES/ARCHITECTURE/PITFALLS/SUMMARY).

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

### 🚧 v2.0 — Forge Redesign (Phases 8-15, active)

Infrastructure-first, then re-skin low-risk → high-risk, then net-new features last. The offline-first write path and the F13 "never lose a set" guarantee are untouched; `npm run test:f13-brutal` stays green every phase.

---

#### Phase 8: Forge Foundation

**Goal:** Land the design-system bedrock every later screen inherits — tokens, fonts, the i18n scaffold, and the core component library — with no screen-behavior change.
**Requirements:** DSGN-01, DSGN-02, DSGN-03, DSGN-04, DSGN-05, DSGN-06, I18N-01, I18N-04
**Success criteria:**

1. Forge color tokens (light + dark) render as NativeWind classes on a smoke screen, switching with the theme
2. Inter Display + Inter + JetBrains Mono load via expo-font with the splash held until ready; stat numerals render tabular
3. ProgressRing and Sparkline render via the installed Skia (no new charting dependency)
4. react-i18next is wired and flips a sample string between sv and en; numbers/dates format per locale

**Plans:** 5/5 plans complete
Plans:
**Wave 1**

- [x] 08-01-PLAN.md — i18n engine + bilingual locales + format/tnum helpers + font-store + dep install (Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 08-02-PLAN.md — Forge tokens in tailwind.config + bundled fonts + _layout FontBootstrap/LocaleBootstrap/splash gate (Wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 08-03-PLAN.md — Icon set (react-native-svg) + Logo/AppIcon brand + static Skia ProgressRing/Sparkline (Wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 08-04-PLAN.md — Forge component library: Button/Field/Card/Stat/Chip/SettingsRow + TabBar shell (Wave 4)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 08-05-PLAN.md — dev-only Forge gallery (manual UAT surface) proving all 8 requirements (Wave 5)

#### Phase 9: Auth, Settings & Preferences

**Goal:** Re-skin the auth screens and ship the new Settings screen + preference layer (units, weekly goal, language, toggles) that later screens depend on.
**Requirements:** SKIN-01, SET-01, SET-02, SET-03, SET-04, SET-05, SET-06, SET-07, SET-08, SET-09, I18N-02
**Success criteria:**

1. Sign-in and sign-up match the Forge design in light + dark
2. A Settings screen shows profile, theme, language, units, weekly goal, haptics/notifications toggles, and sign-out
3. Choosing kg/lbs changes every displayed weight while storage stays canonical kg; weekly goal persists to `profiles.weekly_goal`
4. Switching language overrides the device locale and the app text updates live

**Plans:** 3/3 plans complete
Plans:
**Wave 1**

- [x] 09-01-PLAN.md — Foundation: 0007 weekly_goal migration (pushed live) + units helper + prefs wrappers + resolveLanguage + 6 i18n keys + Wave-0 unit tests + test-rls extension (Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 09-02-PLAN.md — Forge Settings screen (Profile/Appearance/Workout/Notifications/Sign-out) + three-state LocaleBootstrap + segmented-control re-skin (Wave 2)
- [x] 09-03-PLAN.md — Forge re-skin of sign-in/sign-up (ForgeField/ForgeButton, t()-keyed labels, inline+form errors, loading CTA) (Wave 2)

#### Phase 10: Plans & Exercises Re-skin

**Goal:** Re-skin the plan/exercise CRUD screens and surface the schema fields v1 hid (muscle group, equipment, targets, descriptions).
**Requirements:** SKIN-02, SKIN-03, SKIN-07, I18N-05
**Success criteria:**

1. Plans list/Home, plan detail, and new-plan screens match the Forge design
2. Exercise picker (browse + filters + create-new) and plan-exercise edit match the design, exposing muscle group / equipment / target sets+reps / notes
3. The tab bar (Planer / Historik / Inställningar) matches the design in light + dark
4. User-created names and notes are stored exactly as written, never auto-translated

**Plans:** 6/6 plans complete
Plans:
**Wave 1**

- [x] 10-01-PLAN.md — Foundation: migration 0010 (seed_key + plan_name_snapshot + RPC re-deploy) + useDeletePlan/[plan,delete] + snapshot-on-start + schema/verify-deploy/test-rls extensions (Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 10-02-PLAN.md — Muscle-group util + 18-row bilingual seed module + auth-gated first-run bootstrap + test-muscle-group + seed/taxonomy locale keys (Wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 10-03-PLAN.md — Exercise picker re-skin: filter pills + AND-search + mg dropdown create-new + bilingual rows + picker locale keys (Wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 10-04-PLAN.md — Plan-exercise edit re-skin (FExerciseEdit steppers, optional targets, remove) + edit locale keys (Wave 4)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 10-05-PLAN.md — Plans list (FHome) + new-plan (FNewPlan) + tab bar light+dark (SKIN-07) + their locale keys (Wave 5)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 10-06-PLAN.md — Plan detail (FPlanDetail) re-skin + hard-delete confirm dialog + snapshot wiring + phase-gate suite (Wave 6)

#### Phase 11: Active Workout Re-skin (HIGH RISK — F13)

**Goal:** Re-skin the hot-path workout screen and its inline overlays without regressing the ≤3s log-set budget or F13.
**Requirements:** SKIN-04, SKIN-05, SKIN-08, MOTN-01, MOTN-04, MOTN-05
**Success criteria:**

1. The active-workout screen (set log, input row, progress dots) matches the Forge design
2. Finish / draft-resume / saved-toast overlays and the active-session banner match the design and stay inline-rendered (no modal portals)
3. Logging a set plays the set-logged animation + haptic and `npm run test:f13-brutal` stays green with the ≤3s budget intact
4. Haptics respect the Settings haptics toggle

**Plans:** 3/3 plans complete
- [x] 11-01-PLAN.md — Workout screen structural re-skin (custom header + live timer, progress dots, Forge logged-set table + ✕-delete, empty/loading, full i18n sweep + all phase locale keys)
- [x] 11-02-PLAN.md — Set-input row re-skin (preserve keyboard wiring) + set-logged motion + gated haptic + Forge finish overlay with stats row + spring + BLOCKING F13 verification
- [x] 11-03-PLAN.md — Draft-resume overlay (danger ghost End-session) + saved-toast re-skin (chrome only, §07 spring, inline-rendered)

#### Phase 12: History, Detail, Chart & Home Dashboard

**Goal:** Re-skin the read-side screens and add the activity-ring dashboard backed by new RLS-scoped RPCs.
**Requirements:** SKIN-06, DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, MOTN-02, MOTN-03
**Success criteria:**

1. History list, session detail, and exercise chart match the Forge design
2. Home shows an animated activity ring (sessions-this-week vs goal), current streak, weekly volume + delta vs prior week, and a volume sparkline
3. Dashboard aggregates come from RLS-scoped read-side RPCs with a clean empty state for new users
4. The chart line draws on mount

**Plans:** 11/11 plans complete
Plans:
**Wave 1**

- [x] 12-01-PLAN.md — Migration 0011 (get_dashboard_summary + get_exercise_summary RPCs) + [BLOCKING] push + gen:types + verify-deploy + cross-user test:rls + streak/week Wave-0 fixtures
- [x] 12-02-PLAN.md — Shared deps: units toDisplayVolume/formatVolume + full sv/en i18n key set incl. weeks/week streak relabel
- [x] 12-03-PLAN.md — Animate Skia primitives: ProgressRing fill + overflow glow (MOTN-02/D-19) + Sparkline draw-in (D-18), reduce-motion aware

**Wave 2** *(blocked on Wave 1)*

- [x] 12-04-PLAN.md — Query layer: dashboardKeys/exerciseSummaryKeys + useDashboardSummaryQuery + useExerciseSummaryQuery + 3-state ChartRange/rangeToSince (additive, D-24-safe)

**Wave 3** *(blocked on Waves 1+2)*

- [x] 12-05-PLAN.md — Home ring hero (DASH-01/02) + active-session swap + zeroed empty state + F13 gate
- [x] 12-06-PLAN.md — History re-skin: lifetime eyebrow + volume card (DASH-03/04 split) + Forge rows + F13 gate
- [x] 12-07-PLAN.md — Session detail re-skin: custom header + hybrid breakdown + preserved overlays + F13 gate
- [x] 12-08-PLAN.md — Exercise chart re-skin: custom header + 3-state range + real current-best hero + 3-stat row + draw-on-mount (MOTN-03) + F13 gate

**Wave 4 - Gap closure** *(device-UAT fixes from 12-UAT.md)*

- [x] 12-09-PLAN.md - FIT-109: invalidate dashboardKeys on session finish so the Home ring/count refreshes immediately (D-03/D-24) — completed 2026-06-14
- [x] 12-10-PLAN.md - FIT-110 (regression): restore the session-detail ExerciseCard chart cross-link dropped in the 12-07 re-skin (D-15/D-17 preserved) — completed 2026-06-14
- [x] 12-11-PLAN.md - FIT-111: reactive units store so a kg-lbs toggle re-renders all figures live, no restart (D-20/D-08/D-24) — completed 2026-06-14

#### Phase 13: PR Celebration (F18)

**Goal:** Detect personal bests by e1RM client-side (offline-safe) and surface trophies + a celebration banner.
**Requirements:** PR-01, PR-02, PR-03, PR-04, PR-05
**Success criteria:**

1. A set beating the prior best e1RM (Epley) for that exercise is detected as a PB, computed offline over the local cache
2. PR sets show a trophy in the workout set list and a celebration banner (with sweep animation) appears
3. History marks PR sessions; session detail and the chart surface PR / estimated 1RM with the range delta

**Plans:** 4/5 plans executed
Plans:
**Wave 1**

- [x] 13-01-PLAN.md — lib/e1rm.ts pure Epley util + test-e1rm.ts + test:e1rm script (PR-01 formula source, D-08)
- [x] 13-02-PLAN.md — migration 0012 (3 read-only PR RPCs) + [BLOCKING] push + gen:types + verify-deploy + cross-user test:rls (PR-01/04/05)

**Wave 2** *(blocked on Wave 1)*

- [x] 13-03-PLAN.md — query layer: best-e1rm (offline-first) + pr-history + sets-in-range hooks + the single additive ['session','finish'].onSettled line (PR-01/04/05)

**Wave 3** *(blocked on Wave 2)*

- [x] 13-04-PLAN.md — in-workout fire-and-forget detection + floating gradient-sweep banner + set-row trophy + pbSetSuffix key (PR-01/02/03)
- [ ] 13-05-PLAN.md — read-side surfacing: history session trophy + session-detail e1RM/trophy + chart estimated-1RM hero swap (PR-04/05)

#### Phase 14: Rest Timer (F19) — RESEARCH-FLAGGED

**Goal:** Add a rest timer that survives backgrounding by scheduling an OS notification, with Settings control.
**Requirements:** TIMER-01, TIMER-02, TIMER-03, TIMER-04, TIMER-05
**Success criteria:**

1. Completing a set can auto-start a visible rest countdown
2. The countdown stays correct after the app is backgrounded (reconciled from a stored timestamp, not a JS timer)
3. A local notification fires when rest ends, even backgrounded; starting the next set or dismissing early cancels it
4. The default rest duration and timer enable/disable are configurable in Settings (gated by notification permission)

#### Phase 15: Bilingual & Release Hardening

**Goal:** Close i18n coverage to zero missing keys and run the full release-candidate UAT across both languages and themes.
**Requirements:** I18N-03
**Success criteria:**

1. Every screen renders complete in both Swedish and English with no missing keys or layout breakage
2. A full sv/en × light/dark device UAT passes on real iPhone hardware
3. `npm run test:f13-brutal` and the cross-user RLS test pass as the final regression gate
4. Remaining design motion-table animations are applied and feel premium without breaching the hot-path budget

### 📋 Future — App Store Launch (sketched)

Deferred to a later milestone (needs Apple Developer license + tooling). Mapped at that milestone's planning.

- Apple Sign-In (F14 / FIT-45), TestFlight via EAS Build (Windows-only credential flow)
- Email-confirmation deep-link handler (F1.1 / FIT-46)
- App-Store-grade DB design — expanded user/account data model
- Set-type toggling under active workout (F17-UI; schema exists since Phase 2)

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
| 8. Forge Foundation                           | v2.0 | 5/5 | Complete   | 2026-06-10 |
| 9. Auth, Settings & Preferences               | v2.0 | 3/3 | Complete   | 2026-06-11 |
| 10. Plans & Exercises Re-skin                 | v2.0 | 6/6 | Complete    | 2026-06-12 |
| 11. Active Workout Re-skin (F13 risk)         | v2.0 | 3/3 | Complete   | 2026-06-13 |
| 12. History, Detail, Chart & Dashboard        | v2.0 | 11/11 | Complete    | 2026-06-14 |
| 13. PR Celebration (F18)                      | v2.0 | 4/5 | In Progress|  |
| 14. Rest Timer (F19)                          | v2.0 | 0/? | ○ Planned  | — |
| 15. Bilingual & Release Hardening             | v2.0 | 0/? | ○ Planned  | — |

**v1.0:** 7/7 phases · 33/33 plans · 15/15 requirements validated · 79 STRIDE threats SECURED.
**v2.0:** 8 phases (8-15) · 48 requirements · 0/8 complete.

## Phase Ordering Rationale

**v1.0 (preserved):**

- Phases 1 → 5 were strictly sequential; Phase 5 composed the F13 promise (highest risk).

**v2.0:**

- **Foundation (8) before any screen** — tokens, fonts, i18n scaffold, and the component library are load-bearing for every later phase; building them once prevents per-screen rework and the Tailwind-v4 pitfall.
- **Preferences early (9)** — units and language are cross-cutting and consumed by every later screen, so the preference layer (and the small `profiles.weekly_goal` migration) must exist before the data-heavy re-skins.
- **Re-skin low-risk → high-risk (10 → 11)** — plans/exercises (read/CRUD, no hot-path) before the active-workout re-skin, which sits next to the F13 write path and is quarantined as its own phase.
- **New features after re-skin (12 → 14)** — dashboard, PR, and rest timer build on already-modernized screens; the rest timer is sequenced last among features because its notification / JS-suspension risk must not destabilize the re-skin.
- **Hardening last (15)** — full bilingual + light/dark device UAT and the final F13/RLS regression gate close the milestone.

## Research Flags

v2.0 milestone research is complete: `.planning/research/{STACK,FEATURES,ARCHITECTURE,PITFALLS,SUMMARY}.md`.

Phases likely needing a deeper `/gsd:plan-phase` research pass:

- **Phase 14 (Rest Timer):** expo-notifications permission UX + Expo Go SDK 54 local-notification behavior + JS-suspension reconciliation + time-drift.
- **Phase 8 (fonts):** sourcing/bundling self-hosted Inter Display `.ttf` weights; fallback to Inter Tight if weights are missing.

Phases on established patterns (skip research-phase): 9, 10, 11, 12, 13, 15 — proven NativeWind / Supabase-RPC / TanStack patterns from v1.

Future milestone research:

- EAS Build credential flow on Windows-only dev; Apple Sign-In; App-Store-grade DB design.

---
*Roadmap created: 2026-05-07*
*v1.0 shipped + reorganized: 2026-05-16*
*v2.0 Forge Redesign roadmap (Phases 8-15): 2026-06-09*
