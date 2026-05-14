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

async function main() {
  const sessions = await sql`
    select
      ws.id,
      ws.user_id,
      ws.started_at,
      ws.finished_at,
      ws.notes,
      p.email
    from public.workout_sessions ws
    left join auth.users p on p.id = ws.user_id
    where ws.started_at > now() - interval '90 minutes'
    order by ws.started_at asc
  `;

  for (const s of sessions) {
    console.log("\n========================================");
    console.log(`SESSION ${s.id}`);
    console.log(`  user:        ${s.email ?? s.user_id}`);
    console.log(`  started_at:  ${s.started_at.toISOString()}`);
    console.log(`  finished_at: ${s.finished_at ? s.finished_at.toISOString() : "null"}`);
    if (s.finished_at) {
      const durationMs = s.finished_at.getTime() - s.started_at.getTime();
      const mins = Math.floor(durationMs / 60000);
      const secs = Math.floor((durationMs % 60000) / 1000);
      console.log(`  duration:    ${mins}m ${secs}s`);
    }

    const sets = await sql`
      select exercise_id, set_number, weight_kg, reps, completed_at, set_type
      from public.exercise_sets
      where session_id = ${s.id}
      order by exercise_id, set_number
    `;
    console.log(`  set rows:    ${sets.length}`);

    if (sets.length > 0) {
      const byEx = new Map<string, typeof sets>();
      for (const setRow of sets) {
        const k = setRow.exercise_id;
        if (!byEx.has(k)) byEx.set(k, [] as any);
        byEx.get(k)!.push(setRow);
      }
      for (const [exId, exSets] of byEx.entries()) {
        const setNumbers = (exSets as any).map((s: any) => Number(s.set_number)).join(", ");
        console.log(`    ex ${exId.slice(0, 8)}…: ${(exSets as any).length} sets, set_numbers=[${setNumbers}]`);
      }

      const completedTimes = sets.map((r: any) => r.completed_at.getTime());
      const minC = Math.min(...completedTimes);
      const maxC = Math.max(...completedTimes);
      console.log(`    sets logged from ${new Date(minC).toISOString()}`);
      console.log(`    to              ${new Date(maxC).toISOString()}`);
      const spanMs = maxC - minC;
      console.log(
        `    span: ${Math.floor(spanMs / 60000)}m ${Math.floor((spanMs % 60000) / 1000)}s`,
      );
    }
  }
  console.log("\n========================================");
  console.log(`Total recent sessions: ${sessions.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(2);
  })
  .finally(() => sql.end());
