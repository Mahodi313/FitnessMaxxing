// app/scripts/test-locale-resolve.ts
//
// Phase 9 Wave 0: Node-only pure unit test for resolveLanguage() in lib/i18n.ts.
// Run via `npm run test:locale-resolve`. Verifies I18N-02 / D-10 / D-11
// (three-state fm:language → two-state engine language; Swedish device → sv,
// anything else → en).
//
// `deviceLang` is injected in EVERY case so the resolver runs in a Node tsx
// process with no Expo runtime. We import the PURE core (lib/resolve-language.ts)
// rather than lib/i18n.ts because i18n.ts pulls in expo-localization →
// react-native, which esbuild/tsx cannot transform under Node. lib/i18n.ts's
// `resolveLanguage(pref, deviceLang?)` wrapper delegates to this exact core
// (supplying the live device locale by default), so this test covers the engine
// resolver behaviour 1:1.
// Mirrors scripts/test-auth-schemas.ts Case[]-table + loop + exit-code skeleton.
import { resolveLanguageCore as resolveLanguage, type LanguagePref } from "../lib/resolve-language";

type Case = {
  name: string;
  pref: LanguagePref;
  deviceLang?: string;
  expected: "sv" | "en";
};

const cases: Case[] = [
  // Explicit prefs pass through regardless of device locale.
  { name: "resolveLanguage('sv') === 'sv'", pref: "sv", expected: "sv" },
  { name: "resolveLanguage('en') === 'en'", pref: "en", expected: "en" },
  { name: "resolveLanguage('sv','de') === 'sv' (explicit wins over device)", pref: "sv", deviceLang: "de", expected: "sv" },
  // System resolves via device locale (D-11).
  { name: "resolveLanguage('system','sv') === 'sv'", pref: "system", deviceLang: "sv", expected: "sv" },
  { name: "resolveLanguage('system','en') === 'en'", pref: "system", deviceLang: "en", expected: "en" },
  { name: "resolveLanguage('system','de') === 'en' (fallback)", pref: "system", deviceLang: "de", expected: "en" },
  { name: "resolveLanguage('system','') === 'en' (empty → fallback)", pref: "system", deviceLang: "", expected: "en" },
];

let failed = 0;

for (const c of cases) {
  const actual = resolveLanguage(c.pref, c.deviceLang);
  if (actual === c.expected) {
    console.log(`  PASS  ${c.name}`);
  } else {
    console.error(`  FAIL  ${c.name} — expected ${c.expected}, got ${actual}`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n${failed} of ${cases.length} cases FAILED`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} locale-resolve cases passed.`);
process.exit(0);
