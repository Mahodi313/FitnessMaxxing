// File: app/scripts/test-upsert-idempotency.ts
//
// Phase 4 Wave 0: proves .upsert(values, { onConflict: 'id', ignoreDuplicates: true })
// is replay-safe — a second call with the same id produces no error and no
// duplicate row. This is the regression gate for T-04-10 (replayed mutation
// creates duplicates) and the contract every CREATE mutationFn relies on.
//
// Run via: cd app && npm run test:upsert-idempotency
//   (expands to: tsx --env-file=.env.local scripts/test-upsert-idempotency.ts)
//
// This script is Node-only. It MUST NEVER be imported from app/lib/, app/app/,
// or any other Metro-bundled path (PITFALLS 2.3 — service-role-key isolation).
//
// References:
//   - 04-RESEARCH.md §5 (.upsert + ignoreDuplicates contract)
//   - 04-VALIDATION.md "Wave 0 Requirements"

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { Database } from "../types/database";

// ---- Env guard -------------------------------------------------------------
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error(
    "Missing env. Need EXPO_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in app/.env.local. Run via npm run test:upsert-idempotency.",
  );
}

const admin: SupabaseClient<Database> = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---- pass/fail harness -----------------------------------------------------
const failures: string[] = [];
function pass(name: string) {
  console.log(`  PASS: ${name}`);
}
function fail(name: string, detail?: unknown) {
  const line = detail !== undefined ? `${name} — ${JSON.stringify(detail)}` : name;
  failures.push(line);
  console.log(`  FAIL: ${line}`);
}

// ---- Test fixtures ---------------------------------------------------------
const TEST_EMAIL_PREFIX = "upsert-idem-test-";
const TEST_EMAIL_DOMAIN = "@fitnessmaxxing.local";
const TEST_PASSWORD = "Upsert-Idem-Pwd-2026!";

async function purgeTestUsers() {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw new Error(`listUsers failed: ${error.message}`);
  for (const u of data.users) {
    if (u.email && u.email.startsWith(TEST_EMAIL_PREFIX)) {
      await admin.from("workout_sessions").delete().eq("user_id", u.id);
      await admin.from("workout_plans").delete().eq("user_id", u.id);
      await admin.from("exercises").delete().eq("user_id", u.id);
      await admin.auth.admin.deleteUser(u.id);
    }
  }
}

async function createUser(): Promise<{ id: string; email: string }> {
  const email = `${TEST_EMAIL_PREFIX}${Date.now()}${TEST_EMAIL_DOMAIN}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message ?? "no user"}`);
  return { id: data.user.id, email };
}

async function main() {
  console.log("[test-upsert-idempotency] cleanup (start)…");
  await purgeTestUsers();

  console.log("[test-upsert-idempotency] seed user…");
  const user = await createUser();

  // ---------------------------------------------------------------------------
  // Test 1: workout_plans upsert idempotency.
  // ---------------------------------------------------------------------------
  const planId = randomUUID();
  console.log("[test-upsert-idempotency] Test 1: workout_plans upsert idempotency…");

  // First upsert.
  const { error: plan1Err } = await admin
    .from("workout_plans")
    .upsert(
      {
        id: planId,
        user_id: user.id,
        name: "First Name",
        description: "first",
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
  if (plan1Err) {
    fail("workout_plans first upsert", plan1Err);
    return;
  }
  pass("workout_plans first upsert succeeded");

  // Second upsert with same id but different content.
  const { error: plan2Err } = await admin
    .from("workout_plans")
    .upsert(
      {
        id: planId,
        user_id: user.id,
        name: "Second Name",
        description: "second",
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
  if (plan2Err) {
    fail("workout_plans replay upsert (same id)", plan2Err);
    return;
  }
  pass("workout_plans replay upsert (same id) returned no error");

  // SELECT-back: assert single row, original content preserved (NOT overwritten).
  const { data: planRows, error: planSelectErr } = await admin
    .from("workout_plans")
    .select("*")
    .eq("id", planId);
  if (planSelectErr) {
    fail("workout_plans SELECT-back", planSelectErr);
    return;
  }
  if (planRows.length !== 1) {
    fail(`workout_plans row count after replay`, { count: planRows.length });
    return;
  }
  if (planRows[0].name === "First Name") {
    pass("workout_plans replay preserved original 'First Name' (ignoreDuplicates honored)");
  } else {
    fail(
      `workout_plans row content after replay (expected 'First Name', got '${planRows[0].name}')`,
    );
  }

  // ---------------------------------------------------------------------------
  // Test 2: plan_exercises upsert idempotency (the table the airplane-mode
  // test will most-stress — chained creates from drag-reorder all replay
  // through this code path).
  // ---------------------------------------------------------------------------
  console.log("[test-upsert-idempotency] Test 2: plan_exercises upsert idempotency…");

  // Need an exercise to satisfy FK
  const exerciseId = randomUUID();
  {
    const { error } = await admin
      .from("exercises")
      .insert({ id: exerciseId, user_id: user.id, name: "Test Exercise" });
    if (error) throw new Error(`seed exercise: ${error.message}`);
  }

  const peId = randomUUID();
  const { error: pe1Err } = await admin.from("plan_exercises").upsert(
    {
      id: peId,
      plan_id: planId,
      exercise_id: exerciseId,
      order_index: 0,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (pe1Err) {
    fail("plan_exercises first upsert", pe1Err);
    return;
  }
  pass("plan_exercises first upsert succeeded");

  // Second upsert with same id, different order_index. ignoreDuplicates: true
  // means the conflicting row is skipped — original order_index preserved.
  const { error: pe2Err } = await admin.from("plan_exercises").upsert(
    {
      id: peId,
      plan_id: planId,
      exercise_id: exerciseId,
      order_index: 99,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (pe2Err) {
    fail("plan_exercises replay upsert (same id)", pe2Err);
    return;
  }
  pass("plan_exercises replay upsert (same id) returned no error");

  const { data: peRows, error: peSelectErr } = await admin
    .from("plan_exercises")
    .select("*")
    .eq("id", peId);
  if (peSelectErr) {
    fail("plan_exercises SELECT-back", peSelectErr);
    return;
  }
  if (peRows.length !== 1) {
    fail(`plan_exercises row count after replay`, { count: peRows.length });
    return;
  }
  if (peRows[0].order_index === 0) {
    pass("plan_exercises replay preserved original order_index=0 (ignoreDuplicates honored)");
  } else {
    fail(
      `plan_exercises row content after replay (expected order_index=0, got ${peRows[0].order_index})`,
    );
  }

  // Cleanup
  await admin.from("plan_exercises").delete().eq("plan_id", planId);
  await admin.from("workout_plans").delete().eq("id", planId);
  await admin.from("exercises").delete().eq("id", exerciseId);
  await admin.auth.admin.deleteUser(user.id);
}

(async () => {
  let exitCode = 0;
  let mainCompleted = false;
  try {
    await main();
    mainCompleted = true;
  } catch (e) {
    console.error("[test-upsert-idempotency] FATAL:", e instanceof Error ? e.message : e);
    exitCode = 1;
  } finally {
    console.log("[test-upsert-idempotency] cleanup (end)…");
    try {
      await purgeTestUsers();
    } catch (e) {
      console.error(
        "[test-upsert-idempotency] cleanup at end failed:",
        e instanceof Error ? e.message : e,
      );
      exitCode = 1;
    }
    console.log("");
    if (!mainCompleted) {
      console.log("[test-upsert-idempotency] ABORTED before assertions completed");
      exitCode = 1;
    } else if (failures.length === 0) {
      console.log("[test-upsert-idempotency] ALL ASSERTIONS PASSED");
    } else {
      console.log(`[test-upsert-idempotency] ${failures.length} FAILURE(S)`);
      for (const f of failures) console.log(`  - ${f}`);
      exitCode = 1;
    }
    process.exit(exitCode);
  }
})();
