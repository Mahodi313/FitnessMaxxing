// app/scripts/test-muscle-group.ts
//
// Phase 10 Wave 0 (Plan 10-02): Node-only unit test for the pure
// resolveMuscleGroupKey taxonomy resolver (D-01 / D-03, T-10-09 coverage).
// Run via `npm run test:muscle-group`.
//
// Imports the PURE lib/muscle-group.ts — no expo / react-native, so tsx can
// transform it under Node (same boundary as test-locale-resolve.ts).

import { resolveMuscleGroupKey, type MuscleGroupKey } from "../lib/muscle-group";

type Case = {
  name: string;
  input: string | null;
  expect: MuscleGroupKey | null;
};

const cases: Case[] = [
  // Legacy sv free-text → key
  { name: "sv 'Bröst' → chest", input: "Bröst", expect: "chest" },
  { name: "sv 'Rygg' → back", input: "Rygg", expect: "back" },
  { name: "sv 'Ben' → legs", input: "Ben", expect: "legs" },
  { name: "sv 'Axlar' → shoulders", input: "Axlar", expect: "shoulders" },
  { name: "sv 'Armar' → arms", input: "Armar", expect: "arms" },
  // en free-text + biceps/triceps collapse → arms
  { name: "en 'Triceps' → arms", input: "Triceps", expect: "arms" },
  { name: "en 'Biceps' → arms", input: "Biceps", expect: "arms" },
  { name: "en 'Lats' → back", input: "Lats", expect: "back" },
  // Canonical key self-maps (idempotent — seed rows store the key already)
  { name: "canonical 'chest' → chest", input: "chest", expect: "chest" },
  { name: "case-insensitive 'Chest' → chest", input: "Chest", expect: "chest" },
  { name: "whitespace '  legs  ' → legs", input: "  legs  ", expect: "legs" },
  { name: "canonical 'other' → other", input: "other", expect: "other" },
  // Unknown non-empty → other bucket (T-10-09 — total, never throws)
  { name: "unknown 'Cardio' → other", input: "Cardio", expect: "other" },
  { name: "unknown 'Forearms' → other", input: "Forearms", expect: "other" },
  // Falsy inputs → null
  { name: "null → null", input: null, expect: null },
  { name: "empty string '' → null", input: "", expect: null },
];

let failed = 0;

for (const c of cases) {
  const got = resolveMuscleGroupKey(c.input);
  if (got === c.expect) {
    console.log(`  PASS  ${c.name}`);
  } else {
    console.error(`  FAIL  ${c.name} — expected ${JSON.stringify(c.expect)}, got ${JSON.stringify(got)}`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n${failed} of ${cases.length} cases FAILED`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} muscle-group cases passed.`);
process.exit(0);
