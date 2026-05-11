// app/scripts/test-exercise-schemas.ts
//
// Phase 4 Wave 0: Node-only Zod schema test for exercises schemas.
// Run via `npm run test:exercise-schemas`.

import { exerciseFormSchema } from "../lib/schemas/exercises";

type Case = {
  name: string;
  input: unknown;
  expectSuccess: boolean;
  expectErrorIncludes?: string;
  expectErrorPath?: string[];
};

const cases: Case[] = [
  {
    name: "happy: full input with all optionals set",
    input: {
      name: "Bänkpress",
      muscle_group: "Bröst",
      equipment: "Skivstång",
      notes: null,
    },
    expectSuccess: true,
  },
  {
    name: "happy: only required name",
    input: { name: "X" },
    expectSuccess: true,
  },
  {
    name: "happy: nullable fields explicitly null",
    input: {
      name: "Squat",
      muscle_group: null,
      equipment: null,
      notes: null,
    },
    expectSuccess: true,
  },
  {
    name: "reject: empty name",
    input: { name: "" },
    expectSuccess: false,
    expectErrorIncludes: "Namn krävs",
    expectErrorPath: ["name"],
  },
  {
    name: "reject: name too long",
    input: { name: "x".repeat(81) },
    expectSuccess: false,
    expectErrorIncludes: "Max 80 tecken",
    expectErrorPath: ["name"],
  },
  {
    name: "reject: muscle_group too long",
    input: { name: "X", muscle_group: "y".repeat(41) },
    expectSuccess: false,
    expectErrorIncludes: "Max 40 tecken",
    expectErrorPath: ["muscle_group"],
  },
  {
    name: "reject: equipment too long",
    input: { name: "X", equipment: "y".repeat(41) },
    expectSuccess: false,
    expectErrorIncludes: "Max 40 tecken",
    expectErrorPath: ["equipment"],
  },
  {
    name: "reject: notes too long",
    input: { name: "X", notes: "z".repeat(501) },
    expectSuccess: false,
    expectErrorIncludes: "Max 500 tecken",
    expectErrorPath: ["notes"],
  },
];

let failed = 0;

for (const c of cases) {
  const result = exerciseFormSchema.safeParse(c.input);
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
