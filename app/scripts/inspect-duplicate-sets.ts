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
  console.log("=== Session 379cfd29 — duplicate set_number rows in detail ===\n");
  const sets = await sql`
    select id, exercise_id, set_number, weight_kg, reps, completed_at, set_type
    from public.exercise_sets
    where session_id = '379cfd29-a06f-4dbc-b429-ab273b16c096'
    order by exercise_id, set_number, completed_at
  `;
  let prev: any = null;
  for (const s of sets) {
    const isDup =
      prev &&
      prev.exercise_id === s.exercise_id &&
      Number(prev.set_number) === Number(s.set_number);
    const marker = isDup ? "  <-- DUPLICATE set_number" : "";
    console.log(
      `  id=${s.id.slice(0, 8)}…  ex=${s.exercise_id.slice(0, 8)}…  sn=${s.set_number}  ${s.weight_kg}kg×${s.reps}  ${s.completed_at.toISOString()}${marker}`,
    );
    prev = s;
  }

  console.log("\n=== Schema check — is there a UNIQUE constraint on (session_id, exercise_id, set_number)? ===");
  const constraints = await sql`
    select
      con.conname,
      con.contype,
      pg_get_constraintdef(con.oid) as definition
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname = 'exercise_sets'
    order by con.conname
  `;
  for (const c of constraints) {
    console.log(`  ${c.conname}  type=${c.contype}  ${c.definition}`);
  }

  console.log("\n=== Indexes on exercise_sets ===");
  const indexes = await sql`
    select indexname, indexdef
    from pg_indexes
    where schemaname = 'public' and tablename = 'exercise_sets'
    order by indexname
  `;
  for (const i of indexes) {
    console.log(`  ${i.indexname}`);
    console.log(`    ${i.indexdef}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(2);
  })
  .finally(() => sql.end());
