# Phase 1: Bootstrap & Infra Hardening - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 lägger fundamentet: installerar HELA den i CLAUDE.md låsta stacken på det befintliga Expo SDK 54-scaffolden, bevisar att NativeWind renderar på iPhone via Expo Go, etablerar dark-mode som konvention från dag 1, och verifierar att Supabase-klienten kan ansluta. Efter Phase 1 ska senare faser kunna fokusera på att skriva feature-kod utan att röra `_layout.tsx`, babel/metro-config, eller installera ytterligare native-paket.

**In scope:**
- Reset av Expo-scaffold (radera demo helt)
- Install av locked-stacken till exakta CLAUDE.md-pins
- NativeWind 4 + Tailwind 3 setup (babel, metro, global.css, tailwind.config.js med `darkMode: 'class'`)
- Reanimated 4.1 babel-plugin korrekt konfigurerad utan dubbletter
- `.env.local` setup med `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `app/lib/supabase.ts` med LargeSecureStore-wrappern + connect-test
- `app/app/_layout.tsx` wirad med QueryClientProvider + AppState focus + NetInfo online + persistQueryClient (AsyncStorage, 24h maxAge)
- `app/app/index.tsx` smoke-test som renderar med Tailwind-klasser inkl. `dark:`-variant
- `expo-doctor` returnerar 0 fel

**Out of scope (belongs to later phases):**
- Auth-flow, sign-in/sign-up, route-grupperna `(auth)` och `(app)` → Phase 3
- Schema-applicering, RLS, type-generation → Phase 2
- Feature-mappar utöver `app/lib/` → Phase 4 (när första feature byggs)
- Dark-mode-toggle UI → Phase 7
- Tabs-struktur (history, settings, etc.) → Phase 4+
- Error-boundary, splash-screen-customization, CI-skelett (kom upp som möjliga, men ingår inte)

</domain>

<decisions>
## Implementation Decisions

### Scaffold-strategi
- **D-01:** Kör `npm run reset-project` i `app/`-mappen för att flytta demo till `app-example/` och få ren `_layout.tsx` + `index.tsx`. Detta raderar parallax-scroll-view, themed-text/-view, hello-wave, external-link, haptic-tab, ui/, `(tabs)/explore.tsx`, `modal.tsx`, `hooks/use-color-scheme*`, `hooks/use-theme-color`, `constants/theme.ts`.
- **D-02:** Radera `app-example/` direkt efter reset — committa inte. CLAUDE.md + `.planning/research/` är referens; demo-cruft fyller inget syfte i repot.
- **D-03:** Initial `app/app/index.tsx` = bara smoke-text. Ungefär:
  ```tsx
  <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
    <Text className="text-2xl text-blue-500 dark:text-blue-300">Hello FitnessMaxxing</Text>
  </View>
  ```
  Möter ROADMAP success criteria #1 (Tailwind-klasser renderar) + #2 (dark:-konvention etablerad) utan att utöka acceptans-bandbredd.
- **D-04:** Ingen egen `useColorScheme`-wrapper i Phase 1. Importera RN:s `useColorScheme` direkt om/när det behövs (sannolikt aldrig för styling — NativeWind hanterar det). Ingen `app/hooks/`-mapp förrän något kräver den.

### Provider-scaffold-gräns
- **D-05:** Installera HELA locked-stacken i Phase 1, exakta versioner per CLAUDE.md TL;DR:
  - Styling: `nativewind@^4.2.3`, `tailwindcss@^3.4.17`, `prettier-plugin-tailwindcss@^0.5.11`
  - State/data: `@tanstack/react-query@^5.100.9`, `zustand@^5.0.13`, `react-hook-form@^7.75.0`, `@hookform/resolvers@^5.2.2`, `zod@^4.4.3`, `date-fns@^4.1.0`
  - Backend: `@supabase/supabase-js@^2.105.3`, `expo-secure-store@~14.0.1`, `@react-native-async-storage/async-storage@2.2.0`, `aes-js@^3.1.2`, `react-native-get-random-values@~1.11.0`
  - Charting: `@shopify/react-native-skia@2.6.2`, `victory-native@^41.20.2`
  - Persister: `@tanstack/query-async-storage-persister`
  - Connectivity: `@react-native-community/netinfo` (för NetInfo online-bridge)
  Native-affected paket installeras via `npx expo install` (inte `npm install`) per PITFALLS.md §4.
- **D-06:** Wira HELA STACK.md Critical Recipe §B i `app/app/_layout.tsx`: QueryClientProvider runt Stack, AppState-listener som triggar `focusManager.setFocused()`, NetInfo-listener som triggar `onlineManager.setOnline()`, plus persistQueryClient via AsyncStorage med default `maxAge: 24h`. Phase 3+ rör inte root-layouten.
- **D-07:** Skapa `app/lib/supabase.ts` med LargeSecureStore-wrappern (aes-js-krypterad blob i AsyncStorage med 256-bit nyckel i SecureStore) per CLAUDE.md Critical Recipe §A. Lägg en lätt connect-test som körs vid app-start i dev (t.ex. en `supabase.from('_phase1_smoke').select('*').limit(0)` som förväntat returnerar 404 men bevisar nätverk + auth-headers). Success criteria #4 bevisas funktionellt, inte bara att `process.env` laddats.
- **D-08:** TanStack Query persister konfigureras med `@tanstack/query-async-storage-persister` + `persistQueryClient`-wrappern, default `maxAge: 24h`. Phase 4 (offline-kö) och Phase 6 (history offline-cache) behöver bara skriva queries — persistens-pipeline finns redan.

### Mapp- & route-konventioner
- **D-09:** Vänta med `(auth)`/`(app)` route-grupperna till Phase 3. Phase 1 har bara `app/app/index.tsx` + `app/app/_layout.tsx` (reset-default + provider-wrap). `Stack.Protected guard={!!session}` och `<Redirect>`-skydd wiras i Phase 3 när auth-flow byggs.
- **D-10:** Mappstruktur utöver `app/lib/` (där `supabase.ts` + ev. `query-client.ts` lever) skjuts till Phase 4. Feature-folder-konvention (`app/features/<domain>/` vs flat `app/components/`) väljs då baserat på faktisk användning.
- **D-11:** Filnamns-konvention = kebab-case överallt, inkl. icke-route-filer: `lib/supabase.ts`, `lib/query-client.ts`, `components/offline-banner.tsx` (om/när skapas). Konsekvent med Expo Router-routes och scaffold-stilen.
- **D-12:** Behåll path-aliaset `@/*` -> `./*` (app-root) i `tsconfig.json` (redan konfigurerat av scaffold). Inga ytterligare alias-er.

### Claude's Discretion
- Exakt formatering av smoke-test-vy (klasser, layout-detaljer) — så länge dark-mode-konventionen är synlig och Tailwind-pipelinen bevisas.
- Exakt URL/syntax för Supabase connect-test — vad som mest pålitligt bevisar nätverk + headers utan att kräva existerande tabeller.
- Exakta `gcTime` / `staleTime` defaults i QueryClient (om inte STACK.md-receptet specificerar) — använd vettiga defaults för en offline-first app.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project requirements & architecture
- `PRD.md` — V1-krav F1–F30; auktoritativ källa för funktionsmappning
- `ARCHITECTURE.md` — beslutsregister för låst stack; sektion 4 (schema) gäller Phase 2 men §1–3 är relevant kontext
- `.planning/PROJECT.md` — Core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — V1-krav-traceability mot faser
- `.planning/ROADMAP.md` — Phase 1 success criteria #1–#5; phase-ordering rationale

### Stack reference (load-bearing för Phase 1)
- `CLAUDE.md` — TL;DR Pinned Versions-tabell + Critical Recipes §A (LargeSecureStore Supabase-klient) + §B (`_layout.tsx` med TanStack/AppState/NetInfo) + First-Time-User Gotchas-listan; alla install-kommandon
- `.planning/research/STACK.md` — installation-ordning, NativeWind-config-trippel (babel + metro + global.css), Critical Recipes
- `.planning/research/PITFALLS.md` — §3.1 (Reanimated 4 babel-pluggin), §3.2 (NativeWind v4 setup), §4 (`npx expo install`-disciplin), §5 (env-vars), §1.x (Supabase RLS/secrets)
- `.planning/research/ARCHITECTURE.md` — projekt-arkitektur, offline-first-rationale (informerar persister-default)
- `.planning/research/SUMMARY.md` — högnivå-research-roundup
- `.planning/research/FEATURES.md` — feature-research där relevant

### Källor för specifika beslut
- CLAUDE.md `### Backend & Auth`-tabellen — varför `expo-secure-store@~14.0.1` (inte 55.x), varför LargeSecureStore (2048-byte SecureStore-limit vs JWT-storlek)
- CLAUDE.md `### Styling`-tabellen — varför Tailwind v3 (NativeWind 4 hard-pinnar via `react-native-css-interop@0.2.3` peer dep)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/package.json` — Expo SDK 54-scaffold redan korrekt pinnad: `expo@~54.0.33`, `expo-router@~6.0.23`, `react-native@0.81.5`, `react@19.1.0`, `typescript@~5.9.2`. Inga av dessa ska bumpas. Reanimated 4.1.1 + worklets 0.5.1 + gesture-handler 2.28 + safe-area-context 5.6 + screens 4.16 finns redan.
- `app/app.json` — Expo-config med `newArchEnabled: true`, `userInterfaceStyle: "automatic"`, `experiments.typedRoutes: true`, `reactCompiler: true`, splash-screen plugin redan konfigurerad. Phase 1 lägger ev. NativeWind-relaterade plugin-anvisningar.
- `app/tsconfig.json` (verifiera) — `@/*` path-alias troligen redan konfigurerad (scaffolden importerar `@/hooks/use-color-scheme`).
- `.gitignore` — `.env`, `.env.local`, `.env.*.local`, `.env.development`, `.env.production` redan exkluderade. Success criteria #4 (`.env.local` gitignored) är redan uppfyllt på rotnivå; verifiera att gitignore i `app/`-subdir inte motsäger om en sådan finns.

### Established Patterns
- **Inre Expo-projekt under `app/`-subdir.** Scaffolden ligger inte i repo-root — den ligger under `app/`-mappen. Alla Expo-kommandon (`expo start`, `npx expo install`, `expo doctor`, `npm run reset-project`) körs från `app/`-arbetskatalogen. Phase 1-planer måste vara explicita om `cd app/` eller motsvarande.
- **Path-alias `@/*` redan i bruk.** `app/app/_layout.tsx` importerar `@/hooks/use-color-scheme`. Reset raderar den importerade filen — efter reset finns inga `@/`-importer kvar i kodbasen, men aliaset består för Phase 3+.
- **`userInterfaceStyle: "automatic"` i app.json.** iOS följer system-tema by default; Phase 1 dark-mode-konvention (`dark:`-Tailwind-varianter) hakar in i detta utan extra kod.

### Integration Points
- `app/app/_layout.tsx` (default scaffold-version) ersätts av STACK.md Critical Recipe §B-versionen. Ingen `<ThemeProvider>` från `@react-navigation/native` behålls — NativeWind hanterar dark-mode via `dark:`-klassen och `useColorScheme` läser system-temat direkt.
- `app/app/index.tsx` (default scaffold) ersätts av smoke-text-vyn (D-03).
- `app/app/(tabs)/` raderas i sin helhet (reset).
- Nytt: `app/lib/supabase.ts` (D-07) — första filen i `app/lib/`.
- Nytt: `app/global.css` (Tailwind directives) + `app/tailwind.config.js` (`darkMode: 'class'`, content-glob) + `app/babel.config.js` (`presets: ["babel-preset-expo", "nativewind/babel"]` med Reanimated-plugin sist) + `app/metro.config.js` (wrap med `withNativeWind(config, { input: "./global.css" })`).
- Nytt: `app/.env.local` (gitignored) med `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

</code_context>

<specifics>
## Specific Ideas

- **Smoke-test-vyn** ska vara minimal — bara `<Text className="text-2xl text-blue-500">Hello FitnessMaxxing</Text>` (eller motsvarande). Inget Supabase-status i UI, ingen toggle-knapp. Verifierar Tailwind-pipelinen och dark-mode-konventionen, inget mer.
- **Supabase connect-testet** är dev-only — inte produktions-relevant. Lättviktigt anrop som bevisar nätverk + auth-headers, t.ex. en SELECT mot ett icke-existerande table som förväntat returnerar 404/empty utan auth-fel. Synligt i Metro-loggen, inte i UI.
- **`expo-doctor`-disciplin.** Alla native-paket via `npx expo install <pkg>` per PITFALLS.md §4. Phase 1-acceptans = `npx expo-doctor` returnerar 0 fel.
- **Reanimated babel-plugin.** Måste ligga **sist** i `babel.config.js`-plugin-listan; nativewind/babel som **preset** (inte plugin). PITFALLS.md §3.1 är tydlig om detta.

</specifics>

<deferred>
## Deferred Ideas

- **`(auth)` + `(app)` route-grupp-skelett** — Phase 3 (när auth-flow byggs och `Stack.Protected guard={!!session}` faktiskt har en session att skydda mot).
- **Feature-folder-konvention (`features/<domain>/` vs flat)** — Phase 4 (när första riktiga feature byggs).
- **Dark-mode toggle-UI (manuell override av system-tema)** — Phase 7 (F15-toggle).
- **Egen `useColorScheme`-wrapper / `lib/theme.ts`** — Skjut till Phase 7 om/när manual-override behöver hookas in.
- **Error-boundary, splash-screen-customization, test/CI-skelett** — Inte i Phase 1-scope; kan adresseras i Phase 7 (V1 polish-cut) eller V1.1.
- **Per-area extra granskning** (Zustand store-skelett, custom expo-doctor-toleranser) — Inga Phase 1-blockerare; kan adderas just-in-time.

</deferred>

---

*Phase: 1-bootstrap-infra-hardening*
*Context gathered: 2026-05-08*
