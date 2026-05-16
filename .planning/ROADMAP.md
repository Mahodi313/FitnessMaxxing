# Roadmap: FitnessMaxxing

**Last reorganized:** 2026-05-16 (v1.0 milestone shipped)

## Milestones

- ✅ **v1.0 — MVP** — Phases 1-7 (shipped 2026-05-16, 33 plans, all 15 V1 requirements validated)
- 📋 **v1.1 — TestFlight Pre-Work** — Phases 8+ (planned, depends on 4-week soak outcome)
- 📋 **v2.0 — App Store Launch** — TBD (depends on V1.1 outcome + Apple Developer license)

For full v1.0 phase breakdown + accomplishments + stats: [`.planning/MILESTONES.md`](./MILESTONES.md). Archived planning artifacts: [`.planning/milestones/v1.0-ROADMAP.md`](./milestones/v1.0-ROADMAP.md), [`.planning/milestones/v1.0-REQUIREMENTS.md`](./milestones/v1.0-REQUIREMENTS.md), [`.planning/milestones/v1.0-phases/`](./milestones/v1.0-phases/) (all 7 phase directories with CONTEXT/RESEARCH/PLAN/SUMMARY/VERIFICATION/REVIEW/SECURITY/HUMAN-UAT).

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-7) — SHIPPED 2026-05-16</summary>

- [x] Phase 1: Bootstrap & Infra Hardening (3/3 plans) — completed 2026-05-08
- [x] Phase 2: Schema, RLS & Type Generation (6/6 plans) — completed 2026-05-09 (27/27 SECURED)
- [x] Phase 3: Auth & Persistent Session (4/4 plans) — completed 2026-05-09 (UAT 9/11; F1.1 deep-link → V1.1 / FIT-46)
- [x] Phase 4: Plans, Exercises & Offline-Queue Plumbing (4/4 plans) — completed 2026-05-10 (29/29 RLS PASS; airplane-mode UAT signed off)
- [x] Phase 5: Active Workout Hot Path — F13 lives or dies (7/7 plans) — completed 2026-05-14 (F13 brutal-test green; ≤3s/set verified)
- [x] Phase 6: History & Read-Side Polish (4/4 plans) — completed 2026-05-15 (paginated history + Victory Native XL chart)
- [x] Phase 7: V1 Polish Cut (5/5 plans) — completed 2026-05-16 (F11 RPE + F12 notes + F15 toggle; iPhone UAT signed off)

</details>

### 🚧 v1.1 — TestFlight Pre-Work (planned, gated by 4-week soak)

Skissas; konkret plan vid `/gsd:new-milestone` när soak-validering är klar.

- [ ] Phase 8: V1.1 carry-overs (TBD plans)
  - **F1.1** — Email-confirmation deep-link handler (Expo Linking + Supabase verifyOtp/exchangeCodeForSession) — captured as FIT-46
  - **F14** — Apple Sign-In (App Store-blocker) — captured as FIT-45
  - **F17-UI** — Set-typ-toggling under aktivt pass (warmup/working/dropset/failure) — schema sedan Phase 2
  - **F18** — PR-detection vid pass-avslut (Epley `w * (1 + r/30)`, max-vikt, max-volym per övning)
  - **F19** — Vilo-timer som auto-triggas vid "Klart"-tap (research-flag: `expo-notifications` + `expo-keep-awake`, JS-suspension-trap)
  - **F15-toggle polish** — already shipped in V1.0 Phase 7; reserved slot for follow-up tweaks if soak surfaces issues

### 📋 v2.0 — App Store Launch (sketched)

Skissas för långsiktigt sammanhang. Mappas vid V2-planering.

- [ ] Phase 9+ (V2): App Store Launch
  - **F20** (seed exercise library), **F21** (EAS Build + TestFlight)
  - **F22-F24** (differentiators), **F25-F30** (integrationer/plattformar)
  - Research flags: EAS Build credential flow på Windows-only dev, Apple Health, hemskärms-widgets

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
| 8. V1.1 carry-overs                           | v1.1 | 0/? | ○ Planned (gated by soak) | — |
| 9+. App Store Launch                          | v2.0 | 0/? | ○ Sketched  | — |

**Project progress (v1.0):** 7/7 phases complete · 33/33 plans · 15/15 V1 requirements validated · 79 STRIDE threats SECURED across phases 2–7 · 4-week personal soak validation starts 2026-05-17.

## Phase Ordering Rationale (preserved)

- **Phase 1 → 2 → 3 → 4 → 5** måste vara sekventiella. Varje fas beror på att den föregående är korrekt; offline-första patterns kräver schema, schema kräver bootstrap, auth kräver schema (för `profiles`), offline-queue kräver auth (för RLS), hot path kräver offline-queue.
- **Phase 5 är högsta-risk-fasen.** F13-löftet komponeras här. Komprimering av Phase 4 → Phase 5 är exakt vägen som bryter F13.
- **Phase 6 → 7** kan parallellisera partiellt om tid finns; de delar inga load-bearing data-flöden.
- **F17 schema landar i Phase 2; UI deferred till V1.1.** Schema-migration är gratis innan data finns, dyr efter.
- **F15 dark mode-konvention från Phase 1**; manuell toggle-UI levereras i Phase 7. ✅ shipped V1.0.
- **F10 graf** landade i Phase 6.

## Research Flags

V1-faser var alla på dokumenterade patterns (`.planning/research/STACK.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`) — no extra `/gsd-research-phase` needed.

V1.1-faser som kräver research vid planering:
- F19 vilo-timer (JS-suspension-trap, notification permission UX).

V2-faser som kräver research vid planering:
- EAS Build credential flow på Windows-only dev environment.
- Apple Health-integration scope.

---
*Roadmap created: 2026-05-07*
*v1.0 shipped + reorganized with milestone grouping: 2026-05-16*
