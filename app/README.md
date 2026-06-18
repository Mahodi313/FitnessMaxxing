# FitnessMaxxing — iOS app

The Expo app for FitnessMaxxing. iOS-only; runs in Expo Go on a physical iPhone. As of **v2.0 (Forge Redesign)** the full app is shipped: auth, plans/exercises CRUD, the active-workout hot path (offline-first, ≤3s/set, F13-guaranteed), history + per-exercise chart, a Home activity-ring dashboard, PR celebration, a rest timer, and complete Swedish + English UI on the Forge design system (dark/light parity).

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

If this is a fresh Supabase project, apply the schema (all 12 migrations, `0001` → `0012`):

```bash
npx supabase login                                           # one-time, opens browser
npx supabase link --project-ref <your-project-ref>           # binds CLI to project
npx supabase db push --yes -p "$SUPABASE_DB_PASSWORD"        # applies app/supabase/migrations/*.sql in order
npm run gen:types                                            # regenerates app/types/database.ts from live schema
```

Verify the deploy landed:

```bash
npx tsx --env-file=.env.local scripts/verify-deploy.ts       # introspects pg_catalog directly
```

You should see RLS = ON for all 6 tables, the `set_type` ENUM with 4 values, the `on_auth_user_created` trigger on `auth.users`, and the read-side RPCs from migrations `0011`/`0012` (dashboard, exercise summary, PR detection).

---

## Run the app

```bash
npm start
```

Scan the QR code with the Camera app on iPhone — Expo Go opens the project. You land on the auth screens (sign-in / sign-up); after sign-in you reach the tab bar (Planer / Historik / Inställningar). Theme follows the system setting unless overridden in Settings; language follows the device locale unless overridden (sv/en, live, no restart).

If iOS Simulator is available (Mac only), `npm run ios` opens it directly. The project is locked to iOS, so `android` and `web` scripts exist but are out-of-scope.

> Dev-only: a Forge component gallery is reachable in development at the `_forge-gallery` route (`__DEV__`-guarded, outside the tab group).

---

## Scripts

**Day-to-day:**

| Script | What it does |
|---|---|
| `npm start` | Starts Metro bundler, prints QR code |
| `npm run lint` | `expo lint` (eslint with Expo's recommended ruleset) |
| `npx tsc --noEmit` | TypeScript typecheck (no emit) — mandatory before committing |
| `npm run gen:types` | Regenerates `types/database.ts` from the linked remote schema (after every `db push`) |

**Schema / DB gates:**

| Script | What it does |
|---|---|
| `npm run test:rls` | Cross-user RLS regression harness (Node-only, uses service-role key; extended every phase that ships a user-scoped table or RPC) |
| `npx tsx --env-file=.env.local scripts/verify-deploy.ts` | Introspects `pg_catalog` to verify deployed schema state — substitutes for `supabase db diff` (Docker-only) |
| `npm run test:dashboard` | Verifies the dashboard/streak/week aggregate RPCs (migration `0011`) |
| `npm run inspect:recent-sessions` / `inspect:duplicate-sets` | Live-DB inspection helpers |

**Hot-path & feature contracts:**

| Script | What it does |
|---|---|
| `npm run test:f13-brutal` | F13 contract verifier — "a logged set must never be lost". Regression gate at the start of every phase. (Amber on a fixture precondition is environmental, not a regression — see FIT-107.) |
| `npm run test:e1rm` | Pure Epley e1RM unit tests (`lib/e1rm.ts`, PR detection source) |
| `npm run test:rest-timer` / `test:rest-timer-store` | Rest-timer pure logic + Zustand store (cancel-before-reschedule ordering) |
| `npm run test:units` / `test:units-store` | Unit conversion + reactive units store |
| `npm run test:locale-resolve` | Three-state language resolver (System/sv/en) |

**i18n & form schemas:**

| Script | What it does |
|---|---|
| `npm run test:i18n-coverage` | i18n coverage gate — fails on any missing key in either locale (CI-wired) |
| `npm run check:locale-parity` | Asserts `sv.json` / `en.json` have identical key sets |
| `npm run test:{auth,plan,exercise,plan-exercise,session,set}-schemas` | Zod schema unit tests per form boundary |
| `npm run test:{reorder-constraint,upsert-idempotency,offline-queue,sync-ordering}` | Offline-queue + ordering invariants (Phase 4 Wave-0 harness) |

The `reset-project` script that ships with `create-expo-app` is irrelevant here — the project is well past scaffold stage.

---

## File tour

```
app/
├── app/                         # File-based routes (Expo Router 6)
│   ├── _layout.tsx              # Root layout: Stack, StatusBar, FontBootstrap, LocaleBootstrap,
│   │                            #   UnitsBootstrap, ThemeBootstrap, splash gate, notification handler
│   ├── (auth)/                  # sign-in, sign-up (Forge re-skin)
│   └── (app)/                   # Protected group (Stack.Protected + <Redirect>)
│       ├── (tabs)/              # Planer / Historik / Inställningar
│       ├── plans/               # Plan list/detail/new + exercise picker + plan-exercise edit
│       ├── workout/             # Active-workout hot path + inline overlays
│       ├── history/             # History list + session detail
│       ├── exercise/            # Per-exercise progression chart
│       └── _forge-gallery.tsx   # __DEV__-only component gallery
│
├── lib/
│   ├── supabase.ts              # Typed createClient<Database> + LargeSecureStore + env-guard
│   ├── auth-store.ts            # Zustand auth/session state
│   ├── i18n.ts                  # react-i18next init; resolve-language.ts is the pure Node-importable core
│   ├── prefs.ts                 # fm:* preference wrappers (units, weekly goal, haptics, rest timer)
│   ├── units.ts / units-store.ts# kg↔lbs conversion (canonical kg) + reactive live-display store
│   ├── e1rm.ts                  # Pure Epley e1RM — single PR-detection formula source
│   ├── rest-timer.ts / rest-timer-store.ts  # Pure countdown logic + Zustand store (no persist)
│   ├── notifications.ts         # Fail-soft expo-notifications wrapper
│   ├── font-store.ts / persistence-store.ts # Font load + persistence flags
│   ├── muscle-group.ts          # Muscle-group taxonomy resolver
│   ├── queries/ · query/        # TanStack Query hooks + client/keys/persister
│   ├── schemas/                 # Zod schemas per form boundary
│   ├── seed/                    # Bilingual muscle-group seed
│   └── utils/
│
├── components/
│   ├── ui/                      # Forge library: ForgeButton/Field/Card/Stat/Chip, SettingsRow,
│   │                            #   ProgressRing, Sparkline, Logo, AppIcon, Icon, TabBar,
│   │                            #   PrBanner, PrTrophy, RestTimerBanner (+ index.ts barrel)
│   ├── active-session-banner.tsx
│   ├── offline-banner.tsx
│   └── segmented-control.tsx
│
├── locales/                     # sv.json / en.json (UI text only; user content never translated)
├── types/database.ts            # Generated from remote schema; do not hand-edit (npm run gen:types)
├── supabase/
│   ├── config.toml              # CLI binding to remote project (project_id only — non-sensitive)
│   └── migrations/              # Numbered SQL — schema source of truth (0001 → 0012)
├── scripts/                     # Node-only test/verify/inspect harnesses (see Scripts above)
├── assets/                      # fonts/ (Inter Display, Inter, JetBrains Mono) + images/
├── global.css                   # NativeWind 4 entry stylesheet
├── tailwind.config.js           # Forge tokens (THEMES.forge) + darkMode: 'class'
├── metro.config.js              # withNativeWind wrapper
└── app.json                     # Expo config (incl. expo-notifications plugin)
```

---

## Common workflows

### After adding a new table or modifying RLS

1. Write the SQL as a new numbered migration: `supabase/migrations/00NN_<descriptive-name>.sql`
2. Every writable policy has BOTH `using` AND `with check` clauses
3. Wrap every `auth.uid()` as `(select auth.uid())` (query-plan caching — see `../CLAUDE.md` Database conventions)
4. `npx supabase db push` to apply
5. `npm run gen:types` to regenerate `database.ts`
6. Add cross-user assertions for the new table/RPC to `scripts/test-rls.ts`
7. `npm run test:rls` — must pass
8. `npx tsx --env-file=.env.local scripts/verify-deploy.ts` — must show RLS=ON and policies/RPCs present
9. `npx tsc --noEmit` — must pass
10. Commit migration + types + test-rls + client code in atomic commits

### After adding or changing UI text

1. Add the key to **both** `locales/sv.json` and `locales/en.json` (never hardcode strings)
2. `npm run check:locale-parity` — key sets must match
3. `npm run test:i18n-coverage` — zero missing keys (also runs in CI)
4. User-created content (names, notes) is stored as written — never add it to the locale files

### After bumping a stack dep

`../CLAUDE.md` has a Version Compatibility Matrix explaining which packages are pinned together (e.g. NativeWind 4 hard-pins Tailwind 3). Re-read that section before bumping anything.

### Before committing

1. `npx tsc --noEmit`
2. `npm run lint`
3. If schema touched: `npm run test:rls` + `verify-deploy.ts`
4. If UI text touched: `npm run check:locale-parity` + `test:i18n-coverage`
5. If hot path touched: `npm run test:f13-brutal`

---

## Conventions enforced

These are codified in [`../CLAUDE.md`](../CLAUDE.md):

- **Migration-as-truth.** No Studio editing — schema diffs only via numbered SQL files in `supabase/migrations/`.
- **RLS pairs with policies.** Enabling RLS without at least one policy = "deny everything" (PITFALLS 2.2). Both ship in the same migration.
- **`using` AND `with check` on every writable policy.** Required by the PITFALLS 2.5 errata closed in Phase 2.
- **Service-role isolation.** `SUPABASE_SERVICE_ROLE_KEY` lives in `.env.local` and Node scripts only — never imported from any Metro-bundled path under `lib/`, `app/`, or `components/`. Audit gate: `git grep "service_role|SERVICE_ROLE"`.
- **Encrypted session storage.** Sessions go through `LargeSecureStore` (AES + `expo-secure-store`), never plain AsyncStorage.
- **Type-gen after schema changes.** `database.ts` is regenerated and committed with the migration that produced it.
- **Cross-user verification gate.** `test-rls.ts` is the regression detector for RLS gaps; new user-scoped tables/RPCs MUST be added to its assertion battery.
- **NativeWind box-decoration via `className`.** Box props (bg/border/radius/size) on a `Pressable` must live in `className`, not a `style()` callback (NativeWind 4 drops them) — keep `style()` for shadow/opacity only.
- **Inline overlays, not modal portals.** Confirm/destructive/edit/celebration overlays render inline in their host screen.

---

## Stack pinning

The locked stack is documented in [`../CLAUDE.md`](../CLAUDE.md) (TL;DR table). Notable pins:

- **Expo SDK 54** → React Native 0.81.5 + React 19.1
- **NativeWind 4.2** is hard-paired with **Tailwind 3.4** (Tailwind 4 will break NativeWind 4)
- **expo-secure-store 15.x** is the SDK-54 line — install via `npx expo install`, not `npm install`
- **Skia 2.2** + **victory-native 41** for charting; Skia also powers the static/animated ProgressRing + Sparkline
- **react-i18next + expo-localization** for sv/en; **expo-notifications** for the rest-timer local notification; **react-native-svg** for icons/logo

Any version bump must update the matrix and the install commands together.
