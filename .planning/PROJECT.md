# FitnessMaxxing

## What This Is

A personal iOS gym tracker for iPhone where the user creates their own training plans, logs sets during a workout, and immediately sees the last value on the same exercise — never losing a set even through airplane mode + force-quit + battery-pull. V1.0 shipped 2026-05-16 as a personal-use deliverable; entering 4-week soak validation (PRD §8) before deciding the App Store path.

## Core Value

Logga ett set och omedelbart se vad jag tog senast på samma övning — utan att tappa data, någonsin.

**v1.0 outcome:** verified by F13 brutal-test (`npm run test:f13-brutal`) running as a regression gate every phase, manual airplane-mode + force-quit UAT signed off Phase 5, and 4-week personal soak about to start. Core value remains the right priority.

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

### Active

<!-- Current scope. None yet — V1.1 planning starts after 4-week soak. -->

(None active during soak. Carry-overs queued for V1.1 — see below.)

### V1.1 Carry-overs (queued, gated by 4-week soak)

- **F1.1** — Email-confirmation deep-link handler (Expo Linking + Supabase verifyOtp/exchangeCodeForSession) — currently opens in browser. Captured as FIT-46.
- **F14** — Apple Sign-In (App Store-blocker). Captured as FIT-45.
- **F17-UI** — Set-typ-toggling under aktivt pass (warmup/working/dropset/failure). Schema sedan Phase 2.
- **F18** — PR-detection vid pass-avslut (Epley `w * (1 + r/30)`, max-vikt, max-volym per övning).
- **F19** — Vilo-timer som auto-triggas vid "Klart"-tap. Research-flag: `expo-notifications` + `expo-keep-awake`, JS-suspension-trap.

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
*Last updated: 2026-05-16 after v1.0 milestone close — all 15 V1 requirements validated, 79 STRIDE threats SECURED, 4-week soak about to start. Phase artifacts archived to `.planning/milestones/v1.0-phases/`. Active section emptied; V1.1 carry-overs queued and gated by soak outcome.*

*Previous milestone-level update: 2026-05-14 after Phase 5 gap-closure (F5/F6/F7/F8/F13 fully validated post-FIT-7 through FIT-13).*
