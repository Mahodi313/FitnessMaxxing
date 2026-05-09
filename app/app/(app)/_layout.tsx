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
