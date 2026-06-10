// app/lib/i18n.ts
//
// Phase 8 (Forge Foundation), Plan 08-01. i18next module-singleton: the
// translation engine for the whole app. Initialized SYNCHRONOUSLY at module
// load (import-for-side-effect), exactly like auth-store registers
// onAuthStateChange at bundle load — the bundler import cache makes this
// run-once and Strict-Mode safe (see auth-store.ts header).
//
// Decisions:
//   - D-10: FLAT keys mirroring the lib.jsx I18N object 1:1, in a SINGLE
//     default namespace ("translation"). No nested namespaces.
//   - D-09: full sv + en resources transcribed from lib.jsx I18N.sv / I18N.en;
//     the 2 function-valued keys (setsSavedBody, pbSub) are i18next {{n}} /
//     {{kg}}/{{reps}} interpolations.
//   - fallbackLng "sv": Swedish is the default app language (CONTEXT.md).
//   - escapeValue false: RN <Text> renders no markup, so HTML-escaping is both
//     unnecessary and would corrupt the "×" / "—" glyphs in the copy. Only
//     app-controlled numeric values interpolate in Phase 8 (no XSS surface —
//     threat T-08-02 accepted/documented).
//
// I18N-01: text renders from these resources via useTranslation()/t().
// Wired into app/app/_layout.tsx as `import "@/lib/i18n";` (Plan 08-02).
//
// References:
//   - .planning/phases/08-forge-foundation/08-PATTERNS.md §app/lib/i18n.ts
//   - .planning/phases/08-forge-foundation/08-RESEARCH.md Pattern 3
//   - app/lib/supabase.ts (module-singleton + side-effect convention)

import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "../locales/en.json";
import sv from "../locales/sv.json";

i18n.use(initReactI18next).init({
  resources: {
    sv: { translation: sv },
    en: { translation: en },
  },
  lng: Localization.getLocales()[0]?.languageCode ?? "sv",
  fallbackLng: "sv",
  interpolation: { escapeValue: false },
  compatibilityJSON: "v4",
});

export default i18n;
