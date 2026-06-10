// app/lib/font-store.ts
//
// Phase 8 (Forge Foundation), Plan 08-01. Tiny Zustand slice tracking whether
// the splash gate's two async prerequisites have settled:
//   - fontsReady: the 4 self-hosted Forge font files (Inter Display ×3 +
//     JetBrains Mono) finished Font.loadAsync (DSGN-02).
//   - localeReady: the saved fm:language override was applied via
//     i18n.changeLanguage (I18N-01).
//
// Both default false and flip true on settle. The splash gate in
// app/app/_layout.tsx (wired in Plan 08-02) holds the native splash until
// `status !== "loading" && fontsReady && localeReady`. FontBootstrap /
// LocaleBootstrap MUST set their flag fail-open (on success AND failure) so a
// corrupt pref or missing font can never hang on the splash (RESEARCH Pitfall 7).
//
// No persistence (ARCHITECTURE §2): these are per-launch readiness flags, not
// user preferences — same shape as persistence-store.ts (plain create, no
// persist middleware). Convention matches Phase 3 D-08 (Zustand for
// cross-component reactive state).
//
// References:
//   - .planning/phases/08-forge-foundation/08-PATTERNS.md §font-store.ts
//   - app/lib/persistence-store.ts (exact shape this copies)

import { create } from "zustand";

type FontState = {
  fontsReady: boolean;
  localeReady: boolean;
  setFontsReady: (v: boolean) => void;
  setLocaleReady: (v: boolean) => void;
};

export const useFontStore = create<FontState>((set) => ({
  fontsReady: false,
  localeReady: false,
  setFontsReady: (v) => set({ fontsReady: v }),
  setLocaleReady: (v) => set({ localeReady: v }),
}));
