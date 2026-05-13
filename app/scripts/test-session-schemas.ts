// app/scripts/test-session-schemas.ts
//
// Phase 5 Wave 0: Node-only Zod schema test for sessions schemas.
// Run via `npm run test:session-schemas`.
//
// Verifies the constraints from 05-CONTEXT.md scope + 05-01-PLAN.md Task 1:
//   - notes 0..500 chars (nullable + optional, F12 schema-ready)
//
// No Supabase calls — pure schema parse. Runs in <1s via tsx.

import { sessionFormSchema } from "../lib/schemas/sessions";

type Case = {
  name: string;
  input: unknown;
  expectSuccess: boolean;
  expectErrorIncludes?: string;
  expectErrorPath?: string[];
};

const cases: Case[] = [
  {
    name: "happy: notes null",
    input: { notes: null },
    expectSuccess: true,
  },
  {
    name: "happy: notes omitted",
    input: {},
    expectSuccess: true,
  },
  {
    name: "happy: notes 500 chars",
    input: { notes: "x".repeat(500) },
    expectSuccess: true,
  },
  {
    name: "reject: notes 501 chars",
    input: { notes: "y".repeat(501) },
    expectSuccess: false,
    expectErrorIncludes: "Max 500 tecken",
    expectErrorPath: ["notes"],
  },
];

let failed = 0;

for (const c of cases) {
  const result = sessionFormSchema.safeParse(c.input);
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
