---
phase: 04-plans-exercises-offline-queue-plumbing
plan: 02
subsystem: ui
tags: [tabs-skeleton, offline-banner, plans-list, plans-create, expo-router, nativewind, rhf, zod, swedish-ui]

requires:
  - phase: 01-bootstrap-infra-hardening
    provides: SafeAreaView pattern; <Stack.Screen> per-screen header opt-in convention; NativeWind 4 dark-mode pairs (F15)
  - phase: 03-auth-persistent-session
    provides: useAuthStore selectors (session.user.id, session.user.email, signOut); (app)/_layout.tsx Stack.Protected guard; (auth)/sign-in.tsx form pattern (RHF + Zod + Controller + banner+✕); Phase 3 D-15 RHF mode amendment (onSubmit)
  - phase: 04
    plan: 01
    provides: usePlansQuery (filters .is('archived_at', null)); useCreatePlan; useOnlineStatus from @/lib/query/network; randomUUID from @/lib/utils/uuid; planFormSchema + PlanFormInput type
provides:
  - app/components/offline-banner.tsx (binary OfflineBanner — Plan 03 + Plan 04 + Phase 5/6/7 inherit unchanged)
  - app/app/(app)/(tabs)/_layout.tsx (V1 tab-skeleton with Swedish labels — Phase 6 fills history.tsx, Phase 7 fills settings.tsx without touching this layout)
  - app/app/(app)/(tabs)/index.tsx (Planer list — Plan 03 plan-row tap routes to /plans/[id])
  - app/app/(app)/plans/new.tsx (create-plan form — empty-state CTA and FAB both route here)
  - app/app/(app)/(tabs)/settings.tsx (sign-out home — Phase 7 polish adds dark-mode-toggle without moving the sign-out button)
affects: [04-03 (consumes /plans/new + /plans/[id] routes — both referenced from this plan), 04-04 (drag-reorder integration in plans/[id].tsx), 06 (Phase 6 fills history.tsx without re-touching (tabs)/_layout.tsx), 07 (Phase 7 fills settings.tsx without moving the sign-out button)]

tech-stack:
  added:
    - none — all libraries already present from Phase 1/3/4-01 (expo-router, react-native-safe-area-context, @expo/vector-icons, react-hook-form, @hookform/resolvers, zod, @tanstack/react-query)
  patterns:
    - "Per-screen header opt-in: <Stack.Screen options={{ headerShown: true, title: 'Ny plan' }} /> on plans/new.tsx — extends CLAUDE.md ## Conventions Phase 1 default (root Stack headerShown:false). Plan 03 plan-detail will follow the same pattern with a dynamic title derived from plan.name."
    - "OfflineBanner mount placement: ABOVE <Tabs> and INSIDE SafeAreaView edges={['top']} in (tabs)/_layout.tsx. The banner sits below the OS status bar but above tab content; mounting it inside the Tabs would put it INSIDE one tab's content area instead of spanning all three tabs."
    - "Empty-state CTA inline + FAB conditional: when plans.length === 0, the centered inline 'Skapa plan' CTA shows and the FAB is hidden — so the FAB doesn't hover over the empty-state's primary action. When plans.length >= 1, the FAB appears bottom-right and the inline CTA is gone (because ListEmptyComponent only renders for empty lists)."
    - "Banner color separation: yellow (warning/info) for OfflineBanner — system-state communication that's recoverable; red (destructive) for form-error banners — user error or server failure. Keeps the two affordances visually distinct in the user's mental model."
    - "Description ?? null on plan insert: Postgres distinguishes '' from null; the V1 convention is null for 'no description'. Empty-string from RHF (defaultValues: { description: '' }) coerces to null at the mutation boundary so DB rows are clean."

key-files:
  created:
    - app/components/offline-banner.tsx
    - app/app/(app)/(tabs)/_layout.tsx
    - app/app/(app)/(tabs)/index.tsx
    - app/app/(app)/(tabs)/history.tsx
    - app/app/(app)/(tabs)/settings.tsx
    - app/app/(app)/plans/new.tsx
  modified:
    - none
  deleted:
    - app/app/(app)/index.tsx (Phase 3 placeholder; (tabs)/index.tsx is now the (app) group default route via Expo Router 6 group-default-resolution)

key-decisions:
  - "Auto-fix Rule 1 — schema-export name: plan referenced zodResolver(plansSchema) but lib/schemas/plans.ts (Plan 04-01) exports planFormSchema + PlanFormSchema only. No `plansSchema` symbol exists. Used planFormSchema (canonical lowercase, matches Phase 3 D-12 analog signInSchema). Plan's own <interfaces> block lists PlanFormInput as the inferred type, confirming the symbol naming. Verification grep adjusted from `zodResolver(plansSchema)` to `zodResolver(planFormSchema)` to match the actual export."
  - "Auto-fix Rule 3 — Expo Router typed-routes: app.json has experiments.typedRoutes=true, so Expo Router validates path literals against auto-generated .expo/types/router.d.ts. That file only includes routes whose source files currently exist when typed-routes regenerates. /plans/new is owned by this plan's Task 3 (which lands AFTER Task 2 references it) and /plans/[id] is owned by Plan 04-03 (not yet shipped). Resolved with localized `as Href` casts on three route strings in (tabs)/index.tsx; documented inline as a V1.1 cleanup breadcrumb. The dev server regenerates router.d.ts on next `expo start` so the casts become inert in practice — they only exist to keep tsc --noEmit clean during the in-between state."

requirements-completed: [F2]

duration: ~30min
completed: 2026-05-10
---

# Phase 4 Plan 02: Tabs Skeleton + Planer Slice + OfflineBanner Summary

**6 new files (3 tab screens + tabs layout + plans/new + OfflineBanner) + 1 deletion (Phase 3 (app)/index.tsx). User can now sign in → land on Planer tab → see empty state → tap "Skapa plan" → fill form → mutation queues offline or fires online → row appears optimistically. Airplane mode → yellow OfflineBanner appears across all three tabs.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-05-10T19:35:00Z
- **Completed:** 2026-05-10T20:05:00Z
- **Tasks:** 3
- **Files created:** 6
- **Files modified:** 0
- **Files deleted:** 1

## Accomplishments

- **Locked the V1 tab-skeleton** (CONTEXT.md D-15/D-17/D-18): three Swedish-labeled tabs (Planer / Historik / Inställningar) with Ionicons (barbell/time/settings + outline variants) and useColorScheme()-bound dark-mode tints. Phase 6 and Phase 7 fill their respective tab screens without touching this layout.
- **Closed F2 CREATE side end-to-end**: signed-in user can navigate to plans/new, fill name+description, submit, see the row appear in the Planer list. Optimistic update fires regardless of network state; offline mutations queue via Plan 04-01's setMutationDefaults wiring.
- **Mounted the OfflineBanner globally** at (tabs)/_layout.tsx so all three tab screens inherit the banner without per-screen wiring. Banner copy verbatim per CONTEXT.md D-05: `Du är offline — ändringar synkar när nätet är tillbaka.` Visible iff useOnlineStatus()===false AND local dismissed===false; ✕ close resets on next online→offline transition (Phase 3 quick-task 4af7462 convention).
- **Deleted Phase 3 (app)/index.tsx placeholder** — sign-out moves to (tabs)/settings.tsx as its permanent home; (tabs)/index.tsx is now the (app) group default route via Expo Router 6 group-default-resolution.
- **Established Plan 03 + Plan 04 dependency edges**: /plans/new and /plans/[id] are referenced from (tabs)/index.tsx and plans/new.tsx (post-create router.replace). Plan 03 owns the [id] route landing screen.

## Task Commits

Each task was committed atomically on `gsd/phase-04-plans-exercises-offline-queue-plumbing`:

1. **Task 1: tabs skeleton + OfflineBanner mount + delete Phase 3 (app)/index.tsx** — `efdedc8` (feat)
2. **Task 2: populate Planer tab with list, empty-state, FAB** — `a39ff10` (feat)
3. **Task 3: create-plan form (RHF + Zod + useCreatePlan)** — `98e9147` (feat)

## Files Created/Modified

### Created (6)

- `app/components/offline-banner.tsx` — Binary OfflineBanner. Visible iff `useOnlineStatus() === false && !dismissed`; ✕ close-affordance with `useEffect` cleanup that resets `dismissed` on online→offline transition. Yellow tokens (`bg-yellow-100 dark:bg-yellow-900` + `text-yellow-900 dark:text-yellow-100`) per UI-SPEC §Color Warning/Info — distinct from red form-error banners. AccessibilityRole="alert" + accessibilityLiveRegion="polite" so VoiceOver announces on first appearance.
- `app/app/(app)/(tabs)/_layout.tsx` — Default Expo Router `<Tabs>` with `headerShown: false`, useColorScheme()-bound `tabBarStyle.backgroundColor`/`borderTopColor`/`tabBarActiveTintColor`/`tabBarInactiveTintColor`, three `<Tabs.Screen>` registrations (index/history/settings) with Swedish titles and Ionicons. OfflineBanner mounted ABOVE `<Tabs>` INSIDE `SafeAreaView edges={['top']}`.
- `app/app/(app)/(tabs)/index.tsx` — Three states (loading ActivityIndicator / empty-state with inline CTA / populated FlatList + FAB). All copy verbatim from UI-SPEC: `Mina planer`, `Inga planer än`, `Skapa din första plan.`, `Skapa plan`, `Skapa ny plan`, `Öppna plan {name}`. Plan-row Pressable wraps the entire row (44pt+); description renders only when non-null (no "—" placeholder).
- `app/app/(app)/(tabs)/history.tsx` — Centered "Historik" Display heading + "Historik kommer i Phase 6." Body. Phase 6 owns the real surface.
- `app/app/(app)/(tabs)/settings.tsx` — "Inställningar" Display + email + "Mer kommer i Phase 7." + "Logga ut" CTA calling `useAuthStore.getState().signOut()` (verbatim copy from Phase 3 (app)/index.tsx). No confirm dialog per UI-SPEC §"No destructive confirmation for: Sign-out".
- `app/app/(app)/plans/new.tsx` — RHF + zodResolver(planFormSchema) + Controller-wrapped TextInputs (name + description multiline) + primary CTA + red banner+✕ for server errors. `<Stack.Screen options={{ headerShown: true, title: 'Ny plan' }} />` opts the header in for back-arrow. onSubmit: `createPlan.mutateAsync({ id: randomUUID(), user_id: session.user.id, name, description: input.description ?? null })` then `router.replace('/plans/${id}' as Href)`.

### Modified (0)

None — Plan 04-01 already wired QueryClientProvider + auth-store + the lib/query split, so this plan is purely additive at the route-tree layer.

### Deleted (1)

- `app/app/(app)/index.tsx` — Phase 3 placeholder. Sign-out moved to (tabs)/settings.tsx; (tabs)/index.tsx is the new default route inside the (app) group via Expo Router 6 group-default-resolution.

## Swedish Copy Contract — Verbatim Verification

Every key UI string from UI-SPEC §Copywriting Contract, with file:line where it appears:

| String | File:Line |
|---|---|
| `Du är offline — ändringar synkar när nätet är tillbaka.` | components/offline-banner.tsx:48 |
| `Stäng` (✕ accessibilityLabel) | components/offline-banner.tsx:54 |
| `Tryck för att stänga` (✕ accessibilityHint) | components/offline-banner.tsx:55 |
| `Planer` (tab title) | app/(app)/(tabs)/_layout.tsx:54 |
| `Historik` (tab title) | app/(app)/(tabs)/_layout.tsx:65 |
| `Inställningar` (tab title) | app/(app)/(tabs)/_layout.tsx:76 |
| `Mina planer` (Display heading on populated list) | app/(app)/(tabs)/index.tsx:75 |
| `Inga planer än` (empty-state heading) | app/(app)/(tabs)/index.tsx:96 |
| `Skapa din första plan.` (empty-state body) | app/(app)/(tabs)/index.tsx:99 |
| `Skapa plan` (empty-state CTA + accessibilityLabel) | app/(app)/(tabs)/index.tsx:104, 107 |
| `Skapa ny plan` (FAB accessibilityLabel) | app/(app)/(tabs)/index.tsx:140 |
| `Öppna plan {name}` (plan-row accessibilityLabel) | app/(app)/(tabs)/index.tsx:117 |
| `Historik` (Historik tab heading) | app/(app)/(tabs)/history.tsx:14 |
| `Historik kommer i Phase 6.` (Historik body) | app/(app)/(tabs)/history.tsx:17 |
| `Inställningar` (Settings tab heading) | app/(app)/(tabs)/settings.tsx:29 |
| `Mer kommer i Phase 7.` (Settings placeholder) | app/(app)/(tabs)/settings.tsx:36 |
| `Logga ut` (sign-out button + accessibilityLabel) | app/(app)/(tabs)/settings.tsx:42, 46 |
| `Ny plan` (header title) | app/(app)/plans/new.tsx:107 |
| `Namn` (field label + accessibilityLabel) | app/(app)/plans/new.tsx:148, 158 |
| `t.ex. Push, Pull, Ben` (name placeholder) | app/(app)/plans/new.tsx:155 |
| `Beskrivning` (field label + accessibilityLabel) | app/(app)/plans/new.tsx:182, 194 |
| `(valfritt)` (description placeholder) | app/(app)/plans/new.tsx:189 |
| `Valfritt — beskriv vad planen är till för.` (description helper) | app/(app)/plans/new.tsx:208 |
| `Skapa plan` / `Skapar plan…` (CTA + loading state) | app/(app)/plans/new.tsx:227 |
| `Något gick fel. Försök igen.` (server-error banner) | app/(app)/plans/new.tsx:91 |
| `Du måste vara inloggad för att skapa en plan.` (defensive guard) | app/(app)/plans/new.tsx:75 |

## Confirmations (per Plan 04-02 <output> requirements)

- ✅ **`(app)/index.tsx` is gone**: `test ! -f app/app/(app)/index.tsx` returns true.
- ✅ **`(tabs)/index.tsx` is the default route**: Expo Router 6 group-default-resolution — when the user navigates into `(app)`, the route resolves to the first `index.tsx` inside the deepest group. With (app)/index.tsx deleted, that's (app)/(tabs)/index.tsx.
- ✅ **OfflineBanner mount placement is correct**: `_layout.tsx:46-49` — `<SafeAreaView edges={['top']}><OfflineBanner /><Tabs ...>`. The banner sits BETWEEN the safe-area-top inset and the `<Tabs>` content, so it's below the OS status bar and above all three tab screens.
- ✅ **Service-role audit clean**: `grep -rln "service_role\|SERVICE_ROLE" components/ app/` returns zero matches.
- ✅ **TypeScript clean**: `npx tsc --noEmit` exits 0.
- ✅ **Lint clean**: `npm run lint` (expo lint) exits 0.

## Note for Plan 04-03

The route `/plans/${id}` is consumed from two call-sites in this plan:
1. `(tabs)/index.tsx:106` — plan-row tap routes to `/plans/${plan.id}` (typed via `as Href`).
2. `plans/new.tsx:97` — post-create `router.replace('/plans/${id}' as Href)` lands the user on the new plan's detail screen.

Plan 04-03 owns `app/app/(app)/plans/[id].tsx`. Until Plan 04-03 ships, both navigations 404 — but the optimistic-update has already populated the cache, so when plans/[id].tsx is built it will read the row immediately on first paint without a refetch. The `as Href` casts in (tabs)/index.tsx + plans/new.tsx will become inert once plans/[id].tsx is created and Expo's typed-routes regenerator picks it up; they can be dropped as a V1.1 cleanup or left as harmless casts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Schema-export name discrepancy: plansSchema → planFormSchema**
- **Found during:** Task 3 — plan reference specified `zodResolver(plansSchema)` but `lib/schemas/plans.ts` (Plan 04-01) exports `planFormSchema` + `PlanFormSchema` only. There is no `plansSchema` symbol.
- **Issue:** Following the plan literal would produce `Cannot find name 'plansSchema'` at typecheck and a runtime undefined-call when the resolver is invoked.
- **Fix:** Used `planFormSchema` (canonical lowercase, matches Phase 3 D-12 analog `signInSchema`). The plan's own `<interfaces>` block lists `PlanFormInput` as the inferred type, confirming the symbol naming. Adjusted Task 3 verification grep from `zodResolver(plansSchema)` to `zodResolver(planFormSchema)`.
- **Files modified:** app/app/(app)/plans/new.tsx (line 64).
- **Verification:** Both grep variants tested — only `planFormSchema` exists in the file; tsc + lint pass.
- **Committed in:** `98e9147` (Task 3).

**2. [Rule 3 - Blocking] Expo Router typedRoutes blocks /plans/new and /plans/[id] references**
- **Found during:** Task 2 — initial `npx tsc --noEmit` after writing (tabs)/index.tsx with literal `router.push('/plans/new')` and `router.push(\`/plans/${plan.id}\`)` produced `TS2345: Argument of type '"/plans/new"' is not assignable to parameter of type ...`.
- **Issue:** `app.json` has `experiments.typedRoutes: true`. Expo Router's typed-routes generator emits `.expo/types/router.d.ts` which enumerates only routes whose source files currently exist. `/plans/new` is owned by this plan's Task 3 (executed AFTER Task 2 references it) and `/plans/[id]` is owned by Plan 04-03 (not yet shipped). The auto-generated type intersection had no `/plans/...` entries.
- **Fix:** Localized `as Href` casts on three route strings in (tabs)/index.tsx (also one in plans/new.tsx for the post-create router.replace to /plans/[id]). Documented inline as a V1.1 cleanup breadcrumb. The dev server regenerates router.d.ts on next `expo start`, so the casts become inert once both routes ship — they only exist to keep `tsc --noEmit` clean during the in-between state.
- **Alternatives considered:**
  - Reorder tasks (Task 3 before Task 2): would still leave `/plans/[id]` (Plan 04-03 territory) broken — same fix needed. No reduction in deviations.
  - Disable `experiments.typedRoutes` in app.json: project-wide regression of the Expo Router 6 typed-routes feature; loses type-safety on every route reference. Rule 4 territory; rejected as overkill.
  - Pre-create empty `plans/[id].tsx` stub: pollutes Plan 04-03's file ownership and would need to be deleted/replaced. Rejected.
- **Files modified:** app/app/(app)/(tabs)/index.tsx (3 cast sites + import), app/app/(app)/plans/new.tsx (1 cast site + import).
- **Verification:** `npx tsc --noEmit` exits 0 after casts.
- **Committed in:** `a39ff10` (Task 2 — the three (tabs)/index.tsx casts) + `98e9147` (Task 3 — the plans/new.tsx cast).

---

**Total deviations:** 2 auto-fixed (1 Rule-1 plan-vs-reality bug, 1 Rule-3 typed-routes ordering issue).
**Impact on plan:** Both deviations are localized and documented. The Rule-1 fix corrects a planner-vs-implementation drift (planner's text vs Plan 04-01's actual export name). The Rule-3 fix is an Expo-Router-specific gotcha that emerges from the typed-routes opt-in; documented inline so future contributors don't wonder why the casts exist. Neither introduces scope creep.

## Issues Encountered

- **Expo Router typed-routes generator does not regenerate during `tsc --noEmit`.** It only regenerates when the dev server (Metro) is running. This means cross-plan route references that span multiple commits trip the typecheck gate even though they'll work at runtime once the dev server runs. Resolved with `as Href` casts (Rule 3) — see Deviations above.
- **Plan-text vs schema-export drift.** Plan 04-02's `<interfaces>` and `<must_haves>` blocks both reference `plansSchema`, but Plan 04-01 shipped `planFormSchema`. Plan 04-01's own `<interfaces>` block (lines 121-125 of 04-02-PLAN.md) listed `plansSchema: ZodObject<...>` — this was a planner-side simplification that didn't match the implementation. Resolved by using the actual export name. Future planning agents should confirm against the upstream plan's actual exported symbols, not just the prose summary.

## User Setup Required

None — no external service configuration needed. All deps already present from Phase 1/3/4-01.

## Verification Suite Results

| Gate | Result |
|---|---|
| `npx tsc --noEmit` (in app/) | exit 0 |
| `npm run lint` (in app/) | exit 0 |
| Task 1 verification block | ALL_CHECKS_PASS |
| Task 2 verification block | ALL_CHECKS_PASS |
| Task 3 verification block (planFormSchema variant) | ALL_CHECKS_PASS |
| Plan-level verification (file-existence + service-role audit) | OK_PHASE_4_PLAN_2_COMPLETE |
| Service-role audit (`grep -rln SERVICE_ROLE components/ app/`) | 0 matches |

## Next Plan Readiness

Plan 04-03 (plan-detail + plan-edit + exercise-picker) can now consume:

- **Routes referenced**: `/plans/new` (already lands here as a fully-functional create form) and `/plans/${id}` (still 404 until Plan 04-03 builds plans/[id].tsx). Once Plan 04-03 lands plans/[id].tsx, the dev server regenerates router.d.ts and the `as Href` casts in (tabs)/index.tsx + plans/new.tsx become inert.
- **Auth context**: `useAuthStore((s) => s.session?.user.id)` for explicit user_id binding when needed (RLS handles most cases implicitly).
- **Resource hooks**: `usePlanQuery(id)`, `useUpdatePlan(planId)`, `useArchivePlan(planId)`, `useExercisesQuery()`, `useCreateExercise(planId)`, `useAddExerciseToPlan(planId)`, `useUpdatePlanExercise(planId)`, `useRemovePlanExercise(planId)` (all wired with correct scope binding for FK-safe replay per Plan 04-01).
- **OfflineBanner**: already mounted globally; Plan 04-03 doesn't need to do anything to inherit the banner on plan-detail.

Plan 04-04 (drag-to-reorder + airplane-mode test) likewise inherits without changes.

## Self-Check: PASSED

Verified at completion (2026-05-10):

- File existence: all 6 created files present; (app)/index.tsx confirmed deleted.
- Commit existence: `git log --oneline gsd/phase-04-plans-exercises-offline-queue-plumbing` shows three new commits (`efdedc8`, `a39ff10`, `98e9147`) ahead of the Plan 04-01 baseline `a2696a8`.
- Verification suite: `tsc --noEmit` + `expo lint` both exit 0; per-task and plan-level verification gates all return ALL_CHECKS_PASS / OK_PHASE_4_PLAN_2_COMPLETE.
- Service-role audit: zero matches under components/ or app/ (Plan-04-02 introduces no new Supabase client usage outside Plan 04-01's already-vetted lib/queries/* surface).

---

*Phase: 04-plans-exercises-offline-queue-plumbing*
*Completed: 2026-05-10*
