---
phase: 03-auth-persistent-session
plan: 02
type: execute
wave: 2
depends_on: ["03-01"]
files_modified:
  - app/app/_layout.tsx
  - app/app/(auth)/_layout.tsx
  - app/app/(auth)/sign-in.tsx
autonomous: true
requirements: [F1]
tags: [auth, expo-router, splash-screen, stack-protected, sign-in, rhf, zod]

must_haves:
  truths:
    - "Sign-in screen renders with Zod-validated email + password fields, RHF mode='onBlur'"
    - "Submitting valid sign-in calls supabase.auth.signInWithPassword and routes to (app) declaratively (no imperative router.replace)"
    - "Invalid credentials show 'Fel email eller lösen' inline under password field (generic per ASVS V2.1.4)"
    - "Cold-start native splash holds until useAuthStore.status flips from 'loading' to 'authenticated'|'anonymous'"
    - "Stack.Protected guard={!!session} routes (app) when authenticated, (auth) when anonymous"
    - "(auth) group layout renders <Stack> with headerShown:false (matches root convention)"
    - "Dark-mode classes pair correctly: bg-white↔bg-gray-900, text-gray-900↔text-gray-50, etc. (F15 convention)"
  artifacts:
    - path: "app/app/_layout.tsx"
      provides: "Root layout with module-scope SplashScreen.preventAutoHideAsync(), SplashScreenController, RootNavigator with Stack.Protected"
      contains: "SplashScreen.preventAutoHideAsync"
      contains_also: "Stack.Protected"
      min_lines: 70
    - path: "app/app/(auth)/_layout.tsx"
      provides: "Auth group layout — bare <Stack screenOptions={{ headerShown: false }} />"
      contains: "headerShown: false"
      min_lines: 6
    - path: "app/app/(auth)/sign-in.tsx"
      provides: "Sign-in screen — RHF + Zod 4 + supabase.auth.signInWithPassword + error mapping"
      contains: "signInWithPassword"
      contains_also: "zodResolver(signInSchema)"
      min_lines: 100
  key_links:
    - from: "app/app/_layout.tsx"
      to: "app/lib/auth-store.ts"
      via: "import { useAuthStore } from '@/lib/auth-store' — triggers module-scope listener"
      pattern: "from \"@/lib/auth-store\""
    - from: "app/app/_layout.tsx"
      to: "expo-splash-screen"
      via: "SplashScreen.preventAutoHideAsync() module-scope + SplashScreen.hide() in controller"
      pattern: "SplashScreen\\.preventAutoHideAsync\\(\\)"
    - from: "app/app/(auth)/sign-in.tsx"
      to: "app/lib/schemas/auth.ts"
      via: "import { signInSchema, SignInInput } from '@/lib/schemas/auth'"
      pattern: "from \"@/lib/schemas/auth\""
    - from: "app/app/(auth)/sign-in.tsx"
      to: "app/lib/supabase.ts"
      via: "supabase.auth.signInWithPassword({ email, password })"
      pattern: "supabase\\.auth\\.signInWithPassword"
---

<objective>
Wire the root authentication shell + first end-to-end auth screen. After this plan: a user with an existing account can launch the app, see no flicker (native splash holds until session resolved), see the sign-in screen, type credentials with inline Zod validation, submit, and be routed to (app) declaratively via Stack.Protected.

Purpose: This is the "user-can-sign-in" vertical slice. It exercises every load-bearing pattern (SplashScreenController, Stack.Protected, RHF + Zod 4, supabase.auth.signInWithPassword, error.code mapping, Swedish copy, dark-mode classes) without yet pulling in sign-up's confirmPassword complexity or the (app) post-login surface (Plan 03 owns those).

Output: Modified `app/app/_layout.tsx` (splash + Stack.Protected); new `app/app/(auth)/_layout.tsx`; new `app/app/(auth)/sign-in.tsx`. The sign-in screen renders, validates, and submits — but post-login lands in a "to be created in Plan 03" state. **Plan 03 must run before manual verification can confirm SC#1/3/4/5.** Plan 02 alone proves SC#2 (sign-in inline Zod errors).
</objective>

<execution_context>
@C:/Users/Mahod/Desktop/Projects/FitnessMaxxing/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Mahod/Desktop/Projects/FitnessMaxxing/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/03-auth-persistent-session/03-CONTEXT.md
@.planning/phases/03-auth-persistent-session/03-RESEARCH.md
@.planning/phases/03-auth-persistent-session/03-PATTERNS.md
@.planning/phases/03-auth-persistent-session/03-UI-SPEC.md
@.planning/phases/03-auth-persistent-session/03-01-SUMMARY.md
@CLAUDE.md
@app/app/_layout.tsx
@app/lib/auth-store.ts
@app/lib/schemas/auth.ts
@app/lib/supabase.ts

<interfaces>
<!-- Contracts established by Plan 01 that this plan consumes -->

From `app/lib/schemas/auth.ts` (Plan 01):
```typescript
export const signInSchema: z.ZodObject<{ email: z.ZodEmail; password: z.ZodString }>;
export type SignInInput = { email: string; password: string };
```

From `app/lib/auth-store.ts` (Plan 01):
```typescript
export type AuthStatus = "loading" | "authenticated" | "anonymous";
export interface AuthState {
  session: Session | null;
  status: AuthStatus;
  signOut: () => Promise<void>;
}
export const useAuthStore: UseBoundStore<StoreApi<AuthState>>;
// Importing this file registers the module-scope onAuthStateChange listener.
```

From `expo-router` (already installed v6.0.23):
```typescript
import { Stack, Redirect, useRouter } from "expo-router";
// Stack.Protected is a Stack property; takes `guard: boolean` prop and Stack.Screen children.
```

From `expo-splash-screen` (already installed v31.x):
```typescript
import * as SplashScreen from "expo-splash-screen";
SplashScreen.preventAutoHideAsync(): Promise<boolean>; // module-scope call before any render
SplashScreen.hide(): void; // synchronous; idempotent (no-op after first call)
SplashScreen.hideAsync(): Promise<boolean>; // async variant; also idempotent
```

From `react-hook-form` + `@hookform/resolvers/zod`:
```typescript
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
// useForm<SignInInput>({ resolver: zodResolver(signInSchema), mode: "onBlur", defaultValues: ... });
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Modify root layout with SplashScreen hold + Stack.Protected (`app/app/_layout.tsx`)</name>
  <files>app/app/_layout.tsx</files>
  <read_first>
    - app/app/_layout.tsx (current Phase 1 form — DO NOT regress focusManager/onlineManager listeners or StatusBar style="auto")
    - .planning/phases/03-auth-persistent-session/03-RESEARCH.md §D "Code Examples — `app/app/_layout.tsx`" (canonical modified shape — copy as base)
    - .planning/phases/03-auth-persistent-session/03-RESEARCH.md Pattern 1 (Stack.Protected) + Pattern 2 (SplashScreenController) + Pitfall §3 (preventAutoHideAsync at module scope) + Pitfall §5 (return null while status==='loading')
    - .planning/phases/03-auth-persistent-session/03-PATTERNS.md "`app/app/_layout.tsx` (MODIFIED — splash hold + Stack.Protected)" + Shared Patterns §1, §6, §7
    - .planning/phases/03-auth-persistent-session/03-CONTEXT.md D-04, D-05, D-06, D-07 (locked: preventAutoHideAsync at module scope, hide on status flip, no explicit timeout)
    - app/lib/auth-store.ts (Plan 01 output — needed to know the import path triggers listener registration)
    - CLAUDE.md ## Conventions → Navigation header & status bar (preserve `<StatusBar style="auto">` and `headerShown: false`)
  </read_first>
  <action>
Replace the contents of `app/app/_layout.tsx` with the EXACT shape below. This is RESEARCH.md §D verbatim, with project conventions applied (double quotes, side-effect imports first, blank lines between import groups per existing file).

CRITICAL: The CURRENT file at lines 17-33 has Phase 1's `focusManager.setEventListener` and `onlineManager.setEventListener` blocks. Both MUST survive intact — do NOT delete or move them. Only ADD the splash + auth-store integration around them.

EXACT new contents:

```typescript
// app/app/_layout.tsx
import "../global.css";
import { AppState, Platform } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  QueryClientProvider,
  focusManager,
  onlineManager,
} from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";

import { queryClient } from "@/lib/query-client";
// Importing useAuthStore here triggers the module-scope onAuthStateChange listener
// + getSession() init flow registered in app/lib/auth-store.ts. Order does not
// matter for correctness (listener registers exactly once on first import) but
// keeping this import near the top makes the side-effect explicit.
import { useAuthStore } from "@/lib/auth-store";

// ---- Module-level side-effects. Set once when module loads. ----

// Phase 3 D-04: hold the native splash until first session resolution. MUST be
// module scope (BEFORE any render); useEffect would fire too late and the
// splash would auto-hide before we get a chance to gate it. Per RESEARCH.md
// Pitfall §3 + docs.expo.dev/versions/latest/sdk/splash-screen.
SplashScreen.preventAutoHideAsync();

focusManager.setEventListener((setFocused) => {
  const sub = AppState.addEventListener("change", (s) => {
    if (Platform.OS !== "web") setFocused(s === "active");
  });
  return () => sub.remove();
});

onlineManager.setEventListener((setOnline) => {
  const unsubscribe = NetInfo.addEventListener((state) => {
    // NetInfo's isConnected is boolean | null; null = unknown (cold start
    // before first probe). Treat unknown as online so TanStack Query doesn't
    // mark mutations offline before we know — only an explicit `false` flips
    // us offline.
    setOnline(state.isConnected !== false);
  });
  return unsubscribe;
});

/**
 * Render-side splash hide controller. When status flips out of 'loading',
 * synchronously calls SplashScreen.hide() — idempotent (no-op after first
 * call), so Strict-Mode dual-render is safe. Per RESEARCH.md Pattern 2.
 */
function SplashScreenController() {
  const status = useAuthStore((s) => s.status);
  if (status !== "loading") {
    SplashScreen.hide();
  }
  return null;
}

/**
 * Stack.Protected gates (app) and (auth) groups by session presence.
 * While status === 'loading', renders null so the native splash continues to
 * cover the screen (RESEARCH.md Pitfall §5 — prevents the empty-navigator
 * blank flash).
 */
function RootNavigator() {
  const session = useAuthStore((s) => s.session);
  const status = useAuthStore((s) => s.status);

  if (status === "loading") return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SplashScreenController />
      <RootNavigator />
      <StatusBar style="auto" />
    </QueryClientProvider>
  );
}
```

NOTES:
- The CURRENT file's bare `<Stack screenOptions={{ headerShown: false }} />` is REPLACED by `<RootNavigator />`. The same `headerShown: false` lives inside `RootNavigator`.
- `<StatusBar style="auto" />` MUST stay (CLAUDE.md ## Conventions). Do NOT change to `"light"` or `"dark"`.
- `import "../global.css"` is the ONLY allowed relative import (Phase 1 exception per PATTERNS.md Shared Patterns §4); do not migrate to `@/global.css`.
- The blank `app/app/index.tsx` (current smoke-test) will throw a routing conflict warning AFTER this change because Stack.Protected requires children to be route groups, not bare screens. **Plan 03 deletes that file.** During the gap between Plan 02 ship and Plan 03 ship, an unauth user trying to load the app will hit `(auth)/sign-in.tsx` (which Task 2-3 below creates) and an authed user will hit `(app)/index.tsx` (created in Plan 03). The smoke-test `app/app/index.tsx` is harmless during the gap because Stack.Protected effectively shadows it; Plan 03 cleans up.
  </action>
  <verify>
    <automated>cd app &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - File `app/app/_layout.tsx` contains: `import * as SplashScreen from "expo-splash-screen";`
    - File contains: `import { useAuthStore } from "@/lib/auth-store";`
    - File contains: `SplashScreen.preventAutoHideAsync();` at module scope (verify: this string appears at column 0 / non-indented, BEFORE any `function` or `export default` keyword — i.e., grep line number for `preventAutoHideAsync` is LESS THAN line number for `function SplashScreenController`)
    - File contains: `function SplashScreenController()` (named function, not anonymous)
    - File contains: `function RootNavigator()` (named function)
    - File contains: `if (status === "loading") return null;` (Pitfall §5 mitigation)
    - File contains: `<Stack.Protected guard={!!session}>` AND `<Stack.Protected guard={!session}>` (both forms)
    - File contains: `<Stack.Screen name="(app)" />` AND `<Stack.Screen name="(auth)" />`
    - File CONTAINS `<StatusBar style="auto" />` (CLAUDE.md convention preserved)
    - File CONTAINS the existing `focusManager.setEventListener(` block (Phase 1 listener preserved)
    - File CONTAINS the existing `onlineManager.setEventListener(` block (Phase 1 listener preserved)
    - File CONTAINS `import "../global.css";` as its first non-comment import line (preserved per Phase 1 exception)
    - `cd app && npx tsc --noEmit` exits 0
    - `grep -c "preventAutoHideAsync" app/app/_layout.tsx` returns exactly `1`
    - `grep -c "Stack.Protected" app/app/_layout.tsx` returns exactly `2`
  </acceptance_criteria>
  <done>
    Root layout holds the splash at module scope, hides it via the synchronous render-side controller when auth-store status leaves 'loading', and gates (app)/(auth) declaratively via Stack.Protected. All Phase 1 listeners + StatusBar convention preserved. TS compiles clean.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create (auth) group layout (`app/app/(auth)/_layout.tsx`)</name>
  <files>app/app/(auth)/_layout.tsx</files>
  <read_first>
    - app/app/_layout.tsx (Task 1 output — to mirror the `<Stack screenOptions={{ headerShown: false }} />` shape)
    - .planning/phases/03-auth-persistent-session/03-PATTERNS.md "`app/app/(auth)/_layout.tsx`" section + Shared Pattern §6
    - .planning/phases/03-auth-persistent-session/03-CONTEXT.md (in-scope: route group `(auth)/` with empty `_layout.tsx`)
    - CLAUDE.md ## Conventions → Navigation header & status bar (header-off convention)
  </read_first>
  <action>
Create the `app/app/(auth)/` directory if it does not exist. Then create `app/app/(auth)/_layout.tsx` with EXACT contents:

```typescript
// app/app/(auth)/_layout.tsx
//
// Phase 3: route-group layout for the unauthenticated surface (sign-in, sign-up).
// Header-off matches root convention (CLAUDE.md ## Conventions → Navigation
// header & status bar) — auth screens render their own headings inline.
// Real screens that want a header opt in per-screen via <Stack.Screen options>.
import { Stack } from "expo-router";

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

That's the entire file. Five lines of code; the rest is the comment header.
  </action>
  <verify>
    <automated>cd app &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - File exists: `app/app/(auth)/_layout.tsx`
    - File contains: `import { Stack } from "expo-router";`
    - File contains: `export default function AuthLayout()`
    - File contains: `headerShown: false`
    - File does NOT import `useAuthStore` (this layout is purely structural; auth-state checks live in root or `(app)`)
    - `cd app && npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>
    Auth group layout exists; renders bare Stack with header off. No auth-state coupling at this layer (root + (app) handle it).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Create sign-in screen with RHF + Zod 4 + Supabase error mapping (`app/app/(auth)/sign-in.tsx`)</name>
  <files>app/app/(auth)/sign-in.tsx</files>
  <read_first>
    - .planning/phases/03-auth-persistent-session/03-RESEARCH.md §C "Code Examples — `app/app/(auth)/sign-up.tsx`" (CANONICAL — sign-in is the SIBLING of this; same shape, different schema + Supabase call + copy)
    - .planning/phases/03-auth-persistent-session/03-RESEARCH.md §E "Auth-error code mapping (verified canonical list)" — focus on `invalid_credentials` + `over_request_rate_limit` + `validation_failed` rows (sign-in does NOT need the duplicate-email or weak-password rows)
    - .planning/phases/03-auth-persistent-session/03-PATTERNS.md "`app/app/(auth)/sign-in.tsx` (NEW — RHF + Zod 4 form, sibling shape)" — sibling-derived shape with explicit differences from sign-up
    - .planning/phases/03-auth-persistent-session/03-UI-SPEC.md (FULL — Spacing, Typography, Color, Copywriting Contract, Visuals, Interaction Contracts, Dark Mode Verification)
    - .planning/phases/03-auth-persistent-session/03-CONTEXT.md D-13 (sign-in min(1)), D-15 (Swedish copy), D-16 (no imperative router.replace after submit)
    - .planning/phases/03-auth-persistent-session/03-RESEARCH.md Pitfall §1 (Zod 4 idiom), Pitfall §7 (NativeWind placeholder: conflict — use placeholderTextColor prop instead)
    - app/lib/schemas/auth.ts (Plan 01 — for signInSchema, SignInInput type)
    - app/lib/supabase.ts (existing — for typed supabase export)
    - CLAUDE.md First-Time-User Gotchas → "react-hook-form 7 + Zod 4 + @hookform/resolvers 5"
  </read_first>
  <behavior>
    - Test 1: Field-blur with invalid email shows "Email måste vara giltigt" inline under email field (RHF mode='onBlur')
    - Test 2: Submitting with empty password shows "Lösen krävs" inline under password field
    - Test 3: Submitting with wrong credentials → Supabase returns `error.code === 'invalid_credentials'` → UI shows "Fel email eller lösen" inline under password field (generic per ASVS V2.1.4)
    - Test 4: Submitting with `over_request_rate_limit` → banner shows "För många försök. Försök igen om en stund."
    - Test 5: Submitting with valid credentials → `supabase.auth.signInWithPassword` returns no error → onAuthStateChange fires SIGNED_IN → store flips → root Stack.Protected re-evaluates → user lands in (app) declaratively (NO imperative `router.replace` for the success path)
    - Test 6: Tapping "Inget konto? Registrera" calls `router.replace('/(auth)/sign-up')` (NOT push)
    - Test 7: Light mode renders correctly; dark mode renders correctly (every styled element has both `bg-*` / `text-*` light variant AND `dark:` variant)
  </behavior>
  <action>
Create `app/app/(auth)/sign-in.tsx`. This is the SIBLING of RESEARCH.md §C's sign-up example — same shape, different schema (signInSchema, no confirmPassword), different Supabase call (`signInWithPassword`, not `signUp`), different copy ("Logga in" / "Loggar in…"), different error code mapping (`invalid_credentials` is the dominant case; no duplicate-email or weak-password handling).

Use double-quoted strings; `@/` path alias; no relative imports beyond Plan 01 module references.

EXACT contents:

```typescript
// app/app/(auth)/sign-in.tsx
//
// Phase 3 sign-in screen — RHF + Zod 4 + supabase.auth.signInWithPassword.
//
// Locked decisions implemented:
//   D-13: signInSchema requires password.min(1) only — server is the final arbiter
//   D-15: Swedish error copy, inline
//   D-16: NO imperative router.replace on success — declarative routing via
//         Stack.Protected handles it
//   ASVS V2.1.4: invalid_credentials → generic "Fel email eller lösen" (NOT
//   distinguishing wrong-email from wrong-password)
//
// UI-SPEC.md compliance: NativeWind classes per UI-SPEC Color §60/30/10 + F15
// dark-mode pairs; touch targets ≥ 44pt via py-4 on CTA / py-3 on nav link;
// keyboardType="email-address" + autoCapitalize="none" + autoComplete="email"
// for iOS AutoFill.
//
// Pitfall §7 (NativeWind placeholder: text-color conflict): use the native
// `placeholderTextColor` prop, NOT a `placeholder:text-gray-*` class.
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
import { signInSchema, type SignInInput } from "@/lib/schemas/auth";
import { supabase } from "@/lib/supabase";

export default function SignInScreen() {
  const router = useRouter();
  const [bannerError, setBannerError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    mode: "onBlur",
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async ({ email, password }: SignInInput) => {
    setBannerError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      // Listener fires SIGNED_IN; root Stack.Protected re-evaluates; user lands
      // in (app) without an imperative router.replace (D-16).
      return;
    }
    // Map AuthApiError.code → field-level or banner error.
    // VERIFIED codes from auth-js error-codes.ts (RESEARCH.md §E table).
    switch (error.code) {
      case "invalid_credentials":
        // ASVS V2.1.4: do NOT distinguish wrong-email vs wrong-password.
        setError("password", { message: "Fel email eller lösen" });
        break;
      case "over_request_rate_limit":
        setBannerError("För många försök. Försök igen om en stund.");
        break;
      case "validation_failed":
        setBannerError("Email eller lösen ogiltigt format.");
        break;
      default:
        // Network errors (no .code), unexpected_failure, etc.
        setBannerError("Något gick fel. Försök igen.");
        console.error("[sign-in] unexpected error:", error);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 16,
            paddingVertical: 48,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-6">
            {/* Heading block */}
            <View className="gap-2">
              <Text className="text-3xl font-semibold text-gray-900 dark:text-gray-50">
                Logga in
              </Text>
            </View>

            {/* Banner error (network / rate-limit / unknown) */}
            {bannerError && (
              <Pressable onPress={() => setBannerError(null)}>
                <Text className="text-base text-red-600 dark:text-red-400">
                  {bannerError}
                </Text>
              </Pressable>
            )}

            {/* Field block */}
            <View className="gap-4">
              {/* Email field */}
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View className="gap-2">
                    <Text className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                      Email
                    </Text>
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
                      <Text className="text-base text-red-600 dark:text-red-400">
                        {errors.email.message}
                      </Text>
                    )}
                  </View>
                )}
              />

              {/* Password field */}
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View className="gap-2">
                    <Text className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                      Lösen
                    </Text>
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry
                      autoCapitalize="none"
                      autoComplete="password"
                      textContentType="password"
                      className={`w-full rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-3 text-base text-gray-900 dark:text-gray-50 border ${
                        errors.password
                          ? "border-red-600 dark:border-red-400"
                          : "border-gray-300 dark:border-gray-700"
                      } focus:border-blue-600 dark:focus:border-blue-500`}
                    />
                    {errors.password && (
                      <Text className="text-base text-red-600 dark:text-red-400">
                        {errors.password.message}
                      </Text>
                    )}
                  </View>
                )}
              />
            </View>

            {/* Primary CTA */}
            <Pressable
              onPress={handleSubmit(onSubmit)}
              disabled={isSubmitting}
              className="w-full rounded-lg bg-blue-600 dark:bg-blue-500 py-4 items-center justify-center disabled:opacity-60 active:opacity-80"
            >
              <Text className="text-base font-semibold text-white">
                {isSubmitting ? "Loggar in…" : "Logga in"}
              </Text>
            </Pressable>

            {/* Nav link to sign-up */}
            <View className="flex-row items-center justify-center mt-8 gap-1">
              <Text className="text-base text-gray-900 dark:text-gray-50">
                Inget konto?
              </Text>
              <Pressable
                onPress={() => router.replace("/(auth)/sign-up")}
                className="py-3 px-2"
              >
                <Text className="text-base font-semibold text-blue-600 dark:text-blue-400">
                  Registrera
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
```

NOTES:
- The nav-link `router.replace('/(auth)/sign-up')` is OK to call even though `(auth)/sign-up.tsx` is created in Plan 03; expo-router resolves the path at navigation time, not at module-load time. If a user taps "Registrera" before Plan 03 ships, they'll see a 404 — that's acceptable during the gap (Plan 02 ships independently for parallel work; manual verification waits for Plan 03 → Plan 04).
- The `confirmPassword` field is INTENTIONALLY ABSENT from sign-in. Sign-up (Plan 03) adds the third field.
- Dark-mode pairs verified: every `bg-*` has `dark:bg-*`; every `text-*` has `dark:text-*`; every `border-*` has `dark:border-*`. NO unpaired class.
  </action>
  <verify>
    <automated>cd app &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - File exists: `app/app/(auth)/sign-in.tsx`
    - File imports: `from "react-hook-form"` (useForm + Controller), `from "@hookform/resolvers/zod"` (zodResolver), `from "@/lib/schemas/auth"` (signInSchema + SignInInput), `from "@/lib/supabase"` (supabase)
    - File contains: `resolver: zodResolver(signInSchema)`
    - File contains: `mode: "onBlur"`
    - File contains: `supabase.auth.signInWithPassword({ email, password })`
    - File contains: `case "invalid_credentials":`
    - File contains: `setError("password", { message: "Fel email eller lösen" })`
    - File contains: `case "over_request_rate_limit":`
    - File contains: `setBannerError("För många försök. Försök igen om en stund.")`
    - File contains: `placeholderTextColor="#9CA3AF"` (Pitfall §7 — NOT `placeholder:text-gray-*`)
    - File does NOT contain `placeholder:text-gray` (Pitfall §7 verified by absence)
    - File contains the Swedish copy: "Logga in" (heading + CTA), "Loggar in…" (loading), "Email", "Lösen", "Inget konto?", "Registrera"
    - File contains: `router.replace("/(auth)/sign-up")` (NOT `router.push`)
    - Dark-mode coverage: `grep -c "dark:" app/app/(auth)/sign-in.tsx` returns ≥ 12 (every styled surface paired)
    - Light-mode pairs present: `bg-white`, `text-gray-900`, `bg-gray-100`, `border-gray-300`, `bg-blue-600`, `text-blue-600`, `text-red-600` — all 7 of these strings appear (grep)
    - File does NOT contain `<Stack.Screen` (no per-screen header opt-in; relies on (auth) group default)
    - `cd app && npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>
    Sign-in screen exists with RHF + Zod 4 + Supabase wiring; error.code mapping covers the 3 sign-in-relevant codes plus default banner; Swedish copy matches UI-SPEC; dark-mode pairs verified; no NativeWind Pitfall §7 violation; declarative success routing per D-16.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Splash → first React render | Native iOS splash hides only after `useAuthStore.status !== 'loading'`; if hide fires too early, user sees a blank flash (T-03-08 mitigation) |
| RHF form → Supabase API | All submitted credentials cross from form state to `supabase.auth.signInWithPassword`; Zod schema is the first-tier validator (V5) |
| Stack.Protected guard | Declarative route gate evaluates `!!session`; defense-in-depth via `(app)/_layout.tsx` Redirect (added in Plan 03) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-03-08 | DoS | Splash hide before status flip → blank-screen flicker on cold start | mitigate | `RootNavigator` returns `null` while `status === 'loading'` (Pitfall §5); `SplashScreenController` hides splash only when status leaves loading. Verified manually in Plan 04 (cold-start flash test). |
| T-03-09 | Information Disclosure | Sign-in error message reveals which field is wrong (email-vs-password) | mitigate | ASVS V2.1.4 — `invalid_credentials` → generic "Fel email eller lösen" under password field. Does NOT distinguish wrong-email from wrong-password. RESEARCH.md §E table verified. |
| T-03-10 | Spoofing | Brute-force credential stuffing via repeated sign-in submits | transfer | Supabase platform rate-limit returns `over_request_rate_limit` (RESEARCH.md §E). Client UI maps to "För många försök. Försök igen om en stund." Client-side rate-limit deferred to V1.1 per CLAUDE.md ## Conventions → Security → Out-of-scope. |
| T-03-11 | Information Disclosure | Console error logs may leak credentials | mitigate | `console.error("[sign-in] unexpected error:", error)` logs ONLY the error object (not email, not password). Verified by grep: no `console.log(password)` or `console.log(email)` or `console.log(session)` in sign-in.tsx. |
| T-03-12 | Tampering | XSS / RCE via TextInput value reaching SQL | mitigate | Zod schema validates email format + non-empty password BEFORE any Supabase call. Supabase Auth (GoTrue) treats credentials as opaque — no SQL composition with user input on the client side. |
| T-03-13 | Spoofing | Stack.Protected guard bypass via timing race | mitigate | `RootNavigator` returns `null` until status leaves 'loading' (no protected screen mounts during the race window). Defense-in-depth: `(app)/_layout.tsx` Redirect (Plan 03) catches any frame where root guard is stale. |

**No HIGH-severity unmitigated threats.** Plan 02 covers the splash + Stack.Protected + sign-in surfaces; Plans 03 (sign-up + (app) group) and 04 (manual verification) close the remaining UI threats.
</threat_model>

<verification>
- `cd app && npx tsc --noEmit` exits 0 (TS clean across modified + new files)
- `cd app && npm run test:auth-schemas` exits 0 (Plan 01 schemas not regressed)
- `cd app && npm run test:rls` exits 0 (Phase 2 RLS regression intact)
- `grep -E "service_role|SERVICE_ROLE" app/app/_layout.tsx app/app/\(auth\)/_layout.tsx app/app/\(auth\)/sign-in.tsx` returns zero matches (security audit)
- `grep -c "Stack.Protected" app/app/_layout.tsx` returns exactly `2` (one for (app), one for (auth))
- `grep -c "preventAutoHideAsync" app/app/_layout.tsx` returns exactly `1` (module scope)
- `grep -c "useAuthStore" app/app/_layout.tsx` returns ≥ `3` (one import + two selector calls in components)
- `grep -c "signInWithPassword" app/app/\(auth\)/sign-in.tsx` returns exactly `1`
- `grep -E '\bpassword\s*:\s*"[^"]+"' app/app/\(auth\)/sign-in.tsx` returns zero matches (no hardcoded password — credentials come from form state only)
</verification>

<success_criteria>
- [ ] Root layout modified: SplashScreen.preventAutoHideAsync() at module scope; SplashScreenController + RootNavigator components; Stack.Protected for (app) and (auth)
- [ ] Phase 1 listeners (focusManager + onlineManager) preserved intact
- [ ] StatusBar style="auto" preserved
- [ ] (auth) group layout exists with bare `<Stack screenOptions={{ headerShown: false }} />`
- [ ] Sign-in screen exists with RHF + Zod + supabase.auth.signInWithPassword + error.code mapping (invalid_credentials, over_request_rate_limit, validation_failed, default)
- [ ] Sign-in screen uses `placeholderTextColor` prop (Pitfall §7 mitigation), not `placeholder:text-gray` class
- [ ] Sign-in screen routes "Registrera" via `router.replace('/(auth)/sign-up')` (no push)
- [ ] All dark-mode class pairs present (≥12 `dark:` matches in sign-in.tsx)
- [ ] TS compiles clean; no security regression (no service-role leak)
</success_criteria>

<output>
After completion, create `.planning/phases/03-auth-persistent-session/03-02-SUMMARY.md` documenting:
- Files modified (1) + files created (2)
- Splash hold + Stack.Protected pattern verified by grep
- Sign-in error.code mapping covered: invalid_credentials, over_request_rate_limit, validation_failed, default
- Open notes for Plan 03: (a) `(auth)/sign-up.tsx` is referenced by sign-in's nav link — must exist when manual verification runs, (b) `(app)/_layout.tsx` + `(app)/index.tsx` complete the Stack.Protected `(app)` branch
- Dark-mode pair count + UI-SPEC compliance check
</output>
