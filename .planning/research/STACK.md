# Stack Research — FitnessMaxxing

**Domain:** Personal iPhone gym tracker (Expo + Supabase, offline-tolerant, single-user V1)
**Researched:** 2026-05-07
**Stack status:** Locked in `ARCHITECTURE.md` — this file validates *current 2026 versions* and surfaces compatibility constraints. No alternatives are proposed.
**Overall confidence:** HIGH (Context7 + npm registry + official changelogs cross-checked for every entry; the only MEDIUM items are the chart library Skia-v2 peer-dep mismatch and the NativeWind v4-vs-v5 timing).

---

## TL;DR — Pin These Versions

```jsonc
// app/package.json — dependencies block (additions to current SDK 54 scaffold)
{
  // Already installed by create-expo-app (do not change):
  "expo": "~54.0.33",
  "expo-router": "~6.0.23",
  "react": "19.1.0",
  "react-native": "0.81.5",
  "react-native-reanimated": "~4.1.1",
  "react-native-gesture-handler": "~2.28.0",
  "react-native-safe-area-context": "~5.6.0",
  "react-native-screens": "~4.16.0",
  "react-native-worklets": "0.5.1",
  "typescript": "~5.9.2",

  // Add these (commands in §Installation below):
  "nativewind": "^4.2.3",
  "tailwindcss": "^3.4.17",          // CRITICAL: must be v3, NOT v4 (see PITFALLS)
  "@tanstack/react-query": "^5.100.9",
  "zustand": "^5.0.13",
  "react-hook-form": "^7.75.0",
  "@hookform/resolvers": "^5.2.2",
  "zod": "^4.4.3",
  "date-fns": "^4.1.0",
  "@supabase/supabase-js": "^2.105.3",
  "expo-secure-store": "~14.0.1",     // SDK-54 expects 14.0.x, NOT npm "latest" 55.x
  "@react-native-async-storage/async-storage": "2.2.0",  // npx expo install resolves
  "aes-js": "^3.1.2",
  "react-native-get-random-values": "~1.11.0",
  "@shopify/react-native-skia": "2.6.2",
  "victory-native": "^41.20.2"
}
```

The user's currently scaffolded `app/package.json` already pins the Expo SDK 54 base correctly. The block above adds the locked-stack libraries; nothing in the scaffold needs downgrading.

---

## Recommended Stack (Validated Versions)

### Core Technologies

| Technology | Version (May 2026) | Install command | Why this version | Confidence |
|-----------|--------------------|------------------|-------------------|------------|
| Expo SDK | `~54.0.33` (already installed) | n/a — scaffold | RN 0.81.5 + React 19.1 baseline; all stack libs below are validated against SDK 54 | HIGH |
| React Native | `0.81.5` (transitive) | n/a — set by Expo | The exact version Expo SDK 54 expects. Do not bump. | HIGH |
| React | `19.1.0` (transitive) | n/a — set by Expo | Required by Expo SDK 54 and Skia ≥ 2 (Skia hard-requires `react ≥ 19`) | HIGH |
| Expo Router | `~6.0.23` (already installed) | n/a — scaffold | Default v6 in SDK 54; file-based routing matches `app/app/` layout already in repo | HIGH |
| TypeScript | `~5.9.2` (already installed) | n/a — scaffold | Pinned by Expo template; Zod 4 needs ≥ 4.5, RHF needs ≥ 4.7 — 5.9 satisfies all | HIGH |

### Styling

| Library | Version | Install command | Why | Confidence |
|---------|---------|------------------|-----|------------|
| NativeWind | `^4.2.3` | `npm install nativewind` | v4.2 is the SDK-54-recommended line; v4.2.0+ contains the official Reanimated v4 patch the SDK 54 toolchain needs. v5 exists as preview but is not stable as of May 2026 — defer until v5 GA. | HIGH |
| tailwindcss | `^3.4.17` | `npm install --dev tailwindcss@^3.4.17` | **NativeWind 4.x's underlying engine `react-native-css-interop@0.2.3` declares `tailwindcss: "~3"` as a peer dep — Tailwind v4 will break NativeWind v4.** Pin to the v3 line until you migrate to NativeWind v5. | HIGH |
| prettier-plugin-tailwindcss | `^0.5.11` | `npm install --dev prettier-plugin-tailwindcss@^0.5.11` | Class-sorting in editor; matches the version NativeWind's official setup uses. | MEDIUM |

### State & Data

| Library | Version | Install command | Why | Confidence |
|---------|---------|------------------|-----|------------|
| @tanstack/react-query | `^5.100.9` | `npm install @tanstack/react-query` | v5 line; declares `react: "^18 \|\| ^19"` peer — React 19.1 is officially supported. `@tanstack/react-query-devtools` shares the same peer range. | HIGH |
| Zustand | `^5.0.13` | `npm install zustand` | v5 minimum React = 18, so React 19 is fine. v5 delegates entirely to React's native `useSyncExternalStore`, so concurrent-rendering safety is owned by React itself. | HIGH |
| react-hook-form | `^7.75.0` | `npm install react-hook-form` | v7 line is the current stable; v8 is alpha/beta only. Works on React 19 (no React-internals coupling). | HIGH |
| @hookform/resolvers | `^5.2.2` | `npm install @hookform/resolvers` | Resolvers v5 supports Zod 4 schemas via `zodResolver`. Pin v5 — v4 of the resolver expects Zod 3. | HIGH |
| Zod | `^4.4.3` | `npm install zod` | Zod v4 is stable and faster (lower TypeScript-compile cost than v3). API surface for your use cases (object/string/number schemas, `parse`, `safeParse`, inferred types) is unchanged from v3, so no learning-tax on a first project. | HIGH |
| date-fns | `^4.1.0` | `npm install date-fns` | Tree-shakeable, no React-version coupling. v4 is current; v3 still works but v4 has tighter ESM. | HIGH |

### Backend & Auth

| Library | Version | Install command | Why | Confidence |
|---------|---------|------------------|-----|------------|
| @supabase/supabase-js | `^2.105.3` | `npx expo install @supabase/supabase-js` | Official client, current 2.x line. Supports React Native using framework-provided fetch polyfill (no extra polyfill needed in Expo SDK 54). Version 3.0 exists on `next` dist-tag but is not yet GA. | HIGH |
| expo-secure-store | `~14.0.1` | `npx expo install expo-secure-store` | **`npm view expo-secure-store@latest` shows `55.0.13` — that's the SDK 55 (next) line.** SDK 54 expects the 14.x line. **You MUST install via `npx expo install`, not `npm install`** — `expo install` reads your installed Expo SDK version and pins the right matching version automatically. | HIGH |
| @react-native-async-storage/async-storage | `2.2.0` | `npx expo install @react-native-async-storage/async-storage` | Required by the `LargeSecureStore` Supabase auth wrapper (see §Critical Recipes) because Expo SecureStore has a 2048-byte value limit but Supabase JWT sessions exceed that. | HIGH |
| aes-js | `^3.1.2` | `npm install aes-js` | Pure-JS AES used inside `LargeSecureStore` to encrypt session blobs before they go into AsyncStorage. Pure-JS = no native module = works in Expo Go without prebuild. | HIGH |
| react-native-get-random-values | `~1.11.0` | `npx expo install react-native-get-random-values` | Provides `crypto.getRandomValues()` so `aes-js` can generate the 256-bit key stored in SecureStore. Required by the same wrapper pattern. | HIGH |

### Charting (single recommendation)

| Library | Version | Install command | Why | Confidence |
|---------|---------|------------------|-----|------------|
| @shopify/react-native-skia | `2.6.2` | `npx expo install @shopify/react-native-skia` | Required peer dep of Victory Native XL. Skia 2.x requires `react ≥ 19` and `react-native ≥ 0.79` — both satisfied by SDK 54. iOS 14+ and Android API 21+ minimum platform, well within iPhone-only V1 scope. | HIGH |
| victory-native | `^41.20.2` | `npm install victory-native` | The Victory Native XL package (renamed from `victory-native-next`); v41 is the current major. **See "Charting decision" below for why we pick this over Skia-direct or victory-native v40.** Reports (May 2026) confirm `41.20.2` runs on Reanimated 4.1.x + Skia 2.6.x + RN 0.81 — its package.json still declares loose peer dep `@shopify/react-native-skia: ">=1.2.3"` but works fine with Skia 2.x. | MEDIUM |

**Charting decision: `victory-native` (XL) over raw `react-native-skia`.**

Both are recommended by Skia for charts; the choice is "ergonomics vs ceiling":

- **victory-native (XL)** is *built on* Skia + Reanimated + Gesture Handler. It gives you `<CartesianChart>`, line/bar/area, axes, gestures, and animated paths out of the box. For F10 ("graf per övning över tid: max vikt, total volym") this is one component and ~30 lines of TSX.
- **Raw react-native-skia** is the lowest level — you'd hand-roll axes, scales (with d3), tooltips, and pan/zoom. Two-three days of work for what `<CartesianChart>` does in 30 minutes.

The whole point of V1 is to ship F1–F9 + F13 fast. Use `victory-native`. If F10 becomes a bottleneck or you want a specific custom visualization in V2, drop down to raw Skia for that one screen — they coexist (Victory Native renders into Skia, so your Skia primitives compose with `<CartesianChart>` via render-props).

### Development tools (already in scaffold)

| Tool | Version | Notes |
|------|---------|-------|
| eslint | `^9.25.0` (already installed) | Use `expo lint` script in package.json |
| eslint-config-expo | `~10.0.0` (already installed) | Expo's recommended ruleset |
| @types/react | `~19.1.0` (already installed) | Matches React 19.1 runtime |

---

## Installation (Run These, In Order)

Run from the `app/` directory.

```bash
# 1) Styling — NativeWind 4 + Tailwind 3 (NOT 4 — see PITFALLS)
npm install nativewind react-native-safe-area-context
npm install --dev tailwindcss@^3.4.17 prettier-plugin-tailwindcss@^0.5.11

# 2) Server state + local state
npm install @tanstack/react-query zustand

# 3) Forms + validation
npm install react-hook-form @hookform/resolvers zod

# 4) Dates
npm install date-fns

# 5) Supabase + secure session storage
npx expo install @supabase/supabase-js expo-secure-store \
  @react-native-async-storage/async-storage react-native-get-random-values
npm install aes-js

# 6) Charting (Skia + Victory Native XL)
npx expo install @shopify/react-native-skia
npm install victory-native
```

**Why mixed `npx expo install` and `npm install`:**
`npx expo install <pkg>` consults the Expo SDK's compatibility matrix and pins versions known to work with your installed SDK. Use it for every package that has an Expo-blessed version (everything in `expo-*`, native modules like Skia, AsyncStorage, get-random-values). Use plain `npm install` for pure-JS libraries Expo doesn't curate (NativeWind, TanStack Query, Zustand, RHF, Zod, date-fns, aes-js, victory-native). Getting this wrong is the #1 cause of "it builds locally but EAS Build fails" — pure-JS-with-`expo install` is harmless, but native-module-with-plain-`npm install` will install a version mismatched against your RN/Expo runtime.

**Post-install (NativeWind setup files):**

After running the install commands you also need to create four files (NativeWind doesn't auto-generate them):

1. `tailwind.config.js` — `presets: [require("nativewind/preset")]` and `content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"]`
2. `global.css` — three `@tailwind base/components/utilities` directives
3. `metro.config.js` — wrap default config with `withNativeWind(config, { input: "./global.css" })`
4. `babel.config.js` — `presets: ["babel-preset-expo", "nativewind/babel"]`
5. `nativewind-env.d.ts` — `/// <reference types="nativewind/types" />` (TypeScript declaration for `className` prop)

The exact contents are in NativeWind's "Installation with Expo" docs (linked in §Sources).

---

## Critical Recipes (First-Time-User Code You Will Need)

### A) `lib/supabase.ts` — Supabase client with `LargeSecureStore`

You **cannot** just point Supabase at `expo-secure-store` directly. SecureStore has a hard 2048-byte limit per value, and a Supabase session (JWT + refresh token + user object JSON) routinely exceeds that. The official Supabase pattern is `LargeSecureStore`: encrypt the session with AES-256, store the *encrypted blob* in AsyncStorage (which has no size cap), and store only the *AES key* in SecureStore.

```ts
// lib/supabase.ts
import "react-native-get-random-values"; // must be FIRST import in this file
import * as aesjs from "aes-js";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

class LargeSecureStore {
  private async _encrypt(key: string, value: string) {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));
    const cipher = new aesjs.ModeOfOperation.ctr(
      encryptionKey,
      new aesjs.Counter(1),
    );
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(
      key,
      aesjs.utils.hex.fromBytes(encryptionKey),
    );
    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async _decrypt(key: string, value: string) {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) return null;
    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1),
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string) {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    return await this._decrypt(key, encrypted);
  }

  async setItem(key: string, value: string) {
    const encrypted = await this._encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }

  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }
}

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: new LargeSecureStore(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // RN has no URL bar
    },
  },
);

// Foreground/background handling — auto-refresh only while app is active.
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
```

`detectSessionInUrl: false` is required for React Native (no browser). The `AppState` listener pattern is from Supabase's official RN guide — without it, the auto-refresh timer keeps firing while the app is backgrounded and burns battery.

### B) `app/_layout.tsx` — TanStack Query + AppState focus + NetInfo online

```tsx
// app/_layout.tsx (snippet — extend the scaffold's root layout)
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo"; // npx expo install @react-native-community/netinfo if you want online detection in V1.5

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 30, gcTime: 1000 * 60 * 60 * 24 } },
});

// Foreground refetch (RN doesn't fire window.focus)
focusManager.setEventListener((setFocused) => {
  const sub = AppState.addEventListener("change", (s) => {
    if (Platform.OS !== "web") setFocused(s === "active");
  });
  return () => sub.remove();
});

// (Optional in V1, required for V1.5 offline-queue) Online detection
// onlineManager.setEventListener((setOnline) =>
//   NetInfo.addEventListener((state) => setOnline(!!state.isConnected)),
// );

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Stack/Slot from expo-router */}
    </QueryClientProvider>
  );
}
```

Without the `focusManager` listener, queries don't refetch when you bring the app back from background — they only refetch on mount. Without the `onlineManager` listener, mutations stack silently while offline and only fire on the next mount. Both are RN-only quirks the TanStack Query docs flag explicitly.

---

## First-Time-User Gotchas (One per library)

### Expo Router 6
File-based routing means *every file under `app/app/` is a route* — including any `.tsx` file you accidentally drop in there for "just a quick component." Move shared components to `app/components/`, not `app/app/`. The `_layout.tsx` and `(group)/` parenthesis-folder conventions look like typos but are load-bearing: parens = group without affecting URL, leading underscore = layout/non-route.

### NativeWind 4
**You will install Tailwind v4 by accident the first time** — `npm install tailwindcss` with no version pin grabs v4, which silently breaks NativeWind. Always pin `tailwindcss@^3.4.17`. The error you'll see is cryptic: styles compile but classes don't apply. If you see "no styles," check `tailwindcss` version first.

### TanStack Query v5
v5 changed the API from positional args to a single object: `useQuery({ queryKey, queryFn })`, never `useQuery(['key'], fn)`. Tutorials older than mid-2024 use the old form and will TypeScript-error with confusing messages. The other v5 thing: `cacheTime` was renamed to `gcTime`. Your `gcTime` should be ≥ `staleTime`.

### Zustand 5
v5 is the most "boring" library here — only gotcha is the `selector` pattern: `const sets = useStore(s => s.sets)` causes a re-render only when `sets` reference changes, but `const { sets, addSet } = useStore()` (destructuring without selector) re-renders on **every** store change. Always select narrowly. For UI-only ephemeral state (e.g., "is the timer modal open"), Zustand is right; for server data (workouts, plans, sets fetched from Supabase), use TanStack Query — don't put Supabase results into Zustand.

### react-hook-form 7 + Zod 4 + @hookform/resolvers 5
The version triple matters: RHF 7 + Zod 4 needs `@hookform/resolvers@5`, not 4. With resolver 4 you get type-mismatch errors from `zodResolver(schema)` because Zod 4's inferred type shape differs slightly from v3. The other gotcha: `useForm<z.infer<typeof Schema>>({ resolver: zodResolver(Schema) })` — you have to pass the inferred type as the generic OR `useForm` will type your form values as `any` silently.

### date-fns 4
`date-fns` is intentionally *not* a class — every function is a top-level import: `import { format, subDays } from 'date-fns'`. Don't pull `import dateFns from 'date-fns'` (no default export). The tree-shaking only works if you keep imports named like that — `import * as dateFns` defeats it.

### Zod 4
`safeParse` returns `{ success: true, data }` or `{ success: false, error }` — narrow with `if (!result.success) return result.error.issues` rather than throwing. New users always reach for `.parse()` (which throws) and end up with try/catch sprawl. For Supabase response validation you want `safeParse` so a malformed row becomes a logged warning, not a redbox crash.

### @supabase/supabase-js 2.105
Two surprises: (1) Supabase's RN tutorials show `AsyncStorage` as the auth `storage` adapter — **don't follow that** for our app, use the `LargeSecureStore` recipe above so JWTs aren't readable to anyone with filesystem access to the app sandbox. (2) The "anon key" in your client is *meant* to be public — it's exposed to every user. RLS policies are what protect data. If you find yourself trying to "hide" the anon key, you're solving the wrong problem; review the RLS policies in `ARCHITECTURE.md` §4 instead.

### expo-secure-store 14
**Hard 2048-byte limit per value** — exceeded by Supabase sessions, hence the `LargeSecureStore` wrapper. Also: on iOS Simulator the keychain is shared across all simulator apps, so values persist across reinstalls in dev (annoying when testing logout). Use `SecureStore.deleteItemAsync` on logout explicitly, don't rely on app-uninstall to clear. Not available on web — guard with `Platform.OS !== "web"` even though V1 is iOS-only.

### Victory Native (XL) 41
Its `package.json` says `@shopify/react-native-skia: ">=1.2.3"` — that lower bound is misleading. v41 works fine with Skia 2.x; the peer dep just hasn't been tightened. If `npm install` complains about peer-dep mismatches, it's a *warning*, not an error — proceed. The real surprise: `<CartesianChart>` requires its `data` prop to have stable references — pass memoized arrays, otherwise the chart re-mounts on every render and animations stutter. `useMemo(() => sets.map(...), [sets])` before passing.

### @shopify/react-native-skia 2.6
Skia ships a native module — you cannot use it in Expo Go on a Mac/iPhone if you go through "custom dev client" later, because Expo Go is a single prebuilt app and only contains Skia's specific Expo-blessed version. For V1 (Expo Go on iPhone) it works because the SDK 54 Expo Go binary already includes Skia 2.6.x. When you switch to EAS Build for TestFlight, no extra config — Skia is autolinked. The first build will take ~10 minutes longer than usual the first time though (Skia's native binary is large).

---

## Version Compatibility Matrix

| Package | Pinned to | Compatible with | Notes |
|---------|-----------|-----------------|-------|
| `expo@~54.0.33` | RN 0.81.5 + React 19.1 | All other rows | The hub. Don't bump until ready for SDK 55 audit. |
| `nativewind@^4.2.3` | tailwindcss@^3.4.17 only | Reanimated 4.x (since 4.2.0+) | **Tailwind v4 = broken**. Stay on v3 until NativeWind v5 GA. |
| `react-native-css-interop@0.2.3` (transitive) | tailwindcss `~3` peer | NativeWind 4 internals | This is the package that hard-pins Tailwind 3. Don't override. |
| `@tanstack/react-query@^5.100.9` | react `^18 \|\| ^19` | RN 0.81 | Devtools (optional) shares the peer range. |
| `zustand@^5.0.13` | react ≥ 18, TS ≥ 4.5 | All | Pure JS, no native. |
| `react-hook-form@^7.75.0` | React 19 OK | `@hookform/resolvers@^5` | RHF 8 is alpha — don't track latest, track v7 latest. |
| `@hookform/resolvers@^5.2.2` | RHF 7, Zod 4 | n/a | If you stayed on Zod 3, use resolvers v4 instead — but we're on Zod 4. |
| `zod@^4.4.3` | TypeScript ≥ 4.5 | All | Major perf win in tsc compile time over Zod 3. |
| `date-fns@^4.1.0` | n/a | All | Pure JS. |
| `@supabase/supabase-js@^2.105.3` | Node 20+ runtime, RN current stable | All | Provides fetch via framework polyfill — Expo SDK 54 is fine. |
| `expo-secure-store@~14.0.1` | Expo SDK 54 only | n/a | **Do not install via `npm install` — use `npx expo install`.** Latest npm tag (55.x) is for SDK 55. |
| `@react-native-async-storage/async-storage@2.2.0` | RN 0.81 | Used by `LargeSecureStore` | `npx expo install` resolves. |
| `aes-js@^3.1.2` | n/a | n/a | Pure JS, no peer deps. |
| `react-native-get-random-values@~1.11.0` | RN 0.81 | Used by `aes-js` | `npx expo install` resolves. |
| `@shopify/react-native-skia@2.6.2` | react ≥ 19, RN ≥ 0.79 | Reanimated 4 | iOS 14+ / Android 21+ minimum. |
| `victory-native@^41.20.2` | Skia ≥ 1.2.3 (declared), works with 2.x | Reanimated 4.1.x confirmed by users in May 2026 | Loose peer dep — npm warnings ignorable. |

---

## Sources

| Source | What was verified | Confidence |
|--------|-------------------|------------|
| Context7 `/expo/expo` `__branch__sdk-54` | Default SDK 54 template package.json (`expo@~54.0.33`, `expo-router@~6.0.23`); `npx expo install expo-secure-store` is the recommended install path | HIGH |
| Context7 `/nativewind/nativewind` `nativewind_4.2.0` | Install command, Metro config wrapper, Tailwind v3 requirement | HIGH |
| Context7 `/formidablelabs/victory-native-xl` | Peer deps (Reanimated, Gesture Handler, Skia), `<CartesianChart>` API surface | HIGH |
| Context7 `/shopify/react-native-skia` | "Requires `react-native@>=0.79` and `react@>=19`. Min iOS 14, Android API 21." | HIGH |
| Context7 `/tanstack/query` `v5_*` | `react: "^18 \|\| ^19"` peer dep; v5 object-arg API; `gcTime` rename; AppState/NetInfo RN integration patterns | HIGH |
| Context7 `/pmndrs/zustand` `v5.0.12` | v5 React 18 minimum; useSyncExternalStore-only implementation | HIGH |
| Context7 `/colinhacks/zod` `v4.0.1` | Zod 4 stable, perf improvements over v3 | HIGH |
| Context7 `/react-hook-form/react-hook-form` `v7.66.0` | RHF v7 latest line, React 19 compat (no React internals coupling) | HIGH |
| Context7 `/supabase/supabase-js` `v2.58.0` | `createClient` shape, RN environment notes ("fetch polyfill provided by framework"), Node 20+ support floor | HIGH |
| `npm view <pkg>` (May 7 2026) | Latest stable versions for every package above | HIGH |
| `npm view nativewind@4.2.3 dependencies` | Confirmed transitive `react-native-css-interop@0.2.3` | HIGH |
| `npm view react-native-css-interop@0.2.3 peerDependencies` | Confirmed `tailwindcss: "~3"` hard peer dep | HIGH |
| `npm view victory-native@41.20.2 peerDependencies` | Confirmed declared peer is `@shopify/react-native-skia: ">=1.2.3"` (loose lower bound) | HIGH |
| `npm view expo-secure-store versions` | Confirmed `14.0.x` is SDK 54 line; `55.x` is SDK 55 | HIGH |
| [NativeWind installation docs](https://www.nativewind.dev/docs/getting-started/installation) | `tailwindcss@^3.4.17`; v4 NOT supported in NativeWind v4 | HIGH |
| [NativeWind Discussion #1604 — Officially recommended versions](https://github.com/nativewind/nativewind/discussions/1604) | NativeWind v4.2.1+ is the SDK-54-recommended line | MEDIUM |
| [Supabase + React Native auth quickstart](https://supabase.com/docs/guides/auth/quickstarts/react-native) (and follow-up search results) | LargeSecureStore pattern, 2048-byte SecureStore limit, AppState refresh listener | HIGH |
| [Supabase issue #14523](https://github.com/supabase/supabase/issues/14523) | Confirmed inconsistent recommendations exist; LargeSecureStore is the encryption-at-rest variant | MEDIUM |
| [Victory Native XL issue #616 + community reports May 2026](https://github.com/FormidableLabs/victory-native-xl/issues/616) | v41 works with Skia 2.x in practice despite loose peer-dep declaration | MEDIUM |
| [Expo SDK 54 changelog / Reanimated 4 migration discussion #39130](https://github.com/expo/expo/discussions/39130) | Reanimated 4 + worklets 0.5 is the SDK 54 baseline | HIGH |

---

*Stack research for: personal Expo + Supabase fitness tracker (FitnessMaxxing).*
*Researched: 2026-05-07.*
*Stack is locked per `ARCHITECTURE.md`; this document validates versions and surfaces compatibility constraints only.*
