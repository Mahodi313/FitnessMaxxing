---
phase: 01-bootstrap-infra-hardening
plan: 02
type: execute
wave: 2
depends_on:
  - 01-01
files_modified:
  - app/babel.config.js
  - app/metro.config.js
  - app/tailwind.config.js
  - app/global.css
  - app/nativewind-env.d.ts
  - app/app/index.tsx
  - app/app/_layout.tsx
autonomous: false
requirements:
  - F15
user_setup: []

must_haves:
  truths:
    - "`<Text className=\"text-2xl text-blue-500\">Hello FitnessMaxxing</Text>` rendereras på iPhone via Expo Go QR-kod utan röd skärm"
    - "Tailwind-klasser appliceras visuellt (text-storlek, färg)"
    - "`darkMode: 'class'` är konfigurerad i `tailwind.config.js`"
    - "`dark:`-varianter triggar när iPhone-tema växlar mellan light/dark (system-tema-toggle)"
    - "Inga \"Duplicate plugin/preset detected\"-warnings vid Metro-start"
  artifacts:
    - path: "app/babel.config.js"
      provides: "babel-preset-expo + nativewind/babel; Reanimated-plugin sist (eller utelämnad — Reanimated 4 inkluderar redan worklets)"
      contains: "nativewind/babel"
    - path: "app/metro.config.js"
      provides: "withNativeWind-wrapping av Expo Metro-config"
      contains: "withNativeWind"
    - path: "app/tailwind.config.js"
      provides: "darkMode: 'class' + content glob för app/app/**"
      contains: "darkMode"
    - path: "app/global.css"
      provides: "Tailwind base/components/utilities-direktiven"
      contains: "@tailwind"
    - path: "app/nativewind-env.d.ts"
      provides: "TS-deklaration för className-prop på native-komponenter"
      contains: "nativewind/types"
    - path: "app/app/index.tsx"
      provides: "Smoke-test-vyn med dark:-konvention"
      contains: "Hello FitnessMaxxing"
    - path: "app/app/_layout.tsx"
      provides: "Stack-root + global.css-import (provider-stacken kommer i Plan 03)"
      contains: "global.css"
  key_links:
    - from: "app/app/_layout.tsx"
      to: "app/global.css"
      via: "import"
      pattern: "import.*global\\.css"
    - from: "app/tailwind.config.js"
      to: "app/app/**/*.{ts,tsx}"
      via: "content glob"
      pattern: "content:"
    - from: "app/metro.config.js"
      to: "app/global.css"
      via: "withNativeWind input option"
      pattern: "input:.*global\\.css"
---

# Phase 1, Plan 02: NativeWind 4 + Tailwind 3 + dark-mode-konvention + iPhone smoke-test

**Phase:** 1 — Bootstrap & Infra Hardening
**Plan:** 02 of 03
**Goal:** Konfigurera NativeWind 4 + Tailwind 3-trippeln (babel + metro + global.css + tailwind.config) med `darkMode: 'class'`, ersätt `app/app/index.tsx` med F15-konventionell smoke-text, och verifiera på fysisk iPhone via Expo Go att Tailwind-klasser renderar OCH att `dark:`-varianter triggar när systemtema växlar.
**Depends on:** 01-01 (locked-stacken installerad — `nativewind`, `tailwindcss@^3.4.17` i `package.json`)
**Estimated:** M (~30-45 min — config skrivs snabbt; iPhone-checkpointen kräver fysisk enhet + tema-toggling)

## Phase Goal

**As a** personlig användare av FitnessMaxxing, **I want to** kunna starta appen på min iPhone via Expo Go och se en NativeWind-styled startsida, **so that** jag vet att hela locked-stacken är på plats innan vi börjar bygga features.

<execution_context>
@C:/Users/Mahod/Desktop/Projects/FitnessMaxxing/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Mahod/Desktop/Projects/FitnessMaxxing/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-bootstrap-infra-hardening/01-CONTEXT.md
@.planning/phases/01-bootstrap-infra-hardening/01-SKELETON.md
@.planning/phases/01-bootstrap-infra-hardening/01-01-SUMMARY.md
@CLAUDE.md
@.planning/research/STACK.md
@.planning/research/PITFALLS.md
@app/app.json
@app/tsconfig.json
@app/eslint.config.js
</context>

<scope>
**In scope:**
- Skapa `app/babel.config.js` med `babel-preset-expo` (med `jsxImportSource: "nativewind"` om SDK 54 kräver) + `nativewind/babel` som **preset** (inte plugin); Reanimated 4-plugin **sist** i plugin-listan (eller utelämnad helt — Reanimated 4.1 ingår redan i Expo SDK 54-default-presetet via worklets)
- Skapa `app/metro.config.js` som wrap:ar `getDefaultConfig(__dirname)` med `withNativeWind(config, { input: "./global.css" })`
- Skapa `app/tailwind.config.js` med:
  - `presets: [require("nativewind/preset")]`
  - `content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"]` (täcker både nuvarande `app/app/` och framtida `app/lib/`/`app/components/`)
  - `darkMode: 'class'` (per D-03, F15-konvention)
- Skapa `app/global.css` med `@tailwind base; @tailwind components; @tailwind utilities;`
- Skapa `app/nativewind-env.d.ts` med `/// <reference types="nativewind/types" />`
- Ersätt `app/app/_layout.tsx` med en minimal Stack-root som importerar `global.css` (provider-stacken ligger i Plan 03)
- Ersätt `app/app/index.tsx` med smoke-test-vyn per D-03:
  ```tsx
  <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
    <Text className="text-2xl text-blue-500 dark:text-blue-300">Hello FitnessMaxxing</Text>
  </View>
  ```
- Köra `npx expo start --clear` (cache-bust per PITFALLS §3.1 + §3.2 efter babel/metro-ändringar)
- Mänsklig checkpoint: scanna QR från iPhone Expo Go-app, bekräfta att texten renderar med Tailwind-storlek/färg, växla iOS systemtema mellan light/dark, bekräfta att `dark:`-varianten triggar
- Köra `npm run lint` + `npx tsc --noEmit` rent

**Out of scope (this plan):**
- `.env.local`, `lib/supabase.ts`, providers i `_layout.tsx` (QueryClient, AppState, NetInfo) — Plan 03
- Manuell dark-mode-toggle-UI — Phase 7
- Egna komponenter eller hooks — Phase 4+
</scope>

<files_modified>
- `app/babel.config.js` (NY)
- `app/metro.config.js` (NY)
- `app/tailwind.config.js` (NY)
- `app/global.css` (NY)
- `app/nativewind-env.d.ts` (NY)
- `app/app/_layout.tsx` (ersätter reset-default; Plan 03 utvidgar med providers)
- `app/app/index.tsx` (ersätter reset-default med smoke-test)
- `app/tsconfig.json` (uppdaterad `include`-array om `nativewind-env.d.ts` behöver explicit listas — verifiera; oftast räcker glob)
</files_modified>

<tasks>

<task type="auto">
  <name>Task 1: Skapa NativeWind-trippelfilerna (babel + metro + tailwind + global.css + types)</name>
  <files>
    app/babel.config.js
    app/metro.config.js
    app/tailwind.config.js
    app/global.css
    app/nativewind-env.d.ts
  </files>
  <action>
    Working dir: `app/`. Skapa följande filer med exakt nedanstående innehåll. Kommentar i filerna är OK men håll dem korta — det är load-bearing infrastruktur.

    **`app/babel.config.js`:**
    ```js
    module.exports = function (api) {
      api.cache(true);
      return {
        presets: [
          ["babel-preset-expo", { jsxImportSource: "nativewind" }],
          "nativewind/babel",
        ],
        // ⚠ DO NOT add 'react-native-worklets/plugin' here — it causes the
        //   "Duplicate plugin/preset detected" warning that breaks success
        //   criterion #5. Reanimated 4.1 in SDK 54 wires worklets automatically
        //   via babel-preset-expo. See PITFALLS §3.1.
        // ⚠ DO NOT add 'react-native-reanimated/plugin' here either, for the
        //   same reason. If Metro DOES complain about a missing plugin (rare on
        //   SDK 54), and ONLY then, add 'plugins: ["react-native-reanimated/plugin"]'
        //   as the LAST plugin — never alongside any worklets plugin.
      };
    };
    ```

    **PITFALLS §3.1-disciplin:** Om Metro vid start klagar på "missing reanimated plugin" eller "worklet is not defined", LÄGG TILL `plugins: ["react-native-reanimated/plugin"]` SIST i return-objektet — men först efter att ha bekräftat att babel-preset-expo's automatic-läge inte räcker. Default i Expo SDK 54 är att inte behöva detta explicit.

    **`app/metro.config.js`:**
    ```js
    const { getDefaultConfig } = require("expo/metro-config");
    const { withNativeWind } = require("nativewind/metro");

    const config = getDefaultConfig(__dirname);

    module.exports = withNativeWind(config, { input: "./global.css" });
    ```

    **`app/tailwind.config.js`:**
    ```js
    /** @type {import('tailwindcss').Config} */
    module.exports = {
      content: [
        "./app/**/*.{ts,tsx}",
        "./components/**/*.{ts,tsx}",
        "./lib/**/*.{ts,tsx}",
      ],
      presets: [require("nativewind/preset")],
      darkMode: "class",
      theme: {
        extend: {},
      },
      plugins: [],
    };
    ```

    `darkMode: "class"` är load-bearing per D-03 + ROADMAP success criteria #2 (F15-konvention från Phase 1). I NativeWind 4 betyder `class` att `useColorScheme()`-resultatet ("light"/"dark") appliceras som en `dark`-klass på root-vyn av NativeWind internt — `dark:`-varianter funkar då både i system-tema-läge och manuellt-toggle-läge (Phase 7-toggle hakas in i samma mekanism).

    **`app/global.css`:**
    ```css
    @tailwind base;
    @tailwind components;
    @tailwind utilities;
    ```

    **`app/nativewind-env.d.ts`:**
    ```ts
    /// <reference types="nativewind/types" />
    ```

    Verifiera att `app/tsconfig.json` redan inkluderar `**/*.ts`-glob så att den nya `nativewind-env.d.ts` plockas upp (existerande tsconfig inkluderar redan `**/*.ts`). Ingen tsconfig-edit ska behövas; om TypeScript inte hittar `className`-typen efter detta, lägg `"nativewind-env.d.ts"` explicit i `include`-arrayen.
  </action>
  <verify>
    <automated>
      Working dir: `app/`. Kör:
      `node -e "['babel.config.js','metro.config.js','tailwind.config.js','global.css','nativewind-env.d.ts'].forEach(f => { if(!require('fs').existsSync(f)) { console.error('MISSING:', f); process.exit(1); } }); const tw = require('./tailwind.config.js'); if (tw.darkMode !== 'class') { console.error('darkMode is not class:', tw.darkMode); process.exit(1); } if (!tw.content.some(g => g.includes('app/'))) { console.error('content glob missing app/'); process.exit(1); } console.log('OK');"`
      Förväntat: `OK`.
    </automated>
  </verify>
  <done>Alla fem config-filer finns; `tailwind.config.js` har `darkMode: 'class'` och content-glob täcker `app/app/`.</done>
</task>

<task type="auto">
  <name>Task 2: Skriv smoke-test-vyn och importera global.css i layout-rooten</name>
  <files>
    app/app/_layout.tsx
    app/app/index.tsx
  </files>
  <action>
    Working dir: `app/`. Ersätt innehållet i båda filerna med exakt följande.

    **`app/app/_layout.tsx`** (Plan 03 utvidgar denna med providers; här bara `<Stack/>` + `global.css`-import för att aktivera NativeWind-pipelinen):
    ```tsx
    import "../global.css";
    import { Stack } from "expo-router";

    export default function RootLayout() {
      return <Stack />;
    }
    ```

    Importen `../global.css` är load-bearing — utan den producerar Metro CSS-bundlet men appen läser aldrig in det, så `className`-props blir no-op (PITFALLS §3.2 warning sign). Eftersom `_layout.tsx` ligger under `app/app/` är relativ path `../global.css` (en nivå upp till `app/global.css`).

    **`app/app/index.tsx`** (smoke-test per D-03):
    ```tsx
    import { Text, View } from "react-native";

    export default function Index() {
      return (
        <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
          <Text className="text-2xl text-blue-500 dark:text-blue-300">
            Hello FitnessMaxxing
          </Text>
        </View>
      );
    }
    ```

    Notera: `View` och `Text` importeras direkt från `react-native`. NativeWind 4 patchar dessa core-komponenter att acceptera `className`-prop via babel-preset-expo + jsxImportSource. Ingen `styled()`-wrapper behövs.

    **Vad smoke-test bevisar:**
    - `text-2xl` → text-storlek 24px (Tailwind base scale) — visuellt observerbar storleksökning vs default
    - `text-blue-500` → text-färg #3B82F6 — observerbar blå
    - `dark:text-blue-300` → text-färg #93C5FD när system-tema är dark — observerbar lysare blå
    - `bg-white` / `dark:bg-gray-900` → vit bakgrund vs nästan-svart bakgrund vid tema-växling
    - `flex-1 items-center justify-center` → texten är centrerad i mitten av skärmen

    Om något av dessa fyra synliga effekter saknas vid Task 4-checkpointen, har NativeWind-pipelinen inte sluten — diagnos i denna ordning: (1) `tailwindcss` är v3 inte v4, (2) `global.css` importerad i `_layout.tsx`, (3) `metro.config.js` wrappar med `withNativeWind`, (4) Metro-cache rensad.
  </action>
  <verify>
    <automated>
      **Working dir:** `app/`.

      Kör (paths är relativa till `app/`, så `app/index.tsx` = `<repo>/app/app/index.tsx`):
      `grep -q "Hello FitnessMaxxing" app/index.tsx && grep -q "dark:text-blue-300" app/index.tsx && grep -q "import \"../global.css\"" app/_layout.tsx && echo OK`

      Förväntat: `OK`. Detta bevisar att smoke-test-strängen + dark:-konventionen + global.css-importen finns på rätt plats.

      Om `grep` returnerar exit 1: kontrollera att executor faktiskt står i `app/` — kör `pwd` först och bekräfta att sista segmentet är `app`.
    </automated>
  </verify>
  <done>Smoke-test-vyn använder `dark:`-varianter; `_layout.tsx` importerar `global.css`.</done>
</task>

<task type="auto">
  <name>Task 3: Lint + TypeScript-kontroll</name>
  <files></files>
  <action>
    Working dir: `app/`.

    Cache-bust-disciplin (PITFALLS §3.1 + §3.2): efter ändringar i `babel.config.js` eller `metro.config.js` MÅSTE Metro starta med `--clear` nästa gång — annars kör appen mot stale config och NativeWind-pipelinen kan se ut att vara trasig. **Vi gör inte cache-busten i denna task** — Task 4 (iPhone-checkpointen) startar Metro med `npx expo start --clear` som första steg, vilket utför cache-busten naturligt under den första bundeln. Att kicka igång en bakgrunds-server bara för att rensa cachen är skört (windows-process-kill, sleep-timing) och tillför ingen säkerhetsmarginal när Task 4 ändå rensar.

    Den här tasken fokuserar på två snabba statiska kontroller:

    ```bash
    npm run lint
    npx tsc --noEmit
    ```

    Båda måste exit 0. Om `tsc --noEmit` klagar på `className`-prop saknas på `View`/`Text`, har `nativewind-env.d.ts` inte plockats upp — verifiera `tsconfig.json` `include`-array.

    **Förväntade icke-blockerande warnings (ignoreras):**
    - "Some peer dependencies are unmet" från `victory-native` (CLAUDE.md medger detta).

    **Blockerande output (rapportera till checkpoint):**
    - `npm run lint` exit ≠ 0
    - `npx tsc --noEmit` errors (ej warnings)
  </action>
  <verify>
    <automated>
      Working dir: `app/`. `npm run lint` exit 0 OCH `npx tsc --noEmit` exit 0.
    </automated>
  </verify>
  <done>`npm run lint` + `npx tsc --noEmit` båda exit 0. (Metro-cache rensas naturligt vid Task 4 step 1 via `npx expo start --clear`.)</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: iPhone Expo Go QR-test + dark-mode-växling</name>
  <what-built>
    - NativeWind 4 + Tailwind 3-trippeln konfigurerad
    - `darkMode: 'class'` i `tailwind.config.js`
    - Smoke-test-vyn `<Text>Hello FitnessMaxxing</Text>` med `text-2xl text-blue-500 dark:text-blue-300` + `<View>` med `bg-white dark:bg-gray-900`
    - `_layout.tsx` importerar `global.css`
  </what-built>
  <how-to-verify>
    1. Från `app/`-mappen, starta dev-servern med cache-bust (PITFALLS §3.1 — krävs efter babel/metro-ändringar): `npx expo start --clear`. Första bundeln tar lite längre eftersom transform-cachen byggs om från scratch — det är förväntat och är hela poängen med flaggan.
    2. Vänta tills Metro skriver ut QR-koden i terminalen (ungefär 15-40 sekunder med `--clear` första gången). **Granska terminal-output:** det ska INTE finnas "Duplicate plugin/preset detected" eller "Error: Cannot find module 'nativewind'"-meddelanden. Om sådana dyker upp → STOPPA, rapportera.
    3. På din iPhone: öppna Expo Go-appen. Scanna QR-koden från terminalen (kameran in-app fungerar; eller använd iPhone-kameran och tryck på notifikationen).
    4. Vänta 10-30 sekunder tills bundeln laddas första gången. Du ska se:
       - Centrerad text "Hello FitnessMaxxing" mitt på skärmen
       - Texten är **stor** (text-2xl ≈ 24px) och **blå** (text-blue-500 ≈ #3B82F6) i light mode
       - Bakgrunden är **vit** i light mode
       - **Ingen röd error-skärm**
    5. Växla iOS systemtema:
       - Settings → Display & Brightness → välj "Dark" (eller swipe ner Control Center och tryck Dark Mode-ikonen om du har den)
       - Tillbaka till Expo Go (appen reload:ar typiskt automatiskt; om inte, shake-gesture → "Reload")
       - Texten ska nu vara **lysare blå** (text-blue-300 ≈ #93C5FD) på **nästan-svart bakgrund** (bg-gray-900 ≈ #111827)
    6. Växla tillbaka till Light → bekräfta att texten är mörkblå mot vit bakgrund igen.
    7. **Säkerhetscheck:** `git grep -n "service_role\|SERVICE_ROLE" app/` returnerar inga matchningar (T2 enforcement).

    **Vad som BRYTER mot acceptans (rapportera istället för "approved"):**
    - Texten renderar utan Tailwind-styling (default RN-text-storlek/svart färg) → NativeWind-pipelinen är trasig (oftast tailwindcss v4 eller saknad `global.css`-import)
    - Röd skärm → babel/metro-config-fel
    - Dark mode växlar inte färg → `darkMode: 'class'` saknas eller `useColorScheme` inte hookad in (NativeWind hanterar detta automatiskt om `darkMode: 'class'` är satt)
    - Metro-warning om "Duplicate plugin" → `react-native-worklets/plugin` har lagts till manuellt (PITFALLS §3.1)
  </how-to-verify>
  <resume-signal>Skriv "approved" om alla 7 punkter passerar, eller beskriv exakt vilken punkt som fallerade så vi kan diagnosera.</resume-signal>
</task>

</tasks>

<verification>
**Plan-nivå-bevis:**

1. **Smoke-text renderar med Tailwind-klasser** (success criteria #1) — Task 4 step 4 visuell observation.
2. **`darkMode: 'class'` etablerad** (success criteria #2) — Task 1 verifierar via `tailwind.config.js`-load; Task 4 step 5-6 visuellt via system-tema-toggle.
3. **Reanimated babel-plugin utan dubbletter** (success criteria #5) — Task 4 step 2: ingen "Duplicate plugin/preset detected" i Metro-output.
4. **TypeScript + lint rena** — Task 3 verifierar.

**Maps to ROADMAP success criteria:** #1 (Tailwind text renderar på iPhone), #2 (darkMode + dark:-konvention), #5 (ingen plugin-dubblett-varning).
</verification>

<threat_model>
**ASVS Level:** 1
**Block on:** high

| ID | Severity | Threat | Affected component | Mitigation | Verification |
|----|----------|--------|--------------------|------------|--------------|
| T8 | low | NativeWind config-fel exponerar styling-pipeline-bug som silent breakage (säkerhetsmässigt nullt — men ger felaktig signal att andra delar funkar) | Styling-pipelinen, indirekt: visuell verifikation av andra säkerhets-features kan förlita sig på `dark:` rendering | Smoke-test verifierar pipelinen explicit innan Plan 03 wirar Supabase | Task 4 step 4-6 visuellt bevis |
| T9 | informational | `app/global.css` är världs-läsbar fil (inga sekretess-problem); inkluderas i bundeln | Bundeln | Filen innehåller bara Tailwind-direktiv, inga secrets | Manuell granskning av `global.css`-innehållet (3 rader) |

**Ingen high-severity i denna plan** — Plan 02 berör endast styling-pipelinen, ingen network/auth/data-yta. Säkerhetsverifikation hand-off:as till Plan 03 där Supabase-klienten landas.
</threat_model>

<success_criteria>
Plan 02 är klar när:
- [x] Babel + Metro + Tailwind + global.css + nativewind-env.d.ts finns alla med rätt innehåll
- [x] `darkMode: 'class'` i `tailwind.config.js` (F15-konvention etablerad)
- [x] `app/app/index.tsx` använder `dark:`-varianter
- [x] `_layout.tsx` importerar `../global.css`
- [x] Metro startar utan "Duplicate plugin/preset"-warning
- [x] iPhone Expo Go visar smoke-text med Tailwind-storlek/färg, light och dark
- [x] `npm run lint` + `npx tsc --noEmit` båda exit 0
- [x] Mänsklig checkpoint approved
</success_criteria>

<output>
Efter completion, skapa `.planning/phases/01-bootstrap-infra-hardening/01-02-SUMMARY.md`. Inkludera:
- Babel-konfig faktiskt valt (med eller utan explicit Reanimated-plugin)
- Skärmdumpar/anteckningar från iPhone-checkpointen (light + dark)
- Eventuella Metro-warnings som accepterades (notera vilka)
</output>
