# FitnessMaxxing

> **A personal iOS gym tracker — log a set, instantly see your last value on the same exercise, never lose a set.**

Built as a personal-use iPhone app first; potential App Store launch in a later milestone. The "never lose a set" promise drives the offline-first architecture from day one. V2.0 rewrote the whole UI to the "Forge" design system and added a Home dashboard, PR celebration, a rest timer, and English — without touching that offline-first write path.

| | |
|---|---|
| **Status** | **V2.0 — Forge Redesign complete · phases 8–15 shipped (41 plans, 48/48 requirements validated) · 2026-06-17.** V1.0 MVP shipped 2026-05-16 (7 phases, 33 plans). Next: App Store path (Apple Sign-In / TestFlight). |
| **Stack** | Expo SDK 54 · React Native 0.81 · TypeScript 5.9 · NativeWind 4 (Tailwind 3) · TanStack Query 5 · Zustand 5 · react-hook-form 7 + Zod 4 · Supabase (Postgres + Auth + RLS) · Skia 2 + Victory Native XL 41 · react-i18next + expo-localization (sv/en) · expo-notifications · react-native-svg |
| **Platform** | iOS-only (Expo Go on iPhone) · Android explicitly out of scope (design is token-driven and Android-ready when greenlit) |
| **Build process** | AI-assisted SDLC via [GSD (Get Shit Done)](https://github.com/gsd-build/get-shit-done) on Claude Code · 15 phases across 2 milestones · per-phase verification, code-review, security-audit, and (for UI-heavy phases) human iPhone UAT gates · CI/CD via GitHub Actions opens auto-PRs to `dev` per phase-branch |
| **Discipline** | OWASP MASVS L1 + API Top 10 baseline · 79 STRIDE threats verified across v1.0 (`threats_open: 0` per phase) + per-phase threat models through v2.0 · cross-user RLS regression test extended every phase that touches user-scoped tables · pre-deploy schema drift verification (no Docker required) · F13-brutal-test (`a logged set must never be lost`) gate held green through a full UI rewrite |

---

## What's built

### v2.0 — Forge Redesign (phases 8–15, shipped 2026-06-17)

| Phase | Scope | Outcome |
|---|---|---|
| **8 — Forge Foundation** | Forge color tokens (light+dark) in `tailwind.config.js`; Inter Display / Inter / JetBrains Mono via expo-font with splash gate; react-i18next + expo-localization i18n scaffold; static Skia ProgressRing + Sparkline (no new charting dep); Forge component library | ✓ Complete (5 plans) |
| **9 — Auth, Settings & Preferences** | Forge re-skin of sign-in/sign-up; new Settings screen (Profile · Appearance · Workout · Notifications · Sign-out); preference layer — units (kg/lbs), weekly goal (`profiles.weekly_goal`), language, haptics/notifications; live language switch, no restart | ✓ Complete (3 plans) |
| **10 — Plans & Exercises Re-skin** | Re-skinned plans list/detail/new + exercise picker (filter pills, AND-search, create-new) + plan-exercise edit, surfacing muscle group / equipment / set-rep targets / notes the v1 UI hid; 18-row bilingual muscle-group seed; tab-bar re-skin | ✓ Complete (6 plans) |
| **11 — Active Workout Re-skin** *(HIGH RISK — F13)* | Re-skinned the hot-path workout screen (progress dots, Forge set table, custom header + live timer) + finish/draft-resume/saved-toast overlays (inline, no modal portals); set-logged motion + Settings-gated haptic | ✓ Complete (3 plans; F13 brutal-test stayed green; ≤3s budget intact) |
| **12 — History, Detail, Chart & Home Dashboard** | Re-skinned read-side screens; Home activity-ring dashboard (sessions vs weekly goal, streak, weekly volume + delta, sparkline) backed by RLS-scoped read-side RPCs; animated ring fill + chart draw-on-mount; reactive units store for live kg↔lbs | ✓ Complete (11 plans; incl. 3 device-UAT gap-closures FIT-109/110/111) |
| **13 — PR Celebration (F18)** | Client-side offline-safe PR detection via Epley e1RM (`lib/e1rm.ts`); 3 read-only PR RPCs flagging PR-at-log-time via strictly-prior SQL window frame; in-workout trophy + gradient-sweep banner; read-side PR surfacing in history/detail/chart | ✓ Complete (5 plans) |
| **14 — Rest Timer (F19)** | Auto-start rest countdown on "Klart" that survives backgrounding by re-deriving from a stored `endTs` (not a JS timer); DATE-trigger local notification when rest ends; fail-soft notifications wrapper + Settings duration picker + in-context permission prompt | ✓ Complete (4 plans) |
| **15 — Bilingual & Release Hardening** | CI i18n-coverage gate (`check-i18n-coverage.ts`) + `__DEV__` missing-key handler → zero missing keys; tab-bar icon spring; full release-candidate device UAT across 12 screens × 4 language/theme combos, approved on real iPhone | ✓ Complete (4 plans) |

### v1.0 — MVP (phases 1–7, shipped 2026-05-16)

Bootstrap & infra hardening · 6-table Postgres schema with errata-fixed RLS · auth + persistent encrypted session · plans/exercises + offline-queue plumbing · active-workout hot path (F13 lives or dies) · history + per-exercise chart · V1 polish (RPE, notes, dark-mode toggle). 33 plans, all 15 V1 requirements validated, 79 STRIDE threats SECURED. Full breakdown: [`.planning/milestones/v1.0-ROADMAP.md`](./.planning/milestones/v1.0-ROADMAP.md).

Milestone summaries + stats: [`.planning/MILESTONES.md`](./.planning/MILESTONES.md). Current roadmap: [`.planning/ROADMAP.md`](./.planning/ROADMAP.md). Per-phase artifacts (CONTEXT, RESEARCH, PLAN, SUMMARY, VERIFICATION, REVIEW, SECURITY): [`.planning/phases/`](./.planning/phases/).

---

## Architecture highlights

- **Offline-first from V1.** F13 ("a logged set must never be lost") is a hard `Måste` requirement — drives the offline-queue + replay design. `npm run test:f13-brutal` verifies the contract on real DB rows and runs as a regression gate at the start of every phase. It stayed green through the entire v2.0 UI rewrite.
- **FIFO mutation scope per resource.** `useFinishSession` / `useDeleteSession` / `useUpdateSessionNotes` (and the parallel `plan:${id}` family) share the same `scope.id` so TanStack v5's `mutationCache` serializes paused mutations FIFO across reconnect — chained offline edits replay in issuance order, no orphan rows.
- **Token-driven dark/light parity (Forge, v2.0).** Color tokens mirror `THEMES.forge` into `tailwind.config.js` via a `forge-<token>-light` base + `dark:` sibling `forge-<token>` DEFAULT, so every screen inherits dark-mode without per-screen logic. **NativeWind box-decoration must live in `className`** (not a `style()` callback) — NativeWind 4 drops box props (bg/border/radius/size) on `Pressable`.
- **Reactive Zustand stores (no persist) for live cross-screen prefs (v2.0).** `units-store` / `rest-timer-store` hold live display state so a Settings change (kg↔lbs, etc.) re-renders every consumer immediately, no restart.
- **Offline-safe derived features (v2.0).** PR detection (Epley e1RM, `lib/e1rm.ts`, single formula source — no persisted `is_pr` column) and the rest countdown both compute from local/persisted state + absolute timestamps, never from network or JS intervals.
- **RLS at the database, not the client.** Every user-scoped table has at least one policy with both `using` AND `with check` clauses; every `auth.uid()` is wrapped `(select auth.uid())` for query-plan caching; a cross-user harness (`app/scripts/test-rls.ts`) is the regression gate, extended every phase that ships a new user-scoped table or RPC. Read-side aggregates (dashboard/chart/PR) are SECURITY-INVOKER RPCs with `search_path=''`, finished-only, `set_type='working'` — no cross-user aggregation.
- **Service-role isolation.** `SUPABASE_SERVICE_ROLE_KEY` lives only in `app/.env.local` and Node-only scripts; never imported from any Metro-bundled path. Audit gate: `git grep "service_role|SERVICE_ROLE"` checked at every code-review and secure-phase gate.
- **Migration-as-truth.** Schema changes ship as numbered SQL migrations in `app/supabase/migrations/` (0001 → 0012), never via Studio. After every push, `app/scripts/verify-deploy.ts` introspects `pg_catalog` directly (Windows-without-Docker substitute for `supabase db diff`). `app/types/database.ts` is regenerated from the live schema and committed with the migration.
- **Encrypted session storage.** `LargeSecureStore` wraps `expo-secure-store` + AES (`aes-js` + `react-native-get-random-values`) so JWT sessions exceeding the 2048-byte SecureStore limit are encrypted at rest in AsyncStorage.
- **Inline-overlay UX (NOT modal portals).** All confirm/destructive/edit/celebration overlays render inline inside their host screen (PATTERNS landmine #3) so freezeOnBlur cleanup + gesture-handler integration stay coherent. Multi-line `TextInput` overlays use a direct `Keyboard.addListener('keyboardWillShow')` measurement rather than `KeyboardAvoidingView`, which was unreliable inside absolute-positioned backdrops on iOS 26.
- **i18n = UI-text only (v2.0).** react-i18next + expo-localization with a three-state resolver (System/sv/en) overriding device locale live; user-created content (plan/exercise names, notes) is stored as written and never auto-translated. A CI coverage gate keeps both locales at zero missing keys.

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
│   ├── lib/                                 # Typed Supabase client, queries, schemas, i18n,
│   │                                        #   e1rm, rest-timer, units-store, LargeSecureStore
│   ├── components/                          # Forge UI library + screen components + overlays
│   ├── locales/                             # sv.json / en.json translation resources
│   ├── types/database.ts                    # Generated from remote schema (do not hand-edit)
│   ├── supabase/migrations/                 # Schema source of truth (0001_initial → 0012_phase13_pr_rpcs)
│   ├── scripts/test-rls.ts                  # Cross-user RLS regression gate (extends every phase)
│   ├── scripts/verify-f13-brutal-test.ts    # F13 contract verifier (npm run test:f13-brutal)
│   ├── scripts/check-i18n-coverage.ts       # i18n coverage gate (zero missing keys, CI-wired)
│   ├── scripts/verify-deploy.ts             # Post-migration drift check (no Docker required)
│   └── README.md                            # Dev-focused: setup, scripts, common workflows
│
├── .planning/                               # GSD planning artifacts
│   ├── PROJECT.md                           # Living project doc (validated/active reqs, decisions)
│   ├── ROADMAP.md                           # Roadmap (v1.0 + v2.0 collapsed; future milestone sketched)
│   ├── MILESTONES.md                        # Shipped-milestone summaries + stats
│   ├── RETROSPECTIVE.md                     # Per-milestone retrospective + cross-milestone trends
│   ├── STATE.md                             # Current execution position
│   ├── milestones/                          # Archived per-milestone ROADMAP + REQUIREMENTS
│   ├── phases/                              # Per-phase: CONTEXT, RESEARCH, PLAN, SUMMARY, VERIFICATION, REVIEW, SECURITY, UAT
│   └── research/                            # Standalone research docs (STACK, FEATURES, ARCHITECTURE, PITFALLS)
│
├── scripts/                                 # Repo-level scripts (Linear sync, CI helpers)
│
├── .github/workflows/                       # CI/CD (auto-PR per phase branch; dev→main release gate)
│
├── PRD.md                                   # Product requirements + scope boundaries
├── ARCHITECTURE.md                          # Tech stack rationale + 6-table schema + RLS policies
├── CLAUDE.md                                # Conventions Claude Code agents follow per turn
└── README.md                                # You are here
```

> Note: `.planning/REQUIREMENTS.md` is milestone-scoped — it is archived to `.planning/milestones/v{X.Y}-REQUIREMENTS.md` at milestone close and recreated fresh for the next milestone via `/gsd:new-milestone`.

---

## Documentation index

**For understanding what this is:**
- [`PRD.md`](./PRD.md) — Product requirements: features, user flows, scope boundaries
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — Tech stack with version pinning, 6-table schema, RLS policies, decision register
- [`.planning/PROJECT.md`](./.planning/PROJECT.md) — Living project doc; validated vs. active vs. out-of-scope requirements
- [`.planning/MILESTONES.md`](./.planning/MILESTONES.md) — Shipped-milestone summaries (v1.0 + v2.0)

**For running it locally:**
- [`app/README.md`](./app/README.md) — Setup, env vars, scripts, common dev workflows

**For working with the GSD planning loop:**
- [`CLAUDE.md`](./CLAUDE.md) — Conventions every Claude Code agent applies (Database, Security, Navigation, Stack pinning, Branching, Linear integration)
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

For UI-heavy phases: an additional plan authors `<phase>-UAT.md` and the
developer runs the script on real iPhone hardware before phase.complete.
Milestone close (/gsd:complete-milestone) archives the roadmap +
requirements; the version tag + GitHub Release come from the dev→main PR.
```

Every phase produces a verifiable artifact set. No phase advances until verification passes and `threats_open: 0`. Branching: auto-PRs from `gsd/phase-N-...` → `dev` via `.github/workflows/phase-branch.yml`; bug-fix work uses `fix/FIT-XX-...` branches off `dev`; the `dev→main` PR is the release gate.

Linear integration: phase plans are mirrored to Linear epics + sub-issues via `npm run linear:sync-phase`; commits are auto-tagged with the matching `[FIT-NN]` ID; PR-merge auto-closes sub-issues, which auto-closes the parent epic.

---

## Constraints worth knowing

- **iOS-only.** Android is explicitly out of scope (PRD); the Forge design is token-driven and Android-ready if/when greenlit.
- **Set-logging budget: ≤3 seconds** from button press to local persistence — UX-critical. Verified by `test:f13-brutal`, held through the v2.0 re-skin.
- **No Docker required** — `supabase db diff` is replaced by `verify-deploy.ts` (direct `pg_catalog` introspection via the pooler).
- **Personal app → potential App Store launch.** Apple Developer license is deferred until TestFlight; MASVS L2 controls (binary obfuscation, anti-tamper, jailbreak detection) are deferred to the App Store milestone.
- **Local notifications only.** The rest timer uses scheduled local notifications (Expo Go SDK 54); no remote push.

---

## What's next (App Store Launch milestone — sketched, not yet planned)

Start with `/gsd:new-milestone`. Scope requires an Apple Developer license + EAS tooling:

- **F14 — Apple Sign-In** (FIT-45): App Store-blocker.
- **TestFlight build via EAS** — Windows-only dev credential flow (research-flagged).
- **F1.1 — Email-confirmation deep-link** (FIT-46): currently opens in browser; should open the app directly.
- **App-Store-grade DB design** — expanded user/account data model.
- **Carry-over polish** — first/last-name split (FIT-84), functional forgot-password flow, set-type toggling under active workout (F17-UI; schema exists since Phase 2), alternate themes (Atlas / Volt).

---

## License

Personal project — no public license at this stage. Source is visible for reference only.
