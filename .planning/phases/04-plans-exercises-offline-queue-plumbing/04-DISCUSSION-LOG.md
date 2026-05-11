# Phase 4: Plans, Exercises & Offline-Queue Plumbing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 4-plans-exercises-offline-queue-plumbing
**Areas discussed:** F13 plumbing scope (Phase 4 vs Phase 5), Drag-to-reorder UX & library, Plan-editor scope & exercise-add UX, (tabs) skeleton breadth + sign-out placering

---

## F13 plumbing scope (Phase 4 vs Phase 5)

### Q1: Kod-organisation — refaktorera lib/query-client.ts till lib/query/-sub-folder?

| Option | Description | Selected |
|--------|-------------|----------|
| Behåll flat + lägg lib/query-keys.ts (Recommended) | Nuvarande lib/query-client.ts (33 LOC) registrerar setMutationDefaults + persistMutationCache inline. Ny fil lib/query-keys.ts för key-factory. 4-fil-split deferred till V1.1. | |
| Refaktorera nu till lib/query/{client,persister,network,keys}.ts | Följ research/ARCHITECTURE.md §3 ordagrant. Flytta focusManager+onlineManager från _layout.tsx till lib/query/network.ts. | ✓ |
| You decide | Plan 01 väljer baserat på hur mycket setMutationDefaults-yta som faktiskt landar. | |

**User's choice:** Refaktorera nu till lib/query/{client,persister,network,keys}.ts
**Notes:** Aligns Phase 4 med target-arkitekturen direkt; Phase 5 ärver utan ytterligare refaktor.

### Q2: AsyncStorage flush-on-background hook (Pitfall 1.3) — Phase 4 eller Phase 5?

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 5 äger — plans-CRUD är låg-frekvens (Recommended) | Persister default-throttle (1000ms) räcker för plan/exercise CRUD. Pitfall 1.3 är hot-path-grej (set-logging ≤3s). | ✓ |
| Phase 4 wirar full plumbing nu | AppState-listener i lib/query/network.ts som triggar persister.persistClient() vid background. Phase 5 ärver utan att röra. | |
| You decide | Plan 01 väljer baserat på om force-quit-testet består utan flush-hook. | |

**User's choice:** Phase 5 äger — plans-CRUD är låg-frekvens (Recommended)

### Q3: Redundant Zustand "pending mutations"-store (Pitfall 1.3 belt-and-braces) — Phase 4 eller Phase 5?

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 5 äger — belt-and-braces är set-specifik (Recommended) | Pitfall 1.3 specificerar redundansen för set-logging. Plans-CRUD ohotad av sub-3s SLA — TanStack persister räcker. | ✓ |
| Phase 4 wirar pendingMutationsStore nu | Synkron AsyncStorage-write 'pending plans/exercises'-lista parallellt med TanStack-persister. | |
| You decide | Plan 01 väljer. | |

**User's choice:** Phase 5 äger — belt-and-braces är set-specifik (Recommended)

### Q4: OfflineBanner — binär eller pending-mutations-counter?

| Option | Description | Selected |
|--------|-------------|----------|
| Binär banner i V1 (Recommended) | "Du är offline. Ändringar synkar när nätet är tillbaka." Triggas av onlineManager.isOnline()===false. F24 'sync-state-badge' är V2-deferred. | ✓ |
| Pending-mutations-counter ('Du är offline — 3 ändringar väntar') | Visar mutation-cache.findAll({status:'paused'}).length. Korsar V2-deferred F24. | |
| You decide | Plan 01 väljer. | |

**User's choice:** Binär banner i V1 (Recommended)

---

## Drag-to-reorder UX & library

### Q1: Drag-to-reorder library-val

| Option | Description | Selected |
|--------|-------------|----------|
| react-native-draggable-flatlist (Recommended) | De-facto-standard, byggt på gesture-handler 2.x (redan installerad). Battle-tested, ~3kb. | ✓ |
| Custom Reanimated 4 + gesture-handler | Bygg själv, full kontroll, 1-2 dagar mer arbete + edge-case-buggar. | |
| Up/down-pilknappar (V1 punt) | Inga drag alls i V1; missar tekniskt F4-acceptansens 'drag-att-ordna'. | |

**User's choice:** react-native-draggable-flatlist (Recommended)

### Q2: Drag-interaktion — hur startar drag-mode?

| Option | Description | Selected |
|--------|-------------|----------|
| Drag-handle-ikon alltid synlig (Recommended) | ≡-ikon till höger om varje rad. Discoverable, kolliderar inte med tap-on-row. iOS Reminders/Notes-mönster. | ✓ |
| Long-press på hela raden för att starta drag | Hela raden dragbar efter long-press. Less discoverable utan visuell hint. | |
| You decide | Plan 01 väljer baserat på röresultat. | |

**User's choice:** Drag-handle-ikon alltid synlig (Recommended)

### Q3: Reorder-mutation strategi

| Option | Description | Selected |
|--------|-------------|----------|
| Bulk-update av alla ändrade rader på onDragEnd (Recommended) | Diff vs gammal ordning, fire en mutation per ändrad rad med scope.id='plan:<id>' (Pitfall 5.3). Idempotent via klient-UUID. | ✓ |
| Single 'reorder'-mutation som tar hela array av {id, order_index} | Atomiskt på servern. Kräver RPC eller upsert med onConflict. Överkill för 5-10 övningar/plan. | |
| You decide | Plan 01 väljer. | |

**User's choice:** Bulk-update av alla ändrade rader på onDragEnd (Recommended)

### Q4: order_index-numrering

| Option | Description | Selected |
|--------|-------------|----------|
| Dense 0,1,2,3... — reorder skriver alla flyttade rader (Recommended) | Lätt att resonera om. iOS Reminders/Notes-stil. Trivial cost för 5-10 övningar/plan. | ✓ |
| Sparse 1024,2048,3072... — reorder skriver bara 1 rad | Klassisk fractional-index-trick. Pre-mature optimization för V1. | |
| You decide | Plan 01 väljer. | |

**User's choice:** Dense 0,1,2,3... — reorder skriver alla flyttade rader (Recommended)

---

## Plan-editor scope & exercise-add UX

### Q1: Plan-editor — vilka fält ska redigeras i V1?

| Option | Description | Selected |
|--------|-------------|----------|
| Plan: namn + beskrivning. Plan-exercise: bara tillagd/ordna/borttagen (Recommended) | Minimal V1. Targets/notes-fält i schemat exponeras INTE. Phase 5/6 läser inte targets i V1. | |
| Plan: namn + beskrivning. Plan-exercise: targets (sets/reps_min/reps_max) + notes | Full editor: per övning kan användaren sätta 'mål 3x8-12 reps + anteckning'. Mer UX-yta. | ✓ |
| You decide | Plan 01 väljer baserat på hur mycket UX-yta som ryms. | |

**User's choice:** Plan: namn + beskrivning. Plan-exercise: targets (sets/reps_min/reps_max) + notes
**Notes:** Targets i V1 ger användaren "3x8-12 reps på Bench"-planeringsförmåga trots att Phase 5 set-logging är fritt vikt+reps-input. Phase 5/6 behöver inte ändras.

### Q2: Plan-radering — hard-delete eller archive?

| Option | Description | Selected |
|--------|-------------|----------|
| Archive (set archived_at = now()) (Recommended) | Schemat har archived_at. Plans listas WHERE archived_at IS NULL. Bevarar historisk integritet. | ✓ |
| Hard-delete (DELETE FROM workout_plans) | ON DELETE SET NULL på workout_sessions.plan_id. Pitfall 4.4 vinkar. | |
| Båda (radera = soft-delete; permanent radera i arkiv-sub-vy) | Mer UI-yta. Onödig komplexitet för V1. | |

**User's choice:** Archive (set archived_at = now()) (Recommended)

### Q3: Exercise-add UX i plan-edit

| Option | Description | Selected |
|--------|-------------|----------|
| Inline-create-or-pick sheet (Recommended) | Bottom-sheet/full-screen modal med sökbar lista + 'Skapa ny övning' i toppen. F4-flow:n håller sig i plan-edit-context. Ingen separat Bibliotek-tabb. | ✓ |
| Separat 'Bibliotek'-tab + 'Lägg till från bibliotek'-flow | Användaren navigerar först till Bibliotek-tabb. Mer steg, mer UI. | |
| You decide | Plan 01 väljer. | |

**User's choice:** Inline-create-or-pick sheet (Recommended)

### Q4: Empty-state CTA på Planer-tabben

| Option | Description | Selected |
|--------|-------------|----------|
| Centered 'Inga planer än. Skapa din första plan' + primärknapp (Recommended) | Konventionellt iOS empty-state. Funktionell för både V1 och App Store. | ✓ |
| List med inline '+ Ny plan'-knapp högst upp; tom lista under | Mindre ceremoni. Risk: hård tom lista känns trasig vid första start. | |
| You decide | Plan 01 väljer. | |

**User's choice:** Centered 'Inga planer än. Skapa din första plan' + primärknapp (Recommended)

---

## (tabs) skeleton breadth + sign-out placering

### Q1: (tabs) breadth — vilka tabbar i Phase 4?

| Option | Description | Selected |
|--------|-------------|----------|
| Bara Planer-tabben (Recommended) | (tabs)/_layout.tsx + (tabs)/index.tsx (Planer). Historik tillkommer i Phase 6, Inställningar i Phase 7. | |
| Full V1-skeleton: Planer + Historik (placeholder) + Inställningar (placeholder) | Etablerar (tabs)-strukturen direkt. Historik visar 'Kommer i Phase 6'; Inställningar äger sign-out + 'Mer kommer i Phase 7'. | ✓ |
| Planer + Inställningar (placeholder för sign-out); Historik tillkommer i Phase 6 | Mellanväg. Sign-out får permanent hem; Historik adderas när den har innehåll. | |

**User's choice:** Full V1-skeleton: Planer + Historik (placeholder) + Inställningar (placeholder)

### Q2: Sign-out-knappens placering

| Option | Description | Selected |
|--------|-------------|----------|
| (tabs)/settings.tsx — permanent hem (Recommended) | Sign-out får sin slutliga plats. Phase 7 fyller på med dark-mode-toggle etc. (app)/index.tsx raderas. | ✓ |
| Behåll i (tabs)/index.tsx (Planer) som temp — flytta i Phase 7 | Mindre kod-förflyttning nu. Risk: inkonsistent UX om Inställningar-tab finns utan sign-out. | |
| You decide | Plan 01 väljer. | |

**User's choice:** (tabs)/settings.tsx — permanent hem (Recommended)

### Q3: Tab-labels — svenska eller engelska?

| Option | Description | Selected |
|--------|-------------|----------|
| Svenska: Planer / Historik / Inställningar (Recommended) | Matchar appens primärspråk. Phase 3 felmeddelanden är på svenska redan (D-15). | ✓ |
| Engelska: Plans / History / Settings | Förbereder för V2 App Store. V1 är personligt och svenskt — pre-mature i18n. | |
| You decide | Plan 01 väljer. | |

**User's choice:** Svenska: Planer / Historik / Inställningar (Recommended)

### Q4: Tab-bar-style

| Option | Description | Selected |
|--------|-------------|----------|
| Default Expo Router tab-bar med svenska labels + ikoner (Recommended) | expo-router 6 default Tabs.Screen + tabBarIcon (@expo/vector-icons Ionicons). F15 dark-mode-pairs via NativeWind/screenOptions. | ✓ |
| Custom tab-bar (own Pressable-row + reanimated) | Full kontroll, polish-arbete. Pre-mature för V1. | |
| You decide | Plan 01 väljer ikon-paket + dark-mode-styling. | |

**User's choice:** Default Expo Router tab-bar med svenska labels + ikoner (Recommended)

---

## Claude's Discretion

(Per CONTEXT.md `<decisions>` → "Claude's Discretion" — 9 items)
- Ionicons exakt ikon-namn (barbell vs barbell-outline vs fitness etc.)
- Bottom-sheet vs expo-router presentation modal för exercise-add-sheet
- Drag-handle-ikon-design (≡-glyph vs MaterialIcons drag-indicator vs grid-of-dots)
- Search-implementation i exercise-add-sheet (klient-side filter vs server-side ilike)
- Optimistic-update-snapshotting (helcache vs partial-key)
- `useOnlineStatus()` placering (lib/hooks/ vs lib/query/network re-export)
- Plan-edit autosave vs explicit-save-knapp + RHF mode
- Plan-list ordering (created_at desc — drag-bar är V1.1 polish)
- `exercises` LIST-query scope (anv. egna i V1; V2 lägger global seed)

## Deferred Ideas

(Per CONTEXT.md `<deferred>`)
- Sparse fractional `order_index` (V1.1+ optimization om plan-storlek växer)
- Restore-arkiverad-plan-flow (V1.1)
- Pending-mutations-counter i OfflineBanner (V2 — F24)
- AsyncStorage-flush-on-background hook (Phase 5 äger)
- Redundant Zustand pending-mutations-store (Phase 5 äger)
- Custom tab-bar (Phase 7 polish)
- Bottom-sheet via @gorhom/bottom-sheet (V1 default = expo-router modal)
- Förladdat globalt övningsbibliotek F20 (V2)
- "Senast använda övningar"-vy (V1.1 polish)
- Drag-att-ordna planer i plan-listan (V1.1 polish)
- Plan duplicate / "kopiera plan"-flow (V1.1)
- Plan-templates Push/Pull/Legs F30 (V2)
- Övning-export / CSV F27 (V2)
- Långpress-meny på plan-rad (V1.1 UX-polish)
- Energy-saver onlineManager-polling (Phase 5)
