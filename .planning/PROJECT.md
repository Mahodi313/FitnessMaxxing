# FitnessMaxxing

## What This Is

A personal iOS gym tracker for iPhone where the user creates their own training plans, logs sets during a workout, and immediately sees the last value on the same exercise — never losing a set even through airplane mode + force-quit + battery-pull. V1.0 shipped 2026-05-16 as a personal-use deliverable. V2.0 (shipped 2026-06-17) rewrote the entire UI to the "Forge" design system (premium, Apple-Fitness DNA, dark/light parity), added a Home activity-ring dashboard, offline-safe PR celebration, a background-surviving rest timer, and complete Swedish + English — all with the v1 offline-first write path and the F13 "never lose a set" guarantee untouched. Next decision: the App Store path (Apple Sign-In / TestFlight).

## Core Value

Logga ett set och omedelbart se vad jag tog senast på samma övning — utan att tappa data, någonsin.

**v1.0 outcome:** verified by F13 brutal-test (`npm run test:f13-brutal`) running as a regression gate every phase, manual airplane-mode + force-quit UAT signed off Phase 5, and 4-week personal soak about to start. Core value remains the right priority.

## Current State

**v2.0 — Forge Redesign shipped 2026-06-17.** 8 phases (8-15), 41 plans, 48/48 requirements validated. The full UI now runs on the Forge design system with dark/light parity; the app is bilingual (sv/en) with zero missing keys, has a Home activity-ring dashboard, offline-safe PR celebration, and a background-surviving rest timer. The v1 offline-first write path and the F13 "never lose a set" guarantee were left untouched (`npm run test:f13-brutal` green every phase). Codebase: ~27.0k LOC TS/TSX in `app/` (up from ~15.2k at v1.0).

**Status:** Between milestones — no active development. Next decision is whether to pursue the App Store path.

## Next Milestone Goals (App Store Launch — not yet planned)

Start with `/gsd:new-milestone`. Sketched scope (requires Apple Developer license + EAS tooling):

- **Apple Sign-In** (F14 / FIT-45) — App-Store blocker.
- **TestFlight build via EAS** — Windows-only dev credential flow (research-flagged).
- **Email-confirmation deep-link handler** (F1.1 / FIT-46) — currently opens in browser.
- **App-Store-grade DB design** — expanded user/account data model.
- **Carry-over polish:** first/last-name split (FIT-84), functional forgot-password flow, set-type toggling under active workout (F17-UI; schema exists since Phase 2).

## Requirements

### Validated

<!-- Shipped and confirmed valuable. Format: ✓ [Requirement] — v[X.Y] -->

- ✓ **F1** (registrering + login) — v1.0 (Phase 3, UAT 9/11; F1.1 deep-link → V1.1 / FIT-46)
- ✓ **F2** (planer CRUD) — v1.0 (Phase 4 Plans 02–04; UAT signed off, 29/29 RLS)
- ✓ **F3** (egna övningar) — v1.0 (Phase 4 Plan 03 picker chained create-and-add)
- ✓ **F4** (drag-att-ordna övningar) — v1.0 (Phase 4 Plan 04 DraggableFlatList + two-phase orchestrator; airplane-mode UAT)
- ✓ **F5** (starta pass) — v1.0 (Phase 5 Plan 02; stable scope.id; works offline)
- ✓ **F6** (logga set ≤3s) — v1.0 (Phase 5 Plan 03; F13 brutal-test verifies budget)
- ✓ **F7** (set-position-aligned senaste värdet) — v1.0 (Phase 5 Plan 04 useLastValueQuery)
- ✓ **F8** (avsluta pass) — v1.0 (Phase 5 Plan 05 AvslutaOverlay; no Discard path)
- ✓ **F9** (historik-lista) — v1.0 (Phase 6 Plan 02 paginated InfiniteQuery on get_session_summaries RPC)
- ✓ **F10** (graf per övning) — v1.0 (Phase 6 Plan 03 get_exercise_chart + get_exercise_top_sets RPCs; Victory Native XL on Skia 2)
- ✓ **F11** (RPE per set) — v1.0 (Phase 7 Plan 02 inline RPE Controller w-16 + setFormSchema preprocess + history-suffix; 16/16 schema tests)
- ✓ **F12** (anteckningar per pass) — v1.0 (Phase 7 Plans 03 + 04; capture in AvslutaOverlay + view+edit in history-detail; FIFO scope.id contract for T-07-03)
- ✓ **F13** (offline-stöd, bumpat Bör → Måste) — v1.0 (Phase 5; brutal-test green every subsequent phase)
- ✓ **F15** (dark mode konvention + toggle UI) — v1.0 (Phase 1 convention + Phase 7 Plan 01 SegmentedControl + AsyncStorage + ThemeBootstrap pre-splash + 10-file useColorScheme migration)
- ✓ **F17** (set-typ schema-only) — v1.0 (Phase 2 set_type ENUM with default 'working'; UI tagging deferred to V1.1)

**v1.0 outcome:** 15/15 V1 requirements validated. 79 STRIDE threats SECURED across phases 2–7. Code-gates green at v1.0 tag.

- ✓ **Design system** — Forge tokens + fonts + component library (DSGN-01..06) — v2.0 (Phase 8)
- ✓ **Screen re-skin** — all screens + 3 session overlays on tokens (SKIN-01..08) — v2.0 (Phases 9–12)
- ✓ **Settings & preferences** — settings screen + profile/units/weekly-goal/language/toggles + `profiles.weekly_goal` migration (SET-01..09) — v2.0 (Phase 9)
- ✓ **Home dashboard** — activity ring, streak, weekly volume, sparkline via RLS-scoped read-side RPCs (DASH-01..05) — v2.0 (Phase 12)
- ✓ **PR celebration (F18)** — offline-safe Epley e1RM detection + trophies + PR banner (PR-01..05) — v2.0 (Phase 13)
- ✓ **Rest timer (F19)** — auto-trigger on "Klart", background-surviving countdown, scheduled OS notification (TIMER-01..05) — v2.0 (Phase 14)
- ✓ **i18n** — Swedish + English UI text via expo-localization + react-i18next, zero missing keys (I18N-01..05) — v2.0 (Phases 8, 9, 10, 15)
- ✓ **Motion & haptics** — design motion-table animations + Settings-gated haptics (MOTN-01..05) — v2.0 (Phases 11, 12)

**v2.0 outcome:** 48/48 requirements validated. Full release-candidate device UAT approved across 12 screens × 4 language/theme combos. F13 brutal-test stayed green every phase.

### Active

<!-- No active milestone. Next: App Store Launch — define via /gsd:new-milestone (see "Next Milestone Goals" above). -->

(None — between milestones.)

### V1.1 / Future Carry-overs (queued for the App Store milestone)

- **F1.1** — Email-confirmation deep-link handler (Expo Linking + Supabase verifyOtp/exchangeCodeForSession) — currently opens in browser. Captured as FIT-46.
- **F14** — Apple Sign-In (App Store-blocker). Captured as FIT-45.
- **F17-UI** — Set-typ-toggling under aktivt pass (warmup/working/dropset/failure). Schema sedan Phase 2.
- **TestFlight via EAS** — Windows-only dev credential flow (research-flagged).
- **App-Store-grade DB design** — expanded user/account data model.
- **FIT-84** — Settings first/last-name split (currently a single display_name).

*Shipped in v2.0: F18 PR-detection (Epley e1RM, Phase 13) and F19 rest timer (Phase 14).*

### Out of Scope (V1) — audited 2026-05-16

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. All still valid post-v1.0. -->

- Sociala features (delning, vänner, leaderboards) — fokus är personligt verktyg
- AI-coach / programmeringsförslag — komplicerar utan att lösa kärnproblemet
- Videos eller animationer av övningar — kostsamt att producera, marginellt värde
- Apple Watch-app — V2+ (eget projekt)
- Android-stöd — iPhone-fokus i V1; V2 utvärderar Android (FIT-59)
- Förladdat övningsbibliotek — användare skapar egna från start; schema tillåter null `user_id` så global seed kan adderas i V2 utan migration
- Apple Health-integration, hemskärms-widgets, CSV-export, web-app, delade pass — alla V2+
- Programmeringsmallar (5/3/1, PPL etc.) — V2+, kräver mer modellering
- Penetration testing (V14.5) — defer to pre-TestFlight
- App-Store-specific MASVS L2 controls (binary obfuscation, anti-tamper, jailbreak detection) — V2 / TestFlight phase
- Audit logging for admin operations — no admin surface in V1
- WAF / DDoS protection — Supabase platform handles base rate-limit; app-level rate-limit deferred

## Context

- **v1.0 codebase state (2026-05-16):** ~15.2k LOC TypeScript/TSX in `app/`. 413 commits over 9 days. 33 plans across 7 phases. All phase artifacts archived to `.planning/milestones/v1.0-phases/`.
- **Tech stack pinned:** Expo SDK 54 · React Native 0.81 · TypeScript 5.9 · NativeWind 4 + Tailwind 3 · TanStack Query 5 · Zustand 5 · react-hook-form 7 + Zod 4 · Supabase (Postgres + Auth + RLS) · Skia 2 + Victory Native XL 41. Pinned in ARCHITECTURE.md and CLAUDE.md TL;DR section.
- **Datamodell:** 6 tabeller (`profiles`, `exercises`, `workout_plans`, `plan_exercises`, `workout_sessions`, `exercise_sets`) deployed to Supabase remote with errata-fixed RLS (every writable policy has both `using` AND `with check`; every `auth.uid()` wrapped as `(select auth.uid())`). 6 numbered migrations in `app/supabase/migrations/` (latest: `0006_phase6_chart_rpcs.sql`).
- **Utvecklare:** Solo developer; ny på React Native + TypeScript när projektet startade. Bygger för att lära sig + använda dagligen.
- **Plattform:** Windows + PowerShell + Claude Code nativt (inte WSL). Expo Go på iPhone för dev. Ingen Mac initialt; EAS Build hanterar bygg när TestFlight blir aktuellt (V2).
- **CI/CD:** GitHub Actions auto-PR per phase-branch (`.github/workflows/phase-branch.yml`); CI gates: tsc + lint + RLS + Expo build. Linear-integration auto-tags commits with `[FIT-NN]`.
- **Known issues / tech debt at v1.0 close:** 0 open Linear bugs (FIT-6 fixed, FIT-5 resolved, all UAT-discovered defects closed in-branch as hotfix commits). 1 attestation-level audit-trail note: T-07-03 §3.10 SQL-count fields left blank during UAT (pre-accepted in 07-05-SUMMARY §Lessons §4 for V1 single-user soak; deterministic Node-script fallback documented if V1.1 / TestFlight needs harder evidence).

## Constraints

- **Tech stack**: Expo + Supabase + TypeScript låst i ARCHITECTURE.md beslutsregister — får inte bytas utan att registret revideras explicit
- **Plattform**: iOS-only i V1 (iPhone via Expo Go) — Android avskuret till V2+
- **Performance**: Loggning av ett set ≤ 3 sekunder från knapptryck till lokalt sparat — UX-kritiskt (✓ verified by F13 brutal-test)
- **Data integrity**: Får ALDRIG förlora ett loggat set — driver offline-first beslut i V1 (✓ verified)
- **Säkerhet**: RLS obligatoriskt på alla tabeller; service-role-key används ALDRIG i klient; secrets aldrig hårdkodade (✓ audit-gated every phase)
- **Sessions**: expo-secure-store för auth-tokens (inte AsyncStorage) — wrapped in LargeSecureStore for >2048-byte JWT
- **Validering**: Zod för all extern data (Supabase responses, formulär, deeplinks) — `createClient<Database>()` typed everywhere including Node scripts
- **Budget**: Gratis (Supabase free tier för enskild användare); Apple Developer-licens krävs först när TestFlight blir aktuellt
- **Soak gate**: 4-week personal soak (PRD §8) tolerans ≤1 bug/vecka, alla pass loggade utan papper. Soak-utfall avgör App Store-väg (V1.1 → TestFlight) vs. fortsatt privat användning.

## Key Decisions

<!-- Decisions that constrained future work. Outcomes recorded post-v1.0. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Expo (vs vanilla RN, Flutter, SwiftUI) | Snabbast iteration, EAS hanterar bygg, ingen Mac krävs initialt | ✓ Good — Expo Go på iPhone gav full iteration-cykel utan Mac under hela v1.0 |
| Supabase (vs Firebase, egen Node + Postgres) | Open source, SQL, RLS gör auth-säkerhet enkelt | ✓ Good — RLS-vid-DB var rätt val; 79 STRIDE-hot SECURED utan custom auth-kod |
| TypeScript (vs JS) | Typkontroll mot Supabase-schema → färre runtime-buggar, IDE-stöd | ✓ Good — `createClient<Database>` typed access fångade flera bugger pre-runtime |
| NativeWind 4 + Tailwind 3 (vs StyleSheet, Tamagui) | Tailwind-syntax är snabb och välkänd | ✓ Good — `dark:` variant convention från Phase 1 betalade sig vid Phase 7 toggle (zero refactoring) |
| TanStack Query v5 + Zustand (vs Redux) | TanStack för server-state cache, Zustand för UI-state — enklare än Redux | ✓ Good — `scope.id` FIFO-mutation pattern är ryggraden i offline-first; T-07-03 omöjlig att lösa utan TanStack v5 |
| react-hook-form + Zod (forms + validering) | Typsäkra scheman, single source of truth | ✓ Good — `setFormSchema` defense-in-depth fångade både client + server gränsfall |
| expo-secure-store + LargeSecureStore för sessions (inte AsyncStorage plaintext) | Säkrare lagring av JWT-tokens som överstiger 2048-byte SecureStore-limit | ✓ Good — at-rest encryption inherent; T-07-14 + T-07-16 (offline persister PII) accepted-mitigated under inherited Phase 3 model |
| Inget förladdat övningsbibliotek i V1 | Enklast V1; schema stödjer global seed senare utan migration (`null user_id`) | ✓ Good — gjorde Phase 4 enklare; V2 F20 kan adderas utan schemaändring |
| Offline-stöd = Måste i V1 (bumpat från Bör → Måste) | "Får aldrig förlora ett set" + dålig täckning i gymkällare → online-only V1 är inte trovärdigt | ✓ Good — F13 brutal-test gav verifierbar regression-gate genom hela projektet; UAT-bekräftat |
| Apple Sign-In = V1.1 (inte V1.0) | Krävs senare för App Store men inte för personlig användning först | ✓ Good — sparade Phase 3 från ytterligare auth-komplexitet; FIT-45 i V1.1 backlog |
| Migration-as-truth (no Studio editing) — etablerad Phase 2 | PITFALLS 4.2: drift-detektion kräver single source of truth | ✓ Good — `verify-deploy.ts` kunde introspektera `pg_catalog` direkt på Windows-utan-Docker; 6 migrations utan drift |
| FIFO mutation scope per resurs (`session:${id}` / `plan:${id}`) | T-07-03 contract: chained offline mutations får inte producera orphan rows | ✓ Good — same pattern användes på 3 ställen (sessions, plans, plan-exercises); blev en arkitektonisk styrkedjam |
| Inline-overlay UX (NOT Modal portals) — etablerad Phase 4 | PATTERNS landmine #3: portal modals bryter freezeOnBlur + gestures | ✓ Good — etablerades Phase 4, återanvändes i Phase 5 + 7 utan revision |
| Direct iOS keyboard measurement (NOT KeyboardAvoidingView i absolute backdrops) — etablerad Phase 7 | UAT-blocker: KAV `padding`/`height`/`position` lyfter inte i absolute-positioned backdrop på iOS 26 | ✓ Good — `Keyboard.addListener('keyboardWillShow')` är reliable fallback; iter-3 hotfix shipped och verified |
| Per-phase HUMAN-UAT.md för UI-tunga phases (4, 5, 7) | UAT på riktig iPhone fångar buggar som tsc/lint/RLS inte ser | ✓ Good — 3 av Phase 7's UAT-discovered bugs (keyboard-blocking) hade nått soaken annars |
| Token-driven re-skin (`forge-<token>-light` base + `dark:` sibling) — etablerad Phase 8 | Speglar `THEMES.forge` i tailwind.config så varje skärm ärver dark-mode utan per-skärm-arbete | ✓ Good — 17 skärmar ommålade med dark/light-paritet utan per-skärm dark-logik (v2.0) |
| NativeWind box-decoration MÅSTE ligga i className (inte style()) — etablerad Phase 10 | NativeWind 4 droppar style() box-props (bg/border/radius/size) på Pressable → "naken" re-skin | ✓ Good — efter Phase 10-buggen blev det en regel; samma rotorsak bakom Phase 15 rest-banner-wrap (FIT-128) |
| Reaktiv Zustand-store utan persist för live-prefs (`units-store`, `rest-timer-store`) | En Settings-ändring måste re-rendra alla konsumenter direkt, utan restart | ✓ Good — FIT-111 kg↔lbs live-toggle löstes; samma mönster bär rest-timerns transient OS-clock-state |
| PR-detektion client-side/offline via Epley e1RM (`lib/e1rm.ts`), ingen `is_pr`-kolumn | Härledbart från sets → undviker schema/sync-komplexitet; måste funka offline | ✓ Good — singel formel-källa (D-08); PR-at-log-time via strictly-prior SQL-window; noll sync-state |
| Vilotimer = absolut timestamp + schemalagd OS-notis (inte JS-interval) | Måste överleva JS-suspension vid backgrounding | ✓ Good — `remainingMs` re-derives från lagrat `endTs`; DATE-trigger-notis; fail-soft wrapper rejectar aldrig in i fire-and-forget |
| i18n = endast UI-text; användarinnehåll lagras som skrivet (I18N-05) | Tvåspråkslagring per rad onödig för personligt verktyg | ✓ Good — react-i18next + tre-läges språk-resolver (System/sv/en) byter live utan restart; CI-gate ger noll saknade nycklar |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections ✓ (done at v1.0 close 2026-05-16)
2. Core Value check — still the right priority? ✓ (verified valid)
3. Audit Out of Scope — reasons still valid? ✓ (no changes needed)
4. Update Context with current state ✓ (LOC + tech stack snapshot + known issues)

---
*Last updated: 2026-06-17 after v2.0 — Forge Redesign milestone close. Full review done: "What This Is" updated to reflect the shipped redesign; all 48 v2.0 requirements moved to Validated; Active emptied (between milestones); 7 v2.0 decisions added to Key Decisions; Current State + Next Milestone Goals (App Store Launch) sections added. v2.0: 8 phases (8-15), 41 plans, ~27.0k LOC. Phase artifacts retained in `.planning/phases/` (not archived). Next: `/gsd:new-milestone` for the App Store path.*

*Earlier: 2026-06-11 — Phase 9 (Auth, Settings & Preferences) complete: full Forge Settings screen (Profile · Appearance · Workout · Notifications · Sign-out, D-13 order) with live language switching (no restart), units/weekly-goal/haptics/notifications prefs, and `profiles.weekly_goal` (migration 0007); Forge re-skin of sign-in/sign-up with an integrated in-field password eye, a sign-up Name field stored to `profiles.display_name` (migration 0008 trigger), and a keyboard-stable layout. SKIN-01 + SET-01..09 + I18N-02 validated via device UAT. Known V1 gaps: forgot-password flow (non-functional label), first/last-name split (Linear FIT-84). Next: Phase 10 (Plans & Exercises re-skin).*

*Earlier: 2026-06-09 — milestone v2.0 (Forge Redesign) started. Current Milestone section added; Active section populated with v2.0 feature categories (design system, re-skin, settings/prefs, dashboard, PR/F18, rest-timer/F19, i18n, motion). Design source: `app/design v2/Sources/design/` (lib.jsx tokens + forge-screens.jsx, 17 screens). Schema audit confirmed most data fields already exist; only additive `profiles` migration + read-side RPCs needed.*

*Previous milestone-level update: 2026-05-16 after v1.0 milestone close — all 15 V1 requirements validated, 79 STRIDE threats SECURED, 4-week soak about to start. Phase artifacts archived to `.planning/milestones/v1.0-phases/`. Active section emptied; V1.1 carry-overs queued and gated by soak outcome.*

*Previous milestone-level update: 2026-05-14 after Phase 5 gap-closure (F5/F6/F7/F8/F13 fully validated post-FIT-7 through FIT-13).*
