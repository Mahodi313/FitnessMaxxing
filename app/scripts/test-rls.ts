// File: app/scripts/test-rls.ts
//
// Cross-user RLS verification harness for Phase 2.
//
// Proves:
//   1. User A cannot SELECT/INSERT/UPDATE/DELETE User B's rows on any of the
//      5 user-scoped tables (exercises, workout_plans, plan_exercises,
//      workout_sessions, exercise_sets). profiles is auto-created by the
//      handle_new_user trigger and is verified separately.
//   2. The PITFALLS 2.5 errata fix is in place: clientA cannot insert a
//      plan_exercises row pointing at User B's workout_plans.id, and cannot
//      insert an exercise_sets row pointing at User B's workout_sessions.id.
//   3. The handle_new_user trigger fires on auth.users insert: after seeding
//      2 users via admin.createUser, exactly 2 rows exist in public.profiles.
//
// Run via: cd app && npm run test:rls
//   (which expands to: tsx --env-file=.env.local scripts/test-rls.ts)
//
// This script is Node-only. It MUST NEVER be imported from app/lib/, app/app/,
// or any other Metro-bundled path (PITFALLS 2.3 — service-role-key isolation).
//
// References:
//   - .planning/phases/02-schema-rls-type-generation/02-CONTEXT.md (D-06..D-10)
//   - .planning/phases/02-schema-rls-type-generation/02-RESEARCH.md §"Pattern 3"
//   - .planning/research/PITFALLS.md §2.3, §2.5, §4.1, "Pitfall 8"

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Env guard — fail loud (mirrors app/lib/supabase.ts lines 16–24).
// ---------------------------------------------------------------------------

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  throw new Error(
    "Missing env. Behöver EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, " +
      "och SUPABASE_SERVICE_ROLE_KEY i app/.env.local. Se app/.env.example och kör " +
      "via `npm run test:rls` (laddar .env.local automatiskt via tsx --env-file).",
  );
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TEST_EMAIL_PREFIX = "rls-test-";
const TEST_EMAIL_DOMAIN = "@fitnessmaxxing.local";
const TEST_PASSWORD = "Rls-Test-Pwd-2026!"; // not a real-user secret; namespaced by email

const userAEmail = `${TEST_EMAIL_PREFIX}a${TEST_EMAIL_DOMAIN}`;
const userBEmail = `${TEST_EMAIL_PREFIX}b${TEST_EMAIL_DOMAIN}`;

// ---------------------------------------------------------------------------
// Three isolated clients (PITFALLS Pitfall 8 — no client reuse).
// ---------------------------------------------------------------------------

const admin: SupabaseClient = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const clientA: SupabaseClient = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const clientB: SupabaseClient = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// Assertion harness — D-10: console.assert-style, exit-code reporting.
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

// Helper: assertion that an RLS-blocked SELECT returns empty data (not an error).
function assertEmpty(name: string, result: { data: unknown[] | null; error: unknown }) {
  if (result.error) {
    fail(name, { reason: "expected empty data, got error", error: result.error });
    return;
  }
  if (!result.data || result.data.length === 0) {
    pass(name);
  } else {
    fail(name, { reason: "expected empty, got rows", count: result.data.length });
  }
}

// Helper: assertion that an RLS-blocked write either errors OR returns no rows.
function assertWriteBlocked(
  name: string,
  result: { data: unknown[] | null; error: { code?: string; message?: string } | null },
) {
  // Acceptable outcomes: (a) Postgres RLS error (PGRST301 / 42501), (b) data is null/empty.
  // Both prove the row was not written. Any "data with rows" is a fail.
  if (result.error) {
    pass(`${name} (rejected with error: ${result.error.code ?? result.error.message ?? "unknown"})`);
    return;
  }
  if (!result.data || (Array.isArray(result.data) && result.data.length === 0)) {
    pass(`${name} (returned no data — RLS-filtered)`);
    return;
  }
  fail(name, { reason: "write was NOT blocked", data: result.data });
}

// ---------------------------------------------------------------------------
// Cleanup — defensive (start) AND in finally (end).
//
// Why we purge child rows manually before deleteUser instead of relying on
// `auth.users` ON DELETE CASCADE alone: `plan_exercises.exercise_id` and
// `exercise_sets.exercise_id` are `ON DELETE RESTRICT` (per schema; intentional
// to prevent accidental history loss when a user "deletes" an exercise that
// has logged sets). When auth.users → public.exercises cascade fires, Postgres
// has no guaranteed ordering against the parallel cascades through
// workout_plans → plan_exercises and workout_sessions → exercise_sets, so the
// RESTRICT can fire and abort the whole deleteUser transaction. Purging in
// deterministic leaf-first order via the admin (RLS-bypass) client avoids that.
// ---------------------------------------------------------------------------

async function purgeUserData(userId: string) {
  // Order matters: leaf children before parents. exercise_sets and plan_exercises
  // have no user_id column — they live under workout_sessions / workout_plans
  // respectively, both of which cascade on delete. So deleting sessions first
  // takes out exercise_sets via cascade; deleting plans takes out plan_exercises
  // via cascade. Then exercises has no remaining FK references and can be deleted.
  await admin.from("workout_sessions").delete().eq("user_id", userId);
  await admin.from("workout_plans").delete().eq("user_id", userId);
  await admin.from("exercises").delete().eq("user_id", userId);
  // profiles has FK to auth.users with ON DELETE CASCADE — the auth.admin.deleteUser
  // call below will sweep it away; explicitly purging would also work.
}

async function cleanupTestUsers() {
  // List ALL users, filter by email prefix, purge data, then delete via admin API.
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
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("[test-rls] cleanup (start)…");
  await cleanupTestUsers();

  // -------------------------------------------------------------------------
  // Seed two users via admin API. handle_new_user trigger fires on each.
  // -------------------------------------------------------------------------
  console.log("[test-rls] seed users…");
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
  console.log(`  userA.id=${userA.id} userB.id=${userB.id}`);

  // -------------------------------------------------------------------------
  // ROADMAP-S3 RLS-04: handle_new_user trigger creates profiles rows.
  // -------------------------------------------------------------------------
  console.log("[test-rls] verify handle_new_user trigger…");
  const { data: profileRows, error: profileErr } = await admin
    .from("profiles")
    .select("id")
    .in("id", [userA.id, userB.id]);
  if (profileErr) {
    fail("trigger handle_new_user inserted 2 profile rows", { error: profileErr });
  } else if (profileRows && profileRows.length === 2) {
    pass("trigger handle_new_user inserted 2 profile rows");
  } else {
    fail("trigger handle_new_user inserted 2 profile rows", {
      reason: "expected 2 rows",
      got: profileRows?.length ?? 0,
    });
  }

  // -------------------------------------------------------------------------
  // Sign in each anon client.
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // Seed User B's data via clientB (RLS-enforced own-write — confirms positive path).
  // -------------------------------------------------------------------------
  console.log("[test-rls] seed User B data via clientB (own-write path)…");

  const { data: exB, error: exBErr } = await clientB
    .from("exercises")
    .insert({ user_id: userB.id, name: "rls-test-b-bench-press" })
    .select()
    .single();
  if (exBErr || !exB) throw new Error(`Seed B exercises failed: ${exBErr?.message}`);

  const { data: planB, error: planBErr } = await clientB
    .from("workout_plans")
    .insert({ user_id: userB.id, name: "rls-test-b-plan" })
    .select()
    .single();
  if (planBErr || !planB) throw new Error(`Seed B workout_plans failed: ${planBErr?.message}`);

  const { data: peB, error: peBErr } = await clientB
    .from("plan_exercises")
    .insert({ plan_id: planB.id, exercise_id: exB.id, order_index: 0 })
    .select()
    .single();
  if (peBErr || !peB) throw new Error(`Seed B plan_exercises failed: ${peBErr?.message}`);

  const { data: sessB, error: sessBErr } = await clientB
    .from("workout_sessions")
    .insert({ user_id: userB.id, plan_id: planB.id })
    .select()
    .single();
  if (sessBErr || !sessB) throw new Error(`Seed B workout_sessions failed: ${sessBErr?.message}`);

  const { data: setB, error: setBErr } = await clientB
    .from("exercise_sets")
    .insert({
      session_id: sessB.id,
      exercise_id: exB.id,
      set_number: 1,
      reps: 5,
      weight_kg: 100,
    })
    .select()
    .single();
  if (setBErr || !setB) throw new Error(`Seed B exercise_sets failed: ${setBErr?.message}`);

  console.log("  seeded User B: 1 exercise, 1 plan, 1 plan_exercise, 1 session, 1 set");

  // -------------------------------------------------------------------------
  // Seed User A's exercise (so we can attempt errata-regression INSERTs that
  // point a plan_exercises / exercise_sets row at User B's parent but use User A's
  // exercise — proves the parent-ownership check, not just a missing exercise).
  // -------------------------------------------------------------------------
  const { data: exA, error: exAErr } = await clientA
    .from("exercises")
    .insert({ user_id: userA.id, name: "rls-test-a-squat" })
    .select()
    .single();
  if (exAErr || !exA) throw new Error(`Seed A exercise failed: ${exAErr?.message}`);

  // =========================================================================
  // ASSERTION BATTERY — clientA against User B's namespace
  // =========================================================================
  console.log("[test-rls] assertion battery — clientA vs B's data…");

  // ---- profiles ----------------------------------------------------------
  assertEmpty(
    "A cannot SELECT B's profile",
    await clientA.from("profiles").select("*").eq("id", userB.id),
  );
  assertWriteBlocked(
    "A cannot UPDATE B's profile (display_name)",
    await clientA.from("profiles").update({ display_name: "hacked" }).eq("id", userB.id).select(),
  );
  // (no INSERT/DELETE assertion on profiles — handle_new_user owns inserts; deletes cascade from auth.users)

  // ---- exercises ---------------------------------------------------------
  assertEmpty(
    "A cannot SELECT B's exercise",
    await clientA.from("exercises").select("*").eq("id", exB.id),
  );
  assertWriteBlocked(
    "A cannot INSERT exercise owned by B",
    await clientA.from("exercises").insert({ user_id: userB.id, name: "fake-b" }).select(),
  );
  assertWriteBlocked(
    "A cannot UPDATE B's exercise",
    await clientA
      .from("exercises")
      .update({ name: "hacked" })
      .eq("id", exB.id)
      .select(),
  );
  assertWriteBlocked(
    "A cannot DELETE B's exercise",
    await clientA.from("exercises").delete().eq("id", exB.id).select(),
  );

  // ---- workout_plans -----------------------------------------------------
  assertEmpty(
    "A cannot SELECT B's workout_plan",
    await clientA.from("workout_plans").select("*").eq("id", planB.id),
  );
  assertWriteBlocked(
    "A cannot INSERT workout_plan owned by B",
    await clientA.from("workout_plans").insert({ user_id: userB.id, name: "fake" }).select(),
  );
  assertWriteBlocked(
    "A cannot UPDATE B's workout_plan",
    await clientA
      .from("workout_plans")
      .update({ name: "hacked" })
      .eq("id", planB.id)
      .select(),
  );
  assertWriteBlocked(
    "A cannot DELETE B's workout_plan",
    await clientA.from("workout_plans").delete().eq("id", planB.id).select(),
  );

  // ---- plan_exercises (CHILD — load-bearing PITFALLS 2.5 errata) ---------
  assertEmpty(
    "A cannot SELECT B's plan_exercise (parent ownership filter)",
    await clientA.from("plan_exercises").select("*").eq("id", peB.id),
  );
  // ERRATA REGRESSION: insert row with plan_id pointing at B's plan.
  // Without `with check (exists ... user_id = auth.uid())`, this would have SUCCEEDED.
  assertWriteBlocked(
    "A cannot INSERT plan_exercise pointing at B's workout_plan (PITFALLS 2.5 errata regression)",
    await clientA
      .from("plan_exercises")
      .insert({ plan_id: planB.id, exercise_id: exA.id, order_index: 99 })
      .select(),
  );
  assertWriteBlocked(
    "A cannot UPDATE B's plan_exercise",
    await clientA
      .from("plan_exercises")
      .update({ order_index: 99 })
      .eq("id", peB.id)
      .select(),
  );
  assertWriteBlocked(
    "A cannot DELETE B's plan_exercise",
    await clientA.from("plan_exercises").delete().eq("id", peB.id).select(),
  );

  // ---- workout_sessions --------------------------------------------------
  assertEmpty(
    "A cannot SELECT B's workout_session",
    await clientA.from("workout_sessions").select("*").eq("id", sessB.id),
  );
  assertWriteBlocked(
    "A cannot INSERT workout_session owned by B",
    await clientA
      .from("workout_sessions")
      .insert({ user_id: userB.id, plan_id: planB.id })
      .select(),
  );
  assertWriteBlocked(
    "A cannot UPDATE B's workout_session",
    await clientA
      .from("workout_sessions")
      .update({ notes: "hacked" })
      .eq("id", sessB.id)
      .select(),
  );
  assertWriteBlocked(
    "A cannot DELETE B's workout_session",
    await clientA.from("workout_sessions").delete().eq("id", sessB.id).select(),
  );

  // ---- exercise_sets (CHILD — load-bearing PITFALLS 2.5 errata) ----------
  assertEmpty(
    "A cannot SELECT B's exercise_set (parent ownership filter)",
    await clientA.from("exercise_sets").select("*").eq("id", setB.id),
  );
  // ERRATA REGRESSION: insert row with session_id pointing at B's session.
  assertWriteBlocked(
    "A cannot INSERT exercise_set pointing at B's workout_session (PITFALLS 2.5 errata regression)",
    await clientA
      .from("exercise_sets")
      .insert({
        session_id: sessB.id,
        exercise_id: exA.id,
        set_number: 99,
        reps: 5,
        weight_kg: 100,
      })
      .select(),
  );
  assertWriteBlocked(
    "A cannot UPDATE B's exercise_set",
    await clientA
      .from("exercise_sets")
      .update({ reps: 999 })
      .eq("id", setB.id)
      .select(),
  );
  assertWriteBlocked(
    "A cannot DELETE B's exercise_set",
    await clientA.from("exercise_sets").delete().eq("id", setB.id).select(),
  );
}

(async () => {
  let exitCode = 0;
  let mainCompleted = false; // Guards against silent-pass when main() throws before any assertion runs (T-02-20).
  try {
    await main();
    mainCompleted = true;
  } catch (e) {
    console.error("[test-rls] FATAL:", e instanceof Error ? e.message : e);
    exitCode = 1;
  } finally {
    console.log("[test-rls] cleanup (end)…");
    try {
      await cleanupTestUsers();
    } catch (e) {
      console.error("[test-rls] cleanup at end failed:", e instanceof Error ? e.message : e);
      exitCode = 1;
    }
    console.log("");
    if (!mainCompleted) {
      // Critical: main() aborted before all assertions ran — DO NOT report success
      // even if `failures.length === 0`, since zero failures with zero assertions
      // is the false-positive that T-02-20 explicitly mitigates against.
      console.log(`[test-rls] ABORTED before assertions completed — see FATAL above`);
      exitCode = 1;
    } else if (failures.length === 0) {
      console.log(`[test-rls] ALL ASSERTIONS PASSED`);
    } else {
      console.log(`[test-rls] ${failures.length} FAILURE(S)`);
      for (const f of failures) console.log(`  - ${f}`);
      exitCode = 1;
    }
    process.exit(exitCode);
  }
})();
