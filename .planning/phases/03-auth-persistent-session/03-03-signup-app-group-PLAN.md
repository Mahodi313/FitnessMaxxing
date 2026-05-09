---
phase: 03-auth-persistent-session
plan: 03
type: execute
wave: 3
depends_on: ["03-01", "03-02"]
files_modified:
  - app/app/(auth)/sign-up.tsx
  - app/app/(app)/_layout.tsx
  - app/app/(app)/index.tsx
  - app/app/index.tsx
autonomous: true
requirements: [F1]
tags: [auth, sign-up, app-group, redirect, sign-out, rhf, zod]

must_haves:
  truths:
    - "Sign-up screen renders email + password + confirmPassword fields with Zod 4 validation (D-12 min(12), D-14 refine, D-15 Swedish copy)"
    - "Submitting valid sign-up calls supabase.auth.signUp; on success the user lands in (app) declaratively (no imperative router.replace)"
    - "Duplicate email signup shows 'Detta email är redan registrerat — försök logga in' inline under email field (D-03)"
    - "(app) group layout renders <Redirect href='/(auth)/sign-in' /> when session is null, <Stack> otherwise (defense-in-depth per success criterion #5)"
    - "(app)/index.tsx renders 'Inloggad som {email}' + sign-out button; tapping sign-out calls useAuthStore.signOut() which calls queryClient.clear() before supabase.auth.signOut()"
    - "Phase 1 smoke-test app/app/index.tsx is removed (no longer referenced; conflicts with Stack.Protected route grouping)"
    - "Sign-in nav link 'Inget konto? Registrera' resolves to the new sign-up route (no 404)"
  artifacts:
    - path: "app/app/(auth)/sign-up.tsx"
      provides: "Sign-up screen — RHF + Zod 4 + supabase.auth.signUp + error.code mapping (user_already_exists, email_exists, weak_password, over_*, signup_disabled, validation_failed, default)"
      contains: "supabase.auth.signUp"
      contains_also: "zodResolver(signUpSchema)"
      min_lines: 130
    - path: "app/app/(app)/_layout.tsx"
      provides: "(app) group guard layout — Redirect when no session, Stack otherwise"
      contains: "Redirect"
      contains_also: "useAuthStore"
      min_lines: 12
    - path: "app/app/(app)/index.tsx"
      provides: "Post-login placeholder surface — email greeting + sign-out button"
      contains: "useAuthStore"
      contains_also: "Logga ut"
      min_lines: 25
  key_links:
    - from: "app/app/(auth)/sign-up.tsx"
      to: "app/lib/schemas/auth.ts"
      via: "import { signUpSchema, SignUpInput }"
      pattern: "from \"@/lib/schemas/auth\""
    - from: "app/app/(app)/_layout.tsx"
      to: "app/lib/auth-store.ts"
      via: "useAuthStore((s) => s.session) selector"
      pattern: "useAuthStore\\(\\(s\\) => s\\.session\\)"
    - from: "app/app/(app)/index.tsx"
      to: "app/lib/auth-store.ts"
      via: "useAuthStore selectors for email + signOut"
      pattern: "useAuthStore\\(\\(s\\) => s\\."
    - from: "Phase 1 smoke-test deletion"
      to: "Stack.Protected routing"
      via: "Removing app/app/index.tsx eliminates the bare-route conflict; (app)/index.tsx is now the post-login start"
      pattern: "DELETED app/app/index.tsx"
---

<objective>
Complete the F1 vertical slice: build the sign-up screen, the guarded (app) group with its post-login placeholder + sign-out, and clean up the Phase 1 smoke-test file. After this plan, all 5 ROADMAP success criteria for Phase 3 are exercisable end-to-end on iPhone (Plan 04 verifies them manually).

Purpose: Plan 02 left the slice incomplete — sign-in works but post-login routes to nothing (Stack.Protected `(app)` branch has no screen yet) and the sign-in nav link "Registrera" 404s. This plan closes those gaps and adds the duplicate-email + weak-password handling for sign-up that's not relevant for sign-in.

Output: New `app/app/(auth)/sign-up.tsx`; new `app/app/(app)/_layout.tsx`; new `app/app/(app)/index.tsx`; deleted `app/app/index.tsx` (Phase 1 smoke-test handoff per CONTEXT.md "Claude's Discretion" #6 + PATTERNS.md notes — deletion option chosen for cleaner end state).
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
@.planning/phases/03-auth-persistent-session/03-02-SUMMARY.md
@CLAUDE.md
@app/app/_layout.tsx
@app/app/(auth)/_layout.tsx
@app/app/(auth)/sign-in.tsx
@app/lib/auth-store.ts
@app/lib/schemas/auth.ts
@app/lib/supabase.ts

<interfaces>
<!-- Contracts established by Plans 01 + 02 that this plan consumes -->

From `app/lib/schemas/auth.ts` (Plan 01):
```typescript
export const signUpSchema: z.ZodObject<...>; // { email, password, confirmPassword } with refine
export type SignUpInput = { email: string; password: string; confirmPassword: string };
```

From `app/lib/auth-store.ts` (Plan 01):
```typescript
export const useAuthStore: UseBoundStore<StoreApi<{
  session: Session | null;
  status: AuthStatus;
  signOut: () => Promise<void>;
}>>;
```

From `app/app/_layout.tsx` (Plan 02):
- Stack.Protected guard={!!session} routes (app) when authed, (auth) when anonymous
- During status==='loading', RootNavigator returns null (splash bridges)

From `app/app/(auth)/sign-in.tsx` (Plan 02):
- Nav link `router.replace('/(auth)/sign-up')` — sign-up.tsx must exist before manual verification

From `expo-router`:
```typescript
import { Redirect, Stack, useRouter } from "expo-router";
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create sign-up screen with RHF + Zod 4 + Supabase signUp + full error mapping (`app/app/(auth)/sign-up.tsx`)</name>
  <files>app/app/(auth)/sign-up.tsx</files>
  <read_first>
    - app/app/(auth)/sign-in.tsx (Plan 02 output — sign-up is the SIBLING with one extra field + different Supabase call + different error codes; copy this file as the starting shape and apply the differences explicitly)
    - .planning/phases/03-auth-persistent-session/03-RESEARCH.md §C "Code Examples — `app/app/(auth)/sign-up.tsx`" (CANONICAL — full skeleton)
    - .planning/phases/03-auth-persistent-session/03-RESEARCH.md §E "Auth-error code mapping (verified canonical list)" — focus on `user_already_exists` + `email_exists` + `weak_password` + `over_*` + `signup_disabled` + `validation_failed` rows
    - .planning/phases/03-auth-persistent-session/03-RESEARCH.md Pitfall §6 "Email-confirmation toggle silently breaks signup flow" — add the documented comment near the signUp call
    - .planning/phases/03-auth-persistent-session/03-PATTERNS.md "`app/app/(auth)/sign-up.tsx` (NEW — RHF + Zod 4 form)" + Shared Patterns §5, §8, §9
    - .planning/phases/03-auth-persistent-session/03-UI-SPEC.md (Copywriting Contract — sign-up specific copy + helper text)
    - .planning/phases/03-auth-persistent-session/03-CONTEXT.md D-01, D-03, D-12, D-14, D-15
    - app/lib/schemas/auth.ts (Plan 01 — for signUpSchema, SignUpInput type)
  </read_first>
  <behavior>
    - Test 1: Field-blur with invalid email → "Email måste vara giltigt" inline under email
    - Test 2: Submitting password.length<12 → "Minst 12 tecken" inline under password
    - Test 3: Submitting confirmPassword !== password → "Lösen matchar inte" inline under confirmPassword
    - Test 4: Submitting empty confirmPassword → "Bekräfta ditt lösen" inline under confirmPassword
    - Test 5: Submitting duplicate email → Supabase returns `error.code === 'user_already_exists'` (or `'email_exists'`) → "Detta email är redan registrerat — försök logga in" inline under email field (D-03)
    - Test 6: Submitting weak password (server-side reject) → `error.code === 'weak_password'` → "Lösen för svagt — minst 12 tecken" inline under password
    - Test 7: Submitting `over_request_rate_limit` or `over_email_send_rate_limit` → banner "För många försök. Försök igen om en stund."
    - Test 8: Submitting `signup_disabled` → banner "Registrering är tillfälligt avstängd."
    - Test 9: Successful signup → no error → onAuthStateChange SIGNED_IN fires → store flips → root Stack.Protected re-evaluates → user lands in (app) declaratively (NO imperative router.replace)
    - Test 10: Tapping "Har du redan ett konto? Logga in" → `router.replace('/(auth)/sign-in')` (NOT push)
    - Test 11: Below the password field, helper text "Minst 12 tecken" renders BEFORE validation fires (UI-SPEC.md helper-text contract); replaced by inline error text on Zod failure
  </behavior>
  <action>
Create `app/app/(auth)/sign-up.tsx`. This is the SIBLING of Plan 02's sign-in screen. SAME shape; key differences:
1. Schema: `signUpSchema` (3 fields, refine on confirmPassword)
2. Supabase call: `supabase.auth.signUp({ email, password })` (NOT signInWithPassword)
3. Error code mapping: full set per RESEARCH.md §E (NOT subset)
4. Copy: "Skapa konto" / "Skapar konto…" / "Bekräfta lösen" / "Har du redan ett konto?" / "Logga in"
5. Helper text below password: "Minst 12 tecken" rendered BEFORE validation fires (UI-SPEC.md Copywriting Contract — replaced by error text when Zod fails)
6. Password autoComplete: `"new-password"` (NOT `"password"`); textContentType: `"newPassword"` (NOT `"password"`)
7. Pitfall §6 documentary comment near `signUp` call

Use double-quoted strings, `@/` alias, sibling-derived structure from Plan 02's sign-in.tsx.

EXACT contents:

```typescript
// app/app/(auth)/sign-up.tsx
//
// Phase 3 sign-up screen — RHF + Zod 4 + supabase.auth.signUp.
//
// Locked decisions implemented:
//   D-01: Email-confirmation = OFF in Supabase Studio. signUp returns a session
//         immediately; no email-confirm round trip in V1. See Pitfall §6 below.
//   D-03: Duplicate-email error inline under email field (NOT generic) — accepts
//         email-existence disclosure since Supabase API exposes it regardless.
//   D-12: signUpSchema enforces password.min(12) (ASVS V2.1.1 / NIST SP 800-63B —
//         no complexity rule).
//   D-14: confirmPassword refine via signUpSchema (.refine).
//   D-15: Swedish error copy, inline.
//   D-16: NO imperative router.replace on success — declarative routing via root
//         Stack.Protected.
//
// UI-SPEC.md compliance: NativeWind Color §60/30/10 + F15 dark-mode pairs;
// helper text "Minst 12 tecken" renders BELOW password before validation fires
// and is replaced by error text on Zod failure; touch targets ≥ 44pt.
//
// Pitfall §6 (RESEARCH.md): if Studio "Confirm email" toggle is flipped ON in
// V1.1, signUp returns { session: null, user: {...} } and this code path will
// fall through to the "no error" branch but the listener will fire with
// session=null. The user would stay on the sign-up screen with no feedback.
// V1.1 plan: add `if (!data.session) return navigateToCheckEmail()` after the
// signUp call. Phase 3 hard-codes the D-01 assumption.
//
// Pitfall §7 (NativeWind): use `placeholderTextColor` prop, NOT a
// `placeholder:text-gray-*` class.
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

export default function SignUpScreen() {
  const router = useRouter();
  const [bannerError, setBannerError] = useState<string | null>(null);
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

  const onSubmit = async ({ email, password }: SignUpInput) => {
    setBannerError(null);
    // V1 ASSUMPTION (D-01 + Pitfall §6): Studio "Confirm email" is OFF, so signUp
    // returns a session synchronously. If V1.1 flips it on, add a session-null
    // branch here to navigate to a "Check your email" screen.
    const { error } = await supabase.auth.signUp({ email, password });
    if (!error) {
      // Listener fires SIGNED_IN; root Stack.Protected re-evaluates; user lands
      // in (app) without an imperative router.replace (D-16).
      return;
    }
    // Map AuthApiError.code → field-level or banner error.
    // VERIFIED codes from auth-js error-codes.ts (RESEARCH.md §E table).
    switch (error.code) {
      case "user_already_exists":
      case "email_exists":
        // D-03: inline under email; we accept that this discloses email
        // existence because Supabase API exposes it regardless of UI.
        setError("email", {
          message: "Detta email är redan registrerat — försök logga in",
        });
        break;
      case "weak_password":
        // Server-side rejection (in addition to client-side D-12 min(12)).
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
        // Network errors (no .code), unexpected_failure, etc.
        setBannerError("Något gick fel. Försök igen.");
        console.error("[sign-up] unexpected error:", error);
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
                Skapa konto
              </Text>
            </View>

            {/* Banner error */}
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

              {/* Password field — with helper text "Minst 12 tecken" before validation */}
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
                      autoComplete="new-password"
                      textContentType="newPassword"
                      className={`w-full rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-3 text-base text-gray-900 dark:text-gray-50 border ${
                        errors.password
                          ? "border-red-600 dark:border-red-400"
                          : "border-gray-300 dark:border-gray-700"
                      } focus:border-blue-600 dark:focus:border-blue-500`}
                    />
                    {errors.password ? (
                      <Text className="text-base text-red-600 dark:text-red-400">
                        {errors.password.message}
                      </Text>
                    ) : (
                      // UI-SPEC.md helper text: visible until validation fires.
                      <Text className="text-base text-gray-500 dark:text-gray-400">
                        Minst 12 tecken
                      </Text>
                    )}
                  </View>
                )}
              />

              {/* Confirm password field */}
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <View className="gap-2">
                    <Text className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                      Bekräfta lösen
                    </Text>
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry
                      autoCapitalize="none"
                      autoComplete="new-password"
                      textContentType="newPassword"
                      className={`w-full rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-3 text-base text-gray-900 dark:text-gray-50 border ${
                        errors.confirmPassword
                          ? "border-red-600 dark:border-red-400"
                          : "border-gray-300 dark:border-gray-700"
                      } focus:border-blue-600 dark:focus:border-blue-500`}
                    />
                    {errors.confirmPassword && (
                      <Text className="text-base text-red-600 dark:text-red-400">
                        {errors.confirmPassword.message}
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
                {isSubmitting ? "Skapar konto…" : "Skapa konto"}
              </Text>
            </Pressable>

            {/* Nav link to sign-in */}
            <View className="flex-row items-center justify-center mt-8 gap-1">
              <Text className="text-base text-gray-900 dark:text-gray-50">
                Har du redan ett konto?
              </Text>
              <Pressable
                onPress={() => router.replace("/(auth)/sign-in")}
                className="py-3 px-2"
              >
                <Text className="text-base font-semibold text-blue-600 dark:text-blue-400">
                  Logga in
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
  </action>
  <verify>
    <automated>cd app &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - File exists: `app/app/(auth)/sign-up.tsx`
    - File imports: `from "@/lib/schemas/auth"` (signUpSchema + SignUpInput), `from "@/lib/supabase"` (supabase), `from "react-hook-form"`, `from "@hookform/resolvers/zod"`
    - File contains: `resolver: zodResolver(signUpSchema)`
    - File contains: `mode: "onBlur"`
    - File contains: `defaultValues: { email: "", password: "", confirmPassword: "" }` (3 fields with empty defaults)
    - File contains: `supabase.auth.signUp({ email, password })`
    - File contains: `case "user_already_exists":` AND `case "email_exists":` (both codes per RESEARCH.md §E)
    - File contains: `case "weak_password":`
    - File contains: `case "over_request_rate_limit":` AND `case "over_email_send_rate_limit":`
    - File contains: `case "signup_disabled":`
    - File contains: `case "validation_failed":`
    - File contains: `setError("email", { message: "Detta email är redan registrerat — försök logga in" })`
    - File contains: `<Controller` exactly 3 times (one per field) — `grep -c "<Controller" app/app/\(auth\)/sign-up.tsx` returns `3`
    - File contains the helper text branch: `Minst 12 tecken` rendered as `text-gray-500 dark:text-gray-400` (NOT red — appears only when no error)
    - File contains: `autoComplete="new-password"` (sign-up uses new-password, not password)
    - File contains: `textContentType="newPassword"`
    - File contains the Swedish copy: "Skapa konto" (heading + CTA), "Skapar konto…" (loading), "Bekräfta lösen", "Har du redan ett konto?", "Logga in"
    - File contains: `router.replace("/(auth)/sign-in")`
    - File contains: `placeholderTextColor="#9CA3AF"` (Pitfall §7)
    - File does NOT contain `placeholder:text-gray` (Pitfall §7 verified)
    - Dark-mode coverage: `grep -c "dark:" app/app/(auth)/sign-up.tsx` returns ≥ 18 (3 fields × 6 pairs + heading + CTA + nav)
    - `cd app && npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>
    Sign-up screen exists with full RHF + Zod + Supabase wiring; 3-field form (email + password + confirmPassword); error.code mapping covers all 7 sign-up-relevant codes plus default banner; Swedish copy matches UI-SPEC; helper text "Minst 12 tecken" branch present; dark-mode pairs verified; declarative success routing per D-16; Pitfall §6 + §7 documentary comments + mitigations applied.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create (app) group layout with Redirect defense-in-depth (`app/app/(app)/_layout.tsx`)</name>
  <files>app/app/(app)/_layout.tsx</files>
  <read_first>
    - .planning/phases/03-auth-persistent-session/03-RESEARCH.md Pattern 4 "(app)-group `<Redirect>` as defense-in-depth" (canonical shape)
    - .planning/phases/03-auth-persistent-session/03-PATTERNS.md "`app/app/(app)/_layout.tsx` (NEW — guarded group layout)"
    - .planning/phases/03-auth-persistent-session/03-CONTEXT.md (in scope: Redirect when session === null else Stack)
    - .planning/ROADMAP.md Phase 3 success criterion #5 ("Stack.Protected guard={!!session} i root + <Redirect> i (app)/_layout.tsx hindrar protected screens från att flicker-rendera när session saknas")
    - app/app/_layout.tsx (Plan 02 — root has Stack.Protected; this layer is defense-in-depth)
    - app/app/(auth)/_layout.tsx (Plan 02 — mirror the bare-Stack pattern)
  </read_first>
  <action>
Create the `app/app/(app)/` directory if it does not exist. Then create `app/app/(app)/_layout.tsx` with EXACT contents:

```typescript
// app/app/(app)/_layout.tsx
//
// Phase 3: route-group layout for the authenticated surface.
//
// Defense-in-depth (RESEARCH.md Pattern 4 + ROADMAP success criterion #5):
// even with root <Stack.Protected guard={!!session}>, this layer ALSO checks
// session and renders <Redirect href="/(auth)/sign-in" /> when session is
// null. If the root guard ever has a frame of staleness, this catches it
// before any protected screen mounts queries.
//
// Selector usage (CONTEXT.md D-10): narrow useAuthStore selector limits this
// component's re-renders to session changes only — not status changes.
//
// Header convention (CLAUDE.md ## Conventions → Navigation): bare Stack with
// headerShown:false. Real (app) screens opt headers in per-screen via
// <Stack.Screen options={{ headerShown: true, ... }} /> as they're built.
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
  </action>
  <verify>
    <automated>cd app &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - File exists: `app/app/(app)/_layout.tsx`
    - File imports: `Redirect` AND `Stack` from `"expo-router"` (one-line: `import { Redirect, Stack } from "expo-router";`)
    - File imports: `useAuthStore` from `"@/lib/auth-store"`
    - File contains: `useAuthStore((s) => s.session)` (narrow selector — NOT `useAuthStore()` bare)
    - File contains: `if (!session) {` AND `return <Redirect href="/(auth)/sign-in" />;`
    - File contains: `<Stack screenOptions={{ headerShown: false }} />`
    - File contains: `export default function AppLayout()`
    - `cd app && npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>
    (app) group layout exists with the Redirect defense-in-depth pattern. Bare Stack rendered when session present; declarative redirect when null. No imperative navigation.
  </done>
</task>

<task type="auto">
  <name>Task 3: Create post-login placeholder screen with sign-out button (`app/app/(app)/index.tsx`)</name>
  <files>app/app/(app)/index.tsx</files>
  <read_first>
    - app/app/index.tsx (current Phase 1 smoke-test — to mirror dark-mode class pairing)
    - .planning/phases/03-auth-persistent-session/03-PATTERNS.md "`app/app/(app)/index.tsx` (NEW — placeholder post-login surface)" (canonical shape — copy verbatim)
    - .planning/phases/03-auth-persistent-session/03-UI-SPEC.md "Empty state" → temporary `(app)/index.tsx` copy ("Inloggad som {email}", "FitnessMaxxing", "Plan-skapande kommer i nästa fas.", "Logga ut")
    - .planning/phases/03-auth-persistent-session/03-CONTEXT.md D-08, D-10, D-16, D-17 (Zustand store shape, narrow selectors, declarative sign-out, sign-out button placement)
    - app/lib/auth-store.ts (Plan 01 — useAuthStore shape, signOut action)
    - app/app/(app)/_layout.tsx (Task 2 — confirms session is non-null at this layer; safe to read s.session?.user.email)
  </read_first>
  <action>
Create `app/app/(app)/index.tsx` with EXACT contents (per PATTERNS.md "(app)/index.tsx" canonical excerpt + UI-SPEC.md Empty-state copy):

```typescript
// app/app/(app)/index.tsx
//
// Phase 3 post-login placeholder. Temporary surface — Phase 4 replaces with
// real plans/exercises home (per CONTEXT.md D-17: "Sign-out-knapp synlig
// i (app)-gruppen tills Phase 4 bygger riktig settings-yta. Knappen är inte
// snyggt placerad — den är funktionell.").
//
// Selectors (CONTEXT.md D-10): separate narrow selectors for email and signOut
// so this screen only re-renders when those slices change.
//
// Sign-out flow (CONTEXT.md D-16):
//   tap → useAuthStore.signOut() → queryClient.clear() → supabase.auth.signOut()
//        → onAuthStateChange listener flips status to 'anonymous'
//        → root Stack.Protected re-evaluates → user lands in (auth)/sign-in
//        → NO imperative router.replace
//
// UI-SPEC.md Color §60/30/10 + F15 dark-mode pairs verified.
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
  </action>
  <verify>
    <automated>cd app &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - File exists: `app/app/(app)/index.tsx`
    - File imports: `useAuthStore` from `"@/lib/auth-store"`
    - File contains TWO narrow selectors: `useAuthStore((s) => s.session?.user.email)` AND `useAuthStore((s) => s.signOut)` — verify by `grep -c "useAuthStore((s) =>" app/app/(app)/index.tsx` returns at least `2`
    - File contains the Swedish copy: "FitnessMaxxing", "Inloggad som", "Plan-skapande kommer i nästa fas.", "Logga ut"
    - File contains: `onPress={signOut}` (passes the action directly — no inline arrow)
    - File contains: `bg-white dark:bg-gray-900` (screen container F15)
    - File contains: `bg-blue-600 dark:bg-blue-500` (CTA F15)
    - File contains: `text-gray-900 dark:text-gray-50` (body text F15)
    - File contains: `text-gray-500 dark:text-gray-400` (muted text F15)
    - File does NOT contain `router.replace` or `router.push` (D-16: declarative routing only)
    - File does NOT contain `useRouter` import
    - `cd app && npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>
    Post-login placeholder exists with email greeting + sign-out button; uses narrow Zustand selectors; declarative sign-out flow per D-16; dark-mode pairs verified; matches UI-SPEC Empty-state copy contract.
  </done>
</task>

<task type="auto">
  <name>Task 4: Delete Phase 1 smoke-test (`app/app/index.tsx`) — Stack.Protected handoff</name>
  <files>app/app/index.tsx</files>
  <read_first>
    - app/app/index.tsx (the file being deleted — verify it is the Phase 1 smoke-test, NOT something more)
    - .planning/phases/03-auth-persistent-session/03-PATTERNS.md "`app/app/index.tsx` (MODIFIED — moved or deleted)" + "Phase 1 smoke-test handoff" (Option A — Delete chosen for cleaner end state)
    - .planning/phases/03-auth-persistent-session/03-CONTEXT.md "Claude's Discretion" #6 (planner picks delete vs move; we chose delete)
    - app/app/_layout.tsx (Plan 02 — confirms RootNavigator + Stack.Protected handles routing; bare app/app/index.tsx has no purpose post-Plan-02)
  </read_first>
  <action>
Delete the file `app/app/index.tsx`. Use the Bash `rm` command (NOT `git rm` — git will pick it up as a deletion via working-tree state):

```bash
rm app/app/index.tsx
```

Run from repo root. This file's content (Phase 1 "Hello FitnessMaxxing" smoke-test) has been semantically replaced by `app/app/(app)/index.tsx` (Task 3). The old file no longer needs to exist.

VERIFY before deletion: open `app/app/index.tsx` and confirm it is exactly the Phase 1 smoke-test (a 11-line file with `<Text>Hello FitnessMaxxing</Text>` and nothing else). If the file has grown unexpectedly (someone modified it between Plan 02 ship and Plan 03 ship), STOP and ask the user before deleting — there may be intent that wasn't captured in PATTERNS.md.

After deletion, verify no other file imports from `./index` or `app/app/index` (it shouldn't — Phase 1 only used it as the route entry, not as an import target). Run:
```bash
grep -r "app/app/index" app/ --include="*.ts" --include="*.tsx" 2>/dev/null
```
Expected: zero matches (the file was a route entry, not an import source).
  </action>
  <verify>
    <automated>test ! -f app/app/index.tsx</automated>
  </verify>
  <acceptance_criteria>
    - File `app/app/index.tsx` does NOT exist (verify by `test ! -f app/app/index.tsx` exits 0)
    - File `app/app/(app)/index.tsx` DOES exist (Task 3 output — the replacement)
    - `git status` shows `app/app/index.tsx` as deleted (in `Deleted:` block, not `Modified:`)
    - `cd app && npx tsc --noEmit` exits 0 (no broken imports)
    - No other file in `app/` references `app/app/index.tsx` — `grep -r "app/app/index" app/ --include="*.ts" --include="*.tsx"` returns zero matches
  </acceptance_criteria>
  <done>
    Phase 1 smoke-test file removed; (app) group's index.tsx (Task 3) is now the post-login route entry; Stack.Protected has clean route children for both branches.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Sign-up form → Supabase Auth API | Untrusted credentials cross via `signUp({ email, password })`; Zod validates first |
| Sign-up duplicate-email path | D-03 documented: email-existence disclosure is accepted (Supabase API exposes regardless) |
| (app) group entry → session check | Defense-in-depth Redirect catches root-guard staleness frames |
| Sign-out flow → cache flush | `queryClient.clear()` runs BEFORE `supabase.auth.signOut()` to prevent user-A data leaking when user-B signs in |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-03-14 | Information Disclosure | Sign-up duplicate-email error reveals account existence | accept | D-03 documented: Supabase API already exposes via `error.code === "user_already_exists"`; matching UI is consistent. NOT a generic-error policy violation because the API is the disclosure source, not the UI. |
| T-03-15 | Spoofing | Weak password accepted by client → server rejection on signUp | mitigate | Two-tier validation: Zod `password.min(12)` (D-12, ASVS V2.1.1) at form boundary BEFORE network; Supabase server-side `weak_password` policy as final arbiter; UI maps `error.code === "weak_password"` to "Lösen för svagt — minst 12 tecken" inline. |
| T-03-16 | Information Disclosure | Stale TanStack Query cache leaks user A data when user B signs in | mitigate | `useAuthStore.signOut()` calls `queryClient.clear()` BEFORE `supabase.auth.signOut()` (Plan 01 contract). syncs in-memory + persisted AsyncStorage. Manual verification in Plan 04. |
| T-03-17 | Spoofing | Email-confirm-toggle silent breakage if Studio "Confirm email" is flipped on | accept | Pitfall §6 documented in code comment near `signUp` call. D-01 hard-codes assumption; D-02 V1.1 plan adds `auth-callback.tsx` deep-link handler. Manual gate: verify Studio toggle is OFF before phase gate (Plan 04 manual checklist). |
| T-03-18 | Tampering | Stack.Protected guard staleness frame between session change and re-render | mitigate | (app)/_layout.tsx Redirect provides defense-in-depth — even if root guard has a stale frame, the group layout's `useAuthStore((s) => s.session)` selector catches it. ROADMAP success criterion #5. |
| T-03-19 | Repudiation | Sign-out side-channel timing reveals signed-in state | accept | V1 personal app, single user; signed-in/signed-out states are not adversarial. `console.warn` on signOut error is for dev-debug only and never reveals credentials. |
| T-03-20 | Information Disclosure | (app)/index.tsx renders `session.user.email` — verify no other PII leak | mitigate | Confirmed only `email` is rendered; `session.user.id`, `session.access_token` etc. are NOT shown. Verified by reading the rendered JSX (Task 3 acceptance criteria). |

**No HIGH-severity unmitigated threats.** Plan 03 closes the F1 vertical slice; Plan 04 (manual verification on iPhone) confirms the end-to-end behavior matches the threat-register expectations.
</threat_model>

<verification>
- `cd app && npx tsc --noEmit` exits 0 (TS clean across all 4 file changes)
- `cd app && npm run test:auth-schemas` exits 0 (Plan 01 schemas not regressed)
- `cd app && npm run test:rls` exits 0 (Phase 2 RLS regression intact)
- `grep -E "service_role|SERVICE_ROLE" app/app/\(auth\)/sign-up.tsx app/app/\(app\)/_layout.tsx app/app/\(app\)/index.tsx` returns zero matches (security audit)
- `grep -c "<Controller" app/app/\(auth\)/sign-up.tsx` returns exactly `3` (3 fields)
- `grep -c "case " app/app/\(auth\)/sign-up.tsx` returns exactly `7` (7 case statements: user_already_exists, email_exists, weak_password, over_request_rate_limit, over_email_send_rate_limit, signup_disabled, validation_failed)
- `test ! -f app/app/index.tsx` exits 0 (Phase 1 smoke-test deleted)
- `test -f app/app/\(app\)/index.tsx` exits 0 (replacement exists)
- `grep -r "app/app/index" app/ --include="*.ts" --include="*.tsx"` returns zero matches (no broken imports from deleted file)
- `npm run lint` from `app/` cwd exits 0 (Phase 1 lint config; verifies Plan 03 files pass eslint-config-expo)
</verification>

<success_criteria>
- [ ] Sign-up screen exists with full RHF + Zod + 7-case error mapping + helper text branch
- [ ] (app) group layout exists with declarative Redirect defense-in-depth
- [ ] (app)/index.tsx exists with email greeting + sign-out (uses narrow selectors per D-10)
- [ ] Phase 1 smoke-test file `app/app/index.tsx` deleted
- [ ] Sign-in nav link "Registrera" → sign-up route now resolves (no 404)
- [ ] Sign-up nav link "Logga in" → sign-in route resolves
- [ ] Sign-out flow calls queryClient.clear() (via auth-store action) before supabase.auth.signOut() — verified by reading auth-store.ts Plan 01 contract
- [ ] Dark-mode pairs verified across all 3 new screens + (app) layout
- [ ] TS compiles clean; lint clean; no security regression
- [ ] All 5 ROADMAP F1 success criteria are now exercisable on iPhone (Plan 04 confirms)
</success_criteria>

<output>
After completion, create `.planning/phases/03-auth-persistent-session/03-03-SUMMARY.md` documenting:
- Files created (3) + files deleted (1)
- Sign-up error.code mapping coverage (7 cases + default)
- (app) group defense-in-depth pattern verified
- Sign-out flow trace (button → store action → cache clear → supabase.signOut → listener → Stack.Protected re-route)
- Phase 1 smoke-test handoff completion (deletion option chosen)
- Open: hand off to Plan 04 manual iPhone verification
</output>
