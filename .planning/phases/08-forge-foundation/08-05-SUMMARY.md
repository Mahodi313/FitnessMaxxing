---
phase: 08-forge-foundation
plan: 05
subsystem: ui
tags: [forge-gallery, dev-only-route, manual-uat, expo-router, react-i18next, skia, dsgn-01, dsgn-02, dsgn-03, dsgn-04, dsgn-05, dsgn-06, i18n-01, i18n-04, fit-79]

# Dependency graph
requires:
  - phase: 08-forge-foundation
    plan: 03
    provides: "Icon/Logo/AppIcon/ProgressRing/Sparkline — the vector + static-Skia primitives the gallery renders (brand row + Skia row)"
  - phase: 08-forge-foundation
    plan: 04
    provides: "ForgeButton/ForgeField/ForgeCard/ForgeStat/ForgeChip/SettingsRow+SettingsSection/TabBar — the 7 Forge components the gallery renders across every variant/size"
  - phase: 08-forge-foundation
    plan: 02
    provides: "forge.* token palette in tailwind.config.js — every color swatch + the `-light`/`dark:` parity classes the gallery exercises"
  - phase: 08-forge-foundation
    plan: 01
    provides: "react-i18next runtime (@/lib/i18n) + fmtNum/fmtDate/tnum (@/lib/utils/format) — the i18n toggle + locale number/date proof"
provides:
  - "app/app/(app)/_forge-gallery.tsx — the dev-only Forge component gallery, the manual-UAT surface (D-06/D-07). __DEV__-guarded, outside (tabs), reachable via router.push('/_forge-gallery') in dev"
  - "app/components/ui/index.ts — barrel re-exporting every Forge primitive so consumers import from a single @/components/ui entry point"
affects: [phase-09-plans-reskin, phase-11-settings-reskin, phase-12-dashboard-charts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dev-only route gating (OQ-6): file lives at (app)/_forge-gallery (OUTSIDE (tabs)/) so it is a Stack sibling — never a tab child — AND the screen body is __DEV__-guarded so a release build renders only a notice. In expo-router v6 only `_layout`/`+html`/`+api`/`+middleware` filenames are excluded from routing, so a `_forge-gallery` file IS a routable screen at /_forge-gallery (verified against node_modules/expo-router/build/getRoutesCore.js ignoreList + matchers.js)"
    - "Component-library barrel (components/ui/index.ts) — single-import surface for the Forge primitives; downstream re-skins import { ForgeButton, ... } from '@/components/ui'"
    - "Gallery swatch convention: each forge.* token rendered as a chip via its `-light` base bg class + `dark:` DEFAULT sibling so the swatch flips with the theme (proves DSGN-01 light+dark parity end-to-end)"
    - "i18n toggle drives i18n.changeLanguage('sv'|'en') with a hardcoded literal union (T-08-11) and re-renders sample t() strings + fmtNum/fmtDate live, reading the active locale off the useTranslation() instance"

key-files:
  created:
    - app/app/(app)/_forge-gallery.tsx
    - app/components/ui/index.ts
  modified: []

key-decisions:
  - "Added a components/ui/index.ts barrel (not in the plan's files_modified but required by the key_links `@/components/ui` pattern) so the gallery imports every primitive from one entry point. Rule-2 missing-critical-artifact: the gallery cannot satisfy its `from @/components/ui` import contract without it, and a barrel is the clean idiom the downstream Phase 9-12 re-skins will reuse."
  - "Confirmed the plan's `_forge-gallery` leading-underscore mechanism is correct for expo-router v6 (NOT a bug): inspected node_modules/expo-router/build/getRoutesCore.js (ignoreList only excludes +html/+api/+middleware) and matchers.js (only `_layout` is special-cased). A `_forge-gallery` file therefore registers as a routable screen reachable via router.push('/_forge-gallery'), while living outside (tabs)/ keeps it off the live tab bar. No deviation taken."
  - "Reach-in-dev path is router.push('/_forge-gallery') (documented here per the plan — NOT added to the tab bar or any live screen). The route inherits a per-screen <Stack.Screen options={{ headerShown:true, title:'Forge Gallery' }}/> with a forge.bg-colored header so dark-mode coverage includes the header (CLAUDE.md Navigation convention)."

patterns-established:
  - "Dev-only verification route: (app)/_<name>.tsx + __DEV__ body guard + per-screen Stack.Screen header — the template for any future living-reference/gallery surface"
  - "components/ui barrel as the single import surface for the Forge design system"

requirements-completed: [DSGN-01, DSGN-02, DSGN-03, DSGN-04, DSGN-05, DSGN-06, I18N-01, I18N-04]

# Metrics
duration: ~20min
completed: 2026-06-10
---

# Phase 8 Plan 05: Dev-Only Forge Gallery Summary

**A single `__DEV__`-guarded gallery route at `app/app/(app)/_forge-gallery.tsx` (outside `(tabs)`, reachable via `router.push('/_forge-gallery')`) that renders every forge.* color swatch, the display/mono type scale with a tabular-numeral alignment proof, the full ForgeButton 4×3 matrix plus every ForgeField state / ForgeCard / ForgeStat / ForgeChip / SettingsRow / TabBar shell, the static Skia ProgressRing + Sparkline and the Logo/AppIcon brand marks, and a live sv↔en toggle that reformats a number and date per locale — all in light + dark, with a new `components/ui` barrel as the single import surface and the live `<Tabs>` left untouched (OQ-5).**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-10
- **Completed:** 2026-06-10 (code) — manual UAT (Task 2) PENDING human sign-off
- **Tasks:** 2 (1 auto committed; 1 checkpoint:human-verify pending)
- **Files modified:** 2 (both created)

## Accomplishments
- **Task 1 — gallery route (`408c8f7`):** `app/app/(app)/_forge-gallery.tsx`, a `ScrollView` + `SafeAreaView` + `useColorScheme` screen (settings.tsx / chart.tsx shell) whose body is `__DEV__`-guarded (release build renders only a "dev-only" notice — T-08-10). Six labeled sections:
  1. **Color** — 12 forge.* token swatches (bg/surface/surface2/surface3/text/text2/text3/accent/accentSoft/success/danger/border) each via `-light` base + `dark:` sibling, plus a brand-gradient swatch rendered with the AppIcon squircle engine (DSGN-01).
  2. **Type** — `font-display` / `font-display-semibold` / `font-display-bold` samples + a `font-mono` cell, and a right-aligned `font-display-bold` + `tnum` column (`1 234,5` … `7,5`) proving tabular alignment (DSGN-02/03).
  3. **Components** — ForgeButton across all 4 variants × 3 sizes (+ loading + icon); ForgeField default/focused/error/multiline; ForgeCard surface/accentSoft/interactive; ForgeStat sm/md/lg (lg with an up delta pill); ForgeChip default/accent/success; SettingsSection wrapping chevron / value / toggle SettingsRows (DSGN-04).
  4. **Brand + Skia** — Logo gradient + Logo white (on a surface3 tile) + AppIcon; ProgressRing at 0.25 / 0.7 / 1.0 (the 1.0 ring uses the brand SweepGradient + a "100%" center child); Sparkline with a 10-point sample series (DSGN-05/06).
  5. **i18n** — `useTranslation()`; a two-ForgeButton sv↔en toggle calling `i18n.changeLanguage('sv'|'en')` (hardcoded literal union — T-08-11); sample `t()` strings (`signIn`/`startSession`/`createPlan`/`noPlans`/`noPlansSub`) that flip live; a `fmtNum(1234.5, locale)` cell and a `fmtDate` cell that reformat per active locale (I18N-01/04).
  6. **TabBar shell (gallery-only)** — the standalone `TabBar` demoed with local `active`/`onSelect` state inside a bordered container (OQ-5 — NOT wired to the live `<Tabs>`).
- **Barrel (`408c8f7`):** `app/components/ui/index.ts` re-exports all 12 primitive modules + their public types so the gallery (and future re-skins) import from `@/components/ui`.

## Task Commits

1. **Task 1: dev-only Forge gallery route + components/ui barrel** — `408c8f7` (feat) [FIT-79]
2. **Task 2: manual device UAT** — checkpoint:human-verify (blocking-human) — PENDING (no code; see Manual UAT below)

## Files Created/Modified
- `app/app/(app)/_forge-gallery.tsx` (created, Task 1) — dev-only gallery route; `__DEV__`-guarded; 6 sections; light+dark; sv↔en toggle; reachable via `router.push('/_forge-gallery')`.
- `app/components/ui/index.ts` (created, Task 1) — barrel re-exporting every Forge primitive + types.

## Decisions Made
- **Added `components/ui/index.ts` barrel** (Rule 2 — missing critical artifact): the plan's key_links require imports via `@/components/ui`; no barrel existed, so the gallery could not compile against that contract. The barrel is the clean single-import surface the downstream Phase 9-12 re-skins reuse.
- **Plan's `_forge-gallery` mechanism confirmed correct for expo-router v6** (no deviation): inspected the installed router source — `ignoreList` (getRoutesCore.js) only excludes `+html/+api/+middleware` and `matchers.js` only special-cases `_layout`. A `_forge-gallery` file is a routable screen at `/_forge-gallery`; living outside `(tabs)/` keeps it off the live tab bar.
- **Per-screen forge-colored header** via `<Stack.Screen>` so dark-mode coverage includes the nav header (CLAUDE.md Navigation convention); the live `(app)/_layout.tsx` Stack is otherwise untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical artifact] Added components/ui/index.ts barrel**
- **Found during:** Task 1
- **Issue:** The plan's `key_links` mandate the gallery import from `@/components/ui`, but `components/ui/` had no `index.ts` — the import would not resolve.
- **Fix:** Created `app/components/ui/index.ts` re-exporting all 12 primitive modules + public types.
- **Files modified:** app/components/ui/index.ts
- **Verification:** `npx tsc --noEmit` exits 0; gallery imports resolve from `@/components/ui`.
- **Committed in:** `408c8f7` (Task 1 commit)

**2. [Rule 1 - Lint] Merged duplicate @/components/ui imports**
- **Found during:** Task 1 verify
- **Issue:** Splitting the value import and a separate `import type { ForgeButtonVariant, ForgeButtonSize }` from `@/components/ui` triggered `import/no-duplicates` (2 warnings).
- **Fix:** Merged into one import statement using inline `type` modifiers.
- **Files modified:** app/app/(app)/_forge-gallery.tsx
- **Verification:** `npm run lint` → 0 errors / 0 warnings.
- **Committed in:** `408c8f7` (Task 1 commit)

**3. [Follow-up] Added __DEV__-guarded gallery entry point on settings screen**
- **Found during:** post-execution follow-up (gallery route existed but had no navigation entry point, blocking the manual UAT gate)
- **Fix:** Added a `__DEV__`-guarded outline button on the Settings tab (above "Logga ut") calling `router.push('/_forge-gallery')`. The plan explicitly sanctions a dev entry point on an existing dev-accessible screen; NOT added to the tab bar.
- **Files modified:** app/app/(app)/(tabs)/settings.tsx
- **Verification:** `npx tsc --noEmit` exit 0; `npx expo lint` clean.
- **Committed in:** `6c6b099`

**Total deviations:** 3 (2 auto-fixed during execution + 1 follow-up dev entry-point addition). No scope creep — all keep the gallery compiling against the plan's stated import contract and make the UAT surface reachable.

## Manual UAT (Task 2 — checkpoint:human-verify, BLOCKING)

**Status: PENDING human sign-off.** Per D-07 the gallery IS the test surface and verification is manual device UAT in Expo Go — it cannot be automated (no RN render harness in the stack). The orchestrator returns control to a human to run the UAT.

**How to run:** In Expo Go on a physical iPhone, open the gallery via `router.push('/_forge-gallery')` (dev). In BOTH light and dark, confirm:
1. DSGN-01: every color swatch renders and flips with the theme.
2. DSGN-02: display headings + mono cell use the bundled faces (note any weight that fell back to standard Inter — D-05).
3. DSGN-03: the stacked-number column aligns digit-for-digit (tabular).
4. DSGN-04: every ForgeButton variant×size, ForgeField state, ForgeCard, ForgeStat, ForgeChip, SettingsRow, TabBar shell render correctly in both themes.
5. DSGN-05: ProgressRing (0.25/0.7/1.0) + Sparkline render via Skia (static, no animation).
6. DSGN-06: Logo (gradient + white) + AppIcon render.
7. I18N-01/04: the sv↔en toggle flips the sample strings live; numbers show `1 234,5` (sv) vs `1,234.5` (en); the date reformats per locale.
8. NO "forge-gallery" entry appears in the live tab bar.

If a section fails, file a Linear UI issue (type=ui, priority=high) and loop back to the owning plan. Record the result (and any D-05 font fallbacks) here once signed off.

## Verification Results
- `cd app && npx tsc --noEmit` → exit 0.
- `cd app && npm run lint` → exit 0, **0 errors / 0 warnings**.
- `cd app && npx tsx scripts/check-locale-parity.ts` → **PASS — sv/en key sets match (93 keys).**
- Gating greps: `grep -rl "_forge-gallery" app/(app)/(tabs)/` → **0** (not a tab child); `__DEV__` present (3×); `changeLanguage` present (4×); imports `@/components/ui` + `react-i18next`.
- No dependency bumps: this plan's commit touches only the 2 new files; `app/package.json` / `app/package-lock.json` unchanged. No nativewind/tailwindcss/skia/react-native-svg bump.
- **F13 untouched:** `git diff --name-only HEAD -- app/lib/query/` is empty — the offline-queue layer is not modified.

## Issues Encountered
- **`npm run test:f13-brutal` reported FAIL — out of scope, NOT a regression from this plan.** This script is a *live-database data-state probe*: it inspects the most-recent `workout_session` in Supabase and asserts it contains the 25-set brutal-test fixture. The most recent session in the DB at run time was an unrelated empty session (`mai@gmail.com`, sets=0), so the probe failed on missing fixture data — it requires a freshly-run brutal-test session to pass and is independent of any code change here. This plan touches zero F13 query-layer files (verified: `git diff app/lib/query/` empty). The F13 gate should be re-run after the manual harness creates a fresh 25-set session; the failure does not reflect a code regression and does not block the gallery. (Tracked as a verification-environment note, not a code defect.)

## Threat Model Compliance
- **T-08-10 (Information disclosure — dev gallery reachable in release):** Mitigated (defense-in-depth). The route lives OUTSIDE `(tabs)/` (never in nav) AND the screen body is `__DEV__`-guarded so a release build renders only a notice; it sits behind the existing `(app)` session guard and renders only sample/app-controlled data. `__DEV__` guard verified present.
- **T-08-11 (Tampering — i18n toggle):** Accepted (per register). The toggle calls `i18n.changeLanguage('sv'|'en')` with a hardcoded literal union — no free text enters the i18n engine; `escapeValue:false` is safe inside RN `<Text>`.

No new threat surface beyond the plan's register.

## Next Phase Readiness
- All 8 phase requirements (DSGN-01..06, I18N-01, I18N-04) are now observable in one place — Phases 9-12 re-skins import primitives from the new `@/components/ui` barrel and use the gallery as the living visual reference.
- The dev-only-route pattern (`_<name>.tsx` + `__DEV__` body guard) is reusable for any future verification surface.
- TabBar remains standalone (OQ-5); its live `<Tabs>` wiring is Phase 9+.
- **Gate before phase close:** the manual device UAT (Task 2) must be signed off, and `gsd-secure-phase 8` must confirm `threats_open: 0`.

## Self-Check: PASSED

Both created files verified present on disk (`app/app/(app)/_forge-gallery.tsx`, `app/components/ui/index.ts`); Task 1 commit `408c8f7` verified in git history. tsc + lint exit 0; locale-parity PASS; gating greps pass; F13 query layer unmodified.

---
*Phase: 08-forge-foundation*
*Completed (code): 2026-06-10 — manual UAT pending human sign-off*
