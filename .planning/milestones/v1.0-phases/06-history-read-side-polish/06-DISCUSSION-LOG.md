# Phase 6: History & Read-Side Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 6-history-read-side-polish
**Areas discussed:** History list (F9) row + grouping, Session-detail-skärmen, F10 graf (metric/window/default), F10 entry-point routing

---

## History list (F9) row + grouping

| Option | Description | Selected |
|--------|-------------|----------|
| Datum + plan-namn (minimalistisk) | Enklast, snabbast att rendera. Detaljer kräver tap-in. | |
| Datum + plan + total-volym + set-count | Quick at-a-glance utan tap-in. Aggregat-query per rad. | ✓ |
| Datum + plan + duration + topp-övning | Tidsåtgång + heuristisk höjdpunkt. Mer rik men topp-övning kräver definition. | |

**User's choice:** Datum + plan + total-volym + set-count

| Option | Description | Selected |
|--------|-------------|----------|
| Flat scroll, ingen gruppering | Bara rader. Enklast cursor-paginera; datum på varje rad ger nog kontext. | ✓ |
| Grupperat per månad | iOS SectionList, visuell pacing. Client-side group-by-month. | |
| Grupperat per vecka (relativ) | "Denna vecka" / "Förra veckan". Konstiga labels för äldre data. | |

**User's choice:** Flat scroll, ingen gruppering

| Option | Description | Selected |
|--------|-------------|----------|
| Infinite scroll + pull-to-refresh | TanStack `useInfiniteQuery` med cursor, auto-fetch onEndReached. Standard iOS. | ✓ |
| Load-more-knapp + pull-to-refresh | Explicit "Läs in fler"-knapp. Mer data-medvetenhet. | |
| All-in-one (ingen pagination i V1) | LIMIT 100. Bryter ROADMAP success #1 ("cursor-paginerad"). | |

**User's choice:** Infinite scroll + pull-to-refresh

| Option | Description | Selected |
|--------|-------------|----------|
| Inget filter, ingen sök | V1 simplest. Kronologisk lista räcker. Matchar PROJECT.md "personligt verktyg". | ✓ |
| Filter på plan (chip-rad) | "Alla / Push A / Pull A" chip-rader. Mer UI-yta. | |
| Sök på övning eller plan-namn | Search-bar med join eller client-filter. Mer komplex. | |

**User's choice:** Inget filter, ingen sök

---

## Session-detail-skärmen

| Option | Description | Selected |
|--------|-------------|----------|
| Ny route `/history/[sessionId].tsx` | Read-only, scope-isolerad. Ärver useSessionQuery/useSetsForSessionQuery. | ✓ |
| Återanvänd `/workout/[sessionId]` i read-only mode | Risk för conditionals i hot-path-route + ActiveSessionBanner-kollision. | |
| Modal-presentation | Bottom-sheet eller modal. Begränsar djup-navigering. | |

**User's choice:** Ny route /history/[sessionId].tsx

| Option | Description | Selected |
|--------|-------------|----------|
| Card-per-övning med alla set inline | Bekant från workout-screen, återanvänder UI-stil. Group-by-exercise client-side. | ✓ |
| Platt lista (alla set som rader) | Enklast rendering, ingen group-by. Svårare att skanna. | |
| Card-per-övning, kollapserad default | Tap-att-expandera. Bra om många övningar; state-per-card. | |

**User's choice:** Card-per-övning med alla set inline (read-only)

| Option | Description | Selected |
|--------|-------------|----------|
| Helt read-only (Recommended baseline) | Inga edit/delete-knappar. Phase 5 D-14 reservation hålls. | |
| Read-only set + radera hela passet | Hard-delete cascade via FK. Escape-hatch för katastroffall. Edit defer V1.1. | ✓ |
| Full edit (vikt/reps + delete) | Bryter Phase 5 D-14, max yta + risk. | |
| Defer mutation-frågan till V1.1 | Phase 6 read-only; mutationen lands V1.1 naturligt. | |

**User's choice:** Read-only set + radera hela passet (V1.1 öppnar edit-formuläret ändå för F17-UI + F11-RPE)
**Notes:** Användaren frågade om långsiktigt bygg-för-V2-perspektiv; Claude svarade som thinking partner med rationale (V1.1-features återanvänder edit-formuläret, FK on delete cascade gör schemat gratis idag, append-only-anda bevaras för normala fall).

| Option | Description | Selected |
|--------|-------------|----------|
| Visa plan-namn ändå, '— ingen plan' om null | Joinar plans utan archived_at-filter. | ✓ |
| Visa plan-namn med (arkiverad)-suffix | Ger plan-state-info. Mer visuell brus om många gamla arkiverade. | |
| Visa bara 'Pass' utan plan-koppling | Enklast, ingen join. Anv. förlorar plan-kontext. | |

**User's choice:** Visa plan-namn ändå (utan archived_at-filter på plans-joinen)

| Option | Description | Selected |
|--------|-------------|----------|
| Ja, kompakt summary-rad ovanför första cardet | Återanvänder samma aggregeringar som F9 list-rad — gratis i query. | ✓ |
| Nej, bara card-listan | Per-övning aggregat på card-header räcker. | |

**User's choice:** Ja, kompakt summary-rad (set-count + total-volym + duration)

| Option | Description | Selected |
|--------|-------------|----------|
| Ja, duration i summary-raden | `differenceInMinutes` via date-fns; '—' om finished_at NULL. | ✓ |
| Nej — duration inte intressant för styrketräning | Spara plats för volym + set-count. | |

**User's choice:** Ja, duration i summary-raden

| Option | Description | Selected |
|--------|-------------|----------|
| Ja, tap på card-header routar till övningens graf | Natural affordance, drar F10-entry-point in i Phase 6. | ✓ |
| Nej — F10 har separat entry-point | Mindre cross-screen-koppling. | |
| Long-press card för meny | iOS-native men mindre discoverable. | |

**User's choice:** Ja, tap på card-header routar till exercise-chart

| Option | Description | Selected |
|--------|-------------|----------|
| Liten 'Laddar…'-text centrerad | Matchar Phase 4/5-konvention. Cache-hit gör att det syns sällan. | ✓ |
| Skeleton-loader (gråa placeholder-card) | Layout-stability men extra komponent. | |
| Tom skärm (ingen indicator) | Sköra UX. | |

**User's choice:** Liten 'Laddar…'-text centrerad

| Option | Description | Selected |
|--------|-------------|----------|
| Visa tomma pass + delete-knapp (App Store-standard som matchar "får aldrig förlora ett set") | Transparent, anv. har explicit out. Matchar Phase 5 D-23. | ✓ |
| Filtrera bort tomma pass från listan | Ren listvy men sessions ligger kvar osynligt. | |
| Auto-delete vid Avsluta (Strong-mode) | Bryter Phase 5 D-23. | |

**User's choice:** Visa tomma pass + delete-knapp
**Notes:** Användaren frågade vad som är App Store-standard för flera kunder; Claude svarade att FitnessMaxxing medvetet skiljer sig från Strong/Hevy auto-discard-mönstret pga "får aldrig förlora ett set"-doktrinen.

---

## F10 graf — metric, tids-fönster, default-vy

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle 'Max vikt' / 'Total volym' (segmented control) | App Store-standard (Strong/Hevy). En graf, swappa metric via tap. | ✓ |
| Två grafer staplade vertikalt | Båda samtidigt. Mer info, mindre yta per graf. | |
| Dual-axis i samma graf | Maximal info-densitet, svårt att läsa. Avråds. | |

**User's choice:** Segmented control 'Max vikt' / 'Total volym'
**Notes:** Användaren frågade vad som är App Store-produkt-standard; Claude bekräftade segmented-control-mönstret som universellt i Strong/Hevy/Jefit/Fitbod.

| Option | Description | Selected |
|--------|-------------|----------|
| Segmented control 1M / 3M / 6M / 1Y / All, default 3M | App Store-standard. ARCHITECTURE.md §5-query + where-filter. | ✓ |
| Bara 'All' (alla pass, ingen väljare) | Enklast men long-term graf kan frysa. | |
| Hardcoded 90d (3 mån) i V1 | Som Strong-default men ingen väljare. | |

**User's choice:** Segmented control 1M/3M/6M/1Y/All, default 3M

| Option | Description | Selected |
|--------|-------------|----------|
| Line chart med data-punkter | Standard för progression över tid. Victory Native `<Line>`. | ✓ |
| Bar chart (en bar per dag/pass) | Bra om data sparse. Svårare se trend. | |
| Area chart | Visualiserar volym-känslan. Polish-feel. | |

**User's choice:** Line chart med data-punkter

| Option | Description | Selected |
|--------|-------------|----------|
| Empty-state-meddelande (om <2 punkter) | "Logga minst 2 set för att se trend." | |
| Visa 1 punkt om 1 data-punkt finns | Singel-prick utan linje. | |
| Hide graf-vyn helt om <2 punkter | Visa bara senaste-set-listan. | |
| **Graceful degrade (0→empty, 1→singel-prick, 2+→full line)** | **App Store-standard kombinerar samtliga.** | ✓ |

**User's choice:** Graceful degradation (0 → empty-state, 1 → singel-prick, 2+ → full line chart)
**Notes:** Användaren frågade vad som är App-Store-standard på lång sikt; Claude förklarade att Strong/Hevy/Fitbod alla använder graceful degradation, inte antingen-eller.

| Option | Description | Selected |
|--------|-------------|----------|
| Per dag, `date_trunc('day', completed_at)` | ARCHITECTURE.md §5 SQL. Strong-standard. Cleanare graf. | ✓ |
| Per pass (en punkt per workout_session) | Visar varje pass separat. Brusig långt sikt. | |
| Per pass i V1, lazy-upgrade till per-dag i V1.1 | Compromise. Bryter ARCHITECTURE-query. | |

**User's choice:** Per dag (date_trunc('day', completed_at))

| Option | Description | Selected |
|--------|-------------|----------|
| Tap-att-se-tooltip | Victory Native `useChartPressState`. Strong/Hevy-standard. | ✓ |
| Ingen interaktion | Visuell graf utan tap. Simplest. | |
| Pan + zoom (scroll horizontellt på 'All') | Mer UX-yta + edge-cases. V1.1 polish. | |

**User's choice:** Tap-att-se-tooltip

| Option | Description | Selected |
|--------|-------------|----------|
| Ja, lista 'Senaste 10 passen för övningen' under grafen | PRD §5.5 explicit. Tap-att-routa till history-detail. | ✓ |
| Nej, bara grafen | Anv. når historik separat. Bryter PRD §5.5. | |

**User's choice:** Ja, 'Senaste 10 passen för övningen'-lista under grafen

| Option | Description | Selected |
|--------|-------------|----------|
| useMemo över query-resultet | Standard React-pattern. Stable referens. | ✓ |
| select-hook i useQuery | TanStack `select`-option, memo gratis. | |

**User's choice:** useMemo över query-resultet

| Option | Description | Selected |
|--------|-------------|----------|
| Y-axel auto-scale, X-axel datum-labels (max 5 ticks) | Standard. Bevarar precision. Strong-mönster. | ✓ |
| Y-axel hardcoded min=0, X-axel datum | Mer "högtidlig" men förlorar precision i toppen. | |
| Inga axlar / labels (minimal) | För minimalistisk; svårt tolka. | |

**User's choice:** Y-axel auto-scale, X-axel datum-labels max 5 ticks (date-fns format)

| Option | Description | Selected |
|--------|-------------|----------|
| Theme-aware via useColorScheme | Light: blue-600; Dark: blue-400. Matchar F15. | ✓ |
| Hardcoded blue (en färg båda modes) | Enklast men bryter F15-konvention. | |

**User's choice:** Theme-aware via useColorScheme

---

## F10 entry-point — var hittar man grafen?

| Option | Description | Selected |
|--------|-------------|----------|
| Plan-detail chart-ikon per plan_exercise-rad | Natural-discovery i plan-edit-context. V1-scope-friendly. | ✓ |
| Aktivt workout-screen chart-ikon (Phase 5 hot-path) | Distractions-risk mid-pass. Bryter ≤3s SLA-spirit. Defer V1.1. | |
| Dedikerad Exercises-tab (4 tabs i bottom-nav) | V2-territorium med F20 seed-library. | |

**User's choice:** Plan-detail chart-ikon per plan_exercise-rad (+ history-detail tap-on-card-header redan låst)
**Notes:** Användaren frågade vad som är App-Store-långsiktigt bäst; Claude förklarade att Strong/Hevy använder alla tre patterns kombinerat men för V1 personlig är plan-detail-ikonen rätt scope-balans.

| Option | Description | Selected |
|--------|-------------|----------|
| `/exercise/[exerciseId]/chart` | Tydlig URL-state. Öppet för V2-utvidgning. | ✓ |
| `/exercise/[exerciseId]` (exercise-detail med graf-vyn) | Enklare URL. Kan bli "kitchen sink" V1.1/V2. | |
| `/history/exercise/[exerciseId]` | Missvisande när plan-detail entry-point routar dit. | |

**User's choice:** `/exercise/[exerciseId]/chart`

| Option | Description | Selected |
|--------|-------------|----------|
| Liten line-chart-ikon på höger sida av plan_exercise-raden | Hit-target ≥44pt. Tap-bubblar ej upp. Discoverable men diskret. | ✓ |
| Long-press-meny på raden | iOS-native men mindre discoverable. V1.1-territory. | |
| Tap-hela-raden routar till chart | Kolliderar med drag-handle + edit-modal Phase 4-konvention. | |

**User's choice:** Liten line-chart-ikon på höger sida av raden

| Option | Description | Selected |
|--------|-------------|----------|
| Show övningsnamn i header | Centraliserad (app) Stack-styling Phase 4 commit `b57d1c2`. | ✓ |
| Static 'Graf' utan namn | Mindre kontext. | |

**User's choice:** Show övningsnamn i header

---

## Claude's Discretion

Following items were left to planner/UI-SPEC discretion:

- Exakt query-shape för F9 list-aggregat (server-side group-by vs klient-side reduce vs separat aggregate-RPC)
- Exakt query-shape för F10 chart-data (RPC-funktion vs Supabase select GROUP-syntax — RPC är cleanaste)
- Segmented-control-komponent (@react-native-segmented-control vs NativeWind-baserat fallback)
- Chart-ikon-glyph på plan_exercise-rad (stats-chart / trending-up / analytics / bar-chart-outline — Ionicons)
- Tooltip-styling på data-punkt-tap (bubble vs callout-card vs inline-label)
- Empty-state-illustration (text + ikon vs bara text — default = ikon + text)
- Delete-pass affordance (header-right "..."-meny vs direkt 🗑-knapp vs sliding-action — default = "..."-meny)
- `useMemo` dependency-array exakt form
- Toast-implementation efter delete-pass (återanvänd Phase 5 pattern eller bygg context-provider)
- `useFocusEffect`-state-reset på `/history/[sessionId]`
- Pagination-edge-case när cursor=last-page-empty (TanStack getNextPageParam semantics)

## Deferred Ideas

- Edit-set inline på historiska pass — V1.1 (samtidigt med F17-UI + F11-RPE)
- Dedikerad Övningar-tab (4 tabs) — V2 (med F20 seed-library)
- Workout-hot-path chart-ikon mid-pass — V1.1 om soak visar behov
- V1.1 cleanup-cron för accumulating empty sessions
- Set-typ-badge per set-rad — V1.1 (F17-UI)
- Pan + zoom på 'All'-vy — V1.1 polish
- Reps-metric som ytterligare option i toggle — V1.1
- Filter på plan + sök på övning — V1.1
- Long-press context-menu på history-rad — V1.1
- Sektionsgruppering per månad/vecka — V1.1
- Sparkline mini-graf per övnings-card — V2 polish
- F22 Plan-scoped F7 — V2
- F23 "Repeat last session"-CTA — V2
- F24 Synlig pending-sync-badge — V2
- F25 Apple Health-integration — V2
- F27 CSV-export per session — V2
- F18 PR-detection — V1.1
- F19 Vilo-timer — V1.1
- Skeleton-loader — V1.1 polish
