// app/scripts/test-rest-timer.ts
//
// Phase 14 (Rest Timer, F19) Wave 0: Node-only pure unit test for
// lib/rest-timer.ts. Run via `npm run test:rest-timer`. Verifies the pure
// math + decision predicates that TIMER-01/02/05 and the D-14 gate hang on.
//
// No Supabase, no Expo runtime, no React — pure transform. Runs in <1s via tsx.
// Mirrors scripts/test-units.ts Case[]-table + matcher + exit-code skeleton.
import {
  remainingMs,
  formatMSS,
  extendEndTs,
  shouldFireNotification,
  decideNotificationAction,
  type RestEvent,
} from "../lib/rest-timer";

type Case = {
  name: string;
  actual: number | string | boolean;
  expected: number | string | boolean;
  // Optional absolute tolerance for float comparisons. Strings/booleans ignore.
  tol?: number;
};

const cases: Case[] = [
  // remainingMs — clamp to 0, never negative; non-finite → 0 (TIMER-02 re-derive)
  { name: "remainingMs(1000,0) === 1000", actual: remainingMs(1000, 0), expected: 1000 },
  { name: "remainingMs(0,1000) === 0 (clamped)", actual: remainingMs(0, 1000), expected: 0 },
  { name: "remainingMs(NaN,0) === 0 (non-finite guard)", actual: remainingMs(NaN, 0), expected: 0 },
  { name: "remainingMs(1000,NaN) === 0 (non-finite guard)", actual: remainingMs(1000, NaN), expected: 0 },
  { name: "remainingMs(Infinity,0) === 0 (non-finite guard)", actual: remainingMs(Infinity, 0), expected: 0 },

  // formatMSS — "M:SS"; ceil(ms/1000); non-finite → "0:00"
  { name: "formatMSS(90000) === '1:30'", actual: formatMSS(90000), expected: "1:30" },
  { name: "formatMSS(0) === '0:00'", actual: formatMSS(0), expected: "0:00" },
  { name: "formatMSS(1) === '0:01' (ceil)", actual: formatMSS(1), expected: "0:01" },
  { name: "formatMSS(1000) === '0:01'", actual: formatMSS(1000), expected: "0:01" },
  { name: "formatMSS(59000) === '0:59'", actual: formatMSS(59000), expected: "0:59" },
  { name: "formatMSS(60000) === '1:00'", actual: formatMSS(60000), expected: "1:00" },
  { name: "formatMSS(120000) === '2:00'", actual: formatMSS(120000), expected: "2:00" },
  { name: "formatMSS(NaN) === '0:00'", actual: formatMSS(NaN), expected: "0:00" },
  { name: "formatMSS(Infinity) === '0:00'", actual: formatMSS(Infinity), expected: "0:00" },

  // extendEndTs — D-02 +30s = +30_000ms
  { name: "extendEndTs(1000) === 31000 (D-02 +30s)", actual: extendEndTs(1000), expected: 31000 },
  { name: "extendEndTs(0) === 30000", actual: extendEndTs(0), expected: 30000 },

  // shouldFireNotification — D-14 all-three gate
  { name: "shouldFireNotification(true,true,true) === true", actual: shouldFireNotification(true, true, true), expected: true },
  { name: "shouldFireNotification(true,false,true) === false", actual: shouldFireNotification(true, false, true), expected: false },
  { name: "shouldFireNotification(false,true,true) === false", actual: shouldFireNotification(false, true, true), expected: false },
  { name: "shouldFireNotification(true,true,false) === false", actual: shouldFireNotification(true, true, false), expected: false },

  // decideNotificationAction — skip→cancel; extend/nextSet→reschedule (TIMER-05/D-03/D-07)
  { name: "decideNotificationAction('skip') === 'cancel'", actual: decideNotificationAction("skip"), expected: "cancel" },
  { name: "decideNotificationAction('extend') === 'reschedule'", actual: decideNotificationAction("extend"), expected: "reschedule" },
  { name: "decideNotificationAction('nextSet') === 'reschedule'", actual: decideNotificationAction("nextSet"), expected: "reschedule" },
];

// Type-level smoke: RestEvent is exported and usable.
const _smoke: RestEvent = "skip";
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
console.log(`\nAll ${cases.length} rest-timer cases passed.`);
process.exit(0);
