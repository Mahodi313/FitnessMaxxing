---
phase: 01-bootstrap-infra-hardening
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/package.json
  - app/package-lock.json
  - app/app/index.tsx
  - app/app/_layout.tsx
autonomous: false
requirements:
  - F15
user_setup: []

must_haves:
  truths:
    - "Demo-scaffolden är borta — `app-example/` finns inte i repot, parallax/themed-*/hello-wave är raderade"
    - "Hela CLAUDE.md TL;DR-stacken är installerad till exakta pinnar i `app/package.json`"
    - "Native-affected paket är installerade via `npx expo install` (inte `npm install`)"
    - "`npx expo-doctor` returnerar 0 fel"
    - "ESLint kör rent på den minimala post-reset-koden"
  artifacts:
    - path: "app/package.json"
      provides: "Pinned dependencies for the locked stack"
      contains: "\"nativewind\""
    - path: "app/package.json"
      provides: "Tailwind v3 (peer-dep krav från NativeWind 4)"
      contains: "\"tailwindcss\""
    - path: "app/package.json"
      provides: "Supabase client + LargeSecureStore-prereqs"
      contains: "\"@supabase/supabase-js\""
    - path: "app/app/index.tsx"
      provides: "Reset-default index route (ersätts i Plan 02)"
    - path: "app/app/_layout.tsx"
      provides: "Reset-default Stack-root (ersätts i Plan 03)"
  key_links:
    - from: "app/package.json"
      to: "Expo SDK 54 runtime"
      via: "version pins"
      pattern: "\"expo\":\\s*\"~54"
---

# Phase 1, Plan 01: Reset scaffold och installera locked-stacken

**Phase:** 1 — Bootstrap & Infra Hardening
**Plan:** 01 of 03
**Goal:** Återställ Expo-scaffolden till ren start och installera HELA CLAUDE.md TL;DR-stacken till exakta pins, med rätt verktyg per pakettyp (`npx expo install` för native-affected, `npm install` för pure-JS), och bevisa att `npx expo-doctor` är ren.
**Depends on:** Inget (Wave 1, första plan i fasen)
**Estimated:** M (~30-45 min interaktivt — reset-prompten kräver svar; install + doctor kör)

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
@CLAUDE.md
@.planning/research/STACK.md
@.planning/research/PITFALLS.md
@app/package.json
@app/scripts/reset-project.js
@app/.gitignore
</context>

<scope>
**In scope:**
- Köra `npm run reset-project` i `app/` per D-01 (svar = `n` → demo-filer raderas, ingen `app-example/`-mapp skapas; uppfyller också D-02 i ett steg)
- Verifiera att `app-example/` INTE finns kvar (skripten med `n` raderar utan att skapa exempel-mappen)
- Installera locked-stacken i den ordning STACK.md §Installation föreskriver:
  1. NativeWind 4 + Tailwind v3 (NOT v4) + prettier-plugin-tailwindcss — `npm install` (pure-JS) + `--dev` för tooling
  2. `safe-area-context` redan i scaffolden — verifiera, installera inte om
  3. TanStack Query + Zustand — `npm install` (pure-JS)
  4. react-hook-form + @hookform/resolvers + Zod — `npm install` (pure-JS)
  5. date-fns — `npm install` (pure-JS)
  6. Supabase + secure-store + AsyncStorage + get-random-values — `npx expo install` (native-affected per PITFALLS §3.4) + `npm install aes-js` (pure-JS)
  7. `@react-native-community/netinfo` — `npx expo install` (native-affected)
  8. `@tanstack/query-async-storage-persister` — `npm install` (pure-JS)
  9. Skia + victory-native — `npx expo install` Skia (native-affected) + `npm install victory-native` (pure-JS per STACK.md)
- Köra `npx expo-doctor` — MÅSTE returnera 0 fel
- Köra `npm run lint` — MÅSTE vara ren
- Mänsklig verify-checkpoint: bekräfta att `app-example/` inte finns och att `package.json` ser rätt ut

**Out of scope (this plan):**
- NativeWind config-filer (babel/metro/global.css/tailwind.config) — Plan 02
- `.env.local` + `lib/supabase.ts` + provider-wired `_layout.tsx` — Plan 03
- iPhone Expo Go QR-test — Plan 02 (efter NativeWind-konfig)
- Connect-test mot Supabase — Plan 03
</scope>

<files_modified>
- `app/package.json` — adderade dependencies + devDependencies (locked stack)
- `app/package-lock.json` — uppdaterad för pinnen
- `app/app/index.tsx` — ersatt av `reset-project.js` med minimal default
- `app/app/_layout.tsx` — ersatt av `reset-project.js` med `<Stack/>`-default
- DELETED: `app/app/(tabs)/`, `app/components/`, `app/hooks/`, `app/constants/`, `app/scripts/` (raderade av reset-project.js när användaren svarar `n`)

**Important:** `reset-project` raderar också `app/scripts/` självt — detta är förväntat. `package.json`-skriptet `reset-project` kommer peka på en raderad fil efter körning, vilket är OK (skripten ska bara köras en gång).
</files_modified>

<tasks>

<task type="auto">
  <name>Task 1: Kör reset-project och verifiera att demo är borta</name>
  <files>
    app/app/index.tsx
    app/app/_layout.tsx
  </files>
  <action>
    Kör reset-project i `app/`-mappen. Skripten är interaktiv och frågar "Do you want to move existing files to /app-example instead of deleting them? (Y/n)". Per D-02 ska svaret vara `n` (radera direkt, ingen `app-example/`).

    Eftersom skripten är interaktiv via stdin: använd `echo n | npm run reset-project` (POSIX) eller `'n' | npm run reset-project` (PowerShell) för att pipe:a svaret. På Windows: `cmd /c "echo n | npm run reset-project"` är mest tillförlitlig.

    Working dir: `app/`

    ```bash
    # från repo-root:
    cd app && echo n | npm run reset-project
    ```

    Efter körning ska följande raderas (per `scripts/reset-project.js` rad 14, `oldDirs = ["app", "components", "hooks", "constants", "scripts"]` med svar `n` → `rm -rf` på varje):
    - `app/app/(tabs)/` (hela mappen + filer)
    - `app/components/`
    - `app/hooks/`
    - `app/constants/`
    - `app/scripts/` (skripten raderar sig själv)

    Sedan skapas:
    - `app/app/index.tsx` (minimal `<Text>Edit app/index.tsx to edit this screen.</Text>`)
    - `app/app/_layout.tsx` (`<Stack/>`-default, ingen ThemeProvider)

    Verifiera direkt efteråt:
    - `app-example/` finns INTE under repo-roten eller under `app/`
    - `app/app/index.tsx` är 5-10 rader, ingen `@/hooks/use-color-scheme`-import
    - `app/app/_layout.tsx` är 3-5 rader, ingen `@react-navigation/native`-import
    - `app/components/`, `app/hooks/`, `app/constants/`, `app/scripts/` finns INTE

    Om reset-skripten misslyckas (t.ex. för att stdin-pipe inte fungerade): manuellt radera de fem mapparna ovan och skapa `app/app/index.tsx` + `app/app/_layout.tsx` enligt innehållet i `scripts/reset-project.js` rad 19-41 (dvs. `indexContent` och `layoutContent`-strängarna).
  </action>
  <verify>
    <automated>
      Från repo-rot:
      `test ! -d app/app-example && test ! -d app-example && test ! -d app/components && test ! -d app/hooks && test ! -d app/constants && test ! -d app/scripts && test -f app/app/index.tsx && test -f app/app/_layout.tsx && echo OK`
      Förväntat: `OK`. Om något test fallerar är reset-tillståndet inkomplett.
    </automated>
  </verify>
  <done>Demo är raderad; `app-example/` finns inte; minimal `index.tsx` + `_layout.tsx` på plats.</done>
</task>

<task type="auto">
  <name>Task 2: Installera locked-stacken (steg 1-9 per STACK.md §Installation)</name>
  <files>
    app/package.json
    app/package-lock.json
  </files>
  <action>
    Working dir för ALLT: `app/`. Kör kommandona i exakt denna ordning. **Pure-JS-paket använder `npm install` med exakt version-range; native-affected använder `npx expo install` så Expo-kompatibilitetstabellen pinnar rätt SDK 54-version.** PITFALLS §3.4 är tydligt om att fel verktyg ger native-mismatch-krasch vid runtime.

    ```bash
    # Steg 1 — Styling (per CLAUDE.md TL;DR-tabellen)
    npm install nativewind@^4.2.3
    npm install --save-dev tailwindcss@^3.4.17 prettier-plugin-tailwindcss@^0.5.11

    # Steg 2 — State + data (pure-JS)
    npm install @tanstack/react-query@^5.100.9 zustand@^5.0.13

    # Steg 3 — Forms + validation (pure-JS)
    npm install react-hook-form@^7.75.0 @hookform/resolvers@^5.2.2 zod@^4.4.3

    # Steg 4 — Dates (pure-JS)
    npm install date-fns@^4.1.0

    # Steg 5 — Supabase + secure session storage
    # Native-affected: secure-store + async-storage + get-random-values + supabase-js (Expo curates supabase-js för fetch-polyfill); pure-JS: aes-js
    npx expo install @supabase/supabase-js expo-secure-store @react-native-async-storage/async-storage react-native-get-random-values
    npm install aes-js@^3.1.2

    # Steg 6 — NetInfo för onlineManager-bridge i _layout.tsx (Plan 03)
    npx expo install @react-native-community/netinfo

    # Steg 7 — TanStack Query persister (pure-JS)
    npm install @tanstack/query-async-storage-persister

    # Steg 8 — Charting (Phase 6 förberedelse — installeras nu så framtida faser inte stannar)
    npx expo install @shopify/react-native-skia
    npm install victory-native@^41.20.2
    ```

    **Versions-disciplin (D-05):** kontrollera att `package.json` efter installen har EXAKT dessa pinnar (eller `npx expo install`-resolveade pinnar för native-affected). Om någon hamnar fel: ta bort, kör om med exakt version (`npm install <pkg>@<version>`).

    **PITFALLS §3.1-trap:** Adda INTE `react-native-worklets/plugin` till `babel.config.js` — Reanimated 4.1 inkluderar redan worklets internt. Babel-config skrivs i Plan 02; håll bara det i åtanke.

    **Förväntade peer-dep-warnings (ignoreras per CLAUDE.md):**
    - `victory-native@41.x` deklarerar `@shopify/react-native-skia: ">=1.2.3"` — vi installerar 2.6.x; npm warnar men det är OK (community-bekräftat 2026-05).
    - Eventuella warnings från RHF7 / resolvers 5 / Zod 4-kombinationen är inte-blockerande.

    Inga ytterligare paket — om något av kommandona ovan misslyckas, FELRAPPORTERA till checkpoint istället för att improvisera versioner.
  </action>
  <verify>
    <automated>
      Working dir: `app/`. Kör `node -e "const p = require('./package.json'); const expect = { 'nativewind': '^4.2.3', 'tailwindcss': '^3.4.17', '@tanstack/react-query': '^5.100.9', 'zustand': '^5.0.13', 'react-hook-form': '^7.75.0', '@hookform/resolvers': '^5.2.2', 'zod': '^4.4.3', 'date-fns': '^4.1.0', 'aes-js': '^3.1.2', 'victory-native': '^41.20.2', '@tanstack/query-async-storage-persister': true }; const all = {...p.dependencies, ...p.devDependencies}; const missing = Object.entries(expect).filter(([k,v]) => !all[k] || (typeof v === 'string' && all[k] !== v && !all[k].startsWith(v.replace(/^[\\^~]/, '').split('.')[0]))); console.log(missing.length === 0 ? 'OK' : 'MISSING/MISMATCH: ' + JSON.stringify(missing));"`
      Förväntat: `OK`.
    </automated>
  </verify>
  <done>Alla locked-stacken-paket finns i `app/package.json` på rätt versioner; `node_modules/` är installerad utan fel.</done>
</task>

<task type="auto">
  <name>Task 3: Verifiera med expo-doctor + lint</name>
  <files></files>
  <action>
    Working dir: `app/`.

    ```bash
    npx expo-doctor
    npm run lint
    ```

    `expo-doctor` MÅSTE returnera 0 fel (0 errors). Warnings om saknade filer som `metro.config.js` eller `babel.config.js` är OK i denna plan — de skapas i Plan 02. Om doctor flaggar versions-mismatch på native-paket: kör `npx expo install --fix` och kör doctor igen. Om mismatchen kvarstår, FELRAPPORTERA — försök inte tvinga.

    `npm run lint` (= `expo lint`) ska köra rent på den minimala post-reset-koden. Eftersom `app/app/index.tsx` och `app/app/_layout.tsx` är trivial-default från reset-skripten ska det inte vara några ESLint-fel.

    Om doctor varnar om "Use the official format for `app.json`" eller liknande icke-blockerande tips — notera men gå vidare. Bara `errors:` är blockerande; warnings är informativa.
  </action>
  <verify>
    <automated>
      Från `app/`: `npx expo-doctor 2>&1 | tee /tmp/doctor.log; grep -E "(0 issues|All checks passed|No issues|Didn't find any issues)" /tmp/doctor.log && echo DOCTOR_OK || (grep -iE "(error|fail)" /tmp/doctor.log; exit 1)` — söker efter "no issues"-formuleringen i doctor-utskriften. Förväntat: `DOCTOR_OK`. Och separat: `npm run lint` exit code 0.
    </automated>
  </verify>
  <done>`expo-doctor` rapporterar inga blockerande fel; `npm run lint` exit 0.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Mänsklig verifiering — package.json + filsystem</name>
  <what-built>
    - Reset av Expo-scaffold (radat: `(tabs)/`, `components/`, `hooks/`, `constants/`, `scripts/`, `app-example/`)
    - Installerat hela CLAUDE.md TL;DR-stacken i `app/package.json`
    - `expo-doctor` 0 fel; `expo lint` rent
  </what-built>
  <how-to-verify>
    1. Öppna `app/package.json` i editor. Verifiera visuellt att följande nycklar finns under `dependencies` ELLER `devDependencies`:
       - `nativewind` (`^4.2.3`)
       - `tailwindcss` (`^3.4.17`) — **MÅSTE vara v3, INTE v4**. Om du ser `^4.x.x`, STOPPA och rapportera.
       - `prettier-plugin-tailwindcss`, `@tanstack/react-query`, `@tanstack/query-async-storage-persister`, `zustand`, `react-hook-form`, `@hookform/resolvers`, `zod`, `date-fns`, `@supabase/supabase-js`, `expo-secure-store`, `@react-native-async-storage/async-storage`, `aes-js`, `react-native-get-random-values`, `@react-native-community/netinfo`, `@shopify/react-native-skia`, `victory-native`
       - Befintliga (inte bumpade): `expo` (`~54.0.33`), `expo-router` (`~6.0.23`), `react-native` (`0.81.5`), `react` (`19.1.0`), `react-native-reanimated` (`~4.1.1`)
    2. Öppna en terminal och kör `ls app/` — du ska INTE se `app-example/`, `components/`, `hooks/`, `constants/`, eller `scripts/`. Du SKA se: `app/`, `assets/`, `node_modules/`, `package.json`, `tsconfig.json`, `app.json`, `eslint.config.js`, `.gitignore`.
    3. Öppna `app/app/index.tsx` — det ska vara ~10 rader med en `<Text>Edit app/index.tsx...</Text>` (reset-default). Tailwind-klasser kommer i Plan 02.
    4. Säkerhetscheck: `git grep -n "service_role\|SERVICE_ROLE"` från repo-rot ska returnera ingenting (eller bara matchningar i docs/research). Om en match dyker upp i `app/` källkod → STOPPA, det är T2-läckage.
  </how-to-verify>
  <resume-signal>Skriv "approved" om allt stämmer, eller beskriv avvikelsen.</resume-signal>
</task>

</tasks>

<verification>
**Plan-nivå-bevis:**

1. **Reset komplett** — `ls app/` visar inte `app-example/`, `components/`, `hooks/`, `constants/`, eller `scripts/`. `app/app/index.tsx` + `app/app/_layout.tsx` är reset-defaults (kort + minimal).
2. **Stack installerad** — `app/package.json` innehåller alla paket från CLAUDE.md TL;DR-tabellen på exakta pinnar. `tailwindcss` är på `^3.4.17` (NOT v4 — kritisk-blocker).
3. **`expo-doctor` ren** — `npx expo-doctor` rapporterar 0 fel.
4. **Lint ren** — `npm run lint` exit 0.

**Maps to ROADMAP success criteria:** #3 (`expo-doctor` 0 fel; native-paket via `npx expo install`).
</verification>

<threat_model>
**ASVS Level:** 1
**Block on:** high

| ID | Severity | Threat | Affected component | Mitigation | Verification |
|----|----------|--------|--------------------|------------|--------------|
| T2 | high | Service-role-nyckel hamnar oavsiktligt som dependency-namn eller source-fil under installen | Hela klient-bundlen | `EXPO_PUBLIC_SUPABASE_ANON_KEY` är den enda Supabase-nyckeln som någonsin nämns; PITFALLS §2.3 — vi installerar `@supabase/supabase-js` (klient-SDK) inte `@supabase/admin-js` eller liknande service-role-paket | Task 4 step 4: `git grep -n "service_role\|SERVICE_ROLE"` returnerar inga matchningar i `app/` |
| T5 | medium | NPM-supply-chain-attack via tampered version (felaktigt pin släpper igenom kompromissad release) | `app/node_modules/` | Exakta pinnar enligt CLAUDE.md TL;DR; npm-registret default; `package-lock.json` committas så att framtida `npm ci` reproducerar exakt set | `package-lock.json` finns och är diff:bar; `expo-doctor` validerar version-kompabilitet mot SDK 54 |
| T6 | low | `app-example/` med demo-kod committas oavsiktligt (skräp i historiken, inga säkerhets-implikationer) | Repo | D-02: `n`-svar till reset-skripten = radera, inte flytta; Task 1 verifierar mappen inte finns | Task 4 step 2: `ls app/` visar inte `app-example/` |
| T7 | informational | `tailwindcss@4.x` installeras av misstag (npm "latest" tag), bryter NativeWind-pipelinen silent | Styling-pipeline | Explicit pin `tailwindcss@^3.4.17`; Task 4 step 1 visuell granskning av `package.json` | `package.json` har `tailwindcss: ^3.4.17`; Plan 02 smoke-test fångar pipeline-brott om det missas här |
</threat_model>

<success_criteria>
Plan 01 är klar när:
- [x] `app-example/`, `app/components/`, `app/hooks/`, `app/constants/`, `app/scripts/` finns INTE i repot
- [x] `app/app/index.tsx` + `app/app/_layout.tsx` är reset-defaults (Plan 02 + 03 ersätter dem)
- [x] Alla CLAUDE.md TL;DR-paket finns i `app/package.json` på rätt versioner; `tailwindcss` är v3 (kritisk gate)
- [x] `npx expo-doctor` returnerar 0 fel från `app/`
- [x] `npm run lint` exit 0
- [x] Mänsklig checkpoint approved (filsystem + package.json visuellt verifierat)
</success_criteria>

<output>
Efter completion, skapa `.planning/phases/01-bootstrap-infra-hardening/01-01-SUMMARY.md` enligt summary-mallen. Inkludera:
- Lista över installerade paket (versioner faktiskt resolvade efter `npx expo install`)
- Eventuella `expo-doctor`-warnings som accepterades (notera vilka)
- Bekräftelse att `tailwindcss` är på v3
</output>
