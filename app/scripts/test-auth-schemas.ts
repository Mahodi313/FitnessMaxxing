// app/scripts/test-auth-schemas.ts
//
// Phase 3 Wave 0: Node-only Zod schema test. Run via `npm run test:auth-schemas`.
// Verifies CONTEXT.md D-12 (sign-up password.min(12)), D-13 (sign-in password.min(1)),
// D-14 (confirmPassword refine), and the Zod 4 idiom (z.email() + error:).
//
// No Supabase calls — pure schema parse. Runs in <1 second via tsx.
import { signUpSchema, signInSchema } from "../lib/schemas/auth";

type Case = {
  name: string;
  schema: typeof signUpSchema | typeof signInSchema;
  input: unknown;
  expectSuccess: boolean;
  expectErrorIncludes?: string;
  expectErrorPath?: string[];
};

const cases: Case[] = [
  // Sign-up — happy path
  {
    name: "signUp accepts valid input",
    schema: signUpSchema,
    input: { email: "x@y.com", password: "twelve-chars", confirmPassword: "twelve-chars" },
    expectSuccess: true,
  },
  // Sign-up — invalid email
  {
    name: "signUp rejects malformed email",
    schema: signUpSchema,
    input: { email: "not-an-email", password: "twelve-chars", confirmPassword: "twelve-chars" },
    expectSuccess: false,
    expectErrorIncludes: "Email måste vara giltigt",
    expectErrorPath: ["email"],
  },
  // Sign-up — short password (D-12)
  {
    name: "signUp rejects password.length<12 (D-12)",
    schema: signUpSchema,
    input: { email: "x@y.com", password: "shortpw", confirmPassword: "shortpw" },
    expectSuccess: false,
    expectErrorIncludes: "Minst 12 tecken",
    expectErrorPath: ["password"],
  },
  // Sign-up — confirmPassword mismatch (D-14)
  {
    name: "signUp rejects confirmPassword mismatch (D-14)",
    schema: signUpSchema,
    input: { email: "x@y.com", password: "twelve-chars", confirmPassword: "different-12c" },
    expectSuccess: false,
    expectErrorIncludes: "Lösen matchar inte",
    expectErrorPath: ["confirmPassword"],
  },
  // Sign-up — empty confirmPassword (Q3 Claude's Discretion)
  {
    name: "signUp rejects empty confirmPassword",
    schema: signUpSchema,
    input: { email: "x@y.com", password: "twelve-chars", confirmPassword: "" },
    expectSuccess: false,
    expectErrorIncludes: "Bekräfta ditt lösen",
    expectErrorPath: ["confirmPassword"],
  },
  // Sign-in — accepts any non-empty password (D-13)
  {
    name: "signIn accepts password.length=1 (D-13: server is final arbiter)",
    schema: signInSchema,
    input: { email: "x@y.com", password: "a" },
    expectSuccess: true,
  },
  // Sign-in — empty password
  {
    name: "signIn rejects empty password",
    schema: signInSchema,
    input: { email: "x@y.com", password: "" },
    expectSuccess: false,
    expectErrorIncludes: "Lösen krävs",
    expectErrorPath: ["password"],
  },
  // Sign-in — invalid email
  {
    name: "signIn rejects empty email",
    schema: signInSchema,
    input: { email: "", password: "any" },
    expectSuccess: false,
    expectErrorIncludes: "Email måste vara giltigt",
    expectErrorPath: ["email"],
  },
];

let failed = 0;

for (const c of cases) {
  const result = c.schema.safeParse(c.input);
  if (c.expectSuccess) {
    if (result.success) {
      console.log(`  PASS  ${c.name}`);
    } else {
      console.error(`  FAIL  ${c.name} — expected success, got: ${JSON.stringify(result.error.issues)}`);
      failed++;
    }
    continue;
  }
  // Expect failure
  if (result.success) {
    console.error(`  FAIL  ${c.name} — expected failure, got success`);
    failed++;
    continue;
  }
  const issues = result.error.issues;
  const messages = issues.map((i) => i.message).join(" | ");
  const paths = issues.map((i) => i.path.join("."));
  if (c.expectErrorIncludes && !messages.includes(c.expectErrorIncludes)) {
    console.error(`  FAIL  ${c.name} — error did not include "${c.expectErrorIncludes}"; got: ${messages}`);
    failed++;
    continue;
  }
  if (c.expectErrorPath && !paths.some((p) => p === c.expectErrorPath!.join("."))) {
    console.error(`  FAIL  ${c.name} — error path did not include [${c.expectErrorPath.join(",")}]; got: ${paths.join(", ")}`);
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
