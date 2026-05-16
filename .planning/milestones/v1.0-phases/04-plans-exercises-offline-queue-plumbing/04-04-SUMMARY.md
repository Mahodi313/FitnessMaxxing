---
phase: 04-plans-exercises-offline-queue-plumbing
plan: 04
subsystem: ui
tags: [drag-reorder, draggable-flatlist, rls-regression, manual-uat, offline-replay, modal-overlay-pattern, ui-spec-amendment, freezeOnBlur, gesture-handler]

requires:
  - phase: 04
    plan: 01
    provides: useReorderPlanExercises(planId) two-phase orchestrator; useOnlineStatus; setMutationDefaults wiring; resumePausedMutations subscriber
  - phase: 04
    plan: 02
    provides: (tabs) skeleton + Planer list + plans/new (create-side end-to-end); OfflineBanner global mount
  - phase: 04
    plan: 03
    provides: plans/[id].tsx with FlatList swap-point; exercise-picker + targets-edit modal routes; ActionSheetIOS + Alert.alert overflow patterns (later superseded — see Gap-Closure)
  - phase: 02
    provides: test-rls.ts cross-user gate; admin/clientFor/assertEmpty/assertWriteBlocked helpers
provides:
  - DraggableFlatList integration in plans/[id].tsx with two-phase reorder algorithm wired to onDragEnd
  - Phase 4 cross-user RLS regression coverage (3 new assertion blocks: workout_plans archive + plan_exercises CRUD + exercises insert) — 29 assertions total
  - app/scripts/manual-test-phase-04-airplane-mode.md (6-step UAT checklist; Success Criteria #4 + #5 gate)
  - "Inline absolute-positioned overlay" canonical pattern for destructive-confirm + overflow menus (replaces Modal portal + Alert.alert / ActionSheetIOS)
  - useFocusEffect modal-state-reset pattern paired with freezeOnBlur: true
  - mutate(payload, { onError }) as the canonical offline-safe submit pattern (mutateAsync hangs under networkMode: 'offlineFirst')
  - presentation: 'modal' declared at layout level (static react-native-screens prop) — picker + targets-edit
  - initialData from list cache as the canonical offline-first detail-cache seed
  - Theme-aware backdrop on GestureHandlerRootView + root Stack contentStyle (eliminates modal/swipe white flash)
  - Centralized (app) Stack header styling — kills "(tabs)" back-title artifact; unified dark-mode-aware header
affects: [05 (active workout hot path inherits all UX patterns + offline-safe submit + modal-overlay convention + initialData seed for session-detail), 06 (history list inherits header styling + freezeOnBlur), 07 (settings inherits theme-aware header + dark-mode toggle will respect centralized headerStyle), V1.1 (any future destructive-confirm or overflow surface uses the inline-overlay pattern instead of Modal portal or Alert.alert)]

tech-stack:
  added:
    - none — react-native-draggable-flatlist already installed in Plan 04-01 dep landing
  patterns:
    - "GestureHandlerRootView at the absolute root (above QueryClientProvider) is required for any DraggableFlatList or other react-native-gesture-handler consumer to function. Missing this trips the canonical 'must be descendant of GestureHandlerRootView' runtime error. Theme-aware backdrop (useColorScheme-bound) on the wrapper closes the iOS modal-swipe white-flash regression at the gesture surface."
    - "Inline absolute-positioned overlay (NOT Modal portal) is the canonical pattern for destructive-confirm dialogs and overflow menus going forward. Modal portal + NativeWind/flex composition is unreliable — layout primitives silently drop inside the iOS Modal portal. Use absolutely-positioned <View> overlays with explicit RN StyleSheet color tokens (not className) for predictable theming."
    - "freezeOnBlur: true (react-navigation) requires useFocusEffect modal-state reset. Without the reset, modal-open state persists across navigation transitions because the screen is frozen rather than unmounted. Pattern: useFocusEffect(useCallback(() => () => { setShowOverflowMenu(false); setShowArchiveConfirm(false); }, []))."
    - "mutate(payload, { onError, onSuccess }) is the offline-safe submit pattern. mutateAsync awaits the mutationFn return; under networkMode: 'offlineFirst' the mutation is PAUSED (not resolved) when offline, so the awaiting form handler hangs indefinitely. Solution: switch to fire-and-forget mutate() with optimistic-update-driven UI feedback; onError handles real errors when they fire."
    - "presentation: 'modal' is a STATIC react-native-screens prop and must be declared in the Stack.Screen child at the layout level — NOT in <Stack.Screen options={...}> from inside the route component. The dynamic options pathway does not propagate presentation."
    - "initialData read from the list cache via queryClient.getQueryData(plansKeys.list()).find(p => p.id === id) is the canonical offline-first detail-cache seed. Combined with onMutate dual-writing the LIST + DETAIL caches, offline-created plans navigate to plan-detail instantly without 'Laddar…' hangs."
    - "Centralized (app) Stack headerStyle + contentStyle defines theme tokens once at the layout level. Per-screen <Stack.Screen options={{ title }}> only sets dynamic title; static styling is inherited. Eliminates (tabs) back-title artifact and lets Phase 5/6/7 add new screens without re-declaring style on every screen."

key-files:
  created:
    - app/scripts/manual-test-phase-04-airplane-mode.md (6-step UAT checklist)
  modified:
    - app/app/(app)/plans/[id].tsx (drag-reorder integration + offline-safe submit + inline-overlay archive-confirm + inline-overlay overflow menu + exercise-name resolution + useFocusEffect reset)
    - app/app/(app)/plans/[id]/exercise-picker.tsx (offline-safe submit via mutate + own GestureHandlerRootView wrapper + + duplicate-literal drop)
    - app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx (offline-safe submit via mutate + own GestureHandlerRootView wrapper)
    - app/app/(app)/_layout.tsx (centralized header styling + contentStyle + freezeOnBlur + presentation:'modal' for picker + targets-edit)
    - app/app/_layout.tsx (root: GestureHandlerRootView wrap + theme-aware backdrop + root Stack contentStyle)
    - app/components/offline-banner.tsx (bg-yellow-200 + border-yellow-400 for visible yellow identity — UI-SPEC amendment)
    - app/app.json (Info.plist CADisableMinimumFrameDurationOnPhone for ProMotion 120Hz in prod builds)
    - app/app/(app)/(tabs)/index.tsx (offline-safe submit + dual-write LIST + DETAIL caches in plan-create onMutate + initialData seed pattern)
    - app/app/(app)/plans/new.tsx (offline-safe submit via mutate; dual-write LIST + DETAIL caches)
    - app/scripts/test-rls.ts (3 new assertion blocks — Phase 4 cross-user gate; total 29 assertions)
    - .planning/phases/04-plans-exercises-offline-queue-plumbing/04-UI-SPEC.md (OfflineBanner color amendment: bg-yellow-100 → bg-yellow-200 + border-yellow-400)
  deleted:
    - none

key-decisions:
  - "Modal portal layout is unreliable for NativeWind/flex composition — established as architectural pattern after multiple iterations. Initially attempted: Alert.alert (Plan 03) → themed Modal portal (3a094eb) → bottom-sheet Modal (87b1d9b) → all failed in iOS Modal portal due to silent drop of NativeWind/flex primitives. Final canonical pattern: inline absolute-positioned <View> overlay (954c480 + e07029a) with explicit RN StyleSheet color tokens. Future destructive-confirms + overflow menus use this; Modal portal is reserved for full-screen routes only (which Expo Router's presentation:'modal' handles correctly)."
  - "mutate(payload, { onError }) replaces mutateAsync(payload).then(...) as the canonical offline-safe submit pattern across all 5 forms (plan-create, plan-edit, exercise-create, plan_exercise-add, plan_exercise-edit). Plan 03 used mutateAsync.then with networkMode: 'offlineFirst' from Plan 01 — paused mutations under offlineFirst never resolve mutateAsync, so offline submits hung indefinitely. Decision: fire-and-forget mutate() + optimistic-update for UI feedback. The hang was the single biggest UAT discovery (5d953b6)."
  - "freezeOnBlur: true (da65717) for immediate JS-thread relief in Expo Go + ProMotion 120Hz via Info.plist CADisableMinimumFrameDurationOnPhone (production builds only). freezeOnBlur surfaced a secondary bug — modal-open state persists across navigation because screens are frozen rather than unmounted. Resolved by adding useFocusEffect resets to plans/[id].tsx (af6930c)."
  - "UI-SPEC §Color amended: OfflineBanner background bg-yellow-100 → bg-yellow-200 + border-yellow-400 (cfc1dc8). The original pale yellow tokens read as near-white on light-mode iOS, defeating the warning-color identity. UAT discovery — visible only on real device, not in simulator preview."
  - "initialData from list cache + dual-write onMutate pattern (b87bddf + eca0540) for offline-first plan-detail navigation. Plan 03 used a binary loading gate (planPending || !plan) which hung at 'Laddar…' forever when navigating to an offline-created plan: the DETAIL cache wasn't seeded by plan-create's onMutate, and a paused refetch never resolves. Fix: onMutate writes the new plan to BOTH the LIST and DETAIL caches; plan-detail seeds from LIST via initialData; loading gate tightens to !plan only."
  - "Centralized (app) Stack header styling (b57d1c2) replaces per-screen <Stack.Screen options={{ headerStyle, headerTintColor }}>. Eliminates the '(tabs)' back-title artifact on push transitions and unifies dark-mode-aware header across all (app) routes. Future Phase 5/6/7 screens inherit automatically by adding to the same layout."

requirements-completed: [F4]
# F2 + F3 were closed in Plans 02 + 03; F4 reorder side closes here

duration: ~planning-day (planned 3-task autonomous block + manual UAT block; gap-closure block was ~6 hours of UAT-driven iteration)
completed: 2026-05-10
---

# Phase 4 Plan 04: Drag-Reorder Integration + Cross-User RLS Gate + Manual UAT Summary

**Closes Phase 4 by integrating `react-native-draggable-flatlist` into plan-detail via Plan 01's two-phase reorder orchestrator (Task 1), extending the cross-user RLS regression gate with 3 new assertion blocks for Phase 4 mutation paths (Task 2), and shipping + executing the 6-step manual airplane-mode UAT checklist that closes Success Criteria #4 + #5 (Tasks 3 + 4). The 4 planned tasks completed cleanly, but the manual UAT surfaced ~18 regressions that required substantial gap-closure work — most concerning the canonical offline-safe submit pattern (mutate vs mutateAsync) and the Modal portal layout reliability under NativeWind/flex composition. The gap-closure block established several architectural patterns documented inline for downstream phases.**

## Performance

- **Duration:** ~planning day; Tasks 1-3 autonomous block ~15 min; manual UAT block ~6 hours (3 sessions of iPhone iteration with the user on real device + Supabase Studio + Expo Go).
- **Completed:** 2026-05-10
- **Tasks (planned):** 4 (3 autonomous + 1 checkpoint:human-verify)
- **Commits (total):** 22 (4 planned + 18 gap-closure)
- **Files created:** 1 (manual-test-phase-04-airplane-mode.md)
- **Files modified:** 10 (plans/[id].tsx, exercise-picker.tsx, plan_exercise/[id]/edit.tsx, (app)/_layout.tsx, app/_layout.tsx, offline-banner.tsx, app.json, (tabs)/index.tsx, plans/new.tsx, test-rls.ts) + 1 spec amendment (UI-SPEC.md)
- **Files deleted:** 0

## Accomplishments (Planned 4 Tasks)

- **F4 reorder side closed end-to-end (Task 1)**: `plans/[id].tsx` swaps `<FlatList>` for `<DraggableFlatList>` (`2501ac8`); PlanExerciseRow extends with the leading drag-handle Pressable column (Ionicons `reorder-three-outline`, `accessibilityLabel="Drag för att ändra ordning"`, `onLongPress={drag}`, 48pt touch target via p-3); `<ScaleDecorator>` wraps each row; `onDragEnd` calls `useReorderPlanExercises(id).reorder(data)` — Plan 01's two-phase orchestrator owns FK + unique-constraint safety. DraggableFlatList is the screen-level scroller (NOT wrapped in ScrollView per Pitfall 8.5).
- **CLAUDE.md "Cross-user verification is a gate" satisfied (Task 2)**: `app/scripts/test-rls.ts` extended with 3 new assertion blocks (`c1cb8de`) — (a) workout_plans archive cross-user UPDATE blocked, (b) plan_exercises SELECT/INSERT/UPDATE/DELETE cross-user blocked + integrity check (User A row survives User B attempts), (c) exercises INSERT with cross-user `user_id` blocked. `npm run test:rls` exits 0 with 29 assertions total (22 Phase 2 originals + 4 Phase 4 plan_exercises CRUD + 3 Phase 4 archive/exercises/integrity).
- **Success Criteria #4 + #5 gate authored (Task 3)**: `app/scripts/manual-test-phase-04-airplane-mode.md` (`79ac8b8`) — 6-section checklist: Pre-test setup, Step 1 (automated gates — 8 commands), Step 2 (negative-index smoke test per RESEARCH Assumption A1), Step 3 (airplane + create + drag), Step 4 (force-quit + cache hydration), Step 5 (reconnect + Studio verify), Step 6 (captive-portal scenario per RESEARCH Assumption A3), Cleanup, Sign-off. Every step has binary pass/fail checkboxes; banner copy verbatim from CONTEXT.md D-05.
- **Success Criteria #4 + #5 signed off on real iPhone (Task 4)**: User completed all 6 UAT steps on 2026-05-10 and replied `approved`. Steps 1+2 were orchestrator-verified pre-checkpoint (automated gates green; `test-reorder-constraint.ts` proved negative-offset behavior at the DB layer); Steps 3–6 were user-verified during the gap-closure iteration block (the regressions discovered during Step 3 drove every fix commit between `dcd502b` and `6b8c604`).

## Task Commits (Planned 4 Tasks)

Each planned task was committed atomically on `gsd/phase-04-plans-exercises-offline-queue-plumbing`:

1. **Task 1: DraggableFlatList integration in plans/[id].tsx** — `2501ac8` (feat)
2. **Task 2: test-rls.ts Phase 4 cross-user assertions (22 + 4 + 3 = 29 PASS)** — `c1cb8de` (test)
3. **Task 3: manual airplane-mode UAT checklist** — `79ac8b8` (test)
4. **Task 4: checkpoint:human-verify — UAT signed off `approved` by user 2026-05-10** — (no commit; user sign-off on the checklist authored in commit `79ac8b8` + `4088165` checkpoint marker)
5. **Checkpoint marker** — `4088165` (docs — pause-for-UAT STATE checkpoint)

## Manual UAT — All 6 Steps PASS

| Step | What | Outcome | Verifier |
|------|------|---------|----------|
| 1. Pre-flight automated gates | 8 commands: `npx tsc --noEmit`, `npm run lint`, `npm run test:rls`, `npm run test:plan-schemas`, `npm run test:exercise-schemas`, `npm run test:plan-exercise-schemas`, `npm run test:reorder-constraint`, `npm run test:upsert-idempotency` | all exit 0 | Orchestrator (pre-checkpoint) |
| 2. Negative-index smoke test | `UPDATE plan_exercises SET order_index = -1 WHERE id = ...` succeeds (no CHECK >= 0 constraint exists) — proves RESEARCH Assumption A1 | PASS | Orchestrator (pre-checkpoint via `test-reorder-constraint.ts`) |
| 3. Airplane + create + drag | Enable airplane → OfflineBanner shows within 2s → create plan → add 3 exercises via `+ Skapa ny övning` → drag-reorder | PASS (after gap-closure block) | User (real iPhone) |
| 4. Force-quit + cache hydration | Swipe-up force-quit → reopen Expo Go offline → sign-in skipped → Planer tab + plan-detail hydrate from cache → dragged order persists | PASS | User (real iPhone) |
| 5. Reconnect + Studio verify | Disable airplane → OfflineBanner disappears within 2s → wait 10–15s → Supabase Studio shows all rows; no duplicates; no FK violations; order_index matches dragged order | PASS | User (real iPhone) |
| 6. Captive-portal scenario | NetInfo-online + Supabase-unreachable: mutations pause (not error); flush on connectivity restore | PASS | User (real iPhone) |

Sign-off: 2026-05-10 by user (`approved`).

## Gap-Closure Commits (UAT-driven, post-checkpoint)

The manual UAT surfaced ~18 regressions invisible to automated gates. All landed on `gsd/phase-04-plans-exercises-offline-queue-plumbing` between `4088165` (checkpoint) and `6b8c604` (HEAD). Categorized:

### Gesture-handler setup (1 commit)

- `dcd502b` **fix(04-04): wrap root in GestureHandlerRootView** — DraggableFlatList tripped the canonical "must be descendant of GestureHandlerRootView" runtime error. `app/_layout.tsx` now wraps the entire provider tree in `<GestureHandlerRootView style={{ flex: 1 }}>`. Modal-route screens (exercise-picker + targets-edit) also got their own GestureHandlerRootView wrappers for gesture support inside the modal portal (covered in `5d953b6`).

### Offline UX gaps (4 commits)

- `5d953b6` **fix(04-04): use mutate (not mutateAsync) in 5 forms** — biggest UAT discovery. Plan 03 used `await createPlan.mutateAsync(...).then(router.replace)` in 5 forms. Under Plan 01's `networkMode: 'offlineFirst'`, mutations PAUSE when offline rather than rejecting, so the awaiting handler hangs indefinitely. Fix: switch to `mutate(payload, { onError, onSuccess })` — fire-and-forget with optimistic-update-driven UI feedback. Also wraps exercise-picker + targets-edit in their own `GestureHandlerRootView`. Affects: `plans/new.tsx`, `plans/[id].tsx` (meta-form Spara), `plans/[id]/exercise-picker.tsx` (pick + create-and-add), `plans/[id]/exercise/[planExerciseId]/edit.tsx`, `(tabs)/index.tsx` (delete-row inline).
- `eca0540` **fix(04-04): dual-write LIST + DETAIL caches in plan-create onMutate** — offline-created plan navigated to plan-detail and hung at "Laddar…" forever. Root cause: `useCreatePlan.onMutate` wrote only to the LIST cache; the DETAIL cache (`plansKeys.detail(id)`) was empty; the auto-refetch was paused (offline) so `usePlanQuery(id)` never resolved. Fix: `onMutate` now dual-writes `queryClient.setQueryData(plansKeys.detail(newPlan.id), newPlan)` AND appends to `plansKeys.list()`.
- `b87bddf` **fix(04-04): seed plan detail from list cache via initialData + tighten loading gate** — completes the offline-first detail navigation contract. `usePlanQuery(id)` now passes `initialData: () => queryClient.getQueryData(plansKeys.list())?.find(p => p.id === id)`. Loading gate in `plans/[id].tsx` tightens from `planPending || !plan` to `!plan` only — `planPending` stays true while paused-refetching, so the old gate hung even with seeded data.
- `44c2138` **fix(04-04): set contentStyle.backgroundColor on (app) Stack** — modal swipe-to-dismiss gesture briefly exposed a white backdrop under the swipe-down animation, breaking the dark-mode coverage convention.

### Visual / design polish (8 commits)

- `cfc1dc8` **fix(04-04): bump OfflineBanner saturation + add border** — original `bg-yellow-100` read as near-white on light-mode iPhone; failed real-device visibility test (passes in simulator preview). UI-SPEC §Color amended: `bg-yellow-100 dark:bg-yellow-900` → `bg-yellow-200 dark:bg-yellow-800` + `border-b border-yellow-400 dark:border-yellow-600`.
- `b57d1c2` **fix(04-04): centralize header styling + minimal back-button in (app) stack** — eliminates "(tabs)" back-title artifact (Stack push from a tab default-routes the back-title to "(tabs)") and unifies dark-mode-aware `headerStyle` / `headerTintColor` / `headerTitleStyle` across all (app) routes. Future Phase 5/6/7 screens inherit by adding to the same layout.
- `3bfaba8` **fix(04-04): show exercise names in plan-detail rows** — Plan 03 row used `Övning <8-char-id>` fallback because `usePlanExercisesQuery` selects `*` (no JOIN). Resolved client-side: PlanExerciseRow now reads `useExercisesQuery()` + builds a `Map<id, name>` for O(1) lookup. Avoids upstream RLS-relations complexity for V1.
- `85328c4` **fix(04-04): drop redundant '+' literal in exercise-picker CTA + empty-state copy** — copy review caught a `+` prefix duplicated by an Ionicons `add-outline` glyph next to it. Reads as `+ + Skapa…`. Removed.
- `1f4d8d0` **fix(04-04): declare modal presentation at layout level (picker + targets-edit)** — `presentation: 'modal'` is a STATIC react-native-screens prop. Setting it from `<Stack.Screen options={{ presentation: 'modal' }} />` inside the route component does not propagate; must be declared in the `Stack.Screen` child at the layout level (`app/(app)/_layout.tsx`).
- `da65717` **fix(04-04): smoother navigation — freezeOnBlur + ProMotion 120Hz infoPlist** — `freezeOnBlur: true` at the layout level relieves the JS thread immediately when a screen blurs (helpful in Expo Go); `app.json` adds `expo.ios.infoPlist.CADisableMinimumFrameDurationOnPhone: true` for production builds (unlocks 120Hz on ProMotion devices). Side effect: surfaced the modal-state-reset bug fixed in `af6930c`.
- `6b8c604` **fix(04-04): theme-aware backdrop on GestureHandlerRootView + root Stack contentStyle** — final white-flash regression. Prior `contentStyle` fix only covered the (app) Stack pushes; root Stack and GestureHandlerRootView had no theme-aware background, so during certain transitions a white flash briefly leaked through the gesture surface. Resolved with `useColorScheme()`-bound backgroundColor on both wrappers.

### Confirm-dialog + overflow-menu evolution (5 commits → 1 canonical pattern)

The overflow menu + archive-confirm went through 5 iterations as the team converged on the canonical pattern. Worth documenting because the lessons here apply to every destructive-confirm + overflow surface from Phase 5 forward.

1. **Plan 03 baseline:** `ActionSheetIOS` overflow + `Alert.alert` destructive confirm — works but doesn't theme on dark mode + violates UI-SPEC §Destructive confirmation (uses iOS-native components instead of the in-app theme tokens).
2. `3a094eb` **fix: themed archive-confirm Modal replaces Alert.alert** — first attempt at theming. Replaces `Alert.alert` with a `<Modal transparent visible animationType="fade">` portal containing NativeWind-styled View/Text. Layout primitives silently dropped inside the iOS Modal portal — buttons rendered but the overlay sometimes lacked visible structure.
3. `87b1d9b` **fix: themed bottom-sheet overflow menu replaces ActionSheetIOS** — same approach for the overflow menu. Same layout-drop issue.
4. `af6930c` **fix: repair broken overflow Modal layout + reset modal state on focus** — partial repair + discovered the `freezeOnBlur` interaction: modal-open state persists across navigation because screens are frozen rather than unmounted. Added `useFocusEffect` reset pattern. Layout drops still happen intermittently.
5. `954c480` **fix: overflow menu becomes an iOS-style popover anchored top-right** — ABANDON the Modal portal entirely. Replace with an inline `<View style={{ position: 'absolute', top: ..., right: 16, ... }}>` overlay rendered directly in the screen tree. Use explicit RN `StyleSheet` color tokens (not NativeWind className) for theming inside the overlay — predictable across React Native versions.
6. `feb060e` **fix: anchor overflow popover just below header** — refinement: anchor `top: 4` (just below the header) instead of `top: 100` (was floating over the form area).
7. `e07029a` **fix: archive-confirm dialog becomes inline overlay** — apply the same inline-overlay pattern to the destructive-confirm dialog. Now BOTH the overflow menu AND the archive-confirm use the canonical pattern.

**Canonical pattern (going forward):** inline absolute-positioned `<View>` overlay + explicit RN StyleSheet tokens + `useFocusEffect` state reset + `freezeOnBlur: true` at layout level. Modal portal is reserved for full-screen routes (which Expo Router's `presentation: 'modal'` declared at layout level handles correctly — separate use case).

## UI-SPEC Amendments

- **§Color, §Accessibility, §Wave 1 checklist** — OfflineBanner background `bg-yellow-100 dark:bg-yellow-900` → `bg-yellow-200 dark:bg-yellow-800` + `border-b border-yellow-400 dark:border-yellow-600`. Surfaced by UAT Step 3: pale yellow read as near-white on light-mode iPhone, defeating warning-color identity. Recorded inline in `04-UI-SPEC.md` as an amendment (commit `cfc1dc8`).

## Notable Architectural Decisions (Going Forward)

1. **Modal portal layout is unreliable for NativeWind/flex composition.** Future destructive-confirms + overflow menus use inline absolute-positioned `<View>` overlays with explicit RN StyleSheet color tokens. Modal portal is reserved for full-screen routes (where Expo Router's `presentation: 'modal'` handles it).
2. **`freezeOnBlur: true` requires `useFocusEffect` to reset modal state.** Frozen screens retain state across navigation; without reset, a previously-open overlay re-appears when the screen un-freezes. Pattern: `useFocusEffect(useCallback(() => () => { setShowOverflowMenu(false); setShowArchiveConfirm(false); }, []))`.
3. **`mutate(payload, { onError })` is the canonical offline-safe submit pattern.** `mutateAsync` is not safe under `networkMode: 'offlineFirst'` because paused mutations never resolve the awaitable. Fire-and-forget mutate + optimistic-update-driven UI feedback + onError for real failures.
4. **`presentation: 'modal'` must be declared at the layout level.** It's a static react-native-screens prop that does not propagate from `<Stack.Screen options>` inside a route component.
5. **`initialData` from list cache is the canonical offline-first detail-cache seed.** Pair with onMutate dual-writing both LIST and DETAIL caches to make offline-created records navigate to their detail screen instantly.
6. **Centralized (app) Stack header styling** kills the "(tabs)" back-title artifact and unifies theme tokens. Per-screen `Stack.Screen options` only sets dynamic title.
7. **Theme-aware backdrop on GestureHandlerRootView + root Stack contentStyle** is required to eliminate transition white-flashes; the (app) Stack contentStyle alone is insufficient because gesture surfaces and root Stack transitions have their own backdrops.

## Verification Gates

All green at plan completion (2026-05-10):

| Gate | Result |
|---|---|
| `npx tsc --noEmit` (in app/) | exit 0 |
| `npm run lint` (in app/) | exit 0 (0 errors, 0 warnings) |
| `npm run test:rls` | ALL 29 ASSERTIONS PASSED (22 Phase 2 + 4 Phase 4 plan_exercises + 3 Phase 4 archive/exercises/integrity) |
| `npm run test:plan-schemas` | All 7 schema cases passed |
| `npm run test:exercise-schemas` | All 8 schema cases passed |
| `npm run test:plan-exercise-schemas` | All 8 schema cases passed (incl. cross-field refine) |
| `npm run test:reorder-constraint` | ALL ASSERTIONS PASSED (incl. negative-index proof + 23505 negative control) |
| `npm run test:upsert-idempotency` | ALL ASSERTIONS PASSED |
| `npm run test:offline-queue` | ALL ASSERTIONS PASSED |
| `npm run test:sync-ordering` | ALL ASSERTIONS PASSED |
| Manual airplane-mode UAT (6 steps) | PASS — user signed off `approved` 2026-05-10 |
| Service-role audit (`grep -rln SERVICE_ROLE app components lib`) | 0 matches |

## Phase 4 — All 5 ROADMAP Success Criteria MET

| # | Criterion | Closed by | Status |
|---|-----------|-----------|--------|
| 1 | Användare kan skapa, redigera och ta bort träningsplaner; ändringar visas omedelbart (optimistic update) | Plan 02 (CREATE) + Plan 03 (EDIT + ARCHIVE) | ✓ MET |
| 2 | Användare kan skapa egna övningar och se dem i biblioteket vid plan-edit (ingen seed i V1) | Plan 03 (exercise-picker inline create-form chained to add-to-plan under shared scope) | ✓ MET |
| 3 | Användare kan lägga till och drag-att-ordna om övningar i en plan; ny ordning persisterar | Plan 03 (ADD via picker) + Plan 04 (drag-reorder via DraggableFlatList + two-phase orchestrator) | ✓ MET |
| 4 | Airplane-mode-test passerar (create → 3 exercises → force-quit → reopen offline → reconnect → all rows land in Supabase without FK or duplicate errors) | Plan 04 manual UAT Steps 3–5 | ✓ MET (user `approved` 2026-05-10) |
| 5 | Offline-banner visas när NetInfo rapporterar `isConnected: false`; banner försvinner när enheten är online igen | Plan 02 (OfflineBanner mount + ✕ close) + Plan 04 cfc1dc8 (visibility amendment) + UAT Steps 3 + 5 (2-second appear/disappear verified on real device) | ✓ MET |

## Deviations from Plan

### Auto-fixed Issues (Tasks 1–3 autonomous block — none of substance)

The autonomous block (Tasks 1–3) executed cleanly. The plan's surgical edits matched the codebase 1:1 — schema export names were stable (already canonicalized in Plans 02–03), `useReorderPlanExercises(planId)` was wired exactly as the `<interfaces>` block described, and the manual checklist landed verbatim from the action body. The verification script `cd app && npx tsc --noEmit && npm run lint && npm run test:rls && ...` returned `OK_PHASE_4_PLAN_4_AUTOMATED_GATES_PASS` after Task 3.

### UAT-driven gap-closure (Rule 1 + Rule 2 — ~18 commits)

Every commit between `dcd502b` and `6b8c604` is documented above under "Gap-Closure Commits". These are NOT plan deviations in the conventional sense — they are regression closures surfaced by the manual UAT (Task 4 checkpoint). The plan correctly identified Task 4 as a `checkpoint:human-verify` precisely because the regressions discoverable here are invisible to `tsc --noEmit + expo lint + test:rls`. The cost of the gap-closure block (~6 hours) is the value the checkpoint protects against — these regressions would have shipped to the V1 soak test undetected without the manual UAT gate.

**Categorization summary:**
- Rule 1 (bug fixes): `dcd502b`, `5d953b6`, `eca0540`, `b87bddf`, `b57d1c2`, `3bfaba8`, `44c2138`, `1f4d8d0`, `3a094eb`, `87b1d9b`, `af6930c`, `954c480`, `feb060e`, `e07029a`, `6b8c604` (15 commits — concrete broken behavior on real device)
- Rule 2 (missing critical functionality): `cfc1dc8` (warning-color identity was failing accessibility/visibility), `85328c4` (UI copy violated convention)
- Rule 2 (perf): `da65717` (ProMotion 120Hz + freezeOnBlur)

No Rule 4 deviations (no architectural escalations needed).

## Issues Encountered

- **`networkMode: 'offlineFirst'` + `mutateAsync` is a footgun.** Phase 5+ MUST use `mutate(payload, { onError, onSuccess })` for ALL user-triggered mutation submits. Phase 4 Plan 01 introduced offlineFirst; Plan 03 used mutateAsync; the combination only breaks on real-device offline test (passes in online dev + simulator + automated tests). Documented as canonical pattern (decision 3 above) for downstream phases.
- **Modal portal + NativeWind/flex composition silently drops layout primitives** on iOS. After 3 attempts (Alert.alert → themed Modal → bottom-sheet Modal), abandoned the portal entirely for in-screen overlays. Phase 5 set-logging UI will follow the inline-overlay pattern for any popover-like surface.
- **`freezeOnBlur` and modal-open state interaction** is non-obvious. Future screens with modal-state-bearing local React state need `useFocusEffect` reset pattern.
- **Expo Router `presentation: 'modal'`** is a static react-native-screens prop that only honors declarations at the layout level. Documented in CLAUDE.md-equivalent inline pattern note (decision 4 above).
- **Real-device color rendering differs from simulator.** OfflineBanner's `bg-yellow-100` looked correct in simulator + screenshots but was near-white on a physical iPhone in light mode. UI-SPEC color amendments going forward will be verified on physical device before merge.

## Known Stubs / Deferred

None — F2/F3/F4 all close end-to-end. Plan 04-04's gap-closure block actively reduced stubs (the `Övning <8-char-id>` fallback from Plan 03 was upgraded to real exercise-name resolution via `useExercisesQuery + Map<id, name>` in `3bfaba8`).

## Phase 4 Completion

After this plan, Phase 4 is operationally complete (4/4 plans):
- All 5 ROADMAP success criteria MET (table above).
- F2 (plan CRUD), F3 (exercise CRUD), F4 (drag-reorder + add) fully closed.
- 29 RLS assertions green; 5 Wave 0 Zod/DB-integration tests green; manual airplane-mode UAT signed off.
- 7 architectural patterns established for Phase 5 inheritance.

**Pointers for the orchestrator:**
- Next: `/gsd-secure-phase 4` to close the threat register (T-04-01 … T-04-12) against the implementation.
- Then: `/gsd-verify-work 4` to write `04-VERIFICATION.md` with all 5 success criteria marked MET.
- Then: `/gsd-code-review` (phase-scoped) for the post-phase audit.
- Then: phase.complete to advance ROADMAP.md Phase 4 → ✓ Complete and STATE.md current-position → Phase 5.

## Threat Flags

None — the threat register entries (T-04-01, T-04-02, T-04-08, T-04-09) are all addressed:

- **T-04-01 (RLS regression gate):** test-rls.ts extended (Task 2) with 3 new assertion blocks; 29 assertions PASS.
- **T-04-02 (API4 rate-limiting):** accepted-risk (manual-tap-driven CRUD; documented as accepted-risk in CONTEXT.md scope).
- **T-04-08 (drag-reorder FK + unique-constraint integrity):** Plan 01's two-phase orchestrator owns the safety; UAT Step 3 confirmed dragged order survives force-quit + reconnect without FK violations or duplicate-PK errors.
- **T-04-09 (captive-portal scenario):** UAT Step 6 PASS — NetInfo-online + Supabase-unreachable kept mutations paused (not error); flushed cleanly on connectivity restore.

No new security-relevant surface beyond the threat register.

## Self-Check: PASSED

Verified at completion (2026-05-10):

- File existence: `app/scripts/manual-test-phase-04-airplane-mode.md` present; 10 modified files all present.
- Commit existence: `git log --oneline 0eee4bd..HEAD` shows 4 planned commits (`2501ac8`, `c1cb8de`, `79ac8b8`, `4088165`) + 18 gap-closure commits (`dcd502b` through `6b8c604`) = 22 total ahead of phase-planning baseline.
- Verification suite: tsc + expo lint + test:rls (29 assertions) + 7 Wave 0 test:* scripts all exit 0.
- Manual UAT: 6 steps PASS; user signed off `approved` 2026-05-10.
- All 5 ROADMAP Phase 4 success criteria MET (table above).

---

*Phase: 04-plans-exercises-offline-queue-plumbing*
*Completed: 2026-05-10*
