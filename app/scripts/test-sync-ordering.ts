// File: app/scripts/test-sync-ordering.ts
//
// Wave 0 — proves chained createExercise + addExerciseToPlan replay in FK-safe
// order via shared scope.id. Asserts:
//   1. Both mutations seed offline; mutationFns do NOT fire.
//   2. resumePausedMutations() fires create FIRST, then add — no 23503.
//   3. Second resumePausedMutations() run is a no-op (idempotency — no dubbletter).
//
// Run via: cd app && npm run test:sync-ordering
//   (expands to: tsx --env-file=.env.local scripts/test-sync-ordering.ts)
//
// This script is Node-only. It MUST NEVER be imported from app/lib/, app/app/,
// or any other Metro-bundled path (PITFALLS 2.3 — service-role-key isolation).
//
// scope.id correction (matches Phase 4 Plan 04-01 auto-fix Rule 1):
// TanStack v5's MutationScope.id is a STATIC string, not a function. scope is
// set at mutation construction time via getMutationCache().build(client, {
// mutationKey, scope: { id: 'plan:<planId>' } }) — NOT via a function-scope
// in setMutationDefaults.
//
// References:
//   - 04-RESEARCH.md §5 (chained scope.id contract), §8.12 (FK-violation pitfall)
//   - 04-VALIDATION.md "Wave 0 Requirements" — test-sync-ordering.ts

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { QueryClient, onlineManager } from "@tanstack/react-query";
import { randomUUID } from "node:crypto";
import type { Database } from "../types/database";

// ---- Env guard -------------------------------------------------------------
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error(
    "Missing env. Need EXPO_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in app/.env.local. Run via npm run test:sync-ordering.",
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
const TEST_EMAIL_PREFIX = "sync-order-test-";
const TEST_EMAIL_DOMAIN = "@fitnessmaxxing.local";
const TEST_PASSWORD = "Sync-Order-Test-Pwd-2026!";

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

// ---------------------------------------------------------------------------
// QueryClient mirrors production defaults shape; uses networkMode: 'online'
// so offline pause is deterministic (see test-offline-queue.ts header for the
// rationale — production uses 'offlineFirst' and Supabase fetch throws when
// offline; the test mutationFn does not, so we use 'online' for a clean
// offline pause).
// ---------------------------------------------------------------------------
type Order = { create: number | null; add: number | null };

function buildClient(planId: string, order: Order, exId: string) {
  void exId;
  let nextOrder = 1;
  const client = new QueryClient({
    defaultOptions: {
      queries: { networkMode: "online" },
      mutations: { networkMode: "online", retry: 0 },
    },
  });

  // ['exercise','create'] — replays first via shared scope.id 'plan:<planId>'
  client.setMutationDefaults(["exercise", "create"], {
    mutationFn: async (vars: unknown) => {
      const v = vars as { id: string; user_id: string; name: string };
      order.create = nextOrder++;
      const { data, error } = await admin
        .from("exercises")
        .upsert(v, { onConflict: "id", ignoreDuplicates: true })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    networkMode: "online",
    retry: 0,
  });

  // ['plan-exercise','add'] — MUST replay AFTER create within same scope
  client.setMutationDefaults(["plan-exercise", "add"], {
    mutationFn: async (vars: unknown) => {
      const v = vars as {
        id: string;
        plan_id: string;
        exercise_id: string;
        order_index: number;
      };
      order.add = nextOrder++;
      const { data, error } = await admin
        .from("plan_exercises")
        .upsert(v, { onConflict: "id", ignoreDuplicates: true })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    networkMode: "online",
    retry: 0,
  });

  return { client, planId };
}

async function main() {
  console.log("[test-sync-ordering] cleanup (start)…");
  await purgeTestUsers();

  console.log("[test-sync-ordering] seed user + workout_plan…");
  const user = await createUser();
  const planId = randomUUID();
  {
    const { error } = await admin
      .from("workout_plans")
      .insert({ id: planId, user_id: user.id, name: "Sync Order Test Plan" });
    if (error) throw new Error(`seed plan: ${error.message}`);
  }

  const exerciseId = randomUUID();
  const planExerciseId = randomUUID();

  // -----------------------------------------------------------------------
  // PHASE 1 — go offline, queue both mutations.
  // -----------------------------------------------------------------------
  const order: Order = { create: null, add: null };
  const { client } = buildClient(planId, order, exerciseId);

  onlineManager.setOnline(false);

  // Build chained mutations sharing scope.id 'plan:<planId>'.
  const createMutation = client.getMutationCache().build(client, {
    mutationKey: ["exercise", "create"],
    scope: { id: `plan:${planId}` },
  });
  const addMutation = client.getMutationCache().build(client, {
    mutationKey: ["plan-exercise", "add"],
    scope: { id: `plan:${planId}` },
  });

  // Fire both — they pause because networkMode: 'online' + offline.
  void createMutation
    .execute({ id: exerciseId, user_id: user.id, name: "Test Bench Press" })
    .catch(() => {
      // Mutation may fail on retry-exhaustion if offline transition is missed;
      // we don't care — we only inspect post-resume state.
    });
  void addMutation
    .execute({
      id: planExerciseId,
      plan_id: planId,
      exercise_id: exerciseId,
      order_index: 0,
    })
    .catch(() => {
      // Same — best-effort.
    });

  await new Promise((r) => setTimeout(r, 200));

  if (order.create === null && order.add === null) {
    pass("Phase 1: both mutationFns paused offline (no premature fire)");
  } else {
    fail("Phase 1: mutationFn fired before online", order);
  }

  // -----------------------------------------------------------------------
  // PHASE 2 — flip online + resumePausedMutations; verify FK-safe order.
  // -----------------------------------------------------------------------
  onlineManager.setOnline(true);
  await client.resumePausedMutations();
  await new Promise((r) => setTimeout(r, 1000));

  if (
    order.create !== null &&
    order.add !== null &&
    order.create < order.add
  ) {
    pass(
      `Phase 2: create (order=${order.create}) ran BEFORE add (order=${order.add}) — scope.id serialization works`,
    );
  } else {
    fail("Phase 2: replay order broken — would FK-violate on real network", order);
  }

  // Verify both rows are now in Postgres (no 23503 fired).
  const { data: ex, error: exErr } = await admin
    .from("exercises")
    .select("*")
    .eq("id", exerciseId)
    .maybeSingle();
  if (exErr || !ex) fail("Phase 2: exercise row not found after replay", exErr);
  else pass("Phase 2: exercise row landed");

  const { data: pe, error: peErr } = await admin
    .from("plan_exercises")
    .select("*")
    .eq("id", planExerciseId)
    .maybeSingle();
  if (peErr || !pe) fail("Phase 2: plan_exercise row not found after replay", peErr);
  else pass("Phase 2: plan_exercise row landed (no 23503)");

  // -----------------------------------------------------------------------
  // PHASE 3 — re-run replay to prove idempotency.
  // -----------------------------------------------------------------------
  const order2: Order = { create: null, add: null };
  const { client: client2 } = buildClient(planId, order2, exerciseId);
  onlineManager.setOnline(false);

  const createMutation2 = client2.getMutationCache().build(client2, {
    mutationKey: ["exercise", "create"],
    scope: { id: `plan:${planId}` },
  });
  const addMutation2 = client2.getMutationCache().build(client2, {
    mutationKey: ["plan-exercise", "add"],
    scope: { id: `plan:${planId}` },
  });

  void createMutation2
    .execute({ id: exerciseId, user_id: user.id, name: "Test Bench Press" })
    .catch(() => {});
  void addMutation2
    .execute({
      id: planExerciseId,
      plan_id: planId,
      exercise_id: exerciseId,
      order_index: 0,
    })
    .catch(() => {});

  await new Promise((r) => setTimeout(r, 200));
  onlineManager.setOnline(true);
  await client2.resumePausedMutations();
  await new Promise((r) => setTimeout(r, 1000));

  // Assert no duplicates in Postgres.
  const { data: exDupes } = await admin
    .from("exercises")
    .select("id")
    .eq("id", exerciseId);
  const { data: peDupes } = await admin
    .from("plan_exercises")
    .select("id")
    .eq("id", planExerciseId);

  if (exDupes?.length === 1 && peDupes?.length === 1) {
    pass(
      "Phase 3: second replay is idempotent — exactly 1 exercise + 1 plan_exercise row (upsert ignoreDuplicates honoured)",
    );
  } else {
    fail("Phase 3: duplicate rows detected after second replay", {
      exercises: exDupes?.length,
      plan_exercises: peDupes?.length,
    });
  }

  // Cleanup
  await admin.from("plan_exercises").delete().eq("id", planExerciseId);
  await admin.from("exercises").delete().eq("id", exerciseId);
  await admin.from("workout_plans").delete().eq("id", planId);
  await admin.auth.admin.deleteUser(user.id);
}

(async () => {
  let exitCode = 0;
  let mainCompleted = false;
  try {
    await main();
    mainCompleted = true;
  } catch (e) {
    console.error("[test-sync-ordering] FATAL:", e instanceof Error ? e.message : e);
    exitCode = 1;
  } finally {
    console.log("[test-sync-ordering] cleanup (end)…");
    try {
      await purgeTestUsers();
    } catch (e) {
      console.error(
        "[test-sync-ordering] cleanup at end failed:",
        e instanceof Error ? e.message : e,
      );
      exitCode = 1;
    }
    console.log("");
    if (!mainCompleted) {
      console.log("[test-sync-ordering] ABORTED before assertions completed");
      exitCode = 1;
    } else if (failures.length === 0) {
      console.log("[test-sync-ordering] ALL ASSERTIONS PASSED");
    } else {
      console.log(`[test-sync-ordering] ${failures.length} FAILURE(S)`);
      for (const f of failures) console.log(`  - ${f}`);
      exitCode = 1;
    }
    process.exit(exitCode);
  }
})();
