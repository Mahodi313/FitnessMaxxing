// app/scripts/test-plan-schemas.ts
//
// Phase 4 Wave 0: Node-only Zod schema test for plans schemas.
// Run via `npm run test:plan-schemas`.
//
// Verifies the constraints from 04-CONTEXT.md scope + 04-UI-SPEC error copy:
//   - name 1..80 chars
//   - description 0..500 chars (nullable)
//
// No Supabase calls — pure schema parse. Runs in <1s via tsx.

import { planFormSchema } from "../lib/schemas/plans";

type Case = {
  name: string;
  input: unknown;
  expectSuccess: boolean;
  expectErrorIncludes?: string;
  expectErrorPath?: string[];
};

const cases: Case[] = [
  {
    name: "happy: full input",
    input: { name: "Push Day", description: "Bröst + axlar" },
    expectSuccess: true,
  },
  {
    name: "happy: description omitted",
    input: { name: "X" },
    expectSuccess: true,
  },
  {
    name: "happy: description null",
    input: { name: "X", description: null },
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
    name: "reject: name too long (81 chars)",
    input: { name: "x".repeat(81) },
    expectSuccess: false,
    expectErrorIncludes: "Max 80 tecken",
    expectErrorPath: ["name"],
  },
  {
    name: "reject: description too long (501 chars)",
    input: { name: "X", description: "y".repeat(501) },
    expectSuccess: false,
    expectErrorIncludes: "Max 500 tecken",
    expectErrorPath: ["description"],
  },
  {
    name: "reject: name undefined",
    input: { name: undefined },
    expectSuccess: false,
    expectErrorPath: ["name"],
  },
];

let failed = 0;

for (const c of cases) {
  const result = planFormSchema.safeParse(c.input);
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
