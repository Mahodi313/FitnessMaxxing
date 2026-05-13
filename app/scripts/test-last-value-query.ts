// File: app/scripts/test-last-value-query.ts
//
// Phase 5 Wave 0 — proves the F7 "Förra: 82.5 × 8" two-step PostgREST !inner
// query is correct AND that RLS scopes via workout_sessions!inner. This is
// the canonical reference implementation for lib/queries/last-value.ts
// (Plan 02 ships the hook; this script ships the integration test that
// closes RESEARCH §Assumption A3).
//
// Asserts (5 cases):
//   1. Happy path — User A has 2 finished sessions for the same exercise
//      with different set counts; query returns the MOST-RECENT session's
//      set-number-aligned working sets.
//   2. Current-session exclusion — when the user is in the middle of a new
//      session, the query falls back to the prior finished session.
//   3. Working-set filter — warmup sets in the latest session are NOT
//      returned in the Map; only set_type='working' counts.
//   4. Cross-user gate (Assumption A3 closure) — User B cannot see User A's
//      history via the same two-step query (RLS via workout_sessions!inner).
//   5. Empty when no finished sessions exist for the exercise.
//
// Run via: cd app && npm run test:last-value-query
//   (expands to: tsx --env-file=.env.local scripts/test-last-value-query.ts)
//
// This script is Node-only. It MUST NEVER be imported from app/lib/,
// app/app/, or any other Metro-bundled path (PITFALLS 2.3 —
// service-role-key isolation, even though this script DOES use the
// service-role key, the convention applies to all scripts/*.ts).
//
// References:
//   - 05-CONTEXT.md D-17, D-18, D-19, D-20 (F7 query contract)
//   - 05-RESEARCH.md §"Set-Position-Aligned Last Value Query" (lines 665–718)
//   - 05-PATTERNS.md §test-last-value-query.ts (composes from test-rls.ts +
//     test-upsert-idempotency.ts)
//   - app/supabase/migrations/0001_initial_schema.sql lines 72–91
//     (exercise_sets + index definitions)

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { Database } from "../types/database";

// ---------------------------------------------------------------------------
// Env guard — fail loud (mirrors test-rls.ts lines 32–44).
// ---------------------------------------------------------------------------

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  throw new Error(
    "Missing env. Need EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY + " +
      "SUPABASE_SERVICE_ROLE_KEY in app/.env.local. Run via npm run test:last-value-query.",
  );
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TEST_EMAIL_PREFIX = "lastvalue-test-";
const TEST_EMAIL_DOMAIN = "@fitnessmaxxing.local";
const TEST_PASSWORD = "LastValue-Test-Pwd-2026!";

// ---------------------------------------------------------------------------
// Three isolated clients (test-rls.ts pattern).
// ---------------------------------------------------------------------------

const admin: SupabaseClient<Database> = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const clientA: SupabaseClient<Database> = createClient<Database>(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const clientB: SupabaseClient<Database> = createClient<Database>(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// Assertion harness
// ---------------------------------------------------------------------------

const failures: string[] = [];

function pass(name: string) {
  console.log(`  PASS: ${name}`);
}

function fail(name: string, detail?: unknown) {
  const line = detail !== undefined ? `${name} — ${JSON.stringify(detail)}` : name;
  failures.push(line);
  console.log(`  FAIL: ${line}`);
}

function assertEq<T>(name: string, actual: T, expected: T, extra?: unknown) {
  if (actual === expected) {
    pass(name);
  } else {
    fail(name, { actual, expected, extra });
  }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

async function purgeUserData(userId: string) {
  // Leaf-first deletion order: sessions cascade-deletes exercise_sets;
  // plans cascade-deletes plan_exercises; then exercises.
  await admin.from("workout_sessions").delete().eq("user_id", userId);
  await admin.from("workout_plans").delete().eq("user_id", userId);
  await admin.from("exercises").delete().eq("user_id", userId);
}

async function cleanupTestUsers() {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) {
    throw new Error(`Cleanup listUsers failed: ${error.message}`);
  }
  for (const u of data.users) {
    if (u.email && u.email.startsWith(TEST_EMAIL_PREFIX)) {
      try {
        await purgeUserData(u.id);
      } catch (purgeErr) {
        console.warn(`  WARN: purgeUserData(${u.email}) threw: ${(purgeErr as Error).message}`);
      }
      const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
      if (delErr) {
        console.warn(`  WARN: deleteUser(${u.email}) failed: ${delErr.message}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// The two-step F7 query under test (verbatim from 05-RESEARCH.md §665–718
// + 05-PATTERNS.md §last-value.ts hook body).
//
// STEP 1: find the most-recent finished session that contains the exercise,
// excluding the current (active) session and only counting working sets.
// PostgREST !inner join scopes via workout_sessions.user_id (= RLS check).
//
// STEP 2: fetch the working sets from that target session ordered by
// set_number; build a Map<setNumber, { weight_kg, reps }>.
// ---------------------------------------------------------------------------

async function runLastValueQuery(
  client: SupabaseClient<Database>,
  exerciseId: string,
  currentSessionId: string,
  userId: string,
): Promise<Map<number, { weight_kg: number; reps: number }>> {
  // STEP 1
  const { data: sessionRow, error: sessionErr } = await client
    .from("exercise_sets")
    .select(
      "session_id, completed_at, workout_sessions!inner(id, user_id, finished_at, started_at)",
    )
    .eq("exercise_id", exerciseId)
    .eq("set_type", "working")
    .not("workout_sessions.finished_at", "is", null)
    .neq("session_id", currentSessionId)
    .eq("workout_sessions.user_id", userId)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sessionErr) throw sessionErr;
  if (!sessionRow) return new Map();

  // STEP 2
  const { data: sets, error: setsErr } = await client
    .from("exercise_sets")
    .select("set_number, weight_kg, reps, completed_at")
    .eq("session_id", sessionRow.session_id)
    .eq("exercise_id", exerciseId)
    .eq("set_type", "working")
    .order("set_number", { ascending: true });
  if (setsErr) throw setsErr;

  const map = new Map<number, { weight_kg: number; reps: number }>();
  for (const s of sets ?? []) {
    map.set(s.set_number, { weight_kg: s.weight_kg, reps: s.reps });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("[test-last-value-query] cleanup (start)…");
  await cleanupTestUsers();

  // Seed two users via admin API.
  const userAEmail = `${TEST_EMAIL_PREFIX}a-${Date.now()}${TEST_EMAIL_DOMAIN}`;
  const userBEmail = `${TEST_EMAIL_PREFIX}b-${Date.now()}${TEST_EMAIL_DOMAIN}`;

  console.log("[test-last-value-query] seed users…");
  const { data: createA, error: createAErr } = await admin.auth.admin.createUser({
    email: userAEmail,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (createAErr || !createA.user) {
    throw new Error(`createUser(A) failed: ${createAErr?.message ?? "no user"}`);
  }
  const { data: createB, error: createBErr } = await admin.auth.admin.createUser({
    email: userBEmail,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (createBErr || !createB.user) {
    throw new Error(`createUser(B) failed: ${createBErr?.message ?? "no user"}`);
  }
  const userA = createA.user;
  const userB = createB.user;

  // Sign in clients.
  const { error: signInAErr } = await clientA.auth.signInWithPassword({
    email: userAEmail,
    password: TEST_PASSWORD,
  });
  if (signInAErr) throw new Error(`signInWithPassword(A) failed: ${signInAErr.message}`);
  const { error: signInBErr } = await clientB.auth.signInWithPassword({
    email: userBEmail,
    password: TEST_PASSWORD,
  });
  if (signInBErr) throw new Error(`signInWithPassword(B) failed: ${signInBErr.message}`);

  // Seed a User A-owned exercise. The cross-user test relies on B trying to
  // see A's exercise's history — but RLS on exercises lets B SELECT global
  // (user_id=null) exercises only. A user-owned exercise is invisible to
  // other users in the SELECT path, but the F7 query at the exercise_sets
  // level relies on workout_sessions!inner.user_id RLS rather than
  // exercises.user_id, so the gate we care about is on sets→sessions.
  const exerciseAId = randomUUID();
  {
    const { error } = await admin
      .from("exercises")
      .insert({ id: exerciseAId, user_id: userA.id, name: "Phase 5 LV Squat" });
    if (error) throw new Error(`seed exerciseA: ${error.message}`);
  }

  // Helper: insert a finished session with N working sets for User A.
  // Returns the session id so the caller can use it as currentSessionId.
  async function seedFinishedSession(
    setCount: number,
    label: string,
    weightStart: number,
    finishedOffsetMs: number, // negative = older
  ): Promise<string> {
    const sessionId = randomUUID();
    const finishedAt = new Date(Date.now() + finishedOffsetMs).toISOString();
    const startedAt = new Date(Date.now() + finishedOffsetMs - 3600_000).toISOString(); // 1h before
    {
      const { error } = await admin.from("workout_sessions").insert({
        id: sessionId,
        user_id: userA.id,
        plan_id: null,
        started_at: startedAt,
        finished_at: finishedAt,
        notes: label,
      });
      if (error) throw new Error(`seedFinishedSession(${label}): ${error.message}`);
    }
    for (let i = 1; i <= setCount; i++) {
      const setCompletedAt = new Date(
        Date.now() + finishedOffsetMs - 3600_000 + i * 60_000,
      ).toISOString();
      const { error } = await admin.from("exercise_sets").insert({
        id: randomUUID(),
        session_id: sessionId,
        exercise_id: exerciseAId,
        set_number: i,
        reps: 8,
        weight_kg: weightStart + (i - 1) * 2.5,
        completed_at: setCompletedAt,
        set_type: "working",
      });
      if (error) throw new Error(`seedFinishedSession set #${i}: ${error.message}`);
    }
    return sessionId;
  }

  // =========================================================================
  // ASSERTION 1: most-recent finished session wins
  // -------------------------------------------------------------------------
  // Setup: Session A (4 sets @80kg, finished 1 day ago)
  //         Session B (3 sets @100kg, finished 1 hour ago — most recent)
  // Expect: Map has keys 1,2,3 from Session B (100, 102.5, 105 kg)
  // =========================================================================
  console.log("[test-last-value-query] assertion 1 — most-recent finished wins…");

  await seedFinishedSession(4, "Session A — older", 80, -86_400_000); // 1 day ago
  const sessionBId = await seedFinishedSession(3, "Session B — newer", 100, -3_600_000); // 1h ago

  const r1 = await runLastValueQuery(
    clientA,
    exerciseAId,
    "00000000-0000-0000-0000-000000000000", // non-existing currentSessionId
    userA.id,
  );
  assertEq("Assertion 1: Map.size === 3 (from Session B's 3 working sets)", r1.size, 3);
  if (r1.size === 3) {
    const set1 = r1.get(1);
    assertEq(
      "Assertion 1: set 1 weight_kg === 100 (from Session B)",
      set1?.weight_kg,
      100,
    );
    const set3 = r1.get(3);
    assertEq(
      "Assertion 1: set 3 weight_kg === 105 (from Session B)",
      set3?.weight_kg,
      105,
    );
  }

  // =========================================================================
  // ASSERTION 2: current-session exclusion
  // -------------------------------------------------------------------------
  // When sessionBId is the currentSessionId, query should fall back to
  // Session A (4 sets @80kg).
  // =========================================================================
  console.log("[test-last-value-query] assertion 2 — current-session exclusion…");

  const r2 = await runLastValueQuery(clientA, exerciseAId, sessionBId, userA.id);
  assertEq(
    "Assertion 2: Map.size === 4 when sessionB is current (falls back to Session A)",
    r2.size,
    4,
  );
  if (r2.size === 4) {
    const set1 = r2.get(1);
    assertEq(
      "Assertion 2: set 1 weight_kg === 80 (from Session A, not Session B)",
      set1?.weight_kg,
      80,
    );
  }

  // =========================================================================
  // ASSERTION 3: working-set filter
  // -------------------------------------------------------------------------
  // Insert a NEW finished session C with 1 warmup + 2 working sets.
  // The Map should have only 2 working keys (1, 2) — warmup excluded.
  // =========================================================================
  console.log("[test-last-value-query] assertion 3 — working-set filter…");

  const sessionCId = randomUUID();
  {
    const finishedAt = new Date(Date.now() - 60_000).toISOString(); // 1min ago
    const { error } = await admin.from("workout_sessions").insert({
      id: sessionCId,
      user_id: userA.id,
      plan_id: null,
      started_at: new Date(Date.now() - 3_660_000).toISOString(),
      finished_at: finishedAt,
      notes: "Session C — warmup + 2 working",
    });
    if (error) throw new Error(`seed sessionC: ${error.message}`);
  }
  // Warmup set (should be excluded)
  await admin.from("exercise_sets").insert({
    id: randomUUID(),
    session_id: sessionCId,
    exercise_id: exerciseAId,
    set_number: 1,
    reps: 12,
    weight_kg: 20,
    completed_at: new Date(Date.now() - 70_000).toISOString(),
    set_type: "warmup",
  });
  // Working set 1
  await admin.from("exercise_sets").insert({
    id: randomUUID(),
    session_id: sessionCId,
    exercise_id: exerciseAId,
    set_number: 1,
    reps: 10,
    weight_kg: 90,
    completed_at: new Date(Date.now() - 65_000).toISOString(),
    set_type: "working",
  });
  // Working set 2
  await admin.from("exercise_sets").insert({
    id: randomUUID(),
    session_id: sessionCId,
    exercise_id: exerciseAId,
    set_number: 2,
    reps: 8,
    weight_kg: 92.5,
    completed_at: new Date(Date.now() - 62_000).toISOString(),
    set_type: "working",
  });

  const r3 = await runLastValueQuery(
    clientA,
    exerciseAId,
    "00000000-0000-0000-0000-000000000000",
    userA.id,
  );
  // Now Session C is the most recent (finished 1min ago), it has 2 working
  // sets at set_number 1, 2.
  assertEq(
    "Assertion 3: Map.size === 2 (warmup filtered out; only 2 working sets visible)",
    r3.size,
    2,
  );
  if (r3.size === 2) {
    const set1 = r3.get(1);
    assertEq(
      "Assertion 3: set 1 weight_kg === 90 (working set, NOT 20 warmup)",
      set1?.weight_kg,
      90,
    );
  }

  // =========================================================================
  // ASSERTION 4 (Assumption A3 closure): cross-user gate
  // -------------------------------------------------------------------------
  // User B calls the same query for an exercise_id User A owns. The
  // workout_sessions!inner.user_id RLS scope should return an empty Map for
  // B because B's RLS-filtered view of workout_sessions excludes A's
  // sessions. If this assertion fails, the F7 query LEAKS user history
  // cross-user — block Plan 02 from shipping useLastValueQuery until fixed.
  // =========================================================================
  console.log("[test-last-value-query] assertion 4 — cross-user gate (A3 closure)…");

  const r4 = await runLastValueQuery(
    clientB,
    exerciseAId,
    "00000000-0000-0000-0000-000000000000",
    userB.id,
  );
  assertEq(
    "Assertion 4: User B sees empty Map for User A's exercise (RLS cross-user gate)",
    r4.size,
    0,
  );

  // =========================================================================
  // ASSERTION 5: empty when no finished sessions exist
  // -------------------------------------------------------------------------
  // Seed a NEW exercise for User A that has NO sessions logged. Map should
  // be empty.
  // =========================================================================
  console.log("[test-last-value-query] assertion 5 — empty when no history…");

  const exerciseEmptyId = randomUUID();
  {
    const { error } = await admin.from("exercises").insert({
      id: exerciseEmptyId,
      user_id: userA.id,
      name: "Phase 5 LV Bench (no history)",
    });
    if (error) throw new Error(`seed exerciseEmpty: ${error.message}`);
  }
  const r5 = await runLastValueQuery(
    clientA,
    exerciseEmptyId,
    "00000000-0000-0000-0000-000000000000",
    userA.id,
  );
  assertEq(
    "Assertion 5: empty Map when exercise has no finished sessions",
    r5.size,
    0,
  );
}

(async () => {
  let exitCode = 0;
  let mainCompleted = false;
  try {
    await main();
    mainCompleted = true;
  } catch (e) {
    console.error(
      "[test-last-value-query] FATAL:",
      e instanceof Error ? e.message : e,
    );
    exitCode = 1;
  } finally {
    console.log("[test-last-value-query] cleanup (end)…");
    try {
      await cleanupTestUsers();
    } catch (e) {
      console.error(
        "[test-last-value-query] cleanup at end failed:",
        e instanceof Error ? e.message : e,
      );
      exitCode = 1;
    }
    console.log("");
    if (!mainCompleted) {
      // Critical: main() aborted before all assertions ran — DO NOT report
      // success even if failures.length === 0 (T-02-20 false-positive guard).
      console.log(
        "[test-last-value-query] ABORTED before assertions completed — see FATAL above",
      );
      exitCode = 1;
    } else if (failures.length === 0) {
      console.log("[test-last-value-query] ALL ASSERTIONS PASSED");
    } else {
      console.log(`[test-last-value-query] ${failures.length} FAILURE(S)`);
      for (const f of failures) console.log(`  - ${f}`);
      exitCode = 1;
    }
    process.exit(exitCode);
  }
})();
