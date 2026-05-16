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
import { randomUUID } from "node:crypto";
import type { Database } from "../types/database";

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

  // =========================================================================
  // Phase 4 extension — explicit cross-user assertions for the new mutation
  // paths Phase 4 introduces (CLAUDE.md "Cross-user verification is a gate").
  //
  // Phase 4 ships F2 (workout_plans archive — UPDATE archived_at), F3
  // (exercises insert — already covered above as a generic INSERT block, but
  // we re-state the intent here for traceability), and F4 (plan_exercises
  // CRUD on plans not owned by the caller — the generic update block above
  // patches `name`/`order_index`; the archive block below patches the exact
  // column the F2 mutation hits).
  //
  // These assertions reuse the same harness clients as the Phase 2 block —
  // clientA is signed-in as userA, clientB as userB. We attempt to mutate
  // userB's data from clientA and verify the write is blocked.
  // =========================================================================
  console.log(
    "[test-rls] Phase 4 extension — workout_plans archive cross-user gate…",
  );

  // ---- workout_plans archive (UPDATE archived_at) ----
  // F2 archive path mutates the archived_at column specifically. The generic
  // UPDATE block above (line ~340) patches `name`; this asserts the same RLS
  // policy also blocks the archive-shaped payload.
  assertWriteBlocked(
    "Phase 4 extension: A cannot UPDATE archived_at on B's workout_plan (F2 archive cross-user)",
    await clientA
      .from("workout_plans")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", planB.id)
      .select(),
  );

  // ---- plan_exercises insert cross-user (F4 add-exercise-to-plan) ----
  // The generic INSERT block above (line ~360) covers this with order_index=99.
  // We re-state the F4 shape here — plan_id pointing at B's plan, exercise_id
  // owned by A — to make the F4-coverage explicit. Insert with a user-owned
  // exercise_id is the realistic attack vector (you'd never have B's
  // exercise_id at all).
  assertWriteBlocked(
    "Phase 4 extension: A cannot INSERT plan_exercises into B's plan (F4 add cross-user)",
    await clientA
      .from("plan_exercises")
      .insert({
        plan_id: planB.id,
        exercise_id: exA.id,
        order_index: 0,
        target_sets: 3,
        target_reps_min: 8,
        target_reps_max: 12,
      })
      .select(),
  );

  // ---- plan_exercises update cross-user with target fields (F4 targets-edit) ----
  // The generic UPDATE block above patches order_index; F4's targets-editor
  // touches target_sets/reps_min/reps_max. Re-state with that payload shape.
  assertWriteBlocked(
    "Phase 4 extension: A cannot UPDATE B's plan_exercise targets (F4 targets cross-user)",
    await clientA
      .from("plan_exercises")
      .update({
        target_sets: 99,
        target_reps_min: 99,
        target_reps_max: 99,
        notes: "hacked",
      })
      .eq("id", peB.id)
      .select(),
  );

  // ---- exercises insert cross-user (F3 create-own-exercise) ----
  // Already covered at line ~314 ("A cannot INSERT exercise owned by B") but
  // the original payload uses name="fake-b". Re-state with the F3 shape:
  // a realistic muscle_group + equipment + notes payload that matches what
  // Phase 4's exercise-picker inline-create form sends. RLS still blocks.
  assertWriteBlocked(
    "Phase 4 extension: A cannot INSERT exercise with B's user_id (F3 create-own cross-user)",
    await clientA
      .from("exercises")
      .insert({
        user_id: userB.id,
        name: "Phase 4 attack — bench",
        muscle_group: "Bröst",
        equipment: "Skivstång",
        notes: "should never land",
      })
      .select(),
  );

  // ---- Defense-in-depth: confirm User B's rows are intact ----
  // The above assertWriteBlocked() helpers pass on (a) error OR (b) empty
  // returned rows. An adversary that somehow bypassed RLS in a future
  // regression could in principle land the write while RLS still empty-
  // filtered the .select() suffix — the assertion would false-pass.
  // Explicitly verify via admin (RLS-bypass) that B's rows are unchanged.
  console.log(
    "[test-rls] Phase 4 extension — defense-in-depth: B's rows survive…",
  );

  const { data: planBAfter, error: planBAfterErr } = await admin
    .from("workout_plans")
    .select("id, name, archived_at")
    .eq("id", planB.id)
    .single();
  if (planBAfterErr || !planBAfter) {
    fail("Phase 4 extension: B's workout_plan still exists after A's attempts", {
      error: planBAfterErr,
    });
  } else if (planBAfter.archived_at !== null) {
    fail(
      "Phase 4 extension: B's workout_plan archived_at is still null after A's archive attempt",
      { archived_at: planBAfter.archived_at },
    );
  } else {
    pass(
      "Phase 4 extension: B's workout_plan still exists with archived_at = null",
    );
  }

  const { data: peBAfter, error: peBAfterErr } = await admin
    .from("plan_exercises")
    .select("id, order_index, target_sets, target_reps_min, target_reps_max, notes")
    .eq("id", peB.id)
    .single();
  if (peBAfterErr || !peBAfter) {
    fail(
      "Phase 4 extension: B's plan_exercise still exists after A's attempts",
      { error: peBAfterErr },
    );
  } else if (
    peBAfter.target_sets !== null ||
    peBAfter.target_reps_min !== null ||
    peBAfter.target_reps_max !== null ||
    peBAfter.notes !== null
  ) {
    fail(
      "Phase 4 extension: B's plan_exercise targets were mutated by A's attempt",
      { peBAfter },
    );
  } else {
    pass(
      "Phase 4 extension: B's plan_exercise survived A's targets/insert/update/delete attempts unchanged",
    );
  }

  // Confirm no rogue plan_exercises rows landed on B's plan from A's INSERT
  // attempt. plan_exercises rows on planB.id should be exactly 1 (the seed
  // row peB).
  const { data: peListAfter, error: peListAfterErr } = await admin
    .from("plan_exercises")
    .select("id")
    .eq("plan_id", planB.id);
  if (peListAfterErr || !peListAfter) {
    fail(
      "Phase 4 extension: count plan_exercises on B's plan after A's INSERT attempt",
      { error: peListAfterErr },
    );
  } else if (peListAfter.length !== 1) {
    fail(
      "Phase 4 extension: B's plan has unexpected plan_exercises count (rogue insert?)",
      { count: peListAfter.length },
    );
  } else {
    pass(
      "Phase 4 extension: B's plan still has exactly 1 plan_exercise (no rogue insert)",
    );
  }

  // =========================================================================
  // Phase 5 extension — explicit cross-user assertions for the NEW mutation
  // SHAPES Phase 5 introduces. Phase 2 already covers generic CRUD on
  // workout_sessions + exercise_sets (lines 380–435), but Phase 5 adds three
  // specific payload shapes the new hooks emit:
  //   - useFinishSession.mutate(): UPDATE workout_sessions SET finished_at=…
  //     (F8 — generic Phase 2 UPDATE asserts only `notes`; restate with the
  //     exact column the new mutation hits, which is the realistic attack
  //     vector for "finish someone else's pass to corrupt their history")
  //   - useStartSession.mutate(): INSERT with started_at + plan_id +
  //     client-UUID id (F5 — generic Phase 2 INSERT lacks started_at; this
  //     restates with the canonical Phase 5 payload shape)
  //   - useAddSet.mutate(): INSERT with completed_at + set_type (F6 — Phase 2
  //     INSERT lacks those columns; restate with the canonical shape)
  //   - useUpdateSet.mutate(): UPDATE weight_kg specifically (F6 — Phase 2
  //     UPDATE only patches reps; restate with weight_kg, the load-bearing
  //     column for training integrity)
  //
  // Closes CLAUDE.md "Cross-user verification is a gate" for Phase 5; covers
  // threat-register IDs T-05-01 (exercise_sets parent-FK forge), T-05-02
  // (workout_sessions user_id forge), T-05-03 (exercise_sets cross-user
  // SELECT). All assertions reuse the Phase 2 seed (`sessB`, `setB`, `exA`,
  // `planB`, `userB`).
  // =========================================================================
  console.log(
    "[test-rls] Phase 5 extension — workout_sessions + exercise_sets new-shape cross-user gates…",
  );

  // ---- workout_sessions UPDATE finished_at cross-user (F8 finish path) ----
  // useFinishSession.mutate({ id, finished_at }) is the realistic shape.
  assertWriteBlocked(
    "Phase 5 extension: A cannot UPDATE finished_at on B's workout_session (F8 cross-user)",
    await clientA
      .from("workout_sessions")
      .update({ finished_at: new Date().toISOString() })
      .eq("id", sessB.id)
      .select(),
  );

  // ---- workout_sessions INSERT with B's user_id (F5 start path) ----
  // useStartSession.mutate({ id, user_id, plan_id, started_at }) — canonical
  // payload. The Phase 2 block asserts the generic shape; this restates with
  // started_at + client-UUID id to match the exact F5 attack vector.
  assertWriteBlocked(
    "Phase 5 extension: A cannot INSERT workout_session with B's user_id (F5 start cross-user)",
    await clientA
      .from("workout_sessions")
      .insert({
        id: randomUUID(),
        user_id: userB.id,
        plan_id: planB.id,
        started_at: new Date().toISOString(),
      })
      .select(),
  );

  // ---- workout_sessions UPDATE notes on B's session (T-05-15 disclosure) ----
  // Phase 2 already covers UPDATE B's session with notes; restate explicitly
  // for the threat-register T-05-15 traceability link.
  assertWriteBlocked(
    "Phase 5 extension: A cannot UPDATE notes on B's workout_session (T-05-15 cross-user tampering)",
    await clientA
      .from("workout_sessions")
      .update({ notes: "owned" })
      .eq("id", sessB.id)
      .select(),
  );

  // ---- exercise_sets INSERT into B's session with full F6 shape ----
  // useAddSet.mutate() — the canonical payload includes completed_at +
  // set_type (which Phase 2 block omits). RLS parent-FK EXISTS subquery
  // blocks regardless of payload; this asserts the realistic shape doesn't
  // sneak through a hypothetical policy regression.
  assertWriteBlocked(
    "Phase 5 extension: A cannot INSERT exercise_set into B's session (F6 cross-user — RLS parent-FK EXISTS)",
    await clientA
      .from("exercise_sets")
      .insert({
        id: randomUUID(),
        session_id: sessB.id,
        exercise_id: exA.id,
        set_number: 99,
        reps: 5,
        weight_kg: 100,
        completed_at: new Date().toISOString(),
        set_type: "working",
      })
      .select(),
  );

  // ---- exercise_sets UPDATE weight_kg on B's set (F6 tampering) ----
  // useUpdateSet.mutate({ weight_kg }) — the load-bearing column for
  // training integrity. Phase 2 covers UPDATE reps; restate with weight_kg
  // (the dominant tampering target).
  assertWriteBlocked(
    "Phase 5 extension: A cannot UPDATE weight_kg on B's exercise_set (T-05-01 tampering)",
    await clientA
      .from("exercise_sets")
      .update({ weight_kg: 0.01 })
      .eq("id", setB.id)
      .select(),
  );

  // ---- Defense-in-depth: B's session + set survived all A-attempts ----
  // Mirror Phase 4 block lines 532-603: explicit admin SELECT to verify B's
  // rows are byte-for-byte unchanged. Catches the hypothetical regression
  // where RLS empty-filters the .select() suffix but the write still landed
  // (false-pass on assertWriteBlocked).
  console.log(
    "[test-rls] Phase 5 extension — defense-in-depth: B's session + set survive…",
  );

  const { data: sessBAfter, error: sessBAfterErr } = await admin
    .from("workout_sessions")
    .select("id, user_id, notes, finished_at")
    .eq("id", sessB.id)
    .maybeSingle();
  if (sessBAfterErr || !sessBAfter) {
    fail("Phase 5 extension: B's workout_session integrity check failed", {
      error: sessBAfterErr,
    });
  } else if (
    sessBAfter.user_id !== userB.id ||
    sessBAfter.notes !== null ||
    sessBAfter.finished_at !== null
  ) {
    fail(
      "Phase 5 extension: B's workout_session mutated by A's attempts",
      { sessBAfter },
    );
  } else {
    pass(
      "Phase 5 extension: B's workout_session integrity preserved (user_id, notes, finished_at intact)",
    );
  }

  const { data: setBAfter, error: setBAfterErr } = await admin
    .from("exercise_sets")
    .select("id, session_id, weight_kg, reps")
    .eq("id", setB.id)
    .maybeSingle();
  if (setBAfterErr || !setBAfter) {
    fail("Phase 5 extension: B's exercise_set integrity check failed", {
      error: setBAfterErr,
    });
  } else if (
    setBAfter.session_id !== sessB.id ||
    Number(setBAfter.weight_kg) !== 100 ||
    setBAfter.reps !== 5
  ) {
    fail("Phase 5 extension: B's exercise_set mutated by A's attempts", {
      setBAfter,
    });
  } else {
    pass(
      "Phase 5 extension: B's exercise_set integrity preserved (session_id, weight_kg 100, reps 5 intact)",
    );
  }

  // Confirm no rogue exercise_sets rows landed on B's session from A's
  // INSERT attempt. exercise_sets rows on sessB.id should be exactly 1
  // (the seed row setB).
  const { data: setsListAfter, error: setsListAfterErr } = await admin
    .from("exercise_sets")
    .select("id")
    .eq("session_id", sessB.id);
  if (setsListAfterErr || !setsListAfter) {
    fail(
      "Phase 5 extension: count exercise_sets on B's session after A's INSERT attempt",
      { error: setsListAfterErr },
    );
  } else if (setsListAfter.length !== 1) {
    fail(
      "Phase 5 extension: B's session has unexpected exercise_sets count (rogue insert?)",
      { count: setsListAfter.length },
    );
  } else {
    pass(
      "Phase 5 extension: B's session still has exactly 1 exercise_set (no rogue insert)",
    );
  }

  // ===========================================================================
  // Phase 5 gap-closure (FIT-7) — natural-key UNIQUE constraint on exercise_sets
  //
  // Migration 0003 added `exercise_sets_session_exercise_setno_uq` UNIQUE
  // (session_id, exercise_id, set_number). The seed above already proved the
  // FIRST INSERT with (sessB, exB.id, set_number=1) succeeds (line 267-278).
  // This block proves that a SECOND INSERT with the same natural-key tuple
  // fails with Postgres 23505 unique_violation regardless of the client UUID.
  // No row-cleanup needed — cleanupTestUsers cascades the row away via
  // workout_sessions FK.
  // ===========================================================================
  console.log(
    "[test-rls] Phase 5 gap-closure (FIT-7) — natural-key UNIQUE constraint on exercise_sets…",
  );

  const { error: dupErr } = await clientB
    .from("exercise_sets")
    .insert({
      session_id: sessB.id,
      exercise_id: exB.id,
      set_number: 1,
      reps: 5,
      weight_kg: 100,
      completed_at: new Date().toISOString(),
      set_type: "working",
    })
    .select();
  if (dupErr?.code === "23505") {
    pass(
      "Phase 5 gap-closure: duplicate (session_id, exercise_id, set_number) rejected with 23505 unique_violation",
    );
  } else {
    fail(
      "Phase 5 gap-closure: duplicate natural-key INSERT did NOT raise 23505",
      { code: dupErr?.code, message: dupErr?.message },
    );
  }

  // =========================================================================
  // Phase 6 extension — explicit cross-user assertions for the new Phase 6
  // read-side surface (Migration 0006 RPCs + the F9 delete-pass path).
  //
  // Phase 6 adds three RPC functions, all SECURITY INVOKER so RLS on the
  // underlying tables (workout_sessions, exercise_sets, workout_plans) auto-
  // applies:
  //   - get_session_summaries (F9 history list)
  //   - get_exercise_chart (F10 chart aggregate)
  //   - get_exercise_top_sets (F10 'Senaste 10 passen' BLOCKER-2 list)
  //
  // Plus a new write path: User-A-owned DELETE of workout_sessions (F9
  // delete-pass action). The Phase 2 block already covers the cross-user
  // attempt (line ~402); we restate explicitly + add the positive owner-DELETE
  // path that proves the FK on delete cascade purges exercise_sets per
  // migration 0001 line 74.
  //
  // Closes CLAUDE.md "Cross-user verification is a gate" for Phase 6; covers
  // threat-register IDs T-06-01, T-06-02, T-06-03, T-06-04, T-06-12.
  // =========================================================================
  console.log(
    "[test-rls] Phase 6 extension — history-list + chart RPCs + delete-session cross-user gates…",
  );

  // ---- workout_sessions DELETE cross-user (T-06-03, T-06-12) ---------------
  // A's anon client attempts to DELETE B's session. RLS USING clause on
  // workout_sessions blocks at the DB layer.
  assertWriteBlocked(
    "Phase 6 extension: A cannot DELETE B's workout_session (F9 delete cross-user)",
    await clientA
      .from("workout_sessions")
      .delete()
      .eq("id", sessB.id)
      .select(),
  );

  // ---- get_session_summaries cross-user RPC (T-06-01) ----------------------
  // A's anon client calls get_session_summaries — RLS scopes server-side to
  // A's sessions only; B's sessB.id must NOT appear in the response.
  {
    const { data: summariesAsA, error: summariesErr } =
      await clientA.rpc("get_session_summaries", { p_cursor: null as unknown as string, p_page_size: 100 });
    if (summariesErr) {
      fail(
        "Phase 6 extension: get_session_summaries RPC returned error for A",
        { error: summariesErr },
      );
    } else if (
      summariesAsA?.some((s: { id: string }) => s.id === sessB.id)
    ) {
      fail(
        "Phase 6 extension: A's get_session_summaries leaked B's session",
        { sessBId: sessB.id },
      );
    } else {
      pass(
        "Phase 6 extension: A's get_session_summaries does not surface B's sessions",
      );
    }
  }

  // ---- get_exercise_chart cross-user RPC (T-06-02, T-06-04) ----------------
  // A calls get_exercise_chart with B's exercise_id — RLS on exercise_sets +
  // workout_sessions scopes via parent-FK EXISTS, so result is empty (not
  // error).
  {
    const { data: chartAsA, error: chartErr } =
      await clientA.rpc("get_exercise_chart", { p_exercise_id: exB.id, p_metric: "weight", p_since: null as unknown as string });
    if (chartErr) {
      fail(
        "Phase 6 extension: get_exercise_chart RPC returned error for A on B's exercise",
        { error: chartErr },
      );
    } else if (chartAsA && chartAsA.length > 0) {
      fail(
        "Phase 6 extension: A's get_exercise_chart leaked B's exercise sets",
        { count: chartAsA.length },
      );
    } else {
      pass(
        "Phase 6 extension: A's get_exercise_chart on B's exercise returns empty (RLS-filtered)",
      );
    }
  }

  // ---- get_exercise_top_sets cross-user RPC (T-06-02 — BLOCKER-2 RLS) -----
  // Same parent-FK EXISTS chain as get_exercise_chart; the NEW RPC needs its
  // own cross-user assertion so the test-rls.ts gate covers all three Phase 6
  // RPCs without a gap.
  {
    const { data: topAsA, error: topErr } =
      await clientA.rpc("get_exercise_top_sets", { p_exercise_id: exB.id, p_since: null as unknown as string, p_limit: 10 });
    if (topErr) {
      fail(
        "Phase 6 extension: get_exercise_top_sets RPC returned error for A on B's exercise",
        { error: topErr },
      );
    } else if (topAsA && topAsA.length > 0) {
      fail(
        "Phase 6 extension: A's get_exercise_top_sets leaked B's exercise sets",
        { count: topAsA.length },
      );
    } else {
      pass(
        "Phase 6 extension: A's get_exercise_top_sets on B's exercise returns empty (RLS-filtered)",
      );
    }
  }

  // ---- Defense-in-depth: B's session survives A's delete attempt -----------
  console.log(
    "[test-rls] Phase 6 extension — defense-in-depth: B's session survives…",
  );
  {
    const { data: sessBStillThere, error: sessBErr } = await admin
      .from("workout_sessions")
      .select("id")
      .eq("id", sessB.id)
      .maybeSingle();
    if (sessBErr || !sessBStillThere) {
      fail(
        "Phase 6 extension: B's session was deleted by A's attempt",
        { error: sessBErr },
      );
    } else {
      pass(
        "Phase 6 extension: B's session survived A's DELETE attempt",
      );
    }
  }

  // ---- FK on delete cascade (positive owner path — D-07 + T-06-12) ---------
  // Seed (cascadeSessionId, cascadeSetId) for User A via admin (bypass RLS for
  // fixture setup), then clientA.delete() the session as the owner. Assert
  // the cascadeSetId is gone (FK on delete cascade from migration 0001 line
  // 74). This is the positive path Plan 06-02's useDeleteSession depends on.
  {
    const cascadeSessionId = randomUUID();
    {
      const { error } = await admin.from("workout_sessions").insert({
        id: cascadeSessionId,
        user_id: userA.id,
        plan_id: null,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
      });
      if (error)
        throw new Error(`seed cascade session: ${error.message}`);
    }
    const cascadeSetId = randomUUID();
    {
      const { error } = await admin.from("exercise_sets").insert({
        id: cascadeSetId,
        session_id: cascadeSessionId,
        exercise_id: exA.id,
        set_number: 1,
        reps: 5,
        weight_kg: 100,
        set_type: "working",
      });
      if (error) throw new Error(`seed cascade set: ${error.message}`);
    }
    const { error: delErr } = await clientA
      .from("workout_sessions")
      .delete()
      .eq("id", cascadeSessionId);
    if (delErr) {
      fail(
        "Phase 6 extension: A's own session DELETE failed",
        { error: delErr },
      );
    } else {
      const { data: setStillThere } = await admin
        .from("exercise_sets")
        .select("id")
        .eq("id", cascadeSetId)
        .maybeSingle();
      if (setStillThere) {
        fail(
          "Phase 6 extension: FK on delete cascade FAILED — set survived session delete",
          { cascadeSetId },
        );
      } else {
        pass(
          "Phase 6 extension: FK on delete cascade purged exercise_sets when session deleted",
        );
      }
    }
  }
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
    // WR-03 (05-REVIEW.md): sign out the anon clients BEFORE deleting their
    // backing auth.users rows. cleanupTestUsers below calls
    // admin.auth.admin.deleteUser(u.id), which invalidates the user record
    // remotely but does NOT revoke the in-memory HS256 JWT clientA/clientB
    // still hold (valid until its `exp` claim, default 1 hour). If this
    // script is invoked twice in the same Node process (e.g., a watch-mode
    // test harness, or a future "rerun on failure" wrapper), any code path
    // that touched clientA/clientB BEFORE the second main()'s signInWithPassword
    // would attribute writes to a user that no longer exists — RLS would
    // reject those as if blocked, surfacing as a false-pass on the assertion
    // harness. Explicit signOut clears the in-memory session so the next
    // invocation starts from a clean slate. .catch swallows the "no session"
    // error that signOut throws when the client never signed in (e.g., if
    // main() aborted before the signInWithPassword calls).
    await Promise.allSettled([
      clientA.auth.signOut().catch(() => {}),
      clientB.auth.signOut().catch(() => {}),
    ]);
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
