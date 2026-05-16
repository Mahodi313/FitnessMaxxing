# Phase 7: V1 Polish Cut - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 07-v1-polish-cut
**Areas discussed:** Tema-propagation (F15 wiring), RPE-inline-input UX, Notes capture i AvslutaOverlay, Notes edit-affordance i history-detail

---

## Tema-propagation (F15 wiring)

### Q1 — Tema-override-mekanism

| Option | Description | Selected |
|--------|-------------|----------|
| NativeWind setColorScheme + migrera 11 imports | Stack-native; setColorScheme flippar root-klass; drop-in API | ✓ |
| Zustand themeStore + custom useTheme() | Symmetri med auth-store; men dubbelarbete (manuell synk med NativeWind class-mode) | |
| ThemeProvider React Context + dual-source | Custom Context; dubbelt API (NativeWind-class vs useTheme) | |

**User's choice:** NativeWind setColorScheme + migrera 11 imports
**Notes:** Single source of truth via NativeWind interna state — minst kod, mest first-party.

### Q2 — AsyncStorage-boot-läsning

| Option | Description | Selected |
|--------|-------------|----------|
| I existerande splash-gate | Effect anropar setColorScheme(stored) INNAN SplashScreen.hideAsync(); splash täcker första rendern → ingen FOUC | ✓ |
| Module-load-side IIFE | Top-level Promise på modulniv-i theme.ts; risk att resolve efter första rendern | |
| Sync via expo-secure-store fallback | API är async ändå; bryter SPEC.md (AsyncStorage `fm:theme`) | |

**User's choice:** I existerande splash-gate
**Notes:** Default = 'system' vid läsfel (SPEC accepted-risk).

### Q3 — StatusBar-hantering under manuell override

| Option | Description | Selected |
|--------|-------------|----------|
| Koppla StatusBar till NativeWind colorScheme | `style={isDark ? 'light' : 'dark'}`; garanterar synlig ikon-färg under alla 9 kombinationer | ✓ |
| Lämna `style="auto"` + acceptera mismatch | Status-bar följer iOS, app-content följer override → osynliga ikoner i mismatch | |
| Hardcoda till 'dark' eller 'light' | Bryter Phase 1 status-bar-konvention | |

**User's choice:** Koppla StatusBar till NativeWind colorScheme

### Q4 — Migrations-scope

| Option | Description | Selected |
|--------|-------------|----------|
| Migrera alla 11 till nativewind's useColorScheme | Mekanisk find/replace; garanterar att non-className-styling reagerar på override | ✓ |
| Migrera bara de som gör non-className-styling | Selektiv migration; brittle — framtida ändringar bryter override-konsistens tyst | |
| Behåll RN-imports, lita på className-only override | Inkonsekvent UX i 'Override-Mörkt på iOS-Ljust' | |

**User's choice:** Migrera alla 11
**Notes:** Atomic commit för migrationen, separat commit för ThemeProvider/setColorScheme-anrop.

---

## RPE-inline-input UX

### Q1 — Layout-dimensionering

| Option | Description | Selected |
|--------|-------------|----------|
| RPE = w-16 (64pt) fixed, Vikt+Reps behåller flex-1 | Klart krymper till w-16; RPE max 4 tecken | ✓ |
| Alla tre flex-1 + Klart w-20 | 33/33/33-split; squeeze:ar Vikt/Reps på SE | |
| RPE flyttas till ny rad under Vikt+Reps | Bryter SPEC §1 "Inline-raden blir [Vikt] [Reps] [RPE]" | |
| RPE som mini-segment 1-10 inline | Kan inte uttrycka 8.5 — bryter SPEC §1 decimal-acceptance | |

**User's choice:** RPE = w-16 fixed, Vikt+Reps behåller flex-1
**Notes:** Iphone SE 320pt-bredd: 64+8+120+8+120+8+64 = 392 — kräver att Klart krymper.

### Q2 — Schema-validering

| Option | Description | Selected |
|--------|-------------|----------|
| Sträck schemat: preprocess(comma→period) + min(0).max(10) | Följer weight_kg-precedensen (Plan 05-06 / FIT-9) | ✓ |
| Sträck schemat min/max men ingen comma-preprocess | Inkonsekvent med Vikt på svensk decimal-pad | |
| Behåll schemat oförändrat + UI-side clamping/regex | Bryter "validering bor i Zod-schemas"-konvention | |

**User's choice:** Sträck schemat: preprocess(comma→period) + min(0).max(10)

### Q3 — Empty-handling

| Option | Description | Selected |
|--------|-------------|----------|
| Preprocess: empty→null + comma→period i samma block | En preprocess, ett ansvar; mappar '' till null FÖRE coerce | ✓ |
| Controller-nivå: tom value skäms ut till undefined | Två lager validering — svårare att audit:a | |
| Schema rejects empty + UI svalar felmeddelandet | Antipattern — valid form-state får inte vara 'failing-but-hidden' | |

**User's choice:** Preprocess: empty→null + comma→period i samma block

### Q4 — Visuell signal

| Option | Description | Selected |
|--------|-------------|----------|
| Placeholder 'RPE' + inline-error under (samma som Vikt/Reps) | Konsekvent med befintliga fält; ingen ny UX-pattern | ✓ |
| Placeholder 'RPE (valfri)' + error som tooltip | Trunkeras vid 64pt-bredd | |
| Helper-text under raden + ingen inline-error | Lägger till en rad i hot-path-flowet | |

**User's choice:** Placeholder 'RPE' + inline-error under

---

## Notes capture i AvslutaOverlay

### Q1 — TextInput-placering + keyboard

| Option | Description | Selected |
|--------|-------------|----------|
| Inuti dialog-cardet ovanför kn-raden + KeyboardAvoidingView wrap | Backdrop-tap-dismiss bevaras; stoppropagation på inre Pressable | ✓ |
| I separat steg efter klick på 'Avsluta' (2-stegs-overlay) | Lägger extra tap till core-flow (SPEC §6 ≤2min-gate) | |
| Som tap-att-expand fold under body-texten | Mer komplexitet (collapsed/expanded state) | |

**User's choice:** Inuti dialog-cardet ovanför kn-raden + KeyboardAvoidingView wrap

### Q2 — TextInput-shape

| Option | Description | Selected |
|--------|-------------|----------|
| minHeight=80pt + autogrow till maxHeight=160pt + counter onChangeText | Autogrow inom intervallet; counter alltid synlig | ✓ |
| Fast höjd 100pt + counter bara när >480 | Statisk höjd; counter dolt tills warning | |
| Single-line TextInput (compact) | Bryter SPEC §3 "TextInput (multi-line)" | |

**User's choice:** minHeight=80pt + maxHeight=160pt autogrow + alltid synlig counter

### Q3 — Wire-up till useFinishSession

| Option | Description | Selected |
|--------|-------------|----------|
| useFinishSession.mutate({ id, finished_at, notes }) — utvidga payloaden | Ingen ny mutation; återanvänder existing scope.id-binding | ✓ |
| Ny `useUpdateSessionNotes`-mutation efter finish | Tvåstegs; risk för orphaned UI-state om en mutation misslyckas | |
| Läs notes från RHF-form istället för lokal state | Överkurs för ett enda fält | |

**User's choice:** Utvidga useFinishSession-payloaden
**Notes:** Tom string → null via `notes?.trim() || null` inom mutationen.

### Q4 — Cancel-state-hantering

| Option | Description | Selected |
|--------|-------------|----------|
| Backdrop-tap eller 'Fortsätt' förkastar tyst notes-state | Matchar Phase 5 WR-05 "Avsluta-during-workout är recoverable" | ✓ |
| Confirm-dialog vid backdrop-tap om notes har content | Ökar UX-yta för kant-fall; bryter WR-05 | |
| Auto-spara notes draft i AsyncStorage | Överkurs för V1 | |

**User's choice:** Backdrop-tap eller 'Fortsätt' förkastar tyst notes-state

---

## Notes edit-affordance i history-detail

### Q1 — Tap-affordance

| Option | Description | Selected |
|--------|-------------|----------|
| Pencil-ikon i notes-text-blocket + add-button när notes IS NULL | Strong/Hevy/Fitbod App Store-standard; discoverable | ✓ (Claude:s diskretion per "ta det som är bäst långsiktigt") |
| Lägg till 'Redigera anteckning' i existerande '...'-meny | Extra tap; mindre discoverable | |
| Tap-på-text-blocket (hela notes-text är tappable) | Signalerar inte 'edit' visuellt | |

**User's choice:** Delegerade till Claude — valde Pencil-ikon + add-button (App Store-standard).
**Notes:** Användarens instruktion: "Ta det som är bäst långsiktigt som standard för app store också." Claude konsulterade Strong/Hevy/Fitbod-konventioner.

### Q2 — Edit-overlay-struktur

| Option | Description | Selected |
|--------|-------------|----------|
| Återanvänd Phase 4 inline-overlay-pattern + samma TextInput-shape som AvslutaOverlay | Konsistens med F12-write-side | ✓ |
| Bottom-sheet (Modal portal med presentation='formSheet') | Bryter Phase 4 D-13 "Modal portal layout är UNRELIABLE" | |
| Inline-expand i text-blocket (in-place editor) | Brittle med keyboard-coverage | |

**User's choice:** Återanvänd inline-overlay-pattern + samma TextInput-shape som AvslutaOverlay

### Q3 — Mutation-hook-design

| Option | Description | Selected |
|--------|-------------|----------|
| Dedikerad `useUpdateSessionNotes(sessionId)` med scope.id=session:<id> | 14:e setMutationDefaults; matchar D-N3-scope | ✓ |
| Generisk `useUpdateSession(sessionId)` som tar partial<SessionRow>-patch | Breddar attack-yta i optimistic onMutate; överkurs för V1 | |
| Återanvänd useFinishSession (lägg till 'edit-mode'-flag i payload) | Bryter single-responsibility | |

**User's choice:** Dedikerad `useUpdateSessionNotes(sessionId)` med scope.id=session:<id>

### Q4 — Notes-block placering + visuell

| Option | Description | Selected |
|--------|-------------|----------|
| Ovanför SummaryHeader-chiparna, ljust card-container | Per SPEC §4; konsistent visual-vocab | ✓ |
| Direkt på skärm-bakgrunden utan card-container | Mindre visuell separation från SummaryHeader | |
| Nederst i skärmen efter alla ExerciseCard:s | Bryter SPEC §4 | |

**User's choice:** Ovanför SummaryHeader-chiparna, ljust card-container

---

## Claude's Discretion

Användarens explicit delegation på Q1 av Notes-edit-area: "Ta det som är bäst långsiktigt som standard för app store också." → Claude valde Pencil-ikon + add-button baserat på Strong/Hevy/Fitbod-konventioner.

Övriga Claude-diskretion-frågor är listade i 07-CONTEXT.md `<decisions>` §Claude's Discretion — alla är planner-level micro-beslut (commit-ordning, autoFocus-toggle, copy-variationer, useFocusEffect-cleanup-struktur, AAA-kontrast-verifiering, replay-race-test).

## Deferred Ideas

Inga nya idéer som krockade med phase-scope dök upp under diskussionen. Befintliga deferred items från SPEC.md Out-of-scope är listade i 07-CONTEXT.md `<deferred>` — alla är V1.1 eller V2-kandidater (per-set notes UI, RPE-i-chart, F14/F17/F18/F19, multipleOf(0.5) på RPE-schemat, tema-auto-time-of-day-switch, etc.).
