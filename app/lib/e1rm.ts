// app/lib/e1rm.ts
//
// Phase 13 (PR Celebration, F18), Plan 13-01. Pure Epley estimated-1RM helper —
// no React, no Expo, no Supabase, no side effects. Importable from both screens
// and Node `tsx` test scripts (mirrors lib/units.ts's pure-module structure).
//
// THE SINGLE FORMULA SOURCE (D-08). Every downstream surface computes e1RM
// through this one pure function so the in-workout celebration and the read-side
// numerals can never drift:
//   - live in-workout PR detection
//   - the chart hero
//   - session-detail per-exercise e1RM
//   - the range delta
// all call epley1RM(). There is no second copy of the formula anywhere.
//
// Decisions:
//   - D-01: e1RM is a single comparable number. Epley = weight_kg × (1 + reps/30).
//     A higher-rep lighter set CAN beat a heavier set (90×10 = 120 > 100×5 ≈
//     116.67) — that is the point of a 1RM estimate, not a bug.
//   - D-04: weight_kg ≤ 0 returns 0 — Epley is meaningless without external load
//     (a bodyweight/unloaded "set" can never register as a weighted PR here).
//   - Pitfall 5 (units.ts precedent): non-finite input (NaN / ±Infinity) returns
//     0, never propagates into a PR compare or a displayed numeral.
//
// NOT formula concerns (caller responsibilities — keep this a pure number→number
// function):
//   - D-02: first-set baseline (no prior set ⇒ no PR yet) — the CALLER decides.
//   - D-03: set_type = 'working' filter (warmups/dropsets excluded) — the CALLER
//     filters before calling.
//
// Units: storage stays canonical kg. e1RM is computed in kg and is itself a kg
// figure — NOT its own unit. Callers display-convert via toDisplayWeight /
// formatWeight + useUnitStore (D-20), the same path every other weight uses.
//
// References:
//   - .planning/phases/13-pr-celebration-f18/13-PATTERNS.md §lib/e1rm.ts
//   - .planning/phases/13-pr-celebration-f18/13-CONTEXT.md D-01/D-02/D-03/D-04/D-08
//   - app/lib/units.ts (structural template + Pitfall-5 guard precedent)

/**
 * Estimated one-rep max via the Epley formula: weight_kg × (1 + reps/30).
 *
 * Pure number→number in canonical kg. Returns 0 for any non-finite input, for
 * weight ≤ 0 (D-04), and for reps ≤ 0 — so a NaN/Infinity/unloaded/0-rep "set"
 * can never propagate into a PR comparison or a rendered numeral.
 */
export function epley1RM(weightKg: number, reps: number): number {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps)) return 0; // units.ts Pitfall-5 precedent
  if (weightKg <= 0) return 0; // D-04 — Epley meaningless without external load
  if (reps <= 0) return 0; // a 0-rep "set" is not a lift
  return weightKg * (1 + reps / 30); // Epley (D-01)
}
