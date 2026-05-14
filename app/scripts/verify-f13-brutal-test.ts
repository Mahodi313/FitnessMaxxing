import postgres from "postgres";

const password = process.env.SUPABASE_DB_PASSWORD;
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
if (!password || !url) {
  console.error("SUPABASE_DB_PASSWORD and EXPO_PUBLIC_SUPABASE_URL required");
  process.exit(1);
}
const ref = new URL(url).hostname.split(".")[0];

const sql = postgres({
  host: "aws-1-eu-north-1.pooler.supabase.com",
  port: 5432,
  database: "postgres",
  username: `postgres.${ref}`,
  password,
  ssl: "require",
  max: 1,
});

const RECENT_WINDOW_MIN = 60;
let failures = 0;

function pass(msg: string) {
  console.log(`  PASS: ${msg}`);
}
function fail(msg: string) {
  console.log(`  FAIL: ${msg}`);
  failures++;
}

async function main() {
  console.log(
    `[verify-f13-brutal-test] Looking for the most recent workout_session created in the last ${RECENT_WINDOW_MIN} min...\n`,
  );

  const sessions = await sql`
    select
      ws.id,
      ws.user_id,
      ws.started_at,
      ws.finished_at,
      ws.notes,
      p.email,
      (select count(*) from public.exercise_sets es where es.session_id = ws.id) as set_count
    from public.workout_sessions ws
    left join auth.users p on p.id = ws.user_id
    where ws.started_at > now() - (${RECENT_WINDOW_MIN}::text || ' minutes')::interval
    order by ws.started_at desc
    limit 5
  `;

  if (sessions.length === 0) {
    console.log(`No workout_sessions found in the last ${RECENT_WINDOW_MIN} min. Nothing to verify.`);
    process.exit(0);
  }

  console.log("Recent sessions (most recent first):");
  for (const s of sessions) {
    console.log(
      `  ${s.id}  user=${s.email ?? s.user_id}  started=${s.started_at.toISOString()}  finished=${s.finished_at ? s.finished_at.toISOString() : "null"}  sets=${s.set_count}`,
    );
  }
  console.log("");

  const target = sessions[0];
  console.log(`=== Verifying brutal-test against most-recent session ===`);
  console.log(`SESSION_ID: ${target.id}`);
  console.log(`user:       ${target.email ?? target.user_id}`);
  console.log(`started_at: ${target.started_at.toISOString()}`);
  console.log(`finished_at:${target.finished_at ? target.finished_at.toISOString() : "null (Phase 7 not run)"}`);
  console.log("");

  console.log("--- Pass criteria ---");

  if (Number(target.set_count) === 25) {
    pass(`exercise_sets count is exactly 25 (found ${target.set_count})`);
  } else {
    fail(`expected 25 exercise_sets, found ${target.set_count}`);
  }

  const sets = await sql`
    select id, exercise_id, set_number, weight_kg, reps, completed_at, set_type
    from public.exercise_sets
    where session_id = ${target.id}
    order by exercise_id, set_number
  `;

  const byExercise = new Map<string, typeof sets>();
  for (const s of sets) {
    if (!byExercise.has(s.exercise_id)) byExercise.set(s.exercise_id, [] as any);
    byExercise.get(s.exercise_id)!.push(s);
  }

  console.log(`  found ${byExercise.size} distinct exercises in this session`);

  for (const [exId, exSets] of byExercise.entries()) {
    const setNumbers = exSets.map((s: any) => Number(s.set_number));
    const expected = Array.from({ length: setNumbers.length }, (_, i) => i + 1);
    const isContiguous = setNumbers.every((n, i) => n === expected[i]);
    if (isContiguous) {
      pass(`exercise ${exId.slice(0, 8)}…: set_numbers contiguous 1..${setNumbers.length}`);
    } else {
      fail(`exercise ${exId.slice(0, 8)}…: set_numbers NOT contiguous, got [${setNumbers.join(", ")}]`);
    }
  }

  const allWorking = sets.every((s: any) => s.set_type === "working");
  if (allWorking) {
    pass(`all 25 sets have set_type = 'working'`);
  } else {
    const otherTypes = [...new Set(sets.map((s: any) => s.set_type))];
    fail(`expected all sets set_type='working', found types: [${otherTypes.join(", ")}]`);
  }

  const allHaveTimestamps = sets.every((s: any) => s.completed_at instanceof Date);
  if (allHaveTimestamps) {
    pass(`all 25 sets have valid completed_at timestamps`);
  } else {
    fail(`some sets are missing completed_at`);
  }

  if (target.finished_at) {
    const setMaxCompleted = Math.max(...sets.map((s: any) => s.completed_at.getTime()));
    if (target.finished_at.getTime() >= setMaxCompleted) {
      pass(`workout_sessions.finished_at (${target.finished_at.toISOString()}) is >= max(set.completed_at) — finish UPDATE landed AFTER all set INSERTs (FIFO replay correct)`);
    } else {
      fail(
        `finished_at (${target.finished_at.toISOString()}) is BEFORE last set completed_at (${new Date(setMaxCompleted).toISOString()}) — finish UPDATE landed too early, FIFO ordering broken`,
      );
    }
  } else {
    console.log(`  SKIP: workout_sessions.finished_at is null (Phase 7 was skipped — fine, this is a valid brutal-test path)`);
  }

  const startedTs = target.started_at.getTime();
  const setMinCompleted = Math.min(...sets.map((s: any) => s.completed_at.getTime()));
  if (setMinCompleted >= startedTs) {
    pass(`all sets completed_at >= session started_at (no FK-out-of-order anomalies)`);
  } else {
    fail(
      `at least one set has completed_at BEFORE session started_at — possible FK-out-of-order replay`,
    );
  }

  console.log("");
  if (failures === 0) {
    console.log(`[verify-f13-brutal-test] ALL ASSERTIONS PASSED — F13 brutal-test gate CLOSED ✓`);
    process.exit(0);
  } else {
    console.log(`[verify-f13-brutal-test] ${failures} ASSERTION(S) FAILED — see above`);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error("[verify-f13-brutal-test] error:", e);
    process.exit(2);
  })
  .finally(() => sql.end());
