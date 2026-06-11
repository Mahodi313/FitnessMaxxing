// app/scripts/test-units.ts
//
// Phase 9 Wave 0: Node-only pure unit test for lib/units.ts. Run via
// `npm run test:units`. Verifies SET-03 / D-01 (canonical kg storage; imperial
// display rounds to nearest 0.5) + Pitfall 5 (non-finite → 0).
//
// No Supabase, no Expo runtime — pure transform. Runs in <1s via tsx.
// Mirrors scripts/test-auth-schemas.ts Case[]-table + loop + exit-code skeleton.
import { toDisplayWeight, formatWeight, type UnitPref } from "../lib/units";

type Case = {
  name: string;
  actual: number | string;
  expected: number | string;
};

const cases: Case[] = [
  // toDisplayWeight — metric passthrough
  { name: "toDisplayWeight(100,'metric') === 100", actual: toDisplayWeight(100, "metric"), expected: 100 },
  { name: "toDisplayWeight(0,'metric') === 0", actual: toDisplayWeight(0, "metric"), expected: 0 },
  // toDisplayWeight — imperial conversion + 0.5 rounding (D-01)
  { name: "toDisplayWeight(100,'imperial') === 220.5", actual: toDisplayWeight(100, "imperial"), expected: 220.5 },
  { name: "toDisplayWeight(0,'imperial') === 0", actual: toDisplayWeight(0, "imperial"), expected: 0 },
  { name: "toDisplayWeight(500,'imperial') === 1102.5", actual: toDisplayWeight(500, "imperial"), expected: 1102.5 },
  // Pitfall 5 — non-finite guard
  { name: "toDisplayWeight(NaN,'imperial') === 0", actual: toDisplayWeight(NaN, "imperial"), expected: 0 },
  { name: "toDisplayWeight(Infinity,'metric') === 0", actual: toDisplayWeight(Infinity, "metric"), expected: 0 },
  // formatWeight — suffix + value
  { name: "formatWeight(100,'metric') === '100 kg'", actual: formatWeight(100, "metric"), expected: "100 kg" },
  { name: "formatWeight(100,'imperial') === '220.5 lb'", actual: formatWeight(100, "imperial"), expected: "220.5 lb" },
  { name: "formatWeight(0,'imperial') === '0 lb'", actual: formatWeight(0, "imperial"), expected: "0 lb" },
];

// Type-level smoke: UnitPref is exported and usable.
const _smoke: UnitPref = "metric";
void _smoke;

let failed = 0;

for (const c of cases) {
  if (Object.is(c.actual, c.expected)) {
    console.log(`  PASS  ${c.name}`);
  } else {
    console.error(`  FAIL  ${c.name} — expected ${JSON.stringify(c.expected)}, got ${JSON.stringify(c.actual)}`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n${failed} of ${cases.length} cases FAILED`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} unit cases passed.`);
process.exit(0);
