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
// References:
//   - .planning/phases/09-auth-settings-preferences/09-PATTERNS.md §lib/units.ts
//   - .planning/phases/09-auth-settings-preferences/09-RESEARCH.md Pattern 4 / Pitfall 5

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
  return `${v} ${unit === "imperial" ? "lb" : "kg"}`;
}
