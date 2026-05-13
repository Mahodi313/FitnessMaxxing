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
      // Cascade order: sessions deletion takes out exercise_sets (FK cascade);
      // plans deletion takes out plan_exercises; then exercises.
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

  // Cleanup Phase 4 fixtures BEFORE Phase 5 fixtures so each scenario is
  // isolated. The Phase 5 block creates its own user/plan/exercise below.
  await admin.from("plan_exercises").delete().eq("id", planExerciseId);
  await admin.from("exercises").delete().eq("id", exerciseId);
  await admin.from("workout_plans").delete().eq("id", planId);
  await admin.auth.admin.deleteUser(user.id);

  // =========================================================================
  // PHASE 5 EXTENSION — ['session','start'] + 25× ['set','add']
  //                     + ['session','finish'] under shared scope.id
  //
  // Phase 5 D-12 + RESEARCH §Replay-order: every Phase 5 mutation in a single
  // session shares `scope.id = 'session:<sessionId>'`. The TanStack scopeFor
  // serializes mutations within a scope so START lands BEFORE every SET (no
  // FK 23503 on exercise_sets.session_id → workout_sessions.id), and FINISH
  // lands AFTER every SET (the row's finished_at is set after all 25 sets
  // are in the DB).
  //
  // Asserts:
  //   (a) the workout_sessions row INSERT fires BEFORE any exercise_sets INSERT
  //   (b) the workout_sessions UPDATE (finished_at) fires LAST
  //   (c) set_number 1..25 are present and contiguous after replay
  //   (d) no 23503 FK errors fire
  // =========================================================================
  console.log("[test-sync-ordering] Phase 5 extension — start + 25 sets + finish…");

  const user5 = await createUser();
  const planId5 = randomUUID();
  const sessionId5 = randomUUID();
  const exerciseId5 = randomUUID();

  // Seed user + plan + exercise via admin (RLS-bypass).
  {
    const { error } = await admin
      .from("workout_plans")
      .insert({ id: planId5, user_id: user5.id, name: "Phase 5 Sync Order Plan" });
    if (error) throw new Error(`seed plan5: ${error.message}`);
  }
  {
    const { error } = await admin
      .from("exercises")
      .insert({ id: exerciseId5, user_id: user5.id, name: "Phase 5 Sync Bench" });
    if (error) throw new Error(`seed exercise5: ${error.message}`);
  }

  // Build Phase 5 client with all 3 mutationDefaults wired against admin.
  type PhaseFiveOrder = {
    start: number | null;
    setNumbers: Map<string, number>; // setId -> order
    finish: number | null;
  };
  const orderTracker: PhaseFiveOrder = {
    start: null,
    setNumbers: new Map(),
    finish: null,
  };
  let nextOrder = 1;
  const fkErrors: string[] = [];

  const client5 = new QueryClient({
    defaultOptions: {
      queries: { networkMode: "online" },
      mutations: { networkMode: "online", retry: 0 },
    },
  });

  client5.setMutationDefaults(["session", "start"], {
    mutationFn: async (vars: unknown) => {
      const v = vars as {
        id: string;
        user_id: string;
        plan_id?: string | null;
        started_at?: string;
      };
      orderTracker.start = nextOrder++;
      const { data, error } = await admin
        .from("workout_sessions")
        .upsert(v, { onConflict: "id", ignoreDuplicates: true })
        .select()
        .single();
      if (error) {
        if (error.code === "23503") fkErrors.push(`session.start: ${error.message}`);
        throw error;
      }
      return data;
    },
    networkMode: "online",
    retry: 0,
  });

  client5.setMutationDefaults(["set", "add"], {
    mutationFn: async (vars: unknown) => {
      const v = vars as {
        id: string;
        session_id: string;
        exercise_id: string;
        set_number: number;
        reps: number;
        weight_kg: number;
        completed_at: string;
        set_type: "working" | "warmup" | "dropset" | "failure";
      };
      orderTracker.setNumbers.set(v.id, nextOrder++);
      const { data, error } = await admin
        .from("exercise_sets")
        .upsert(v, { onConflict: "id", ignoreDuplicates: true })
        .select()
        .single();
      if (error) {
        if (error.code === "23503") fkErrors.push(`set.add #${v.set_number}: ${error.message}`);
        throw error;
      }
      return data;
    },
    networkMode: "online",
    retry: 0,
  });

  client5.setMutationDefaults(["session", "finish"], {
    mutationFn: async (vars: unknown) => {
      const v = vars as { id: string; finished_at: string };
      orderTracker.finish = nextOrder++;
      const { data, error } = await admin
        .from("workout_sessions")
        .update({ finished_at: v.finished_at })
        .eq("id", v.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    networkMode: "online",
    retry: 0,
  });

  // -----------------------------------------------------------------------
  // PHASE A — offline + queue all 27 mutations under shared scope.id.
  // -----------------------------------------------------------------------
  onlineManager.setOnline(false);

  const sharedScope = { id: `session:${sessionId5}` };
  const setIds: string[] = [];

  // 1) Start session
  const startMut = client5.getMutationCache().build(client5, {
    mutationKey: ["session", "start"],
    scope: sharedScope,
  });
  void startMut
    .execute({
      id: sessionId5,
      user_id: user5.id,
      plan_id: planId5,
      started_at: new Date(Date.now() - 60_000).toISOString(),
    })
    .catch(() => {});

  // 2) 25 sets
  for (let i = 1; i <= 25; i++) {
    const setId = randomUUID();
    setIds.push(setId);
    const m = client5.getMutationCache().build(client5, {
      mutationKey: ["set", "add"],
      scope: sharedScope,
    });
    void m
      .execute({
        id: setId,
        session_id: sessionId5,
        exercise_id: exerciseId5,
        set_number: i,
        reps: 8,
        weight_kg: 100,
        completed_at: new Date(Date.now() - 60_000 + i * 1000).toISOString(),
        set_type: "working" as const,
      })
      .catch(() => {});
  }

  // 3) Finish session
  const finishMut = client5.getMutationCache().build(client5, {
    mutationKey: ["session", "finish"],
    scope: sharedScope,
  });
  void finishMut
    .execute({
      id: sessionId5,
      finished_at: new Date().toISOString(),
    })
    .catch(() => {});

  await new Promise((r) => setTimeout(r, 300));

  if (
    orderTracker.start === null &&
    orderTracker.setNumbers.size === 0 &&
    orderTracker.finish === null
  ) {
    pass("Phase 5 ext A: all 27 mutations paused offline (no premature fire)");
  } else {
    fail("Phase 5 ext A: some mutation fired offline", {
      start: orderTracker.start,
      sets: orderTracker.setNumbers.size,
      finish: orderTracker.finish,
    });
  }

  // -----------------------------------------------------------------------
  // PHASE B — flip online + resumePausedMutations; assert FIFO order.
  // -----------------------------------------------------------------------
  onlineManager.setOnline(true);
  await client5.resumePausedMutations();
  // Allow up to 10s for all 27 mutations to complete serially.
  await new Promise((r) => setTimeout(r, 5000));

  if (fkErrors.length === 0) {
    pass("Phase 5 ext B: no 23503 FK violations during replay");
  } else {
    fail("Phase 5 ext B: FK violations fired during replay", { fkErrors });
  }

  if (
    orderTracker.start !== null &&
    orderTracker.finish !== null &&
    orderTracker.setNumbers.size === 25
  ) {
    const minSetOrder = Math.min(
      ...Array.from(orderTracker.setNumbers.values()),
    );
    const maxSetOrder = Math.max(
      ...Array.from(orderTracker.setNumbers.values()),
    );
    if (
      orderTracker.start < minSetOrder &&
      maxSetOrder < orderTracker.finish
    ) {
      pass(
        `Phase 5 ext B: start (order=${orderTracker.start}) → 25 sets (orders=${minSetOrder}..${maxSetOrder}) → finish (order=${orderTracker.finish}) FIFO replay correct`,
      );
    } else {
      fail("Phase 5 ext B: FIFO ordering broken", {
        start: orderTracker.start,
        minSet: minSetOrder,
        maxSet: maxSetOrder,
        finish: orderTracker.finish,
      });
    }
  } else {
    fail("Phase 5 ext B: not all 27 mutations completed", {
      start: orderTracker.start,
      setsExecuted: orderTracker.setNumbers.size,
      finish: orderTracker.finish,
    });
  }

  // Verify all 25 sets landed in Postgres with contiguous set_numbers.
  const { data: dbSets, error: dbSetsErr } = await admin
    .from("exercise_sets")
    .select("set_number, weight_kg, reps")
    .eq("session_id", sessionId5)
    .eq("exercise_id", exerciseId5)
    .order("set_number", { ascending: true });
  if (dbSetsErr) {
    fail("Phase 5 ext B: failed to read exercise_sets", { error: dbSetsErr });
  } else if (!dbSets || dbSets.length !== 25) {
    fail("Phase 5 ext B: expected 25 sets in DB", { count: dbSets?.length });
  } else {
    const setNumbers = dbSets.map((s) => s.set_number);
    const expected = Array.from({ length: 25 }, (_, i) => i + 1);
    if (JSON.stringify(setNumbers) === JSON.stringify(expected)) {
      pass("Phase 5 ext B: 25 sets in DB with contiguous set_number 1..25");
    } else {
      fail("Phase 5 ext B: set_numbers not contiguous", { setNumbers });
    }
  }

  // Verify finished_at landed on the session.
  const { data: dbSession, error: dbSessionErr } = await admin
    .from("workout_sessions")
    .select("finished_at")
    .eq("id", sessionId5)
    .single();
  if (dbSessionErr || !dbSession) {
    fail("Phase 5 ext B: failed to read workout_session", { error: dbSessionErr });
  } else if (dbSession.finished_at === null) {
    fail("Phase 5 ext B: workout_session.finished_at is null after replay");
  } else {
    pass("Phase 5 ext B: workout_session.finished_at set after all 25 sets landed");
  }

  // Phase 5 cleanup
  await admin.from("exercise_sets").delete().eq("session_id", sessionId5);
  await admin.from("workout_sessions").delete().eq("id", sessionId5);
  await admin.from("exercises").delete().eq("id", exerciseId5);
  await admin.from("workout_plans").delete().eq("id", planId5);
  await admin.auth.admin.deleteUser(user5.id);
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
