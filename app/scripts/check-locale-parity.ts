// File: app/scripts/check-locale-parity.ts
//
// Locale key-parity gate for Phase 8 (Forge Foundation), Plan 08-01.
//
// Proves:
//   sv.json and en.json carry the IDENTICAL key set (D-09/D-10 — flat single
//   namespace, full I18N map transcribed from lib.jsx). A missing or extra key
//   in either locale would render an i18next fallback in one language and the
//   real string in the other — a silent UX regression this gate catches at
//   build time. This is the single automatable i18n check in Phase 8
//   (D-07: render verification is manual device UAT via the gallery).
//
// Exit code: 0 when the two key sets match; 1 (after printing the symmetric
// difference) when they diverge.
//
// Run via: cd app && npm run check:locale-parity
//   (which expands to: tsx scripts/check-locale-parity.ts)
//
// This script is Node-only — it is NEVER imported from a Metro-bundled path.
//
// References:
//   - .planning/phases/08-forge-foundation/08-PATTERNS.md §app/locales/*.json
//   - .planning/phases/08-forge-foundation/08-RESEARCH.md §"Wave 0 Gaps"
//   - app/scripts/test-rls.ts (Node-only tsx-script header convention)

import en from "../locales/en.json";
import sv from "../locales/sv.json";

const svKeys = new Set(Object.keys(sv));
const enKeys = new Set(Object.keys(en));

const onlyInSv = [...svKeys].filter((k) => !enKeys.has(k)).sort();
const onlyInEn = [...enKeys].filter((k) => !svKeys.has(k)).sort();

if (onlyInSv.length === 0 && onlyInEn.length === 0) {
  console.log(`PASS — sv/en key sets match (${svKeys.size} keys).`);
  process.exit(0);
}

console.error("FAIL — sv/en locale key sets diverge.");
if (onlyInSv.length > 0) {
  console.error(`  Keys only in sv.json (${onlyInSv.length}): ${onlyInSv.join(", ")}`);
}
if (onlyInEn.length > 0) {
  console.error(`  Keys only in en.json (${onlyInEn.length}): ${onlyInEn.join(", ")}`);
}
process.exit(1);
