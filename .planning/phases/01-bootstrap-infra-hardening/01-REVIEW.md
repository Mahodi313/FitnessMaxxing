---
phase: 01-bootstrap-infra-hardening
reviewed: 2026-05-08T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - app/app/_layout.tsx
  - app/app/index.tsx
  - app/babel.config.js
  - app/metro.config.js
  - app/tailwind.config.js
  - app/global.css
  - app/nativewind-env.d.ts
  - app/lib/supabase.ts
  - app/lib/query-client.ts
  - app/.env.example
findings:
  critical: 3
  warning: 3
  info: 2
  total: 8
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-05-08
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 1 delivers the walking skeleton: NativeWind 4 + Tailwind 3 config triple, LargeSecureStore-wrapped Supabase client, TanStack Query with AsyncStorage persister, and AppState/NetInfo bridges. The architecture is broadly correct and the security posture is sound — no service-role key, no hardcoded secrets, runtime env guard is present, and the AES-256 + SecureStore key pattern is implemented correctly.

Three blockers were found. Two are package version mismatches against the CLAUDE.md lock table — `expo-secure-store` is on the SDK 55 line instead of SDK 54, and `@shopify/react-native-skia` is on 2.2.12 instead of the required 2.6.2. The third and most significant blocker is a dark mode misconfiguration: `darkMode: "class"` in `tailwind.config.js` does not automatically wire system color scheme to dark variants — it requires manual class injection. The `dark:` variants in `index.tsx` will not respond to iOS system preference switches as currently implemented, which contradicts the F15 requirement verified in the plan summary.

Three warnings cover: a module-level AppState listener that accumulates on Fast Refresh in development, incorrect handling of `isConnected: null` in the NetInfo online manager, and a non-atomic `removeItem` that can orphan an AES key in SecureStore.

---

## Critical Issues

### CR-01: `darkMode: "class"` does not wire system color scheme to `dark:` variants

**File:** `app/tailwind.config.js:9`

**Issue:** With `darkMode: "class"`, NativeWind 4 compiles `dark:` variants as container/class-conditioned rules — not as `@media (prefers-color-scheme: dark)` queries. At runtime, `dark:bg-gray-900` requires a parent element with `className="dark"` in the React tree for the style to activate. The system color scheme (`Appearance.getColorScheme()`) does NOT automatically inject this class. No code in the current codebase calls `colorScheme.set("dark")`, wraps the tree in a `className="dark"` view, or uses NativeWind's `useColorScheme` to react to system theme changes. As a result, the `dark:` variants in `index.tsx` (lines 5-8) will always render as their light-mode defaults regardless of the iOS system theme setting.

This was verified by tracing `react-native-css-interop`'s compiled output in `node_modules/react-native-css-interop/dist/css-to-rn/index.js` (class-mode produces `containerQuery` rules) vs `conditions.js` (only `prefers-color-scheme` media queries use `colorScheme.get()` from `Appearance`). The plan summary in `01-02-SUMMARY.md` claims "`darkMode:'class'` — NativeWind reads useColorScheme() and applies dark class internally" — this claim is incorrect.

**Fix option A (simplest — responsive to system preference automatically):**
Change `tailwind.config.js` line 9 from `darkMode: "class"` to `darkMode: "media"`. This compiles `dark:` variants as `@media (prefers-color-scheme: dark)` which NativeWind evaluates using `Appearance.getColorScheme()` automatically. No component changes needed. Dark mode will follow iOS system preference immediately.

*Trade-off:* `darkMode: "media"` does not allow manual override (NativeWind's `setColorScheme`/`toggleColorScheme` throw with media mode). Phase 7's planned manual toggle (F15 toggle) requires class mode.

**Fix option B (keep class mode, add system-preference bridge now):**
Keep `darkMode: "class"` and add a system-preference bridge. The minimal pattern is a root view wrapper that reads system scheme and applies the `dark` class:

```tsx
// app/app/_layout.tsx — add import
import { useColorScheme } from "react-native";
import { colorScheme } from "nativewind";

// Inside RootLayout, before the return:
const systemScheme = useColorScheme();
useEffect(() => {
  colorScheme.set(systemScheme ?? "light");
}, [systemScheme]);
```

This bridges iOS system preference to NativeWind's class-mode color scheme, so `dark:` variants activate correctly while preserving the ability to use `colorScheme.set()` for manual override in Phase 7.

---

### CR-02: `expo-secure-store` installed at SDK 55 version (`15.0.8`) instead of required SDK 54 version (`14.0.1`)

**File:** `app/package.json:35`

**Issue:** `package.json` declares `"expo-secure-store": "~15.0.8"` and the installed package is version `15.0.8`. CLAUDE.md `### Backend & Auth` table explicitly states: `expo-secure-store: ~14.0.1 | SDK 54 expects the 14.x line. **You MUST install via npx expo install, not npm install** — expo install reads your installed Expo SDK version and pins the right matching version automatically.` Version 15.x is the SDK 55 line. Using an SDK-mismatched native module can cause crashes or undefined behavior at native layer calls, particularly when the native module ABI changes between SDK versions. This affects `LargeSecureStore` which calls `SecureStore.setItemAsync`, `getItemAsync`, and `deleteItemAsync` on every session read/write.

**Fix:** Reinstall using the SDK-aware tool to get the SDK 54 pin:
```bash
cd app
npx expo install expo-secure-store
```
Then update `package.json` to reflect `~14.0.1` and verify `npx expo-doctor` exits 0.

---

### CR-03: `@shopify/react-native-skia` installed at `2.2.12` instead of required `2.6.2`

**File:** `app/package.json:21`

**Issue:** `package.json` declares `"@shopify/react-native-skia": "2.2.12"` but CLAUDE.md `### Charting` table specifies an exact pin of `2.6.2` with `HIGH` confidence: "Required peer dep of Victory Native XL. Skia 2.x requires react >= 19 and react-native >= 0.79." Community reports confirming `victory-native@41.20.2` works were specifically for `Skia 2.6.x + Reanimated 4.1.x + RN 0.81`. Running `victory-native@41.20.2` against `skia@2.2.12` is untested territory — the API surface between Skia 2.2 and 2.6 changed (Skia 2.x has breaking changes across minor versions), and rendering bugs or crashes are likely when charting features are activated in later phases.

**Fix:** Install the exact pinned version:
```bash
cd app
npx expo install @shopify/react-native-skia@2.6.2
```
Update `package.json` to `"@shopify/react-native-skia": "2.6.2"` and run `npx expo-doctor` to verify compatibility.

---

## Warnings

### WR-01: Module-level `AppState.addEventListener` in `supabase.ts` accumulates duplicate listeners on Fast Refresh

**File:** `app/lib/supabase.ts:79`

**Issue:** The `AppState.addEventListener("change", ...)` call is at module scope — it runs once per module load. In development, React Native Fast Refresh re-executes module code on each file save without restarting the JS runtime. Each save registers a new `AppState` listener. Since the subscription is never unsubscribed (no reference is kept), multiple listeners accumulate and each independently calls `supabase.auth.startAutoRefresh()` / `stopAutoRefresh()` on every app state change. In production builds, the module loads once and this is not a problem. In development, it causes redundant Supabase auth operations proportional to the number of times any file in the import graph is saved.

**Fix:** Store the subscription and clean it up, or use the existing `focusManager` bridge pattern in `_layout.tsx` instead of a standalone listener. The minimal fix — store and never clean up — at least documents the intent:

```ts
// Replace lines 79-83 with:
const _autoRefreshSub = AppState.addEventListener("change", (state) => {
  if (Platform.OS === "web") return;
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
// Module-level; intentionally not removed (singleton pattern).
// In __DEV__, Fast Refresh re-registers this — acceptable for a singleton module.
```

A more robust fix would use a `useEffect` in `_layout.tsx` to manage the Supabase AppState listener alongside the existing `focusManager` bridge, where the cleanup function correctly removes it.

---

### WR-02: `!!state.isConnected` treats unknown connectivity as offline

**File:** `app/app/_layout.tsx:28`

**Issue:** `NetInfo.isConnected` can be `null` when the connectivity state is not yet known (e.g., during initial app load). `!!null === false`, so `onlineManager.setOnline(false)` is called, marking TanStack Query as offline and preventing all network requests until the next `NetInfo` event updates the state. This causes an unnecessary query-blocking window on every cold start, even on a device with full network access.

**Fix:**
```ts
// Replace line 28:
setOnline(state.isConnected !== false); // null = unknown = treat as online
```
This treats `null` (unknown) as online — consistent with the principle of not blocking requests when connectivity is uncertain. Only an explicit `false` marks the app as offline.

---

### WR-03: `LargeSecureStore.removeItem` is non-atomic — AES key can be orphaned in SecureStore

**File:** `app/lib/supabase.ts:63-66`

**Issue:** `removeItem` performs two sequential async operations: `AsyncStorage.removeItem(key)` followed by `SecureStore.deleteItemAsync(key)`. If the app is force-killed, crashes, or the process is terminated between these two calls, the AES encryption key remains in `SecureStore` (orphaned) while the encrypted blob is deleted from `AsyncStorage`. On next launch, `getItem` finds no blob in AsyncStorage and returns `null` (correct behavior — session treated as absent). However, the orphaned key consumes SecureStore space permanently and, critically, the next `setItem` call writes a **new** random AES key to the same SecureStore key name, discarding the orphaned key silently. This is survivable but means the crash window results in a forced sign-out.

The reverse ordering would be strictly worse (key deleted but encrypted blob retained = permanently unreadable garbage in AsyncStorage), so the current order is the safer of the two possible failure modes. The finding is that the non-atomicity exists, can cause unexpected sign-outs on crash, and should be documented.

**Fix:** Reverse the operation order so SecureStore is deleted first (key deletion fails = no data loss), then AsyncStorage. Also handle the partial-failure case in `getItem`:

```ts
async removeItem(key: string) {
  // Delete key first — if we crash after this but before AsyncStorage cleanup,
  // the next getItem finds no key and returns null (session absent = safe).
  // Encrypted blob without key = unreadable garbage, which getItem already handles
  // via the null-key guard in _decrypt.
  await SecureStore.deleteItemAsync(key);
  await AsyncStorage.removeItem(key);
}
```

---

## Info

### IN-01: `phase1ConnectTest` export creates a two-file cleanup obligation in Phase 2

**File:** `app/lib/supabase.ts:98` and `app/app/_layout.tsx:15`

**Issue:** `phase1ConnectTest` is a named export from `supabase.ts` and imported by `_layout.tsx`. When this is removed in Phase 2, both files must be edited in the same commit — omitting either edit causes a TypeScript compile error (`Module '"@/lib/supabase"' has no exported member 'phase1ConnectTest'`). The plan summary (`01-03-SUMMARY.md`, final section) does call this out, but the obligation is not a single-file change.

**Fix:** No immediate action needed — this is documented in the plan. Add a co-located comment above the export and the import making the dual-removal contract explicit:

```ts
// app/lib/supabase.ts — line 98
// REMOVE IN PHASE 2: delete this export and the corresponding import in app/app/_layout.tsx
export async function phase1ConnectTest() {
```

---

### IN-02: `persistQueryClient` side effect at module import time — no error surface

**File:** `app/lib/query-client.ts:29-33`

**Issue:** `persistQueryClient(...)` is called at module-load time (not inside a component lifecycle). This is the documented TanStack pattern and is intentional. However, if AsyncStorage throws during cache restoration (e.g., storage corrupted, quota exceeded), the error is silently swallowed inside `persistQueryClient`'s internals with no observable signal to the app. Phase 4+ builds offline-first behavior on this persister — a silent restoration failure could result in the app rendering stale UI while believing it has fresh data.

**Fix:** No blocking action for Phase 1. For Phase 4 hardening, add an `onSuccess`/`onError` callback to observe restoration outcomes:

```ts
persistQueryClient({
  queryClient,
  persister: asyncStoragePersister,
  maxAge: 1000 * 60 * 60 * 24,
  // Add in Phase 4:
  // onSuccess: () => { /* cache restored */ },
  // onError: (err) => { /* log or clear cache */ },
});
```

---

_Reviewed: 2026-05-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
