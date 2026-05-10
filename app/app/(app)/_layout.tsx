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
import { useColorScheme } from "react-native";
import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "@/lib/auth-store";

export default function AppLayout() {
  const session = useAuthStore((s) => s.session);
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }
  return (
    <Stack
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
    />
  );
}
