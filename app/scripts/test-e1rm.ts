// app/scripts/test-e1rm.ts
//
// Phase 13 (PR Celebration, F18), Plan 13-01. Node-only pure unit test for
// lib/e1rm.ts. Run via `npm run test:e1rm`. Proves PR-01 formula correctness
// (Epley) + the numeric guards (T-13-03 — non-finite / ≤0 never propagate).
//
// No Supabase, no Expo runtime, NO --env-file — pure transform. Runs in <1s via
// tsx. Mirrors scripts/test-units.ts Case[]-table + loop + exit-code skeleton.
//
// Decisions exercised:
//   - D-01: e1RM is a single comparable number; a higher-rep lighter set CAN
//     beat a heavier set (90×10 = 120 > 100×5 = 116.67). Worked example below.
//   - D-04: weight_kg ≤ 0 yields 0 — Epley is meaningless without external load.
//   - reps ≤ 0 yields 0 — a 0-rep "set" is not a lift.
//   - Non-finite (NaN / ±Infinity) yields 0 — units.ts Pitfall-5 precedent.
import { epley1RM } from "../lib/e1rm";

type Case = {
  name: string;
  // Optional absolute tolerance for float comparisons — the /30 division is
  // irrational for most inputs, so Object.is would never match. Defaults to 0.
  actual: number;
  expected: number;
  tol?: number;
};

const cases: Case[] = [
  // --- Epley formula correctness (PR-01) ------------------------------------
  { name: "epley1RM(100,5) ≈ 116.67 — Epley = 100 × (1 + 5/30)", actual: epley1RM(100, 5), expected: 116.6667, tol: 0.01 },
  { name: "epley1RM(90,10) === 120 — D-01: high-rep beats heavy", actual: epley1RM(90, 10), expected: 120, tol: 0.01 },

  // --- D-01 worked example (explicit comparison) ----------------------------
  // A lighter high-rep set CAN out-rank a heavier low-rep set. Express the
  // boolean as 1/1 so it flows through the same numeric compare loop.
  {
    name: "D-01 worked example: epley1RM(90,10) > epley1RM(100,5)",
    actual: epley1RM(90, 10) > epley1RM(100, 5) ? 1 : 0,
    expected: 1,
  },

  // --- D-04: weight_kg ≤ 0 guard --------------------------------------------
  { name: "epley1RM(0,5) === 0 — D-04 weight≤0 guard", actual: epley1RM(0, 5), expected: 0 },
  { name: "epley1RM(-5,5) === 0 — negative weight guarded same as zero", actual: epley1RM(-5, 5), expected: 0 },

  // --- reps ≤ 0 guard -------------------------------------------------------
  { name: "epley1RM(100,0) === 0 — a 0-rep set is not a lift", actual: epley1RM(100, 0), expected: 0 },

  // --- Non-finite guard (units.ts Pitfall-5 precedent) ----------------------
  { name: "epley1RM(NaN,5) === 0 — non-finite weight guard", actual: epley1RM(NaN, 5), expected: 0 },
  { name: "epley1RM(100,NaN) === 0 — non-finite reps guard", actual: epley1RM(100, NaN), expected: 0 },
  { name: "epley1RM(Infinity,5) === 0 — non-finite weight guard", actual: epley1RM(Infinity, 5), expected: 0 },
];

let failed = 0;

function matches(c: Case): boolean {
  if (c.tol !== undefined) {
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
console.log(`\nAll ${cases.length} e1RM cases passed.`);
process.exit(0);
