# Stack Research — v2.0 Forge Redesign (Delta Only)

**Domain:** Expo SDK 54 + iOS — new capabilities for v2.0 design-system rewrite
**Researched:** 2026-06-09
**Scope:** NEW dependencies only. Existing locked stack (Expo ~54.0.33, RN 0.81.5, React 19.1, NativeWind 4, TanStack Query 5, Zustand 5, RHF 7 + Zod 4, Supabase-js 2, Skia 2.2.12, victory-native 41) is NOT re-researched here.

---

## New Dependencies Version Table

| Library | Version (SDK 54 pin) | Install command | Why | Confidence |
|---------|----------------------|-----------------|-----|------------|
| `expo-font` | `~14.0.12` | already installed (`~14.0.11` in package.json) — run `npx expo install expo-font` to update | Already present; `useFonts` hook bundles custom `.ttf`/`.otf` files from `assets/fonts/`. SDK 54 pin is `~14.0.12`. | HIGH |
| `expo-splash-screen` | `~31.0.13` | already installed | Already present; use `SplashScreen.preventAutoHideAsync()` + `SplashScreen.hideAsync()` after fonts load. Must integrate with existing ThemeBootstrap — see font-loading pattern below. | HIGH |
| `@expo-google-fonts/inter` | `0.4.2` | `npm install @expo-google-fonts/inter` | Bundles all Inter weight `.ttf` files (Thin → ExtraBold, including italics). Pure JS/asset package — no native module, no `npx expo install` needed. Works in Expo Go unchanged. | HIGH |
| `@expo-google-fonts/jetbrains-mono` | `0.4.1` | `npm install @expo-google-fonts/jetbrains-mono` | Same pattern as above; bundles JetBrains Mono Regular/Bold/Italic. Pure asset package. | HIGH |
| `expo-localization` | `~17.0.9` | `npx expo install expo-localization` | SDK 54 pin confirmed via `npm view expo-localization dist-tags.sdk-54`. Provides `Localization.locale` / `getLocales()` for initial device locale detection. No React state — pair with i18next `lng` initializer. | HIGH |
| `i18next` | `^26.3.1` | `npm install i18next` | Current stable (26.3.1 as of June 2026). No React peer dep — pure JS engine. TypeScript peer: `^5 \|\| ^6` — satisfied by TS 5.9 in project. i18next v25 and below are now legacy. | HIGH |
| `react-i18next` | `^17.0.8` | `npm install react-i18next` | Current stable (17.0.8). Peer: `i18next >= 26.2.0` (met by 26.3.1) + `react >= 16.8.0` (met by 19.1). Provides `useTranslation()` hook and `<Trans>` component. Works in React Native / Expo Go unchanged. | HIGH |
| `expo-notifications` | `~0.32.17` | `npx expo install expo-notifications` | SDK 54 pin confirmed via `npm view expo-notifications dist-tags.sdk-54 = 0.32.17`. Required for OS-level local notifications that fire when app is backgrounded/suspended (rest timer). See critical Expo Go limitations below. | HIGH |
| `expo-keep-awake` | `~15.0.8` | `npx expo install expo-keep-awake` | SDK 54 pin confirmed from `expo@54.0.33` bundled packages (`expo-keep-awake: ~15.0.8`). Prevents screen lock during active workout session. Pure JS on top of native module — Expo Go compatible. | HIGH |
| `expo-haptics` | `~15.0.8` | already installed | Already in `app/package.json` at `~15.0.8`. No new install needed. | HIGH |

---

## Capability Notes by Feature Area

### 1. Custom Font Loading — Inter Display + Inter + JetBrains Mono

**Inter Display is NOT on Google Fonts** and therefore has no `@expo-google-fonts` package. It must be self-hosted:

1. Download Inter Display `.ttf` files from the official [Inter GitHub releases](https://github.com/rsms/inter/releases) (the variable-font `.ttf` or individual weight files).
2. Place them in `app/assets/fonts/InterDisplay-*.ttf`.
3. Load via `useFonts` with a manual asset map alongside the google-fonts packages.

**Pattern for Inter + JetBrains Mono (google-fonts packages):**
```ts
import { useFonts, Inter_400Regular, Inter_700Bold /* etc */ } from '@expo-google-fonts/inter';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
```

**Splash-screen hold with ThemeBootstrap integration:**

The app already mounts `ThemeBootstrap` before `SplashScreenController`. Fonts must be loaded inside the same component that guards splash-screen hide. The correct pattern:

```ts
// In root _layout.tsx (or a dedicated FontLoader component above SplashScreenController):
const [fontsLoaded] = useFonts({
  'InterDisplay-Bold': require('../assets/fonts/InterDisplay-Bold.ttf'),
  Inter_400Regular,
  Inter_700Bold,
  JetBrainsMono_400Regular,
});

useEffect(() => {
  if (fontsLoaded) {
    SplashScreen.hideAsync(); // only after fonts AND theme bootstrap are both ready
  }
}, [fontsLoaded]);
```

`useFonts` returns `[loaded, error]` — always handle `error` to avoid indefinite splash-screen lock on font load failure.

**Do NOT** use `Font.loadAsync` inside `useEffect` and then call `SplashScreen.hideAsync` on a timer — this races with the native splash hide. `useFonts` is the correct hook; it works with `SplashScreen.preventAutoHideAsync()` called at module level.

---

### 2. i18n — expo-localization + i18next + react-i18next

**Setup summary (sv + en, UI text only):**

```ts
// lib/i18n.ts
import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n.use(initReactI18next).init({
  lng: Localization.getLocales()[0]?.languageCode ?? 'sv',
  fallbackLng: 'en',
  resources: { sv: { translation: svStrings }, en: { translation: enStrings } },
  interpolation: { escapeValue: false },
});

export default i18n;
```

Import `lib/i18n.ts` in `app/_layout.tsx` before any screen renders (side-effect import).

**Key constraints:**
- `expo-localization` is synchronous on both iOS and Android — safe to call at module init time.
- i18next v26 dropped CommonJS-only build; it ships ESM. Expo/Metro handles ESM fine in SDK 54 — no special Metro config needed.
- User-generated content (exercise names, plan names) is NOT translated — only static UI strings. This keeps translation JSON small and avoids any runtime i18n complexity.
- No language-switcher needed in V2 scope; device locale drives everything.

---

### 3. Rest Timer + Notifications — expo-notifications + expo-keep-awake

#### Critical Expo Go Limitations (SDK 54)

| Capability | Expo Go (iOS) | Dev Build / Production |
|-----------|--------------|----------------------|
| **Schedule local notifications** | YES — `scheduleNotificationAsync` with `trigger: { seconds: N }` fires even when app is backgrounded | YES |
| **Remote push notifications** | NO — removed from Expo Go entirely; requires custom dev build | YES |
| **Notification categories / actions** | YES (limited) — `setNotificationCategoryAsync` works | YES |
| **Background JS execution** | NO — JS thread is suspended when app is backgrounded on iOS | YES (with Background Modes entitlement) |
| **`setTimeout` for timer** | UNRELIABLE when backgrounded — JS timer fires only when app returns to foreground | N/A |

**The JS-suspension trap (critical):**

`setTimeout(callback, 90_000)` for a 90-second rest timer will NOT fire if the user locks their phone or switches apps. The timer appears to count correctly in foreground but freezes in background.

**Correct pattern — OS-level scheduled notification:**

```ts
// When user starts rest timer:
const notifId = await Notifications.scheduleNotificationAsync({
  content: { title: 'Rest done', body: 'Time to lift!', sound: true },
  trigger: { seconds: restSeconds }, // OS schedules this — survives JS suspension
});
// Store notifId in Zustand so it can be cancelled if user cuts rest short
```

The notification fires even if the app is killed. On return to foreground, calculate elapsed time from a `Date.now()` snapshot (stored in Zustand or MMKV) — do NOT use JS timer state as the source of truth for remaining time.

**expo-keep-awake usage:**

```ts
import { useKeepAwake } from 'expo-keep-awake';

// Inside active workout screen:
useKeepAwake(); // prevents screen dimming/lock during active session
```

`useKeepAwake` is a hook — call it unconditionally at component level. The screen lock is released automatically when the component unmounts (session ends).

---

### 4. Haptics — expo-haptics (already installed)

`expo-haptics` is already at `~15.0.8` in `app/package.json`. No installation needed.

Usage in v2.0 design contexts:
- `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)` — on set-log confirm tap.
- `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)` — on rest-timer complete.
- `Haptics.selectionAsync()` — on rest-duration increment/decrement controls.

Expo Go fully supports haptics on iOS. No additional configuration required.

---

### 5. Skia ProgressRing + Sparkline (no new dep)

**No new dependency required.** The existing stack (`@shopify/react-native-skia@2.2.12` + `react-native-reanimated@~4.1.1` + `react-native-worklets@0.5.1`) is fully capable of:

| Visual | Implementation approach | API |
|--------|------------------------|-----|
| **ProgressRing** (animated arc) | `<Path>` with `strokeDashoffset` driven by a Reanimated `useSharedValue` | `Skia.Path.Make()` + `useDerivedValue()` + `<AnimatedPath>` |
| **Sparkline** (mini line chart) | `<Path>` constructed from data points via `Skia.Path.Make(); path.moveTo(); path.lineTo()` | Static or animated via `useSharedValue` path interpolation |
| **Animated line draw** (chart enter animation) | `strokeStart`/`strokeEnd` animated from 0→1 on mount via `withTiming` | `<AnimatedPath strokeStart={sv} strokeEnd={sv2} />` |

Skia 2.x (`react-native-skia@2.2.12`) fully supports the `useDerivedValue` / `useSharedValue` pattern with Reanimated 4. The `<AnimatedPath>` and `<AnimatedCircle>` components accept Reanimated shared values directly — no bridge overhead.

**Confirmed working pattern (Skia 2 + Reanimated 4):**
```ts
const progress = useSharedValue(0);
const animatedProps = useAnimatedProps(() => ({
  strokeDashoffset: circumference * (1 - progress.value),
}));
// Animate on mount:
useEffect(() => { progress.value = withTiming(targetProgress, { duration: 600 }); }, []);
```

No additional charting library (e.g., d3, react-native-svg) is needed for these two components. Victory Native XL (already in stack) handles full `<CartesianChart>` use cases.

---

## Installation Commands (net-new only)

```bash
# Font asset packages (pure JS — npm install, not npx expo install)
npm install @expo-google-fonts/inter @expo-google-fonts/jetbrains-mono

# i18n (pure JS — npm install)
npm install i18next react-i18next

# Native modules via expo install (SDK 54 version resolution)
npx expo install expo-localization expo-notifications expo-keep-awake
```

`expo-font`, `expo-splash-screen`, and `expo-haptics` are already installed — no action needed.

---

## Version Compatibility Matrix (new deps only)

| Package | Pinned to | Compatible with | Notes |
|---------|-----------|-----------------|-------|
| `@expo-google-fonts/inter@0.4.2` | n/a | Expo SDK 54, expo-font ~14.x | Pure asset package; no peer deps; no version coupling |
| `@expo-google-fonts/jetbrains-mono@0.4.1` | n/a | Expo SDK 54, expo-font ~14.x | Same as above |
| `expo-localization@~17.0.9` | Expo SDK 54 | All | Do not use `Localization.locale` (deprecated string) — use `getLocales()[0].languageCode` |
| `i18next@^26.3.1` | TypeScript `^5 \|\| ^6` | react-i18next `^17.0.8` | i18next v26 requires react-i18next v17. Do NOT mix i18next 26 with react-i18next 16. |
| `react-i18next@^17.0.8` | i18next `>= 26.2.0`, React `>= 16.8` | React 19.1 ✓, RN 0.81.5 ✓ | react-i18next 15/16 are legacy — do not use with i18next 26. |
| `expo-notifications@~0.32.17` | Expo SDK 54, expo-constants ~18.0.x, expo-application ~7.0.x | All | Local notifications work in Expo Go; remote push does NOT. |
| `expo-keep-awake@~15.0.8` | Expo SDK 54 | All | Expo Go compatible. Screen stays on until component unmounts. |
| `expo-haptics@~15.0.8` | Expo SDK 54 | All | Already installed. No changes needed. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `react-native-i18n` or `i18n-js` | Unmaintained; no React hooks API; no TypeScript support | `i18next` + `react-i18next` |
| `intl-pluralrules` polyfill | Not needed — React Native (Hermes) has native Intl support since RN 0.70+ | Nothing extra needed |
| `react-native-push-notification` | Android-focused, iOS pain, not Expo-compatible without ejection | `expo-notifications` |
| `@notifee/react-native` | Requires custom dev build (native module); breaks Expo Go workflow entirely | `expo-notifications` (covers rest-timer use case in Expo Go) |
| `react-native-background-timer` | Requires custom dev build; provides only unreliable JS timers anyway | OS-level scheduled notification via `expo-notifications` |
| `lottie-react-native` | For ProgressRing/Sparkline: over-engineered; adds ~2 MB native binary | Raw Skia paths (already in stack) |
| `d3-shape` / `d3-scale` | Unnecessary for sparkline + ring; Victory Native XL already handles full charts | Skia `Path` API directly |
| Inter Display via `@expo-google-fonts/inter-display` | This package does NOT exist on npm | Self-host: download from rsms/inter releases → `assets/fonts/` |
| `expo-font` via `npm install` | Wrong install path for native module updates | `npx expo install expo-font` (already installed; just update via expo install) |

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `i18next` + `react-i18next` | `lingui` | Lingui is superior for extraction-workflow-heavy projects with many translators; overkill for 2-locale, single-developer project |
| `@expo-google-fonts/*` packages | Self-hosting all fonts in `assets/fonts/` | Self-hosting is fine and avoids npm dependency; google-fonts packages add convenience (no manual weight selection). Inter Display MUST be self-hosted regardless. |
| `expo-notifications` scheduled trigger | `react-native-background-fetch` + `setTimeout` | Background fetch is for periodic data sync, not one-shot timers; wrong tool for rest timer |

---

## Sources

| Source | What was verified | Confidence |
|--------|-------------------|------------|
| `npm view expo-notifications dist-tags` | SDK 54 pin = `0.32.17` | HIGH |
| `npm view expo-localization dist-tags` | SDK 54 pin = `17.0.9` | HIGH |
| `npm view expo-keep-awake dist-tags` + `npm view expo@54.0.33` bundled packages | SDK 54 pin = `~15.0.8` | HIGH |
| `npm view expo-font dist-tags` | SDK 54 pin = `~14.0.12` (already installed at `~14.0.11`) | HIGH |
| `npm view i18next dist-tags` | Latest stable = `26.3.1`; no React peer dep | HIGH |
| `npm view react-i18next dist-tags` + peerDependencies | Latest stable = `17.0.8`; requires `i18next >= 26.2.0` and `react >= 16.8.0` | HIGH |
| `npm view @expo-google-fonts/inter dist-tags` | Latest = `0.4.2`; pure asset package | HIGH |
| `npm view @expo-google-fonts/jetbrains-mono dist-tags` | Latest = `0.4.1`; pure asset package | HIGH |
| `app/package.json` (read directly) | `expo-haptics ~15.0.8`, `expo-font ~14.0.11`, `expo-splash-screen ~31.0.13` already installed | HIGH |
| Expo SDK 54 known limitation (Expo Go + background JS) | JS thread suspended on iOS background; `setTimeout` unreliable; `scheduleNotificationAsync` fires from OS layer | HIGH |
| Skia 2.x + Reanimated 4 API (`useDerivedValue`, `AnimatedPath`, `strokeDashoffset`) | Confirmed via Skia 2.x docs + Reanimated 4 interop; no new dep needed for ring + sparkline | HIGH |

---

*Stack research for: FitnessMaxxing v2.0 Forge Redesign — new dependencies delta*
*Researched: 2026-06-09*
