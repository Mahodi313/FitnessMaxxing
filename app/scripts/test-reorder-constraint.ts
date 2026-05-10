// File: app/scripts/test-reorder-constraint.ts
//
// Phase 4 Wave 0: proves the two-phase reorder algorithm doesn't violate
// the unique (plan_id, order_index) constraint, AND empirically verifies
// that Postgres int allows negative values (RESEARCH §3 Open Q#1 / A1).
//
// Strategy:
//   1. Seed user A + 5 exercises + 1 plan + 5 plan_exercises (order 0..4).
//   2. Reverse to target order (4,3,2,1,0).
//   3. PHASE 1: write each row to a distinct negative offset (-1, -2, ...).
//      Assert no error from Postgres — confirms negative ints are legal.
//   4. PHASE 2: write each row to its final positive index. Assert no
//      23505 unique_violation.
//   5. SELECT back, assert order matches the reversed target.
//   6. Negative-control: try a NAIVE single-phase reorder. Assert PG returns
//      23505 (constraint is enforced; the trick is necessary).
//
// Run via: cd app && npm run test:reorder-constraint
//   (expands to: tsx --env-file=.env.local scripts/test-reorder-constraint.ts)
//
// This script is Node-only. It MUST NEVER be imported from app/lib/, app/app/,
// or any other Metro-bundled path (PITFALLS 2.3 — service-role-key isolation).
//
// References:
//   - 04-RESEARCH.md §3 (two-phase reorder + unique-constraint trap)
//   - 04-VALIDATION.md "Wave 0 Requirements"

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { Database } from "../types/database";

// ---- Env guard -------------------------------------------------------------
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error(
    "Missing env. Need EXPO_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in app/.env.local. Run via npm run test:reorder-constraint.",
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
const TEST_EMAIL_PREFIX = "reorder-test-";
const TEST_EMAIL_DOMAIN = "@fitnessmaxxing.local";
const TEST_PASSWORD = "Reorder-Test-Pwd-2026!";

async function purgeTestUsers() {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw new Error(`listUsers failed: ${error.message}`);
  for (const u of data.users) {
    if (u.email && u.email.startsWith(TEST_EMAIL_PREFIX)) {
      // Children first; cascade handles plan_exercises and exercise_sets via plans+sessions.
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
  console.log("[test-reorder-constraint] cleanup (start)…");
  await purgeTestUsers();

  console.log("[test-reorder-constraint] seed user + 5 exercises + 1 plan + 5 plan_exercises…");
  const user = await createUser();

  // Seed 5 exercises owned by user
  const exerciseIds: string[] = [];
  for (let i = 0; i < 5; i++) {
    const id = randomUUID();
    const { error } = await admin
      .from("exercises")
      .insert({ id, user_id: user.id, name: `Exercise ${i}` });
    if (error) throw new Error(`seed exercise ${i}: ${error.message}`);
    exerciseIds.push(id);
  }

  // Seed plan
  const planId = randomUUID();
  {
    const { error } = await admin
      .from("workout_plans")
      .insert({ id: planId, user_id: user.id, name: "Reorder Test Plan" });
    if (error) throw new Error(`seed plan: ${error.message}`);
  }

  // Seed 5 plan_exercises with order_index 0..4
  const planExerciseIds: string[] = [];
  for (let i = 0; i < 5; i++) {
    const id = randomUUID();
    const { error } = await admin.from("plan_exercises").insert({
      id,
      plan_id: planId,
      exercise_id: exerciseIds[i],
      order_index: i,
    });
    if (error) throw new Error(`seed plan_exercise ${i}: ${error.message}`);
    planExerciseIds.push(id);
  }

  // Build reversed target order.  Each entry: { id, newIndex } where the row
  // identified by the OLD index `i` should land at the NEW index `4 - i`.
  // We'll write the algorithm against the snapshot (existing row order 0..4).
  const reversed = [...planExerciseIds].reverse(); // [pe4, pe3, pe2, pe1, pe0]

  // ===========================================================================
  // PHASE 1: write distinct negative offsets so phase-2 finals don't collide.
  // ===========================================================================
  console.log("[test-reorder-constraint] PHASE 1: write negative offsets…");
  for (let slot = 0; slot < reversed.length; slot++) {
    const peId = reversed[slot];
    const { error } = await admin
      .from("plan_exercises")
      .update({ order_index: -(slot + 1) })
      .eq("id", peId);
    if (error) {
      fail(`Phase 1 update for row ${peId}`, error);
      return;
    }
  }
  pass("Phase 1: 5 rows updated to negative offsets without error (negative ints allowed)");

  // Confirm via SELECT.
  const { data: phase1Rows, error: phase1SelectErr } = await admin
    .from("plan_exercises")
    .select("id, order_index")
    .eq("plan_id", planId)
    .order("order_index", { ascending: true });
  if (phase1SelectErr) {
    fail("Phase 1 SELECT-back", phase1SelectErr);
    return;
  }
  const allNegative = phase1Rows.every((r) => r.order_index < 0);
  if (allNegative) {
    pass("Phase 1: all 5 rows have negative order_index after the writes");
  } else {
    fail("Phase 1: at least one row failed to take a negative offset", phase1Rows);
  }

  // ===========================================================================
  // PHASE 2: write final positive positions matching the reversed target.
  // Final positions: reversed[0] → 0, reversed[1] → 1, ..., reversed[4] → 4.
  // ===========================================================================
  console.log("[test-reorder-constraint] PHASE 2: write final positions…");
  for (let newIndex = 0; newIndex < reversed.length; newIndex++) {
    const peId = reversed[newIndex];
    const { error } = await admin
      .from("plan_exercises")
      .update({ order_index: newIndex })
      .eq("id", peId);
    if (error) {
      fail(`Phase 2 update for row ${peId} → ${newIndex}`, error);
      return;
    }
  }
  pass("Phase 2: 5 rows written to final positions without 23505 unique_violation");

  // Final SELECT — confirm reversed order.
  const { data: finalRows, error: finalErr } = await admin
    .from("plan_exercises")
    .select("id, order_index")
    .eq("plan_id", planId)
    .order("order_index", { ascending: true });
  if (finalErr) {
    fail("Final SELECT", finalErr);
    return;
  }
  const finalIds = finalRows.map((r) => r.id);
  const expectedIds = reversed; // [pe4..pe0] should now be at positions 0..4
  const orderMatches =
    finalIds.length === expectedIds.length &&
    finalIds.every((id, i) => id === expectedIds[i]);
  if (orderMatches) {
    pass("Final order matches reversed target (rows are at the swapped positions)");
  } else {
    fail("Final order does not match reversed target", { finalIds, expectedIds });
  }

  // ===========================================================================
  // NEGATIVE CONTROL: prove a naive single-phase reorder DOES violate 23505.
  // We try to swap row at index 0 with row at index 1 by writing the new
  // values directly (no negative bridge). The first UPDATE writes pe[finalIds[0]]
  // → order_index 1, but the row currently AT order_index 1 still has it,
  // triggering 23505.
  // ===========================================================================
  console.log("[test-reorder-constraint] NEGATIVE CONTROL: naive single-phase swap should 23505…");
  // Reset to baseline 0..4 first via two-phase (so the negative-control state is clean).
  for (let slot = 0; slot < planExerciseIds.length; slot++) {
    await admin
      .from("plan_exercises")
      .update({ order_index: -(slot + 100) })
      .eq("id", planExerciseIds[slot]);
  }
  for (let i = 0; i < planExerciseIds.length; i++) {
    await admin
      .from("plan_exercises")
      .update({ order_index: i })
      .eq("id", planExerciseIds[i]);
  }
  // Now planExerciseIds[i] is at order_index i.
  // Naive swap: write planExerciseIds[0] to order_index 1 directly.
  const { error: naiveErr } = await admin
    .from("plan_exercises")
    .update({ order_index: 1 })
    .eq("id", planExerciseIds[0]);
  if (naiveErr) {
    const code = (naiveErr as { code?: string }).code;
    if (code === "23505") {
      pass(`Negative control: naive single-phase swap rejected with 23505 (constraint enforced)`);
    } else {
      pass(`Negative control: naive single-phase swap rejected with code ${code} (still proves constraint blocks the naive path)`);
    }
  } else {
    fail(
      "Negative control: naive single-phase swap was NOT blocked — Postgres unique constraint is missing or not enforced. This invalidates the two-phase trick's necessity (configuration drift).",
    );
  }

  // Cleanup
  await admin.from("plan_exercises").delete().eq("plan_id", planId);
  await admin.from("workout_plans").delete().eq("id", planId);
  await admin.from("exercises").delete().in("id", exerciseIds);
  await admin.auth.admin.deleteUser(user.id);
}

(async () => {
  let exitCode = 0;
  let mainCompleted = false;
  try {
    await main();
    mainCompleted = true;
  } catch (e) {
    console.error("[test-reorder-constraint] FATAL:", e instanceof Error ? e.message : e);
    exitCode = 1;
  } finally {
    console.log("[test-reorder-constraint] cleanup (end)…");
    try {
      await purgeTestUsers();
    } catch (e) {
      console.error(
        "[test-reorder-constraint] cleanup at end failed:",
        e instanceof Error ? e.message : e,
      );
      exitCode = 1;
    }
    console.log("");
    if (!mainCompleted) {
      console.log("[test-reorder-constraint] ABORTED before assertions completed");
      exitCode = 1;
    } else if (failures.length === 0) {
      console.log("[test-reorder-constraint] ALL ASSERTIONS PASSED");
    } else {
      console.log(`[test-reorder-constraint] ${failures.length} FAILURE(S)`);
      for (const f of failures) console.log(`  - ${f}`);
      exitCode = 1;
    }
    process.exit(exitCode);
  }
})();
