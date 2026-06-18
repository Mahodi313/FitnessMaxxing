// app/lib/muscle-group.ts
//
// Phase 10 (Plan 10-02), D-01 / D-03. PURE language-neutral muscle-group
// taxonomy resolver. This module has NO Expo / React Native imports so it is
// importable from a Node `tsx` test (scripts/test-muscle-group.ts) — same
// Node-safe-boundary lesson as lib/resolve-language.ts (Phase 9 Plan 09-01):
// any module a tsx script imports must avoid expo-localization /
// react-native, which esbuild/tsx cannot transform under Node.
//
// D-01: fixed 5-key muscle-group taxonomy (chest / back / legs / shoulders /
// arms) plus an implicit "other" bucket for anything off-list. The picker
// filter pills (Plan 03) consume MuscleGroupKey + resolveMuscleGroupKey to
// classify every exercise row.
//
// D-03: legacy free-text muscle_group (sv OR en, e.g. the Phase 4 picker stored
// "Bröst" raw) maps best-effort to a D-01 key. A seed row already stores the
// canonical key ("chest"), so the map includes the canonical keys as
// self-mappings (idempotent) — `resolveMuscleGroupKey("chest") === "chest"`.

// The full taxonomy including the implicit "other" bucket (the 5 strict keys
// live in lib/schemas/exercises.ts as MUSCLE_GROUP_KEYS — the form dropdown
// only emits those 5; "other" is resolve-time-only, never written by the form).
export type MuscleGroupKey =
  | "chest"
  | "back"
  | "legs"
  | "shoulders"
  | "arms"
  | "other";

// Legacy free-text (sv OR en) → D-01 key. Canonical keys self-map so a seed
// row's stored key passes through unchanged (idempotent). Keys are
// lower-cased + trimmed before lookup, so entries here are lower-case.
export const MUSCLE_GROUP_MAP: Record<string, MuscleGroupKey> = {
  // chest
  chest: "chest",
  bröst: "chest",
  brost: "chest",
  bröstmuskler: "chest",
  // back
  back: "back",
  rygg: "back",
  lats: "back",
  // legs
  legs: "legs",
  ben: "legs",
  lår: "legs",
  // shoulders
  shoulders: "shoulders",
  axlar: "shoulders",
  axel: "shoulders",
  // arms (biceps + triceps collapsed into one D-01 bucket)
  arms: "arms",
  armar: "arms",
  biceps: "arms",
  triceps: "arms",
  // other — canonical self-map so a stored "other" key round-trips
  other: "other",
};

/**
 * Map a legacy/canonical muscle_group string to a D-01 key. Total function:
 *   - null / empty / whitespace-only (falsy after the guard) → null
 *   - a known sv/en/canonical value → its D-01 key
 *   - any other non-empty value → "other" (the catch-all bucket)
 *
 * T-10-09: this is the only classifier the picker filters on, so it must never
 * throw on malformed legacy data — `?? "other"` makes it total.
 */
export function resolveMuscleGroupKey(raw: string | null): MuscleGroupKey | null {
  if (!raw) return null;
  return MUSCLE_GROUP_MAP[raw.trim().toLowerCase()] ?? "other";
}
