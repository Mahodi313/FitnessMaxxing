// app/scripts/test-exercise-schemas.ts
//
// Phase 4 Wave 0: Node-only Zod schema test for exercises schemas.
// Run via `npm run test:exercise-schemas`.

import { exerciseFormSchema, exerciseRowSchema } from "../lib/schemas/exercises";

type Case = {
  name: string;
  input: unknown;
  expectSuccess: boolean;
  expectErrorIncludes?: string;
  expectErrorPath?: string[];
};

const cases: Case[] = [
  {
    name: "happy: full input with all optionals set (D-01 muscle-group key)",
    input: {
      name: "Bänkpress",
      muscle_group: "chest",
      equipment: "Skivstång",
      notes: null,
    },
    expectSuccess: true,
  },
  {
    name: "happy: muscle_group accepts a D-01 key (back)",
    input: { name: "Marklyft", muscle_group: "back" },
    expectSuccess: true,
  },
  {
    name: "reject: muscle_group off-list value (Phase 10 D-01 enum)",
    input: { name: "X", muscle_group: "Bröst" },
    expectSuccess: false,
    expectErrorIncludes: "Ogiltig muskelgrupp",
    expectErrorPath: ["muscle_group"],
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

// ---- Row-schema (wire boundary) cases — Phase 10 D-06 seed_key -------------
// exerciseRowSchema is the Pitfall 8.13 parse boundary. seed_key is loose
// (string | null): V2 seed rows carry a stable key, legacy/user rows are NULL.
type RowCase = { name: string; input: unknown; expectSuccess: boolean };

const baseRow = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "22222222-2222-4222-8222-222222222222",
  name: "Bänkpress",
  muscle_group: "chest",
  equipment: null,
  notes: null,
  created_at: null,
};

const rowCases: RowCase[] = [
  {
    name: "row happy: seed_key set ('bench_press')",
    input: { ...baseRow, seed_key: "bench_press" },
    expectSuccess: true,
  },
  {
    name: "row happy: seed_key null (legacy/user row)",
    input: { ...baseRow, seed_key: null },
    expectSuccess: true,
  },
  {
    name: "row reject: seed_key missing (column required on the wire)",
    input: { ...baseRow },
    expectSuccess: false,
  },
];

for (const rc of rowCases) {
  const result = exerciseRowSchema.safeParse(rc.input);
  if (result.success === rc.expectSuccess) {
    console.log(`  PASS  ${rc.name}`);
  } else {
    console.error(
      `  FAIL  ${rc.name} — expected ${rc.expectSuccess ? "success" : "failure"}, got ${result.success ? "success" : JSON.stringify(result.error.issues)}`,
    );
    failed++;
  }
}

const total = cases.length + rowCases.length;
if (failed > 0) {
  console.error(`\n${failed} of ${total} cases FAILED`);
  process.exit(1);
}
console.log(`\nAll ${total} schema cases passed.`);
process.exit(0);
