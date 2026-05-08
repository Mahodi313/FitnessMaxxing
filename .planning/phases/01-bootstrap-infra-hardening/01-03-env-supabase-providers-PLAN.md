---
phase: 01-bootstrap-infra-hardening
plan: 03
type: execute
wave: 3
depends_on:
  - 01-01
  - 01-02
files_modified:
  - app/.env.local
  - app/.env.example
  - app/lib/supabase.ts
  - app/lib/query-client.ts
  - app/app/_layout.tsx
autonomous: false
requirements:
  - F15
user_setup:
  - service: supabase
    why: "Phase 1 connect-test bevisar att klient + nätverk + headers funkar mot riktiga Supabase-endpoint. Phase 2 levererar schemat."
    env_vars:
      - name: EXPO_PUBLIC_SUPABASE_URL
        source: "Supabase Dashboard → Project Settings → API → Project URL (https://<ref>.supabase.co)"
      - name: EXPO_PUBLIC_SUPABASE_ANON_KEY
        source: "Supabase Dashboard → Project Settings → API → Project API keys → anon (public). DO NOT use service_role."
    dashboard_config:
      - task: "Skapa Supabase-projekt om det inte redan finns"
        location: "https://supabase.com/dashboard → New project (välj region, sätt database password — spara i en password manager)"
      - task: "Verifiera att anon-nyckeln (inte service-role) kopieras"
        location: "Project Settings → API. Anon-nyckeln är publik per design (RLS skyddar data); service-role-nyckeln är ALDRIG i klient-bundeln."

must_haves:
  truths:
    - "`EXPO_PUBLIC_SUPABASE_URL` och `EXPO_PUBLIC_SUPABASE_ANON_KEY` läses i appen vid runtime"
    - "`app/.env.local` är gitignored och INTE committad"
    - "`app/lib/supabase.ts` skapar klient med `LargeSecureStore` per CLAUDE.md Critical Recipe §A"
    - "Connect-test mot Supabase loggar 404/empty i Metro (bevisar nätverk + auth-headers; ingen tabell `_phase1_smoke` finns)"
    - "QueryClientProvider + AppState focusManager + NetInfo onlineManager + persistQueryClient är wirade i `_layout.tsx`"
    - "Persister använder AsyncStorage med `maxAge: 24h`"
    - "Inga \"Missing EXPO_PUBLIC_*\"-fel vid app-start; runtime-guard kastar tydligt fel om env saknas"
  artifacts:
    - path: "app/.env.local"
      provides: "Local-only env vars (gitignored)"
    - path: "app/.env.example"
      provides: "Documented env shape for repo"
      contains: "EXPO_PUBLIC_SUPABASE_URL"
    - path: "app/lib/supabase.ts"
      provides: "Supabase client + LargeSecureStore wrapper + connect-test export"
      contains: "LargeSecureStore"
    - path: "app/lib/query-client.ts"
      provides: "QueryClient + persister setup (AsyncStorage, maxAge 24h)"
      contains: "persistQueryClient"
    - path: "app/app/_layout.tsx"
      provides: "Root layout with QueryClientProvider + focusManager + onlineManager + persister hookup"
      contains: "QueryClientProvider"
  key_links:
    - from: "app/lib/supabase.ts"
      to: "process.env.EXPO_PUBLIC_SUPABASE_URL"
      via: "createClient first arg"
      pattern: "process\\.env\\.EXPO_PUBLIC_SUPABASE_URL"
    - from: "app/lib/supabase.ts"
      to: "expo-secure-store + AsyncStorage + aes-js"
      via: "LargeSecureStore class"
      pattern: "class LargeSecureStore"
    - from: "app/app/_layout.tsx"
      to: "app/lib/query-client.ts"
      via: "import"
      pattern: "from \"@/lib/query-client\""
    - from: "app/app/_layout.tsx"
      to: "AppState (focusManager) + NetInfo (onlineManager)"
      via: "addEventListener bridges"
      pattern: "focusManager\\.setEventListener"
---

# Phase 1, Plan 03: Env vars + Supabase-klient + provider-wired _layout + connect-test

**Phase:** 1 — Bootstrap & Infra Hardening
**Plan:** 03 of 03
**Goal:** Aktivera den vertikala slice som stänger Walking Skeletonet — ladda `.env.local` med EXPO_PUBLIC-prefix, skapa `lib/supabase.ts` med LargeSecureStore-wrappern, wira hela CLAUDE.md Critical Recipe §B-providerstacken (QueryClient + AppState focusManager + NetInfo onlineManager + persistQueryClient med AsyncStorage 24h) i `app/app/_layout.tsx`, och bevisa funktionellt att Supabase-rundresan funkar via en dev-only connect-test som loggas i Metro.
**Depends on:** 01-01 (stack installerad), 01-02 (NativeWind/styling-pipelinen funkar — så att en eventuell error-rendering inte är missvisande)
**Estimated:** L (~60-90 min — kod skrivs snabbt; user-setup-checkpoint för Supabase-projekt + iPhone-verifikation av connect-test-loggen)

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
@.planning/phases/01-bootstrap-infra-hardening/01-02-SUMMARY.md
@CLAUDE.md
@.planning/research/STACK.md
@.planning/research/PITFALLS.md
@.planning/research/ARCHITECTURE.md
@app/tsconfig.json
@app/.gitignore

<interfaces>
<!-- Kontrakter executorn behöver. NativeWind-pipelinen är på plats efter Plan 02. -->
<!-- Provider-stacken som ska wireas är CLAUDE.md Critical Recipe §A + §B; full källkod finns där. -->

`app/.gitignore` (inherited from scaffold) inkluderar redan:
```
# local env files
.env*.local
```
Detta täcker `app/.env.local` automatiskt. Verifiera, men ändra inte.

`app/tsconfig.json` har:
```json
{
  "compilerOptions": { "paths": { "@/*": ["./*"] } },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```
`@/lib/supabase` resolvar till `app/lib/supabase.ts`.

Supabase JS-klient signatur (för referens — full kod i CLAUDE.md Recipe §A):
```ts
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(url, anonKey, {
  auth: {
    storage: <Storage adapter — LargeSecureStore here>,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

TanStack Query v5 + persister signatur (per CLAUDE.md Recipe §B):
```ts
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: ..., gcTime: ... } } });
const persister = createAsyncStoragePersister({ storage: AsyncStorage });
persistQueryClient({ queryClient, persister, maxAge: 1000 * 60 * 60 * 24 }); // 24h per D-08
```

NOTERA: `persistQueryClient` ligger i `@tanstack/react-query-persist-client` (separat paket från `@tanstack/react-query`). Plan 01 installerar BÅDA persister-paketen (Steg 7). Task 2 nedan kör samma `npm install` som idempotent säkerhetsnät — om Plan 01 körts korrekt är det no-op.
</interfaces>
</context>

<scope>
**In scope:**
- Verifiera att `@tanstack/react-query-persist-client` är installerad (Plan 01 Steg 7 lägger den; idempotent re-install i Task 2 om något gått fel)
- Skapa `app/.env.local` (gitignored) med `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` — användaren tillhandahåller värdena via user_setup-checkpoint
- Skapa `app/.env.example` (committad) med placeholder-värden så framtida agenter/utvecklare ser shape:n
- Skapa `app/lib/supabase.ts` per CLAUDE.md Recipe §A med:
  - `LargeSecureStore`-klass (AES-256-krypterad blob i AsyncStorage, nyckel i SecureStore)
  - `createClient`-export med `detectSessionInUrl: false`
  - Runtime-guard: kasta `Error("Missing EXPO_PUBLIC_SUPABASE_URL/KEY")` om env-vars saknas (PITFALLS §2.6 mitigering)
  - `AppState`-listener som startar/stoppar `auth.startAutoRefresh()` (Recipe §A)
  - `phase1ConnectTest()`-funktion (named export) som anropar `from('_phase1_smoke').select('*').limit(0)` och loggar resultatet med `console.log("[phase1-connect-test]", { status, error })` (D-07)
- Skapa `app/lib/query-client.ts` med QueryClient + persister-konfig (AsyncStorage, `maxAge: 1000 * 60 * 60 * 24` = 24h, `staleTime: 30s`, `gcTime: 24h`)
- Ersätt `app/app/_layout.tsx` med full provider-stack:
  - Importera `../global.css` (kvar från Plan 02)
  - Wrap `<Stack/>` i `<QueryClientProvider client={queryClient}>`
  - Sätt upp `focusManager.setEventListener` med AppState-bridge (per Recipe §B)
  - Sätt upp `onlineManager.setEventListener` med NetInfo-bridge (Recipe §B kommenterar den som "Optional in V1" — vi aktiverar den nu per D-06)
  - Anropa `persistQueryClient` på modul-nivå
  - Anropa `phase1ConnectTest()` i `useEffect` (en gång) för att bevisa rundresan
- Mänsklig checkpoint för:
  - Skapa Supabase-projekt om saknas, kopiera URL + anon-nyckel
  - Verifiera att `.env.local` INTE syns i `git status`
  - Verifiera Metro-loggen visar `[phase1-connect-test] { status: ..., error: ... }` med rimliga värden (förväntat: error om "table _phase1_smoke does not exist" eller liknande 404-shape — bevisar nätverk + auth-headers funkar)
- `npm run lint` + `npx tsc --noEmit` rena

**Out of scope (this plan):**
- Riktigt schema, RLS, type-generation — Phase 2
- Auth UI (sign-in/sign-up) — Phase 3
- Riktiga queries mot riktiga tabeller — Phase 2 → 5
- Toggle-UI för dark mode — Phase 7
</scope>

<files_modified>
- `app/.env.local` (NY, gitignored — användaren fyller värdena via checkpoint)
- `app/.env.example` (NY, committad — placeholder-värden)
- `app/lib/supabase.ts` (NY, första filen i `app/lib/`)
- `app/lib/query-client.ts` (NY)
- `app/app/_layout.tsx` (ersätts från Plan 02 minimal-version)
- `app/package.json` + `app/package-lock.json` (uppdateras av npm install i Task 1)
</files_modified>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: User setup — Supabase-projekt + env-vars</name>
  <what-built>
    Inget kod-arbete har skett än. Detta är den enda mänsklig-action-checkpoint Phase 1 har, och den kommer först i denna plan eftersom Task 2-4 alla är beroende av att `.env.local` existerar med riktiga värden.
  </what-built>
  <how-to-verify>
    Användaren behöver utföra följande **i Supabase-dashboarden**, inte i CLI:

    1. Gå till https://supabase.com/dashboard. Logga in med befintligt konto.
    2. Om det inte finns ett projekt: klicka "New project". Välj:
       - Organization: din personliga
       - Name: t.ex. "fitnessmaxxing-dev"
       - Database password: generera och spara i password manager (du kommer inte behöva den i V1, men senare för CLI-migrationer)
       - Region: närmast (för Sverige: Frankfurt eu-central-1, eller Stockholm om tillgänglig)
       - Pricing: Free
       - Klicka "Create new project". Vänta 1-2 minuter tills det är klart.
    3. När projektet är klart: vänster meny → "Project Settings" (kugghjul) → "API".
    4. Kopiera **Project URL** (formatet `https://<ref>.supabase.co`).
    5. Under "Project API keys" → kopiera nyckeln märkt **`anon` `public`**. **INTE service_role.** PITFALLS §2.3: service-role-nyckeln får ALDRIG nå klient-bundeln.

    Returnera dessa två värden till Claude i resume-svaret. Claude kommer skapa `app/.env.local` med dem i Task 2.

    **Säkerhets-påminnelse:** Anon-nyckeln är publik per design (den exponeras till varje användare av appen). Det är RLS som skyddar data — Phase 2 levererar RLS-policys.
  </how-to-verify>
  <resume-signal>
    Returnera båda värdena i exakt formatet:
    ```
    EXPO_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
    EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
    ```
    Eller skriv "blocked: <skäl>" om Supabase-projekt inte kan skapas just nu (Phase 2 är beroende av att projekt finns ändå, så vi behöver lösa detta innan Phase 2).
  </resume-signal>
</task>

<task type="auto">
  <name>Task 2: Installera saknat persist-client-paket + skapa env-filer</name>
  <files>
    app/.env.local
    app/.env.example
    app/package.json
    app/package-lock.json
  </files>
  <action>
    Working dir: `app/`.

    **Installera persist-client (saknades i Plan 01):**
    ```bash
    npm install @tanstack/react-query-persist-client
    ```
    Detta är pure-JS (peer-dep `@tanstack/react-query@^5`), så `npm install` är rätt verktyg.

    **Skapa `app/.env.local`:**
    Använd värdena användaren returnerade i Task 1. Filen ska innehålla EXAKT (med användarens värden):
    ```
    EXPO_PUBLIC_SUPABASE_URL=https://<user-ref>.supabase.co
    EXPO_PUBLIC_SUPABASE_ANON_KEY=<user-anon-key>
    ```
    Inga citattecken runt värdena, ingen trailing whitespace, ingen `export `-prefix (Expo läser dotenv-format direkt).

    **Skapa `app/.env.example`** (denna committas — dokumenterar vilka env-vars projektet förväntar sig):
    ```
    # Public env vars for the Expo client. EXPO_PUBLIC_-prefixet krävs för att Metro
    # ska bunta värdet till klienten. Anon-nyckeln är publik per design — RLS skyddar
    # data. Service-role-nyckeln (om du någonsin har en) får ALDRIG hamna här.
    EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
    EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
    ```

    **Verifiera gitignore-täckning:**
    Kontrollera att `app/.gitignore` redan innehåller `.env*.local` (det gör det per `cat app/.gitignore`-output i kontextet). Om INTE — lägg till raden, men det ska redan finnas.

    Kör sedan `git status` från repo-rot. `app/.env.local` ska INTE dyka upp i listan över ändrade/nya filer. Om den gör det → STOPPA, gitignoren tar inte effekt; diagnostisera (kanske att filen redan är staged sedan tidigare, kör `git rm --cached app/.env.local`).
  </action>
  <verify>
    <automated>
      Working dir: repo-root.
      ```bash
      test -f app/.env.local && grep -q "EXPO_PUBLIC_SUPABASE_URL=https://" app/.env.local && grep -q "EXPO_PUBLIC_SUPABASE_ANON_KEY=" app/.env.local && \
      test -f app/.env.example && \
      ! git ls-files --error-unmatch app/.env.local 2>/dev/null && \
      grep -q "@tanstack/react-query-persist-client" app/package.json && \
      echo OK
      ```
      Förväntat: `OK`. Detta bevisar (1) `.env.local` finns med rätt nycklar, (2) `.env.example` finns, (3) `.env.local` är INTE git-tracked, (4) persist-client-paketet är installerat.
    </automated>
  </verify>
  <done>`.env.local` skapad och gitignored; `.env.example` committed-bar; persist-client installerad.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Skapa lib/supabase.ts med LargeSecureStore + connect-test</name>
  <files>
    app/lib/supabase.ts
  </files>
  <action>
    Working dir: `app/`. Skapa `app/lib/supabase.ts` med exakt nedanstående kod (per CLAUDE.md Critical Recipe §A, utvidgad med D-07 connect-test och PITFALLS §2.6 runtime-guard).

    ```ts
    // app/lib/supabase.ts
    //
    // Supabase-klient med LargeSecureStore-wrapper:
    // - AES-256-krypterad blob lagras i AsyncStorage (no size limit)
    // - 256-bit AES-nyckel lagras i expo-secure-store (2048-byte cap är inget problem för en 32-byte hex-string)
    // Per CLAUDE.md Critical Recipe §A. Se PITFALLS §2.4 för varför ren AsyncStorage inte räcker.

    import "react-native-get-random-values"; // MÅSTE vara FIRST import — polyfill:ar crypto.getRandomValues för aes-js
    import * as aesjs from "aes-js";
    import * as SecureStore from "expo-secure-store";
    import AsyncStorage from "@react-native-async-storage/async-storage";
    import { createClient } from "@supabase/supabase-js";
    import { AppState, Platform } from "react-native";

    // Runtime-guard per PITFALLS §2.6 — fail loudly om env saknas, inte silent.
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        "Missing Supabase env vars. Skapa app/.env.local med " +
          "EXPO_PUBLIC_SUPABASE_URL och EXPO_PUBLIC_SUPABASE_ANON_KEY (se app/.env.example).",
      );
    }

    class LargeSecureStore {
      private async _encrypt(key: string, value: string) {
        const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));
        const cipher = new aesjs.ModeOfOperation.ctr(
          encryptionKey,
          new aesjs.Counter(1),
        );
        const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
        await SecureStore.setItemAsync(
          key,
          aesjs.utils.hex.fromBytes(encryptionKey),
        );
        return aesjs.utils.hex.fromBytes(encryptedBytes);
      }

      private async _decrypt(key: string, value: string) {
        const encryptionKeyHex = await SecureStore.getItemAsync(key);
        if (!encryptionKeyHex) return null;
        const cipher = new aesjs.ModeOfOperation.ctr(
          aesjs.utils.hex.toBytes(encryptionKeyHex),
          new aesjs.Counter(1),
        );
        const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
        return aesjs.utils.utf8.fromBytes(decryptedBytes);
      }

      async getItem(key: string) {
        const encrypted = await AsyncStorage.getItem(key);
        if (!encrypted) return null;
        return await this._decrypt(key, encrypted);
      }

      async setItem(key: string, value: string) {
        const encrypted = await this._encrypt(key, value);
        await AsyncStorage.setItem(key, encrypted);
      }

      async removeItem(key: string) {
        await AsyncStorage.removeItem(key);
        await SecureStore.deleteItemAsync(key);
      }
    }

    export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: new LargeSecureStore(),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // RN har ingen URL-bar
      },
    });

    // Foreground/background handling — auto-refresh bara när appen är aktiv (per Recipe §A).
    AppState.addEventListener("change", (state) => {
      if (Platform.OS === "web") return; // SecureStore finns inte på web; vi är iOS-only ändå
      if (state === "active") supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });

    /**
     * Phase 1 connect-test (D-07). Bevisar funktionellt att klient + nätverk + auth-headers
     * funkar mot riktiga Supabase-endpoint utan att kräva en faktisk tabell.
     *
     * Förväntad utfall: error med kod "PGRST205" eller liknande "table not found"-shape
     * (tabellen `_phase1_smoke` finns inte). Det bevisar att:
     *   1. Network-rundresan funkar
     *   2. Auth-headers (apikey + Authorization) accepteras av Supabase
     *   3. Klient-konfigen är rätt
     *
     * Anropas en gång från app/_layout.tsx i useEffect. Tas bort senast i Phase 2 när
     * riktiga tabeller finns.
     */
    export async function phase1ConnectTest() {
      try {
        const { data, error, status } = await supabase
          .from("_phase1_smoke")
          .select("*")
          .limit(0);
        // eslint-disable-next-line no-console
        console.log("[phase1-connect-test]", {
          ok: status >= 200 && status < 500, // 4xx is also "klient + nätverk funkar"
          status,
          errorCode: error?.code,
          errorMessage: error?.message,
          dataLength: Array.isArray(data) ? data.length : null,
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[phase1-connect-test] FAILED", e);
      }
    }
    ```

    **Designval (D-07 + Claude's Discretion):**
    - Tabellnamnet `_phase1_smoke` (underscore-prefix) konventionellt = "private/non-public" → minskar risken att en framtida riktig tabell heter detta av misstag.
    - `.limit(0)` betyder att även om tabellen mot förmodan skulle finnas, returneras tomt array — ingen data exponeras.
    - Loggar både `status` (HTTP-statuskod) och `errorCode` (PostgREST-kod) så Metro-output entydigt visar att klient + nätverk + headers funkar (status > 0 = nätverket nådde Supabase) även om error returneras.
    - `console.error` om `try/catch` triggas → då är det inte ens en HTTP-rundresa (sannolikt env-vars-fel eller SSL/TLS-fel) — annan diagnos.
  </action>
  <verify>
    <automated>
      Working dir: `app/`. Kör `npx tsc --noEmit` — exit 0 (TS-typerna stämmer för `createClient`, `AppState`, `aes-js`, `crypto.getRandomValues` via polyfill, `expo-secure-store`).
      OCH `grep -q "class LargeSecureStore" lib/supabase.ts && grep -q "phase1ConnectTest" lib/supabase.ts && grep -q "EXPO_PUBLIC_SUPABASE_URL" lib/supabase.ts && grep -q "Missing Supabase env vars" lib/supabase.ts && echo OK` förväntat `OK`.
    </automated>
  </verify>
  <done>`app/lib/supabase.ts` finns med LargeSecureStore + runtime-guard + connect-test; TypeScript-rent.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 4: Skapa lib/query-client.ts + ersätt app/_layout.tsx med provider-stacken</name>
  <files>
    app/lib/query-client.ts
    app/app/_layout.tsx
  </files>
  <action>
    Working dir: `app/`.

    **`app/lib/query-client.ts`** (NY) — separerar QueryClient + persister-konfig från `_layout.tsx` så framtida faser kan importera klienten direkt (t.ex. för att `clear()` vid sign-out i Phase 3):

    ```ts
    // app/lib/query-client.ts
    //
    // Per D-08: TanStack Query persister via @tanstack/query-async-storage-persister + persistQueryClient.
    // Default maxAge: 24h. Phase 4 (offline-kö) och Phase 6 (history offline-cache) ärver detta utan revidering.

    import { QueryClient } from "@tanstack/react-query";
    import { persistQueryClient } from "@tanstack/react-query-persist-client";
    import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
    import AsyncStorage from "@react-native-async-storage/async-storage";

    export const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          // 30s staleTime: rimligt för en personlig app med modesta data-uppdaterings-frekvenser.
          // Phase 4-faser kan finjustera per query om hot path kräver lägre.
          staleTime: 1000 * 30,
          // gcTime ≥ staleTime per CLAUDE.md First-Time-User Gotchas (TanStack Query v5).
          // 24h matchar persister maxAge så cache-poster inte gc:as innan persister läser dem.
          gcTime: 1000 * 60 * 60 * 24,
          // Defaults för retry är OK (3 försök för queries; 0 för mutations) — Phase 4 sätter mutation retry per behov per PITFALLS §5.4.
        },
      },
    });

    const asyncStoragePersister = createAsyncStoragePersister({
      storage: AsyncStorage,
    });

    persistQueryClient({
      queryClient,
      persister: asyncStoragePersister,
      maxAge: 1000 * 60 * 60 * 24, // 24h per D-08
    });
    ```

    **`app/app/_layout.tsx`** (ERSÄTT helt — bygger på Plan 02:s `global.css`-import; lägger till provider-stacken per CLAUDE.md Recipe §B):

    ```tsx
    // app/app/_layout.tsx
    import "../global.css";
    import { useEffect } from "react";
    import { AppState, Platform } from "react-native";
    import { Stack } from "expo-router";
    import {
      QueryClientProvider,
      focusManager,
      onlineManager,
    } from "@tanstack/react-query";
    import NetInfo from "@react-native-community/netinfo";

    import { queryClient } from "@/lib/query-client";
    import { phase1ConnectTest } from "@/lib/supabase";

    // ---- Modul-nivå listeners (per Recipe §B). Sätts en gång när modulen läses. ----

    // Foreground refetch — RN avfyrar inte window.focus, så vi bro:ar AppState
    focusManager.setEventListener((setFocused) => {
      const sub = AppState.addEventListener("change", (s) => {
        if (Platform.OS !== "web") setFocused(s === "active");
      });
      return () => sub.remove();
    });

    // Online detection — krävs för korrekt offline-mutations-kö-beteende från Phase 4 framåt.
    // Per D-06 wirat redan i Phase 1 så senare faser inte behöver röra rooten.
    onlineManager.setEventListener((setOnline) => {
      const unsubscribe = NetInfo.addEventListener((state) => {
        setOnline(!!state.isConnected);
      });
      return unsubscribe;
    });

    export default function RootLayout() {
      // Phase 1 connect-test — körs en gång per app-start. Tas bort i Phase 2.
      useEffect(() => {
        if (__DEV__) {
          phase1ConnectTest();
        }
      }, []);

      return (
        <QueryClientProvider client={queryClient}>
          <Stack />
        </QueryClientProvider>
      );
    }
    ```

    **Designval:**
    - `phase1ConnectTest()` gardad bakom `__DEV__` så den inte körs i ev. produktion-build.
    - `useEffect`-deps är tom-array → en gång per app-start, inte per re-render.
    - `Stack` är fortfarande Expo Router default; ingen `(auth)`/`(app)`-grupp per D-09.
    - Path-alias `@/lib/...` per D-12 (resolverar via `tsconfig.json` → `./*`).
  </action>
  <verify>
    <automated>
      Working dir: `app/`. Kör:
      ```
      grep -q "persistQueryClient" lib/query-client.ts && \
      grep -q "QueryClientProvider" app/_layout.tsx && \
      grep -q "focusManager.setEventListener" app/_layout.tsx && \
      grep -q "onlineManager.setEventListener" app/_layout.tsx && \
      grep -q "phase1ConnectTest" app/_layout.tsx && \
      grep -q "import \"../global.css\"" app/_layout.tsx && \
      npx tsc --noEmit && \
      npm run lint && \
      echo OK
      ```
      Förväntat: `OK`. Detta bevisar (1) persister konfigurerad, (2) provider + båda listeners + connect-test wirade, (3) global.css-import kvar från Plan 02, (4) TS + lint rena.
    </automated>
  </verify>
  <done>QueryClient med persister, _layout.tsx med full Recipe §B-stack + connect-test-anrop; TS + lint rena.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 5: iPhone Expo Go — connect-test + git status + dark mode kvar</name>
  <what-built>
    - `app/.env.local` med EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY (gitignored)
    - `app/.env.example` (committable placeholder)
    - `app/lib/supabase.ts` med LargeSecureStore + runtime-guard + `phase1ConnectTest()`
    - `app/lib/query-client.ts` med QueryClient + persister (AsyncStorage, maxAge 24h)
    - `app/app/_layout.tsx` med QueryClientProvider + focusManager + onlineManager + connect-test-anrop
    - Phase 2 dependency: Supabase-projekt skapat och URL/anon-nyckel kopierade
  </what-built>
  <how-to-verify>
    1. Från `app/`-mappen: `npx expo start --clear`. Vänta tills QR-koden visas.
    2. **Säkerhets-precheck:** I en separat terminal från repo-root, kör `git status`. `app/.env.local` ska INTE finnas med i listan över unstaged/staged-filer. Om den finns → STOPPA, kör `git rm --cached app/.env.local` och verifiera att `app/.gitignore` har `.env*.local`.
    3. **Service-role grep:** Från repo-root, `git grep -n "service_role\|SERVICE_ROLE" app/`. Förväntat: inga matchningar (eller bara docs/kommentarer som omnämner att service-role inte ska användas). En match på en faktisk env-vars-rad eller `createClient`-anrop = T2-läckage, STOPPA.
    4. På iPhone, scanna QR. Vänta 10-30 s tills bundeln laddats.
    5. **Visuell:** Du ska fortfarande se "Hello FitnessMaxxing" från Plan 02 — dark/light fungerar fortfarande (dark mode-konventionen är inte rörd av denna plan).
    6. **Metro-loggen:** Granska terminal-output där `npx expo start` kör. Du ska se en log-rad som börjar med `[phase1-connect-test]`. Innehållet kommer typiskt vara något i stil med:
       ```
       [phase1-connect-test] {
         ok: true,
         status: 404,
         errorCode: 'PGRST205',
         errorMessage: 'Could not find the table \'public._phase1_smoke\' in the schema cache',
         dataLength: null
       }
       ```
       eller status `406` med liknande error. **`status` mellan 200-499 = nätverk + headers funkar.** En `status: 0` eller "FAILED"-prefix = nätverket nådde inte Supabase (kontrollera URL eller wifi).
    7. **Inga unhandled errors:** ingen röd skärm, inga "Missing Supabase env vars"-throws (om så → env-vars laddade inte; verifiera att `.env.local` är i `app/`-roten, inte `app/app/`).
    8. **Foreground refetch test (frivilligt):** stäng appen i bakgrunden på iPhone, vänta 10 s, öppna igen. Metro ska INTE log:a en ny connect-test (useEffect kör bara en gång per session) — men focusManager-listener kommer trigga om det fanns aktiva queries. För Phase 1 räcker det att Metro inte kraschar vid bakgrunds-/foreground-cykeln.

    **Vad bryter mot acceptans (rapportera istället för approved):**
    - "Missing Supabase env vars"-throw vid app-start → `.env.local` laddas inte; verifiera path + Metro restart efter env-ändringar (Metro cachar env-vars; `--clear` fixar)
    - `[phase1-connect-test] FAILED` → klient kunde inte ens göra HTTP-rundresan; URL fel eller nätverk nere
    - Röd skärm vid app-start → granska stack trace i Metro-loggen
    - `git status` visar `app/.env.local` → gitignore tar inte effekt (T1 enforcement-fel — VIKTIGT)
    - Dark-mode konvention från Plan 02 fungerar inte längre → provider-stacken muterade renderingstillståndet (osannolikt men möjligt)
  </how-to-verify>
  <resume-signal>
    Skriv "approved" om alla 8 punkter passerar OCH klistra in den faktiska `[phase1-connect-test]`-log-raden från Metro så vi har bevis i SUMMARY.md.
    Skriv "blocked: <skäl>" annars.
  </resume-signal>
</task>

</tasks>

<verification>
**Plan-nivå-bevis:**

1. **`.env.local` gitignored + env-vars läses i app** (success criteria #4) — Task 5 step 2 + 6 (om env saknades skulle runtime-guard kasta).
2. **Connect-test bevisar Supabase-rundresan** (D-07) — Task 5 step 6 visar `[phase1-connect-test]` i Metro med rimlig status.
3. **LargeSecureStore-wrappern på plats** (T3 mitigerad) — Task 3 verifierar koden; faktisk auth-token-storage testas i Phase 3 men koden är wirad.
4. **Provider-stack komplett per Recipe §B** (D-06) — Task 4 verifierar.
5. **Persister konfigurerad** (D-08) — Task 4 verifierar.
6. **Dark mode-konvention från Plan 02 oförändrad** — Task 5 step 5.

**Maps to ROADMAP success criteria:** #4 (`.env.local` gitignored + env-vars laddas).
</verification>

<threat_model>
**ASVS Level:** 1
**Block on:** high

| ID | Severity | Threat | Affected component | Mitigation | Verification |
|----|----------|--------|--------------------|------------|--------------|
| T1 | high | Supabase anon-nyckel committad via `app/.env.local` (anon-nyckeln är publik per design — inte katastrof, men signalerar slarv och möjliggör targeted attacks mot just detta projekt) | Repo-historiken | `app/.gitignore` innehåller `.env*.local` (verifierat i scaffolden); Task 2 verifierar via `git ls-files --error-unmatch`; Task 5 step 2 verifierar via `git status` | Task 2 automated grep + Task 5 manuell `git status`-check |
| T2 | high | Service-role-nyckel hamnar i `EXPO_PUBLIC_SUPABASE_KEY` eller liknande och bundlas till klienten (= hela DB:n läs/skriv-bart för vem som helst som har bundeln) | Hela klient-bundeln + databasen | `lib/supabase.ts` läser ENDAST `EXPO_PUBLIC_SUPABASE_ANON_KEY`; ingen kod-yta refererar `service_role`; `.env.example` dokumenterar vilken nyckel som hör hemma; Task 1 user-setup-checkpointen är explicit om vilken nyckel som ska kopieras | Task 5 step 3: `git grep -n "service_role\|SERVICE_ROLE" app/` returnerar inga code-matches |
| T3 | high | Supabase JWT-session överskrider expo-secure-store 2048-byte cap → naive SecureStore-wiring kastar → fallback till AsyncStorage = okrypterad token | Auth-storage | LargeSecureStore-wrappern krypterar sessions med AES-256 (nyckel i SecureStore, blob i AsyncStorage). Implementeras i Task 3 per CLAUDE.md Critical Recipe §A, exakt enligt Supabase officiella RN-quickstart pattern | Task 3 verifierar `class LargeSecureStore` finns och `createClient` använder den. Faktisk auth-token round-trip testas i Phase 3 men koden är på plats nu så att första sign-in inte triggas på AsyncStorage av misstag (PITFALLS §2.4) |
| T4 | medium | Auth-token vilar i AsyncStorage i klartext (om LargeSecureStore _decrypt fallar silent, eller någon framtida agent ändrar `storage:` till `AsyncStorage` direkt) | Auth-token at rest | LargeSecureStore krypterar all `setItem`-data innan AsyncStorage.setItem; om SecureStore.getItemAsync returnerar null → `_decrypt` returnerar null → Supabase tolkar som "ingen session" och tvingar nytt sign-in. Faktisk verifikation i Phase 3 där real session skrivs | Phase 3-test: efter sign-in, granska AsyncStorage-innehåll (via Expo dev menu eller `adb logcat`-equivalent) — token ska vara opaque hex (krypterat), inte JSON |
| T10 | low | Connect-test mot riktigt Supabase-projekt skickar onnödiga requests i prod-build | Prod-bundle (V1.1+) | `if (__DEV__) { phase1ConnectTest() }`-guard i `_layout.tsx`; tas bort senast Phase 2 när riktiga queries finns | Task 4 grep-check; manuell granskning av `_layout.tsx` |
| T11 | informational | Dev-only `phase1ConnectTest` exponerar att en `_phase1_smoke`-tabell efterfrågas (via Supabase logs); ingen data-läcka | Supabase-logs | Begränsat till dev; tas bort i Phase 2; ingen PII | N/A |

**Nyckel-kontroll:** alla tre `high`-threats (T1, T2, T3) är mitigerade och verifierade i denna plan. Ingen unmitigated high.
</threat_model>

<success_criteria>
Plan 03 är klar när:
- [x] Supabase-projekt finns och URL + anon-nyckel kopierats
- [x] `app/.env.local` skapad, gitignored (verifierat med `git ls-files`)
- [x] `app/.env.example` committable
- [x] `app/lib/supabase.ts` med LargeSecureStore + runtime-guard + `phase1ConnectTest`
- [x] `app/lib/query-client.ts` med QueryClient + AsyncStorage-persister (24h)
- [x] `app/app/_layout.tsx` med QueryClientProvider + focusManager + onlineManager + connect-test
- [x] iPhone-checkpoint: Metro loggar `[phase1-connect-test]` med rimlig status; ingen röd skärm
- [x] `git grep service_role` returnerar inga code-matches (T2)
- [x] `npm run lint` + `npx tsc --noEmit` båda exit 0
</success_criteria>

<output>
Efter completion, skapa `.planning/phases/01-bootstrap-infra-hardening/01-03-SUMMARY.md`. Inkludera:
- Faktisk `[phase1-connect-test]`-log-rad från Metro (klistrad in från checkpointen)
- Bekräftelse att `.env.local` inte finns i `git status`
- `staleTime`/`gcTime`-värden valda i `query-client.ts` (för traceability)
- Lista över alla 4 nya filer + 1 modifierad (`_layout.tsx`)
- **Phase 1 outcome:** alla 5 ROADMAP success criteria mappade och verifierade
</output>
