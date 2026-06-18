# Pitfalls Research

**Domain:** FitnessMaxxing v2.0 — Forge Redesign (Expo SDK 54 + Supabase, iOS Expo Go, offline-first)
**Researched:** 2026-06-09
**Confidence:** HIGH

---

## Priority Key

- **[F13-CRITICAL]** — can silently break offline set-logging or violate the ≤3s log-set budget
- **[HIGH]** — likely to cause a regression or day+ of debugging
- **[MEDIUM]** — real risk but recoverable in <2h

---

## Critical Pitfalls

### Pitfall 1: Tailwind v4 accidentally installed during NativeWind migration [F13-CRITICAL]

**What goes wrong:**
Running `npm install tailwindcss@latest` (or allowing a dependency upgrade to resolve to v4) silently breaks NativeWind 4.x. The transitive `react-native-css-interop@0.2.3` declares `tailwindcss: "~3"` as a hard peer dep. With Tailwind v4 installed, NativeWind's style compilation fails at Metro build time — the build either errors or silently produces no styles, leaving every screen unstyled. This is a **build-time** failure that could appear mid-migration when adding the Forge tokens.

**Why it happens:**
The Forge re-skin requires adding many new Tailwind tokens to `tailwind.config.js` (`theme.extend.colors.forge.*`, `borderRadius.*`, `fontFamily.*`). Developers instinctively `npm install tailwindcss` to ensure the latest config API is available, and npm resolves to v4. The CLAUDE.md pin is clear but easy to skip under time pressure.

**How to avoid:**
- Pin in `package.json`: `"tailwindcss": "^3.4.17"` — the `^` ceiling must not exceed `<4.0.0`.
- Add an `overrides` or `resolutions` block in `package.json` to prevent hoisting a v4 peer: `"overrides": { "tailwindcss": "^3.4.17" }`.
- Before Phase 2 (Forge tokens), run `npm ls tailwindcss` and assert the resolved version starts with `3.`.
- Add to CI gate: `node -e "const v=require('tailwindcss/package.json').version; if(!v.startsWith('3.')) process.exit(1)"`.

**Warning signs:**
- Metro bundler warning: `Module 'react-native-css-interop' could not resolve 'tailwindcss/plugin'`
- NativeWind classes compile but all values are `undefined` at runtime (no visible styles, no error)
- `npx tailwindcss --version` reports `4.x`

**Phase to address:** Phase 2 (Design System / Token migration) — first commit that modifies `tailwind.config.js`

---

### Pitfall 2: Half-migrated screens leave stock Tailwind classes alongside Forge tokens [HIGH]

**What goes wrong:**
During the 17-screen + 3-overlay re-skin, some screens are migrated to Forge tokens (`bg-forge-surface`, `text-forge-text`, `accent-forge-accent`) while others still use stock Tailwind classes (`bg-gray-900`, `text-white`, `text-blue-600`). The app looks inconsistent in light mode (blue-600 renders correctly in dark but has wrong contrast in light) and the two token systems diverge, making future theme changes require two passes.

**Why it happens:**
The re-skin is wave-based across many files. An interrupted session or a phase that ships partial progress leaves a mix. The workout hot-path screens (F5/F6) are particularly dangerous because they are often left "for last" to avoid touching F13 code.

**How to avoid:**
- Create a migration checklist: one row per file in `app/app/`, with columns `dark:` verified and `light:` verified.
- Run `grep -rn "blue-\|gray-9\|text-white\b\|bg-white\b" app/app/` after every phase commit and assert zero hits outside whitelisted files.
- Introduce Forge token aliases at the START of Phase 2 (in `tailwind.config.js`) so every file can be migrated immediately without waiting for the component library.
- Do a visual light/dark toggle review on every screen before marking a phase complete.

**Warning signs:**
- Light mode screenshots show blue or gray where orange is expected
- `grep` audit finds `text-blue-600` or `bg-gray-800` in recently modified files
- `dark:` prefix appears without a corresponding non-`dark:` base class (no light-mode value)

**Phase to address:** Phase 3 (Screen Re-skin) — enforce via per-screen checklist before phase sign-off

---

### Pitfall 3: Font FOUC — text invisible or unstyled until `expo-font` resolves [HIGH]

**What goes wrong:**
Inter Display, Inter, and JetBrains Mono are loaded via `expo-font` (`useFonts` or `Font.loadAsync`). If the font-loading promise does not block the first meaningful paint, the device falls back to system font for 200–800ms, causing a flash of unstyled text (FOUC). Worse: on some iOS versions, text that references an unloaded custom font renders as **invisible** (zero-width or zero-alpha), not as fallback. Display headings at 36–52px become blank until fonts resolve.

**Why it happens:**
The v1 codebase already holds the splash using `SplashScreen.preventAutoHideAsync()` gated on auth status (`SplashScreenController`). Font loading is a **separate** async operation that is not currently gated into the splash-hold. If `Font.loadAsync` is added inside a component-level `useEffect`, fonts may resolve *after* the splash hides, producing the FOUC window.

**How to avoid:**
- Gate `SplashScreen.hideAsync()` on BOTH auth status AND font load: add a `fontsLoaded` boolean to the splash controller and only call `hideAsync()` when `status !== 'loading' && fontsLoaded`.
- Use `useFonts` from `expo-font` in `_layout.tsx` (root layout), and pass its return value down to `SplashScreenController`. Alternatively, call `Font.loadAsync()` before `SplashScreen.preventAutoHideAsync()` resolves.
- For Inter Display: the free variable font (`Inter_Display`) may not ship all weights (100–900). Explicitly load the weight files needed (400, 500, 600, 700) and set the NativeWind `fontFamily` config to use the loaded asset name, not the CSS font-family string.
- Font key in `useFonts` MUST exactly match the string used in `fontFamily` style (NativeWind config or inline style). A mismatch (`"Inter-Display"` vs `"InterDisplay"`) silently falls back to system font.
- For `fontFeatureSettings: '"tnum", "ss01"'` (tabular-nums for stat digits): these OpenType features work on iOS with system fonts but may silently no-op with a variable font that doesn't embed the feature. Verify by rendering `"1,111"` vs `"1,111"` in the actual target font and checking kerning — don't rely on CSS preview alone.

**Warning signs:**
- Blank headings for 200–800ms after splash hides
- `console.warn: fontFamily "Inter Display" is not a system font` in Metro logs
- Stat digits that are not monospaced (column misalignment) despite `numStyle`

**Phase to address:** Phase 2 (Design System) — font loading must be wired before any screen uses the new fonts

---

### Pitfall 4: expo-notifications JS-Suspension Trap — setTimeout-based rest timer silenced by iOS [F13-CRITICAL]

**What goes wrong:**
A rest timer built with `setInterval` / `setTimeout` will **stop firing** when the app is backgrounded or the screen is locked on iOS. The timer appears to count down correctly in the foreground, but if the user presses the home button mid-rest, the countdown freezes. The notification never fires. This is not a bug — it is documented iOS behavior: JavaScript execution is suspended for background apps.

Additionally, the tap of the "Klart" button (which logs a set and should start the rest timer) is on the F13 write path. Adding any synchronous timer setup that blocks the write path violates the ≤3s budget.

**Why it happens:**
Developers implement the countdown as a React state + `setInterval` because it works perfectly in testing (foreground only). The JS-suspension behavior only manifests when the phone is actually pocketed between sets, which is the exact real-world usage pattern.

**How to avoid:**
- At the moment the rest timer starts (after "Klart" tap), record `restEndTimestamp = Date.now() + durationMs` in Zustand state.
- Immediately schedule an **OS-level local notification** via `expo-notifications` at `restEndTimestamp`: `scheduleNotificationAsync({ content: { title: 'Vilan klar', body: '...' }, trigger: { date: restEndTimestamp } })`. This survives background.
- The in-app countdown UI reads from `restEndTimestamp - Date.now()` on each render tick (using `setInterval` in foreground only for display purposes). On app foreground, reconcile remaining time from `restEndTimestamp`, cancel the display interval if expired.
- On "dismiss early" (user taps the timer before it expires): call `cancelScheduledNotificationAsync(notificationId)` immediately. Store `notificationId` returned by `scheduleNotificationAsync` in Zustand alongside `restEndTimestamp`.
- **CRITICAL**: the `scheduleNotificationAsync` call must be **fire-and-forget** (non-blocking) on the "Klart" tap path. Use `.catch(console.warn)` and do NOT await it in the set-log mutation. The F13 write completes first; the notification is a best-effort side-effect.
- Request notification permissions during onboarding / first-timer-use, not on the "Klart" tap (iOS will reject a permission request triggered synchronously in a gesture handler).
- **Expo Go limitation**: in Expo Go (SDK 54), `scheduleNotificationAsync` with a `date` trigger for local notifications works for *local* notifications. Remote push notifications require a physical device with proper credentials. For F19, only local notifications are needed — this is fine.

**Warning signs:**
- Rest timer shows "Vilan klar" only when the app is foregrounded after a rest — but no notification appeared while backgrounded
- `Notification permission not granted` warning in logs at timer start (too late — should be in onboarding)
- "Klart" button feels slow (>3s to log) — timer setup blocking the write path

**Phase to address:** Phase 6 (Rest Timer / F19) — own the entire implementation. Threat register must include T-F19-01 (JS suspension) and T-F19-02 (notification permission denial UX).

---

### Pitfall 5: react-i18next initialization before first render — cold-start flash of key strings [HIGH]

**What goes wrong:**
If `i18n.init()` is not awaited before the React component tree mounts, components that render on the first frame will show raw i18n keys (`"t.myPlans"`, `"myPlans"`) instead of translated text. This is especially visible on the Home screen (big Display-size heading) and the Workout screen. Even a 1-frame flash is user-visible at 120Hz.

Additionally, the `I18N` object in `lib.jsx` contains **function values** (e.g. `pbSub: (kg, reps) => \`${kg} kg × ${reps} reps\``). These cannot be directly represented in i18next resource JSONs — they must be converted to i18next **interpolation syntax**: `"pbSub": "{{kg}} kg × {{reps}} reps"` and called as `t('pbSub', { kg, reps })`.

**Why it happens:**
`react-i18next` is async by default (`initReactI18next` + `i18n.init()` returns a Promise). Developers import and use `useTranslation()` in components before `init()` resolves, triggering the raw-key flash. The function-value pattern from the design prototype is not directly portable to JSON resources.

**How to avoid:**
- Call `i18n.init({ ... })` in a dedicated `lib/i18n.ts` file and import it with a side-effect import (`import '@/lib/i18n'`) at the very top of `_layout.tsx` — before any component renders.
- Use the `initImmediate: false` option so `i18n.init` completes synchronously with bundled (non-lazy) resources. For two languages (sv + en), the resources are small enough to bundle eagerly — do NOT lazy-load.
- Gate `SplashScreen.hideAsync()` on `i18n.isInitialized` in `SplashScreenController` (add a third condition alongside auth status and font load from Pitfall 3).
- Convert all function-value strings to interpolation: `pbSub: (kg, reps) => \`${kg} kg × ${reps} reps\`` becomes `"pbSub": "{{kg}} kg × {{reps}} reps"`. Add a TypeScript type augmentation so `t('pbSub', { kg, reps })` is typed.
- Persist language choice to AsyncStorage under `'fm:language'` and restore it in `i18n.ts` before `init()` runs (same pattern as `ThemeBootstrap` for theme persistence).
- Swedish plural rules: `i18next` supports `_one` / `_other` suffixes. `"1 dag"` vs `"12 dagar"` requires `t('day', { count: n })` with resources `{ day_one: 'dag', day_other: 'dagar' }`.
- Language switch re-render: `i18next` triggers React re-render on language change via the `react-i18next` integration. For the Workout screen (F13 hot path), ensure no re-render occurs mid-set-log. Language switch should only be available in Settings, not reachable during an active workout.

**Warning signs:**
- Raw keys appear on first render (`"personalBest"`, `"myPlans"`)
- App crashes with `TypeError: t is not a function` (i18n not initialized before first render)
- `pbSub` renders as `"[object Object]"` (function not converted to interpolation)

**Phase to address:** Phase 5 (i18n) — `lib/i18n.ts` must be wired before any screen uses translations. Phase 3 (Screen Re-skin) must not introduce `t()` calls before Phase 5 sets up the provider.

---

### Pitfall 6: kg/lbs double-conversion — storing display values instead of canonical kg [F13-CRITICAL]

**What goes wrong:**
The `exercise_sets` table stores `weight_kg NUMERIC` — the canonical unit is always kg. If a user switches from kg to lbs mid-soak, any conversion that happens at the **write path** instead of the **display path** will store a lbs value in a kg column. Subsequent reads will display it as double-converted (e.g. 225 lbs stored → read and converted again → displayed as ~496 lbs).

The F6 "last value" chip (F7 `useLastValueQuery`) and the e1RM chart both read raw `weight_kg` values. If some rows were written in lbs and others in kg, the chart and PR detection produce garbage.

**Why it happens:**
The weight input field shows whatever the user typed. If the `ForgeInput` component accepts `value` as a raw string and the form's `onSubmit` handler uses that string directly (without converting to kg before persisting), the wrong unit is stored. This is especially subtle because the UI *looks* correct in the user's preferred unit even when the stored value is wrong.

**How to avoid:**
- **One rule: convert at display and input boundaries only.** The Zod schema for `setFormSchema` must accept the user-facing value and transform it to kg before the mutation fires:
  ```ts
  // pseudocode
  weight_kg: z.number().transform(v => unit === 'lbs' ? v / 2.20462 : v)
  ```
- The `useLastValueQuery` result must apply the reverse transform at read time: `displayWeight = unit === 'lbs' ? weight_kg * 2.20462 : weight_kg`.
- The e1RM / Epley formula always operates on kg internally; display the result in the user's unit.
- Rounding: `Math.round(lbs * 10) / 10` (1 decimal) at display. Never round before storing.
- Swedish decimal comma: the v1 `setFormSchema` already preprocesses `','` → `'.'`. This must survive the v2 re-skin — do NOT rewrite the form schema from scratch.
- The `profiles.preferred_unit` column (new in v2 additive migration) must be read from a Zustand store (or TanStack Query cache) that is populated before the workout screen renders. A cold-start where `preferred_unit` is null must default to `'kg'` — never to `undefined`.
- Charts (`get_exercise_chart` RPC): the RPC currently returns `weight_kg`. The chart display layer must convert before rendering Y-axis labels. The RPC itself must NOT be changed to return lbs — that would break the canonical-store invariant.

**Warning signs:**
- Set logged as `225` (lbs) appears as `496` after unit toggle
- Chart Y-axis shows values ~2.2x expected after switching to lbs
- PR detection fires on a set that is clearly not a PR (stale lbs value compared against fresh kg value)

**Phase to address:** Phase 4 (Settings / Preferences) — `preferred_unit` migration + Zustand store. Phase 3 (Screen Re-skin) must pass unit context into `ForgeInput` before the workout screen goes live.

---

### Pitfall 7: Dashboard RPC timezone bugs — streak and "this week" off by 1+ days [HIGH]

**What goes wrong:**
Streak and weekly session count are computed server-side (new read-side RPCs). Postgres `NOW()` returns UTC. If the user is in CEST (UTC+2) and trains at 23:30 local time, Postgres sees it as 21:30 UTC (previous UTC day). A streak-boundary query using `DATE_TRUNC('day', ended_at)` groups by UTC day, so the session appears on the wrong day from the user's perspective. A 7-day streak can break one day early.

An empty state (new user, zero `workout_sessions`) must not cause the RPC to error or return `null` where the UI expects a number — a null streak displayed in a `<Text>` crashes on iOS because `Text` requires a string child.

**Why it happens:**
SQL date functions default to UTC unless the session timezone is set. The developer tests during the day (UTC+offset mid-session) and never hits the boundary condition. New-user empty state is only hit on account creation, not during active development.

**How to avoid:**
- All streak/weekly RPCs must accept a `tz TEXT` parameter (e.g. `'Europe/Stockholm'`) and use `AT TIME ZONE tz` in date comparisons: `DATE_TRUNC('day', ended_at AT TIME ZONE tz)`.
- Obtain the user's timezone on the client via `Intl.DateTimeFormat().resolvedOptions().timeZone` and pass it as an RPC parameter. Do not store timezone server-side (it changes when traveling).
- Alternatively, pass UTC offset as `utc_offset_minutes INT` and use `ended_at + (utc_offset_minutes * INTERVAL '1 minute')`.
- Empty state: RPCs must return a row with zeroed values (e.g. `{ sessions_this_week: 0, streak: 0, weekly_volume_kg: 0, delta_pct: null }`) when no sessions exist. Use `COALESCE(COUNT(*), 0)` etc. Never return `NULL` from a field the UI renders as a number.
- UI: treat `delta_pct: null` as a missing/hidden delta badge, not as `"null%"`.
- RLS: aggregate RPCs must filter `WHERE user_id = auth.uid()` (or equivalent). Verify in `test-rls.ts` that cross-user RPC calls return zero rows, not another user's data.

**Warning signs:**
- Streak shows 0 the morning after a late-night training session
- "This week" count includes sessions from last week on Monday mornings
- `TypeError: null is not an object` crash on History screen for new user

**Phase to address:** Phase 7 (Home Dashboard) — RPC authoring. Include empty-state test in `test-rls.ts` as a new-user case.

---

### Pitfall 8: PR / e1RM detection depends on a server RPC at workout finish — breaks offline [F13-CRITICAL]

**What goes wrong:**
The PR celebration (F18) detects a new personal best (Epley e1RM, max weight, max volume per exercise). The naive implementation fires a Supabase RPC at the "Klart" button tap to query historical maximums, then compares the new set. If the device is offline (F13 scenario), the RPC fails, the PR banner never shows, and — worse — the PR detection may re-fire incorrectly when the offline queue syncs (showing a PR banner on a set that was actually logged 45 minutes ago).

Additionally, if the offline queue has unsynced sets from the current session that haven't yet reached Supabase, the RPC's historical data won't include them, producing false PR comparisons.

**Why it happens:**
RPCs are the idiomatic way to query historical aggregates in this stack. The developer implements a `get_exercise_pr` RPC and calls it reactively on each set log. It works in testing (always online) and the edge case only appears in gym basements.

**How to avoid:**
- PR detection must run **entirely on the local TanStack Query cache**, not via RPC. The required data (`exercise_sets` for the relevant exercise) is already in the persisted cache from `useLastValueQuery` and the chart RPCs.
- Specifically: after a set is logged (in the `onMutate` / `onSuccess` of `useAddSet`), compute e1RM with `Epley(weight_kg, reps) = weight_kg * (1 + reps / 30)` on the local set rows. Compare against the cached maximum e1RM for that exercise.
- The cached max e1RM is the "previous PR" — it lives in the same TanStack Query cache that the chart screen already populates. Pre-fetch the exercise's top-set data when the workout screen mounts (same pattern as `useLastValueQuery`).
- Recompute on sync: when offline sets sync to Supabase, invalidate the exercise chart query so the PR baseline refreshes for future workouts. The in-session PR banner is based on session-local state and does not need to be revised post-sync.
- False PR from unsynced/duplicate sets: the `useAddSet` mutation uses optimistic updates + the FIFO scope contract. The local cache always reflects the true session state (including pending mutations). PR detection reading from this cache is safe.

**Warning signs:**
- PR banner never appears during airplane-mode test sessions
- PR banner appears on a set that was clearly not the user's best (stale server-side data)
- `npm run test:f13-brutal` fails after adding PR detection (race condition in write path)

**Phase to address:** Phase 8 (PR Celebration / F18) — architecture decision must be logged in CONTEXT.md: "PR detection is local-cache-only, never RPC-at-log-time."

---

### Pitfall 9: Reanimated 4 animations on the F13 write path block the JS thread [F13-CRITICAL]

**What goes wrong:**
The Forge design includes set-logged animations (checkmark bounce, progress bar fill, PR sweep). If any `Animated.*` or `useAnimatedStyle` worklet runs synchronously on the "Klart" button tap — or if a `withSpring` / `withTiming` is triggered before the set mutation resolves — it adds latency to the ≤3s log-set budget. On low-end devices (older iPhone SE), a complex chained animation sequence can add 150–400ms of JS-thread contention.

**Why it happens:**
Reanimated 4 worklets run on the UI thread, not the JS thread, so they should be fast. However, the trigger code (e.g. `playAnimation()`) still runs on the JS thread before the worklet is scheduled. If the animation trigger is `await`-ed, or if a state update that drives animation is nested inside the mutation callback, it can delay the mutation itself.

**How to avoid:**
- The `useAddSet` mutation (F13 write path) must complete before any animation is triggered. Never `await` an animation before calling `mutate({ weight_kg, reps, rpe })`.
- Pattern: fire animation as a side-effect in the mutation's `onMutate` callback (which runs synchronously before the mutation is even enqueued). The animation start is thus decoupled from the mutation result.
- For the PR sweep animation (F18): trigger it in `onSuccess` of `useAddSet`, not in the tap handler. If the device is offline, `onSuccess` fires immediately (optimistic update) so the animation still plays.
- Keep animation complexity on the workout screen proportional to its importance: a simple `opacity` + `scale` spring on the set row is sufficient. Reserve complex `LinearGradient` sweeps for the post-workout PR celebration overlay, which is not on the ≤3s path.
- Test gate: `npm run test:f13-brutal` must stay green after every animation addition. If the brutal test starts failing, suspect animation overhead first.

**Warning signs:**
- "Klart" button press takes >1s to show feedback (set row appears sluggish)
- `test:f13-brutal` timing test fails with intermittent >3s violations
- Profiler shows JS thread blocked during tap handler

**Phase to address:** Phase 9 (Motion & Haptics) — animation design must reference the ≤3s budget constraint. Phase 8 (PR) must not add animation to the tap-to-log path.

---

### Pitfall 10: Re-skin touching the inline-overlay pattern breaks F13 and gestures [F13-CRITICAL]

**What goes wrong:**
The v1 codebase uses an **inline-overlay** pattern (not modal portals) for the Avsluta-overlay, draft-resume overlay, and saved-toast. The design decision is recorded in `PROJECT.md` Key Decisions: "portal modals break `freezeOnBlur` + gestures." If the v2 re-skin migrates these overlays to `<Modal>` components (a natural choice when copy-pasting a design pattern), two regressions occur:
1. `freezeOnBlur` on the workout screen's `PersistQueryClientProvider` child stops working — the offline queue can drain during an "in-flight" finish dialog, potentially causing set loss (F13 violation).
2. `GestureHandlerRootView` descendants in a `<Modal>` portal do not inherit the root gesture context on older React Native versions, breaking swipe-to-delete sets.

**Why it happens:**
The Forge design in `forge-screens.jsx` shows overlays as visually floating layers. New developers (or LLM agents) translate "floating layer" to `<Modal>` without reading the architectural constraint. The `<Modal>` works fine in isolation during Phase 3 testing but only fails under the specific conditions (offline + finish tap) that the brutal test exercises.

**How to avoid:**
- ALL three overlays (Avsluta, draft-resume, saved-toast) MUST remain as **conditionally-rendered `<View>` children** of the workout screen's `<ScrollView>` or root `<View>`, styled with `position: 'absolute'`, `zIndex`, and `StyleSheet.absoluteFill` as needed. They must NOT be refactored to `<Modal>`.
- Add a comment at the top of the re-skinned overlay file: `// INVARIANT: inline-overlay — do NOT refactor to <Modal> — see PROJECT.md Key Decisions §inline-overlay`.
- `npm run test:f13-brutal` catches the data-loss scenario. Run it after every overlay re-skin commit.
- The visual design goal (full-screen dimmed backdrop) is achievable with an absolutely-positioned semi-opaque `<View>` without a `<Modal>`.

**Warning signs:**
- `test:f13-brutal` fails with "session lost" or "set count mismatch" after overlay re-skin
- Swipe-to-delete sets stops working when the overlay is visible
- `freezeOnBlur` warning in Metro output after `<Modal>` import appears

**Phase to address:** Phase 3 (Screen Re-skin) — add invariant comment on every overlay component. Code review must reject any `import { Modal }` added to the workout screen.

---

### Pitfall 11: Expo-font key / NativeWind fontFamily name mismatch — silent system font fallback [HIGH]

**What goes wrong:**
`useFonts` registers fonts under string keys (e.g. `{ 'Inter-Display-Bold': require('./assets/fonts/InterDisplay-Bold.ttf') }`). NativeWind's `tailwind.config.js` `theme.extend.fontFamily.display` must reference the **exact same string**. A mismatch — even a dash-vs-space difference — silently falls back to the system font. The heading that should be Inter Display at 700 weight renders in SF Pro, which looks similar enough at a glance to be missed in review but violates the Forge design fidelity.

**Why it happens:**
The font file name, the `useFonts` key, and the Tailwind config are three separate places that must all agree. NativeWind generates a `fontFamily` style prop; React Native passes it to the iOS text renderer; iOS looks up the font by the exact registered name.

**How to avoid:**
- Create a single source of truth: `lib/fonts.ts` exports `FONT_MAP` (`Record<string, ReturnType<typeof require>>`), and `tailwind.config.js` imports the keys from that same file.
- After loading fonts, add a smoke-test: render one character in each custom font in a hidden off-screen view and `console.log` the actual fontFamily resolved by the text engine. In React Native, an unrecognized fontFamily will warn in Metro logs.
- For Inter Display: the font may ship as separate weight files (InterDisplay-Regular.ttf, InterDisplay-Bold.ttf, etc.) or as a variable font. If using separate files, register each weight under a unique key and reference them by weight in Tailwind (`font-display-bold` → `fontFamily: 'Inter-Display-Bold'`).

**Warning signs:**
- `Warning: Unrecognized font family 'Inter Display'` in Metro/RN logs
- Visual comparison of heading text shows SF Pro metrics (wider letterspacing) instead of Inter Display
- `fontFeatureSettings` for tabular-nums has no effect (feature settings are ignored on system fonts via the shorthand)

**Phase to address:** Phase 2 (Design System) — font loading and Tailwind config wired together from the start

---

### Pitfall 12: Notification permission requested at wrong time — iOS permission denied permanently [HIGH]

**What goes wrong:**
On iOS, the system notification permission prompt can only be shown once (unless the user manually re-enables in Settings). If `requestPermissionsAsync()` is called at the wrong moment — e.g. triggered by the "Klart" button tap on the first set ever logged — the user may dismiss it accidentally or deny it while focused on logging. Because it can only be triggered once, the rest timer feature is permanently silenced for that user without them realizing it.

**Why it happens:**
The rest timer starts on "Klart" tap. The developer triggers `requestPermissionsAsync()` reactively when the timer first needs to schedule a notification. This is logically sound but UX-catastrophic on iOS.

**How to avoid:**
- Request notification permission in the **onboarding flow** (Settings screen, when the user first enables the rest timer toggle) with an explanation: "Aktivera notiser för att få en påminnelse när vilan är klar."
- Check `getPermissionsAsync()` status before showing the toggle — if already denied, show a "Öppna Inställningar" deeplink instead of the toggle.
- If permission is denied, the rest timer still works in-foreground (countdown UI works via `setInterval`). Only the background notification is lost. Communicate this gracefully: "Timer fungerar när appen är öppen. Aktivera notiser i Inställningar för påminnelse i bakgrunden."
- Never call `requestPermissionsAsync()` inside a mutation callback or tap handler on the workout screen.

**Warning signs:**
- Users report "rest timer notification never appears"
- `expo-notifications` permission status is `denied` on first inspection
- The permission prompt appeared during an active set-logging flow

**Phase to address:** Phase 6 (Rest Timer) — Settings screen must own the permission request flow before the timer feature is wired to the workout screen

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode `'kg'` as unit in `ForgeInput` during Phase 3 re-skin | Unblocks re-skin before Settings/unit pref is built | Double-conversion bug when unit pref is wired in Phase 4 | Acceptable ONLY if a `// TODO: wire unit pref` comment is added and Phase 4 has a verification step to remove all hardcoded `'kg'` |
| Use `i18n.t('key')` with static sv strings before i18n is set up | Unblocks re-skin with real Swedish text | When i18n is added in Phase 5, the static strings must be hunted down and replaced | Never — add i18n placeholder keys from the start even if only sv is shipped first |
| Trigger `scheduleNotificationAsync` in a `useEffect` on timer-state change | Simpler code | Multiple effects can schedule duplicate notifications; requires deduplication by notification ID | Never — schedule exactly once in the mutation/action that starts the timer |
| Skip `test:f13-brutal` during overlay re-skin "because we didn't touch the write path" | Saves 60s per commit | Regressions in overlay positioning or `freezeOnBlur` will not be caught until UAT | Never — run it after every commit that touches the workout screen |
| Use `Math.round(weight_kg * 2.20462)` (integer lbs) | Simpler display | 0.5–1 lb rounding error compounds across conversions; top-set display looks off | Acceptable for display only; use 1 decimal (`Math.round(... * 10) / 10`) |
| Inline hex colors in JSX during re-skin sprint | Fast to type | Bypasses Forge token system; dark-mode parity broken; token changes require two-pass grep | Never — always use Tailwind token classes or the `tk.*` token object |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `expo-notifications` + Expo Go | Assuming remote push works in Expo Go | Local notifications (scheduled with `scheduleNotificationAsync`) work in Expo Go. Remote push requires a dev build or standalone build. F19 only needs local — this is fine for v2.0 Expo Go scope. |
| Supabase RPC + RLS | Writing an aggregate RPC without a `WHERE user_id = auth.uid()` clause, relying on the table's RLS to filter | PostgREST RPCs with `SECURITY DEFINER` bypass RLS unless you explicitly add the user filter in the function body. Use `SECURITY INVOKER` (the default) so RLS applies, or add `WHERE user_id = (select auth.uid())` explicitly. |
| `react-i18next` + Expo Router | Calling `useTranslation()` in a route component before `i18n.init()` completes | Import `'@/lib/i18n'` as the very first side-effect in `_layout.tsx` with `initImmediate: false`. All route components can then safely call `useTranslation()` synchronously. |
| `TanStack Query` + PR detection | Calling `invalidateQueries` inside `useAddSet.onSuccess` triggering a refetch that races with the offline queue flush | Invalidate exercise chart queries in the *background* (use `{ refetchType: 'none' }`) during an active session so the cache updates lazily after the session ends, not mid-set. |
| `expo-font` + NativeWind | Using the CSS `font-family` string (e.g. `'Inter Display'`) in Tailwind config instead of the `useFonts` key (e.g. `'InterDisplay'`) | Register and reference fonts by the exact key string used in `useFonts`. Use `lib/fonts.ts` as the single source of truth for both the `useFonts` map and the Tailwind `fontFamily` config. |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| PR detection via RPC on each "Klart" tap | "Klart" button feels slow; brutal test fails | Compute PR from local TanStack cache, not RPC | Every set logged when offline OR with >100ms network latency |
| Animation trigger `await`-ed before set mutation | Set log takes >3s; mutation appears paused | Fire-and-forget animations; trigger in `onMutate` | Low-end devices (iPhone SE 2nd gen) with heavy Reanimated worklets |
| i18n re-render on language switch during active workout | Workout screen re-renders mid-set | Language switch only accessible in Settings; not possible during active session | Any time user navigates to Settings mid-workout (split-screen unlikely but possible on iPad) |
| `scheduleNotificationAsync` called synchronously in tap handler | "Klart" tap feels sluggish by 50–200ms | Non-blocking `.catch(console.warn)` call, not `await` | Devices with slow iOS notification subsystem (common on battery-saver mode) |
| Font loading blocking splash for 2+ seconds | Splash stays visible for >2s on first launch | Preload only needed weights; use `initImmediate: false` for i18n; parallelise with auth check | Slow device + large font files + no preload strategy |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing `preferred_unit` in Zustand without persisting to Supabase | Unit preference lost on app reinstall or new device | Mirror unit pref to `profiles.preferred_unit` via an upsert mutation; Zustand is the fast local cache, Supabase is the source of truth |
| Dashboard RPC without `user_id` scoping exposes aggregate data cross-user | One user sees another's streak/volume (privacy violation; OWASP API1) | All dashboard RPCs must filter by `(select auth.uid())` and be covered in `test-rls.ts` cross-user assertions |
| Notification content includes sensitive workout details (exercise names, weights) | Notification appears on locked screen; bystanders see training data | Default notification content: "Vilan klar — dags att köra nästa set." No weights/exercises in notification body. |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| PR banner appears on EVERY set logged (even non-PRs) due to wrong comparison logic | Alert fatigue; user ignores future real PRs | Show PR banner only when `new_e1rm > historical_max_e1rm * 1.001` (1% threshold to avoid floating-point noise). Show trophy icon on individual set rows always, full-screen sweep only on genuine session PR. |
| Rest timer notification fires during an active set (timer was from previous set, not cancelled) | Confusing notification mid-set | Cancel the scheduled notification immediately when the next "Klart" tap starts a new timer. Always cancel before scheduling. |
| Light-mode Forge screens look washed out because `bg-forge-bg` (#FAFAF7) is too close to `bg-forge-surface` (#FFFFFF) | Cards don't stand out; hierarchy lost | Increase surface card border to `borderStrong` in light mode; add `shadow-sm` on plan/session cards in light mode. Test on a physical device in outdoor lighting. |
| Volume displayed in kg when user switched to lbs | User distrust of data correctness | All volume stats (weekly volume, session volume, chart Y-axis) must respect `preferred_unit`. Audit every number displayed in the History and Dashboard screens. |
| i18n date strings not localized (still `"14 maj 2026"` in English mode) | Inconsistent language experience | Use `date-fns/locale` with `sv` or `enUS` locale passed to `format()`. Bind locale to the current i18n language, not the device locale. |

---

## "Looks Done But Isn't" Checklist

- [ ] **Forge token migration:** Every file in `app/app/` has been audited with `grep -n "blue-\|gray-9\|text-white\b"` — zero hits remaining
- [ ] **Light mode parity:** Every screen has been visually reviewed in *light mode on device* — not just dark mode
- [ ] **Font loading:** `SplashScreenController` gates on `fontsLoaded && i18nReady && authResolved` — not just auth
- [ ] **Unit conversion:** `grep -rn "weight_kg" app/app/` — every display site applies `unitConvert()`, every write site applies `unitConvertBack()`
- [ ] **Notification permission:** `requestPermissionsAsync()` is called exclusively from the Settings screen — `grep -rn "requestPermissionsAsync" app/` must show only `settings.tsx` or a dedicated permission hook
- [ ] **Rest timer notification cancel:** Every code path that can start a new timer first cancels any existing scheduled notification — `cancelScheduledNotificationAsync` is called before `scheduleNotificationAsync`
- [ ] **Inline overlays:** `grep -rn "import.*Modal" app/app/(app)/workout/` returns zero hits
- [ ] **i18n function values:** `grep -rn "pbSub\|setsSavedBody\|noSetsBody" app/app/` — all call sites use `t('pbSub', { kg, reps })` interpolation syntax, not direct function calls
- [ ] **PR detection offline:** `test:f13-brutal` passes with PR detection code live (run in airplane mode)
- [ ] **Dashboard empty state:** A fresh account (zero workout_sessions) visits Home/History — no crash, correct zero-state UI
- [ ] **Streak timezone:** tested by simulating a session at 23:00 local time with user in UTC+2 — streak does not increment on the wrong day
- [ ] **Tailwind version:** `npm ls tailwindcss` shows a `3.x` version — no `4.x` anywhere in the dependency tree

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Tailwind v4 installed mid-migration | MEDIUM | `npm install tailwindcss@^3.4.17`, add `overrides` in package.json, `npm install`, rebuild Metro cache (`npx expo start --clear`) |
| Half-migrated screens in production | MEDIUM | Run `grep` audit, create completion checklist, finish remaining screens in one focused session |
| Font FOUC ships to users | LOW | Add `fontsLoaded` gate to `SplashScreenController` — one-line fix, ship as hotfix |
| PR detection calls RPC at log time (F13 broken offline) | HIGH | Rewrite PR detection to read from TanStack cache; invalidate chart query post-session instead. 2–4h of work. |
| Unit double-conversion in stored data | HIGH | Write a migration script that identifies rows where `weight_kg > 200` for exercises that realistically top out at 200 kg (e.g. lateral raise — any value >50 kg is almost certainly a lbs value that was stored raw). Correct by dividing by 2.20462. Requires careful manual review per user. |
| Notification permission denied before rest timer is released | LOW | Show a "Gå till Inställningar" deeplink: `Linking.openURL('app-settings:')`. Feature still works in foreground. |
| i18n raw keys flash | LOW | Add `initImmediate: false` to i18n config and gate splash on `i18n.isInitialized` |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Tailwind v4 installed | Phase 2 (Design System) | CI check: `npm ls tailwindcss` must show 3.x |
| Half-migrated screens | Phase 3 (Screen Re-skin) | Per-screen checklist + `grep` audit in phase sign-off |
| Font FOUC | Phase 2 (Design System) | Visual review on device: tap splash until fonts are loaded; zero FOUC |
| JS-Suspension Trap (rest timer) | Phase 6 (Rest Timer / F19) | Manual test: start timer, background app, wait 2min — notification must fire |
| i18n init before first render | Phase 5 (i18n) | Automated: jest test that calls `i18n.t('myPlans')` before any React render and asserts it returns Swedish not the key |
| kg/lbs double-conversion | Phase 4 (Settings / Prefs) | Unit test on `setFormSchema.transform` + manual toggle test on workout screen |
| Dashboard timezone / streak | Phase 7 (Dashboard) | `test-rls.ts` extended with timezone edge case; manual late-night session simulation |
| PR detection offline | Phase 8 (PR Celebration) | `test:f13-brutal` must pass with PR detection active |
| Reanimated on write path | Phase 9 (Motion) | `test:f13-brutal` timing gate; profiler screenshot in phase sign-off |
| Inline overlay broken by Modal refactor | Phase 3 (Screen Re-skin) | `test:f13-brutal`; `grep` for Modal import in workout screen |
| Font key mismatch | Phase 2 (Design System) | `Warning: Unrecognized font family` must be absent in Metro logs |
| Notification permission UX | Phase 6 (Rest Timer) | Manual test: deny permission → Settings shows deeplink, not broken toggle |

---

## Sources

- `app/app/_layout.tsx` — existing `SplashScreenController` + `ThemeBootstrap` patterns (v1 architecture that font and i18n loading must integrate with)
- `app/app/(app)/workout/[sessionId].tsx` — inline-overlay pattern, FIFO mutation scope, `mutate` (not `mutateAsync`) contract
- `app/design v2/Sources/design/lib.jsx` — Forge token values, I18N object structure including function-value strings (`pbSub`, `setsSavedBody`), `numStyle` tabular-nums spec
- `app/design v2/Sources/design/forge-screens.jsx` — 17-screen reference; identifies which screens contain stat numerals, inline overlays, and rest timer UI
- CLAUDE.md — Tailwind v3/NativeWind v4 pin (HIGH confidence), `react-native-css-interop@0.2.3` peer dep, expo-notifications JS-suspension research flag, migration-as-truth convention, RLS `with check` requirement, service-role isolation gates
- `.planning/PROJECT.md` — v2.0 feature scope, offline-first F13 sacred constraint, Key Decisions record (inline-overlay, FIFO scope, LargeSecureStore)
- Expo SDK 54 docs: `expo-notifications` — local vs remote limitations in Expo Go; `scheduleNotificationAsync` date trigger behavior
- iOS platform behavior: JavaScript suspension for backgrounded apps (documented in Apple Developer docs and Expo community discussions)
- react-i18next docs: `initImmediate: false` for synchronous init; `i18next-react-18` integration; interpolation syntax

---
*Pitfalls research for: FitnessMaxxing v2.0 Forge Redesign*
*Researched: 2026-06-09*
