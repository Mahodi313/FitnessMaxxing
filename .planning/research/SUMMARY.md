# Project Research Summary

**Project:** FitnessMaxxing
**Domain:** Personal iOS gym tracker (Expo + Supabase, offline-first) — milestone v2.0 "Forge Redesign"
**Researched:** 2026-06-09
**Confidence:** HIGH

## Executive Summary

v2.0 is a **design-system rewrite + feature layer on top of a shipped, validated v1.0**. The decisive research finding is that **the hard part is already done**: the v1 schema already carries almost every data field the new design surfaces (`exercises.muscle_group/equipment/notes`, `plan_exercises.target_sets/target_reps_min/target_reps_max/notes`, `profiles.display_name/preferred_unit`, `workout_plans.description`, `workout_sessions.started_at/finished_at`). The only additive DB change is **one column** (`profiles.weekly_goal`) plus **two read-side RPCs** for the dashboard. Everything else is UI, tokens, fonts, animation, and i18n — none of which touches the offline-first write path or the F13 "never lose a set" guarantee.

The recommended approach is **infrastructure-first, then re-skin screen-group by screen-group, then add the net-new features (dashboard → PR → rest-timer) last.** Tokens, fonts, the Forge component library, and the i18n scaffold land before any screen changes so every subsequent screen inherits them. The two genuinely risky areas are isolated: the **active-workout re-skin** (proximity to the F13 hot path) and the **rest timer** (JS-suspension trap + notification permissions).

Net-new dependencies are minimal: `i18next` + `react-i18next` + `@expo-google-fonts/inter` + `@expo-google-fonts/jetbrains-mono` via npm, and `expo-localization` + `expo-notifications` + `expo-keep-awake` via `npx expo install`. `expo-font`, `expo-splash-screen`, `expo-haptics`, Skia 2.2.12, and Reanimated 4 are **already installed**. Inter Display has no Google-Fonts package and must be self-hosted as `.ttf` from the rsms/inter releases.

## Key Findings

### Recommended Stack

All additions are SDK-54-compatible. No native-module changes that break Expo Go (local notifications work in Expo Go SDK 54; only remote push is removed). Tailwind stays on **v3** — v4 breaks NativeWind 4 and must never be installed. See `STACK.md`.

**Core additions:**
- **i18next + react-i18next** — UI-text i18n (sv + en); the design's `lib.jsx` `I18N` object is a ready-made string map to port.
- **expo-localization** — device locale detection (override via Settings).
- **expo-notifications + expo-keep-awake** — OS-scheduled local notification for rest-timer end (survives JS suspension).
- **@expo-google-fonts/inter + jetbrains-mono** (npm) + **self-hosted Inter Display .ttf** — loaded via already-installed `expo-font`.
- **Skia 2.2.12 + Reanimated 4 (already installed)** — ProgressRing (animated strokeDashoffset), Sparkline, chart-line-draw. **No new charting dep.**

### Expected Features

See `FEATURES.md` (9 categories, 50+ items). 7 of 9 categories are pure UI.

**Must have (table stakes for a premium fitness app):**
- Token-driven theme (light+dark parity) + custom type system
- All 17 screens + 3 overlays re-skinned without regressions
- Settings screen + preferences (units kg/lbs, profile, language, weekly goal, toggles)
- English locale alongside Swedish (UI text only)

**Should have (differentiators):**
- Home activity-ring dashboard (sessions/week vs goal, streak, weekly volume + delta, sparkline)
- PR celebration with e1RM (Epley) detection + trophies
- Rest timer with end-of-rest notification

**Defer (later milestone):**
- Apple Sign-In + TestFlight (needs Apple Developer tools)
- Deeper App-Store DB design (expanded user profile/account data)
- Atlas/Volt alternate themes (Forge only for v2.0)

### Architecture Approach

Token-first, additive, offline-safe. See `ARCHITECTURE.md`.

**Major components / decisions:**
1. **Tailwind token layer** — `THEMES.forge` mirrored into `tailwind.config.js` `theme.extend`; screens migrate stock blue/gray → tokens via the existing `dark:` convention.
2. **Font + splash gating** — `useFonts` integrated into the existing ThemeBootstrap-before-SplashScreenController ordering; `SplashScreen.hideAsync` gated on auth + fonts + i18n ready in parallel.
3. **Preference storage split** — only `weekly_goal` goes to Supabase (`profiles` migration); language/haptics/notifications/rest-default stay device-local in AsyncStorage (matches how the theme pref already works; offline + single-device).
4. **Dashboard RPCs** — two SECURITY INVOKER, RLS-scoped Postgres RPCs (`get_dashboard_stats`, `get_volume_sparkline`) mirroring the existing `0006` chart-RPC pattern.
5. **PR/e1RM client-side** — Epley `w*(1+r/30)` computed over the TanStack Query cache at finish; fully offline, F13-safe; recomputed on sync. No `is_pr` column.
6. **Rest timer** — OS-scheduled `expo-notifications` at rest-end time (NOT a JS `setTimeout`/`setInterval`); state in Zustand; cancel on early dismiss; reconcile remaining time from a `Date.now()` snapshot on foreground.
7. **i18n provider** — react-i18next initialized before first render; `sv.json`/`en.json` resources; strings lifted per screen during each re-skin phase.

### Critical Pitfalls

Top items from `PITFALLS.md` (12 total; 5 are F13-critical):

1. **Tailwind v4 sneaks in during token work** — pins break NativeWind 4. Prevention: keep `tailwindcss@^3.4.17`; CI assert `npm ls tailwindcss` shows 3.x.
2. **JS-suspension trap on the rest timer** — `setInterval` countdown dies when backgrounded. Prevention: schedule an OS local notification at the target time; compute remaining time from a stored timestamp.
3. **kg/lbs double-conversion at the write path** — corrupts logged weight / F6 / F7 / e1RM. Prevention: store canonical kg always; convert only at display/input edges; preserve the existing `,`→`.` decimal handling.
4. **PR detection via server RPC at finish** — breaks offline (F13). Prevention: compute client-side over local cache only.
5. **Re-skin breaks the inline-overlay / freezeOnBlur contract or the ≤3s log-set budget** — Prevention: never refactor overlays to `<Modal>`; keep animations off the write path; run `npm run test:f13-brutal` after every commit touching the workout screen or its overlays.

## Implications for Roadmap

Research supports **8 phases (8–15)**, infrastructure-first. v1.0 ended at Phase 7, so numbering continues at 8.

### Phase 8: Forge Foundation
**Rationale:** Every screen depends on tokens, fonts, the component library, and the i18n scaffold — build them once first.
**Delivers:** `tailwind.config.js` Forge tokens; expo-font loading (Inter Display + Inter + JetBrains Mono) gated into splash; react-i18next + expo-localization scaffold with `sv.json`/`en.json`; core components (ForgeButton/Field/Card/Stat, ProgressRing, Sparkline, Ascend Logo).
**Avoids:** Tailwind-v4 pitfall; font FOUC/splash race.

### Phase 9: Auth + Settings + Preferences
**Rationale:** Units + language are consumed by every later screen, so the preference layer must exist early. Auth screens are small and isolated — a safe first re-skin.
**Delivers:** FSignIn/FSignUp re-skin; new Settings screen; `profiles.weekly_goal` migration; AsyncStorage prefs (haptics/notifications/rest-default/language override); kg↔lbs conversion utility; language switch.
**Uses:** i18n scaffold, profiles migration, type-gen.

### Phase 10: Plans & Exercises re-skin
**Rationale:** Read/CRUD screens, no hot-path risk; surfaces existing schema fields.
**Delivers:** FHome plan-list, FPlanDetail, FNewPlan, FExercisePicker(+create), FExerciseEdit; expose muscle_group/equipment/notes + picker filters, target sets/rep-range, plan description.

### Phase 11: Active Workout re-skin (HIGH RISK — F13)
**Rationale:** Highest-risk re-skin; isolate it so the F13 gate is the sole focus.
**Delivers:** FWorkout, FFinishOverlay, FDraftResumeOverlay, FSavedToast, active-session-banner; set-logged animation + haptics. Inline-overlay pattern preserved; `test:f13-brutal` green.
**Avoids:** Modal-portal regression; ≤3s budget regression.

### Phase 12: History, Session Detail, Chart + Home Dashboard
**Rationale:** Read-side; introduces the dashboard RPCs alongside the screens that consume them.
**Delivers:** FHistory, FSessionDetail, FChart re-skin; activity ring + streak + weekly volume + sparkline; `get_dashboard_stats` + `get_volume_sparkline` RPCs (+ test-rls coverage).

### Phase 13: PR Celebration (F18)
**Rationale:** Builds on the now-re-skinned workout/history/chart screens; client-side e1RM is self-contained.
**Delivers:** Epley e1RM detection over cache; trophies on sets/sessions/history; PR banner + gradient-sweep animation. Offline-safe.

### Phase 14: Rest Timer (F19) — RESEARCH-FLAGGED
**Rationale:** Self-contained but carries the notification/JS-suspension risk; sequence late so it can't destabilize the re-skin.
**Delivers:** Auto-trigger on "Klart"; countdown UI + keep-awake; OS-scheduled end-of-rest notification; Settings integration; permission UX.

### Phase 15: Motion & i18n Completion + Bilingual UAT
**Rationale:** Final polish pass + verification that every string is translated and every screen reads correctly in both locales and both themes on device.
**Delivers:** Remaining motion-table animations; English-coverage audit; full sv/en × light/dark device UAT.

### Phase Ordering Rationale
- **Infrastructure (8) before any screen** — tokens/fonts/i18n/components are load-bearing for every later phase.
- **Preferences early (9)** — units + language are cross-cutting; later screens must read them.
- **Re-skin low-risk → high-risk (10 → 11)** — plans/exercises before the F13 hot path.
- **New features after re-skin (12–14)** — dashboard/PR/timer build on already-modernized screens.
- **Timer last among features (14)** — its notification/suspension risk is quarantined.

### Research Flags
Phases likely needing deeper research during planning:
- **Phase 14 (Rest Timer):** expo-notifications permission UX, Expo Go SDK 54 local-notification behavior, JS-suspension reconciliation, time-drift.
- **Phase 8 (fonts):** sourcing/bundling self-hosted Inter Display .ttf weights; fallback to Inter Tight if weights missing.

Phases with standard patterns (skip research-phase):
- **Phases 9–13, 15:** established NativeWind/Supabase-RPC/TanStack patterns already proven in v1.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Most deps already installed; new ones SDK-54-verified; Expo Go local-notification path confirmed |
| Features | HIGH | Fully specified by the design files; schema audit confirms field availability |
| Architecture | HIGH | Mirrors proven v1 patterns (RPCs, AsyncStorage prefs, dark: convention); offline path untouched |
| Pitfalls | HIGH | Concrete, F13-anchored, with CI/test gates |

**Overall confidence:** HIGH

### Gaps to Address
- **Inter Display .ttf sourcing** — confirm weights ship; fallback Inter Tight. Resolve in Phase 8 planning.
- **Streak definition** — consecutive-day vs consecutive-training-day vs weekly. Decide in Phase 12 discuss/plan.
- **Rest-timer notification UX in Expo Go** — validate on device early in Phase 14.

## Sources

### Primary (HIGH confidence)
- `app/types/database.ts` + `app/supabase/migrations/0006_*` — live schema + RPC pattern
- `app/design v2/Sources/design/{lib.jsx, forge-screens.jsx, README.md}` — design source of truth
- `app/package.json` — already-installed deps
- CLAUDE.md — locked stack pins + conventions

### Secondary (MEDIUM confidence)
- Expo SDK 54 docs (expo-font, expo-notifications, expo-localization) — version + Expo Go behavior
- react-i18next / i18next RN setup guidance

---
*Research completed: 2026-06-09*
*Ready for roadmap: yes*
