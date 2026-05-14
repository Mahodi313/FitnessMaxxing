<!-- GSD:project-start source:PROJECT.md -->
## Project

**FitnessMaxxing**

En personlig gym-tracker för iPhone där användaren skapar egna träningsplaner, loggar set under passet, och ser direkt vad senaste värdet var per övning. V1 byggs som ett personligt verktyg; V2+ kan eventuellt lanseras till App Store.

**Core Value:** Logga ett set och omedelbart se vad jag tog senast på samma övning — utan att tappa data, någonsin.

### Constraints

- **Tech stack**: Expo + Supabase + TypeScript låst i ARCHITECTURE.md beslutsregister — får inte bytas utan att registret revideras explicit
- **Plattform**: iOS-only i V1 (iPhone via Expo Go) — Android avskuret
- **Performance**: Loggning av ett set ≤ 3 sekunder från knapptryck till lokalt sparat — UX-kritiskt
- **Data integrity**: Får ALDRIG förlora ett loggat set — driver offline-first beslut i V1
- **Säkerhet**: RLS obligatoriskt på alla tabeller; service-role-key används ALDRIG i klient; secrets aldrig hårdkodade
- **Sessions**: expo-secure-store för auth-tokens (inte AsyncStorage)
- **Validering**: Zod för all extern data (Supabase responses, formulär, deeplinks)
- **Budget**: Gratis (Supabase free tier för enskild användare); Apple Developer-licens krävs först när TestFlight blir aktuellt
- **Tidsram**: Kvällar/helger, inga hårda deadlines; mål V1 körbar inom 4–6 veckors arbete
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## TL;DR — Pin These Versions
## Recommended Stack (Validated Versions)
### Core Technologies
| Technology | Version (May 2026) | Install command | Why this version | Confidence |
|-----------|--------------------|------------------|-------------------|------------|
| Expo SDK | `~54.0.33` (already installed) | n/a — scaffold | RN 0.81.5 + React 19.1 baseline; all stack libs below are validated against SDK 54 | HIGH |
| React Native | `0.81.5` (transitive) | n/a — set by Expo | The exact version Expo SDK 54 expects. Do not bump. | HIGH |
| React | `19.1.0` (transitive) | n/a — set by Expo | Required by Expo SDK 54 and Skia ≥ 2 (Skia hard-requires `react ≥ 19`) | HIGH |
| Expo Router | `~6.0.23` (already installed) | n/a — scaffold | Default v6 in SDK 54; file-based routing matches `app/app/` layout already in repo | HIGH |
| TypeScript | `~5.9.2` (already installed) | n/a — scaffold | Pinned by Expo template; Zod 4 needs ≥ 4.5, RHF needs ≥ 4.7 — 5.9 satisfies all | HIGH |
### Styling
| Library | Version | Install command | Why | Confidence |
|---------|---------|------------------|-----|------------|
| NativeWind | `^4.2.3` | `npm install nativewind` | v4.2 is the SDK-54-recommended line; v4.2.0+ contains the official Reanimated v4 patch the SDK 54 toolchain needs. v5 exists as preview but is not stable as of May 2026 — defer until v5 GA. | HIGH |
| tailwindcss | `^3.4.17` | `npm install --dev tailwindcss@^3.4.17` | **NativeWind 4.x's underlying engine `react-native-css-interop@0.2.3` declares `tailwindcss: "~3"` as a peer dep — Tailwind v4 will break NativeWind v4.** Pin to the v3 line until you migrate to NativeWind v5. | HIGH |
| prettier-plugin-tailwindcss | `^0.5.11` | `npm install --dev prettier-plugin-tailwindcss@^0.5.11` | Class-sorting in editor; matches the version NativeWind's official setup uses. | MEDIUM |
### State & Data
| Library | Version | Install command | Why | Confidence |
|---------|---------|------------------|-----|------------|
| @tanstack/react-query | `^5.100.9` | `npm install @tanstack/react-query` | v5 line; declares `react: "^18 \|\| ^19"` peer — React 19.1 is officially supported. `@tanstack/react-query-devtools` shares the same peer range. | HIGH |
| Zustand | `^5.0.13` | `npm install zustand` | v5 minimum React = 18, so React 19 is fine. v5 delegates entirely to React's native `useSyncExternalStore`, so concurrent-rendering safety is owned by React itself. | HIGH |
| react-hook-form | `^7.75.0` | `npm install react-hook-form` | v7 line is the current stable; v8 is alpha/beta only. Works on React 19 (no React-internals coupling). | HIGH |
| @hookform/resolvers | `^5.2.2` | `npm install @hookform/resolvers` | Resolvers v5 supports Zod 4 schemas via `zodResolver`. Pin v5 — v4 of the resolver expects Zod 3. | HIGH |
| Zod | `^4.4.3` | `npm install zod` | Zod v4 is stable and faster (lower TypeScript-compile cost than v3). API surface for your use cases (object/string/number schemas, `parse`, `safeParse`, inferred types) is unchanged from v3, so no learning-tax on a first project. | HIGH |
| date-fns | `^4.1.0` | `npm install date-fns` | Tree-shakeable, no React-version coupling. v4 is current; v3 still works but v4 has tighter ESM. | HIGH |
### Backend & Auth
| Library | Version | Install command | Why | Confidence |
|---------|---------|------------------|-----|------------|
| @supabase/supabase-js | `^2.105.3` | `npx expo install @supabase/supabase-js` | Official client, current 2.x line. Supports React Native using framework-provided fetch polyfill (no extra polyfill needed in Expo SDK 54). Version 3.0 exists on `next` dist-tag but is not yet GA. | HIGH |
| expo-secure-store | `~15.0.8` | `npx expo install expo-secure-store` | Verified 2026-05-13 via `npx expo install --check` on Expo SDK 54 — the 15.x line is the actual pinned version (earlier research note incorrectly cited `~14.0.1` and has been corrected). **You MUST install via `npx expo install`, not `npm install`** — `expo install` reads your installed Expo SDK version and pins the right matching version automatically. | HIGH |
| @react-native-async-storage/async-storage | `2.2.0` | `npx expo install @react-native-async-storage/async-storage` | Required by the `LargeSecureStore` Supabase auth wrapper (see §Critical Recipes) because Expo SecureStore has a 2048-byte value limit but Supabase JWT sessions exceed that. | HIGH |
| aes-js | `^3.1.2` | `npm install aes-js` | Pure-JS AES used inside `LargeSecureStore` to encrypt session blobs before they go into AsyncStorage. Pure-JS = no native module = works in Expo Go without prebuild. | HIGH |
| react-native-get-random-values | `~1.11.0` | `npx expo install react-native-get-random-values` | Provides `crypto.getRandomValues()` so `aes-js` can generate the 256-bit key stored in SecureStore. Required by the same wrapper pattern. | HIGH |
### Charting (single recommendation)
| Library | Version | Install command | Why | Confidence |
|---------|---------|------------------|-----|------------|
| @shopify/react-native-skia | `2.2.12` | `npx expo install @shopify/react-native-skia` | Verified 2026-05-13 via `npx expo install --check` on Expo SDK 54 — the 2.2.x line is the actual pinned version (earlier research note incorrectly cited `2.6.2` and has been corrected). Required peer dep of Victory Native XL. Skia 2.x requires `react ≥ 19` and `react-native ≥ 0.79` — both satisfied by SDK 54. iOS 14+ and Android API 21+ minimum platform, well within iPhone-only V1 scope. | HIGH |
| victory-native | `^41.20.2` | `npm install victory-native` | The Victory Native XL package (renamed from `victory-native-next`); v41 is the current major. **See "Charting decision" below for why we pick this over Skia-direct or victory-native v40.** Reports (May 2026) confirm `41.20.2` runs on Reanimated 4.1.x + Skia 2.6.x + RN 0.81 — its package.json still declares loose peer dep `@shopify/react-native-skia: ">=1.2.3"` but works fine with Skia 2.x. | MEDIUM |
- **victory-native (XL)** is *built on* Skia + Reanimated + Gesture Handler. It gives you `<CartesianChart>`, line/bar/area, axes, gestures, and animated paths out of the box. For F10 ("graf per övning över tid: max vikt, total volym") this is one component and ~30 lines of TSX.
- **Raw react-native-skia** is the lowest level — you'd hand-roll axes, scales (with d3), tooltips, and pan/zoom. Two-three days of work for what `<CartesianChart>` does in 30 minutes.
### Development tools (already in scaffold)
| Tool | Version | Notes |
|------|---------|-------|
| eslint | `^9.25.0` (already installed) | Use `expo lint` script in package.json |
| eslint-config-expo | `~10.0.0` (already installed) | Expo's recommended ruleset |
| @types/react | `~19.1.0` (already installed) | Matches React 19.1 runtime |
## Installation (Run These, In Order)
# 1) Styling — NativeWind 4 + Tailwind 3 (NOT 4 — see PITFALLS)
# 2) Server state + local state
# 3) Forms + validation
# 4) Dates
# 5) Supabase + secure session storage
# 6) Charting (Skia + Victory Native XL)
## Critical Recipes (First-Time-User Code You Will Need)
### A) `lib/supabase.ts` — Supabase client with `LargeSecureStore`
### B) `app/_layout.tsx` — TanStack Query + AppState focus + NetInfo online
## First-Time-User Gotchas (One per library)
### Expo Router 6
### NativeWind 4
### TanStack Query v5
### Zustand 5
### react-hook-form 7 + Zod 4 + @hookform/resolvers 5
### date-fns 4
### Zod 4
### @supabase/supabase-js 2.105
### expo-secure-store 14
### Victory Native (XL) 41
### @shopify/react-native-skia 2.6
## Version Compatibility Matrix
| Package | Pinned to | Compatible with | Notes |
|---------|-----------|-----------------|-------|
| `expo@~54.0.33` | RN 0.81.5 + React 19.1 | All other rows | The hub. Don't bump until ready for SDK 55 audit. |
| `nativewind@^4.2.3` | tailwindcss@^3.4.17 only | Reanimated 4.x (since 4.2.0+) | **Tailwind v4 = broken**. Stay on v3 until NativeWind v5 GA. |
| `react-native-css-interop@0.2.3` (transitive) | tailwindcss `~3` peer | NativeWind 4 internals | This is the package that hard-pins Tailwind 3. Don't override. |
| `@tanstack/react-query@^5.100.9` | react `^18 \|\| ^19` | RN 0.81 | Devtools (optional) shares the peer range. |
| `zustand@^5.0.13` | react ≥ 18, TS ≥ 4.5 | All | Pure JS, no native. |
| `react-hook-form@^7.75.0` | React 19 OK | `@hookform/resolvers@^5` | RHF 8 is alpha — don't track latest, track v7 latest. |
| `@hookform/resolvers@^5.2.2` | RHF 7, Zod 4 | n/a | If you stayed on Zod 3, use resolvers v4 instead — but we're on Zod 4. |
| `zod@^4.4.3` | TypeScript ≥ 4.5 | All | Major perf win in tsc compile time over Zod 3. |
| `date-fns@^4.1.0` | n/a | All | Pure JS. |
| `@supabase/supabase-js@^2.105.3` | Node 20+ runtime, RN current stable | All | Provides fetch via framework polyfill — Expo SDK 54 is fine. |
| `expo-secure-store@~15.0.8` | Expo SDK 54 only | n/a | **Do not install via `npm install` — use `npx expo install`.** Verified 2026-05-13 via `npx expo install --check`. |
| `@react-native-async-storage/async-storage@2.2.0` | RN 0.81 | Used by `LargeSecureStore` | `npx expo install` resolves. |
| `aes-js@^3.1.2` | n/a | n/a | Pure JS, no peer deps. |
| `react-native-get-random-values@~1.11.0` | RN 0.81 | Used by `aes-js` | `npx expo install` resolves. |
| `@shopify/react-native-skia@2.2.12` | react ≥ 19, RN ≥ 0.79 | Reanimated 4 | iOS 14+ / Android 21+ minimum. Verified 2026-05-13 via `npx expo install --check`. |
| `victory-native@^41.20.2` | Skia ≥ 1.2.3 (declared), works with 2.x | Reanimated 4.1.x confirmed by users in May 2026 | Loose peer dep — npm warnings ignorable. |
## Sources
| Source | What was verified | Confidence |
|--------|-------------------|------------|
| Context7 `/expo/expo` `__branch__sdk-54` | Default SDK 54 template package.json (`expo@~54.0.33`, `expo-router@~6.0.23`); `npx expo install expo-secure-store` is the recommended install path | HIGH |
| Context7 `/nativewind/nativewind` `nativewind_4.2.0` | Install command, Metro config wrapper, Tailwind v3 requirement | HIGH |
| Context7 `/formidablelabs/victory-native-xl` | Peer deps (Reanimated, Gesture Handler, Skia), `<CartesianChart>` API surface | HIGH |
| Context7 `/shopify/react-native-skia` | "Requires `react-native@>=0.79` and `react@>=19`. Min iOS 14, Android API 21." | HIGH |
| Context7 `/tanstack/query` `v5_*` | `react: "^18 \|\| ^19"` peer dep; v5 object-arg API; `gcTime` rename; AppState/NetInfo RN integration patterns | HIGH |
| Context7 `/pmndrs/zustand` `v5.0.12` | v5 React 18 minimum; useSyncExternalStore-only implementation | HIGH |
| Context7 `/colinhacks/zod` `v4.0.1` | Zod 4 stable, perf improvements over v3 | HIGH |
| Context7 `/react-hook-form/react-hook-form` `v7.66.0` | RHF v7 latest line, React 19 compat (no React internals coupling) | HIGH |
| Context7 `/supabase/supabase-js` `v2.58.0` | `createClient` shape, RN environment notes ("fetch polyfill provided by framework"), Node 20+ support floor | HIGH |
| `npm view <pkg>` (May 7 2026) | Latest stable versions for every package above | HIGH |
| `npm view nativewind@4.2.3 dependencies` | Confirmed transitive `react-native-css-interop@0.2.3` | HIGH |
| `npm view react-native-css-interop@0.2.3 peerDependencies` | Confirmed `tailwindcss: "~3"` hard peer dep | HIGH |
| `npm view victory-native@41.20.2 peerDependencies` | Confirmed declared peer is `@shopify/react-native-skia: ">=1.2.3"` (loose lower bound) | HIGH |
| `npm view expo-secure-store versions` | Confirmed `14.0.x` is SDK 54 line; `55.x` is SDK 55 | HIGH |
| [NativeWind installation docs](https://www.nativewind.dev/docs/getting-started/installation) | `tailwindcss@^3.4.17`; v4 NOT supported in NativeWind v4 | HIGH |
| [NativeWind Discussion #1604 — Officially recommended versions](https://github.com/nativewind/nativewind/discussions/1604) | NativeWind v4.2.1+ is the SDK-54-recommended line | MEDIUM |
| [Supabase + React Native auth quickstart](https://supabase.com/docs/guides/auth/quickstarts/react-native) (and follow-up search results) | LargeSecureStore pattern, 2048-byte SecureStore limit, AppState refresh listener | HIGH |
| [Supabase issue #14523](https://github.com/supabase/supabase/issues/14523) | Confirmed inconsistent recommendations exist; LargeSecureStore is the encryption-at-rest variant | MEDIUM |
| [Victory Native XL issue #616 + community reports May 2026](https://github.com/FormidableLabs/victory-native-xl/issues/616) | v41 works with Skia 2.x in practice despite loose peer-dep declaration | MEDIUM |
| [Expo SDK 54 changelog / Reanimated 4 migration discussion #39130](https://github.com/expo/expo/discussions/39130) | Reanimated 4 + worklets 0.5 is the SDK 54 baseline | HIGH |
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

### Navigation header & status bar (established Phase 1, Plan 01-02)

- **Root layout** (`app/app/_layout.tsx`) renders `<Stack screenOptions={{ headerShown: false }} />` paired with `<StatusBar style="auto" />` from `expo-status-bar`. The smoke-test screen needs an edge-to-edge background to prove F15 dark-mode convention end-to-end, and the default expo-router header is a white iOS strip that breaks dark-mode coverage above the content view.
- **Real screens (Phase 4+)**: opt headers back in **per screen** via `<Stack.Screen options={{ headerShown: true, headerStyle: { backgroundColor: ... }, headerTintColor: ... }} />`, and choose a header style that respects `useColorScheme()` so dark mode covers the header too. Do NOT flip `headerShown: true` globally — settings/auth screens may still want it off.
- **Why `style="auto"` on StatusBar (not `"light"`):** the smoke-test view uses both `bg-white` and `dark:bg-gray-900`. `"auto"` flips status-bar icon color with the system theme so icons always contrast against background. `"light"` would invert this in light mode (white icons on white bar = invisible).
- **iOS status bar is OS-rendered, not React-rendered**: setting `dark:bg-gray-900` on a `<View>` does not affect status-bar icon color. You always need a sibling `<StatusBar>` element to control it.

### Database conventions (established Phase 2)

- **Migration-as-truth.** All schema changes ship as numbered SQL files in `app/supabase/migrations/` — Supabase Studio is read-only from Phase 2 forward. (PITFALLS 4.2 — drift detection requires a single source of truth; Studio edits leave no diff for review.) New deltas land as new files (`0002_*.sql`, `0003_*.sql`), never via dashboard.
- **RLS pairs with policies.** Every migration that creates a table MUST `enable row level security` AND add at least one policy in the same file. (PITFALLS 2.1 + 2.2 — RLS-enabled-without-policy = "deny everything"; both must land together.)
- **`using` AND `with check` on every writable policy.** Every writable RLS policy MUST declare BOTH `using` AND `with check`. `using` filters reads + which rows can be modified; `with check` validates the post-state of inserts/updates. (PITFALLS 2.5 — Phase 2 closed the original errata where `plan_exercises` and `exercise_sets` were missing `with check`.)
- **Wrap every `auth.uid()` reference.** Every `auth.uid()` reference inside an RLS policy MUST be wrapped as `(select auth.uid())` for query-plan caching. Postgres caches the wrapped form per-query; the raw form re-evaluates per-row and tanks performance at scale. (PITFALLS 4.1.)
- **Drift verification on Windows-without-Docker.** Use `npx tsx --env-file=.env.local scripts/verify-deploy.ts` from `app/` cwd to verify deployed schema state — NOT `npx supabase db diff` (the latter requires Docker per D-04). The harness queries `pg_catalog` directly (RLS state, policies, triggers, ENUMs, functions) which is at least as strong as `db diff` because it inspects the live database, not generated DDL.
- **Studio UI gotchas.** Don't trust the Studio Tables-view RLS badges — they are version-/zoom-/cache-dependent. Trust `pg_class.relrowsecurity` (via verify-deploy.ts) instead. To see triggers on `auth.users` (e.g., `handle_new_user`), switch the Studio Triggers tab schema dropdown from `public` to `auth` — the default filter hides them.
- **Type-gen runs after every schema migration.** `npm run gen:types` runs after every schema migration; the generated `app/types/database.ts` is committed in the same commit as the migration that produced it. Hand-editing `database.ts` is forbidden — fix the schema instead.
- **Cross-user verification is a gate.** Schema migrations that touch user-scoped tables MUST add coverage to `app/scripts/test-rls.ts` (cross-user CRUD assertions for the new table). The cross-user test is the regression detector for RLS gaps; a migration without an updated test-rls assertion is incomplete.
- **Service-role isolation.** `SUPABASE_SERVICE_ROLE_KEY` lives in `app/.env.local` only; NEVER prefixed with `EXPO_PUBLIC_`; NEVER imported from any path under `app/lib/`, `app/app/`, or any other Metro-bundled path. Audit gate: `git grep "service_role\|SERVICE_ROLE"` must match only `app/scripts/test-rls.ts`, `app/.env.example`, `.planning/`, and `CLAUDE.md`. (PITFALLS 2.3.)

### Security conventions (OWASP MASVS L1 + API Top 10 — established Phase 2)

**Applied frameworks:**
- **OWASP API Security Top 10** (Supabase REST/PostgREST surface) — primary control set since the data path is API-first.
- **OWASP MASVS L1 / Mobile Top 10** (iOS app surface) — relevant to expo-secure-store, deep-links, and any future on-device data.
- **OWASP ASVS L1** baseline; specific controls cited as `V{n}.{m}` in per-phase SECURITY.md.

**Per-phase contract:** every plan in `plan-phase` MUST include a `<threat_model>` block with a STRIDE register (`T-{NN}-{XX}` IDs, `category`, `component`, `disposition: mitigate | accept | transfer`, `mitigation_pattern`). After execution, `gsd-secure-phase {N}` audits the register against the implementation and writes `{N}-SECURITY.md` with `threats_open: 0` before the phase is considered closed. (Phase 2 closed 27/27.)

**Established controls (do not regress):**
- **API1 / V4 — Broken object-level authorization.** RLS enforced at the database with `(select auth.uid())` wrapped predicate + `with check` on every writable policy. Cross-user regression test: `app/scripts/test-rls.ts` (must extend with assertions for every new user-scoped table). (See "Database conventions" above for the full RLS rules.)
- **API2 / V2 / M3 — Broken authentication.** Sessions stored via `LargeSecureStore` (AES-encrypted blob in AsyncStorage with key in `expo-secure-store`); never AsyncStorage in plaintext. Service-role key never leaves Node-only scripts (audit gate above).
- **API3 — Excessive data exposure.** RLS scopes data at the DB layer; clients never rely on client-side filtering for security. New SELECT policies must be paired with explicit column-level review if a table contains both public-safe and sensitive columns (V8.3).
- **API8 / M9 / V14 — Security misconfiguration.** Migration-as-truth (no Studio editing); `gen:types` regenerates after every schema change; `verify-deploy.ts` confirms deployed state. Secrets only via `.env.local` (gitignored, with `.env.example` placeholders showing the security comment + `EXPO_PUBLIC_` prefix rules).
- **M2 — Insecure data storage.** No PII or auth state in AsyncStorage without encryption; `expo-secure-store` for keys; `aes-js` + `react-native-get-random-values` for the LargeSecureStore wrapper (already in stack).
- **M7 — Client code quality.** TypeScript strict via Expo template; `createClient<Database>` everywhere a Supabase client is instantiated (Node scripts included — see WR-03 in 02-REVIEW.md for why untyped clients are a false-pass risk in security gates).

**Phase-specific checklists** (planner agents must consider these when relevant):
- **Auth phase (Phase 3 — F1):** API2 (auth) + V2.1.1 (passwords ≥12 chars or zxcvbn ≥3); V3 (session management — refresh-rotation if implemented); deep-link handling (M4 — anti-phishing for email confirm / magic-link URLs). Threat IDs T-03-* in PLAN.md.
- **Forms phase (Phase 4 — F2/F4):** API4 (rate-limiting if writes are user-triggered loops) + V5 (input validation — Zod schemas at every form boundary AND every Supabase response boundary). Validate types/database.ts shape with Zod parse, not bare cast. Threat IDs T-04-*.
- **Active workout / offline (Phase 5 — F5/F6/F7/F13):** M2 (offline queue must encrypt PII at rest) + API4 (sync rate-limiting) + V11 (anti-flood on rapid set-logging). Threat IDs T-05-*.
- **Read-side / charts (Phase 6 — F9/F10):** API3 (no aggregation across users); V12 (file/data uploads N/A in V1). Threat IDs T-06-*.
- **Polish (Phase 7 — F11/F12 + F15 toggle):** review for accumulated debt; rotate any keys whose entropy is exposed in logs.

**Tooling gates already wired:**
- `gsd-code-review` runs after every phase — checks for service-role leaks, untyped clients, unsafe SQL, unsanitized deep-links.
- `gsd-secure-phase {N}` runs the threat-register audit; produces `{N}-SECURITY.md` with `threats_open: 0` requirement before phase advancement.
- `npm run test:rls` is the cross-user RLS regression gate (must stay green; extend per new table per Phase contract above).
- `app/scripts/verify-deploy.ts` is the post-migration drift check (run after every `supabase db push`).

**Out-of-scope for V1 (deferred — document in SECURITY.md accepted-risks per phase if encountered):**
- WAF / DDoS protection (Supabase platform handles base rate-limit; app-level rate-limit deferred).
- Penetration testing (V14.5 — defer to pre-TestFlight).
- App-Store-specific MASVS L2 controls (binary obfuscation, anti-tamper, jailbreak detection — V2 / TestFlight phase).
- Audit logging for admin operations (no admin surface in V1; Supabase logs cover platform layer).

<!-- GSD:conventions-end -->

## Branching-strategi

Committa ALDRIG direkt till `dev` eller `main`. Alltid via branch + PR.

### Phase-branches (GSD hanterar automatiskt)
- Format: `gsd/phase-XX-namn`
- Skapas från: `dev`
- Mergas till: `dev` via PR

### Bugfix-branches (för Linear issues utanför pågående fas)
- Format: `fix/FIT-XX-kort-beskrivning`
- Skapas från: `dev`
- Mergas till: `dev` via PR

### Chore-branches (refaktorering, docs, config)
- Format: `chore/kort-beskrivning`
- Skapas från: `dev`
- Mergas till: `dev` via PR

### Skapa bugfix-branch
```bash
git checkout dev
git pull origin dev
git checkout -b fix/FIT-XX-kort-beskrivning
# fixa buggen
git commit -m "fix: beskrivning [FIT-XX]"
git push origin fix/FIT-XX-kort-beskrivning
```
CI triggas automatiskt och öppnar PR mot dev.

---

## CI/CD Pipeline

GitHub Actions workflows finns i `.github/workflows/`:
- `phase-branch.yml` — triggas på push till `gsd/phase-*`, kör tsc + lint + RLS + Expo build, öppnar PR mot dev automatiskt
- `dev.yml` — triggas på push till dev, kör samma tester, öppnar/uppdaterar Draft PR mot main
- `main.yml` — release gate + skapar GitHub Release automatiskt

### Regler
- Pusha ALLTID branchen till origin efter commits så CI triggas
- Inkludera Linear issue-ID i commit-meddelanden: `[FIT-XX]`
- Skriv `Fixes FIT-XX` i PR-beskrivningar för att stänga issues automatiskt
- Secrets ligger i GitHub — aldrig i kod eller committade .env-filer

---

## Linear Integration

Skript i `scripts/` hanterar Linear via npm-wrappers (root `package.json` med `tsx` + `--env-file=app/.env.local`).
`LINEAR_API_KEY` måste finnas i `app/.env.local`.

### Kör ALLTID detta i början av varje session
```bash
npm run linear:issues
```

Om det finns Urgent/High buggar — fixa dem INNAN nästa fas startar.

### Filtrera issues
```bash
npm run linear:issues -- --phase 5
npm run linear:issues -- --type bug
npm run linear:issues -- --priority urgent,high
```

### Skapa issue automatiskt när du hittar
- Bug under verify → type=bug, priority=high
- Deferred decision → type=deferred, priority=medium
- Technical debt → type=debt, priority=low
- UI BLOCKER från gsd-ui-phase → type=ui, priority=high
- UI WARNING från gsd-ui-phase → type=ui, priority=medium

```bash
npm run linear:create -- \
  --title "Bug: kort beskrivning" \
  --description "detaljerad beskrivning" \
  --type bug \
  --priority high \
  --phase 5
```

Skriptet skriver ut `LINEAR_ISSUE_ID=FIT-XX` — inkludera det i nästa commit.

### Prioritetsregler
| Situation | Åtgärd |
|-----------|--------|
| Urgent/High bug | Fixa INNAN nästa fas |
| Medium bug | Fixa inom nuvarande fas |
| Low/debt | Backlog, fortsätt |
| Deferred | Notera, fortsätt |

---

## Komplett flöde

```
Session startar
    ↓
npm run linear:issues
    ↓
Urgent bug? → git checkout -b fix/FIT-XX → fixa → push → PR
    ↓
/gsd-execute-phase X
    ↓
Hittar bug/debt → create-linear-issue.ts → FIT-XX skapas
    ↓
git push origin gsd/phase-XX → CI triggas → PR öppnas mot dev
    ↓
Du mergar PR → Linear stänger FIT-XX automatiskt
    ↓
dev.yml triggas → Draft PR mot main uppdateras
```

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
