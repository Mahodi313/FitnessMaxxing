// File: app/scripts/test-exercise-chart.ts
//
// Phase 6 Wave 0 — proves the three Phase 6 RPCs deployed in migration 0006:
//   - get_session_summaries (F9 cursor-paginated history list)
//   - get_exercise_chart (F10 per-day max-weight / total-volume aggregate)
//   - get_exercise_top_sets (F10 'Senaste 10 passen' BLOCKER-2 list)
//
// Asserts THIRTEEN behaviours across the three RPCs (A–M):
//
// F9 — get_session_summaries (5 assertions A–E):
//   (A) Happy path — 5 finished sessions for User A → 5 rows DESC-sorted by
//       started_at, each with set_count > 0 + total_volume_kg > 0 + plan_name.
//   (B) Cursor pagination terminates: seed total 25 finished sessions →
//       page 1 = 20, page 2 = 5, page 3 = 0.
//   (C) finished_at IS NULL filter: 1 draft + 1 finished → RPC returns ONLY
//       the finished session.
//   (D) Plan-name join WITHOUT archived_at filter (D-08): archived plan + 1
//       finished session for that plan → plan_name = archived plan's name.
//   (E) Cross-user RLS: A's sessions → clientB.rpc → ZERO rows.
//
// F10 — get_exercise_chart (5 assertions F–J):
//   (F) Weight metric: 5 sessions across 5 days, 1 working set each → 5 rows
//       with day = midnight, value = max(weight_kg) per day.
//   (G) Volume metric: same data, metric='volume' → sum(weight_kg * reps).
//   (H) set_type='working' filter: 2 working + 1 warmup same day → returned
//       value is max of WORKING only (warmup excluded).
//   (I) since-window filter: sets at -10d / -100d / -400d → p_since=-90d
//       returns only -10d row; p_since=null returns all 3 days.
//   (J) Cross-user RLS: A's data → clientB call with A's exercise_id →
//       empty data.
//
// F10 — get_exercise_top_sets (3 assertions K–M, BLOCKER-2 contract):
//   (K) Ordering & reps preservation: 3 sessions with multiple working sets
//       each → 3 rows, one per session, top-weight set's (weight_kg, reps)
//       preserved exactly, sorted DESC by completed_at (most-recent first).
//   (L) Limit honoured: 12 finished sessions → p_limit=10 → exactly 10 rows.
//   (M) Cross-user RLS: clientB with A's exercise_id → empty data.
//
// Run via: cd app && npm run test:exercise-chart
//   (expands to: tsx --env-file=.env.local scripts/test-exercise-chart.ts)
//
// This script is Node-only. It MUST NEVER be imported from app/lib/,
// app/app/, or any other Metro-bundled path (PITFALLS 2.3 —
// service-role-key isolation).
//
// References:
//   - .planning/phases/06-history-read-side-polish/06-RESEARCH.md §Pattern 3 + 4
//   - .planning/phases/06-history-read-side-polish/06-VALIDATION.md
//   - .planning/phases/06-history-read-side-polish/06-01a-PLAN.md (Task 2)
//   - app/supabase/migrations/0006_phase6_chart_rpcs.sql (the RPC bodies)

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { Database } from "../types/database";

// ---------------------------------------------------------------------------
// Env guard — fail loud.
// ---------------------------------------------------------------------------

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  throw new Error(
    "Missing env. Need EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY + " +
      "SUPABASE_SERVICE_ROLE_KEY in app/.env.local. Run via npm run test:exercise-chart.",
  );
}

// ---------------------------------------------------------------------------
// Test fixtures.
// ---------------------------------------------------------------------------

const TEST_EMAIL_PREFIX = "chart-test-";
const TEST_EMAIL_DOMAIN = "@fitnessmaxxing.local";
const TEST_PASSWORD = "Chart-Test-Pwd-2026!";

// ---------------------------------------------------------------------------
// Three isolated clients (test-last-value-query.ts pattern).
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
// Assertion harness.
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

function assertNumberEq(name: string, actual: unknown, expected: number) {
  // numeric values from Postgres come back as either number or string ("82.5")
  // depending on the driver. Coerce-then-compare so the assertion is robust.
  const actualNum = typeof actual === "number" ? actual : Number(actual);
  if (Number.isFinite(actualNum) && actualNum === expected) {
    pass(name);
  } else {
    fail(name, { actual, actualCoerced: actualNum, expected });
  }
}

// ---------------------------------------------------------------------------
// Cleanup.
// ---------------------------------------------------------------------------

async function purgeUserData(userId: string) {
  // Leaf-first deletion order: workout_sessions cascade-deletes exercise_sets.
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
        console.warn(
          `  WARN: purgeUserData(${u.email}) threw: ${(purgeErr as Error).message}`,
        );
      }
      const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
      if (delErr) {
        console.warn(`  WARN: deleteUser(${u.email}) failed: ${delErr.message}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Seed helpers.
// ---------------------------------------------------------------------------

type SeededSet = {
  setNumber: number;
  weightKg: number;
  reps: number;
  setType: "working" | "warmup" | "dropset" | "failure";
};

/**
 * Insert a finished session for the given user + exercise with the supplied
 * sets. `finishedOffsetMs` is the offset from now() in milliseconds (negative
 * = older); started_at is offset minus 1h. Returns the new session_id.
 */
async function seedFinishedSession(
  userId: string,
  planId: string | null,
  exerciseId: string,
  sets: SeededSet[],
  finishedOffsetMs: number,
): Promise<string> {
  const sessionId = randomUUID();
  const finishedAt = new Date(Date.now() + finishedOffsetMs).toISOString();
  const startedAt = new Date(Date.now() + finishedOffsetMs - 3600_000).toISOString();
  {
    const { error } = await admin.from("workout_sessions").insert({
      id: sessionId,
      user_id: userId,
      plan_id: planId,
      started_at: startedAt,
      finished_at: finishedAt,
    });
    if (error) throw new Error(`seedFinishedSession session: ${error.message}`);
  }
  for (const s of sets) {
    const completedAt = new Date(
      Date.now() + finishedOffsetMs - 3600_000 + s.setNumber * 60_000,
    ).toISOString();
    const { error } = await admin.from("exercise_sets").insert({
      id: randomUUID(),
      session_id: sessionId,
      exercise_id: exerciseId,
      set_number: s.setNumber,
      reps: s.reps,
      weight_kg: s.weightKg,
      completed_at: completedAt,
      set_type: s.setType,
    });
    if (error)
      throw new Error(
        `seedFinishedSession set sn=${s.setNumber}: ${error.message}`,
      );
  }
  return sessionId;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("[test-exercise-chart] cleanup (start)…");
  await cleanupTestUsers();

  // Seed two users via admin API.
  const userAEmail = `${TEST_EMAIL_PREFIX}a-${Date.now()}${TEST_EMAIL_DOMAIN}`;
  const userBEmail = `${TEST_EMAIL_PREFIX}b-${Date.now()}${TEST_EMAIL_DOMAIN}`;

  console.log("[test-exercise-chart] seed users…");
  const { data: createA, error: createAErr } =
    await admin.auth.admin.createUser({
      email: userAEmail,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
  if (createAErr || !createA.user)
    throw new Error(`createUser(A): ${createAErr?.message ?? "no user"}`);
  const { data: createB, error: createBErr } =
    await admin.auth.admin.createUser({
      email: userBEmail,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
  if (createBErr || !createB.user)
    throw new Error(`createUser(B): ${createBErr?.message ?? "no user"}`);
  const userA = createA.user;
  const userB = createB.user;

  // Sign in clients.
  const { error: signInAErr } = await clientA.auth.signInWithPassword({
    email: userAEmail,
    password: TEST_PASSWORD,
  });
  if (signInAErr) throw new Error(`signInWithPassword(A): ${signInAErr.message}`);
  const { error: signInBErr } = await clientB.auth.signInWithPassword({
    email: userBEmail,
    password: TEST_PASSWORD,
  });
  if (signInBErr) throw new Error(`signInWithPassword(B): ${signInBErr.message}`);

  // Seed an exercise for User A (admin-side bypass — exercises RLS is fine
  // either way for the seed).
  const exerciseAId = randomUUID();
  {
    const { error } = await admin
      .from("exercises")
      .insert({ id: exerciseAId, user_id: userA.id, name: "Phase 6 Squat" });
    if (error) throw new Error(`seed exerciseA: ${error.message}`);
  }

  // ==========================================================================
  // F9 — get_session_summaries assertions A–E
  // ==========================================================================
  console.log(
    "\n[test-exercise-chart] === F9 get_session_summaries (A–E) ===",
  );

  // ---- (A) Happy path: 5 finished sessions, plan-name joined ---------------
  // Seed a plan (User A owns it; the admin client bypasses RLS for fixture
  // setup).
  const planAId = randomUUID();
  {
    const { error } = await admin
      .from("workout_plans")
      .insert({ id: planAId, user_id: userA.id, name: "Phase 6 Plan A" });
    if (error) throw new Error(`seed planA: ${error.message}`);
  }
  // Seed 5 finished sessions over different days.
  for (let i = 0; i < 5; i++) {
    await seedFinishedSession(
      userA.id,
      planAId,
      exerciseAId,
      [
        { setNumber: 1, weightKg: 100, reps: 8, setType: "working" },
        { setNumber: 2, weightKg: 102.5, reps: 6, setType: "working" },
      ],
      -1 * (i + 1) * 86_400_000, // -1d, -2d, -3d, -4d, -5d
    );
  }

  console.log("[test-exercise-chart] (A) Happy path 5 sessions…");
  {
    const { data, error } = await clientA.rpc("get_session_summaries", {
      p_cursor: null as unknown as string,
      p_page_size: 20,
    });
    if (error) {
      fail("(A) get_session_summaries returned error", { error });
    } else {
      assertEq("(A) Returned 5 rows", data?.length, 5);
      if (data && data.length === 5) {
        // DESC-sorted check: each row's started_at >= the next row's.
        let descOk = true;
        for (let i = 0; i < data.length - 1; i++) {
          if (
            new Date(data[i].started_at).getTime() <
            new Date(data[i + 1].started_at).getTime()
          ) {
            descOk = false;
            break;
          }
        }
        assertEq("(A) Rows DESC-sorted by started_at", descOk, true);
        const first = data[0];
        if (first) {
          assertEq("(A) First row has non-null id", typeof first.id, "string");
          // set_count = 2 (both working sets per session)
          assertNumberEq("(A) First row set_count === 2", first.set_count, 2);
          // total_volume_kg = 100*8 + 102.5*6 = 800 + 615 = 1415
          assertNumberEq(
            "(A) First row total_volume_kg === 1415",
            first.total_volume_kg,
            1415,
          );
          assertEq(
            "(A) First row plan_name === 'Phase 6 Plan A'",
            first.plan_name,
            "Phase 6 Plan A",
          );
        }
      }
    }
  }

  // ---- (B) Cursor pagination terminates -----------------------------------
  // We already seeded 5 sessions; seed 20 MORE so total = 25.
  console.log("[test-exercise-chart] (B) Cursor pagination terminates…");
  for (let i = 0; i < 20; i++) {
    await seedFinishedSession(
      userA.id,
      planAId,
      exerciseAId,
      [{ setNumber: 1, weightKg: 80, reps: 5, setType: "working" }],
      -1 * (i + 6) * 86_400_000, // -6d to -25d
    );
  }
  {
    // Page 1 — cursor=null, page_size=20 → 20 rows
    const { data: p1, error: p1err } = await clientA.rpc(
      "get_session_summaries",
      { p_cursor: null as unknown as string, p_page_size: 20 },
    );
    if (p1err) {
      fail("(B) Page 1 RPC error", { error: p1err });
    } else {
      assertEq("(B) Page 1 returned exactly 20 rows", p1?.length, 20);
      if (p1 && p1.length === 20) {
        const cursorAfterP1 = p1[19].started_at;
        // Page 2 — cursor=cursorAfterP1, page_size=20 → 5 rows
        const { data: p2, error: p2err } = await clientA.rpc(
          "get_session_summaries",
          { p_cursor: cursorAfterP1, p_page_size: 20 },
        );
        if (p2err) {
          fail("(B) Page 2 RPC error", { error: p2err });
        } else {
          assertEq("(B) Page 2 returned exactly 5 rows", p2?.length, 5);
          if (p2 && p2.length === 5) {
            const cursorAfterP2 = p2[4].started_at;
            // Page 3 — cursor=cursorAfterP2, page_size=20 → 0 rows
            const { data: p3, error: p3err } = await clientA.rpc(
              "get_session_summaries",
              { p_cursor: cursorAfterP2, p_page_size: 20 },
            );
            if (p3err) {
              fail("(B) Page 3 RPC error", { error: p3err });
            } else {
              assertEq(
                "(B) Page 3 returned exactly 0 rows (pagination terminates)",
                p3?.length,
                0,
              );
            }
          }
        }
      }
    }
  }

  // ---- (C) finished_at IS NULL filter --------------------------------------
  console.log("[test-exercise-chart] (C) finished_at IS NULL filter…");
  // Seed 1 DRAFT session (finished_at = null) for User A.
  const draftSessionId = randomUUID();
  {
    const { error } = await admin.from("workout_sessions").insert({
      id: draftSessionId,
      user_id: userA.id,
      plan_id: null,
      started_at: new Date(Date.now() - 5 * 60_000).toISOString(),
      finished_at: null,
    });
    if (error) throw new Error(`seed draft session: ${error.message}`);
  }
  // The 25 finished sessions from (A)+(B) are still around. Fetch with a
  // generous page_size and assert the draft is not present.
  {
    const { data, error } = await clientA.rpc("get_session_summaries", {
      p_cursor: null as unknown as string,
      p_page_size: 100,
    });
    if (error) {
      fail("(C) RPC error", { error });
    } else {
      const draftPresent =
        data?.some((s: { id: string }) => s.id === draftSessionId) ?? false;
      assertEq(
        "(C) Draft session (finished_at=null) is NOT in summaries",
        draftPresent,
        false,
      );
    }
  }
  // Clean up the draft session so it doesn't pollute later assertions.
  await admin.from("workout_sessions").delete().eq("id", draftSessionId);

  // ---- (D) Plan-name join WITHOUT archived_at filter (D-08) ----------------
  console.log("[test-exercise-chart] (D) Archived plan name still joined…");
  const archivedPlanId = randomUUID();
  const archivedPlanName = "Phase 6 Archived Plan";
  {
    const { error } = await admin.from("workout_plans").insert({
      id: archivedPlanId,
      user_id: userA.id,
      name: archivedPlanName,
      archived_at: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    });
    if (error) throw new Error(`seed archived plan: ${error.message}`);
  }
  const archivedSessionId = await seedFinishedSession(
    userA.id,
    archivedPlanId,
    exerciseAId,
    [{ setNumber: 1, weightKg: 90, reps: 5, setType: "working" }],
    -30 * 60_000, // 30 min ago — most recent
  );
  {
    const { data, error } = await clientA.rpc("get_session_summaries", {
      p_cursor: null as unknown as string,
      p_page_size: 100,
    });
    if (error) {
      fail("(D) RPC error", { error });
    } else {
      const archivedRow = data?.find(
        (s: { id: string }) => s.id === archivedSessionId,
      );
      if (!archivedRow) {
        fail("(D) Archived-plan session not in summaries", { archivedSessionId });
      } else {
        assertEq(
          "(D) Archived plan name still joined (no archived_at filter)",
          archivedRow.plan_name,
          archivedPlanName,
        );
      }
    }
  }

  // ---- (E) Cross-user RLS --------------------------------------------------
  console.log("[test-exercise-chart] (E) Cross-user RLS on get_session_summaries…");
  {
    const { data, error } = await clientB.rpc("get_session_summaries", {
      p_cursor: null as unknown as string,
      p_page_size: 100,
    });
    if (error) {
      fail("(E) clientB RPC error", { error });
    } else {
      assertEq(
        "(E) clientB returns ZERO rows (User A's sessions not leaked)",
        data?.length ?? -1,
        0,
      );
    }
  }

  // ==========================================================================
  // F10 — get_exercise_chart assertions F–J
  // ==========================================================================
  console.log(
    "\n[test-exercise-chart] === F10 get_exercise_chart (F–J) ===",
  );

  // Fresh exercise to keep chart assertions isolated from F9 noise.
  const chartExerciseId = randomUUID();
  {
    const { error } = await admin
      .from("exercises")
      .insert({ id: chartExerciseId, user_id: userA.id, name: "Phase 6 Chart Bench" });
    if (error) throw new Error(`seed chartExercise: ${error.message}`);
  }

  // ---- (F) Weight metric ---------------------------------------------------
  // 5 finished sessions on 5 distinct days, each with one working set.
  // Weights 100, 101, 102, 103, 104. Days = -5d..-1d.
  console.log("[test-exercise-chart] (F) Weight metric — 5 days, max(weight)…");
  for (let i = 0; i < 5; i++) {
    await seedFinishedSession(
      userA.id,
      null,
      chartExerciseId,
      [{ setNumber: 1, weightKg: 100 + i, reps: 8, setType: "working" }],
      -1 * (5 - i) * 86_400_000, // -5d, -4d, -3d, -2d, -1d
    );
  }
  {
    const { data, error } = await clientA.rpc("get_exercise_chart", {
      p_exercise_id: chartExerciseId,
      p_metric: "weight",
      p_since: null as unknown as string,
    });
    if (error) {
      fail("(F) RPC error", { error });
    } else {
      assertEq("(F) Returned 5 rows (one per day)", data?.length, 5);
      if (data && data.length === 5) {
        // Ascending-by-day order asserted via the SQL; verify each `day` is
        // midnight (00:00:00 UTC). date_trunc('day', ...) drops sub-day.
        let midnightOk = true;
        for (const row of data) {
          const d = new Date(row.day);
          if (d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0) {
            midnightOk = false;
            break;
          }
        }
        assertEq("(F) Each row's day is midnight UTC", midnightOk, true);
        // Last row corresponds to the most-recent day (-1d) with weight 104.
        const lastValue = Number(data[data.length - 1].value);
        assertEq("(F) Last day's max-weight === 104", lastValue, 104);
      }
    }
  }

  // ---- (G) Volume metric ---------------------------------------------------
  console.log("[test-exercise-chart] (G) Volume metric — sum(weight*reps)…");
  {
    const { data, error } = await clientA.rpc("get_exercise_chart", {
      p_exercise_id: chartExerciseId,
      p_metric: "volume",
      p_since: null as unknown as string,
    });
    if (error) {
      fail("(G) RPC error", { error });
    } else {
      assertEq("(G) Returned 5 rows (one per day)", data?.length, 5);
      if (data && data.length === 5) {
        // Each day has 1 working set with reps=8, so volume = weight * 8.
        // Last day (weight 104) → volume = 832.
        const lastValue = Number(data[data.length - 1].value);
        assertEq("(G) Last day's volume === 104 * 8 === 832", lastValue, 832);
      }
    }
  }

  // ---- (H) set_type='working' filter (warmup excluded) ---------------------
  console.log(
    "[test-exercise-chart] (H) set_type filter — warmup excluded from aggregate…",
  );
  // Seed a new session with 2 working sets (sn=1 @ 110, sn=2 @ 112) + 1
  // warmup set (sn=3, weight=200 to make sure that if warmup leaked through
  // the filter, the assertion would be visibly wrong). All same day.
  // NOTE: 0.5h ago — distinct day from the 5 chart sessions to keep the
  // bucket isolated.
  const setTypeSessionId = randomUUID();
  {
    const finishedAt = new Date(Date.now() - 30 * 60_000).toISOString();
    const startedAt = new Date(Date.now() - 90 * 60_000).toISOString();
    const { error } = await admin.from("workout_sessions").insert({
      id: setTypeSessionId,
      user_id: userA.id,
      plan_id: null,
      started_at: startedAt,
      finished_at: finishedAt,
    });
    if (error) throw new Error(`seed setTypeSession: ${error.message}`);
  }
  for (const s of [
    { sn: 1, w: 110, type: "working" as const },
    { sn: 2, w: 112, type: "working" as const },
    { sn: 3, w: 200, type: "warmup" as const }, // poison if not filtered
  ]) {
    const completedAt = new Date(
      Date.now() - 30 * 60_000 + s.sn * 1_000,
    ).toISOString();
    const { error } = await admin.from("exercise_sets").insert({
      id: randomUUID(),
      session_id: setTypeSessionId,
      exercise_id: chartExerciseId,
      set_number: s.sn,
      reps: 5,
      weight_kg: s.w,
      completed_at: completedAt,
      set_type: s.type,
    });
    if (error) throw new Error(`seed set ${s.sn}: ${error.message}`);
  }
  {
    const { data, error } = await clientA.rpc("get_exercise_chart", {
      p_exercise_id: chartExerciseId,
      p_metric: "weight",
      // Tight window so we only see "today" — the past-5-days seeding
      // doesn't contaminate this bucket. -2h is enough since both sessions
      // fall within 90 min ago.
      p_since: new Date(Date.now() - 2 * 3600_000).toISOString(),
    });
    if (error) {
      fail("(H) RPC error", { error });
    } else {
      // Today's bucket should contain only the working sets (110, 112) →
      // max = 112, NOT 200 (the warmup poison).
      const todayRow = data?.[data.length - 1];
      if (!todayRow) {
        fail("(H) No row returned for today", { data });
      } else {
        const todayValue = Number(todayRow.value);
        assertEq(
          "(H) Warmup excluded — max working weight === 112 (NOT 200)",
          todayValue,
          112,
        );
      }
    }
  }

  // ---- (I) since-window filter ---------------------------------------------
  console.log(
    "[test-exercise-chart] (I) p_since filter — 90d window vs all-time…",
  );
  // Fresh exercise for this assertion so we have full control over what's
  // in scope (no contamination from the 5 days of (F) data).
  const sinceExerciseId = randomUUID();
  {
    const { error } = await admin
      .from("exercises")
      .insert({
        id: sinceExerciseId,
        user_id: userA.id,
        name: "Phase 6 Since Test",
      });
    if (error) throw new Error(`seed sinceExercise: ${error.message}`);
  }
  // Seed 3 sets on 3 distinct days: -10d, -100d, -400d.
  for (const offset of [-10 * 86_400_000, -100 * 86_400_000, -400 * 86_400_000]) {
    await seedFinishedSession(
      userA.id,
      null,
      sinceExerciseId,
      [{ setNumber: 1, weightKg: 90, reps: 5, setType: "working" }],
      offset,
    );
  }
  {
    // p_since = -90 days → only the -10d row in scope.
    const since90d = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const { data: dataWin, error: errWin } = await clientA.rpc(
      "get_exercise_chart",
      {
        p_exercise_id: sinceExerciseId,
        p_metric: "weight",
        p_since: since90d,
      },
    );
    if (errWin) {
      fail("(I) Since=90d RPC error", { error: errWin });
    } else {
      assertEq(
        "(I) p_since=-90d returns exactly 1 row (only -10d in window)",
        dataWin?.length,
        1,
      );
    }
    // p_since = null → all 3 days.
    const { data: dataAll, error: errAll } = await clientA.rpc(
      "get_exercise_chart",
      {
        p_exercise_id: sinceExerciseId,
        p_metric: "weight",
        p_since: null as unknown as string,
      },
    );
    if (errAll) {
      fail("(I) Since=null RPC error", { error: errAll });
    } else {
      assertEq(
        "(I) p_since=null returns all 3 days",
        dataAll?.length,
        3,
      );
    }
  }

  // ---- (J) Cross-user RLS on get_exercise_chart ----------------------------
  console.log(
    "[test-exercise-chart] (J) Cross-user RLS on get_exercise_chart…",
  );
  {
    const { data, error } = await clientB.rpc("get_exercise_chart", {
      p_exercise_id: chartExerciseId,
      p_metric: "weight",
      p_since: null as unknown as string,
    });
    if (error) {
      fail("(J) clientB RPC error", { error });
    } else {
      assertEq(
        "(J) clientB returns empty data for A's exercise (RLS-filtered)",
        data?.length ?? -1,
        0,
      );
    }
  }

  // ==========================================================================
  // F10 — get_exercise_top_sets assertions K–M (BLOCKER-2 contract)
  // ==========================================================================
  console.log(
    "\n[test-exercise-chart] === F10 get_exercise_top_sets (K–M) ===",
  );

  // Fresh exercise so the ordering + reps contract is isolated from earlier
  // F10 chart fixtures.
  const topSetsExerciseId = randomUUID();
  {
    const { error } = await admin
      .from("exercises")
      .insert({
        id: topSetsExerciseId,
        user_id: userA.id,
        name: "Phase 6 Top Sets Bench",
      });
    if (error) throw new Error(`seed topSetsExercise: ${error.message}`);
  }

  // ---- (K) Ordering & reps preservation -----------------------------------
  // Seed 3 sessions with multiple working sets each:
  //   session1 (oldest, -3d):  [80 × 8,  82.5 × 6]   → top = (82.5, 6)
  //   session2 (-2d):           [85 × 5,  80 × 8]     → top = (85, 5)
  //   session3 (newest, -1d):  [78 × 10, 82 × 7]     → top = (82, 7)
  // Expected RPC output (DESC by completed_at): session3 row, session2 row,
  // session1 row — each carrying the top-weight set's (weight, reps).
  console.log("[test-exercise-chart] (K) Ordering & reps preservation…");
  const session1Id = await seedFinishedSession(
    userA.id,
    null,
    topSetsExerciseId,
    [
      { setNumber: 1, weightKg: 80, reps: 8, setType: "working" },
      { setNumber: 2, weightKg: 82.5, reps: 6, setType: "working" },
    ],
    -3 * 86_400_000,
  );
  const session2Id = await seedFinishedSession(
    userA.id,
    null,
    topSetsExerciseId,
    [
      { setNumber: 1, weightKg: 85, reps: 5, setType: "working" },
      { setNumber: 2, weightKg: 80, reps: 8, setType: "working" },
    ],
    -2 * 86_400_000,
  );
  const session3Id = await seedFinishedSession(
    userA.id,
    null,
    topSetsExerciseId,
    [
      { setNumber: 1, weightKg: 78, reps: 10, setType: "working" },
      { setNumber: 2, weightKg: 82, reps: 7, setType: "working" },
    ],
    -1 * 86_400_000,
  );
  {
    const { data, error } = await clientA.rpc("get_exercise_top_sets", {
      p_exercise_id: topSetsExerciseId,
      p_since: null as unknown as string,
      p_limit: 10,
    });
    if (error) {
      fail("(K) RPC error", { error });
    } else {
      assertEq("(K) Returned exactly 3 rows (one per source session)", data?.length, 3);
      if (data && data.length === 3) {
        // Most-recent first → session3, session2, session1.
        assertEq(
          "(K) Row 0 corresponds to session3 (newest, -1d)",
          data[0].session_id,
          session3Id,
        );
        assertNumberEq(
          "(K) Row 0 weight_kg === 82 (top of session3 working sets)",
          data[0].weight_kg,
          82,
        );
        assertNumberEq(
          "(K) Row 0 reps === 7 (preserved alongside top weight)",
          data[0].reps,
          7,
        );
        assertEq(
          "(K) Row 1 corresponds to session2 (-2d)",
          data[1].session_id,
          session2Id,
        );
        assertNumberEq(
          "(K) Row 1 weight_kg === 85 (top of session2)",
          data[1].weight_kg,
          85,
        );
        assertNumberEq("(K) Row 1 reps === 5", data[1].reps, 5);
        assertEq(
          "(K) Row 2 corresponds to session1 (oldest, -3d)",
          data[2].session_id,
          session1Id,
        );
        assertNumberEq(
          "(K) Row 2 weight_kg === 82.5 (top of session1)",
          data[2].weight_kg,
          82.5,
        );
        assertNumberEq("(K) Row 2 reps === 6", data[2].reps, 6);
      }
    }
  }

  // ---- (L) p_limit honoured ------------------------------------------------
  console.log("[test-exercise-chart] (L) p_limit honoured…");
  // Seed 9 MORE finished sessions touching topSetsExerciseId (one working
  // set each) so total = 12 (3 from K + 9 here). Days -4d..-12d.
  for (let i = 0; i < 9; i++) {
    await seedFinishedSession(
      userA.id,
      null,
      topSetsExerciseId,
      [{ setNumber: 1, weightKg: 70 + i, reps: 5, setType: "working" }],
      -1 * (4 + i) * 86_400_000,
    );
  }
  {
    const { data, error } = await clientA.rpc("get_exercise_top_sets", {
      p_exercise_id: topSetsExerciseId,
      p_since: null as unknown as string,
      p_limit: 10,
    });
    if (error) {
      fail("(L) RPC error", { error });
    } else {
      assertEq("(L) p_limit=10 returns exactly 10 rows", data?.length, 10);
      if (data && data.length === 10) {
        // DESC by completed_at check.
        let descOk = true;
        for (let i = 0; i < data.length - 1; i++) {
          if (
            new Date(data[i].completed_at).getTime() <
            new Date(data[i + 1].completed_at).getTime()
          ) {
            descOk = false;
            break;
          }
        }
        assertEq("(L) Returned rows DESC by completed_at", descOk, true);
      }
    }
  }

  // ---- (M) Cross-user RLS on get_exercise_top_sets -------------------------
  console.log(
    "[test-exercise-chart] (M) Cross-user RLS on get_exercise_top_sets…",
  );
  {
    const { data, error } = await clientB.rpc("get_exercise_top_sets", {
      p_exercise_id: topSetsExerciseId,
      p_since: null as unknown as string,
      p_limit: 10,
    });
    if (error) {
      fail("(M) clientB RPC error", { error });
    } else {
      assertEq(
        "(M) clientB returns empty for A's exercise (RLS-filtered)",
        data?.length ?? -1,
        0,
      );
    }
  }

  // Silence unused-variable warnings on userB (we use clientB which carries
  // the session; userB.id isn't referenced directly in any assertion).
  void userB;
}

(async () => {
  let exitCode = 0;
  let mainCompleted = false;
  try {
    await main();
    mainCompleted = true;
  } catch (e) {
    console.error(
      "[test-exercise-chart] FATAL:",
      e instanceof Error ? e.message : e,
    );
    exitCode = 1;
  } finally {
    console.log("\n[test-exercise-chart] cleanup (end)…");
    await Promise.allSettled([
      clientA.auth.signOut().catch(() => {}),
      clientB.auth.signOut().catch(() => {}),
    ]);
    try {
      await cleanupTestUsers();
    } catch (e) {
      console.error(
        "[test-exercise-chart] cleanup at end failed:",
        e instanceof Error ? e.message : e,
      );
      exitCode = 1;
    }
    console.log("");
    if (!mainCompleted) {
      console.log(
        "[test-exercise-chart] ABORTED before assertions completed — see FATAL above",
      );
      exitCode = 1;
    } else if (failures.length === 0) {
      console.log("[test-exercise-chart] ALL ASSERTIONS PASSED");
    } else {
      console.log(`[test-exercise-chart] ${failures.length} FAILURE(S)`);
      for (const f of failures) console.log(`  - ${f}`);
      exitCode = 1;
    }
    process.exit(exitCode);
  }
})();
