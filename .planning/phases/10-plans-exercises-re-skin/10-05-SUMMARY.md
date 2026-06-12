---
phase: 10-plans-exercises-re-skin
plan: 05
subsystem: plans-list-newplan-tabbar
tags: [re-skin, forge, plans-list, new-plan, tab-bar, i18n, modal, ghrv, custom-tabbar]

# Dependency graph
requires:
  - phase: 10-plans-exercises-re-skin
    plan: "01"
    provides: "usePlansQuery (archived_at is null) + useDeletePlan + nullable plan_exercises targets (list datum source)"
  - phase: 10-plans-exercises-re-skin
    plan: "04"
    provides: "FExerciseEdit re-skin idiom (TOKENS light/dark token-bag + inline-optical-style pattern) + planEyebrow/closeModal locale keys"
  - phase: 08-forge-foundation
    provides: "Icon (barbell/clock/settings/user/plus/chevronRight/chevronLeft/arrowRight/check) + Logo (white variant) + components/ui barrel + forge.* tokens (incl. tabBg, gradFrom/gradTo)"
  - phase: 09-auth-settings-preferences
    provides: "live-t() re-skin idiom (settings.tsx) + useColorScheme() raw-color split"
provides:
  - "Re-skinned plans list (Planer tab index.tsx) → FHome plan-list portion: brand-mark gradient tile + profile button header, page title, MINA PLANER section header + Ny plan link, featured-card gradient barbell tile on i===0, surface tiles else; empty state + FAB + draft-resume overlay + success toast preserved"
  - "Re-skinned new-plan (new.tsx) → FNewPlan: back-chevron header, H1 + descHelp, focused-name field (2px accent border), description box (minHeight 110), Skapa plan CTA with trailing arrowRight; RHF+zod boundary + .mutate (SP-2) + own GHRV wrapper preserved"
  - "Re-skinned tab bar (_layout.tsx) → ForgeTabBar custom renderer over live <Tabs>: active accent/strokeWidth 2/600, inactive text3/strokeWidth 1.6/500, floating bg-forge-tabBg paddingTop 10/paddingBottom 28, Forge Icon set, light+dark parity; OfflineBanner+ActiveSessionBanner placement + routes preserved"
  - "5 new locale keys (sv↔en parity, 137 keys): namePlaceholder, planDescHelp, exercisesStat, lastStat, avgTime"
affects: [plan-detail, history-tab, settings-tab, phase-12-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ForgeTabBar custom `tabBar` renderer over the LIVE expo-router <Tabs> (BottomTabBarProps state.index + navigation.emit('tabPress')/navigate) — paints the Forge floating bar while keeping the real navigation state machine; the Phase-8 standalone TabBar shell stays gallery-only (OQ-5), avoiding a navigation-behavior change"
    - "Featured-card gradient discipline: barbell content-icon tile renders brand-gradient (gradFrom bg + white icon) on i===0 ONLY, surface2 + content-color icon for all other plan cards (UI-SPEC §Color brand/featured-only)"
    - "Local focusedField state ('name' | 'description' | null) drives the new-plan name field's 2px accent border on focus while keeping a constant 2px border WIDTH (only COLOR changes — UAT 09-03 no-resize-on-focus)"
    - "TOKENS light/dark token-bag + inline-optical-style numbers (Pitfall 3) carried verbatim from the Plan 04 edit-modal re-skin idiom"

key-files:
  created: []
  modified:
    - app/app/(app)/(tabs)/index.tsx
    - app/app/(app)/plans/new.tsx
    - app/app/(app)/(tabs)/_layout.tsx
    - app/locales/sv.json
    - app/locales/en.json

key-decisions:
  - "D-12: new-plan surfaces name (required) + description (optional) — workout_plans.description already exists, NO migration. RHF+zodResolver(planFormSchema) preserved as the form validation boundary (CLAUDE.md Forms phase)"
  - "D-15: 5 new keys added at sv↔en parity (namePlaceholder/planDescHelp/exercisesStat/lastStat/avgTime); reused existing description/planEyebrow/name/myPlans/noPlans/createPlan/newPlan/plans/history/settings; no cancel/bare-save key on these screens"
  - "D-16: plan name + description rendered verbatim (user content never translated); only keyed chrome flips on language toggle"
  - "Tab bar = custom ForgeTabBar renderer over live <Tabs> (planner's-call from PATTERNS), NOT the Phase-8 standalone TabBar shell — keeps expo-router navigation intact (appearance-only re-skin, SKIN-07)"
  - "Plan-card meta renders existing `description` (the per-plan list datum) instead of an `n övningar` count — usePlansQuery returns no per-plan exercise count, and issuing one per row would be an N+1 / new aggregate the UI-SPEC reconciliation explicitly defers (plain derived counts only, no new aggregates)"

patterns-established:
  - "Custom `tabBar` renderer is the sanctioned way to re-skin the bottom bar without touching navigation state — reusable if any future tab is added"
  - "Featured-card (i===0) gradient + brand-mark tile gradient are the ONLY two brand-gradient surfaces on the plans list; barbell stays a content icon everywhere else"

requirements-completed: [SKIN-02, SKIN-07, I18N-05]

# Metrics
duration: ~4min
completed: 2026-06-12
---

# Phase 10 Plan 05: Plans List, New-Plan & Tab Bar Re-skin Summary

**Re-skins the three entry-chrome surfaces to Forge: the Planer tab (`index.tsx`) to `FHome`'s plan-list portion (brand-mark header, page title, MINA PLANER section + Ny plan link, featured-card gradient barbell tile on `i===0`, empty state + FAB + draft-resume overlay + success toast all preserved); the new-plan form (`new.tsx`) to `FNewPlan` (back-chevron header, H1 + descHelp, focused-name 2px-accent-border field, description box, Skapa plan CTA with trailing arrowRight, RHF+zod + `.mutate` SP-2 + own GHRV preserved, D-12 no-migration); and the tab bar (`_layout.tsx`) to a `ForgeTabBar` custom renderer over the live `<Tabs>` (active accent/strokeWidth 2, inactive text3/strokeWidth 1.6, floating `bg-forge-tabBg`, light+dark parity, OfflineBanner+routes preserved). 5 new locale keys added at sv↔en parity (137 keys). All gates green.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-12T19:08:26Z
- **Completed:** 2026-06-12T19:12:36Z
- **Tasks:** 3
- **Files modified:** 5 (0 created, 5 modified)

## Accomplishments
- **Plans list re-skin (Task 1)** — `index.tsx` rebuilt to `FHome`'s PLAN-LIST PORTION ONLY (UI-SPEC reconciliation lines 169-170 — the activity-ring/streak/volume hero is the Phase 12 boundary and was NOT built). Header row = 32×32 brand-mark gradient tile (white `Logo`) + "FITNESSMAXXING" eyebrow + 36×36 surface profile button. Page title `t('myPlans')` (36px/700). `MINA PLANER` section header with a `t('newPlan')` accent inline link. Plan cards (radius 18, 44×44 icon tile) render a **featured-card gradient barbell tile on `i===0` ONLY** (gradFrom bg + white icon), surface2 + content-color icon for the rest — barbell stays a content icon (UI-SPEC §Color). Empty state re-skinned (barbell tile + `t('noPlans')`/`t('noPlansSub')` + accent CTA with arrowRight); FAB hidden when empty. The floating "+" FAB (56×56, accent shadow) and the **entire Phase 5 DraftResumeOverlay + "Passet sparat" success toast** were preserved (re-skinned to Forge tokens, logic untouched). List bottom padding 100 clears the floating tab bar.
- **New-plan re-skin (Task 2)** — `new.tsx` rebuilt to `FNewPlan`: a 40×40 back-chevron nav button + centered `t('newPlan')` title, a 36px H1 + `t('planDescHelp')` paragraph, a **name field with a 2px accent border on focus** (driven by local `focusedField` state; constant 2px width so focusing never resizes the box — UAT 09-03), a description multiline box (`minHeight 110`, optional), and a `t('createPlan')` primary CTA (60 tall, accent shadow, trailing `arrowRight`). RHF + `zodResolver(planFormSchema)` is preserved as the form boundary (name ≤80 required, description ≤500 optional — CLAUDE.md Forms phase). Submit fires `useCreatePlan().mutate({ id, user_id, name, description }, { onError })` (`.mutate` NOT mutateAsync — SP-2) then `router.replace('/plans/<id>')`. Auth/server errors route through `t('errorNotSignedIn')`/`t('errorGeneric')`. Own `GestureHandlerRootView` wrapper (SP-8). `description` already exists — NO migration (D-12).
- **Tab bar re-skin (Task 2)** — `_layout.tsx` styles the **live** expo-router `<Tabs>` via a custom `tabBar={ForgeTabBar}` renderer (planner's-call from PATTERNS). `ForgeTabBar` reads `BottomTabBarProps` (`state.index`, `navigation.emit('tabPress')`/`navigate`) so real navigation is untouched, and paints the Forge floating bar: active = `text-forge-accent` + icon `strokeWidth 2` + label 600; inactive = `text-forge-text3` + `strokeWidth 1.6` + label 500; floating `bg-forge-tabBg` + `paddingTop 10`/`paddingBottom 28`; Forge `Icon` set (Planer=`barbell`, Historik=`clock`, Inställningar=`settings`); labels `t('plans')`/`t('history')`/`t('settings')`. Light+dark parity via `useColorScheme()`. OfflineBanner + ActiveSessionBanner mount placement (above `<Tabs>`, inside `SafeAreaView edges={['top']}`) and all three routes preserved — appearance-only.
- **Locale keys (Task 3)** — `namePlaceholder`, `planDescHelp`, `exercisesStat`, `lastStat`, `avgTime` added to BOTH locale files at parity (the last three are consumed by Plan 06's plan-detail quick-stats — added here so Wave 5 is the sole locale writer). Reused existing `description`/`planEyebrow`/`name`/`myPlans`/`noPlans`/`createPlan`/`newPlan`/`plans`/`history`/`settings`. No `cancel`/bare-`save` key introduced. `check:locale-parity` PASS at 137 keys.

## Task Commits

1. **Task 1: re-skin plans list to FHome plan-list portion** — `cd43ca3` (feat) [FIT-92]
2. **Task 2: re-skin new-plan (FNewPlan) + tab bar (SKIN-07)** — `c2e1850` (feat) [FIT-92]
3. **Task 3: new-plan + plan-detail-shared locale keys (sv + en, D-15)** — `8ad5909` (feat) [FIT-92]

**Plan metadata:** _(final docs commit)_ [FIT-92]

## Files Created/Modified
- `app/app/(app)/(tabs)/index.tsx` (modified) — Forge plan-list re-skin (header, title, section, plan cards w/ featured gradient, empty state, FAB); draft-resume overlay + toast preserved + re-skinned
- `app/app/(app)/plans/new.tsx` (modified) — FNewPlan re-skin (back-chevron header, H1+descHelp, focused-name field, description box, Skapa plan CTA); RHF+zod + .mutate + GHRV preserved
- `app/app/(app)/(tabs)/_layout.tsx` (modified) — ForgeTabBar custom renderer over live <Tabs>; OfflineBanner+routes preserved
- `app/locales/sv.json` (modified) — 5 new keys (sv)
- `app/locales/en.json` (modified) — same keys (en); parity-equal at 137

## Decisions Made
- **Tab bar via custom `tabBar` renderer, not the Phase-8 `TabBar` shell.** PATTERNS gave the planner's-call between styling the live `<Tabs>` or mounting the standalone shell. The Phase-8 `TabBar` is documented gallery-only (OQ-5 / Pitfall 6) with `active`/`onSelect` props that are NOT wired to navigation — wiring it would mean re-implementing the route state machine (a navigation-behavior change outside SKIN-07's appearance-only boundary). A custom `tabBar={ForgeTabBar}` renderer is the sanctioned middle path: it consumes the real `BottomTabBarProps` (so navigation stays expo-router's) while painting the exact Forge bar from the same tokens the shell uses. The shell file is left untouched.
- **Plan-card meta = `description`, not an exercise count.** The UI-SPEC reference shows `n övningar · Xd sedan`, but `usePlansQuery` returns no per-plan exercise count, and issuing a `usePlanExercisesQuery` per row would be an N+1 plus a new aggregate the UI-SPEC reconciliation note explicitly defers ("plain derived counts, no new aggregates"). The existing per-plan `description` is the available list datum and was already the prior screen's meta — preserved verbatim (D-16). The `exercisesStat`/`lastStat`/`avgTime` keys are added for Plan 06's plan-DETAIL stats (where the data is in scope), not the list.
- **RHF retained on new-plan (vs the Plan 04 local-state drop).** Plan 04's edit modal dropped RHF because its steppers had no rendered validation surface. New-plan DOES have a rendered validation surface (name required ≤80, description ≤500 with inline error messages) and CLAUDE.md's Forms-phase contract mandates a Zod boundary at every form, so RHF + `zodResolver(planFormSchema)` was kept; the focus-border styling is layered on top via a small local `focusedField` state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Routed new-plan errors through i18n keys**
- **Found during:** Task 2
- **Issue:** The prior `new.tsx` hardcoded Swedish error strings ("Du måste vara inloggad…", "Något gick fel. Försök igen."). The re-skin must route all chrome through `t()` (SP-5 / I18N-05) or the language toggle leaves stale Swedish errors in English mode.
- **Fix:** Auth-required → `t('errorNotSignedIn')`, server error → `t('errorGeneric')` (both keys exist from Plan 03). No new keys needed.
- **Files modified:** `app/app/(app)/plans/new.tsx`
- **Commit:** `c2e1850`

## Issues Encountered
None. All three gates (`tsc --noEmit`, `expo lint`, `check:locale-parity`) exit 0 (zero errors, zero warnings).

## Known Stubs
None. Every surface is wired: plans list ↔ `usePlansQuery`; card tap → `plans/[id]`; FAB/Ny-plan/empty-CTA → `plans/new`; new-plan submit ↔ `useCreatePlan.mutate`; draft-resume ↔ `useFinishSession.mutate`; tab bar ↔ live expo-router navigation. The seeded library (Plan 02) means downstream screens are never empty. No empty/placeholder data flows to UI.

## Threat Flags
None. No new network endpoint, auth path, or schema change beyond the plan's threat register. `useCreatePlan`/`usePlansQuery` run under own-row RLS with `archived_at` list filtering (T-10-16); new-plan submit uses `.mutate(payload, { onError })` not mutateAsync (T-10-17); the tab bar is pure chrome with no data (T-10-18); no new dependencies (T-10-SC).

## User Setup Required
None — pure re-skin over existing hooks. Device UAT (plans list + new-plan + tab bar light+dark; create a plan; sv↔en chrome flip; tab-bar active/inactive states; draft-resume overlay; success toast) is deferred to phase-level UAT.

## Next Phase Readiness
- The plans list, new-plan, and tab bar are now the Forge entry chrome; Plan 06 (plan-detail re-skin) reads the `exercisesStat`/`lastStat`/`avgTime` keys added here (Wave 5 = sole locale writer, so Plan 06 only reads).
- The featured-card gradient + brand-mark gradient are the two sanctioned brand-gradient surfaces on the list; the activity-ring hero remains the Phase 12 boundary.
- All gates green; no blockers.

## Self-Check: PASSED

- FOUND: `app/app/(app)/(tabs)/index.tsx`
- FOUND: `app/app/(app)/plans/new.tsx`
- FOUND: `app/app/(app)/(tabs)/_layout.tsx`
- FOUND: `.planning/phases/10-plans-exercises-re-skin/10-05-SUMMARY.md`
- FOUND: commit `cd43ca3` (Task 1)
- FOUND: commit `c2e1850` (Task 2)
- FOUND: commit `8ad5909` (Task 3)

---
*Phase: 10-plans-exercises-re-skin*
*Completed: 2026-06-12*
