// app/scripts/test-set-schemas.ts
//
// Phase 5 Wave 0: Node-only Zod schema test for sets schemas (STRICT).
// Run via `npm run test:set-schemas`.
//
// Verifies the load-bearing constraints from 05-CONTEXT.md D-15:
//   - weight_kg: min(0) max(500) multipleOf(0.25)
//     (PITFALLS §1.5 numeric(6,2) truncation guard)
//   - reps:      int() min(1) max(60)
//   - set_type:  enum 'working'|'warmup'|'dropset'|'failure', default 'working'
//
// No Supabase calls — pure schema parse. Runs in <1s via tsx.

import { setFormSchema } from "../lib/schemas/sets";

type Case = {
  name: string;
  input: unknown;
  expectSuccess: boolean;
  expectErrorIncludes?: string;
  expectErrorPath?: string[];
};

const cases: Case[] = [
  // ---- happy path ---------------------------------------------------------
  {
    name: "happy: valid working set",
    input: { weight_kg: 82.5, reps: 8, set_type: "working" },
    expectSuccess: true,
  },
  {
    name: "happy: weight 0",
    input: { weight_kg: 0, reps: 1, set_type: "working" },
    expectSuccess: true,
  },
  {
    name: "happy: set_type default to working",
    input: { weight_kg: 50, reps: 5 },
    expectSuccess: true,
  },
  // ---- strict rejections (CONTEXT.md D-15) -------------------------------
  {
    name: "reject: weight 1255",
    input: { weight_kg: 1255, reps: 5 },
    expectSuccess: false,
    expectErrorIncludes: "över 500kg",
  },
  {
    name: "reject: weight not multipleOf(0.25)",
    input: { weight_kg: 82.501, reps: 5 },
    expectSuccess: false,
    expectErrorIncludes: "0.25kg",
  },
  {
    name: "reject: negative weight",
    input: { weight_kg: -1, reps: 5 },
    expectSuccess: false,
    expectErrorIncludes: "0 eller högre",
  },
  {
    name: "reject: reps 0",
    input: { weight_kg: 50, reps: 0 },
    expectSuccess: false,
    expectErrorIncludes: "Minst 1 rep",
  },
  {
    name: "reject: reps non-int",
    input: { weight_kg: 50, reps: 5.5 },
    expectSuccess: false,
  },
  {
    name: "reject: reps 61",
    input: { weight_kg: 50, reps: 61 },
    expectSuccess: false,
    expectErrorIncludes: "Över 60 reps",
  },
  // ---- ENUM rejection ----------------------------------------------------
  {
    name: "reject: invalid set_type",
    input: { weight_kg: 50, reps: 5, set_type: "bogus" },
    expectSuccess: false,
  },
];

let failed = 0;

for (const c of cases) {
  const result = setFormSchema.safeParse(c.input);
  if (c.expectSuccess) {
    if (result.success) {
      console.log(`  PASS  ${c.name}`);
    } else {
      console.error(
        `  FAIL  ${c.name} — expected success, got: ${JSON.stringify(result.error.issues)}`,
      );
      failed++;
    }
    continue;
  }
  if (result.success) {
    console.error(`  FAIL  ${c.name} — expected failure, got success`);
    failed++;
    continue;
  }
  const issues = result.error.issues;
  const messages = issues.map((i) => i.message).join(" | ");
  const paths = issues.map((i) => i.path.join("."));
  if (c.expectErrorIncludes && !messages.includes(c.expectErrorIncludes)) {
    console.error(
      `  FAIL  ${c.name} — error did not include "${c.expectErrorIncludes}"; got: ${messages}`,
    );
    failed++;
    continue;
  }
  if (c.expectErrorPath && !paths.some((p) => p === c.expectErrorPath!.join("."))) {
    console.error(
      `  FAIL  ${c.name} — error path did not include [${c.expectErrorPath.join(",")}]; got: ${paths.join(", ")}`,
    );
    failed++;
    continue;
  }
  console.log(`  PASS  ${c.name}`);
}

if (failed > 0) {
  console.error(`\n${failed} of ${cases.length} cases FAILED`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} schema cases passed.`);
process.exit(0);
