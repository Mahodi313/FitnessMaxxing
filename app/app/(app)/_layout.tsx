// app/app/(app)/_layout.tsx
//
// Phase 3: route-group layout for the authenticated surface.
// Phase 4 (UAT 2026-05-10): centralised header styling + minimal back-button.
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
// Header convention (CLAUDE.md ## Conventions → Navigation):
//   - headerShown defaults to false. Real (app) screens opt in per-screen via
//     <Stack.Screen options={{ headerShown: true, title: "..." }} />.
//   - When a screen opts in, it inherits headerStyle/headerTintColor/title
//     style from this layout's screenOptions so light/dark surfaces stay
//     consistent (UAT 2026-05-10: plans/new.tsx had a system-default white
//     header while plans/[id].tsx had a dark-aware one — visible mismatch).
//   - headerBackButtonDisplayMode: 'minimal' hides the auto-prepended route
//     name on iOS so navigating from (tabs)/index → plans/[id] no longer
//     shows "(tabs)" as the back-button label (UAT 2026-05-10).
//
// FIT-5 fix — navigator key bound to user identity:
//   Stack.Protected guard={!!session} does NOT unmount the (app) sub-navigator
//   when guard flips to false on sign-out. Protected.js exports primitives.Group
//   (no unmount logic); withLayoutContext.js filters the (app) routes from the
//   screen list but leaves the navigator component mounted in the React tree.
//   This means the (app) Stack's in-memory React Navigation state — including the
//   previously active route (e.g. plans/[id]/exercise-picker from the developer's
//   session) — persists across sign-out → sign-in cycles within the same Expo Go
//   JS bundle instance.
//
//   Fix: key={session.user.id} forces React to unmount and remount the Stack
//   component when the signed-in user changes. The new user gets a fresh navigator
//   instance with no history, and lands at the default initial route of the (app)
//   group: (app)/(tabs)/index (plans list).
//
//   The key uses session.user.id (guaranteed non-null at this point because the
//   `if (!session) return <Redirect ... />` guard above ensures session is defined).
//   The fallback 'anon' string is defensive-only and unreachable in normal flow.
import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "nativewind";
import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "@/lib/auth-store";
import { useCreateExercise } from "@/lib/queries/exercises";
import { SEED_EXERCISES } from "@/lib/seed/exercises";
import { deterministicUUID } from "@/lib/utils/uuid";

// Phase 10 (Plan 10-02), D-07. Auth-gated first-run starter-exercise seed.
//
// Mount point (RESEARCH Pitfall 1): this MUST live inside the session-gated
// (app) tree — NOT the root _layout.tsx — because useCreateExercise requires
// `user_id = session.user.id` to satisfy the exercises RLS `with check`. The
// root bootstraps (Theme/Font/Locale) run during the PRE-auth splash window
// where no user_id exists yet (T-10-06: the seed user_id is always the live
// signed-in user; RLS rejects any other).
//
// Behaviour:
//   - no-op render (return null) — never blocks the Stack or any frame (T-10-08).
//   - fires only when userId is present.
//   - fast-path skip via the per-user fm:exercises_seeded:<userId> flag
//     (namespaced so a second user on the same device still gets seeded).
//   - fire-and-forget, fail-open: a read/write error swallows silently
//     (catch) and never hangs render — mirrors LocaleBootstrap's shape.
//   - PER-USER deterministic ids (CR-01): the row id is
//     deterministicUUID(`fm-exercise-seed:${userId}:${seed_key}`), so two users
//     on the same device get DISTINCT ids for the same seed_key and never
//     collide on the global exercises PK. The original global-hardcoded-id seed
//     let the first user claim the id and silently starved every later user.
//   - idempotent: the same per-user ids + the ['exercise','create'] upsert
//     default (onConflict:'id', ignoreDuplicates:true) make a re-run a no-op.
//   - the flag is set ONLY after all 18 rows confirm success (counted
//     onSuccess), NOT after enqueue — so a partial/failed seed retries on the
//     next launch instead of being permanently marked done with missing rows.
//     Offline the mutations pause (onSuccess fires on reconnect), so the flag
//     simply sets later; every interim re-run is a duplicate-free no-op.
//
// Hook-rules: useCreateExercise() is called ONCE at component top-level (its
// mutationKey is static); firing .mutate() N times in the loop is the correct
// v5 pattern. SP-2: use .mutate(...) (offline-safe, optimistic) — NOT
// .mutateAsync (which never resolves while a mutation is paused offline,
// Phase 4 lesson).
function ExerciseSeedBootstrap() {
  const userId = useAuthStore((s) => s.session?.user.id);
  const createExercise = useCreateExercise();
  useEffect(() => {
    if (!userId) return;
    const flag = `fm:exercises_seeded:${userId}`;
    let cancelled = false;
    void (async () => {
      try {
        const seeded = await AsyncStorage.getItem(flag);
        if (seeded === "true" || cancelled) return;

        // Derive a per-user deterministic id for each seed row up front.
        const ids = await Promise.all(
          SEED_EXERCISES.map((ex) =>
            deterministicUUID(`fm-exercise-seed:${userId}:${ex.seed_key}`),
          ),
        );
        if (cancelled) return;

        let succeeded = 0;
        let failed = false;
        const total = SEED_EXERCISES.length;
        SEED_EXERCISES.forEach((ex, i) => {
          createExercise.mutate(
            {
              id: ids[i],
              user_id: userId,
              name: ex.name,
              muscle_group: ex.muscle_group,
              equipment: ex.equipment,
              seed_key: ex.seed_key,
            },
            {
              onSuccess: () => {
                succeeded += 1;
                // Mark seeded only once EVERY row has confirmed (server) success.
                if (!failed && succeeded === total) {
                  void AsyncStorage.setItem(flag, "true").catch(() => {});
                }
              },
              onError: () => {
                // Leave the flag UNSET so the next launch retries the same
                // per-user deterministic ids (idempotent upsert, no duplicates).
                failed = true;
              },
            },
          );
        });
      } catch {
        // crypto / IO error — fail open, never block render.
      }
    })();
    return () => {
      cancelled = true;
    };
    // createExercise is a stable hook result; userId is the real trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  return null;
}

// FIT-5 Cycle 5 fix — anchor the (app) stack to (tabs) as the default route.
// Without this, expo-router's default-route resolution can land on the FIRST
// explicit <Stack.Screen> declared below (previously exercise-picker — a modal
// with a required [id] param) when the URL doesn't pin a specific child route
// after sign-in. unstable_settings.initialRouteName tells expo-router to
// pre-anchor the stack at (tabs), so any deeper push has (tabs) as its base
// and a no-URL initial mount lands on (tabs)/index (Planer).
export const unstable_settings = {
  initialRouteName: "(tabs)",
};

export default function AppLayout() {
  const session = useAuthStore((s) => s.session);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }
  return (
    <>
      {/* D-07 first-run seed — no-op render, fires once per signed-in user. */}
      <ExerciseSeedBootstrap />
      <Stack
        key={session.user.id}
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: isDark ? "#111827" : "#FFFFFF" },
          headerTintColor: isDark ? "#F9FAFB" : "#111827",
          headerTitleStyle: { color: isDark ? "#F9FAFB" : "#111827" },
          headerBackButtonDisplayMode: "minimal",
          // contentStyle paints the screen-container behind the SafeAreaView so
          // the brief frame visible during stack push/pop animations matches the
          // rest of the app instead of falling through to react-native-screens'
          // default white. UAT 2026-05-10: noticed a white flash on swipe-back
          // from the picker modal to plan-detail.
          contentStyle: { backgroundColor: isDark ? "#111827" : "#FFFFFF" },
          // freezeOnBlur unmounts the JS subscriptions of off-screen stack
          // siblings, freeing the JS thread during transitions. UAT 2026-05-10:
          // navigation felt "60Hz" on a ProMotion iPhone — the underlying
          // native animation IS 120Hz capable (Expo Go has
          // CADisableMinimumFrameDurationOnPhone enabled) but background-screen
          // useEffect/query-subscription work was stealing frames. Pairs with
          // the same Info.plist key now set in app.json for production builds.
          freezeOnBlur: true,
        }}
      >
        {/* FIT-5 Cycle 5: (tabs) declared FIRST and explicitly so expo-router's
            default-route resolution prefers it over the modal screens below.
            Paired with unstable_settings.initialRouteName='(tabs)' above. */}
        <Stack.Screen name="(tabs)" />
        {/* Modal route presentation MUST be declared at the layout level. The
            `presentation` prop on react-native-screens is static — setting it
            via <Stack.Screen options={{ presentation: 'modal' }} /> inside the
            child screen file doesn't take effect because the screen has
            already registered with its default 'card' (push) presentation by
            the time the dynamic options apply. UAT 2026-05-10: picker and
            targets-edit were pushing sideways instead of presenting as
            modals. (#expo-router) */}
        <Stack.Screen
          name="plans/[id]/exercise-picker"
          options={{ presentation: "modal" }}
        />
        <Stack.Screen
          name="plans/[id]/exercise/[planExerciseId]/edit"
          options={{ presentation: "modal" }}
        />
        {/* Phase 5 / Plan 05-02 D-03 — workout/[sessionId] is a regular Stack
            screen (NOT modal). It inherits the centralized header styling
            declared in screenOptions above (Phase 4 commit b57d1c2). The
            headerRight Avsluta-button is declared per-screen inside
            [sessionId].tsx because it needs access to the screen-local
            Avsluta-overlay state. */}
        <Stack.Screen
          name="workout/[sessionId]"
          options={{ headerShown: true, title: "Pass" }}
        />
      </Stack>
    </>
  );
}
