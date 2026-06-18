// app/scripts/test-units.ts
//
// Phase 9 Wave 0: Node-only pure unit test for lib/units.ts. Run via
// `npm run test:units`. Verifies SET-03 / D-01 (canonical kg storage; imperial
// display rounds to nearest 0.5) + Pitfall 5 (non-finite → 0).
//
// No Supabase, no Expo runtime — pure transform. Runs in <1s via tsx.
// Mirrors scripts/test-auth-schemas.ts Case[]-table + loop + exit-code skeleton.
//
// Phase 12, Plan 12-02: extended with toDisplayVolume / formatVolume cases
// (D-20 — tonnage conversion WITHOUT 0.5-lb rounding; locale-formatted suffix).
import {
  toDisplayWeight,
  formatWeight,
  toDisplayVolume,
  formatVolume,
  type UnitPref,
} from "../lib/units";

const KG_PER_LB_TEST = 0.45359237; // mirror of units.ts constant for assertions

type Case = {
  name: string;
  actual: number | string;
  expected: number | string;
  // Optional absolute tolerance for float comparisons (imperial volume division
  // is irrational; Object.is would never match). Strings ignore this.
  tol?: number;
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
  // WR-04 — fractional metric must round/trim in formatWeight (not raw float).
  { name: "formatWeight(72.5,'metric') === '72.5 kg'", actual: formatWeight(72.5, "metric"), expected: "72.5 kg" },
  { name: "formatWeight(72.4999999,'metric') === '72.5 kg'", actual: formatWeight(72.4999999, "metric"), expected: "72.5 kg" },
  // WR-04 — fractional-metric passthrough stays unrounded in toDisplayWeight
  // (display formatting lives in formatWeight; the transform is canonical kg).
  { name: "toDisplayWeight(72.5,'metric') === 72.5", actual: toDisplayWeight(72.5, "metric"), expected: 72.5 },

  // --- Phase 12 / Plan 12-02 — toDisplayVolume (D-20) -----------------------
  // Metric passthrough (tonnage sums are kept verbatim — no rounding at all).
  { name: "toDisplayVolume(28720,'metric') === 28720", actual: toDisplayVolume(28720, "metric"), expected: 28720 },
  { name: "toDisplayVolume(0,'metric') === 0", actual: toDisplayVolume(0, "metric"), expected: 0 },
  // Imperial divides by KG_PER_LB with NO 0.5 rounding (0.5-lb plate
  // granularity is meaningless on a tonnage sum — RESEARCH Pitfall 5).
  {
    name: "toDisplayVolume(28720,'imperial') === 28720/KG_PER_LB (no rounding)",
    actual: toDisplayVolume(28720, "imperial"),
    expected: 28720 / KG_PER_LB_TEST,
    tol: 1e-6,
  },
  {
    name: "toDisplayVolume(1,'imperial') is NOT half-rounded",
    actual: toDisplayVolume(1, "imperial"),
    expected: 1 / KG_PER_LB_TEST, // 2.2046… — would be 2 or 2.5 if roundHalf leaked in
    tol: 1e-9,
  },
  // Pitfall 5 — non-finite guard returns 0 (never propagates NaN/Infinity).
  { name: "toDisplayVolume(NaN,'metric') === 0", actual: toDisplayVolume(NaN, "metric"), expected: 0 },
  { name: "toDisplayVolume(Infinity,'imperial') === 0", actual: toDisplayVolume(Infinity, "imperial"), expected: 0 },

  // --- formatVolume (D-20) --------------------------------------------------
  // Locale-formatted (sv-SE grouping) + unit suffix. Assert against the same
  // toLocaleString idiom used in history.tsx:77 / chart.tsx:90 so the test is
  // ICU-version-independent.
  {
    name: "formatVolume(28720,'metric') === sv-SE-grouped + ' kg'",
    actual: formatVolume(28720, "metric"),
    expected: `${(28720).toLocaleString("sv-SE")} kg`,
  },
  {
    name: "formatVolume(0,'metric') === '0 kg'",
    actual: formatVolume(0, "metric"),
    expected: "0 kg",
  },
  {
    name: "formatVolume(NaN,'metric') === '0 kg'",
    actual: formatVolume(NaN, "metric"),
    expected: "0 kg",
  },
];

// Type-level smoke: UnitPref is exported and usable.
const _smoke: UnitPref = "metric";
void _smoke;

let failed = 0;

function matches(c: Case): boolean {
  if (c.tol !== undefined && typeof c.actual === "number" && typeof c.expected === "number") {
    return Math.abs(c.actual - c.expected) <= c.tol;
  }
  return Object.is(c.actual, c.expected);
}

for (const c of cases) {
  if (matches(c)) {
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
