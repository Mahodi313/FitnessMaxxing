# Phase 7: V1 Polish Cut - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 7 levererar **F11 (inline RPE-input + RPE-visning i history)**, **F12 (pass-anteckning capture i AvslutaOverlay + visning/redigering i history-detail)**, och **F15 (manuell Tema-toggle: System / Ljust / Mörkt, AsyncStorage-persisterad, omedelbar applicering utan restart)**, plus en **core-flow ≤2 min UAT-gate** som öppnar 4-veckors personlig soak-validering.

Sista UI-tråden i V1. Inget schema (alla kolumner finns sen Phase 2: `exercise_sets.rpe numeric(3,1)`, `exercise_sets.notes text`, `workout_sessions.notes text`). Inga nya offline-mönster (TanStack persister + AsyncStorage från Phase 4 hydrerar automatiskt). Endast UI + en ny mutation-hook (`useUpdateSessionNotes`).

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**6 requirements are locked.** See `07-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `07-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- F11 inline RPE-fält på workout-screen + RPE-visning i session-history
- F12 pass-anteckning i AvslutaOverlay + visning/redigering i session-history
- F15 manuell tema-toggle (System/Ljust/Mörkt) i Settings + AsyncStorage-persistens + omedelbar applicering utan restart
- Core-flow ≤2 min UAT-mätning
- Phase-level closeout (gsd-secure-phase 7 + gsd-verify-work 7) → V1 cut → 4-veckors soak start

**Out of scope (from SPEC.md):**
- Per-set anteckningar UI (`exercise_sets.notes`-kolumnen) — PRD F12 säger ordagrant "per pass"; per-set kvar för V1.1
- RPE i F10-chart-routens "Senaste 10 passen"-rader — kvar för V1.1
- RPE under tap-to-edit-läget på redan loggat set — V1.1 polish
- F14 Apple Sign-In, F17-UI set-typ-toggling, F18 PR-detection, F19 vilo-timer — V1.1 per ROADMAP
- F1.1 email-confirmation deep-link handler — V1.1 per Phase 3 UAT
- App Store-launch prep — V2
- Schema-migreringar — Phase 2 har redan landat rpe + notes-kolumnerna
- AsyncStorage-failure-recovery UI — vid read-fel default till "System" tyst (loggas men ej surfaceas)

</spec_lock>

<decisions>
## Implementation Decisions

### F15 — Tema-toggle propagation (4 lockings)

- **D-T1:** Use **NativeWind 4 `useColorScheme()` from `'nativewind'`** (returnerar `{ colorScheme, setColorScheme }`) som single source of truth för temat. `setColorScheme('system' | 'light' | 'dark')` flippar root-klassen `dark` omedelbart (NativeWind class-mode etablerad i `app/tailwind.config.js:9` `darkMode:'class'`) → alla `dark:`-varianter reagerar utan extra wire-up. Ingen ny Zustand-store, ingen custom ThemeContext.
- **D-T2:** AsyncStorage('fm:theme')-läsning sker inuti **splash-gate** — en effect i nytt `<ThemeBootstrap />`-komponent (eller utvidgad `SplashScreenController`) som anropar `AsyncStorage.getItem('fm:theme')` → parse till `'system' | 'light' | 'dark'` → `setColorScheme(stored)` **INNAN** `SplashScreen.hideAsync()` triggas av `status !== 'loading'`. Splash täcker första rendern → ingen FOUC. Default = `'system'` vid läsfel eller saknad nyckel (SPEC accepted-risk: tyst loggning till console.warn, ingen UI).
- **D-T3:** `<StatusBar />` i `app/app/_layout.tsx:156` byts från `style="auto"` till dynamiskt `style={isDark ? 'light' : 'dark'}` där `isDark` kommer från `nativewind`-imported `useColorScheme().colorScheme === 'dark'` (reflekterar manuell override). Garanterar synlig ikon-färg under alla 9 kombinationer (3 user-lägen × iOS Auto/Ljust/Mörkt).
- **D-T4:** **Migrera alla 11 filer** från `import { useColorScheme } from 'react-native'` → `from 'nativewind'` i en atomic commit. Lista (verifierad via `grep -l 'from "react-native"' app | xargs grep -l useColorScheme`):
  1. `app/app/_layout.tsx`
  2. `app/app/(app)/_layout.tsx`
  3. `app/app/(app)/(tabs)/_layout.tsx`
  4. `app/app/(app)/(tabs)/index.tsx`
  5. `app/app/(app)/(tabs)/history.tsx`
  6. `app/app/(app)/plans/[id].tsx`
  7. `app/app/(app)/plans/[id]/exercise-picker.tsx`
  8. `app/app/(app)/history/[sessionId].tsx`
  9. `app/app/(app)/exercise/[exerciseId]/chart.tsx`
  10. `app/components/active-session-banner.tsx`
  11. (verifiera via grep i Plan 07-01 i fall någon ny fil tillkommit) — `app/scripts/manual-test-phase-06-uat.md` är dokumentation, inte runtime
  
  Drop-in API (NativeWind:s hook returnerar samma shape som RN:s när bara `.colorScheme` läses). Garanterar att non-className-styling (Skia chart-accent i `chart.tsx`, SegmentedControl shadow-color, root Stack `contentStyle.backgroundColor`, ActiveSessionBanner accent, history-detail icon-tint, plans/[id] chart-icon-tint) reagerar på manuell override.

### F11 — RPE-inline-input UX (4 lockings)

- **D-R1:** **Layout:** RPE-fältet får fixed-width `w-16` (64pt); Vikt + Reps behåller `flex-1`; Klart-knappen krymper från `w-20` (80pt) → `w-16` (64pt) för att rymmas på iPhone SE-bredd (320pt content). Klart förblir ≥44pt tap-target via `min-h-[56px]` (oförändrat). RPE max 4 tecken (`8.5`, `10`, `10.0`) → 64pt räcker visuellt med `text-base font-semibold`.
- **D-R2:** **Schema:** `setFormSchema.rpe` (i `app/lib/schemas/sets.ts:62-63`) sträcks från `z.coerce.number().nullable().optional()` till:
  ```ts
  rpe: z.preprocess(
    /* D-R3 kombinerad preprocess */,
    z.coerce.number()
      .min(0, { error: "RPE 0 eller högre" })
      .max(10, { error: "RPE 10 eller lägre" })
      .nullable()
      .optional(),
  ),
  ```
  Följer weight_kg-precedensen (Plan 05-06 / FIT-9 — comma→period). SPEC §1 acceptance (c) + (d) kräver 0-10-bound + decimaltal.
- **D-R3:** **Empty-handling:** Kombinerad preprocess inom samma block:
  ```ts
  (v) => {
    if (typeof v !== "string") return v;
    const trimmed = v.trim();
    if (trimmed === "") return null;
    return trimmed.replace(/,/g, ".");
  }
  ```
  Tom/whitespace input → `null` FÖRE coerce → `.nullable()` accepterar → `set.rpe = null` (SPEC §1 acceptance (a)). Ifyllt värde processas normalt (comma → period). Multi-comma "8,5,5" → "8.5.5" → NaN → schema rejects (samma som weight_kg).
- **D-R4:** **Visuell signal:** Placeholder = `"RPE"` (kort, 64pt-bredd-säker). Inline-error renderas under fältet med samma Controller-pattern som Vikt/Reps (`text-base text-red-600 dark:text-red-400 mt-1 px-1`, `accessibilityLiveRegion="polite"`). "Valfri"-signal via default placeholder-color `#9CA3AF` (already in code) + inget asterisk-required. accessibilityLabel = `"Upplevd ansträngning, valfri"` eller liknande svenskt.

### F12 — Pass-anteckning capture i AvslutaOverlay (4 lockings)

- **D-N1:** **TextInput-placering:** Inom det inre dialog-cardet i `AvslutaOverlay` (`workout/[sessionId].tsx:876-913`) — mellan body-`<Text>` och knapparnas `<View className="flex-row gap-3">`. Card-strukturen (`gap:16`) absorberar den nya raden naturligt. Hela overlay-cardet wrappas i `<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>` så iOS-keyboard inte täcker knapparna på iPhone SE. Backdrop-tap-dismiss bevaras (Phase 5 WR-05); inner `<Pressable onPress={(e) => e.stopPropagation()}>` förhindrar oavsiktlig dismiss vid tap-i-textfält.
- **D-N2:** **TextInput-shape:** `<TextInput multiline numberOfLines={3} style={{ minHeight: 80, maxHeight: 160 }} maxLength={500} />` + autogrow inom intervallet. Placeholder = `"Anteckningar (valfri)"`. 500-tecken-counter `{notes.length}/500` ALLTID synlig under TextInput med `className="text-sm text-gray-500 dark:text-gray-400 text-right mt-1"` _(Revised 2026-05-15 per UI-SPEC revision 1 commit `c665fb2` — was `text-xs`; bumped to `text-sm` for readability at the 480/500 warning threshold)_; växlar till `text-red-600 dark:text-red-400` när `length > 480` (warning) — `maxLength={500}` hindrar att rejected-fall ens uppstår på client-side, men schema-rejection är fortsatt server-side safety net.
- **D-N3:** **Wire-up:** Utvidga `useFinishSession`-mutation i `app/lib/queries/sessions.ts` med `notes: string | null` på payload-typen. QueryFn skickar `supabase.from('workout_sessions').update({ finished_at, notes }).eq('id', id)`. Tom string normaliseras till `null` inom mutationen: `const finalNotes = notes?.trim() ? notes.trim() : null;`. Optimistic onMutate i `lib/query/client.ts` `setMutationDefaults(['session','finish'], ...)` uppdaterar `sessionsKeys.detail(id)` cache med `{ finished_at, notes: finalNotes }` (oförändrad i andra paths). Ingen ny mutation-hook → ingen ny scope.id-binding → offline-replay-ordning oförändrad.
- **D-N4:** **State-management:** Notes-input via lokal `useState<string>('')` inom `AvslutaOverlay`-komponenten. Backdrop-tap eller "Fortsätt"-knappen → `onCancel()` → `setShowAvslutaOverlay(false)`; lokal state nollställs av befintlig `useFocusEffect`-cleanup (Phase 4 commit `af6930c`) — eller en explicit `useEffect(() => () => setNotes(''), [])` i overlay-komponenten. Ingen "förkasta-anteckning?"-confirm; matchar Phase 5 WR-05 "Avsluta-during-workout är recoverable". Re-open av overlay efter cancel = fresh empty state.

### F12 — Pass-anteckning edit i history-detail (4 lockings)

- **D-E1:** **Affordance:** Två lägen i ett notes-block:
  - När `session.notes IS NOT NULL`: render `<Pressable onPress={openEditOverlay} className="flex-row items-start gap-2">` med text + `<Ionicons name="pencil-outline" size={18} color={muted} />` högerjusterad.
  - När `session.notes IS NULL`: render `<Pressable onPress={openEditOverlay} className="flex-row items-center gap-2">` med `<Ionicons name="add-circle-outline" size={18} color={accent} />` + `<Text>` `"Lägg till anteckning"` (svenskt, gray-500 dark:gray-400).
  
  Båda öppnar samma inline-overlay (D-E2). Discoverable + en tap till edit. Matchar Strong/Hevy/Fitbod App Store-standard.
- **D-E2:** **Edit-overlay-struktur:** Återanvänd Phase 4 inline-overlay-pattern (commit `e07029a`, see existing delete-confirm i `history/[sessionId].tsx`) — centrerad, backdrop-`<Pressable>` med `rgba(0,0,0,0.5)` och `<Pressable onPress={(e) => e.stopPropagation()}>` runt cardet (`bg-gray-100 dark:bg-gray-800 rounded-2xl p-6`, `gap:16`). Innehåll:
  - Title `<Text>` `"Redigera anteckning"` (header-styling)
  - TextInput (samma shape som D-N2: multiline, minHeight=80, maxHeight=160, maxLength=500, counter)
  - Knappar: `[Avbryt (gray-200)] [Spara (blue-600)]`
  
  `<KeyboardAvoidingView behavior="padding">`-wrap (D-N1-precedent). Tom-text-spara → `notes = null` (SPEC §4 acceptance (c)). På samma sätt nollställs lokal state av `useFocusEffect`-cleanup på blur.
- **D-E3:** **Ny resource-hook `useUpdateSessionNotes(sessionId)`:** Tillägg i `app/lib/queries/sessions.ts`. mutationKey = `['session','update-notes']`. scope.id = `session:${sessionId}` (matchar D-N3-finish-session-scope så update-mutationer serializeras efter eventuell ofullbordad finish-mutation under offline-replay). 14:e `setMutationDefaults`-key i `app/lib/query/client.ts`:
  - **mutationFn:** `supabase.from('workout_sessions').update({ notes: payload.notes }).eq('id', sessionId)`
  - **onMutate:** snapshot detail-cache `sessionsKeys.detail(id)` + optimistic `setQueryData({ ...prev, notes: payload.notes })` + return `{ previous }`
  - **onError:** rollback `setQueryData(prev.previous)`
  - **onSettled:** `invalidateQueries({ queryKey: sessionsKeys.listInfinite() })` — list-row kan visa notes-snippet i framtiden (V1.1) men invalidate håller cache konsistent oavsett
  
  mutate-not-mutateAsync per Phase 4 commit `5d953b6`. Hook signatur: `useUpdateSessionNotes(sessionId: string): UseMutationResult<...>`.
- **D-E4:** **Notes-block-rendering:** Per SPEC §4 ("ovanför SummaryHeader-chiparna"). Visuellt:
  ```tsx
  <View className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3 mx-4 mt-2 flex-row items-start gap-2">
    {notes ? (
      <>
        <Text className="flex-1 text-base text-gray-900 dark:text-gray-50">{notes}</Text>
        <Pressable onPress={openEdit} hitSlop={8}>
          <Ionicons name="pencil-outline" size={18} color={muted} />
        </Pressable>
      </>
    ) : (
      <Pressable onPress={openEdit} className="flex-row items-center gap-2 flex-1" hitSlop={8}>
        <Ionicons name="add-circle-outline" size={18} color={accent} />
        <Text className="text-base text-gray-500 dark:text-gray-400">Lägg till anteckning</Text>
      </Pressable>
    )}
  </View>
  ```
  Notes-text expanderas naturligt (ingen "visa mer"-toggle i V1; 500-tecken-max gör att text aldrig blir orimligt lång). Färger via `useColorScheme()` (post-D-T4 från nativewind).

### Claude's Discretion

- **Exakt placering av AsyncStorage-läsning i splash-gate** — `<ThemeBootstrap />` som ny sibling under `<PersistQueryClientProvider>` ELLER inom `SplashScreenController` ELLER en module-side IIFE i ny `app/lib/theme.ts`. Planner väljer baserat på minst-render-impact + cleanest module-load-order (NativeWind setColorScheme kan teoretiskt köras före Provider mountar — verifiera).
- **Exakt `setMutationDefaults`-onMutate-shape för `['session','update-notes']`** — direct `setQueryData` på detail OR funktion-form med previous-merge. Planner väljer per Phase 4/5 13 existing-keys-precedens (sannolikt direct-setQueryData med return-previous för rollback).
- **AAA-kontrast på 500-tecken-counter-warning-färg** — `text-red-600 dark:text-red-400` är AAA mot `bg-gray-100 dark:bg-gray-800` men verifiera kontrast-ratio med tooling om Phase 7 UI-review körs (06-UI-REVIEW-style audit).
- **autoFocus på edit-overlay TextInput** — om TRUE öppnar keyboard direkt vid tap på pencil. Bättre UX men kan kollidera med KeyboardAvoidingView-mount-timing. Planner verifierar; default = TRUE om iOS-rendering är stabilt.
- **Add-affordance "+ Lägg till anteckning" copy** — exakt svenskt formulär; alternativ "Skriv en anteckning" / "Lägg till kommentar". Planner/UI-SPEC väljer.
- **`useFocusEffect`-cleanup-pattern för 3 nya state-bitar** (showAvslutaOverlay-notes-state, showEditNotesOverlay-state, notes-draft-text-state) — slå ihop i existing `useFocusEffect` eller separate per concern. Planner väljer per existing convention.
- **Migration-commit-order för D-T4** — commit-1 = renamings, commit-2 = ThemeProvider+setColorScheme-anrop. Eller en kombinerad. Planner väljer per atomic-commit-konvention.
- **`useUpdateSessionNotes`-replay vid offline-edit som overlap:ar med `useDeleteSession` på samma session** — om user offline-edit + offline-delete samma session, vilken vinner? scope.id `session:${id}` ger FIFO inom scope; planner verifierar att delete-after-update raderar både rows + cancel:ar update-mutation.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 7 requirement & spec authority (CRITICAL — locked requirements)
- `.planning/phases/07-v1-polish-cut/07-SPEC.md` — 6 locked requirements (F11 RPE-input + history-visning, F12 capture + edit i history, F15 tema-toggle 3-läges, core-flow ≤2 min UAT), 19 acceptance-rader, ambiguity 0.13 (gate ≤0.20). **Locked requirements — MUST read before planning.**
- `PRD.md` §F11, §F12, §F15 — V1 Kan-features (F11 RPE, F12 notes) + V1 Bör F15 dark mode; "per pass" not "per set" på F12-anteckning explicit
- `.planning/REQUIREMENTS.md` — F11/F12/F15 Pending → Phase 7 mappning
- `.planning/ROADMAP.md` Phase 7 — phase-level objective + success criteria
- `.planning/PROJECT.md` Core Value + Constraints — "får aldrig förlora ett set"; theme-toggle "konvention etablerad i Phase 1; manual toggle UI deferred till Phase 7"

### Phase 7 implementation pitfalls (load-bearing)
- `.planning/research/PITFALLS.md` §1.5 — `numeric(3,1)` truncation guard på `rpe`-kolumnen; client schema `multipleOf(0.1)` om strikt aligning (nuvarande SPEC accepterar 0-10 decimaler men inte multipleOf — planner kan välja att lägga till för att förhindra silent server-trunkering)
- `.planning/research/PITFALLS.md` §4.1 — RLS performance via `(select auth.uid())` wrappning; Phase 7 berör inga RLS-policys (oförändrad)
- `.planning/research/PITFALLS.md` §6.1 — Tap target ≥44pt; Klart-knappens w-16 + min-h-[56px] kvarstår säker; pencil-Ionicon-tap-target säkerställs via `hitSlop={8}`
- `.planning/research/PITFALLS.md` §6.4 — AAA-kontrast; 500-tecken-counter färg-byte vid warning ska verifieras
- `.planning/research/PITFALLS.md` §6.6 — Avsluta-knapp accent-blå (INTE röd); kvarstår oförändrad; "Spara"-knappen i edit-overlay är också blå (positivt val, inte data-loss)
- `.planning/research/PITFALLS.md` §8.1 — Module-scope setMutationDefaults; D-E3 lägger till 14:e key i `lib/query/client.ts` vid modul-load
- `.planning/research/PITFALLS.md` §8.13 — Zod-parse Supabase-responses INTE cast; `sessionRowSchema.notes = z.string().nullable()` redan etablerat
- `.planning/research/PITFALLS.md` §"Loading entire history for graph" — INTE relevant för Phase 7 (read-side färdig i Phase 6)

### Phase 7 stack reference (allt redan installerat — verifierat i `app/package.json`)
- `CLAUDE.md ### Styling → NativeWind 4` — `useColorScheme()` från `'nativewind'` API + `darkMode: 'class'` i tailwind.config.js — D-T1 grundas här
- `CLAUDE.md First-Time-User Gotchas → NativeWind 4` — class-mode bridge för system + manual theme (D-T1 base)
- `CLAUDE.md ### State & Data → @tanstack/react-query` — `useMutation` v5 object-arg + `setMutationDefaults`; D-E3 14:e key
- `CLAUDE.md ### State & Data → zod` — `z.preprocess` + `.nullable().optional()` chain (D-R2/D-R3)
- `CLAUDE.md ### Backend & Auth → @react-native-async-storage/async-storage` — already installed via `LargeSecureStore`; Phase 7 direkt-anvender för `fm:theme` (D-T2)
- `app/tailwind.config.js:9` `darkMode: 'class'` — load-bearing för D-T1 (NativeWind setColorScheme flippar root-class)

### Phase 7 architecture context (offline-first patterns ärvs)
- `.planning/research/ARCHITECTURE.md` §4 Pattern 1 — Offline-first mutations; D-E3 useUpdateSessionNotes ärver scope.id-binding + setMutationDefaults-shape
- `.planning/research/ARCHITECTURE.md` §6 — Auth/session pattern (oförändrad i Phase 7)

### Phase 1–6 inheritance (CRITICAL — Phase 7 bygger PÅ deras output)
- `.planning/phases/01-bootstrap-infra-hardening/01-CONTEXT.md` — `darkMode:'class'` konvention från Phase 1 (F15 baseline)
- `.planning/phases/02-schema-rls-type-generation/02-CONTEXT.md` — `exercise_sets.rpe numeric(3,1)`, `exercise_sets.notes text`, `workout_sessions.notes text` redan landade i `0001_initial_schema.sql` (Phase 2); ingen migration i Phase 7
- `.planning/phases/03-auth-persistent-session/03-CONTEXT.md` D-04 — SplashScreen.preventAutoHideAsync()-konvention; D-T2 utvidgar med AsyncStorage-läsning innan hideAsync
- `.planning/phases/03-auth-persistent-session/03-CONTEXT.md` D-09 — Module-scope side-effects (auth-store onAuthStateChange listener) — D-E3 14:e setMutationDefaults följer
- `.planning/phases/03-auth-persistent-session/03-CONTEXT.md` D-15 — Svenska inline-felmeddelanden (Phase 7 fortsätter: "RPE 0 eller högre", "Anteckningar (valfri)", "Lägg till anteckning", "Redigera anteckning")
- `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-CONTEXT.md` D-01 — `lib/query/{client,persister,network,keys}.ts` 4-fil-split; Phase 7 utvidgar `client.ts` (14:e setMutationDefaults)
- `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-CONTEXT.md` Plan 04-04 mutate-not-mutateAsync (commit `5d953b6`) — D-E3 `useUpdateSessionNotes.mutate(...)` följer
- `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-CONTEXT.md` Plan 04-04 inline-overlay-confirm (commit `e07029a`) — D-E2 edit-overlay återanvänder
- `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-CONTEXT.md` Plan 04-04 `useFocusEffect`-state-reset (commit `af6930c`) — D-N4 + D-E2 cleanup-pattern
- `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-CONTEXT.md` Plan 04-04 centraliserad (app) Stack header-styling (commit `b57d1c2`) — history-detail header oförändrat
- `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-CONTEXT.md` Plan 04-04 `useColorScheme`-bound theme-aware backdrop (commit `6b8c604`) — D-T4 migrerar denna import-source till nativewind
- `.planning/phases/05-active-workout-hot-path-f13-lives-or-dies/05-CONTEXT.md` D-15 — `setFormSchema` strikt validation; D-R2 utvidgar med RPE min(0)/max(10)
- `.planning/phases/05-active-workout-hot-path-f13-lives-or-dies/05-CONTEXT.md` Plan 05-06 / FIT-9 — `z.preprocess` comma→period precedent för weight_kg; D-R3 utvidgar samma pattern till RPE
- `.planning/phases/05-active-workout-hot-path-f13-lives-or-dies/05-CONTEXT.md` WR-05 — "Avsluta-during-workout är recoverable" backdrop-dismiss; D-N4 ärver
- `.planning/phases/06-history-read-side-polish/06-CONTEXT.md` D-07 — `useDeleteSession.mutate(...)` + scope.id `session:${id}`; D-E3 `useUpdateSessionNotes` använder samma scope.id för FIFO-replay-säkerhet
- `.planning/phases/06-history-read-side-polish/06-CONTEXT.md` — Befintlig session-detail-screen `app/app/(app)/history/[sessionId].tsx` (570+ rader); Phase 7 utvidgar med notes-block ovanför SummaryHeader-chiparna + RPE-suffix på set-rader

### Project conventions (etablerade tidigare)
- `CLAUDE.md ## Conventions → Navigation header & status bar` — `<StatusBar style="auto" />` etablerat i Phase 1; D-T3 utvidgar till dynamic explicit för manual override
- `CLAUDE.md ## Conventions → Database conventions` — Phase 7 introducerar INGA schema-ändringar (constraint i 07-SPEC.md Constraints); `app/supabase/migrations/`-mappen oförändrad
- `CLAUDE.md ## Conventions → Security conventions → Polish (Phase 7 — F11/F12 + F15 toggle)`:
  - "review for accumulated debt; rotate any keys whose entropy is exposed in logs"
  - Threat IDs T-07-* — Plan 01 etablerar STRIDE-register; relevanta hot:
    - **T-07-01:** Local storage tampering (`fm:theme` → injicering av andra strängar än 'system'/'light'/'dark') → mitigation: Zod-parse på AsyncStorage-read (`z.enum(['system','light','dark']).catch('system')`)
    - **T-07-02:** notes-XSS via user-controlled string i Supabase-rendering → mitigation: React Native `<Text>` är inherent-safe (no innerHTML); ingen serialisering till HTML i V1
    - **T-07-03:** Offline-edit-replay race om delete + update konkurrerar på samma session → mitigation: scope.id `session:${id}` FIFO (D-E3); planner verifierar i acceptance-test
    - **T-07-04:** RPE-input rejection bypass via direkt Supabase API-anrop → mitigation: RLS skyddar; client-Zod är defense-in-depth; servern accepterar numeric(3,1) som SPEC tillåter (0-99.9 — strikt 0-10 är client-side concern)
- `CLAUDE.md ## Branching-strategi` — `gsd/phase-07-v1-polish-cut`-branch via PR mot dev; aldrig direktcommit; redan etablerat och branch är aktiv

### Source-of-truth diff target (vad Phase 7 modifierar)
- `app/lib/schemas/sets.ts` — `setFormSchema.rpe` sträcks (D-R2/D-R3)
- `app/app/(app)/workout/[sessionId].tsx`:
  - Inline-raden (lines ~476-554): lägg till RPE-`Controller` + krymp Klart-knappen (D-R1/D-R4)
  - `AvslutaOverlay` (lines ~806-917): lägg till TextInput + KeyboardAvoidingView + counter + utvidga `handleConfirm` payload (D-N1/D-N2/D-N3/D-N4)
- `app/app/(app)/history/[sessionId].tsx`:
  - Lägg till notes-block ovanför SummaryHeader-chiparna (D-E4)
  - Set-rad-rendering (lines ~585-594): lägg till RPE-suffix `· RPE {rpe}` när `set.rpe IS NOT NULL`
  - Lägg till edit-overlay (D-E2)
  - Lägg till `useUpdateSessionNotes`-användning + `useFocusEffect`-state-reset för edit-overlay-state
- `app/lib/queries/sessions.ts`:
  - Utvidga `useFinishSession` med `notes`-fält i payload (D-N3)
  - Lägg till `useUpdateSessionNotes(sessionId)` (D-E3)
- `app/lib/query/client.ts` — 14:e `setMutationDefaults(['session','update-notes'], ...)` (D-E3)
- `app/app/(app)/(tabs)/settings.tsx`:
  - Byt placeholder ("Mer kommer i Phase 7.") mot tema-sektion: heading + SegmentedControl-instans + AsyncStorage-persist + setColorScheme-anrop (SPEC §5)
- `app/app/_layout.tsx`:
  - StatusBar-dynamic-style (line 156, D-T3)
  - ThemeBootstrap-komponent (eller utvidgad SplashScreenController) som läser AsyncStorage('fm:theme') + anropar setColorScheme INNAN splash hides (D-T2)
- `useColorScheme`-import-källa migreras från `'react-native'` → `'nativewind'` i 10 filer (D-T4):
  1. `app/app/_layout.tsx`
  2. `app/app/(app)/_layout.tsx`
  3. `app/app/(app)/(tabs)/_layout.tsx`
  4. `app/app/(app)/(tabs)/index.tsx`
  5. `app/app/(app)/(tabs)/history.tsx`
  6. `app/app/(app)/plans/[id].tsx`
  7. `app/app/(app)/plans/[id]/exercise-picker.tsx`
  8. `app/app/(app)/history/[sessionId].tsx`
  9. `app/app/(app)/exercise/[exerciseId]/chart.tsx`
  10. `app/components/active-session-banner.tsx`
- INGEN ändring:
  - `app/supabase/migrations/*` — inga nya migrations (Constraint)
  - `app/types/database.ts` — schema oförändrat
  - `app/lib/schemas/sessions.ts` — schemat redan F12-ready
  - `app/components/segmented-control.tsx` — generic-typed (Phase 6) återanvänds direkt
  - `app/scripts/test-rls.ts` — inga nya tabeller; befintliga 29+ assertions täcker
  - `app/lib/supabase.ts` — typed client oförändrat
  - `app/tailwind.config.js` — `darkMode:'class'` etablerat sen Phase 1; inget att ändra

### Codebase reusable assets för Phase 7
- **`app/components/segmented-control.tsx`** (Phase 6) — generic-typed `<SegmentedControl<T extends string>>`; återanvänds direkt för `[System|Ljust|Mörkt]` i settings.tsx (kommentar i filen säger explicit "designed to back V1.1+ surfaces inkl. F15 manual dark-mode toggle")
- **Inline-overlay-pattern** (Phase 4 commit `e07029a`) — D-E2 edit-notes-overlay; D-N1 (befintlig AvslutaOverlay redan inline)
- **`useFocusEffect`-state-reset-pattern** (Phase 4 commit `af6930c`) — D-N4 notes-state + D-E2 edit-overlay-state
- **mutate-not-mutateAsync-konvention** (Phase 4 commit `5d953b6`) — D-E3 + D-N3
- **`useColorScheme`-bound theme-aware backdrop** (Phase 4 D-18, Phase 5 commit `6b8c604`) — D-T3 + D-T4 utvidgar via migration till nativewind-source
- **`z.preprocess(comma→period)` weight_kg precedent** (Plan 05-06 / FIT-9) — D-R3 utvidgar pattern till RPE
- **`setMutationDefaults` 13 existing keys** (Phase 4: 8 + Phase 5: 5) — D-E3 14:e key följer struktur (mutationFn + onMutate-snapshot + onError-rollback + onSettled-invalidate)
- **`useFinishSession.mutate`-payload-pattern** (Phase 5) — D-N3 utvidgar med `notes`-fält
- **`SplashScreen.preventAutoHideAsync` + `SplashScreenController`-effect-pattern** (Phase 3 D-04 / commit Phase 3) — D-T2 läsning fits in samma timing-window

### Established Patterns (Phase 7 fortsätter)
- **`networkMode: 'offlineFirst'`** (Phase 4 D-07) — D-E3 update-mutation ärver
- **Hierarkisk queryKey-factor** (Phase 4 D-01) — `sessionsKeys.detail(id)` redan etablerad; D-E3 invalidate `sessionsKeys.listInfinite()`
- **Module-scope side-effects** (Phase 3 D-09) — D-E3 14:e `setMutationDefaults` vid modul-load i `lib/query/client.ts`
- **Path-alias `@/*`** (Phase 1 D-12) — Phase 7 använder `@/lib/queries/sessions`, `@/lib/schemas/sets`, etc.
- **Filnamns-konvention = kebab-case** (Phase 1 D-11) — inga nya filer behövs i Phase 7 (alla utvidgningar är i existerande filer)
- **Svensk inline-kopia** (Phase 3 D-15) — "Anteckningar (valfri)", "Lägg till anteckning", "Redigera anteckning", "Avbryt", "Spara", "RPE", "RPE 0 eller högre", "RPE 10 eller lägre"
- **AAA-kontrast på siffror** (Pitfall 6.4) — 500-tecken-counter följer

### Integration Points
- **Modified: `app/app/(app)/workout/[sessionId].tsx`** — RPE inline + AvslutaOverlay notes
- **Modified: `app/app/(app)/history/[sessionId].tsx`** — notes-block + RPE-suffix på set-rader + edit-overlay
- **Modified: `app/app/(app)/(tabs)/settings.tsx`** — placeholder → tema-toggle
- **Modified: `app/app/_layout.tsx`** — ThemeBootstrap (AsyncStorage-read) + dynamic StatusBar + useColorScheme-import-migration
- **Modified: `app/lib/queries/sessions.ts`** — useFinishSession payload + useUpdateSessionNotes hook
- **Modified: `app/lib/query/client.ts`** — 14:e setMutationDefaults
- **Modified: `app/lib/schemas/sets.ts`** — rpe min(0).max(10) + preprocess
- **Modified: 9 ytterligare filer** — useColorScheme-import-migration (mekaniskt)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`app/components/segmented-control.tsx`** (Phase 6, FIT-66-patched) — generic-typed `<SegmentedControl<T extends string>>`-primitiv; kommentaren explicit "designed to back V1.1+ polish surfaces (F15 manual dark-mode toggle)". Använd direkt för `[System|Ljust|Mörkt]`-toggle i settings.tsx. Inget extra install.
- **`app/lib/queries/sessions.ts`** (Phase 5+6) — `useFinishSession`, `useSessionQuery`, `useDeleteSession` finns redan; D-N3 utvidgar useFinishSession; D-E3 lägger till useUpdateSessionNotes i samma fil
- **`app/lib/query/client.ts`** (Phase 4/5) — 13 existing `setMutationDefaults`; D-E3 lägger till 14:e (`['session','update-notes']`) i samma fil; module-load-order-invariant gäller
- **`app/lib/schemas/sets.ts:62-63`** — `setFormSchema.rpe = z.coerce.number().nullable().optional()` — F11-schema-ready, D-R2/D-R3 sträcker
- **`app/lib/schemas/sessions.ts:27-32`** — `sessionFormSchema.notes = z.string().max(500).nullable().optional()` — F12-schema-ready
- **`app/app/(app)/workout/[sessionId].tsx:806-917`** — AvslutaOverlay-skelettet redan inline-overlay-pattern + WR-05 backdrop-dismiss
- **`app/app/(app)/history/[sessionId].tsx`** (Phase 6) — read-only session-detail med befintlig overflow-meny för delete; D-E1-D-E4 utvidgar med notes-block + edit-overlay
- **Phase 4 inline-overlay-destructive-confirm-pattern** (`commit e07029a`) — D-E2 edit-overlay
- **Phase 4 `useFocusEffect`-state-reset-pattern** (`commit af6930c`) — D-N4 + D-E2 cleanup
- **Phase 4 mutate-not-mutateAsync** (`commit 5d953b6`) — D-N3 + D-E3
- **NativeWind `darkMode:'class'`** etablerat i `app/tailwind.config.js:9` (Phase 1) — base för D-T1 setColorScheme-flippning

### Established Patterns
- **`networkMode: 'offlineFirst'`** (Phase 4 D-07) — D-E3 update-mutation ärver
- **`z.preprocess` comma→period locale-tolerance** (Plan 05-06 / FIT-9) — D-R3 utvidgar pattern
- **Hierarkisk queryKey-factor** (Phase 4 D-01) — Phase 7 utvidgar `sessionsKeys` med ny mutation, inte ny key
- **Optimistic onMutate → snapshot → setQueryData → return {previous}** (alla 13 existing setMutationDefaults) — D-E3 follow
- **mutate-not-mutateAsync med `{ onError, onSuccess }`** (Phase 4 commit `5d953b6`) — D-N3 + D-E3 follow
- **`useColorScheme()`-bound theme-aware values** (Phase 4 D-18, Phase 5 commit `6b8c604`) — D-T4 migrerar import-source; APIns shape oförändrad
- **Inline-overlay (INTE modal portal)** (Phase 4 D-13, commit `e07029a`) — D-E2 follow
- **Module-scope side-effects** (Phase 3 D-09) — D-E3 14:e setMutationDefaults
- **Svensk inline-kopia + AAA-kontrast** (Phase 3 D-15 + Pitfall 6.4) — Phase 7 fortsätter

### Integration Points
- **Modified: `app/app/(app)/workout/[sessionId].tsx`** — inline RPE + AvslutaOverlay notes
- **Modified: `app/app/(app)/history/[sessionId].tsx`** — notes-block + RPE-suffix + edit-overlay
- **Modified: `app/app/(app)/(tabs)/settings.tsx`** — placeholder → tema-toggle
- **Modified: `app/app/_layout.tsx`** — splash-gate AsyncStorage-read + dynamic StatusBar
- **Modified: `app/lib/queries/sessions.ts`** — useFinishSession payload + useUpdateSessionNotes hook
- **Modified: `app/lib/query/client.ts`** — 14:e setMutationDefaults
- **Modified: `app/lib/schemas/sets.ts`** — rpe min(0).max(10) + preprocess
- **Modified: 9 ytterligare filer** — useColorScheme-import-migration (mekaniskt)

</code_context>

<specifics>
## Specific Ideas

- **Tema-toggle settings-sektion i `app/app/(app)/(tabs)/settings.tsx`:**
  ```tsx
  const { colorScheme, setColorScheme } = useColorScheme(); // från nativewind
  const [stored, setStored] = useState<'system' | 'light' | 'dark'>('system');

  useEffect(() => {
    void AsyncStorage.getItem('fm:theme').then((v) => {
      const parsed = z.enum(['system','light','dark']).catch('system').parse(v);
      setStored(parsed);
    });
  }, []);

  const onChange = (value: 'system' | 'light' | 'dark') => {
    setStored(value);
    setColorScheme(value);
    void AsyncStorage.setItem('fm:theme', value);
  };

  // i JSX:
  <View className="gap-2">
    <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">Tema</Text>
    <SegmentedControl
      options={[
        { label: 'System', value: 'system' },
        { label: 'Ljust',  value: 'light'  },
        { label: 'Mörkt',  value: 'dark'   },
      ]}
      value={stored}
      onChange={onChange}
      accessibilityLabel="Välj appens tema"
    />
  </View>
  ```

- **ThemeBootstrap-komponent (eller utvidgad SplashScreenController) i `app/app/_layout.tsx`:**
  ```tsx
  function ThemeBootstrap() {
    const { setColorScheme } = useColorScheme(); // nativewind
    useEffect(() => {
      void AsyncStorage.getItem('fm:theme').then((v) => {
        const parsed = z.enum(['system','light','dark']).catch('system').parse(v);
        setColorScheme(parsed);
      });
    }, [setColorScheme]);
    return null;
  }
  // mountas som sibling till SplashScreenController + RootNavigator
  ```

- **RPE Controller-block i workout/[sessionId].tsx inline-raden:**
  ```tsx
  <Controller
    control={control}
    name="rpe"
    render={({ field: { onChange, value }, fieldState: { error } }) => (
      <View className="w-16">
        <TextInput
          value={value == null ? "" : String(value)}
          onChangeText={onChange}
          placeholder="RPE"
          placeholderTextColor="#9CA3AF"
          keyboardType="decimal-pad"
          inputMode="decimal"
          returnKeyType="done"
          autoCorrect={false}
          autoCapitalize="none"
          selectTextOnFocus
          accessibilityLabel="Upplevd ansträngning, valfri"
          maxLength={4}
          className={`rounded-md bg-white dark:bg-gray-900 border px-2 py-3 text-base font-semibold text-gray-900 dark:text-gray-50 min-h-[56px] text-center ${
            error ? "border-red-600 dark:border-red-400" : "border-gray-300 dark:border-gray-700"
          } focus:border-blue-600 dark:focus:border-blue-500`}
        />
        {error && (
          <Text className="text-base text-red-600 dark:text-red-400 mt-1 px-1" accessibilityLiveRegion="polite">
            {error.message}
          </Text>
        )}
      </View>
    )}
  />
  ```

- **Notes TextInput-block i AvslutaOverlay:**
  ```tsx
  <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%', maxWidth: 400 }}>
    <Pressable onPress={(e) => e.stopPropagation()}>
      <View className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-6" style={{ gap: 16 }}>
        {/* Title + body (oförändrat) */}
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Anteckningar (valfri)"
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={3}
          maxLength={500}
          style={{ minHeight: 80, maxHeight: 160 }}
          textAlignVertical="top"
          accessibilityLabel="Anteckningar för passet, valfri"
          className="rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 px-3 py-2 text-base text-gray-900 dark:text-gray-50"
        />
        <Text className={`text-sm text-right ${notes.length > 480 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
          {`${notes.length}/500`}
        </Text>
        {/* Knappar (befintliga) */}
      </View>
    </Pressable>
  </KeyboardAvoidingView>
  ```

- **history-detail notes-block (D-E4-snippet):**
  ```tsx
  <View className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3 mx-4 mt-2 flex-row items-start gap-2">
    {session.notes ? (
      <>
        <Text className="flex-1 text-base text-gray-900 dark:text-gray-50">{session.notes}</Text>
        <Pressable onPress={() => setShowEditNotesOverlay(true)} hitSlop={8} accessibilityLabel="Redigera anteckning">
          <Ionicons name="pencil-outline" size={18} color={muted} />
        </Pressable>
      </>
    ) : (
      <Pressable onPress={() => setShowEditNotesOverlay(true)} className="flex-row items-center gap-2 flex-1" hitSlop={8} accessibilityLabel="Lägg till anteckning">
        <Ionicons name="add-circle-outline" size={18} color={accent} />
        <Text className="text-base text-gray-500 dark:text-gray-400">Lägg till anteckning</Text>
      </Pressable>
    )}
  </View>
  ```

- **AsyncStorage-värde-parsning säker fallback:** `z.enum(['system','light','dark']).catch('system').parse(rawValue)` — om värdet är korrumperat eller saknas, default till `'system'` utan att kasta. Säkrar T-07-01 (local-storage-tampering).

- **`useUpdateSessionNotes(sessionId)` signatur:**
  ```ts
  export function useUpdateSessionNotes(sessionId: string) {
    return useMutation({
      mutationKey: ['session', 'update-notes'],
      scope: { id: `session:${sessionId}` },
      mutationFn: async ({ notes }: { notes: string | null }) => {
        const { data, error } = await supabase
          .from('workout_sessions')
          .update({ notes })
          .eq('id', sessionId)
          .select()
          .single();
        if (error) throw error;
        return sessionRowSchema.parse(data);
      },
    });
  }
  ```

- **Core-flow ≤2 min UAT-script (för human-UAT.md):**
  1. Öppna app (autentiserad) → tap Hem-tab
  2. Tap "Starta pass" på en existerande plan
  3. Logga set 1: skriv vikt, reps, RPE → Klart
  4. Logga set 2: samma övning, nästa vikt → Klart
  5. Logga set 3: nästa övning → Klart
  6. Tap "Avsluta" header → AvslutaOverlay öppnar → skriv anteckning eller skip → Avsluta
  7. Tap Historik-tab → tap nyligen avslutade passet
  8. Verifiera RPE-suffix synlig + notes-block synlig
  
  Kronometer 3 körningar; mål = 3 av 3 ≤2 min utan UI-bugg.

</specifics>

<deferred>
## Deferred Ideas

- **Per-set anteckningar UI** (`exercise_sets.notes`-kolumnen finns; SPEC out-of-scope) — V1.1 om soak visar behov
- **RPE i F10-chart-routens "Senaste 10 passen"-rader** — V1.1 (read-only analytics, låg värde mot verifieringskostnad)
- **RPE-edit i tap-to-edit-läget på redan loggat set** — V1.1 polish (samtidigt med F17-UI edit-formuläret)
- **F14 Apple Sign-In** — V1.1 (App Store-blocker)
- **F1.1 email-confirmation deep-link handler** — V1.1 (Expo Linking + Supabase verifyOtp/exchangeCodeForSession)
- **F17 set-typ-toggling UI** (warmup/dropset/failure-badges på set-rader) — V1.1 (schema-redo sen Phase 2)
- **F18 PR-detection vid pass-avslut** (Epley `w * (1 + r/30)`) — V1.1
- **F19 Vilo-timer** — V1.1 (research-flag på `expo-notifications` + `expo-keep-awake`)
- **AsyncStorage-failure-recovery UI** (vid `fm:theme`-läsfel surfaceas inget till användaren — bara console.warn) — V1.1 om soak visar incidenter
- **`multipleOf(0.5)` på RPE-schemat** (för att harmonisera med Strong/Hevy 0.5-steg) — V1.1 polish om personlig soak visar att decimaler utöver halvor är onödigt
- **Tema-toggle auto-system-time-of-day-switch** (dawn/dusk dynamic) — V2
- **Tema-toggle per-screen-override** (custom per-route) — V2 (overkurs)
- **Sparkline mini-graf på history-list-rad med inline trend-visning** — V2 polish
- **Cleanup-cron för tomma sessions** — V1.1 om soak visar ackumulering
- **App Store-launch prep** (EAS Build, TestFlight, store-listing) — V2

### Reviewed Todos (not folded)
Inga — STATE.md "Pending Todos" är tom; `gsd-sdk query todo.match-phase 7` returnerade 0 matches.

</deferred>

---

*Phase: 7-v1-polish-cut*
*Context gathered: 2026-05-15*
