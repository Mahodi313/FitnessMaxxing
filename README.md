# FitnessMaxxing

> **A personal iOS gym tracker — log a set, instantly see your last value on the same exercise, never lose a set.**

Built as a personal-use iPhone app first; potential App Store launch in V2. The "never lose a set" promise drives the offline-first architecture from day one.

| | |
|---|---|
| **Status** | Phase 4 of 7 complete · 17 plans shipped · ~57% V1 |
| **Stack** | Expo SDK 54 · React Native 0.81 · TypeScript 5.9 · Supabase (Postgres + Auth + RLS) |
| **Platform** | iOS-only in V1 (Expo Go on iPhone) · Android explicitly out of scope |
| **Build process** | AI-assisted SDLC via [GSD (Get Shit Done)](https://github.com/gsd-build/get-shit-done) on Claude Code · 7-phase roadmap · per-phase verification, code-review, and security-audit gates |
| **Discipline** | OWASP MASVS L1 + API Top 10 baseline · Phase 2 closed 27/27 STRIDE threats · 22/22 cross-user RLS regression assertions · pre-deploy schema drift verification |

---

## What's built so far

| Phase | Scope | Outcome |
|---|---|---|
| **1 — Bootstrap & Infra Hardening** | Locked stack installed (Expo 54, NativeWind 4, TanStack Query 5, Zustand 5, Supabase, react-hook-form + Zod, victory-native, Skia), dark-mode convention, walking-skeleton round-trip on iPhone | ✓ Complete (3 plans) |
| **2 — Schema, RLS & Type Generation** | 6-table Postgres schema deployed to Supabase remote with errata-fixed RLS (`with check` + wrapped `(select auth.uid())`), `set_type` ENUM, `handle_new_user` trigger, generated `Database` types wired into typed Supabase client, cross-user RLS test harness | ✓ Complete (6 plans, F17 validated, 27/27 SECURED) |
| **3 — Auth & Persistent Session** | Sign-up / sign-in wired to LargeSecureStore (encrypted session blob in AsyncStorage with key in `expo-secure-store`); session survives app-restart; root `Stack.Protected` + `(app)` group `<Redirect>` defense-in-depth | ✓ Complete (4 plans; UAT 9/11 pass; 2 gaps accepted-deferred to V1.1 — email-confirmation deep-link) |
| **4 — Plans, Exercises & Offline-Queue** | Create/edit/archive plans, add custom exercises, drag-to-reorder; offline-first via TanStack Query mutation queue with `resumePausedMutations` on reconnect, client-generated UUIDs (FK-safe), two-phase reorder algorithm; airplane-mode UAT signed off `approved`; Phase 4 cross-user RLS gate 29/29 PASS | ✓ Complete (4 plans; F2 + F3 + F4 closed end-to-end) |
| **5 — Active Workout Hot Path** *(F13 lives or dies)* | Set logging during a workout: ≤3s from button press to local persistence, set-position-aligned "last value" display, survives airplane mode + force-quit + battery-pull, draft-session recovery on cold start | Next |
| **6 — History & Read-Side Polish** | Workout history list + per-exercise progression chart | Pending |
| **7 — V1 Polish Cut** | RPE field, notes, dark-mode toggle UI · V1 ready for 4-week personal validation | Pending |

Detailed roadmap with success criteria per phase: [`.planning/ROADMAP.md`](./.planning/ROADMAP.md). Per-phase artifacts (CONTEXT, RESEARCH, PLAN, SUMMARY, VERIFICATION, REVIEW, SECURITY): [`.planning/phases/`](./.planning/phases/).

---

## Architecture highlights

- **Offline-first from V1.** F13 ("a logged set must never be lost") is a hard `Måste` requirement — drives the offline-queue + replay design rather than retrofitting it later.
- **RLS at the database, not the client.** Every user-scoped table has at least one policy with both `using` AND `with check` clauses, every `auth.uid()` reference is wrapped as `(select auth.uid())` for query-plan caching, and a cross-user test harness (`app/scripts/test-rls.ts`) is the regression gate. The PITFALLS-2.5 errata (missing `with check` on `plan_exercises` and `exercise_sets`) was fixed before the schema landed on remote.
- **Service-role isolation.** `SUPABASE_SERVICE_ROLE_KEY` lives only in `app/.env.local` and Node-only scripts; never imported from any Metro-bundled path. Audit gate: `git grep "service_role|SERVICE_ROLE"` matches only `app/scripts/test-rls.ts` and `app/.env.example` outside `.planning/` and `CLAUDE.md`.
- **Migration-as-truth.** Schema changes ship as numbered SQL migrations in `app/supabase/migrations/`, never via Studio editing. After every push, `app/scripts/verify-deploy.ts` introspects `pg_catalog` directly to confirm the deploy landed (Windows-without-Docker substitute for `supabase db diff`).
- **Type-gen runs after every schema migration.** `app/types/database.ts` is generated from the live remote schema; the Supabase client is typed via `createClient<Database>(...)` everywhere, including Node scripts.
- **Encrypted session storage.** `LargeSecureStore` wraps `expo-secure-store` + AES (`aes-js` + `react-native-get-random-values`) so JWT sessions exceeding the 2048-byte SecureStore limit are still encrypted at rest in AsyncStorage.

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
│   ├── lib/                                 # Typed Supabase client + LargeSecureStore
│   ├── types/database.ts                    # Generated from remote schema (do not hand-edit)
│   ├── supabase/migrations/                 # Schema source of truth
│   ├── scripts/test-rls.ts                  # Cross-user RLS regression gate
│   ├── scripts/verify-deploy.ts             # Post-migration drift check (no Docker required)
│   └── README.md                            # Dev-focused: setup, scripts, common workflows
│
├── .planning/                               # GSD planning artifacts
│   ├── PROJECT.md                           # Living project doc (validated/active reqs, decisions)
│   ├── ROADMAP.md                           # 7-phase plan with success criteria per phase
│   ├── REQUIREMENTS.md                      # F1–F17 requirement traceability
│   ├── STATE.md                             # Current execution position
│   ├── phases/                              # Per-phase: CONTEXT, RESEARCH, PLAN, SUMMARY, VERIFICATION, REVIEW, SECURITY
│   ├── research/                            # Standalone research docs (PITFALLS, ARCHITECTURE notes)
│   └── todos/                               # Cross-phase open items
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
- [`CLAUDE.md`](./CLAUDE.md) — Conventions every Claude Code agent applies (Database conventions, Security conventions, Navigation, Stack pinning)
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
                              gate

→  /gsd-code-review N   →   /gsd-secure-phase N   →   /gsd-verify-work N   →   merge to dev
        ↓                          ↓                          ↓
   REVIEW.md             SECURITY.md (STRIDE             VERIFICATION.md
   findings              register verified;              (must-haves checked
                         threats_open: 0)                vs codebase)
```

Every phase produces a verifiable artifact set. No phase advances until verification passes and `threats_open: 0`.

---

## Constraints worth knowing

- **iOS-only V1.** Android is explicitly out of scope (PRD).
- **Set-logging budget: ≤3 seconds** from button press to local persistence — UX-critical.
- **No Docker required** — `supabase db diff` is replaced by `verify-deploy.ts` (direct `pg_catalog` introspection via the pooler).
- **Personal V1 → potential App Store V2.** Apple Developer license is deferred until TestFlight; MASVS L2 controls (binary obfuscation, anti-tamper, jailbreak detection) are deferred to V2.

---

## License

Personal project — no public license at this stage. Source is visible for reference only.
