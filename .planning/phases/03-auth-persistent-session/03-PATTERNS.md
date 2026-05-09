# Phase 3: Auth & Persistent Session - Pattern Map

**Mapped:** 2026-05-09
**Files analyzed:** 9 (7 NEW + 2 MODIFIED)
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/lib/auth-store.ts` (NEW) | store + module-side-effect | event-driven (subscribes to Supabase auth events) | `app/lib/supabase.ts` (module-scope side-effect listener) + `app/lib/query-client.ts` (module-scope singleton + persister) | role-match — best analog for "module-scope singleton + listener registered once" exists in same dir |
| `app/lib/schemas/auth.ts` (NEW) | validation schema (pure data) | transform | none in repo (no Zod schema files exist yet) | NO ANALOG — use RESEARCH.md §B as canonical pattern |
| `app/app/_layout.tsx` (MODIFIED) | route layout (root) | request-response (provides QueryClientProvider tree) | self (Phase 1 form, lines 1-42) | exact (it IS the file being modified) |
| `app/app/(auth)/_layout.tsx` (NEW) | route layout (group) | none — pure structural | `app/app/_layout.tsx` lines 35-42 (Stack render pattern with `headerShown:false`) | role-match — Stack-with-no-header subset of root |
| `app/app/(auth)/sign-up.tsx` (NEW) | screen (form) | request-response | none directly (current `index.tsx` is a placeholder; no form exists yet) | NO ANALOG — use RESEARCH.md §C + UI-SPEC.md as canonical |
| `app/app/(auth)/sign-in.tsx` (NEW) | screen (form) | request-response | sign-up.tsx (sibling, simpler shape) + RESEARCH.md §C | sibling-derived |
| `app/app/(app)/_layout.tsx` (NEW) | route layout (guarded group) | request-response (reads store, conditionally redirects) | `app/app/_layout.tsx` (root pattern) + RESEARCH.md §"Pattern 4" | role-match — Stack render with conditional `<Redirect>` |
| `app/app/(app)/index.tsx` (NEW) | screen (placeholder) | request-response | `app/app/index.tsx` lines 1-11 (current smoke-test) | exact — it's a direct successor (with sign-out button added) |
| `app/app/index.tsx` (MODIFIED → DELETED or moved into `(app)/`) | route screen | n/a | self | exact (file is being relocated/deleted) |

## Pattern Assignments

### `app/lib/auth-store.ts` (NEW — Zustand store + module-level Supabase listener)

**Primary analogs:** `app/lib/supabase.ts` (module-side-effect listener pattern) + `app/lib/query-client.ts` (module-scope singleton pattern).

**Imports pattern** (mirror `app/lib/supabase.ts` lines 8-14, `app/lib/query-client.ts` lines 6-9):
```typescript
// Use double-quoted strings (project convention — both supabase.ts and query-client.ts use ").
// Use the `@/` path alias for cross-folder imports (tsconfig.json paths: { "@/*": ["./*"] }).
import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/query-client";
```

**Module-scope singleton + side-effect pattern** (copy from `app/lib/supabase.ts` lines 73-87 — the `export const supabase = createClient(...)` followed by an `AppState.addEventListener` registered at module scope is the canonical "make singleton, then register listener" shape):
```typescript
// app/lib/supabase.ts:73-87 — reference shape
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: { storage: new LargeSecureStore(), autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

// Module-scope listener — registers once per JS bundle load.
AppState.addEventListener("change", (state) => {
  if (Platform.OS === "web") return;
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
```

**Apply to `auth-store.ts`** (per RESEARCH.md §A — listener after store-create, callback strictly synchronous):
```typescript
export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  status: "loading",
  signOut: async () => {
    queryClient.clear();
    const { error } = await supabase.auth.signOut();
    if (error) {
      set({ session: null, status: "anonymous" });
      console.warn("[auth-store] signOut error:", error.message);
    }
  },
}));

// Module-scope listener — mirrors app/lib/supabase.ts:83-87 module-scope pattern.
// Callback MUST stay synchronous (no awaits) — see "Shared Patterns" §3 below.
supabase.auth.onAuthStateChange((event, session) => {
  useAuthStore.setState({
    session,
    status: session ? "authenticated" : "anonymous",
  });
});
```

**Persister bootstrap pattern** (`app/lib/query-client.ts` lines 11-33) shows how a singleton with a side-effect-bootstrap (here `persistQueryClient(...)` call) is structured at module scope — exactly the same shape `auth-store.ts` uses for its `onAuthStateChange` registration.

---

### `app/lib/schemas/auth.ts` (NEW — Zod 4 schemas)

**Analog:** No Zod schema file currently exists in the repo. RESEARCH.md §B is the canonical excerpt; planner should copy verbatim.

**Reference excerpt from RESEARCH.md §B** (Zod v4 idiom: `z.email()` top-level, `error:` not `message:`, `.refine` with `path: ['confirmPassword']`):
```typescript
import { z } from "zod";

export const signUpSchema = z
  .object({
    email: z.email({ error: "Email måste vara giltigt" }),
    password: z.string().min(12, { error: "Minst 12 tecken" }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Lösen matchar inte",
    path: ["confirmPassword"],
  });

export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.email({ error: "Email måste vara giltigt" }),
  password: z.string().min(1, { error: "Lösen krävs" }),
});

export type SignInInput = z.infer<typeof signInSchema>;
```

**Import-style match:** existing `app/lib/*.ts` files use double-quoted strings and named imports. New file follows same convention.

**Path-alias convention:** `app/types/database.ts` is imported elsewhere as `@/types/database` (see `app/lib/supabase.ts:13`). Phase 3 form screens import schemas as `@/lib/schemas/auth`.

---

### `app/app/_layout.tsx` (MODIFIED — splash hold + Stack.Protected)

**Existing structure to preserve** (current file lines 1-42 — DO NOT regress these patterns):

Imports + module-scope listeners (lines 1-33):
```typescript
// app/app/_layout.tsx:1-33
import "../global.css";
import { AppState, Platform } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  QueryClientProvider,
  focusManager,
  onlineManager,
} from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";

import { queryClient } from "@/lib/query-client";

// ---- Module-level listeners (Recipe §B). Set once when module loads. ----

focusManager.setEventListener((setFocused) => {
  const sub = AppState.addEventListener("change", (s) => {
    if (Platform.OS !== "web") setFocused(s === "active");
  });
  return () => sub.remove();
});

onlineManager.setEventListener((setOnline) => {
  const unsubscribe = NetInfo.addEventListener((state) => {
    setOnline(state.isConnected !== false);
  });
  return unsubscribe;
});
```

Default export (lines 35-42):
```typescript
export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </QueryClientProvider>
  );
}
```

**Modifications to apply** (per CONTEXT.md D-04/D-05 + RESEARCH.md Pattern 2):
1. **Add module-scope splash hold** — colocate with existing module-scope listeners (lines 15-33 region). Pattern to follow: existing file already has two module-scope `setEventListener` calls; the splash-prevent call belongs in the same block. Reference sequence from RESEARCH.md §D:
   ```typescript
   import * as SplashScreen from "expo-splash-screen";
   // ... other imports ...
   import { useAuthStore } from "@/lib/auth-store"; // importing this triggers module-level listener registration

   SplashScreen.preventAutoHideAsync(); // module scope, BEFORE export default
   ```
2. **Add `<SplashScreenController>` + `<RootNavigator>` components** inside the `QueryClientProvider` tree, replacing the bare `<Stack screenOptions={{ headerShown: false }} />` with a navigator that gates `(app)`/`(auth)` via `Stack.Protected`.

**StatusBar convention preserved** (line 39): `<StatusBar style="auto" />` stays untouched per CLAUDE.md ## Conventions Navigation header & status bar.

---

### `app/app/(auth)/_layout.tsx` (NEW — auth group layout)

**Analog:** `app/app/_layout.tsx` lines 38 (the `<Stack screenOptions={{ headerShown: false }} />` shape).

**Pattern to copy:**
```typescript
// app/app/_layout.tsx:38 — exact shape to mirror
<Stack screenOptions={{ headerShown: false }} />
```

**Apply:**
```typescript
// app/app/(auth)/_layout.tsx
import { Stack } from "expo-router";

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

**Convention basis:** CLAUDE.md ## Conventions → Navigation header & status bar — root uses `headerShown: false`; `(auth)` group inherits the same convention. No header for sign-up/sign-in screens; in-screen nav links handle navigation.

---

### `app/app/(auth)/sign-up.tsx` (NEW — RHF + Zod 4 form)

**Analog:** None in repo (no form screens exist yet). Use RESEARCH.md §C as canonical (already verified by ui-checker against UI-SPEC.md).

**Imports pattern** (project conventions: double-quoted strings; `@/`-alias for cross-folder; named imports; `@/lib/...` for shared modules):
```typescript
import { useState } from "react";
import {
  Text,
  TextInput,
  View,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signUpSchema, type SignUpInput } from "@/lib/schemas/auth";
import { supabase } from "@/lib/supabase";
```

**NativeWind dark-mode class convention** (mirrors current `app/app/index.tsx:5` — `bg-white dark:bg-gray-900`):
```typescript
// app/app/index.tsx:4-9 — reference for dark-mode class pairing
<View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
  <Text className="text-2xl text-blue-500 dark:text-blue-300">
    Hello FitnessMaxxing
  </Text>
</View>
```

**Apply** (per UI-SPEC.md "Visuals — Screen container" + RESEARCH.md §C):
- Outer container: `<SafeAreaView className="flex-1 bg-white dark:bg-gray-900">` — dark-mode pair matches existing `index.tsx` convention.
- Wrap fields in `<KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>`.
- ScrollView content: `contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingVertical: 48 }}` + `keyboardShouldPersistTaps="handled"`.

**RHF + Zod resolver pattern** (per UI-SPEC.md interaction-contract + RESEARCH.md §C):
```typescript
const {
  control,
  handleSubmit,
  setError,
  formState: { errors, isSubmitting },
} = useForm<SignUpInput>({
  resolver: zodResolver(signUpSchema),
  mode: "onBlur",
  defaultValues: { email: "", password: "", confirmPassword: "" },
});
```

**Supabase error mapping pattern** (per RESEARCH.md §C lines 643-676 — verified `error.code` matches from auth-js error-codes.ts):
```typescript
const onSubmit = async ({ email, password }: SignUpInput) => {
  setBannerError(null);
  const { error } = await supabase.auth.signUp({ email, password });
  if (!error) return; // Listener fires SIGNED_IN; Stack.Protected navigates declaratively.
  switch (error.code) {
    case "user_already_exists":
    case "email_exists":
      setError("email", { message: "Detta email är redan registrerat — försök logga in" });
      break;
    case "weak_password":
      setError("password", { message: "Lösen för svagt — minst 12 tecken" });
      break;
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      setBannerError("För många försök. Försök igen om en stund.");
      break;
    case "signup_disabled":
      setBannerError("Registrering är tillfälligt avstängd.");
      break;
    case "validation_failed":
      setBannerError("Email eller lösen ogiltigt format.");
      break;
    default:
      setBannerError("Något gick fel. Försök igen.");
      console.error("[sign-up] unexpected error:", error);
  }
};
```

**Controller pattern for TextInput** (per RESEARCH.md §C lines 701-723 — RHF `register()` doesn't pair with React Native TextInput; use `<Controller>`):
```typescript
<Controller
  control={control}
  name="email"
  render={({ field: { onChange, onBlur, value } }) => (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-gray-900 dark:text-gray-50">Email</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        onBlur={onBlur}
        placeholder="du@example.com"
        placeholderTextColor="#9CA3AF"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        className={`w-full rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-3 text-base text-gray-900 dark:text-gray-50 border ${
          errors.email
            ? "border-red-600 dark:border-red-400"
            : "border-gray-300 dark:border-gray-700"
        } focus:border-blue-600 dark:focus:border-blue-500`}
      />
      {errors.email && (
        <Text className="text-base text-red-600 dark:text-red-400">{errors.email.message}</Text>
      )}
    </View>
  )}
/>
```

**Critical NativeWind 4 deviation** (per RESEARCH.md Pitfall §7): use `placeholderTextColor="#9CA3AF"` prop instead of `placeholder:text-gray-500` class — `placeholder:` variant has known conflicts with `text-` color in NativeWind 4.

---

### `app/app/(auth)/sign-in.tsx` (NEW — RHF + Zod 4 form, sibling shape)

**Analog:** Sibling `sign-up.tsx` (same imports, same form shape, fewer fields).

**Differences from sign-up.tsx:**
1. Schema: `signInSchema` (no `confirmPassword`, no `min(12)` — see CONTEXT.md D-13).
2. Heading copy: `"Logga in"` (per UI-SPEC.md Form-level copy).
3. CTA copy: `"Logga in"` / loading: `"Loggar in…"`.
4. Supabase call: `supabase.auth.signInWithPassword({ email, password })` (not `signUp`).
5. Error mapping (per RESEARCH.md — `invalid_credentials` is the dominant case):
   ```typescript
   case "invalid_credentials":
     setError("password", { message: "Fel email eller lösen" }); // generic per ASVS V2.1.4
     break;
   ```
6. Nav link copy: `"Inget konto? Registrera"` → `router.replace("/(auth)/sign-up")` (replace, not push, per UI-SPEC.md interaction contract).
7. Password autoComplete: `"password"` not `"new-password"`; textContentType: `"password"` not `"newPassword"`.

All other patterns (KeyboardAvoidingView, ScrollView, Controller-per-field, banner error state, dark-mode classes) are identical to sign-up.tsx.

---

### `app/app/(app)/_layout.tsx` (NEW — guarded group layout)

**Analog:** `app/app/_layout.tsx` lines 35-42 (root render shape) + RESEARCH.md Pattern 4.

**Pattern to apply** (defense-in-depth — even with root `Stack.Protected`, group layout also guards):
```typescript
// app/app/(app)/_layout.tsx
import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "@/lib/auth-store";

export default function AppLayout() {
  const session = useAuthStore((s) => s.session);
  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

**Selector pattern** (per CONTEXT.md D-10 + Zustand v5 useSyncExternalStore convention): `useAuthStore((s) => s.session)` — narrow selector limits re-renders to session changes only.

**`headerShown: false` convention** (matches root `_layout.tsx:38`): screens inside `(app)` opt headers in per-screen via `<Stack.Screen options={{ headerShown: true, ... }} />` per CLAUDE.md ## Conventions.

---

### `app/app/(app)/index.tsx` (NEW — placeholder post-login surface)

**Analog:** Current `app/app/index.tsx` lines 1-11 (Phase 1 smoke-test form, exact pattern).

**Reference excerpt** (`app/app/index.tsx:1-11`):
```typescript
import { Text, View } from "react-native";

export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
      <Text className="text-2xl text-blue-500 dark:text-blue-300">
        Hello FitnessMaxxing
      </Text>
    </View>
  );
}
```

**Apply** (extend with email greeting + sign-out button per UI-SPEC.md "Empty state" → temporary `(app)/index.tsx` copy):
```typescript
import { Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@/lib/auth-store";

export default function AppHome() {
  const email = useAuthStore((s) => s.session?.user.email);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-1 items-center justify-center gap-6 px-4">
        <Text className="text-3xl font-semibold text-gray-900 dark:text-gray-50">
          FitnessMaxxing
        </Text>
        <Text className="text-base text-gray-900 dark:text-gray-50">
          Inloggad som {email ?? "(okänt)"}
        </Text>
        <Text className="text-base text-gray-500 dark:text-gray-400">
          Plan-skapande kommer i nästa fas.
        </Text>
        <Pressable
          onPress={signOut}
          className="w-full rounded-lg bg-blue-600 dark:bg-blue-500 py-4 items-center justify-center active:opacity-80"
        >
          <Text className="text-base font-semibold text-white">Logga ut</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
```

**Conventions inherited:**
- Dark-mode class pairs: `bg-white dark:bg-gray-900`, `text-gray-900 dark:text-gray-50`, `text-gray-500 dark:text-gray-400`, `bg-blue-600 dark:bg-blue-500` — all per UI-SPEC.md Color §60/30/10 + Phase 1 F15 convention.
- Selector usage: separate selectors for `email` and `signOut` (per CONTEXT.md D-10) — limits re-renders to relevant slices.
- Sign-out triggers store action (no imperative `router.replace` — guard handles re-navigation per CONTEXT.md D-16).

---

### `app/app/index.tsx` (MODIFIED — moved or deleted)

**Analog:** self.

**Two options per CONTEXT.md "Claude's Discretion" #6:**
1. **Delete** (planner-recommended if keeping `(tabs)` deferred to Phase 4) — remove the file entirely; root `_layout.tsx`'s `Stack.Protected` will route to either `(auth)/sign-in` or `(app)/index` based on session.
2. **Move** — rename to `app/app/(app)/index.tsx` (which is exactly what `(app)/index.tsx` above does — same file body extended).

Either way, the Phase 1 smoke-test text `"Hello FitnessMaxxing"` is replaced by the `(app)/index.tsx` placeholder above. No content from the current file survives in its old location.

---

## Shared Patterns

### 1. Module-scope singleton + side-effect (apply to: `auth-store.ts`, `_layout.tsx`)

**Source:** `app/lib/supabase.ts:73-87` (export singleton, then register listener at module scope) + `app/lib/query-client.ts:11-33` (same shape with persister bootstrap) + `app/app/_layout.tsx:15-33` (two `setEventListener` calls before `export default`).

**Apply:** Module-scope side-effects (listener registration, splash-hold, persister setup) belong BEFORE the `export default`. Never inside `useEffect`. Bundler import-cache guarantees one-time execution per JS bundle, which is Strict-Mode safe (RESEARCH.md Pitfall §4).

**Excerpt — `app/lib/supabase.ts:82-87`:**
```typescript
// Foreground/background handling — auto-refresh bara när appen är aktiv (per Recipe §A).
AppState.addEventListener("change", (state) => {
  if (Platform.OS === "web") return;
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
```

### 2. Runtime env-guard (no new env-vars introduced in Phase 3, but pattern is referenced)

**Source:** `app/lib/supabase.ts:17-25`:
```typescript
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars. Skapa app/.env.local med " +
      "EXPO_PUBLIC_SUPABASE_URL och EXPO_PUBLIC_SUPABASE_ANON_KEY (se app/.env.example).",
  );
}
```

**Apply:** Phase 3 adds NO new env-vars (per CONTEXT.md `<canonical_refs>` "Source-of-truth diff target") — this pattern is already wired and is referenced only as the convention for if any new env-var was added. No new code required.

### 3. Synchronous-only Supabase listener callback (apply to: `auth-store.ts`)

**Source:** RESEARCH.md Pitfall §2 — auth-js issues #762, #2013 — awaiting any Supabase call inside `onAuthStateChange` causes a `_acquireLock` deadlock that hangs the entire app's Supabase layer.

**Rule:** The `onAuthStateChange` callback in `auth-store.ts` MUST be a synchronous function. Only `useAuthStore.setState({...})` (pure JS) is allowed. Any follow-up work (e.g., `queryClient.clear()`) lives in the user-facing `signOut` action in the store, NOT in the listener.

**Wrong:**
```typescript
supabase.auth.onAuthStateChange(async (event, session) => {
  await queryClient.clear();         // ⛔ deadlock risk
  await supabase.auth.getSession();  // ⛔ deadlock guaranteed
});
```

**Right:**
```typescript
supabase.auth.onAuthStateChange((event, session) => {
  useAuthStore.setState({ session, status: session ? "authenticated" : "anonymous" });
});
```

### 4. Path-alias `@/*` for cross-folder imports (apply to: ALL Phase 3 files)

**Source:** `app/tsconfig.json:5-9`:
```json
"paths": {
  "@/*": ["./*"]
}
```

**Apply:** Every Phase 3 import that crosses folder boundaries uses `@/...`, never relative `../`:
- `@/lib/supabase` (from any screen importing supabase)
- `@/lib/query-client` (from auth-store.ts)
- `@/lib/auth-store` (from layouts and screens)
- `@/lib/schemas/auth` (from sign-up.tsx, sign-in.tsx)
- `@/types/database` (already used in `app/lib/supabase.ts:13` — no Phase 3 file needs this directly)

The only `import "../global.css"` (relative) is the Phase 1 root-layout exception — leave it as is per `app/app/_layout.tsx:2`.

### 5. NativeWind dark-mode class-pair convention (apply to: ALL screens + `(app)/index.tsx`)

**Source:** `app/app/index.tsx:5-7`:
```typescript
<View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
  <Text className="text-2xl text-blue-500 dark:text-blue-300">
    Hello FitnessMaxxing
```

**Apply:** Every backgrounded surface in Phase 3 must declare both light and dark variants per F15 Phase 1 convention. Class pairs to use (per UI-SPEC.md Color table):
- Background: `bg-white dark:bg-gray-900`
- Body text: `text-gray-900 dark:text-gray-50`
- Field bg: `bg-gray-100 dark:bg-gray-800`
- Field default border: `border-gray-300 dark:border-gray-700`
- Field focus border: `border-blue-600 dark:border-blue-500`
- Field error border: `border-red-600 dark:border-red-400`
- Primary CTA bg: `bg-blue-600 dark:bg-blue-500`
- Link/accent text: `text-blue-600 dark:text-blue-400`
- Error text: `text-red-600 dark:text-red-400`
- Muted text: `text-gray-500 dark:text-gray-400`

`tailwind.config.js` is `darkMode: "class"` (line 9) — NativeWind handles the system-theme → class-toggle wiring automatically.

### 6. `headerShown: false` on `<Stack>` (apply to: root `_layout.tsx`, `(auth)/_layout.tsx`, `(app)/_layout.tsx`)

**Source:** `app/app/_layout.tsx:38` + CLAUDE.md ## Conventions → "Navigation header & status bar".

**Apply:** Every `<Stack>` rendered in Phase 3 layouts uses `screenOptions={{ headerShown: false }}`. Real screens that want a header opt in per-screen via `<Stack.Screen options={{ headerShown: true, ... }} />`. Phase 3 has no per-screen header opt-ins.

### 7. StatusBar `style="auto"` (UNCHANGED — pattern preserved)

**Source:** `app/app/_layout.tsx:39`:
```typescript
<StatusBar style="auto" />
```

**Apply:** Phase 3 modification of `_layout.tsx` MUST preserve `<StatusBar style="auto" />` exactly. Per CLAUDE.md ## Conventions, `auto` flips status-bar icon color with system theme so icons contrast against `bg-white` (light) and `bg-gray-900` (dark). Switching to `"light"` or `"dark"` would invert this and break F15 dark-mode coverage.

### 8. Zustand selector usage (apply to: ALL files reading from `auth-store`)

**Source:** CONTEXT.md D-10 + RESEARCH.md "Standard Stack" — Zustand v5 delegates to React's native `useSyncExternalStore`; narrow selectors limit re-renders.

**Apply:**
```typescript
const session = useAuthStore((s) => s.session);            // route layouts
const status = useAuthStore((s) => s.status);              // RootLayout / SplashScreenController
const email = useAuthStore((s) => s.session?.user.email);  // (app)/index.tsx greeting
const signOut = useAuthStore((s) => s.signOut);            // (app)/index.tsx button
```

Never `const state = useAuthStore()` — that re-renders on every store change.

### 9. Quote convention + import ordering

**Source:** `app/lib/supabase.ts:8-14`, `app/lib/query-client.ts:6-9`, `app/app/_layout.tsx:1-13` — all use:
- Double-quoted strings (`"react-native"`, not `'react-native'`)
- Side-effect imports first (e.g., `import "react-native-get-random-values"`, `import "../global.css"`)
- Then named imports from third-party
- Then named imports from `@/...`
- TypeScript `import type { ... }` on its own line where applicable

**Apply:** Every new Phase 3 file follows this ordering exactly. Mismatched quotes will produce ESLint diffs (`expo lint` is wired per CLAUDE.md Development tools).

---

## No Analog Found

| File | Role | Data Flow | Reason | Canonical Source |
|------|------|-----------|--------|------------------|
| `app/lib/schemas/auth.ts` | validation schema | transform | No Zod schema files exist yet in repo (Phase 1 + 2 had no form validation). | RESEARCH.md §B (Zod 4 idiom verified against Context7 zod v4 changelog) |
| `app/app/(auth)/sign-up.tsx` | screen (form) | request-response | No form screens exist yet (current `index.tsx` is a placeholder Text component). | RESEARCH.md §C + UI-SPEC.md (already verified by ui-checker 2026-05-09) |
| `app/app/(auth)/sign-in.tsx` | screen (form) | request-response | Same as above — first form screens in the repo. | Sibling `sign-up.tsx` + RESEARCH.md `signInWithPassword` notes |

For all three "no analog" files, the planner should treat RESEARCH.md + UI-SPEC.md as the canonical source rather than searching for closer analogs (none exist).

---

## Notes (special concerns flagged by orchestrator)

### Module-scope side-effect side-channels

The `onAuthStateChange` listener registration in `auth-store.ts` MUST mirror the AppState listener pattern in `app/lib/supabase.ts:83-87` (module scope, single registration per bundle load). Bundler import-cache guarantees one-time execution; React Strict Mode dual-mount cannot duplicate it.

**Cross-file ordering:** When `app/app/_layout.tsx` does `import { useAuthStore } from "@/lib/auth-store"`, that import is what triggers the module-scope `onAuthStateChange` registration. The order of imports in `_layout.tsx` does not matter for correctness (listener registers exactly once on first import regardless of position), but for readability the auth-store import is recommended near the top of the import block.

### React Strict Mode safety for SplashScreen.hideAsync()

The `<SplashScreenController>` pattern (RESEARCH.md Pattern 2) calls `SplashScreen.hide()` synchronously in render when `status !== "loading"`. This is idempotent by virtue of the SplashScreen native module's own internal state — calling `hide()` multiple times is a no-op after the first call. Strict Mode dual-render is therefore safe. If using a `useEffect` variant instead, it MUST be idempotent for the same reason; `hideAsync()` is also a no-op after first call, so an `if (status !== "loading") SplashScreen.hideAsync()` inside a `useEffect` on `[status]` is also safe.

### Path alias `@/*` is wired and verified

`app/tsconfig.json:5-9` defines `"paths": { "@/*": ["./*"] }`. All existing files use it (`app/lib/supabase.ts:13` → `@/types/database`; current `_layout.tsx` → `@/lib/query-client`). Phase 3 imports MUST use `@/lib/...` and `@/lib/schemas/...`, never `../lib/...`. The only relative-import exception is `import "../global.css"` at `app/app/_layout.tsx:2` which must remain.

### NativeWind dark-mode pre-existing convention

The current `app/app/index.tsx:5-7` smoke-test uses `bg-white dark:bg-gray-900` and `text-blue-500 dark:text-blue-300`. Phase 3 form screens MUST follow the same convention end-to-end (every styled element declares both variants). The full class-pair palette is enumerated in "Shared Patterns §5" above and matches UI-SPEC.md Color §60/30/10.

### Phase 1 smoke-test handoff (data-flow note for planner)

`app/app/index.tsx` (current Phase 1 smoke-test) is the analog for `(app)/index.tsx` because it's the same role (screen) but is being relocated. CONTEXT.md D-09 + "Claude's Discretion" #6 leaves the choice to the planner:
- **Option A — Delete `app/app/index.tsx`** entirely; create `(app)/index.tsx` from scratch using the smoke-test as a styling reference. Cleaner end state.
- **Option B — Move `app/app/index.tsx` → `app/app/(app)/index.tsx`** as a single git-rename, then extend with email greeting + sign-out button. Preserves git-blame.

Either option is correct. The planner should pick based on whether they want the relocation visible as a rename in the diff (Option B) or as a delete + create (Option A). The expanded body in this PATTERNS.md is the same regardless.

### Security convention reminders for the planner (from CLAUDE.md ## Conventions → Security)

- **API2 / V2 / M3 — Sessions in `LargeSecureStore`:** Phase 1 wired this in `app/lib/supabase.ts:73-80`. Phase 3 adds NO new code touching session storage; it only consumes `supabase.auth.*` events.
- **API1 / V4 — RLS:** Not exercised in Phase 3 (no `.from()` queries — `(app)/index.tsx` placeholder reads only from the auth-store, not from any user-scoped table). Phase 4 will be the first phase to exercise RLS with `(select auth.uid())`.
- **API2 — V2.1.1 password ≥ 12 chars:** Enforced by `signUpSchema.password.min(12)` in `app/lib/schemas/auth.ts` (CONTEXT.md D-12). Sign-in does NOT enforce this (D-13) — server is the final arbiter to allow legacy/rotated passwords.
- **M4 — Anti-phishing for deep-links:** N/A in Phase 3 (D-02 defers email-confirm deep-link to V1.1; no `app.json scheme` is set).
- **No service-role key in any Phase 3 file:** Confirmed — Phase 3 files import only `@/lib/supabase` (which uses anon key) and never reference `SUPABASE_SERVICE_ROLE_KEY`. The audit gate `git grep "service_role\|SERVICE_ROLE"` should continue to match only `app/scripts/test-rls.ts`, `app/.env.example`, `.planning/`, and `CLAUDE.md`.

### Files NOT to modify

- `app/lib/supabase.ts` — Phase 1+2 final form. Phase 3 imports it; Phase 3 does not touch it. (CONTEXT.md `<canonical_refs>` "Source-of-truth diff target".)
- `app/lib/query-client.ts` — Phase 1 final form. Phase 3 imports `queryClient` for `clear()`; Phase 3 does not touch it.
- `app/types/database.ts` — Phase 2 generated. Hand-editing forbidden per CLAUDE.md ## Conventions → Database conventions.
- `app/tailwind.config.js`, `app/global.css` — established Phase 1; no changes for Phase 3.
- `app/scripts/test-rls.ts`, `app/scripts/verify-deploy.ts` — Phase 2 verification; no auth-flow changes needed (RLS test already creates users via service-role-admin).

---

## Metadata

**Analog search scope:** `app/lib/`, `app/app/`, `app/types/`, `app/scripts/`
**Files scanned:** 11 (`supabase.ts`, `query-client.ts`, `app/_layout.tsx`, `app/index.tsx`, `tsconfig.json`, `tailwind.config.js`, `global.css`, `database.ts`, `package.json` excerpt, `app.json` excerpt, `test-rls.ts` head)
**Pattern extraction date:** 2026-05-09
**Special inputs:** RESEARCH.md §A–§D code excerpts (canonical for files with no in-repo analog); UI-SPEC.md (verified contract for form layout, copy, color, typography, spacing); CONTEXT.md D-01 through D-17 (locked decisions).

## PATTERN MAPPING COMPLETE
