# Phase 3: Auth & Persistent Session - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 levererar F1: en användare kan registrera ett konto med email + lösen, logga in, och sessionen överlever app-restart även offline. Efter Phase 3 sitter resten av appen bakom en session-guard, `supabase.auth.getSession()` är källan till sanning för "vem är jag", och Phase 2:s `handle_new_user`-trigger har skapat en `profiles`-rad för varje konto. Phase 4+ kan därefter skriva RLS-skyddade queries med `(select auth.uid())` mot tabellerna utan att tänka på auth-flödet.

**In scope:**
- Skapa route-grupperna `app/app/(auth)/` och `app/app/(app)/` med tomma `_layout.tsx` (gruppen är blank parens-prefix per Expo Router; URL:erna ärver inte gruppnamnet)
- `app/app/(auth)/sign-up.tsx` — RHF + Zod 4-formulär (email + lösen + lösen-bekräftelse), kallar `supabase.auth.signUp(...)`, hanterar Supabase-felkoder inline; lyckad signup landar i `(app)`-gruppen via Zustand-store-uppdatering + guard-redirect
- `app/app/(auth)/sign-in.tsx` — RHF + Zod 4-formulär (email + lösen), kallar `supabase.auth.signInWithPassword(...)`, inline fältfel
- `app/app/(app)/_layout.tsx` — `<Redirect href="/(auth)/sign-in" />` om `session === null`; `<Stack />` annars
- `app/app/_layout.tsx` ändras: `SplashScreen.preventAutoHideAsync()` på modul-nivå, `Stack.Protected guard={!!session}` runt `(app)`-gruppen, `SplashScreen.hideAsync()` triggas när första `getSession()` resolverar (status går från `'loading'` till `'authenticated' | 'anonymous'`)
- `app/lib/auth-store.ts` — Zustand-store som äger `{ session: Session | null, status: 'loading' | 'authenticated' | 'anonymous' }`; modul-nivå `supabase.auth.onAuthStateChange((_event, session) => useAuthStore.setState({ session, status: session ? 'authenticated' : 'anonymous' }))` plus en init-flow som kallar `supabase.auth.getSession()` vid startup
- Sign-out-knapp någonstans temporärt synlig i `(app)`-gruppen (placeholder UI — riktig settings-skärm är V1.1) som kallar `supabase.auth.signOut()` följt av `queryClient.clear()`
- Zod-schemas i `app/lib/schemas/auth.ts` (eller motsvarande): `signUpSchema = z.object({ email: z.string().email(), password: z.string().min(12), confirmPassword: ... }).refine(...)` + `signInSchema = z.object({ email: z.string().email(), password: z.string().min(1) })` (sign-in tillåter äldre kortare lösen rent tekniskt — server avgör)
- Manuell verifiering av success criteria #3 (sign-in → kill app → reopen → session återställd) på riktig iPhone via Expo Go
- Phase 1 D-09:s placeholder-route (`app/app/index.tsx` med smoke-text) flyttas/ersätts: `(app)`-gruppen får sin egen `index.tsx` (eller `(tabs)/index.tsx` om Phase 4-skelettet börjar redan här) — minst ett "Hello {email}" + sign-out-knapp så `(app)` faktiskt går att se efter login

**Out of scope (belongs to later phases):**
- Apple Sign-In (F14) — V1.1, kräver Apple Developer-licens + App Store-blocker
- Email-confirmation deep-link handler (`fitnessmaxxing://auth-callback` + `expo-linking` config) — flippas på i V1.1 när email-confirm-toggeln slås på i Supabase Studio (se "Deferred Ideas")
- Lösen-återställningsflöde (forgot password / reset password) — V1.1
- Settings-skärm med ändra email / ändra lösen / radera konto — V1.1
- Profile-edit UI (sätta `display_name`, ändra `preferred_unit`) — V1.1
- (tabs)-strukturen för (app)-gruppen — Phase 4 (när första riktiga feature byggs)
- Tomt-tillstånds-CTA för "skapa din första plan" — Phase 4 (F2-territorium)
- Sentry / telemetry på auth-fel — V1 polish (Phase 7) eller V1.1
- Refresh-token-revoking edge case ("din session är ogiltig, logga in igen"-UX) — Phase 7 polish om det visar sig hända

</domain>

<decisions>
## Implementation Decisions

### Email confirmation
- **D-01:** Email confirmation = OFF i V1. I Supabase Studio: Authentication → Sign In / Up → Email → "Confirm email" toggle slagen av. `supabase.auth.signUp({ email, password })` returnerar då en session direkt och användaren landar i `(app)` utan email-runda. Matchar ROADMAP success criteria #1 ordagrant + budget-realiteten att enda användaren är du själv.
- **D-02:** V1.1-flippen dokumenteras explicit (se "Deferred Ideas"): slå på Studio-toggeln + skapa `app/app/(auth)/auth-callback.tsx` med `expo-linking`-handler + lägg till `"scheme": "fitnessmaxxing"` i `app.json` + gate `(app)` på `user.email_confirmed_at !== null`. Phase 3 lämnar `app.json scheme` i sitt nuvarande skick (sätts inte preemptively — extra konfig som kan glömmas bort).
- **D-03:** Duplicate-email signup ger inline-fel under email-fältet ("Detta email är redan registrerat — försök logga in"). Ingen upptäcktsknapp eller "byt till sign-in"-redirect — användaren navigerar manuellt via existerande "Logga in"-länk. Generic-error-policy (V2.1.4 ASVS) gäller INTE för signup eftersom email-existens redan exponeras via Supabase-felmeddelandet — inget värde i att gömma det.

### Cold-start session loading & flicker
- **D-04:** `expo-splash-screen.preventAutoHideAsync()` kallas modul-nivå (top of file) i `app/app/_layout.tsx`. `expo-splash-screen` är redan installerat (Expo SDK 54-scaffold + splash-plugin i `app.json`). Splashen pausas tills första session-resolution är klar.
- **D-05:** Splashen göms via `SplashScreen.hideAsync()` när `useAuthStore` flippar `status` från `'loading'` till antingen `'authenticated'` eller `'anonymous'`. Trigger via `useEffect` i `RootLayout` som lyssnar på `useAuthStore(s => s.status)`. Native iOS splash visas tills session är känd → noll flicker.
- **D-06:** Init-flow: vid app-mount kallas `supabase.auth.getSession()` engång (i `auth-store.ts` modul-init eller i en `useEffect` i `RootLayout` — Plan 01 väljer; Claude's Discretion). Resultat skrivs till storen och status flippas. `onAuthStateChange`-listenern fångar alla efterföljande events (sign-in, sign-out, token-refresh).
- **D-07:** Ingen explicit timeout på splash-hold. `getSession()` är ett rent lokalt anrop (LargeSecureStore decrypt, ingen nätverk) och bör resolvera under 100ms i värsta fall. Om LargeSecureStore-decrypten kastar hanterar `auth-store.ts` det genom att sätta `status: 'anonymous'` (rensar troligen även session-blobben + AES-nyckeln för nästa start) — splashen göms ändå. Korrupt-store-recovery utan deluxe-UX är acceptabelt för V1 personlig användning.

### Auth state propagation pattern
- **D-08:** `app/lib/auth-store.ts` är en Zustand-store. Shape: `{ session: Session | null, status: 'loading' | 'authenticated' | 'anonymous', signOut: () => Promise<void> }`. `signOut`-actionen kallar `supabase.auth.signOut()` följt av `queryClient.clear()` (kräver att den importeras från `@/lib/query-client` eller passas in på något sätt — Plan 01 väljer integrationspunkt; Claude's Discretion).
- **D-09:** Modul-nivå `supabase.auth.onAuthStateChange((_event, session) => { ... })` registreras EN gång vid första `import` av `auth-store.ts`. Listener uppdaterar `session` och `status` atomärt via `useAuthStore.setState(...)`. Inga komponenter äger sina egna listeners — alla läser via storen.
- **D-10:** Komponenter använder Zustand-selektorer för att begränsa re-renders: `const userId = useAuthStore(s => s.session?.user.id)`, `const status = useAuthStore(s => s.status)`. Skärmar som inte bryr sig om sessionen importerar inte storen → renderas inte om vid auth-event. Matchar Zustand v5:s React 18 useSyncExternalStore-mönster utan extra konfiguration.
- **D-11:** Phase 1 D-10 deferrade feature-folder-konventionen till Phase 4. Phase 3 placerar därför auth-relaterad logik i `app/lib/` (auth-store) och `app/lib/schemas/` (Zod-schemas), inte i en hypotetisk `app/features/auth/`-mapp. Matchar `app/lib/supabase.ts` + `app/lib/query-client.ts`-konventionen.

### Password validation
- **D-12:** Sign-up Zod-schema kräver `password: z.string().min(12, 'Minst 12 tecken')`. Matchar CLAUDE.md ## Conventions ASVS V2.1.1-baselinen. Ingen complexity-rule (numbers/symbols required) — NIST SP 800-63B avråder explicit och driver mot förutsägbara mönster.
- **D-13:** Sign-in Zod-schema kräver inte `min(12)` — bara `password: z.string().min(1, 'Lösen krävs')`. Detta för att framtida lösen-rotation eller tidigare-test-konton inte ska låsas ute av schemat; servern avgör validering. Phase 3 dokumenterar detta så Phase 4+ inte drift:ar.
- **D-14:** Sign-up `confirmPassword` valideras med `.refine(data => data.password === data.confirmPassword, { message: '...', path: ['confirmPassword'] })`. Standard RHF + Zod-mönster.
- **D-15:** Felmeddelanden är på svenska och inline ("Minst 12 tecken", "Email måste vara giltigt", "Lösen matchar inte", "Detta email är redan registrerat"). Matchar appens primärspråk per PROJECT.md (svensk användare, svensk app).

### Sign-out flow
- **D-16:** Sign-out-actionen i auth-storen: `supabase.auth.signOut()` → `queryClient.clear()` → låt `onAuthStateChange`-listenern uppdatera storen automatiskt. Ingen explicit `router.replace('/(auth)/sign-in')` — guard i `(app)/_layout.tsx` har `<Redirect href="/(auth)/sign-in" />` när `session === null`, vilket händer atomärt när storen uppdateras. Matchar deklarativt rutmönster över imperativ navigation.
- **D-17:** Sign-out-knapp synlig i `(app)`-gruppen (temporär placering — t.ex. i `(app)/index.tsx`) tills Phase 4 bygger riktig settings-yta. Knappen är inte snyggt placerad — den är funktionell. Visar "Sign out" + email under den. Phase 7 polish får göra om.

### Claude's Discretion
- Exakt fil-path för Zod-schemas (`app/lib/schemas/auth.ts` vs `app/lib/auth-schemas.ts` vs `app/lib/auth/schemas.ts`) — välj det som ligger nära `supabase.ts` och inte konfliktrar med Phase 4:s schema-tillägg.
- Var splash-hide-effekten triggas (i `RootLayout`-komponenten via `useEffect` på `auth-store`-status, eller direkt i `auth-store.ts`-init när `getSession()` resolverar) — välj det som inte införlivar React-import i `auth-store.ts`.
- Hur `queryClient.clear()` integreras i `auth-store.ts` sign-out-actionen — direktimport från `@/lib/query-client` är enklast (cirkulär-dep-risk minimal eftersom query-client inte importerar auth-store), men Plan 01 verifierar.
- Layout-detaljer för `(auth)/sign-up.tsx` och `(auth)/sign-in.tsx` (TextInput-styling, knapparrangemang, navigation mellan skärmarna) — NativeWind-klasser med dark-mode-stöd per F15-konventionen från Phase 1; rendering måste klara båda lägen ut-ur-boxen.
- Exakt RHF-konfiguration (`mode: 'onBlur'` vs `'onChange'` vs `'onSubmit'`) — välj det som bäst tjänar UX (`onBlur` är vanligast för auth-formulär: fältfel visas när användaren lämnar fältet, inte vid varje tangenttryckning).
- Var sign-out-knappen placeras i `(app)`-gruppen i V1 (top-right header-knapp, bottom of `(app)/index.tsx`, etc.) — funktionell, inte permanent placering.
- Om Phase 3 också skapar `(app)/(tabs)/_layout.tsx`-skelettet eller om det väntar till Phase 4 — om det är trivialt, gör det; om det drar in tabs-design måste det vänta. Phase 3 levererar minst `(app)/_layout.tsx` + `(app)/index.tsx` (eller `(app)/(tabs)/index.tsx`).
- Vilket NetInfo-tillstånd som ska visas under sign-up/sign-in om enheten är offline (banner, inline-meddelande, eller ingenting) — phase 4 äger offline-banner-konventionen, så Phase 3 antingen lånar samma mönster eller punt:ar med ett enkelt fel ("Ingen anslutning"). Plan 01 väljer.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 3 requirement & architecture authority
- `PRD.md` §F1 — Användarregistrering med email + lösen; acceptans (signup → email verification → log in → session persistens efter app-omstart) — Phase 3 implementerar med email-confirmation OFF i V1 per D-01
- `ARCHITECTURE.md` §6 Autentisering — email/lösen i V1, Apple Sign-In V1.1, session i SecureStore (LargeSecureStore-implementationen), auto-refresh JWT
- `ARCHITECTURE.md` §8 Säkerhet — RLS som primärt skydd, anon-key OK i klient, service-role aldrig i klient (relevant för Phase 3 endast som påminnelse — Phase 3 introducerar inga nya secrets)
- `ARCHITECTURE.md` §10 Beslutsregister — Supabase + RLS lock-in, Expo + TypeScript-stack
- `.planning/REQUIREMENTS.md` — F1 traceability (Phase 3 → Auth & Persistent Session)
- `.planning/ROADMAP.md` Phase 3 — Success criteria #1–#5 (register lands i (app), Zod inline-fel, kill+reopen session-restore, sign-out → queryClient.clear, Stack.Protected guard utan flicker)

### Phase 3 implementation pitfalls (load-bearing)
- `.planning/research/PITFALLS.md` §2.4 — Why `LargeSecureStore` (SecureStore 2048-byte limit + JWT > 2048 byte) — Phase 1 wirade redan; Phase 3 förlitar sig på det utan ändring
- `.planning/research/PITFALLS.md` §2.6 — Hardcoded URL/key in source — Phase 3 introducerar inga nya env-vars; befintliga `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` används
- `.planning/research/PITFALLS.md` §3.x — TypeScript-best-practices (relevanta för RHF + Zod-typsäkerhet)

### Phase 1 + Phase 2 inheritance (CRITICAL — auth-flow byggs PÅ deras output)
- `.planning/phases/01-bootstrap-infra-hardening/01-CONTEXT.md` D-07 — `app/lib/supabase.ts` med `LargeSecureStore`-wrapper, `autoRefreshToken: true`, `persistSession: true` — Phase 3 lägger inte till någonting i den filen; den är redan auth-redo
- `.planning/phases/01-bootstrap-infra-hardening/01-CONTEXT.md` D-09 — `(auth)`/`(app)`-grupperna deferrades till Phase 3; Phase 3 skapar dem nu
- `.planning/phases/01-bootstrap-infra-hardening/01-CONTEXT.md` D-10 — Feature-folder-konventionen deferrad till Phase 4 → Phase 3 placerar auth-kod i `app/lib/`
- `.planning/phases/01-bootstrap-infra-hardening/01-CONTEXT.md` ## Conventions (smoke-test screen) — Phase 3 ersätter `app/app/index.tsx`-smoke-text med `(app)`-gruppens första skärm; `headerShown: false` på root-Stack:en behålls
- `.planning/phases/02-schema-rls-type-generation/02-CONTEXT.md` D-15/D-16/D-17 — `handle_new_user`-trigger körs på `auth.users` insert och skapar `profiles`-rad med `id` + `preferred_unit='kg'` + `display_name=NULL` — Phase 3 förlitar sig på detta; ingen klient-side `profiles INSERT` behövs efter signup
- `.planning/phases/02-schema-rls-type-generation/02-CONTEXT.md` D-04/D-05 — `createClient<Database>(...)` i `app/lib/supabase.ts` är redan typed; Phase 3 ärver typsäkra `Session`-typer

### Project conventions (etablerade tidigare)
- `CLAUDE.md` ## Conventions → Navigation header & status bar (Phase 1) — `headerShown: false` på root, opt headers per skärm; `<StatusBar style="auto" />`. Phase 3:s sign-up/sign-in-skärmar bör inte introducera headers; navigation mellan dem sker via in-screen-länkar.
- `CLAUDE.md` ## Conventions → Database conventions (Phase 2) — informativ för auth-flödet (RLS-policies kommer kicka in när `(app)`-skärmar börjar göra `.from()`-queries i Phase 4)
- `CLAUDE.md` ## Conventions → Security conventions → Phase-specific checklists → Auth phase (Phase 3 — F1) — API2 (auth) + V2.1.1 (lösen ≥12 chars) + V3 (session management) + deep-link handling (M4) — D-12 + D-01 + D-02 svarar mot dessa

### Stack reference
- `CLAUDE.md` ### Backend & Auth — `@supabase/supabase-js@^2.105.3`, `expo-secure-store@~14.0.1`, `aes-js`, `react-native-get-random-values` — alla redan installerade i Phase 1
- `CLAUDE.md` ### State & Data — `react-hook-form@^7.75.0`, `@hookform/resolvers@^5.2.2`, `zod@^4.4.3`, `zustand@^5.0.13` — alla redan installerade
- `CLAUDE.md` First-Time-User Gotchas → `react-hook-form 7 + Zod 4 + @hookform/resolvers 5` — `zodResolver` import-path, RHF + Zod 4-integration

### Source-of-truth diff target (vad Phase 3 modifierar)
- `app/app/_layout.tsx` (nuvarande Phase 1-form) — splash-screen-hold + Stack.Protected guard adderas
- `app/app/index.tsx` (nuvarande smoke-test-form) — flyttas in i `(app)`-gruppen och blir startsidan efter login
- `app/lib/supabase.ts` (nuvarande Phase 2-form) — INGEN ÄNDRING; Phase 3 importerar `supabase` och `Session`-typer som är
- `app/lib/query-client.ts` (nuvarande Phase 1-form) — möjligen importeras av `auth-store.ts` för `queryClient.clear()`-anrop; ingen ändring i query-client.ts självt

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`app/lib/supabase.ts`** (Phase 1+2) — Typed `createClient<Database>(supabaseUrl, supabaseAnonKey, { auth: { storage: new LargeSecureStore(), autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } })`. Phase 3 importerar `supabase` direkt och kallar `supabase.auth.signUp/signInWithPassword/signOut/onAuthStateChange/getSession`. AppState-listener för start/stopAutoRefresh wirad redan på rad 83–87 — Phase 3 rör den inte.
- **`app/lib/query-client.ts`** (Phase 1) — `QueryClient`-instans exporterad. Phase 3:s sign-out-flow importerar och kallar `queryClient.clear()`.
- **`app/app/_layout.tsx`** (Phase 1) — `<QueryClientProvider client={queryClient}><Stack screenOptions={{ headerShown: false }} /><StatusBar style="auto" /></QueryClientProvider>`. Phase 3 wrappar `<Stack />` med splash-screen-hold-logik och `Stack.Protected` guard runt `(app)`-gruppen.
- **`app/app/index.tsx`** (Phase 1 smoke-test) — Flyttas in i `(app)`-gruppen som startsidan efter login (eller ersätts om Phase 3 också börjar `(tabs)`-skelettet).
- **`expo-splash-screen` (i Expo SDK 54)** — Redan installerat och konfigurerat via `app.json`-plugin. Phase 3 kallar `SplashScreen.preventAutoHideAsync()` + `SplashScreen.hideAsync()` utan att lägga till nya pakets-deps.
- **NativeWind dark-mode-konvention** (Phase 1 etablerad) — `bg-white dark:bg-gray-900`, `text-blue-500 dark:text-blue-300`-mönstret. Phase 3:s sign-up/sign-in-skärmar måste fungera i båda lägen ut-ur-boxen.

### Established Patterns
- **Inre Expo-projekt under `app/`-subdir.** Per Phase 1 D-01: alla Expo-kommandon körs från `app/` cwd. Phase 3-planer måste vara explicita om `cd app/` när nya skärmar testas (`expo start`).
- **Path-alias `@/*` → `./*`.** Phase 3 använder `@/lib/auth-store`, `@/lib/supabase`, `@/lib/query-client`, `@/lib/schemas/auth` (eller motsvarande).
- **`headerShown: false` på root-Stack** (Phase 1 D-13 motsvarande, dokumenterad i CLAUDE.md ## Conventions). Phase 3:s `(auth)`- och `(app)`-grupp-layouts ärver detta; vill man ha header per skärm opt-in:as det.
- **Runtime env-var-guard** (Phase 1-mönster i `supabase.ts`). Phase 3 introducerar inga nya env-vars; samma mönster fortsätter.
- **TanStack-persister + AsyncStorage** (Phase 1 D-08). Phase 3:s `queryClient.clear()` på sign-out rensar BÅDE in-memory-cachen OCH den persisterade AsyncStorage-cachen — viktigt för "per-user cache" (success criterion #4).

### Integration Points
- **New: `app/app/(auth)/_layout.tsx`** — `<Stack screenOptions={{ headerShown: false }} />` (eller med valbar header för "Logga in"-titeln). Första route-grupp.
- **New: `app/app/(auth)/sign-up.tsx`** — RHF + Zod-formulär, `supabase.auth.signUp()`-anrop, navigation-länk till sign-in.
- **New: `app/app/(auth)/sign-in.tsx`** — RHF + Zod-formulär, `supabase.auth.signInWithPassword()`-anrop, navigation-länk till sign-up.
- **New: `app/app/(app)/_layout.tsx`** — `<Redirect href="/(auth)/sign-in" />` om session saknas, annars `<Stack />`. Andra route-grupp.
- **New: `app/app/(app)/index.tsx`** (eller `(app)/(tabs)/index.tsx`) — temporär post-login-startsida med "Hello {email}" + sign-out-knapp.
- **New: `app/lib/auth-store.ts`** — Zustand-store + `onAuthStateChange`-listener + init-flow.
- **New: `app/lib/schemas/auth.ts`** (eller motsvarande Phase 4-kompatibel placering) — Zod-schemas för sign-up + sign-in-formulär.
- **Modified: `app/app/_layout.tsx`** — Splash-screen-hold + Stack.Protected guard.
- **Modified: `app/app/index.tsx`** — Flyttas in i `(app)`-gruppen eller raderas (beror på Phase 3:s val av `(tabs)`-skelett-tidpunkt).

</code_context>

<specifics>
## Specific Ideas

- **Felmeddelanden på svenska, inline.** "Email måste vara giltigt", "Minst 12 tecken", "Lösen matchar inte", "Detta email är redan registrerat", "Fel email eller lösen" — kort + handlingsbart. RHF + Zod ger automatisk fält-fokus + felvisning.
- **Sign-out-knapp i `(app)`-gruppen är temporär placeholder.** Riktig settings-yta är V1.1. Knappen i V1 är funktionell + ful — det räcker. Förmodligen bottom of `(app)/index.tsx` med ett "Sign out (provisional)"-meddelande så framtida-jag inte glömmer ersätta.
- **Splash-hold-trigger via Zustand-status-flip.** `useEffect(() => { if (status !== 'loading') SplashScreen.hideAsync(); }, [status])` i `RootLayout`. Inget Promise-race, inget timeout — låt status-flippen vara den enda triggern.
- **Inget app.json-scheme i Phase 3.** Det är V1.1-arbete (deep-link-handler för email-confirm). Att sätta scheme preemptively bjuder på senare confusion när någon undrar varför scheme finns men ingen handler.
- **Ingen Test-konto-seedning i Phase 3.** Phase 2 RLS-test seedar test-användare via service-role; Phase 3:s manuella verifiering sker med riktig sign-up-flow på iPhone. Att ha Phase 3-flow:n parallellt med RLS-test-användarna är OK men de blandas inte.

</specifics>

<deferred>
## Deferred Ideas

- **Email-confirmation deep-link-flow** — V1.1. Wiring: (a) slå på "Confirm email" i Supabase Studio Authentication-settings, (b) lägg `"scheme": "fitnessmaxxing"` i `app.json`, (c) skapa `app/app/(auth)/auth-callback.tsx` med `expo-linking`-handler som kallar `supabase.auth.exchangeCodeForSession(...)`, (d) gate `(app)/_layout.tsx`-redirect på både `session !== null` OCH `user.email_confirmed_at !== null`, (e) visa "Verifying email..." splash medan callback-tokenutbyte pågår. Hela paketet är ~1 dags arbete och skjuts till V1.1 när App Store-banan blir aktuell.
- **Apple Sign-In (F14)** — V1.1. Kräver Apple Developer-licens + `expo-apple-authentication` + Supabase-side OAuth provider-config. Komplett flow är dokumenterad i Supabase docs men inte nödvändig för personlig V1.
- **Lösen-återställning (forgot password)** — V1.1. `supabase.auth.resetPasswordForEmail(...)` + en `(auth)/reset-password.tsx`-skärm som tar emot deep-link-koden + en `(auth)/forgot-password.tsx`-skärm som triggar mailet. För personlig V1 kan kontot återskapas via Supabase Studio admin om det skulle behövas.
- **Settings-skärm: ändra email, ändra lösen, radera konto** — V1.1. Inga av dessa är nödvändiga för "logga ett pass och se senaste värdet"-flow:n.
- **Profile-edit UI** — V1.1. `display_name` och `preferred_unit` finns i schemat men exponeras inte i UI förrän senare.
- **Sentry / Crashlytics-style telemetry på auth-fel** — V1 polish (Phase 7) eller V1.1. Phase 3 loggar auth-fel via `console.error` för dev-debugging.
- **Refresh-token-revoking edge case** — Om Supabase senare revokar tokens (admin force-logout, password change från annan enhet) ska klienten visa "Din session är ogiltig — logga in igen". Phase 7 polish om det visar sig hända i praktiken.
- **Rate limiting på sign-in-attempts** — Supabase har platform-side rate limiting; klient-side throttling deferras till V1.1 om det visar sig nödvändigt.
- **NetInfo-driven offline-banner i `(auth)`-gruppen** — Phase 4 äger offline-banner-konventionen för `(app)`-gruppen; Phase 3 antingen lånar mönstret eller visar bara ett enkelt fel om sign-up/sign-in görs offline.
- **Zustand devtools/persist middleware på auth-store** — Inte nödvändigt eftersom session redan persisteras via `LargeSecureStore` i Supabase-klienten. Att lägga till persist i Zustand-storen vore dubbel persistens.

### Reviewed Todos (not folded)
None — STATE.md "Pending Todos" var tom.

</deferred>

---

*Phase: 3-auth-persistent-session*
*Context gathered: 2026-05-09*
