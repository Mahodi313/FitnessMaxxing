# FitnessMaxxing — iOS app

The Expo app for FitnessMaxxing. iOS-only in V1; runs in Expo Go on a physical iPhone. The walking-skeleton round-trip and the typed Supabase client (Phase 1 + 2) are in place — sign-up / sign-in flows arrive in Phase 3.

For the project overview, roadmap, and architecture rationale, see [`../README.md`](../README.md), [`../ARCHITECTURE.md`](../ARCHITECTURE.md), and [`../.planning/ROADMAP.md`](../.planning/ROADMAP.md).

---

## Prerequisites

- **Node 20+** (the Supabase JS client requires it)
- **npm 10+** (ships with Node 20)
- **Expo Go** on your iPhone (App Store)
- **A Supabase project** — free tier is enough. You'll need:
  - the project URL
  - the `anon` public key
  - the `service_role` secret (for the Node-only RLS test harness — never bundled into the app)
  - the database password (for migration push)
- **Supabase CLI access token** — `npx supabase login` once, browser OAuth (writes to `~/.supabase/access-token`)

---

## Setup

```bash
# from repo root
cd app
npm install
cp .env.example .env.local
```

Open `.env.local` and fill in:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your anon public key>

# Node-only secrets — NEVER prefix with EXPO_PUBLIC_
SUPABASE_SERVICE_ROLE_KEY=<your service_role secret>
SUPABASE_DB_PASSWORD=<your db password>
```

`.env.local` is gitignored. The `EXPO_PUBLIC_` prefix is what determines whether a value is bundled into the app — anything without that prefix stays Node-only.

If this is a fresh Supabase project, apply the schema:

```bash
npx supabase login                                           # one-time, opens browser
npx supabase link --project-ref <your-project-ref>           # binds CLI to project
npx supabase db push --yes -p "$SUPABASE_DB_PASSWORD"        # applies app/supabase/migrations/0001_initial_schema.sql
npm run gen:types                                            # regenerates app/types/database.ts from live schema
```

Verify the deploy landed:

```bash
npx tsx --env-file=.env.local scripts/verify-deploy.ts       # introspects pg_catalog directly
```

You should see RLS = ON for all 6 tables, the `set_type` ENUM with 4 values, and the `on_auth_user_created` trigger on `auth.users`.

---

## Run the app

```bash
npm start
```

Scan the QR code with the Camera app on iPhone — Expo Go opens the project. The walking-skeleton screen renders "Hello FitnessMaxxing" with dark-mode-aware styling; status bar follows the system theme.

If iOS Simulator is available (Mac only), `npm run ios` opens it directly. The project is locked to iOS in V1, so `android` and `web` scripts exist but are out-of-scope.

---

## Scripts

| Script | What it does | When to run |
|---|---|---|
| `npm start` | Starts Metro bundler, prints QR code | Every dev session |
| `npm run gen:types` | Regenerates `types/database.ts` from the linked remote schema | After every `db push` |
| `npm run test:rls` | Runs the cross-user RLS test harness (22 assertions across 6 tables) | After any schema change to a user-scoped table; before merging schema PRs |
| `npm run lint` | `expo lint` (eslint with Expo's recommended ruleset) | Before committing |
| `npx tsc --noEmit` | TypeScript typecheck (no emit) | Before committing; mandatory for schema changes |
| `npx tsx --env-file=.env.local scripts/verify-deploy.ts` | Introspects `pg_catalog` to verify deployed schema state | After every `db push`; substitutes for `supabase db diff` (Docker-only) |

The `reset-project` script that ships with `create-expo-app` exists but is irrelevant here — the project is past scaffold stage.

---

## File tour

```
app/
├── app/                     # File-based routes (Expo Router 6)
│   ├── _layout.tsx          # Root layout: Stack, StatusBar, focusManager + onlineManager wiring
│   └── index.tsx            # Walking-skeleton screen (will be replaced in Phase 3+)
│
├── lib/
│   └── supabase.ts          # Typed createClient<Database> + LargeSecureStore + env-guard
│
├── types/
│   └── database.ts          # Generated from remote schema; do not hand-edit. Regenerate via `npm run gen:types`.
│
├── supabase/
│   ├── config.toml          # CLI binding to remote project (project_id only — non-sensitive)
│   ├── migrations/          # Numbered SQL migrations — schema source of truth
│   │   └── 0001_initial_schema.sql
│   └── .gitignore           # CLI-managed; verified to NOT ignore config.toml
│
├── scripts/
│   ├── test-rls.ts          # Cross-user RLS verification harness — Node-only, uses service-role key
│   └── verify-deploy.ts     # Direct pg_catalog introspection — Windows-without-Docker drift check
│
├── assets/                  # Fonts, icons, splash images
├── global.css               # NativeWind 4 entry stylesheet
├── tailwind.config.js       # darkMode: 'class' for system-theme bridge
├── metro.config.js          # withNativeWind wrapper
└── app.json                 # Expo config (name, slug, iOS bundle identifier)
```

---

## Common workflows

### After adding a new table or modifying RLS

1. Write the SQL as a new numbered migration: `app/supabase/migrations/0002_<descriptive-name>.sql`
2. Make sure every writable policy has BOTH `using` AND `with check` clauses
3. Wrap every `auth.uid()` reference as `(select auth.uid())` (caching the query plan — see `../CLAUDE.md` Database conventions)
4. `npx supabase db push` to apply
5. `npm run gen:types` to regenerate `database.ts`
6. Add cross-user assertions for the new table to `scripts/test-rls.ts`
7. `npm run test:rls` — must pass
8. `npx tsx --env-file=.env.local scripts/verify-deploy.ts` — must show RLS=ON and policies present
9. `npx tsc --noEmit` — must pass
10. Commit migration + types + test-rls + any client code in atomic commits

### After bumping a stack dep

`../CLAUDE.md` has a Version Compatibility Matrix that explains which packages are pinned together (e.g., NativeWind 4 hard-pins Tailwind 3). Re-read that section before bumping anything in the Recommended Stack table.

### Before committing

1. `npx tsc --noEmit`
2. `npm run lint`
3. If schema touched: `npm run test:rls` and `verify-deploy.ts`

---

## Conventions enforced

These are codified in [`../CLAUDE.md`](../CLAUDE.md):

- **Migration-as-truth.** No Studio editing — schema diffs only via numbered SQL files in `supabase/migrations/`.
- **RLS pairs with policies.** Enabling RLS without adding at least one policy = "deny everything" (PITFALLS 2.2). Both ship in the same migration.
- **`using` AND `with check` on every writable policy.** Required by the PITFALLS 2.5 errata that closed in Phase 2.
- **Service-role isolation.** `SUPABASE_SERVICE_ROLE_KEY` lives in `.env.local` and Node scripts only — never imported from any path under `lib/` or `app/` (Metro-bundled). The audit gate is `git grep "service_role|SERVICE_ROLE"`.
- **Encrypted session storage.** Sessions go through `LargeSecureStore` (AES + `expo-secure-store`), never plain AsyncStorage.
- **Type-gen after schema changes.** `database.ts` is regenerated and committed with the migration that produced it.
- **Cross-user verification gate.** `test-rls.ts` is the regression detector for RLS gaps; new user-scoped tables MUST be added to its assertion battery.

---

## Stack pinning

The locked stack is documented in [`../CLAUDE.md`](../CLAUDE.md) (TL;DR table). Notable pins:

- **Expo SDK 54** → React Native 0.81.5 + React 19.1
- **NativeWind 4.2** is hard-paired with **Tailwind 3.4** (Tailwind 4 will break NativeWind 4)
- **expo-secure-store 14.x** is the SDK-54 line — install via `npx expo install`, not `npm install` (latest npm tag is for SDK 55)
- **Skia 2.6** + **victory-native 41** for charting (Phase 6)

Any version bump must update the matrix and the install commands together.
