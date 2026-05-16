# Phase 5: Active Workout Hot Path (F13 lives or dies) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-11
**Phase:** 5-active-workout-hot-path-f13-lives-or-dies
**Areas discussed:** Workout screen layout, Set input UX, F7 Senaste värdet, Session lifecycle UX

---

## Workout screen layout

### Q1: Hur navigerar användaren mellan övningarna under ett pass?

| Option | Description | Selected |
|--------|-------------|----------|
| Single-scroll lista | Alla planens övningar synliga i en lodrät scrollvy, card-per-övning med set-rader under. Matchar Strong/Hevy-paradigm. | ✓ |
| En-övning-per-skärm | Horisontell pager / swipe mellan övningar. Större fokus per övning. | |
| Accordion (collapsible) | Lista med expand-on-tap headers. Bra för 10+ övningar; sämre för 4-6. | |

**User's choice:** Single-scroll lista

### Q2: Var startar användaren passet ifrån?

| Option | Description | Selected |
|--------|-------------|----------|
| Från plan-detail | "Starta pass"-knapp på plans/[id].tsx — matchar PRD §5.2. | ✓ |
| Direkt från Planer-tabben | Long-press eller per-rad-knapp. Snabbare men minskar tydlighet. | |
| Båda | Knapp på båda ställena. Dubbla entry-points = test-surface. | |

**User's choice:** Från plan-detail

### Q3: Vart hamnar användaren när ett pass är aktivt?

| Option | Description | Selected |
|--------|-------------|----------|
| Dedikerad route | `/workout/[sessionId]` push:as på stacken. Kan navigera tillbaka till (tabs), pass lever bakom. | ✓ |
| Full-screen modal | `presentation:'fullScreenModal'` — blockerar tabs helt. Locked-in-känsla. | |
| Inline i (tabs)/index | Pass renderas på Planer-tabben. Grötigt — (tabs)/index dubblerar. | |

**User's choice:** Dedikerad route

### Q4: Vad visas i header per övnings-card?

| Option | Description | Selected |
|--------|-------------|----------|
| Övningsnamn + plan-targets | Title + chips: "3×8-12" (target_sets×reps_min-max) + utrustning. Matchar PRD §5.3. | ✓ |
| Bara övningsnamn | Minimalt — targets inte synliga. | |
| Namn + senaste passets summary | Header inkluderar "Förra: 82.5×8×3 set". Krockar med F7-per-rad-rendering (Area 3). | |

**User's choice:** Övningsnamn + plan-targets

### Q5: Hur ska scroll-positionen bete sig när ett nytt set loggas?

| Option | Description | Selected |
|--------|-------------|----------|
| Stanna kvar (no auto-scroll) | Användaren äger sin scroll. Nya raden renderas men skärmen flyttar inte. | ✓ |
| Auto-scroll till nästa tomma set-rad | Efter Klart scrollar till nästa tomma rad. Smidig men desorienterande. | |
| Auto-scroll bara mellan övningar | Hand-driven inom övning; auto vid övnings-skifte. | |

**User's choice:** Stanna kvar (no auto-scroll)

### Q6: Hur synliga ska nästa-övnings-progressionschips vara?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline counter per card | "3/3 set klart" som text-chip i card-header. | ✓ |
| Global toolbar med dots | Sticky bar top/bottom med • • • • ○. Tar plats men ger översikt. | |
| Ingen progress-indikator i V1 | Bara scroll-och-se. Risk för track-loss med 8+ övningar. | |

**User's choice:** Inline counter per card

### Q7: Var sitter "Avsluta pass"-knappen visuellt?

| Option | Description | Selected |
|--------|-------------|----------|
| Header right (Stack.Screen) | `<Stack.Screen options={{ headerRight }} />`. Centraliserad styling från Phase 4. | ✓ |
| Bottom CTA (sticky) | Stor fixed-bottom-knapp. Stor tap-target men tar 80pt screen-space. | |
| Bottom efter sista övningen | Synlig först vid scroll till botten. Naturligt slut men kräver scroll. | |

**User's choice:** Header right (Stack.Screen)

### Q8: Kan användaren lägga till ad-hoc övning till passet som inte fanns i planen?

| Option | Description | Selected |
|--------|-------------|----------|
| Nej, plan-set fixed i V1 | Matchar PRD §5.2; enklare scope. | ✓ |
| Ja, "+ Lägg till övning"-CTA i workout | Återanvänder exercise-picker; mer kod men flexibelt. | |
| Ja, men bara denna session | Kräver ny entitet eller flagga; tekniskt arbete passar V1.1. | |

**User's choice:** Nej, plan-set fixed i V1

### Q9: Hur hanteras när en övning i planen har 0 plan-targets (target_sets = NULL)?

| Option | Description | Selected |
|--------|-------------|----------|
| Visa tomma set-rader on-demand | En tom rad alltid längst ned; ny tom rad efter Klart. Counter "X/target" om satt, annars "X set". | ✓ |
| Användaren begär ny rad med + knapp | Explicit "+ Set". Extra tap per set motverkar ≤3s SLA. | |
| Förifyll target_sets st tomma rader | Bra för "planerat pass"-känsla men grötigt när anv. vill köra fler. | |

**User's choice:** Visa tomma set-rader on-demand

---

## Set input UX

### Q1: Hur ser den aktiva set-raden ut visuellt?

| Option | Description | Selected |
|--------|-------------|----------|
| Alltid-synlig inline-edit-rad | [vikt][reps][Klart]. Minimerar tap-count. Lifted form-state per Pitfall 1.4. | ✓ |
| Edit-modal över listan | Tap "+ Logga set" öppnar bottom-sheet. Mer struktur, fler tap, modal-state. | |
| Card-level submit (alla set i ett go) | Fyll alla rader, sedan "Spara alla". Bryter Pitfall 1.1 per-set-persistens. | |

**User's choice:** Alltid-synlig inline-edit-rad

### Q2: Vad pre-fylls i vikt+reps på den tomma set-raden?

| Option | Description | Selected |
|--------|-------------|----------|
| Förra settet i samma pass | Pitfall 6.2 pre-fill-pattern. Set 1 i passet pre-fylls från F7. | ✓ |
| Bara blank | Inga förväntningar. Bryter ≤3s SLA — stor numpad från noll varje gång. | |
| Förra settet i pass, MEN tom om F7 saknas | Pass-prefill om aktivt; annars blank (F7-fallback skippas). | |

**User's choice:** Förra settet i samma pass

### Q3: Hur knappas vikt/reps in?

| Option | Description | Selected |
|--------|-------------|----------|
| Numpad-only (decimal-pad) | `keyboardType="decimal-pad"`. Universellt för udda vikter; Pitfall 6.1. | ✓ |
| Numpad + smarta increment-chips | Quick-pick +1.25 / +2.5 / +5. Mer UI, risk för fel-tap. | |
| +/− stepper-knappar (ingen numpad) | Stora ±-knappar ≥56pt. Bra för sweaty fingers men långsamt för udda värden. | |

**User's choice:** Numpad-only (decimal-pad)

### Q4: Vad händer vid "Klart"-tap (commit-flow)?

| Option | Description | Selected |
|--------|-------------|----------|
| Optimistisk + osynlig undo | mutate direkt; ny tom rad rendreras; inget popup. Edit/delete via rad-interaktion. | ✓ |
| Optimistisk + snackbar 5s undo | Som ovan + "Set sparat · Ångra"-toast. Extra UI + race med nästa-set-tap. | |
| Inline-confirm: visuell flash + ljud | Raden flashar grönt + ev. Haptics.impactAsync. Snabbt, ingen UI-yta. | |

**User's choice:** Optimistisk + osynlig undo

### Q5: Hur kan användaren ändra eller ta bort ett redan loggat set?

| Option | Description | Selected |
|--------|-------------|----------|
| Tap = inline-edit, swipe-left = delete | iOS Reminders/Notes-mönster. **Divergerar från research/ARCHITECTURE.md §5.3 append-only.** | ✓ |
| Long-press → actionsheet | Inline-overlay "Redigera"/"Ta bort". Långsammare; long-press flaky med sweaty fingers. | |
| Bara delete, ingen edit i V1 | Append-only per research/ARCHITECTURE §5.3. Felvärden = swipe-delete + om-logg. | |

**User's choice:** Tap = inline-edit, swipe-left = delete
**Notes:** Användaren valde explicit avsteg från "append-only V1" — kräver två extra mutationKeys (`['set','update']` + `['set','remove']`). LWW-conflict-resolution på server-sidan behålls.

### Q6: Vilka Zod-valideringar ska ligga på set-input?

| Option | Description | Selected |
|--------|-------------|----------|
| Strikt: max 500kg, multipleOf(0.25), reps 1–60 | Matchar Pitfall 1.5. Stoppar 1255kg-typo + negativa reps. | ✓ |
| Löst: bara non-negative | `weight_kg.min(0)`, `reps.int().min(1)`. 1255kg glider igenom. | |
| Strikt + soft-warn på +30% från F7-max | "Är du säker?"-popup. Bra detection men mer arbete. | |

**User's choice:** Strikt: max 500kg, multipleOf(0.25), reps 1–60

### Q7: Hur identifieras 'samma set-position' på servern (set_number)?

| Option | Description | Selected |
|--------|-------------|----------|
| Klient-side count + 1 vid logg-tid | Matchar Pitfall 1.1. Replay idempotent via UUID. Inget unique-constraint. | ✓ |
| Server-side trigger beräknar | Trigger sätter set_number. Eliminerar race men bryter optimistic-flow offline. | |
| Klient-UUID + ignorera set_number | Använd completed_at desc. Bryter F7 "set 1: 82.5kg×8". | |

**User's choice:** Klient-side count + 1 vid logg-tid

---

## F7 Senaste värdet

### Q1: Hur visas "senaste värdet" per set-position?

| Option | Description | Selected |
|--------|-------------|----------|
| Set-position-aligned chip per rad | "Förra: 82.5kg × 8" per aktiv rad. Matchar PRD F7-acceptans + Pitfall 6.3. | ✓ |
| Aggregate header per övning | "Förra passet: 82.5kg × 8 × 3 set" som peak+summa. Krockar med D-04 header. | |
| Båda: chip per rad + header-summary | Mest kontext men dubbel-rendering, svår sync över scroll. | |

**User's choice:** Set-position-aligned chip per rad

### Q2: Vad räknas som "förra värdet"-källan?

| Option | Description | Selected |
|--------|-------------|----------|
| Senaste finished_at-pass för samma övning | Query med `finished_at IS NOT NULL`, filtrera `set_type='working'`, gruppera per `set_number`. Exklusive aktuellt pass. | ✓ |
| Senaste exercise_set per (exercise_id, set_number) | Inte session-bundet. Risk för inkonsekvent källa per rad. | |
| Senaste pass:s peak vikt | Bara MAX(weight_kg). Förlorar set-position-context. | |

**User's choice:** Senaste finished_at-pass för samma övning

### Q3: När ska F7-datat hämtas och cachas?

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-fetch vid Starta pass | Fire useQuery per exercise vid session-start. Cache offline från första millisekunden. | ✓ |
| Per-row lazy fetch | Query vid viewport-entry. Sparar requests men flicker; offline = "—". | |
| Fetch på plan-detail-mount + cache | Pre-fetch när anv. öppnar plans/[id]. Tidigare warming. | |

**User's choice:** Pre-fetch vid Starta pass

---

## Session lifecycle UX

### Q1: Hur upptäcks och hanteras en oavslutad session vid cold-start?

| Option | Description | Selected |
|--------|-------------|----------|
| Modal-prompt på (tabs)/index | Inline-overlay-modal "Återuppta passet från [HH:MM]?" + Återuppta/Avsluta. Phase 4-konvention. | ✓ |
| Auto-redirect till workout-rutten | Route direct till /workout/<id>. Snabbast men anv. förlorar kontroll. | |
| Banner på (tabs)/index, ingen modal | Yellow banner överst. Mindre intrusive men kan ignoreras → eviga pass (Pitfall 1.6). | |

**User's choice:** Modal-prompt på (tabs)/index

### Q2: Finns en persistent "Pågående pass"-indikator medan passet är aktivt?

| Option | Description | Selected |
|--------|-------------|----------|
| Banner i (tabs)/_layout.tsx | Återanvänder OfflineBanner-mount-position. Synlig på alla tabbar. | ✓ |
| Ingen indikator, dedikerad route räcker | Anv. måste komma ihåg själv. Låg visibility. | |
| FAB i (tabs)/index bara | Floating button på Planer-tabben. Tar plats men kontextuellt. | |

**User's choice:** Banner i (tabs)/_layout.tsx

### Q3: Hur ser "Avsluta pass"-flowet ut (per Pitfall 6.6)?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline-overlay confirm + navigate hem | Phase 4-konvention. Empty session OK; "Passet sparat"-toast på (tabs)/index. | ✓ |
| Single-tap, ingen confirm | Snabbast men misstap = pre-mature finish. | |
| 6h auto-finish + manual button | Confirm + server/klient-cron. Mer kod, låg V1-payoff. | |

**User's choice:** Inline-overlay confirm + navigate hem

### Q4: Hot-path durability — hur hårt pålägger vi belt-and-braces?

| Option | Description | Selected |
|--------|-------------|----------|
| Flush-on-background + persister throttle 500ms | AppState-listener flushar; throttle 1000→500ms. Trust TanStack-persister. | ✓ |
| Flush-on-background + redundant Zustand belt-and-braces | + parallell Zustand-store som dual-writes set-mutations. Extreme paranoia. | |
| Bara TanStack persister (default throttle) | Lita på default. Risk för Pitfall 1.3 (force-quit mid-throttle). | |

**User's choice:** Flush-on-background + persister throttle 500ms

---

## Claude's Discretion

- `lib/queries/last-value.ts` API-shape (Map vs nested object vs separate hook per setNumber) — Plan 02
- `active-session-banner.tsx` styling (färg, ikon, animation) — Phase 5 UI-spec-agent
- Toast-implementation för "Passet sparat" — Reanimated FadeIn/FadeOut vs context-provider — Plan 02
- `useFocusEffect` state-reset på workout/[sessionId].tsx — Plan 02 verifierar konsekvens med Phase 4 D-08-pattern
- Numpad-keyboard-dismiss-trigger — `keyboardWillHide` vs `Keyboard.dismiss` på card-background — Plan 02
- RHF mode för set-input-form — `'onChange'` vs `'onSubmit'` (Phase 3 D-15-precedent säger onSubmit) — Plan 02
- Empty-state-fallback på workout/[sessionId] när plan har 0 övningar — defensive UI vs router-guard — Plan 02
- `useExercisesQuery + Map<id,name>` vs `select('*, exercises ( name )')` join för exercise-name — Phase 4-konvention är client-side lookup; Plan 02 motiverar om deviation
- Set-row visuell skillnad mellan loggad och tom rad — `bg-green-50/40` med check-ikon vs samma `bg-gray-100`-ton — UI-spec-agent

## Deferred Ideas

- Soft-warn på vikt > F7_max * 1.3 (Pitfall 1.5) — V1.1 polish om soak visar typo-frekvens
- Haptic feedback (`expo-haptics`) på Klart — V1.1 om visuell flash inte räcker
- PR-detection F18 (Epley) — V1.1
- Vilo-timer F19 (`expo-keep-awake` + `expo-notifications`, JS-suspension-trap) — V1.1 research-flag
- Sparkline mini-graf per övning-card — V2 polish
- "Senast använda övningar"-shortcut — V1.1
- Plan-scoped F7 — V2 (F22)
- "Repeat last session"-CTA på hemskärm — V2 (F23)
- Pending-sync-badge med count — V2 (F24)
- Ad-hoc-övning mid-pass — V1.1
- 6h auto-finish av abandoned sessions — V1.1
- Redundant Zustand pending-store (Phase 4 D-03 belt-and-braces) — bara om V1-soak visar tappade set
- Multi-unfinished-session edge case — V1.1
- Long-press-meny på loggad set-rad — V1.1 polish
- Set-typ-toggling (F17-UI) under aktivt pass — V1.1
- RPE-fält per set (F11) — Phase 7 V1 Kan
- Anteckningar per pass (F12) — Phase 7 V1 Kan
- Apple Health-integration — V2
