// app/scripts/test-plan-exercise-schemas.ts
//
// Phase 4 Wave 0: Node-only Zod schema test for plan_exercises schemas.
// Run via `npm run test:plan-exercise-schemas`.
//
// Includes the cross-field refine target_reps_min <= target_reps_max.

import { planExerciseFormSchema } from "../lib/schemas/plan-exercises";

type Case = {
  name: string;
  input: unknown;
  expectSuccess: boolean;
  expectErrorIncludes?: string;
  expectErrorPath?: string[];
};

const cases: Case[] = [
  {
    name: "happy: full input with valid targets",
    input: {
      target_sets: 3,
      target_reps_min: 8,
      target_reps_max: 12,
      notes: "tempo 3-1-1",
    },
    expectSuccess: true,
  },
  {
    name: "happy: all targets null",
    input: {
      target_sets: null,
      target_reps_min: null,
      target_reps_max: null,
      notes: null,
    },
    expectSuccess: true,
  },
  {
    name: "happy: target_reps_min == target_reps_max boundary",
    input: { target_sets: 3, target_reps_min: 10, target_reps_max: 10, notes: null },
    expectSuccess: true,
  },
  {
    name: "happy: only target_sets, reps_min/max null (refine no-op)",
    input: { target_sets: 5, target_reps_min: null, target_reps_max: null, notes: null },
    expectSuccess: true,
  },
  {
    name: "reject: target_sets negative",
    input: { target_sets: -1, target_reps_min: 8, target_reps_max: 12, notes: null },
    expectSuccess: false,
    expectErrorIncludes: "Måste vara 0 eller högre",
    expectErrorPath: ["target_sets"],
  },
  {
    name: "reject: reps_min > reps_max",
    input: {
      target_sets: 3,
      target_reps_min: 12,
      target_reps_max: 8,
      notes: null,
    },
    expectSuccess: false,
    expectErrorIncludes: "Min får inte vara större än max",
    expectErrorPath: ["target_reps_min"],
  },
  {
    name: "reject: target_sets non-integer (3.5)",
    input: { target_sets: 3.5, notes: null },
    expectSuccess: false,
    expectErrorPath: ["target_sets"],
  },
  {
    name: "reject: notes too long",
    input: {
      target_sets: 3,
      target_reps_min: 8,
      target_reps_max: 12,
      notes: "y".repeat(501),
    },
    expectSuccess: false,
    expectErrorIncludes: "Max 500 tecken",
    expectErrorPath: ["notes"],
  },
];

let failed = 0;

for (const c of cases) {
  const result = planExerciseFormSchema.safeParse(c.input);
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
