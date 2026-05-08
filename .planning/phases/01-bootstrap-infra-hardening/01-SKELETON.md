# Walking Skeleton — FitnessMaxxing

**Phase:** 1 — Bootstrap & Infra Hardening
**Generated:** 2026-05-08

## Capability Proven End-to-End

> En användare öppnar appen på sin iPhone via Expo Go QR-kod och ser "Hello FitnessMaxxing" renderad med Tailwind-klasser (inkl. `dark:`-variant), medan appen i bakgrunden bekräftar nätverk + auth-headers mot Supabase via en dev-only connect-test som loggas i Metro.

Detta är V1:s tunnaste vertikala slice: scaffold → routing → UI med real styling-pipeline → real Supabase-klient med real auth-headers över real nätverk → enheten själv (iPhone via Expo Go). Inga mockar i pipelinen utöver att det inte finns någon tabell att läsa från ännu (Phase 2 levererar schemat) — själva DB-rundresan får 404 med korrekt Supabase-format, vilket bevisar att klient + nätverk + headers är friska.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Expo SDK 54 + Expo Router 6 (file-based routing under `app/app/`) | Låst i `ARCHITECTURE.md` beslutsregister; `--mvp` Phase 1 ska bara aktivera scaffolden, inte revidera den |
| UI runtime | React Native 0.81.5 + React 19.1 (transitiva pins via SDK 54) | Krävs av Skia ≥ 2 (peer-dep `react ≥ 19`); CLAUDE.md TL;DR pinnar dessa exakt |
| Styling | NativeWind 4.2.3 + Tailwind CSS 3.4.17 (NOT v4) | NativeWind 4:s transitiva `react-native-css-interop@0.2.3` hard-pinnar `tailwindcss: "~3"` peer; v4 = silent breakage |
| Dark mode | `darkMode: 'class'` i `tailwind.config.js` + `dark:` Tailwind-varianter från första render | F15 etableras som konvention från Phase 1 (toggle-UI deferred till Phase 7); `userInterfaceStyle: "automatic"` i `app.json` läser system-tema redan |
| State / data | TanStack Query v5.100 (server state) + Zustand v5 (UI state, klar att importera men inte använd ännu) | TanStack är offline-first-pipelinen; Zustand är ephemeral UI-state senare |
| Persister | `@tanstack/query-async-storage-persister` med `maxAge: 24h` mot AsyncStorage | Phase 4 (offline-kö) + Phase 6 (history offline-cache) ärver pipelinen utan revidering |
| Backend | Supabase (`@supabase/supabase-js@^2.105.3`) med EXPO_PUBLIC anon-nyckel | Anon-nyckel är offentlig per design; RLS skyddar data från Phase 2 framåt |
| Auth-storage | LargeSecureStore-wrapper: AES-256-krypterad blob i AsyncStorage, 256-bit nyckel i SecureStore | SecureStore har 2048-byte/value cap; Supabase JWT-sessions överskrider det. Per CLAUDE.md Critical Recipe §A |
| Forms | react-hook-form 7 + Zod 4 + @hookform/resolvers 5 (installerade, inte använda i Phase 1) | Triple-lås — RHF8 alpha, resolver 5 krävs för Zod 4 |
| Charting | `@shopify/react-native-skia@2.6.2` + `victory-native@^41.20.2` (installerade, inte använda i Phase 1) | Phase 6 levererar grafen; install i Phase 1 = ingen "stop the world" senare |
| Deployment target (V1) | Expo Go på personlig iPhone via QR-kod | V1 = personligt verktyg, ingen TestFlight; EAS Build deferred till V1.1 |
| Directory layout | `app/app/` (routes via Expo Router), `app/lib/` (cross-cutting: `supabase.ts`); inga `features/`, `components/`, `hooks/` förrän behov uppstår | Per D-09, D-10, D-11; kebab-case för icke-route-filer |
| Path alias | `@/*` → app-root (oförändrat från scaffold) | Per D-12 |
| Env vars | `app/.env.local` (gitignored), endast `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`; service-role-nyckel ALDRIG i klient | PITFALLS §2.3 + §2.6; CLAUDE.md säkerhets-constraint |
| Babel preset chain | `babel-preset-expo` + `nativewind/babel` (preset, inte plugin); Reanimated 4-plugin sist i plugin-listan om plugin-listan finns | PITFALLS §3.1 — Reanimated 4 inkluderar redan worklets; ingen separat worklets/plugin |

## Stack Touched in Phase 1

- [x] **Project scaffold** — Expo SDK 54-scaffolden återställs till ren start via `npm run reset-project` (raderar parallax/themed-*/hello-wave/explore-tab); ESLint redan konfigurerad (`expo lint`)
- [x] **Routing** — `app/app/_layout.tsx` (Stack-rooten med providers) + `app/app/index.tsx` (en (1) real route som renderar UI); ingen `(auth)`/`(app)`-grupp ännu (Phase 3)
- [x] **Database** — Supabase-klient med real auth-headers + real nätverk; en dev-only connect-test (`from('_phase1_smoke').select('*').limit(0)`) skickar real HTTP request mot real Supabase-projekt (404 förväntat, bevisar att rundresan funkar). Real read/write mot riktiga tabeller följer i Phase 2 när schemat appliceras.
- [x] **UI** — `<Text className="text-2xl text-blue-500 dark:text-blue-300">Hello FitnessMaxxing</Text>` är den interaktiva ytan; ingen toggle-knapp i Phase 1 (Phase 7)
- [x] **Deployment** — Lokalt full-stack-run-kommando: `cd app/ && npx expo start`, sedan QR-scan från fysisk iPhone via Expo Go-app; ingen cloud build i V1

## Out of Scope (Deferred to Later Slices)

> Explicit för att skydda Phase 1 från scope-kryp. Varje punkt nedan har en namngiven fas där den hör hemma.

- **Auth-flow & route-skydd** (sign-in, sign-up, `Stack.Protected guard={!!session}`, `(auth)`/`(app)` route-grupper) → **Phase 3**
- **Schema-applicering, RLS-policys, type-generation** (`supabase gen types typescript`) → **Phase 2**
- **Riktiga tabeller och queries mot riktiga rader** (read/write av `workout_plans`, `exercises`, `workout_sessions`, `exercise_sets`) → **Phase 2 → 5**
- **Offline-kö med mutation persistence + replay** (TanStack persister-pipelinen finns redan; mutation-strategin med klient-genererade UUIDs + `scope.id` byggs senare) → **Phase 4** (planer/övningar) → **Phase 5** (sets, F13)
- **Feature-mapp-konvention** (`features/<domain>/` vs flat `components/`) → **Phase 4** (när första riktiga feature byggs)
- **Dark-mode-toggle-UI** (manuell override av system-tema) → **Phase 7** (F15-toggle)
- **Tabs-navigation** (`(tabs)/index.tsx`, `(tabs)/history.tsx`, `(tabs)/settings.tsx`) → **Phase 4+**
- **Error-boundary, custom splash, test-runner-skelett, CI-pipeline, EAS Build, TestFlight** → **Phase 7 / V1.1 / V2**
- **Egen `useColorScheme`-wrapper / `lib/theme.ts`** → **Phase 7** (om manual override blir aktuellt)

## Subsequent Slice Plan

Varje senare fas adderar en vertikal slice ovanpå skelettet utan att rubba de arkitektoniska besluten ovan.

- **Phase 2:** Schema, RLS-policys (med både `using` OCH `with check`), type-generation. Skelettet förblir orört — Supabase-klienten i `lib/supabase.ts` får bara typade queries.
- **Phase 3:** Auth-flow + persistent session. `(auth)/sign-in.tsx`, `(auth)/sign-up.tsx`, `(app)/_layout.tsx` med `Stack.Protected`. `_layout.tsx`-rooten utvidgas inte — bara routes adderas.
- **Phase 4:** Plans + exercises CRUD med offline-kö-bevis. TanStack persister-pipelinen som Phase 1 redan etablerade aktiveras nu; airplane-mode-test blir en blocking checkpoint.
- **Phase 5:** Active workout hot path (F13 lives or dies). Set-loggning ≤3s; ingen revision av provider-stack-rooten.
- **Phase 6:** History list + per-övnings-graf via `<CartesianChart>` (victory-native installerades redan i Phase 1).
- **Phase 7:** RPE, anteckningar, manual dark-mode-toggle. F15-toggle hakar in i den `darkMode: 'class'`-konvention som Phase 1 etablerade.
