// app/scripts/inspect-duplicate-sets.ts
//
// Diagnostic: lists every exercise_set row in a target session that shares
// its (exercise_id, set_number) with at least one other row — annotating
// duplicates with `  <-- DUPLICATE set_number` — and dumps the constraint +
// index state of `public.exercise_sets` from pg_catalog.
//
// Usage:
//   npm run inspect:duplicate-sets -- <session-uuid>
//
// If no UUID is passed, the script defaults to the historical session that
// surfaced the FIT-7 (P0 set_number race) bug — see 05-HUMAN-UAT.md Gap #1.
// The default is deliberately preserved so re-running the script with no
// arguments reproduces the original diagnostic output the migration was
// authored against.
//
// WR-04 (05-REVIEW.md): the session UUID is now a CLI argument
// (process.argv[2]) instead of a hardcoded constant, so the script is
// reusable on any suspect session without editing source. The
// `postgres`-js tagged-template `sql\`...\`` API parameterizes the value
// via bind parameter, so untrusted UUIDs cannot SQL-inject.

import postgres from "postgres";

const password = process.env.SUPABASE_DB_PASSWORD;
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
if (!password || !url) {
  console.error("SUPABASE_DB_PASSWORD and EXPO_PUBLIC_SUPABASE_URL required");
  process.exit(1);
}
const ref = new URL(url).hostname.split(".")[0];

// historical default — session that surfaced FIT-7 (UAT 2026-05-13)
const SESSION_ID = process.argv[2] || "379cfd29-a06f-4dbc-b429-ab273b16c096";

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
  console.log(
    `=== Session ${SESSION_ID.slice(0, 8)} — duplicate set_number rows in detail ===\n`,
  );
  const sets = await sql`
    select id, exercise_id, set_number, weight_kg, reps, completed_at, set_type
    from public.exercise_sets
    where session_id = ${SESSION_ID}
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
