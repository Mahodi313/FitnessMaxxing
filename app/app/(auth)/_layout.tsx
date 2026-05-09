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
