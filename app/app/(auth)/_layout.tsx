// app/app/(auth)/_layout.tsx
//
// Phase 3: route-group layout for the unauthenticated surface (sign-in, sign-up).
// Header-off matches root convention (CLAUDE.md ## Conventions → Navigation
// header & status bar) — auth screens render their own headings inline.
// Real screens that want a header opt in per-screen via <Stack.Screen options>.
//
// Defense-in-depth (WR-01): symmetric to (app)/_layout.tsx. Even with root
// <Stack.Protected guard={!session}>, this layer ALSO checks session and
// <Redirect>s an already-authenticated user to /(app) so they cannot land on
// auth screens for a stale frame.
import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "@/lib/auth-store";

export default function AuthLayout() {
  const session = useAuthStore((s) => s.session);
  if (session) {
    // Route to the home tab. expo-router's regenerated typed-routes (after
    // SDK 54 typegen refresh) rejects bare group hrefs like "/(app)" — group
    // roots are no longer assignable to Href. Use the concrete tabs index.
    return <Redirect href="/(app)/(tabs)" />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
