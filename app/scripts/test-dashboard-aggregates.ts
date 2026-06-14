// File: app/scripts/test-dashboard-aggregates.ts
//
// Wave-0 fixture harness for the Phase 12 dashboard aggregate logic
// (Migration 0011 → public.get_dashboard_summary). Locks the two highest-risk,
// product-judgment pieces of the streak/week SQL with deterministic seeds:
//
//   DASH-02 / D-07 — streak = consecutive calendar weeks meeting weekly_goal:
//     (a) 3 consecutive goal-weeks (incl. the current week, already met) → 3
//     (b) a gap week → the streak resets (the older island is NOT counted)
//     (c) current week NOT yet met but the prior 4 weeks met → 4
//         (locks the in-progress-week "<= 2" island boundary, RESEARCH A2/OQ-1)
//
//   DASH-06 / D-06 — week boundary buckets by LOCAL Mon–Sun ISO week:
//     (d) a session logged Sunday 23:30 LOCAL (Europe/Stockholm) must count in
//         the week that contains that local Sunday — NOT slide into the next
//         ISO week because its stored UTC instant is technically Sunday-late /
//         Monday-early (Pitfall 1, the at-time-zone-before-date_trunc nuance).
//
// The RPC is SECURITY INVOKER, so it is called through an AUTHENTICATED anon
// client (RLS scopes every read to that user). Seeding is done via the
// service-role admin client (RLS-bypass) so a clean per-week fixture can be
// laid down without going through the app write path.
//
// Run via: cd app && npm run test:dashboard
//   (which expands to: tsx --env-file=.env.local scripts/test-dashboard-aggregates.ts)
//
// This script is Node-only. It MUST NEVER be imported from app/lib/, app/app/,
// or any other Metro-bundled path (PITFALLS 2.3 — service-role-key isolation),
// mirroring the test-rls.ts header convention.

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { Database } from "../types/database";

// ---------------------------------------------------------------------------
// Env guard — fail loud (mirrors test-rls.ts).
// ---------------------------------------------------------------------------
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  throw new Error(
    "Missing env. Behöver EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, " +
      "och SUPABASE_SERVICE_ROLE_KEY i app/.env.local. Kör via `npm run test:dashboard`.",
  );
}

const TZ = "Europe/Stockholm";
const TEST_EMAIL_PREFIX = "dash-test-";
const TEST_EMAIL = `${TEST_EMAIL_PREFIX}user@fitnessmaxxing.local`;
const TEST_PASSWORD = "Dash-Test-Pwd-2026!";

const admin: SupabaseClient<Database> = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const client: SupabaseClient<Database> = createClient<Database>(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// Assertion harness (test-rls.ts shape).
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

// ---------------------------------------------------------------------------
// Local-week math (must agree with the RPC's date_trunc('week', ts at time zone TZ)).
//
// localWeekStart(d): the UTC instant corresponding to local-Monday-00:00 of the
// ISO week containing instant `d`, in TZ. We do this with Intl parts (no extra
// dep) — get the local Y/M/D + weekday, back up to Monday, then re-anchor to a
// safe mid-day UTC inside that local Monday so DST never flips the calendar day.
// ---------------------------------------------------------------------------
function localParts(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    day: Number(parts.day),
    isoDow: weekdayMap[parts.weekday as string],
    hour: Number(parts.hour),
  };
}

// The offset (ms) to add to a "naive UTC" interpretation of a local wall-clock
// time to get the true UTC instant, for timezone TZ at instant `d`. DST-aware:
// derived from the formatter's local parts vs the UTC parts of the same instant.
function tzOffsetMs(d: Date): number {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => Number(p.find((x) => x.type === t)!.value);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return asUTC - d.getTime();
}

// Build the exact UTC instant for a given LOCAL wall-clock Y/M/D H:M in TZ.
// Two-pass offset correction handles DST boundary days.
function localWallClockToUTC(y: number, m: number, day: number, hour: number, minute: number): Date {
  const naive = Date.UTC(y, m - 1, day, hour, minute, 0);
  let guess = new Date(naive - tzOffsetMs(new Date(naive)));
  // Re-correct once using the offset at the guessed instant (DST-stable).
  guess = new Date(naive - tzOffsetMs(guess));
  return guess;
}

// Exact local-time instant N local-days back from `from`, at local hour:minute.
function atLocalDaysAgo(from: Date, daysAgo: number, localHour: number, localMinute = 0): Date {
  // Step back daysAgo calendar days in LOCAL terms, then anchor the wall clock.
  const stepped = new Date(from.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const p = localParts(stepped);
  return localWallClockToUTC(p.y, p.m, p.day, localHour, localMinute);
}

// Exact UTC instant for this week's local Monday 12:00 (Mon-based ISO week).
function thisWeekMondayNoon(now: Date): Date {
  const p = localParts(now);
  const daysSinceMonday = p.isoDow - 1; // Mon=0 … Sun=6
  return atLocalDaysAgo(now, daysSinceMonday, 12, 0);
}

// ---------------------------------------------------------------------------
// Seeding helpers.
// ---------------------------------------------------------------------------
let userId: string;
let exerciseId: string;

async function seedFinishedSession(startedAt: Date): Promise<void> {
  const sessionId = randomUUID();
  const finishedAt = new Date(startedAt.getTime() + 45 * 60 * 1000); // +45 min duration
  const { error: sErr } = await admin.from("workout_sessions").insert({
    id: sessionId,
    user_id: userId,
    plan_id: null,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
  });
  if (sErr) throw new Error(`seed session: ${sErr.message}`);
  const { error: setErr } = await admin.from("exercise_sets").insert({
    session_id: sessionId,
    exercise_id: exerciseId,
    set_number: 1,
    reps: 5,
    weight_kg: 100,
    set_type: "working",
  });
  if (setErr) throw new Error(`seed set: ${setErr.message}`);
}

async function clearSessions(): Promise<void> {
  // exercise_sets cascade-delete with their session.
  await admin.from("workout_sessions").delete().eq("user_id", userId);
}

async function setWeeklyGoal(goal: number): Promise<void> {
  const { error } = await admin.from("profiles").update({ weekly_goal: goal }).eq("id", userId);
  if (error) throw new Error(`set weekly_goal: ${error.message}`);
}

async function dashboard(): Promise<{
  streak_weeks: number;
  sessions_this_week: number;
  volume_this_week_kg: number;
  volume_prior_week_kg: number;
  weekly_volume_series: { week: string; volume_kg: number }[];
}> {
  const { data, error } = await client.rpc("get_dashboard_summary", { p_tz: TZ });
  if (error) throw new Error(`get_dashboard_summary: ${error.message}`);
  const row = data?.[0];
  if (!row) throw new Error("get_dashboard_summary returned no row");
  return {
    streak_weeks: Number(row.streak_weeks),
    sessions_this_week: Number(row.sessions_this_week),
    volume_this_week_kg: Number(row.volume_this_week_kg),
    volume_prior_week_kg: Number(row.volume_prior_week_kg),
    weekly_volume_series: (row.weekly_volume_series ?? []) as {
      week: string;
      volume_kg: number;
    }[],
  };
}

async function cleanup(): Promise<void> {
  const { data } = await admin.auth.admin.listUsers();
  for (const u of data?.users ?? []) {
    if (u.email && u.email.startsWith(TEST_EMAIL_PREFIX)) {
      await admin.from("workout_sessions").delete().eq("user_id", u.id);
      await admin.from("exercises").delete().eq("user_id", u.id);
      await admin.auth.admin.deleteUser(u.id).catch(() => {});
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("[test-dashboard] cleanup (start)…");
  await cleanup();

  console.log("[test-dashboard] seed user + exercise…");
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    throw new Error(`createUser failed: ${createErr?.message ?? "no user"}`);
  }
  userId = created.user.id;

  const { data: ex, error: exErr } = await admin
    .from("exercises")
    .insert({ user_id: userId, name: "dash-test-squat" })
    .select()
    .single();
  if (exErr || !ex) throw new Error(`seed exercise: ${exErr?.message}`);
  exerciseId = ex.id;

  const { error: signInErr } = await client.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (signInErr) throw new Error(`signIn: ${signInErr.message}`);

  const now = new Date();
  const mondayNoon = thisWeekMondayNoon(now);

  // -------------------------------------------------------------------------
  // (a) 3 consecutive goal-weeks (incl. current, already met) → streak 3.
  //     weekly_goal = 2. Seed 2 sessions each in: this week, last week, 2-weeks-ago.
  // -------------------------------------------------------------------------
  console.log("[test-dashboard] (a) 3 consecutive goal-weeks → 3…");
  await setWeeklyGoal(2);
  await clearSessions();
  for (const weeksBack of [0, 1, 2]) {
    // Two sessions inside each week: Tuesday + Thursday local (well within Mon–Sun).
    await seedFinishedSession(new Date(mondayNoon.getTime() - weeksBack * 7 * 24 * 60 * 60 * 1000 + 1 * 24 * 60 * 60 * 1000));
    await seedFinishedSession(new Date(mondayNoon.getTime() - weeksBack * 7 * 24 * 60 * 60 * 1000 + 3 * 24 * 60 * 60 * 1000));
  }
  {
    const d = await dashboard();
    if (d.streak_weeks === 3) pass("(a) 3 consecutive goal-weeks → streak 3");
    else fail("(a) 3 consecutive goal-weeks → streak 3", { got: d.streak_weeks });
    if (d.sessions_this_week === 2) pass("(a) sessions_this_week counts current-week sessions (2)");
    else fail("(a) sessions_this_week === 2", { got: d.sessions_this_week });

    // DASH-03 / D-05 — the two scalar week-volume fields that feed the History
    // delta chip. Each seeded session = 100 kg × 5 reps = 500 kg; 2 sessions in
    // both this week and last week → 1000 kg each. Locks the volume_this_week_kg
    // vs volume_prior_week_kg pair the +N% delta is computed from.
    if (d.volume_this_week_kg === 1000)
      pass("(a) volume_this_week_kg === 1000 (2 sessions × 500 kg)");
    else fail("(a) volume_this_week_kg === 1000", { got: d.volume_this_week_kg });
    if (d.volume_prior_week_kg === 1000)
      pass("(a) volume_prior_week_kg === 1000 (prior week, delta baseline)");
    else fail("(a) volume_prior_week_kg === 1000", { got: d.volume_prior_week_kg });
  }

  // -------------------------------------------------------------------------
  // (b) A gap week resets the streak: this week + last week met, then a GAP at
  //     2-weeks-ago, then 3-weeks-ago met. The live island is only {this, last}
  //     → streak 2 (the older met week is across the gap and NOT counted).
  // -------------------------------------------------------------------------
  console.log("[test-dashboard] (b) gap week resets streak → 2…");
  await clearSessions();
  for (const weeksBack of [0, 1, 3]) {
    await seedFinishedSession(new Date(mondayNoon.getTime() - weeksBack * 7 * 24 * 60 * 60 * 1000 + 1 * 24 * 60 * 60 * 1000));
    await seedFinishedSession(new Date(mondayNoon.getTime() - weeksBack * 7 * 24 * 60 * 60 * 1000 + 3 * 24 * 60 * 60 * 1000));
  }
  {
    const d = await dashboard();
    if (d.streak_weeks === 2) pass("(b) gap week resets streak → 2 (older island across the gap excluded)");
    else fail("(b) gap week resets streak → 2", { got: d.streak_weeks });
  }

  // -------------------------------------------------------------------------
  // (c) Current week NOT yet met (0 sessions), but the prior 4 weeks each met
  //     the goal → streak 4. Locks the "<= 2" in-progress-week island boundary:
  //     an empty current week (rn=1) must NOT break the streak that ends at
  //     last week (rn=2). RESEARCH A2 / OQ-1.
  // -------------------------------------------------------------------------
  console.log("[test-dashboard] (c) in-progress current week not-yet-met, prior 4 met → 4…");
  await clearSessions();
  for (const weeksBack of [1, 2, 3, 4]) {
    await seedFinishedSession(new Date(mondayNoon.getTime() - weeksBack * 7 * 24 * 60 * 60 * 1000 + 1 * 24 * 60 * 60 * 1000));
    await seedFinishedSession(new Date(mondayNoon.getTime() - weeksBack * 7 * 24 * 60 * 60 * 1000 + 3 * 24 * 60 * 60 * 1000));
  }
  {
    const d = await dashboard();
    if (d.streak_weeks === 4) pass("(c) in-progress empty current week does not break a 4-week streak → 4");
    else fail("(c) prior 4 weeks met, current week empty → streak 4", { got: d.streak_weeks });
    if (d.sessions_this_week === 0) pass("(c) sessions_this_week === 0 for the empty current week");
    else fail("(c) sessions_this_week === 0", { got: d.sessions_this_week });
  }

  // -------------------------------------------------------------------------
  // (d) Week-boundary: a session at Sunday 23:30 LOCAL must bucket into the week
  //     that contains that local Sunday — i.e. the SAME week as that Sunday's
  //     Monday, NOT the following ISO week. Seed exactly one such session in
  //     "last week" (so it lands in last week's series bucket, not this week's).
  //     Assert the series bucket for last-week's Monday carries the volume.
  // -------------------------------------------------------------------------
  console.log("[test-dashboard] (d) Sunday 23:30 local buckets into the correct ISO week…");
  await setWeeklyGoal(3); // high goal so this single session is NOT a goal-week (isolate the bucketing assertion)
  await clearSessions();
  // Last week's Sunday = this-week-Monday minus 1 local day, at exactly 23:30 local.
  const lastSunday2330 = atLocalDaysAgo(mondayNoon, 1, 23, 30);
  await seedFinishedSession(lastSunday2330);
  {
    const d = await dashboard();
    // The series 'week' keys are local-Monday YYYY-MM-DD strings. Last week's
    // Monday is this-week's Monday minus 7 local days.
    const lastWeekMonday = atLocalDaysAgo(mondayNoon, 7, 12);
    const lwParts = localParts(lastWeekMonday);
    const lwKey = `${lwParts.y}-${String(lwParts.m).padStart(2, "0")}-${String(lwParts.day).padStart(2, "0")}`;
    const thisWeekParts = localParts(mondayNoon);
    const twKey = `${thisWeekParts.y}-${String(thisWeekParts.m).padStart(2, "0")}-${String(thisWeekParts.day).padStart(2, "0")}`;

    const lwBucket = d.weekly_volume_series.find((b) => b.week === lwKey);
    const twBucket = d.weekly_volume_series.find((b) => b.week === twKey);
    const lwVol = lwBucket ? Number(lwBucket.volume_kg) : -1;
    const twVol = twBucket ? Number(twBucket.volume_kg) : -1;

    if (lwVol === 500 && twVol === 0) {
      pass("(d) Sunday-23:30-local session buckets into last week (500 kg), not this week (0 kg)");
    } else {
      fail("(d) Sunday-23:30-local bucketing", {
        expected: { lastWeek: lwKey, lastWeekVol: 500, thisWeek: twKey, thisWeekVol: 0 },
        got: { lastWeekVol: lwVol, thisWeekVol: twVol },
        series: d.weekly_volume_series,
      });
    }
    if (d.sessions_this_week === 0) {
      pass("(d) the Sunday-night session did NOT leak into this week's session count");
    } else {
      fail("(d) sessions_this_week === 0 after Sunday-night last-week session", {
        got: d.sessions_this_week,
      });
    }
  }
}

(async () => {
  let exitCode = 0;
  let mainCompleted = false;
  try {
    await main();
    mainCompleted = true;
  } catch (e) {
    console.error("[test-dashboard] FATAL:", e instanceof Error ? e.message : e);
    exitCode = 1;
  } finally {
    console.log("[test-dashboard] cleanup (end)…");
    await client.auth.signOut().catch(() => {});
    try {
      await cleanup();
    } catch (e) {
      console.error("[test-dashboard] cleanup at end failed:", e instanceof Error ? e.message : e);
      exitCode = 1;
    }
    console.log("");
    if (!mainCompleted) {
      console.log("[test-dashboard] ABORTED before assertions completed — see FATAL above");
      exitCode = 1;
    } else if (failures.length === 0) {
      console.log("[test-dashboard] ALL ASSERTIONS PASSED");
    } else {
      console.log(`[test-dashboard] ${failures.length} FAILURE(S)`);
      for (const f of failures) console.log(`  - ${f}`);
      exitCode = 1;
    }
    process.exit(exitCode);
  }
})();
