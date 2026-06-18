# v2.0 Forge Redesign — Architecture Research

**Project:** FitnessMaxxing  
**Milestone:** v2.0 "Forge Redesign"  
**Date:** 2026-06-09  
**Author:** Architecture Research Agent  

---

## Overview

This document answers the eight integration questions for the v2.0 "Forge Redesign" milestone. All decisions are grounded against the existing v1 architecture (Phase 1–7 codebase) and the `THEMES.forge` / `I18N` design contract in `app/design v2/Sources/design/lib.jsx`. The guiding constraint throughout: **nothing may risk the F13 "never lose a set" guarantee** — the 15 mutation-default / FIFO-scope-replay / optimistic-update system in `app/lib/query/client.ts` is load-bearing and must not be disturbed.

---

## 1. Token Migration — `THEMES.forge` → `tailwind.config.js`

### What exists today

`app/tailwind.config.js` has an empty `theme.extend: {}` and uses NativeWind's preset with `darkMode: "class"`. All existing screens use raw Tailwind colors (`bg-gray-900`, `text-blue-500`, etc.) — no semantic tokens.

### The Forge token set (from `lib.jsx` `THEMES.forge`)

```
dark:  bg=#000000  surface=#0E0E10  surface2=#18181B  surface3=#222226
       text=#FFFFFF  text2=rgba(255,255,255,0.62)  text3=rgba(255,255,255,0.38)
       accent=#FF5A1F  accentSoft=rgba(255,90,31,0.14)  success=#30D158
       warn=#FFD60A  danger=#FF453A  border=rgba(255,255,255,0.08)

light: bg=#FAFAF7  surface=#FFFFFF  surface2=#F2F1EC  surface3=#E8E7E1
       text=#0A0A0A  text2=#4D4D4D  text3=#8B8B8B
       accent=#E14E10  accentSoft=rgba(225,78,16,0.10)
       radius: sm=10  md=14  lg=20  xl=28
```

### Token mapping strategy

Add a `forge` key block in `theme.extend.colors` in `tailwind.config.js`. Because rgba() values cannot be expressed as Tailwind CSS variables directly (NativeWind 4 with `react-native-css-interop` resolves them at JSS boundary), use a **flat token approach**:

```js
// tailwind.config.js excerpt
theme: {
  extend: {
    colors: {
      forge: {
        bg:          { DEFAULT: '#000000',   light: '#FAFAF7' },
        surface:     { DEFAULT: '#0E0E10',   light: '#FFFFFF' },
        surface2:    { DEFAULT: '#18181B',   light: '#F2F1EC' },
        surface3:    { DEFAULT: '#222226',   light: '#E8E7E1' },
        text:        { DEFAULT: '#FFFFFF',   light: '#0A0A0A' },
        // rgba tokens — expressed as hex with opacity modifier at use-site
        // e.g.  text2: text-forge-text/62   text3: text-forge-text/38
        accent:      { DEFAULT: '#FF5A1F',   light: '#E14E10' },
        success:     { DEFAULT: '#30D158',   light: '#1E9E45' },
        warn:        { DEFAULT: '#FFD60A',   light: '#B68000' },
        danger:      { DEFAULT: '#FF453A',   light: '#D70015' },
        gradFrom:    { DEFAULT: '#FF7A2E',   light: '#FF7A2E' },
        gradTo:      { DEFAULT: '#FF2D55',   light: '#FF3D5E' },
      },
    },
    fontFamily: {
      display: ['InterDisplay', 'Inter', 'System'],
      mono:    ['JetBrainsMono', 'SFMono', 'Menlo'],
    },
    borderRadius: {
      'forge-sm': '10px',
      'forge-md': '14px',
      'forge-lg': '20px',
      'forge-xl': '28px',
    },
  },
},
```

For `rgba` opacity-based tokens (`text2`, `text3`, `border`, `accentSoft`), use Tailwind's built-in opacity modifier syntax: `text-forge-text/62`, `bg-forge-accent/14`. This avoids creating non-standard hex-with-alpha Tailwind values that NativeWind may not resolve correctly in RN.

### Migration order — staged, never big-bang

**Phase A — tokens only (no screen changes):**
1. Add `forge.*` to `tailwind.config.js` `theme.extend` as above.
2. Add `InterDisplay` and `JetBrainsMono` font loading (see §2).
3. Run `npx expo start` — confirm no build errors.
4. Keep all existing `bg-gray-*` / `text-blue-*` classes untouched. Tokens coexist.

**Phase B — design-system component layer:**
Build new `components/ui/` primitives (`ForgeCard`, `ForgeButton`, `ForgeInput`, `ForgeChip`, `ForgeStat`, `SettingsRow`, `ProgressRing`) using `forge.*` tokens. Each component uses `dark:` variant for the light↔dark flip, following existing convention from Phase 1.

Example mapping for `ForgeButton`:
```tsx
className="bg-forge-accent dark:bg-forge-accent rounded-forge-lg h-14 active:opacity-90"
```

**Phase C — screen re-skin, one screen at a time:**
Replace `bg-gray-900 dark:bg-black` etc. in existing screens with `bg-forge-bg`, `bg-forge-surface`, `text-forge-text` etc. Proceed screen by screen: `(tabs)/index.tsx` → `(tabs)/history.tsx` → `workout/[sessionId].tsx` → auth screens → `settings.tsx`. Each screen is a discrete PR so regressions are bisectable.

The `dark:` variant is already wired (`darkMode: "class"` in tailwind.config + NativeWind's `useColorScheme` sets the class). No infrastructure change needed — the dark/light flip is already the v1 convention.

**F13 risk:** NONE. Token migration is purely presentational. No mutation defaults, query keys, or persister are touched.

---

## 2. Font Loading — Inter Display + JetBrains Mono

### Existing `_layout.tsx` ordering (load-bearing — do not reorder)

```
SplashScreen.preventAutoHideAsync()   ← module-scope, before render
  └─ PersistQueryClientProvider
       ├─ ThemeBootstrap               ← reads AsyncStorage fm:theme, calls setColorScheme
       ├─ SplashScreenController       ← hides splash when auth resolves
       └─ RootNavigator
```

`ThemeBootstrap` must run before any screen paints color. Font loading must also complete before screens render (to avoid FOUT). Both must complete before splash hides.

### Integration approach

Add a `FontBootstrap` component alongside `ThemeBootstrap`. Both are siblings inside `PersistQueryClientProvider`. `SplashScreenController` already gates the splash on `authStore.status !== 'loading'`. Add a second gate: splash stays until **both** auth resolves AND fonts are loaded.

```tsx
// app/app/_layout.tsx additions
import * as Font from 'expo-font';

// Module-scope gate — same pattern as SplashScreen.preventAutoHideAsync
let fontsLoaded = false;

function SplashScreenController() {
  const status = useAuthStore(s => s.status);
  const { fontsReady } = useFontStore();   // new tiny Zustand slice (2 fields)
  useEffect(() => {
    if (status !== 'loading' && fontsReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [status, fontsReady]);
  return null;
}

function FontBootstrap() {
  const setFontsReady = useFontStore(s => s.setFontsReady);
  useEffect(() => {
    Font.loadAsync({
      'InterDisplay':          require('../assets/fonts/InterDisplay-Regular.otf'),
      'InterDisplay-SemiBold': require('../assets/fonts/InterDisplay-SemiBold.otf'),
      'InterDisplay-Bold':     require('../assets/fonts/InterDisplay-Bold.otf'),
      'JetBrainsMono':         require('../assets/fonts/JetBrainsMono-Regular.ttf'),
    }).then(() => setFontsReady(true)).catch(() => setFontsReady(true)); // fail-open
  }, []);
  return null;
}
```

The tiny `useFontStore` (2 fields: `fontsReady: boolean`, `setFontsReady`) lives in `app/lib/font-store.ts`. It does NOT need persistence.

### Where fonts are applied

- **Display font (`InterDisplay-Bold`)** — applied via `font-display` Tailwind class (mapped to `fontFamily: ['InterDisplay', ...]` in tailwind.config) on large numerals and headings matching the design: session timers, plan titles, stat numbers.
- **Mono font (`JetBrainsMono`)** — applied via `font-mono` class on weight/reps numeric inputs, chart axis labels, set-number cells.
- **Body font** stays `System` (iOS SF Pro) — NativeWind default, unchanged from v1.

**F13 risk:** NONE. Font loading is additive; it only gates the splash, not mutations. The fail-open catch means a font-load failure still clears the gate.

---

## 3. Preference Storage Split

The Settings screen (design: `FSettings`) introduces new preferences. Decision per item:

| Preference | Storage | Justification |
|---|---|---|
| `theme` (system/light/dark) | **AsyncStorage** `fm:theme` | Already there; device-local UI pref, offline-first, no cross-device sync needed. |
| `preferred_unit` (kg/lbs) | **Supabase `profiles`** | Already there (`profiles.preferred_unit`). Needs to survive reinstall; affects display of historical data. |
| `display_name` | **Supabase `profiles`** | Already there. |
| `weekly_goal` (sessions/week, 1–7) | **Supabase `profiles`** (new column) | Drives the Progress Ring denominator on the home dashboard. Survives reinstall. Needs additive migration: `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weekly_goal smallint DEFAULT 4`. |
| `language` (sv/en) | **AsyncStorage** `fm:language` | UI pref, no server sensitivity. Same pattern as theme. Locale detection falls back to `expo-localization` on first launch. |
| `haptics` (on/off) | **AsyncStorage** `fm:haptics` | Device-local. Boolean toggle. |
| `notifications` (on/off) | **AsyncStorage** `fm:notifications` | Device-local. Controls expo-notifications permission request. |
| `rest_timer_default` (seconds, e.g. 90/120/180) | **AsyncStorage** `fm:rest_timer` | Device-local. Could be per-plan in future (V2.1). Keep local for v2.0. |

### Migration required for `profiles`

```sql
-- 0007_profiles_weekly_goal.sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weekly_goal smallint DEFAULT 4;

-- RLS: existing policies on profiles cover this column (SELECT/UPDATE policies
-- already use (select auth.uid()) predicate on id — no new policy needed).
-- type-gen: run npm run gen:types after applying.
```

### AsyncStorage key convention (extend existing `fm:` namespace)

```
fm:theme         (existing)
fm:language      (new — Phase 8)
fm:haptics       (new — Phase 8)
fm:notifications (new — Phase 8)
fm:rest_timer    (new — Phase 9, number in seconds)
```

**F13 risk:** NONE. Profile column is additive with DEFAULT. AsyncStorage prefs are cosmetic.

---

## 4. Dashboard Aggregates — New Read-Side RPCs

The home screen (`FHome`) needs: **sessions-this-week count** (vs `weekly_goal`), **streak**, **weekly volume + prior-week delta %**, **volume sparkline series**.

### RPC design — mirror 0006 pattern exactly

All three functions: `SECURITY INVOKER`, `STABLE`, `SET search_path = ''`, `language sql`, GRANT to `authenticated`, REVOKE from `public`. They inherit the caller's JWT so RLS on `workout_sessions` + `exercise_sets` (the `(select auth.uid())` predicates) scope results automatically.

#### `get_dashboard_stats(p_now timestamptz)`

Returns a single row: `sessions_this_week`, `streak_days`, `volume_this_week_kg`, `volume_last_week_kg`.

```sql
-- 0007 or 0008 (file to be determined by plan phase)
create or replace function public.get_dashboard_stats(
  p_now timestamptz default now()
)
returns table (
  sessions_this_week bigint,
  streak_days        int,
  volume_this_week_kg numeric,
  volume_last_week_kg  numeric
)
language sql security invoker stable set search_path = '' as $$
  with
  week_start as (
    select date_trunc('week', p_now) as ws
  ),
  this_week_sessions as (
    select id, started_at::date as day
    from public.workout_sessions
    where finished_at is not null
      and started_at >= (select ws from week_start)
      and started_at < (select ws from week_start) + interval '7 days'
  ),
  last_week_vol as (
    select coalesce(sum(es.weight_kg * es.reps), 0) as vol
    from public.exercise_sets es
    inner join public.workout_sessions s on s.id = es.session_id and s.finished_at is not null
    where es.set_type = 'working'
      and s.started_at >= (select ws from week_start) - interval '7 days'
      and s.started_at < (select ws from week_start)
  ),
  this_week_vol as (
    select coalesce(sum(es.weight_kg * es.reps), 0) as vol
    from public.exercise_sets es
    inner join public.workout_sessions s on s.id = es.session_id and s.finished_at is not null
    where es.set_type = 'working'
      and s.started_at >= (select ws from week_start)
  ),
  -- Streak: consecutive calendar days (backwards from today) that have
  -- at least one finished session. Definition: a "streak" resets to 0
  -- if the most recent session's day is not today or yesterday.
  -- We use ISO calendar days and a gaps-and-islands approach.
  session_days as (
    select distinct started_at::date as d
    from public.workout_sessions
    where finished_at is not null
    order by d desc
  ),
  streak_cte as (
    select d,
           row_number() over (order by d desc) as rn,
           d - (row_number() over (order by d desc) * interval '1 day')::date as grp
    from session_days
  ),
  streak_group as (
    select count(*)::int as streak
    from streak_cte
    where grp = (select grp from streak_cte where d = (select max(d) from session_days))
  )
  select
    (select count(*) from this_week_sessions)::bigint,
    coalesce((select streak from streak_group), 0),
    (select vol from this_week_vol),
    (select vol from last_week_vol)
$$;
```

**Streak definition:** A streak is the count of consecutive distinct calendar days (UTC, or client timezone passed via `p_now`) with at least one finished session, measured backwards from the most-recent session day. If the most recent session was more than 1 calendar day ago (relative to `p_now`), the streak is 0. This matches the Apple Fitness "current streak" semantics shown in the design.

#### `get_volume_sparkline(p_weeks int default 8)`

Returns `(week_start date, volume_kg numeric)` for the last N weeks. Used for the mini sparkline on the history screen.

```sql
create or replace function public.get_volume_sparkline(
  p_weeks int default 8,
  p_now   timestamptz default now()
)
returns table (week_start date, volume_kg numeric)
language sql security invoker stable set search_path = '' as $$
  select
    date_trunc('week', s.started_at)::date as week_start,
    coalesce(sum(es.weight_kg * es.reps), 0) as volume_kg
  from public.workout_sessions s
  inner join public.exercise_sets es
    on es.session_id = s.id and es.set_type = 'working'
  where s.finished_at is not null
    and s.started_at >= date_trunc('week', p_now) - (p_weeks - 1) * interval '1 week'
  group by date_trunc('week', s.started_at)::date
  order by week_start asc
$$;
```

### Client-side integration

Both RPCs get:
- A **TanStack Query `useQuery`** wrapper in `app/lib/queries/dashboard.ts`
- Query key in `app/lib/query/keys.ts`: `dashboardKeys.stats()`, `dashboardKeys.sparkline()`
- `staleTime: 1000 * 60 * 5` (5 min) — dashboard is not hot-path like last-value
- `networkMode: 'offlineFirst'` (inherits from QueryClient defaults)
- Persisted by the existing `asyncStoragePersister` — no code change needed; the persister persists everything in queryClient.

**F13 risk:** NONE. These are read-only RPCs. They do not touch mutation defaults, session scopes, or the persister.

---

## 5. PR / e1RM Detection

### Formula

Epley e1RM: `e1rm = weight_kg * (1 + reps / 30)`

This is the formula implied by `t.estimated1RM` display in the FChart design and referenced in the question.

### Where to compute

**Recommendation: client-side, computed over the local TanStack Query cache.**

Rationale:
- The workout screen already has `setsKeys.list(sessionId)` in cache (all sets for current session, including optimistic rows not yet synced).
- The `lastValueKeys` cache holds the per-exercise history needed for comparison.
- Computing offline means PR detection works even when the server has not yet seen the set (user is underground, F13 guarantee).
- A server RPC for PR detection would require a round-trip that could timeout offline, blocking the celebratory banner.

### Implementation

In `app/lib/utils/e1rm.ts`:
```ts
export function epleyE1RM(weightKg: number, reps: number): number {
  if (reps === 1) return weightKg; // 1RM is just the weight
  return weightKg * (1 + reps / 30);
}
```

In `app/lib/queries/sets.ts`, after `['set','add']` onMutate (optimistic append), compute e1RM for the just-logged set and compare against:
1. Max e1RM across all cached sets for that `exercise_id` in `setsKeys.list(sessionId)` (current session).
2. Max e1RM across historical top-sets from `get_exercise_top_sets` RPC cached under `exercisesKeys.topSets(exerciseId)`.

If the new e1RM exceeds both maxima, set a Zustand flag: `useWorkoutStore.getState().setPR(exerciseId, newE1rm)`.

The workout screen listens to `useWorkoutStore` and renders the `ForgeChip` PR banner (orange gradient + trophy icon, as in `FWorkout` design lines 389–413) if `prExerciseId === currentExerciseId`.

### Avoiding a server RPC for PR

Avoids a DB function for PR detection in v2.0. A future `get_exercise_personal_bests()` RPC can replace this in v2.1 once offline-first PR detection is validated. The client-side path is safer against F13.

**F13 risk:** NONE. PR detection is additive; it does not touch mutation flow. A missed PR banner (cache miss) is acceptable; a lost set is not.

---

## 6. Rest Timer Architecture

### Problem

A JS `setTimeout` for 90–180 seconds will not fire reliably when the app is backgrounded (iOS suspends the JS thread). The solution: **schedule an OS local notification at the rest-end timestamp**, then cancel it on early dismiss or next set start.

### Architecture

#### State — `useRestTimerStore` (Zustand, in `app/lib/rest-timer-store.ts`)

```ts
type RestTimerStore = {
  sessionId: string | null;      // which session this timer belongs to
  endsAt: number | null;         // Date.getTime() — Unix ms
  notificationId: string | null; // expo-notifications scheduled notification id
  active: boolean;
  start: (sessionId: string, durationSeconds: number) => Promise<void>;
  cancel: () => Promise<void>;
};
```

This store is NOT persisted to AsyncStorage. If the app is killed, the OS notification fires anyway (that is the whole point). On relaunch, if `endsAt` is in the past, the store initialises as inactive.

#### `start(sessionId, durationSeconds)`

```ts
start: async (sessionId, durationSeconds) => {
  // Cancel any existing timer first
  if (get().notificationId) {
    await Notifications.cancelScheduledNotificationAsync(get().notificationId!);
  }
  const endsAt = Date.now() + durationSeconds * 1000;
  // Schedule OS notification
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Vilotid slut',        // i18n key: 'restTimerDone'
      body: 'Dags för nästa set!',  // i18n key: 'restTimerBody'
      sound: true,
    },
    trigger: { date: new Date(endsAt) },
  });
  set({ sessionId, endsAt, notificationId, active: true });
},
```

#### UI countdown ring

The `FWorkout` screen renders a countdown ring (existing `ProgressRing` component). The ring computes `value = (endsAt - Date.now()) / (durationSeconds * 1000)` on each render. Use `useEffect` + `setInterval(100ms)` to force re-renders only while `active === true`. This runs in the foreground JS thread — its purpose is display only. The OS notification fires regardless of JS state.

#### Cancel on set "Done"

In `useAddSet`'s `onMutate` (already in `client.ts`), add a side-effect call:
```ts
useRestTimerStore.getState().start(vars.session_id, restTimerStore.defaultSeconds);
```
This schedules a new rest notification and resets the UI ring. On manual "skip rest": call `cancel()`.

#### Permission gate

Request notification permission in `FontBootstrap` (Phase 8 foundation) or lazily on first rest timer start. Follow existing `fm:notifications` AsyncStorage pref: if `false`, skip both the permission request and notification scheduling, but still run the in-app countdown ring.

**F13 risk:** LOW. The rest timer is a side-effect of `['set','add']` onMutate, which already runs. If notification scheduling fails (permissions denied), the timer silently degrades to in-app only. The `['set','add']` mutation itself is not affected.

**Critical:** `expo-notifications` requires a prebuild or bare workflow for push tokens, but **local scheduled notifications** work in Expo Go without config changes. This is safe for v2.0.

---

## 7. i18n Architecture

### Provider

`react-i18next` with `expo-localization` for locale detection. Add to `_layout.tsx` as a sibling component (like `ThemeBootstrap`) or as a module-scope side-effect in a new `app/lib/i18n.ts`.

### Setup

```ts
// app/lib/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import sv from '../locales/sv.json';
import en from '../locales/en.json';

i18n.use(initReactI18next).init({
  resources: { sv: { translation: sv }, en: { translation: en } },
  lng: Localization.getLocales()[0]?.languageCode ?? 'sv',
  fallbackLng: 'sv',
  interpolation: { escapeValue: false },
});

export default i18n;
```

Import `'@/lib/i18n'` for side-effects at the top of `_layout.tsx` (before any JSX).

### Locale files

`app/locales/sv.json` and `app/locales/en.json` — populated from the `I18N.sv` and `I18N.en` objects in `lib.jsx`. The `I18N` object is the **ready-made string map** and can be transcribed directly. Function-valued strings (`setsSavedBody`, `pbSub`, `noSetsBody`) become i18next interpolations: `"setsSavedBody": "{{n}} set sparade. Avsluta passet?"` etc.

### Language override

When user changes language in Settings:
```ts
i18n.changeLanguage(selectedLocale);
await AsyncStorage.setItem('fm:language', selectedLocale);
```
On app launch, `FontBootstrap` (or a new `LocaleBootstrap` sibling) reads `AsyncStorage.getItem('fm:language')` and calls `i18n.changeLanguage()` before `SplashScreenController` clears the splash gate. Add `localeReady: boolean` to the splash gate (same pattern as `fontsReady`).

### Number / date formatting

- **Weights:** pass `preferred_unit` from `profiles` query through a `formatWeight(kg: number, unit: 'kg' | 'lbs')` utility in `app/lib/utils/units.ts`. `1 lbs = 0.453592 kg`. Round to 0.5 lbs for display. Format with `Intl.NumberFormat` using the active locale.
- **Dates:** use `date-fns/locale` with `sv` or `enUS` locale objects. Pass `{ locale: dateFnsLocale }` to `format()`. The `fm:language` pref maps to the correct locale.

### Lifting hardcoded Swedish strings

All existing Swedish string literals in TSX files (`'Planer'`, `'Tränad senast'`, etc.) get replaced with `t('plans')`, `t('lastTrained')` etc. This is Phase 11 work (i18n sweep). Phases 8–10 can introduce new strings directly via `t()` and skip the Swedish literal path.

**F13 risk:** NONE. i18n is a display layer.

---

## 8. Build Order — Phase Decomposition

Starting from Phase 8. Dependencies are explicit; later phases cannot start until earlier phases are green.

### Phase 8 — Foundation: Tokens, Fonts, Preferences Schema

**Goal:** Design system infrastructure with zero visible user-facing change.

- `0007_profiles_weekly_goal.sql` migration + type-gen.
- `tailwind.config.js` extended with `forge.*` tokens and `fontFamily`.
- Font assets added to `app/assets/fonts/` (Inter Display: Regular, SemiBold, Bold; JetBrains Mono: Regular).
- `FontBootstrap` component + `useFontStore` + splash gate modification.
- `LocaleBootstrap` (reads `fm:language` from AsyncStorage, calls `i18n.changeLanguage()`).
- `app/lib/i18n.ts` init module.
- `app/locales/sv.json` + `app/locales/en.json` populated from `I18N` object.
- `app/lib/utils/e1rm.ts` (Epley formula, unit tests).
- `app/lib/utils/units.ts` (kg↔lbs conversion, `formatWeight`).
- `app/lib/rest-timer-store.ts` (Zustand, non-persistent).
- **Gate:** `npx expo start` opens with existing v1 UI intact. No visual regression.

### Phase 9 — Design System Components

**Goal:** Build `components/ui/forge/` library using `forge.*` tokens. Zero screen re-skins.

- `ForgeButton` — accent CTA, secondary, danger variants.
- `ForgeCard` — surface + border + radius-lg wrapper.
- `ForgeInput` — weight/reps/RPE input cell with label below value.
- `ForgeChip` — small pill with optional icon.
- `ForgeStat` — label + large number display.
- `ProgressRing` — SVG activity ring with gradient (from `lib.jsx`).
- `TabBar` — Forge-themed bottom tab bar.
- `SettingsSection` + `SettingsRow`.
- `RestTimerOverlay` — inline overlay (NOT a modal portal per CLAUDE.md convention) that appears above the set input row. Countdown ring + skip button.
- **Gate:** Storybook-style test screen renders all components in dark + light mode. No existing screens modified.

### Phase 10 — Dashboard RPCs + Aggregates

**Goal:** New server-side functions + client hooks. No UI yet.

- `0008_dashboard_rpcs.sql` (or next available number): `get_dashboard_stats()` + `get_volume_sparkline()` RPCs.
- `app/lib/query/keys.ts` extended: `dashboardKeys`.
- `app/lib/queries/dashboard.ts`: `useDashboardStats()`, `useVolumeSparkline()`.
- `app/scripts/verify-deploy.ts` extended to assert the new function names in `pg_proc`.
- **Gate:** `npm run test:rls` still green. `verify-deploy.ts` passes.

### Phase 11 — Home Screen Re-skin (Plans/Dashboard)

**Goal:** Replace `app/app/(app)/(tabs)/index.tsx` with Forge design. This is the highest-visibility screen.

- Integrate `ProgressRing` (sessions-this-week / weekly_goal ring from `useDashboardStats()`).
- Volume chip + streak chip from dashboard stats.
- Plan list cards using `ForgeCard`.
- `ongoing session` banner using `ForgeChip` (already in Phase 5 — re-skin only).
- Connect `useDashboardStats()` — show skeleton while loading.
- **F13 risk note:** The active session banner depends on `sessionsKeys.active()` — do NOT change the query key or optimistic-update logic. Re-skin the display component only.
- **Gate:** Start a session, go offline, log sets, come back online — all 15 mutation defaults replay correctly. The progress ring shows correct week count.

### Phase 12 — Workout Screen Re-skin + PR Banner + Rest Timer

**Goal:** The hot path. This is the highest-risk re-skin because it touches the active workout screen.

- Re-skin `app/app/(app)/workout/[sessionId].tsx` to Forge design language.
- Set rows → `ForgeInput` cells + check button.
- `ForgeChip` PR banner wired to `useWorkoutStore.prExerciseId`.
- `useWorkoutStore.setPR()` called from `useAddSet`'s `onMutate` after e1RM comparison.
- `RestTimerOverlay` wired: triggers on set "Done", cancelled on next set start or skip.
- **F13 risk:** HIGH attention required. Rules:
  - Do NOT change mutation key names (`['set','add']`, etc.).
  - Do NOT add any `await` or async work inside `onMutate` bodies (already in client.ts).
  - The `setPR()` side-effect call in `onMutate` must be synchronous (Zustand `getState()` call, not a hook).
  - The rest timer `start()` call is async (schedules notification) but must not block the optimistic update. Call it as a fire-and-forget: `void useRestTimerStore.getState().start(...)`.
- **Gate:** The exact F13 UAT from Phase 5: offline workout → kill app → relaunch → verify all sets replayed. Must pass unchanged.

### Phase 13 — History + Session Detail Re-skin

**Goal:** Re-skin `history.tsx`, `history/[sessionId].tsx`, `exercise/[exerciseId]/chart.tsx`.

- Volume overview card with `useVolumeSparkline()` sparkline.
- `Sparkline` component (SVG, from `lib.jsx` design) in `components/ui/forge/`.
- Session list rows using Forge date-column tile + `ForgeChip`.
- Session detail: 3-col stat grid, exercise breakdown with per-exercise e1RM.
- **F13 risk:** NONE. Read-only screens.

### Phase 14 — Settings Screen Re-skin + i18n + Rest Timer Settings

**Goal:** Complete Settings screen with all new preferences.

- Theme picker (3-segment control: System / Light / Dark).
- Language picker (Swedish / English) — `i18n.changeLanguage()` + `AsyncStorage.setItem('fm:language')`.
- Units picker (Metric / Imperial) — mutates `profiles.preferred_unit`.
- Rest timer default picker (60s / 90s / 120s / 180s / Off) → `AsyncStorage.setItem('fm:rest_timer', seconds)`.
- Haptics toggle → `AsyncStorage.setItem('fm:haptics', bool)`.
- Notifications toggle → `AsyncStorage.setItem('fm:notifications', bool)` + permission request.
- i18n sweep: replace all hardcoded Swedish string literals in existing screens with `t()` calls.
- **Gate:** Switch language to English → all visible strings flip. Switch theme to Light → all screens render light palette.

### Phase 15 — Auth Screens Re-skin + Sign-Up

**Goal:** Re-skin auth group to Forge design. Lowest risk (no data path).

- `sign-in.tsx` → Forge layout (brand mark, display heading, field + CTA).
- `sign-up.tsx` → new screen `app/app/(auth)/sign-up.tsx` with password-strength indicator.
- `plans/new.tsx` → Forge field + CTA.
- **Gate:** Sign out → sign in → session is restored. New account creation works.

---

## Integration Points Summary

| New component / file | Touches existing | F13 risk |
|---|---|---|
| `tailwind.config.js` token extension | No mutation code | None |
| `app/lib/font-store.ts` | `_layout.tsx` SplashScreenController gate | None |
| `app/lib/i18n.ts` + `app/locales/*.json` | Module-scope import in `_layout.tsx` | None |
| `app/lib/utils/e1rm.ts` | Pure utility | None |
| `app/lib/utils/units.ts` | Pure utility | None |
| `app/lib/rest-timer-store.ts` | Called as side-effect in `onMutate` (fire-and-forget) | Low |
| `0007_profiles_weekly_goal.sql` | Additive column, existing RLS covers it | None |
| `0008_dashboard_rpcs.sql` | New SECURITY INVOKER functions, read-only | None |
| `app/lib/queries/dashboard.ts` | New query hooks, no mutation defaults | None |
| `app/lib/query/client.ts` | **DO NOT MODIFY** in v2.0 | Critical gate |
| `app/lib/query/persister.ts` | **DO NOT MODIFY** | Critical gate |
| `components/ui/forge/*` | New files, no existing imports | None |
| Screen re-skins (Phase 11–15) | Display only — mutation keys untouched | Low if rules followed |

---

## Offline-First / F13 Guarantee — Explicit Risk Register

| Feature | Risk scenario | Mitigation |
|---|---|---|
| Rest timer `start()` in `onMutate` | Async notification scheduling blocks optimistic update | Call as fire-and-forget `void store.start(...)`. Notification failure is non-fatal. |
| PR detection in `onMutate` | Heavy cache scan blocks optimistic update | Epley is O(n) over cached set list (n < 100 in a session). Synchronous. |
| Dashboard RPCs | Network-only — no data if offline | `networkMode: 'offlineFirst'` + persisted cache. Dashboard shows stale data offline; that is acceptable for a read-only aggregate. |
| `weekly_goal` migration | Missing column if migration not applied | `ADD COLUMN IF NOT EXISTS` + DEFAULT=4 ensures backward compat if migration is partially applied. Client Zod schema uses `.optional().default(4)`. |
| Font loading failure | Splash never clears | `catch(() => setFontsReady(true))` — fail-open. |
| i18n module load failure | Crash before render | `i18n.init` is synchronous in module scope; fallback to `'sv'` hardcoded. |
| Rest timer Zustand store | Store reset on app kill | Intentional — the OS notification already fired. No state to restore. |

---

## Files to Create / Modify

### New files
- `app/locales/sv.json`
- `app/locales/en.json`
- `app/lib/i18n.ts`
- `app/lib/font-store.ts`
- `app/lib/rest-timer-store.ts`
- `app/lib/utils/e1rm.ts`
- `app/lib/utils/units.ts`
- `app/lib/queries/dashboard.ts`
- `app/supabase/migrations/0007_profiles_weekly_goal.sql`
- `app/supabase/migrations/0008_dashboard_rpcs.sql`
- `components/ui/forge/ForgeButton.tsx`
- `components/ui/forge/ForgeCard.tsx`
- `components/ui/forge/ForgeInput.tsx`
- `components/ui/forge/ForgeChip.tsx`
- `components/ui/forge/ForgeStat.tsx`
- `components/ui/forge/ProgressRing.tsx`
- `components/ui/forge/TabBar.tsx`
- `components/ui/forge/SettingsRow.tsx`
- `components/ui/forge/RestTimerOverlay.tsx`
- `components/ui/forge/Sparkline.tsx`
- `app/assets/fonts/` (font files)

### Modified files
- `app/tailwind.config.js` — token extension + fontFamily
- `app/app/_layout.tsx` — FontBootstrap + LocaleBootstrap + updated SplashScreenController gate
- `app/lib/query/keys.ts` — add `dashboardKeys`
- `app/lib/query/client.ts` — **only** to add fire-and-forget rest timer + PR side-effects in existing `['set','add']` onMutate (Phase 12 only; must not alter mutation flow)
- `app/types/database.ts` — regenerated by `npm run gen:types` after each migration
- `app/scripts/verify-deploy.ts` — extend to assert new functions in pg_proc
- `app/scripts/test-rls.ts` — extend for `profiles.weekly_goal` update path

### Do not modify
- `app/lib/query/persister.ts`
- `app/lib/query/network.ts`
- `app/lib/auth-store.ts`
- `app/lib/persistence-store.ts`
- All existing `setMutationDefaults` logic (add only, never change existing bodies)
