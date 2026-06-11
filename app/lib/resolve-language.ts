// app/lib/resolve-language.ts
//
// Phase 9 (Plan 09-01), D-10/D-11. PURE three-state (fm:language) → two-state
// (engine language) resolver. This module has NO Expo / React Native imports so
// it is importable from a Node `tsx` test (scripts/test-locale-resolve.ts) —
// importing lib/i18n.ts directly pulls in expo-localization → react-native,
// which esbuild/tsx cannot transform under Node (RN ships untranspiled JSX/
// flow). Keeping the resolver math in this standalone pure file is the Node-safe
// boundary; lib/i18n.ts re-exports `resolveLanguage` (see its tail) so screen
// code keeps a single import surface.
//
// `deviceLang` is REQUIRED here (no live-locale default) precisely because this
// file must not import expo-localization. lib/i18n.ts's wrapper supplies the
// live device locale; this core only decides the mapping.

export type LanguagePref = "system" | "sv" | "en";

/**
 * Map a stored fm:language pref + a device language code to the engine language.
 * Explicit 'sv'/'en' pass through; 'system' resolves to 'sv' for a Swedish
 * device locale and 'en' for anything else (D-11). Only the 'sv'|'en' literal
 * union is ever returned — no free text reaches i18n.changeLanguage (T-09-04).
 */
export function resolveLanguageCore(pref: LanguagePref, deviceLang: string | undefined): "sv" | "en" {
  if (pref === "sv" || pref === "en") return pref;
  return deviceLang === "sv" ? "sv" : "en";
}
