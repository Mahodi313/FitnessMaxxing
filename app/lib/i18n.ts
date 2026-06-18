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
import { resolveLanguageCore, type LanguagePref } from "./resolve-language";

i18n.use(initReactI18next).init({
  resources: {
    sv: { translation: sv },
    en: { translation: en },
  },
  lng: Localization.getLocales()[0]?.languageCode ?? "sv",
  fallbackLng: "sv",
  interpolation: { escapeValue: false },
  compatibilityJSON: "v4",
  // D-04 (Phase 15, Plan 15-01): dev-only missing-key loudness. saveMissing
  // gates missingKeyHandler firing; BOTH are __DEV__-gated so Metro
  // dead-code-strips them from the release bundle (T-15-01 / RESEARCH Pitfall 4).
  // A missing key triggers console.error — NOT throw: throwing inside a
  // render-time t() crashes the tree on the first miss and hides every other
  // missing key. console.error raises a red LogBox banner while the sv-fallback
  // still renders, so the whole screen surfaces all gaps in one pass.
  saveMissing: __DEV__,
  missingKeyHandler: __DEV__
    ? (_lngs, _ns, key) => {
        console.error(`[i18n] MISSING KEY: "${key}"`);
      }
    : undefined,
});

export default i18n;

// ---------------------------------------------------------------------------
// resolveLanguage — three-state (fm:language) → two-state (engine language)
//
// Phase 9 (Plan 09-01), D-10/D-11 (RESEARCH Pattern 2). The Settings language
// control and LocaleBootstrap both pipe the stored fm:language pref through
// this resolver before calling i18n.changeLanguage(); only the 'sv'|'en'
// literals ever reach the engine (T-09-04 / T-08-11 lineage — no free text).
//
// `deviceLang` is injectable so the resolver is unit-testable in a Node `tsx`
// run with no Expo runtime (scripts/test-locale-resolve.ts). When omitted it
// reads the live device locale via expo-localization.
//
// NOTE: this does NOT alter the init block above — `fallbackLng: "sv"` stays as
// the *missing-key* fallback (Swedish is the authored primary), per RESEARCH
// Pitfall 1 / Open Question 1. D-11 (Swedish device → sv, anything else → en)
// lives here, not in fallbackLng.
// ---------------------------------------------------------------------------

// LanguagePref re-exported from the pure core so screen code keeps a single
// import surface (`@/lib/i18n`).
export type { LanguagePref };

export function resolveLanguage(pref: LanguagePref, deviceLang?: string): "sv" | "en" {
  // Supply the live device locale by default; the pure core (resolve-language.ts)
  // owns the mapping and stays Node-importable for tests. D-11 lives in the core.
  const lang = deviceLang ?? Localization.getLocales()[0]?.languageCode ?? undefined;
  return resolveLanguageCore(pref, lang);
}
