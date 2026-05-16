# FitnessMaxxing

> **A personal iOS gym tracker — log a set, instantly see your last value on the same exercise, never lose a set.**

Built as a personal-use iPhone app first; potential App Store launch in V2. The "never lose a set" promise drives the offline-first architecture from day one.

| | |
|---|---|
| **Status** | **V1.0 complete · all 7 phases shipped · 33 plans · entering 4-week personal soak validation (start 2026-05-17, PRD §8)** |
| **Stack** | Expo SDK 54 · React Native 0.81 · TypeScript 5.9 · NativeWind 4 (Tailwind 3) · TanStack Query 5 · Zustand 5 · react-hook-form 7 + Zod 4 · Supabase (Postgres + Auth + RLS) · Skia 2 + Victory Native XL 41 |
| **Platform** | iOS-only in V1 (Expo Go on iPhone) · Android explicitly out of scope |
| **Build process** | AI-assisted SDLC via [GSD (Get Shit Done)](https://github.com/gsd-build/get-shit-done) on Claude Code · 7-phase roadmap · per-phase verification, code-review, security-audit, and (for UI-heavy phases) human iPhone UAT gates · CI/CD via GitHub Actions opens auto-PRs to `dev` per phase-branch |
| **Discipline** | OWASP MASVS L1 + API Top 10 baseline · 79 STRIDE threats verified across phases 2–7 (`threats_open: 0` per phase) · cross-user RLS regression test extended every phase that touches user-scoped tables · pre-deploy schema drift verification (no Docker required) · per-phase F13-brutal-test (`a logged set must never be lost`) gate |

---

## What's built so far

| Phase | Scope | Outcome |
|---|---|---|
| **1 — Bootstrap & Infra Hardening** | Locked stack installed (Expo 54, NativeWind 4 + Tailwind 3, TanStack Query 5, Zustand 5, Supabase, react-hook-form + Zod, Victory Native XL, Skia), dark-mode convention, walking-skeleton round-trip on iPhone | ✓ Complete (3 plans) |
| **2 — Schema, RLS & Type Generation** | 6-table Postgres schema deployed to Supabase remote with errata-fixed RLS (`with check` + wrapped `(select auth.uid())`), `set_type` ENUM, `handle_new_user` trigger, generated `Database` types wired into typed Supabase client, cross-user RLS test harness | ✓ Complete (6 plans, F17 validated, 27/27 SECURED) |
| **3 — Auth & Persistent Session** | Sign-up / sign-in wired to LargeSecureStore (encrypted session blob in AsyncStorage with key in `expo-secure-store`); session survives app-restart; root `Stack.Protected` + `(app)` group `<Redirect>` defense-in-depth | ✓ Complete (4 plans; UAT 9/11 pass; 2 gaps accepted-deferred to V1.1 — email-confirmation deep-link, Apple Sign-In) |
| **4 — Plans, Exercises & Offline-Queue Plumbing** | Create/edit/archive plans, add custom exercises, drag-to-reorder; offline-first via TanStack Query mutation queue with `resumePausedMutations` on reconnect, client-generated UUIDs (FK-safe), two-phase reorder algorithm; airplane-mode UAT signed off `approved`; cross-user RLS gate 29/29 PASS | ✓ Complete (4 plans; F2 + F3 + F4 closed end-to-end) |
| **5 — Active Workout Hot Path** *(F13 lives or dies)* | Set logging during a workout: ≤3s from button press to local persistence, set-position-aligned "last value" display, survives airplane mode + force-quit + battery-pull; brutal-test verifies F13 contract; draft-session recovery on cold start; per-set `set_type` schema-ready (UI deferred to V1.1) | ✓ Complete (7 plans; F5 + F6 + F7 + F13 closed; F13 brutal-test green every subsequent phase) |
| **6 — History & Read-Side Polish** | Workout history list (paginated InfiniteQuery), per-session detail view with set-rows, per-exercise progression chart (max-weight + total-volume) via Victory Native XL on Skia 2; cross-user delete-cascade RLS hardened; chart RPCs server-side aggregated for performance | ✓ Complete (4 plans; F8 + F9 + F10 closed) |
| **7 — V1 Polish Cut** | F11 inline RPE input on workout set-row + RPE suffix in history detail; F12 session notes capture in AvslutaOverlay + view+edit in history-detail with FIFO offline-replay scope (T-07-03); F15 3-mode theme toggle (System/Ljust/Mörkt) with AsyncStorage persistence; signed-off iPhone UAT incl. NON-OPTIONAL T-07-03 hardware verification | ✓ Complete (5 plans; F11 + F12 + F15 closed; 20/20 STRIDE threats SECURED) |

Detailed roadmap with success criteria per phase: [`.planning/ROADMAP.md`](./.planning/ROADMAP.md). Per-phase artifacts (CONTEXT, RESEARCH, PLAN, SUMMARY, VERIFICATION, REVIEW, SECURITY): [`.planning/phases/`](./.planning/phases/).

---

## Architecture highlights

- **Offline-first from V1.** F13 ("a logged set must never be lost") is a hard `Måste` requirement — drives the offline-queue + replay design rather than retrofitting it later. Phase 5 brutal-test (`npm run test:f13-brutal`) verifies the contract on real DB rows after every set-logging session and is run as a regression gate at the start of subsequent phases.
- **FIFO mutation scope per resource.** `useFinishSession` / `useDeleteSession` / `useUpdateSessionNotes` (and similarly `useUpdatePlan` / `useArchivePlan` / `useRemovePlanExercise`) share the same `scope.id` (`session:${id}` or `plan:${id}`) so TanStack v5's `mutationCache` serializes paused mutations FIFO across reconnect — chained offline edits replay in the order they were issued, no orphan rows possible.
- **RLS at the database, not the client.** Every user-scoped table has at least one policy with both `using` AND `with check` clauses, every `auth.uid()` reference is wrapped as `(select auth.uid())` for query-plan caching, and a cross-user test harness (`app/scripts/test-rls.ts`) is the regression gate (extended in every phase that ships a new user-scoped table). The PITFALLS-2.5 errata (missing `with check` on `plan_exercises` and `exercise_sets`) was fixed before the schema landed on remote.
- **Service-role isolation.** `SUPABASE_SERVICE_ROLE_KEY` lives only in `app/.env.local` and Node-only scripts; never imported from any Metro-bundled path (`app/lib/`, `app/app/`, `app/components/`). Audit gate: `git grep "service_role|SERVICE_ROLE"` is checked at every code-review and secure-phase gate.
- **Migration-as-truth.** Schema changes ship as numbered SQL migrations in `app/supabase/migrations/`, never via Studio editing. After every push, `app/scripts/verify-deploy.ts` introspects `pg_catalog` directly to confirm the deploy landed (Windows-without-Docker substitute for `supabase db diff`).
- **Type-gen runs after every schema migration.** `app/types/database.ts` is generated from the live remote schema; the Supabase client is typed via `createClient<Database>(...)` everywhere, including Node scripts.
- **Encrypted session storage.** `LargeSecureStore` wraps `expo-secure-store` + AES (`aes-js` + `react-native-get-random-values`) so JWT sessions exceeding the 2048-byte SecureStore limit are still encrypted at rest in AsyncStorage.
- **Inline-overlay UX (NOT modal portals).** All confirm/destructive/edit overlays render inline inside their host screen (PATTERNS landmine #3) so freezeOnBlur cleanup and gesture-handler integration stay coherent. Multi-line `TextInput` overlays use a direct `Keyboard.addListener('keyboardWillShow')` measurement (Phase 7 hotfix) rather than `KeyboardAvoidingView`, which proved unreliable inside absolutely-positioned backdrops on iOS 26.4.

Full architecture document: [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Quick start

```bash
git clone https://github.com/Mahodi313/FitnessMaxxing.git
cd FitnessMaxxing/app
npm install
cp .env.example .env.local       # fill in your Supabase project values
npm start                         # then scan the QR code with Expo Go on iPhone
```

Detailed setup, env-var population, and `supabase login` for the type-gen path: [`app/README.md`](./app/README.md).

---

## Repo structure

```
FitnessMaxxing/
├── app/                                     # Expo iOS app (the deliverable)
│   ├── app/                                 # File-based routes (Expo Router 6)
│   ├── lib/                                 # Typed Supabase client, queries, schemas, LargeSecureStore
│   ├── components/                          # Shared UI (e.g. ActiveSessionBanner, OfflineBanner)
│   ├── types/database.ts                    # Generated from remote schema (do not hand-edit)
│   ├── supabase/migrations/                 # Schema source of truth (0001_initial → 0006_phase6_chart_rpcs)
│   ├── scripts/test-rls.ts                  # Cross-user RLS regression gate (extends every phase)
│   ├── scripts/test-f13-brutal.ts           # F13 contract verifier — runs on every set-logging session
│   ├── scripts/verify-deploy.ts             # Post-migration drift check (no Docker required)
│   └── README.md                            # Dev-focused: setup, scripts, common workflows
│
├── .planning/                               # GSD planning artifacts
│   ├── PROJECT.md                           # Living project doc (validated/active reqs, decisions)
│   ├── ROADMAP.md                           # 7-phase plan with success criteria per phase
│   ├── REQUIREMENTS.md                      # F1–F17 requirement traceability
│   ├── STATE.md                             # Current execution position
│   ├── phases/                              # Per-phase: CONTEXT, RESEARCH, PLAN, SUMMARY, VERIFICATION, REVIEW, SECURITY, HUMAN-UAT
│   ├── research/                            # Standalone research docs (PITFALLS, ARCHITECTURE notes)
│   └── todos/                               # Cross-phase open items
│
├── scripts/                                 # Repo-level scripts (Linear sync, CI helpers)
│   ├── sync-phase-to-linear.ts              # Mirrors phase plans → Linear epics + sub-issues
│   ├── get-linear-issue-full.ts             # Fetch single Linear issue body (for triage)
│   └── create-linear-issue.ts               # Create a Linear bug/debt/deferred issue inline
│
├── .github/workflows/                       # CI/CD (auto-PR per phase branch, build/lint/RLS gates)
│
├── PRD.md                                   # Product requirements (F1–F17 + scope boundaries)
├── ARCHITECTURE.md                          # Tech stack rationale + 6-table schema + RLS policies
├── CLAUDE.md                                # Conventions Claude Code agents follow per turn
├── GSD_BOOTSTRAP_PROMPT.md                  # One-time bootstrap for fresh GSD installs
└── README.md                                # You are here
```

---

## Documentation index

**For understanding what this is:**
- [`PRD.md`](./PRD.md) — Product requirements: features F1–F17, user flows, scope boundaries
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — Tech stack with version pinning, 6-table schema, RLS policies, decision register
- [`.planning/PROJECT.md`](./.planning/PROJECT.md) — Living project doc; validated vs. active vs. out-of-scope requirements

**For running it locally:**
- [`app/README.md`](./app/README.md) — Setup, env vars, scripts, common dev workflows

**For working with the GSD planning loop:**
- [`CLAUDE.md`](./CLAUDE.md) — Conventions every Claude Code agent applies (Database conventions, Security conventions, Navigation, Stack pinning, Branching strategy, Linear integration)
- [`.planning/ROADMAP.md`](./.planning/ROADMAP.md) — Per-phase scope and success criteria
- [`.planning/phases/`](./.planning/phases/) — Per-phase planning, execution, and audit artifacts

---

## Development workflow

GSD-on-Claude-Code drives a per-phase loop:

```
/gsd-discuss-phase N   →   /gsd-plan-phase N   →   /gsd-execute-phase N
        ↓                          ↓                       ↓
   CONTEXT.md +               PLAN.md per             SUMMARY.md per
   open questions             plan + threat           plan + per-task
   resolved                   model + verify          atomic commits
                              gate                    (auto-tagged [FIT-NN])

→  /gsd-code-review N   →   /gsd-secure-phase N   →   /gsd-verify-work N   →   merge to dev
        ↓                          ↓                          ↓
   REVIEW.md             SECURITY.md (STRIDE             VERIFICATION.md
   findings              register verified;              (must-haves checked
                         threats_open: 0)                vs codebase)

For UI-heavy phases (4, 5, 7): an additional /gsd-execute-phase plan
authors `<phase>-HUMAN-UAT.md` and the developer runs the script on
real iPhone hardware before phase.complete.
```

Every phase produces a verifiable artifact set. No phase advances until verification passes and `threats_open: 0`. Branching strategy enforces auto-PRs from `gsd/phase-N-...` → `dev` via `.github/workflows/phase-branch.yml`; bug-fix work uses `fix/FIT-XX-...` branches off `dev` per CLAUDE.md.

Linear integration: phase plans are mirrored to Linear epics + sub-issues via `npm run linear:sync-phase`; commits are auto-tagged with the matching `[FIT-NN]` Linear ID; PR-merge auto-closes the corresponding sub-issues, which auto-closes the parent epic when the last sub closes.

---

## Constraints worth knowing

- **iOS-only V1.** Android is explicitly out of scope (PRD).
- **Set-logging budget: ≤3 seconds** from button press to local persistence — UX-critical. Verified by `test:f13-brutal`.
- **No Docker required** — `supabase db diff` is replaced by `verify-deploy.ts` (direct `pg_catalog` introspection via the pooler).
- **Personal V1 → potential App Store V2.** Apple Developer license is deferred until TestFlight; MASVS L2 controls (binary obfuscation, anti-tamper, jailbreak detection) are deferred to V2.
- **4-week personal soak validation** (PRD §8) starts 2026-05-17. Tolerance: ≤1 bug/week, all workouts logged paperlessly. Outcome gates the App Store path (V1.1 → TestFlight) vs. continued private use.

---

## What's next (V1.1+)

Captured as Linear issues in the `Backlog` lane:

- **F1.1 — Email-confirmation deep-link** (FIT-46): currently opens in browser; should open the app directly. Carry-over from Phase 3 UAT.
- **F14 — Apple Sign-In** (FIT-45): App Store-blocker. Apple Identity provider via Supabase Auth.
- **Set-type UI** — Schema is in place since Phase 2 (`set_type` ENUM with `working`/`warmup`/`dropset`/`failure`); UI to switch type per-set deferred from V1 polish.
- **F18+ V1.1 features** — PR detection, rest timer, additional polish surfaced during 4-week soak.

The 4-week soak determines whether V1.1 ships to TestFlight or whether the project remains private.

---

## License

Personal project — no public license at this stage. Source is visible for reference only.
