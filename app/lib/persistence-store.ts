// app/lib/persistence-store.ts
//
// Phase 5 gap-closure (FIT-8). Tracks whether the TanStack query cache has
// finished restoring from AsyncStorage. Set by the PersistQueryClientProvider's
// onSuccess callback in app/app/_layout.tsx. Consumed by the workout-screen
// render gate (app/app/(app)/workout/[sessionId].tsx) to show "Återställer
// pass…" until hydration completes — eliminates the empty-card flicker the
// F13 brutal-test UAT (2026-05-13) surfaced as Gap #2.
//
// Convention matches Phase 3 D-08 (Zustand for cross-component reactive state).
// Linear: FIT-8.

import { create } from "zustand";

type PersistenceState = {
  hydrated: boolean;
  setHydrated: (v: boolean) => void;
};

export const usePersistenceStore = create<PersistenceState>((set) => ({
  hydrated: false,
  setHydrated: (v) => set({ hydrated: v }),
}));
