// app/lib/units.ts
//
// Phase 9 (Auth, Settings & Preferences), Plan 09-01. Pure kg↔display weight
// helper — no React, no side effects, importable from both screens and Node
// `tsx` test scripts (mirrors lib/i18n.ts's pure-module structure; the math is
// net-new per RESEARCH Pattern 4).
//
// Decisions:
//   - D-01: canonical kg storage; imperial display rounds to the nearest 0.5
//     (plate granularity). Storage stays kg everywhere — this module only
//     transforms for *display* (no retrofit to existing screens this phase, D-02).
//   - Pitfall 5: non-finite input (NaN / ±Infinity) returns 0, never propagates.
//
//   - Phase 12 (Plan 12-02): additive volume helpers `toDisplayVolume` /
//     `formatVolume` (D-20). Tonnage sums convert WITHOUT 0.5-lb rounding —
//     plate granularity is meaningless on a 28,720 kg sum (RESEARCH §Mandate 5
//     "volume-conversion nuance"; lbs-volume numbers get large — accepted).
//     The weight helpers below are UNTOUCHED.
//
// References:
//   - .planning/phases/09-auth-settings-preferences/09-PATTERNS.md §lib/units.ts
//   - .planning/phases/09-auth-settings-preferences/09-RESEARCH.md Pattern 4 / Pitfall 5
//   - .planning/phases/12-history-detail-chart-home-dashboard/12-RESEARCH.md §Mandate 5
//   - .planning/phases/12-history-detail-chart-home-dashboard/12-PATTERNS.md §lib/units.ts

const KG_PER_LB = 0.45359237; // exact kilograms per international pound
const roundHalf = (n: number) => Math.round(n * 2) / 2; // nearest 0.5 (D-01)

export type UnitPref = "metric" | "imperial";

/**
 * Convert a canonical kg weight to the display value for the chosen unit.
 * Metric is a passthrough; imperial divides by KG_PER_LB and rounds to 0.5.
 * Non-finite input returns 0 (Pitfall 5 guard).
 */
export function toDisplayWeight(kg: number, unit: UnitPref): number {
  if (!Number.isFinite(kg)) return 0;
  return unit === "imperial" ? roundHalf(kg / KG_PER_LB) : kg;
}

/**
 * Format a canonical kg weight as a display string with its unit suffix.
 * e.g. formatWeight(100, "metric") === "100 kg"; formatWeight(100, "imperial") === "220.5 lb".
 */
export function formatWeight(kg: number, unit: UnitPref): string {
  const v = toDisplayWeight(kg, unit);
  // WR-04: normalize BOTH branches' display. The metric branch is a raw
  // passthrough (toDisplayWeight doesn't round kg), so without this a stored
  // float like 72.4999 would print verbatim. Integers stay integer; fractional
  // values trim to one decimal — consistent across unit modes.
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  return `${fmt(v)} ${unit === "imperial" ? "lb" : "kg"}`;
}

/**
 * Convert a canonical kg *tonnage sum* (volume) to the display value for the
 * chosen unit. Metric is a passthrough; imperial divides by KG_PER_LB with NO
 * half-rounding — `roundHalf` is a weights-only convention (plate granularity);
 * 0.5-lb resolution is meaningless on a multi-thousand-kg tonnage sum (D-20,
 * RESEARCH §Mandate 5). Non-finite input returns 0 (Pitfall 5 guard).
 */
export function toDisplayVolume(kg: number, unit: UnitPref): number {
  if (!Number.isFinite(kg)) return 0;
  return unit === "imperial" ? kg / KG_PER_LB : kg;
}

/**
 * Format a canonical kg tonnage sum as a locale-grouped display string with its
 * unit suffix. Uses `toLocaleString("sv-SE")` for the Swedish non-breaking-space
 * thousands separator (matches the `formatNumber` idiom in history.tsx /
 * chart.tsx). The converted value is rounded to a whole unit before grouping —
 * fractional pounds on a tonnage sum are noise. e.g. formatVolume(28720,
 * "metric") === "28 720 kg".
 */
export function formatVolume(kg: number, unit: UnitPref): string {
  const v = toDisplayVolume(kg, unit);
  const grouped = Math.round(v).toLocaleString("sv-SE");
  return `${grouped} ${unit === "imperial" ? "lb" : "kg"}`;
}
