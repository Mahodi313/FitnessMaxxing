// app/lib/query/network.ts
//
// Phase 4 D-01: focusManager + onlineManager listeners (lifted from Phase 1
// app/app/_layout.tsx) PLUS the load-bearing onlineManager.subscribe block
// that closes Pitfall 8.12: every offline → online transition triggers
// queryClient.resumePausedMutations(). Without this hook a queued mutation
// never replays after the app comes back online — the airplane-mode test
// in Phase 4 success #4 lives or dies on this code block.
//
// Also exports useOnlineStatus(): boolean, the React hook that the
// OfflineBanner component (Plan 02) and any other UI that wants to render
// "you are offline" subscribes to.
//
// Module-load-order dependency (RESEARCH §"Module-load order" + Pitfall 8.2):
//   - This file MUST execute AFTER lib/query/client.ts (so queryClient is
//     defined) and AFTER lib/query/persister.ts (so re-hydrated paused
//     mutations are present in the mutation cache before the
//     resumePausedMutations call fires on the first online transition).
//
// Phase 1 invariant preserved: NetInfo `state.isConnected` is `boolean | null`
// where `null` is "unknown / pre-probe". We treat unknown as ONLINE so
// TanStack Query does not flip mutations into `paused` before we know — only
// an explicit `false` flips us offline.
//
// References:
//   - 04-CONTEXT.md D-01
//   - 04-RESEARCH.md §6 (NetInfo wiring + useOnlineStatus + onlineManager.subscribe pattern)
//   - PITFALLS §8.12

import { AppState, Platform } from "react-native";
import { focusManager, onlineManager } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import { useSyncExternalStore } from "react";
import { queryClient } from "@/lib/query/client";

// ---- focusManager <- AppState ---------------------------------------------
// Phase 1 inheritance: when the app becomes active, mark queries as focused so
// stale data refetches. RN-only; web is a no-op because Expo Router web is not
// a target in V1.
focusManager.setEventListener((setFocused) => {
  const sub = AppState.addEventListener("change", (s) => {
    if (Platform.OS !== "web") setFocused(s === "active");
  });
  return () => sub.remove();
});

// ---- onlineManager <- NetInfo ---------------------------------------------
// Phase 1 inheritance + Phase 1 invariant: state.isConnected is boolean | null;
// null = unknown (pre-probe). Treat unknown as online — only an explicit false
// flips us offline. This prevents a cold-start race where mutations would be
// paused before NetInfo had time to probe.
onlineManager.setEventListener((setOnline) => {
  const unsubscribe = NetInfo.addEventListener((state) => {
    setOnline(state.isConnected !== false);
  });
  return unsubscribe;
});

// ---- onlineManager.subscribe — Phase 4 Pitfall-8.12 close --------------
// On every offline → online transition, replay paused mutations. Gated by
// `wasOnline` so we don't fire on every NetInfo emission (NetInfo can re-emit
// the same state); we only resume when state genuinely flipped from offline
// to online. The first emission's gate is set from onlineManager.isOnline().
let wasOnline = onlineManager.isOnline();
onlineManager.subscribe((online) => {
  if (online && !wasOnline) {
    void queryClient.resumePausedMutations();
  }
  wasOnline = online;
});

// ---- useOnlineStatus() ----------------------------------------------------
// React hook that returns the current onlineManager state. Built on
// useSyncExternalStore so concurrent React renders see a consistent value.
// Plan 02 OfflineBanner consumes this; Plan 03/04 may also use it for
// per-screen online-aware UX.
//
// Server-side render fallback: returns `true` (online). RN has no SSR but
// useSyncExternalStore requires the third argument; React 19 throws if it is
// omitted on a non-DOM platform. Safe default = "we are online" so the
// banner doesn't flash on initial mount.
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
    () => true,
  );
}
