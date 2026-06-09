# Feature Research — v2.0 Forge Redesign

**Domain:** iOS gym tracker — UI overhaul + new features on top of v1.0 offline-first core
**Researched:** 2026-06-09
**Confidence:** HIGH (sourced directly from `forge-screens.jsx`, `lib.jsx`, `README.md`, and `PROJECT.md`)

---

## v1.0 Baseline (already shipped — not re-counted as new)

F1 auth · F2 plans CRUD · F3 custom exercises · F4 drag-reorder · F5 start workout · F6 log set ≤3s ·
F7 last-value display · F8 finish workout · F9 history list · F10 per-exercise chart · F11 RPE per set ·
F12 session notes · F13 offline-first · F15 dark-mode toggle · F17 set_type schema (no UI)

---

## Feature Landscape by Category

### Category 1 — Design System Foundation

Tokens, fonts, and component library that every screen and every other feature depends on. Must land first.

| Feature | Classification | Complexity | DB / RPC / UI | v1 Dependency | Notes |
|---------|---------------|------------|----------------|---------------|-------|
| Mirror `THEMES.forge` into `tailwind.config.js` (colors light+dark, radius, elevation) | **Table stakes** — all other work blocks on this | LOW | Pure UI | F15 dark mode | Single config file edit; unlocks the rest of re-skin |
| Expo Font loading — Inter Display + Inter + JetBrains Mono via `expo-font` in `app/_layout.tsx` | **Table stakes** — screen titles look broken without it | LOW | Pure UI | None | Add to root layout; no native rebuild needed in Expo Go |
| Forge component library: `ForgeButton`, `ForgeField`, `ForgeCard`, `ForgeStat`, `ForgeChip`, `ForgeInput`, `FStepperInput` | **Table stakes** — re-skin is copy-paste without these | MEDIUM | Pure UI | None | ~7 new RN components; spec fully defined in `forge-screens.jsx` |
| `ProgressRing` (Skia-backed, gradient stroke) | **Table stakes** — Home dashboard blocks on it | MEDIUM | Pure UI | F10 (Skia already in stack) | Port SVG `ProgressRing` from `lib.jsx` to Skia; Skia 2.x already installed |
| `Sparkline` (gradient fill area chart, accent dot) | **Table stakes** — History + Home dashboard | MEDIUM | Pure UI | F10 (Skia/Victory already in stack) | Port SVG `Sparkline` from `lib.jsx`; reuse Victory Native or Skia path |
| `Logo` / `AppIcon` — Ascend mark (two rising bars + peak dot) | **Table stakes** — brand identity | LOW | Pure UI | None | SVG path defined in `lib.jsx`; replace current barbell brand mark on auth screens |
| `TabBar` — Forge-themed (blur backdrop, orange accent on active) | **Table stakes** | LOW | Pure UI | None | Expo Router tab bar styled with tokens |

**Anti-feature:** Do NOT introduce a theme-switcher between Forge / Atlas / Volt. `lib.jsx` defines all three but PROJECT.md locks v2.0 to Forge only. Adding a theme picker now is scope creep — defer to a future "themes" milestone if ever.

---

### Category 2 — Screen Re-skin (17 screens + 3 overlays)

Replace stock blue/gray classes with Forge tokens. Logic and data layer unchanged.

| Screen / Overlay | Classification | Complexity | DB / RPC / UI | v1 Dependency | New UI elements added vs v1 |
|------------------|---------------|------------|----------------|---------------|-----------------------------|
| FSignIn | **Table stakes** | LOW | Pure UI | F1 | Ascend logo mark, hero heading at Display scale, accent button with shadow |
| FSignUp | **Table stakes** | LOW | Pure UI | F1 | Password strength bar (4-segment, visual only) |
| FHome | **Table stakes** | MEDIUM | Read-side RPC (DASH-*) | F2 | Activity ring card (ProgressRing), streak chip, volume chip — new dashboard widgets |
| FHomeActive | **Table stakes** | LOW | Pure UI | F5 | Active-session banner re-skin; pulsing dot indicator |
| FPlanDetail | **Table stakes** | LOW | Pure UI | F2, F7 | Quick stats row (exercises, last trained, avg time); set×rep target display (exposes `plan_exercises.target_sets/reps_min/reps_max`) |
| FNewPlan | **Table stakes** | LOW | Pure UI | F2 | Description textarea re-skin; exposes `workout_plans.description` field |
| FExercisePicker | **Table stakes** | LOW | Pure UI | F3 | Muscle-group filter pills; `muscle_group`+`equipment` metadata shown under each exercise name |
| FExercisePickerNew | **Table stakes** | LOW | Pure UI | F3 | Muscle group dropdown, equipment field, notes field — exposes `exercises.muscle_group/equipment/notes` |
| FExerciseEdit | **Table stakes** | MEDIUM | Pure UI (existing cols) | F2 | Stepper inputs for `target_sets`, `reps_min`, `reps_max`; notes textarea; "current target" preview chip |
| FWorkout | **Table stakes** | MEDIUM | Pure UI | F5, F6, F7 | Set progress bar (dots/segments); PR banner inline; "Up next" exercise hint row |
| FFinishOverlay | **Table stakes** | LOW | Pure UI | F8 | Trophy icon, notes textarea inline, stats row (sets/volume/duration) |
| FDraftResumeOverlay | **Table stakes** | LOW | Pure UI | F13 | Re-skin of existing draft-resume overlay; "Live" badge; pulsing dot |
| FSavedToast | **Table stakes** | LOW | Pure UI | F8 | Green pill toast (bottom-center, above tab bar) |
| FHistory | **Table stakes** | LOW | Read-side RPC | F9 | Weekly volume card + Sparkline; all-time count subtitle; trophy badge on sessions with PRs |
| FSessionDetail | **Table stakes** | LOW | Pure UI | F9, F12 | 3-col stats grid (sets/volume/duration); notes block; exercise breakdown rows with max-weight + trophy |
| FChart | **Table stakes** | LOW | Read-side RPC | F10 | Hero estimated 1RM stat; delta chip; 30d/90d/all-time range selector; stat chips (top set, vol/session, avg RPE) |
| FSettings | **Table stakes** | MEDIUM | Additive migration + local pref | New screen in v2 | Full settings screen — profile card, theme toggle, language picker, units, rest timer config, haptics/notifications toggles, sign out |

---

### Category 3 — Settings Screen & Preferences (NEW — no v1 equivalent)

v1 only had a theme toggle in a placeholder settings tab. This is a fully new screen.

| Feature | Classification | Complexity | DB / RPC / UI | Notes |
|---------|---------------|------------|----------------|-------|
| Profile card — display_name + avatar initials (gradient circle) | **Table stakes** for a named personal tool | LOW | Additive `profiles` migration: add `display_name TEXT` | Column likely already exists or partially exists; verify schema |
| Units toggle (kg / lbs) — stored in `profiles.preferred_unit` | **Table stakes** — any user not on metric needs this | LOW | Additive `profiles` migration: add `preferred_unit TEXT DEFAULT 'kg'` | Pure preference; affects only how numbers render — no set data changes |
| Weekly goal (sessions/week) — drives activity ring on Home | **Differentiator** — personalises the ring | LOW | Additive `profiles` migration: add `weekly_goal INT DEFAULT 4` | Required by Home dashboard ring fill calculation |
| Language toggle (sv / en) — stored in AsyncStorage or `profiles` | **Table stakes** — English required for App Store path | LOW | Local pref (AsyncStorage) or `profiles.language`; either works | expo-localization + react-i18next; user content never translated (anti-feature — see below) |
| Theme toggle (System / Light / Dark) — already in v1 via AsyncStorage | **Table stakes** — persist existing behaviour | LOW | Pure UI (already exists) | Migrate from v1 SegmentedControl into Forge SettingsRow inline segment |
| Haptics toggle — on/off stored locally | **Table stakes** — required by motion spec | LOW | Local pref (AsyncStorage) | Gate all `Haptics.impactAsync()` calls behind this preference |
| Notifications toggle — on/off stored locally | **Table stakes** — required by rest timer | LOW | Local pref (AsyncStorage) | Gate `expo-notifications` behind this; also needed for rest-timer notification |
| Rest timer config — duration (shown as "2 min") | **Differentiator** | LOW | Local pref (AsyncStorage) | Tappable row opens a picker/sheet; feeds F19 rest timer |
| Sign out button | **Table stakes** | LOW | Pure UI | Already exists in v1 menu |

**DB impact:** One additive migration on `profiles` adding 3 columns (`display_name`, `preferred_unit`, `weekly_goal`). No existing column changes. No RLS policy changes needed (same `(select auth.uid())` predicate on existing `profiles` policies covers new columns automatically).

---

### Category 4 — Home Dashboard

Transforms the Home/Plans tab into a glanceable training hub.

| Feature | Classification | Complexity | DB / RPC / UI | v1 Dependency | Notes |
|---------|---------------|------------|----------------|---------------|-------|
| Activity ring — sessions this week vs `profiles.weekly_goal` | **Differentiator** — Apple Fitness DNA, the hero widget | MEDIUM | New read-side RPC: `get_dashboard_stats(user_id, week_start)` → `{sessions_this_week, weekly_goal, streak_days, week_volume_kg, prev_week_volume_kg}` | F9 (sessions), Settings weekly goal | Uses ProgressRing component; gradient fill via Skia |
| Streak counter — consecutive days with a session | **Differentiator** — habit formation signal | LOW | Same RPC as above | F9 | Computed in RPC from `workout_sessions.started_at`; display as chip with flame icon |
| Weekly volume + % delta vs prior week | **Table stakes** for any serious tracker | LOW | Same RPC as above | F9 | Simple aggregation; `+12%` delta chip with success color |
| Sparkline on History screen (weekly volume trend) | **Table stakes** — context for the number | LOW | Same RPC or `get_session_summaries` already in v1 | F9 | Reuses Sparkline component; data from last 10 weeks |
| Date subtitle on Home ("Tisdag · 16 maj") | **Table stakes** | LOW | Pure UI (JS date) | None | `date-fns` format; respects language toggle |

**DB impact:** One new read-side RPC (`get_dashboard_stats`). No schema changes beyond the `profiles.weekly_goal` from Category 3. RPC is pure `SELECT` — no new RLS needed.

---

### Category 5 — PR Celebration / e1RM Detection (F18)

| Feature | Classification | Complexity | DB / RPC / UI | v1 Dependency | Notes |
|---------|---------------|------------|----------------|---------------|-------|
| Epley e1RM calculation — `weight * (1 + reps/30)` | **Differentiator** — fitness-specific metric | LOW | Pure client logic (no DB) | F6, F7 | Pure function; runs on set-log, compares against stored best |
| PR detection — compare new e1RM against historical best per exercise | **Differentiator** | MEDIUM | New read-side RPC or extend `get_exercise_top_sets` | F10 (existing top-sets RPC) | Needs historical max e1RM per exercise; can be derived from `exercise_sets` on-demand or precomputed |
| PR banner inline in FWorkout — gradient trophy block, "Nytt personbästa" | **Differentiator** | LOW | Pure UI | F6 | Conditional render when PR detected; spec fully defined in `FWorkout` |
| Trophy badge on set row — gradient circle with trophy icon | **Table stakes** once PR detection exists | LOW | Pure UI | F18 (PR detection) | Shown in set list row when `set.pb === true` |
| Trophy badge on history session row | **Table stakes** — retroactive visibility | LOW | Pure UI | F9, F18 | Session has a PR if any set in it is a new all-time best |
| Trophy icon in FFinishOverlay on session-complete | **Table stakes** — celebration moment | LOW | Pure UI | F8 | Static; always shown at finish, not conditional |

**DB impact:** No new tables. May need a new RPC or extend `get_exercise_top_sets` to return the historical max e1RM per exercise so the client can compare. Alternatively compute entirely client-side from cached TanStack data. Either way — no migration required.

**Anti-feature:** Do NOT store `is_pr BOOLEAN` as a persisted column on `exercise_sets`. PRs are relative to the set's position in time — a new heavier set today makes an old set retroactively no longer the PR. Compute on read, not on write.

---

### Category 6 — Rest Timer (F19)

| Feature | Classification | Complexity | DB / RPC / UI | v1 Dependency | Notes |
|---------|---------------|------------|----------------|---------------|-------|
| Auto-start rest timer on "Klart" tap | **Differentiator** — removes friction from the hot path | MEDIUM | Pure UI + local state (Zustand) | F6 (set-log) | Trigger in the same handler that logs the set; duration from settings |
| Countdown display — inline in workout screen or floating pill | **Table stakes** once timer exists | LOW | Pure UI | F19 (auto-start) | Design spec shows "På · 2 min" in settings row; actual countdown widget not fully specified in screens — implement as bottom-sheet or floating pill |
| expo-notifications — local notification when rest ends | **Differentiator** | HIGH | expo-notifications (new dep) | F19 | **Research flag**: JS-suspension-trap — app backgrounded = timer may not fire on time. Solution: schedule a `notificationTrigger` with exact timestamp at timer start, not rely on `setInterval`. Needs `expo-notifications` permission flow |
| Haptic pulse when timer ends (if app is foregrounded) | **Table stakes** once timer exists | LOW | Pure UI | Haptics toggle (Category 3) | `Haptics.notificationAsync(NotificationFeedbackType.Success)` |
| Timer duration configurable in Settings ("2 min") | **Table stakes** | LOW | Local pref | F19, Category 3 | Already wired in FSettings spec |

**DB impact:** None. Timer state is ephemeral (Zustand, cleared on workout finish). Duration preference is in AsyncStorage.

**Anti-feature:** Do NOT use `setInterval` alone for background countdown — JS thread can be suspended. Schedule a native notification with exact future timestamp at timer-start; cancel it if the user manually dismisses the timer.

---

### Category 7 — i18n (Swedish + English)

| Feature | Classification | Complexity | DB / RPC / UI | Notes |
|---------|---------------|------------|----------------|-------|
| expo-localization — detect device language on first launch | **Table stakes** for App Store path | LOW | Local pref | Default to `sv` for current user; device locale fallback |
| react-i18next — namespace-based UI string loading from `sv.json` / `en.json` | **Table stakes** | MEDIUM | Pure UI | Pull all hardcoded Swedish strings from components into `sv.json`; add `en.json` from `I18N.en` in `lib.jsx` — 100+ keys fully specified |
| Language toggle in Settings | **Table stakes** | LOW | Local pref | Persist selected language in AsyncStorage; override device locale |
| Bilingual date formatting (date-fns locale) | **Table stakes** | LOW | Pure UI | `'16 maj'` vs `'May 16'` — pass `sv` or `enUS` locale to `format()` |

**Anti-feature:** Do NOT auto-translate user-generated content (plan names, exercise names, session notes). Store as entered. Translate only UI chrome. This is explicitly stated in PROJECT.md scope.

**Anti-feature:** Do NOT use a single monolithic i18n object in a JS file (like `lib.jsx` does for the design spec). Use proper JSON files (`locales/sv.json`, `locales/en.json`) loaded by `react-i18next` — hot-reload friendly, splittable, testable.

---

### Category 8 — Motion & Haptics

| Feature | Classification | Complexity | DB / RPC / UI | v1 Dependency | Notes |
|---------|---------------|------------|----------------|---------------|-------|
| Set-logged animation — scale pulse + check icon cross-fade on "Klart" | **Differentiator** — makes the hot path feel premium | MEDIUM | Pure UI (Reanimated 4) | F6 | `withSpring` scale + `withTiming` opacity; gated by haptics toggle |
| Haptic feedback on "Klart" — `Haptics.impactAsync(Medium)` | **Table stakes** once haptics toggle exists | LOW | Pure UI | Haptics toggle | Must check toggle preference before calling |
| Activity ring fill animation — `withTiming` stroke-dasharray on mount | **Differentiator** | LOW | Pure UI | DASH-* | Animate from 0 → target value when Home mounts |
| PR sweep animation — gradient arc sweep when PR banner appears | **Differentiator** | MEDIUM | Pure UI (Reanimated + Skia) | F18 | Skia `useDerivedValue` + animated path; can defer to post-launch if blocking |
| Chart draw animation — path drawing from left to right on mount | **Differentiator** | MEDIUM | Pure UI (Reanimated + Skia) | F10 | Victory Native or Skia animated path; currently static in v1 |
| Tab crossfade — fade transition between tabs | **Table stakes** — standard Expo Router polish | LOW | Pure UI | None | `expo-router` `<Tabs>` `screenOptions` animation config |

**Anti-feature:** Do NOT tie all haptics/animation to a single "animations" toggle. Haptics and visual animation are separate user concerns. The spec defines them as separate toggles (haptics toggle in settings; no explicit "disable animations" toggle — default RN respects iOS `Reduce Motion` accessibility setting automatically).

---

### Category 9 — Expose Existing Schema Fields in UI

v1 had these columns but showed none of them in the UI. Pure UI work — no migrations needed.

| Feature | Classification | Complexity | DB / RPC / UI | v1 Column | Notes |
|---------|---------------|------------|----------------|-----------|-------|
| Exercise `muscle_group` + `equipment` shown under name in picker and exercise list | **Table stakes** — users need context when choosing | LOW | Pure UI | `exercises.muscle_group`, `exercises.equipment` | Shown as `Bröst · Skivstång` subtitle in FExercisePicker and FExercisePickerNew |
| Exercise `notes` field — textarea in FExercisePickerNew (create form) | **Table stakes** | LOW | Pure UI | `exercises.notes` | Already in schema; just never surfaced |
| Muscle-group filter pills in FExercisePicker | **Differentiator** — quality-of-life for large exercise lists | MEDIUM | Pure UI | Derived from `exercises.muscle_group` | Client-side filter from cached query; no new RPC |
| Plan exercise `target_sets` / `reps_min` / `reps_max` — shown as `4 × 6–8` in FPlanDetail and FWorkout | **Table stakes** — this is what "programming" means | LOW | Pure UI | `plan_exercises.target_sets`, `.reps_min`, `.reps_max` | Already in schema; stepper inputs in FExerciseEdit to set them |
| Plan exercise `notes` — textarea in FExerciseEdit | **Table stakes** | LOW | Pure UI | `plan_exercises.notes` | Shown as "Tempo, vilotid, formfokus…" placeholder |
| `workout_plans.description` — textarea in FNewPlan + shown in FPlanDetail | **Table stakes** | LOW | Pure UI | `workout_plans.description` | Schema has this column; never shown in v1 |

**DB impact:** None. All these columns exist in the v1 schema. Zero migrations.

---

## Feature Dependencies

```
[Category 1 — Design System]
    └──required by──> ALL other categories

[Category 3 — Settings: weekly_goal]
    └──required by──> [Category 4 — Home dashboard: activity ring]

[Category 3 — Settings: haptics toggle]
    └──required by──> [Category 8 — Motion & haptics: gating]

[Category 3 — Settings: notifications toggle]
    └──required by──> [Category 6 — Rest timer: expo-notifications]

[Category 5 — PR detection: e1RM]
    └──required by──> [Category 5: PR banner in FWorkout]
    └──required by──> [Category 5: Trophy badge on set/session/history rows]

[Category 6 — Rest timer: auto-start]
    └──required by──> [Category 6: countdown + notification]

[Category 7 — i18n: react-i18next setup]
    └──required by──> ALL UI string work across all categories

[F6 — log set (v1)]
    └──enhances──> [Category 5 — PR detection]
    └──enhances──> [Category 6 — Rest timer auto-trigger]
    └──enhances──> [Category 8 — set-logged animation]

[F10 — per-exercise chart (v1)]
    └──enhances──> [Category 5 — PR detection: get_exercise_top_sets RPC]
```

### Dependency Notes

- **Design system must land first:** Tokens in `tailwind.config.js` + fonts in `_layout.tsx` are the gate for every screen re-skin. Ship Category 1 as Phase 1 of v2.0.
- **Settings migration before dashboard:** `profiles.weekly_goal` column required by the activity ring computation. The additive `profiles` migration (Category 3) must be deployed before the dashboard RPC (Category 4) is wired up.
- **i18n setup before screen text work:** Adding `react-i18next` late means double-editing strings. Wire it during re-skin (or just before), not after.
- **PR detection is read-only:** Can be computed entirely client-side from TanStack Query cache without a new RPC. Keep it client-side to avoid touching write path (offline-first invariant).
- **Rest timer notification vs JS suspension:** expo-notifications `scheduleNotificationAsync` with a future `seconds` trigger fires even if JS is suspended. `setInterval` does not. These are not interchangeable.

---

## DB Migration vs RPC vs Pure UI Summary

| Category | DB Migration | New RPC | Pure UI only |
|----------|-------------|---------|--------------|
| 1 Design system | — | — | YES |
| 2 Screen re-skin | — | — | YES (except dashboard screens) |
| 3 Settings & prefs | YES — additive `profiles` cols (`display_name`, `preferred_unit`, `weekly_goal`) | — | Mostly (local prefs in AsyncStorage) |
| 4 Home dashboard | — | YES — `get_dashboard_stats` | + ProgressRing/Sparkline UI |
| 5 PR celebration | — | Maybe — extend `get_exercise_top_sets` OR pure client | + banner/badge UI |
| 6 Rest timer | — | — | YES (Zustand + expo-notifications) |
| 7 i18n | — | — | YES + JSON locale files |
| 8 Motion & haptics | — | — | YES (Reanimated 4 already installed) |
| 9 Expose schema fields | — | — | YES (columns already exist) |

---

## MVP Definition for v2.0

### Launch With (must-have for v2.0 "Forge Redesign" milestone)

- [x] Category 1 — Design system foundation (tokens, fonts, 7 components)
- [x] Category 2 — All 17 screens + 3 overlays re-skinned on Forge tokens
- [x] Category 3 — Settings screen + `profiles` migration (display_name, preferred_unit, weekly_goal)
- [x] Category 4 — Home dashboard (activity ring, streak, weekly volume, sparkline)
- [x] Category 5 — PR celebration: e1RM detection + PR banner + trophy badges
- [x] Category 6 — Rest timer: auto-trigger + countdown + expo-notifications
- [x] Category 7 — i18n: sv + en via react-i18next
- [x] Category 8 — Motion: set-logged animation, ring fill animation, tab crossfade, haptic on Done
- [x] Category 9 — Expose existing schema fields (muscle group, target sets/reps, plan description)

### Add After Validation (v2.x)

- PR sweep animation on Skia (Category 8) — can ship without it; implement when charting phase revisited
- Chart draw animation (Category 8) — nice-to-have; Victory Native may support it via `animate` prop
- Per-exercise notification for rest timer (v2.1) — user might want different rest durations per exercise

### Deferred to Later Milestones

- Apple Sign-In (F14 / FIT-45) — TestFlight milestone
- F17-UI set-type toggling — explicitly out of v2.0 scope
- Android support — v2+ evaluation, not v2.0
- Global exercise library / seed data — schema supports null `user_id`, can seed without migration
- Social features, AI coach, Apple Watch, CSV export — all explicitly out of scope per PROJECT.md

---

## Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Forge tokens → tailwind.config.js | HIGH (blocks everything) | LOW | P1 |
| Font loading (Inter Display + Mono) | HIGH | LOW | P1 |
| Forge component library (7 components) | HIGH (blocks screens) | MEDIUM | P1 |
| All 17 screen re-skins | HIGH (core deliverable) | MEDIUM | P1 |
| Settings screen + profiles migration | HIGH | MEDIUM | P1 |
| i18n sv/en | HIGH (App Store path) | MEDIUM | P1 |
| Home dashboard (ring + streak + volume) | HIGH (signature feature) | MEDIUM | P1 |
| PR celebration (e1RM + banner + trophies) | HIGH (motivation loop) | MEDIUM | P1 |
| Rest timer + expo-notifications | MEDIUM-HIGH | HIGH (suspension trap risk) | P1 |
| Expose schema fields (muscle group, reps targets) | MEDIUM (quality-of-life) | LOW | P1 |
| Set-logged animation + haptics | MEDIUM (polish) | MEDIUM | P2 |
| Ring fill animation on Home mount | MEDIUM (premium feel) | LOW | P2 |
| PR sweep animation (Skia) | LOW-MEDIUM | HIGH | P3 |
| Chart draw animation | LOW | MEDIUM | P3 |

---

## Anti-Features Catalog

| Anti-Feature | Why Requested | Why Problematic | Correct Approach |
|-------------|---------------|-----------------|------------------|
| Auto-translate user content (plan/exercise names) | i18n looks thorough | Mutates user data; plan named "Bänkpress" should not silently become "Bench press" in EN mode | Translate UI chrome only; display user content as-entered |
| `is_pr BOOLEAN` persisted on `exercise_sets` | Simpler PR badge rendering | PRs shift over time — a heavier future set invalidates all prior rows' `is_pr = true` | Compute on read from e1RM comparison; never write |
| `setInterval` for rest timer countdown | Simple JS approach | JS thread suspended in background = timer drifts or silently stops | Schedule `expo-notifications` native trigger at start time; cancel on dismiss |
| Multi-theme picker (Forge / Atlas / Volt) | `lib.jsx` defines all three; looks like a feature | Out of v2.0 scope; Atlas/Volt tokens not in tailwind.config; doubles styling surface area | Forge only in v2.0; defer theme picker to a dedicated "themes" milestone |
| Tailwind v4 | Latest version, NativeWind upgrade | NativeWind 4.x hard-requires `tailwindcss: ~3` via `react-native-css-interop@0.2.3` peer dep | Stay on Tailwind 3.x until NativeWind v5 GA (CLAUDE.md constraint) |
| Hand-editing `database.ts` | Quick shortcut | Convention violation: `database.ts` is generated; edits get overwritten by next `npm run gen:types` | Run `npm run gen:types` after every migration; never edit the file manually |

---

## Sources

- `app/design v2/Sources/design/forge-screens.jsx` — all 17 screens + 3 overlays as React components (FSignIn through FSettings + FHomeActive, FDraftResumeOverlay, FSavedToast)
- `app/design v2/Sources/design/lib.jsx` — `THEMES.forge` tokens (dark+light color scales, radius), `I18N` sv+en string catalogue (100+ keys), icon set (26 icons), `ProgressRing`, `Sparkline`, `FullChart`, `Logo`, `AppIcon` components
- `app/design v2/Sources/design/README.md` — migration order, file map, brand/barbell icon guidance
- `.planning/PROJECT.md` — v2.0 milestone goal, target features, explicit out-of-scope list, v1.0 validated features, tech stack constraints
- `CLAUDE.md` — tech stack constraints (Tailwind 3 pin, Expo SDK 54, offline-first invariant, RLS rules, migration-as-truth)

---

*Feature research for: FitnessMaxxing v2.0 Forge Redesign*
*Researched: 2026-06-09*
