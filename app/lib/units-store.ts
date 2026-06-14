// app/lib/units-store.ts
//
// Phase 12 gap-closure (FIT-111). Tiny Zustand slice holding the LIVE display
// weight-unit preference (UnitPref: "metric" | "imperial") so the read-side
// screens (History, Session Detail, Chart, Home hero) re-render every figure
// the instant the unit is toggled in Settings — no app restart.
//
// WHY A STORE (D-08): before this, each consuming screen read fm:units once on
// mount via `useState + useEffect(() => getPref("fm:units").then(setUnit))`.
// getPref reads AsyncStorage once with NO subscription, so
// formatWeight/formatVolume/toDisplayVolume only re-ran on remount — flipping
// the unit in Settings left every other screen stale until restart. A single
// reactive Zustand source (the font-store.ts / persistence-store.ts precedent —
// Phase 3 D-08, plain create, NO persist middleware) fixes the reactivity:
// every subscriber re-renders when `unit` changes.
//
// SOURCE OF TRUTH (D-20 / ARCHITECTURE §2): fm:units in AsyncStorage stays the
// DURABLE pref. This store is only the in-memory LIVE MIRROR, hydrated once at
// boot from fm:units (UnitsBootstrap in app/app/_layout.tsx, ThemeBootstrap
// precedent). Storage stays canonical kg; the store holds only the display
// UnitPref — formatWeight/formatVolume/toDisplayVolume convert for display.
//   - hydrate(u): set state ONLY (the value came FROM storage — no re-persist).
//   - setUnit(u): set state AND persist via setPref("fm:units", u) — the
//     Settings write path; persists + flips every subscriber in one call.
//
// D-24: this is a display-pref store ONLY — no mutation / queryKey / persister /
// exercise_sets behavior is touched. F13 hot path untouched.
//
// References:
//   - app/lib/font-store.ts / app/lib/persistence-store.ts (exact shape copied)
//   - app/lib/prefs.ts (getPref/setPref — fm:units durable source of truth)
//   - Linear: FIT-111

import { create } from "zustand";

import { setPref, type UnitPref } from "./prefs";

type UnitState = {
  unit: UnitPref;
  // hydrate: boot-only. Sets state from the value already read out of fm:units;
  // does NOT re-persist (it came FROM storage).
  hydrate: (u: UnitPref) => void;
  // setUnit: Settings write path. Sets state AND persists via setPref, so a
  // toggle both flips every subscriber live and survives a restart.
  setUnit: (u: UnitPref) => void;
};

export const useUnitStore = create<UnitState>((set) => ({
  // Default "metric" matches getPref's corrupt-tolerant default, so figures
  // render in kg before hydration settles — no flash of the wrong unit.
  unit: "metric",
  hydrate: (u) => set({ unit: u }),
  setUnit: (u) => {
    set({ unit: u });
    setPref("fm:units", u);
  },
}));
