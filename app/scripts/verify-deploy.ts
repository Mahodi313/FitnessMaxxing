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

const tables = [
  "profiles",
  "exercises",
  "workout_plans",
  "plan_exercises",
  "workout_sessions",
  "exercise_sets",
];

async function main() {
  console.log("=== RLS status (pg_class.relrowsecurity) ===");
  const rls = await sql`
    select relname, relrowsecurity
    from pg_class
    where relnamespace = 'public'::regnamespace
      and relname = any(${tables})
    order by relname
  `;
  for (const r of rls) console.log(`  ${r.relrowsecurity ? "ON " : "OFF"}  public.${r.relname}`);

  console.log("\n=== Policies (pg_policies) ===");
  const policies = await sql`
    select schemaname, tablename, policyname, cmd, qual is not null as has_using, with_check is not null as has_with_check
    from pg_policies
    where schemaname = 'public'
    order by tablename, policyname
  `;
  for (const p of policies)
    console.log(
      `  ${p.tablename.padEnd(20)} ${p.policyname.padEnd(40)} ${String(p.cmd).padEnd(8)} using=${p.has_using} with_check=${p.has_with_check}`,
    );

  console.log("\n=== Triggers on auth.users ===");
  const triggers = await sql`
    select tgname, pg_get_triggerdef(oid) as def
    from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and not tgisinternal
  `;
  for (const t of triggers) console.log(`  ${t.tgname}\n    ${t.def}`);

  console.log("\n=== Functions in public ===");
  const functions = await sql`
    select proname, pg_get_function_result(oid) as ret
    from pg_proc
    where pronamespace = 'public'::regnamespace
    order by proname
  `;
  for (const f of functions) console.log(`  ${f.proname.padEnd(20)} returns ${f.ret}`);

  console.log("\n=== ENUMs in public ===");
  const enums = await sql`
    select t.typname, array_agg(e.enumlabel order by e.enumsortorder) as labels
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typnamespace = 'public'::regnamespace
    group by t.typname
  `;
  for (const e of enums) console.log(`  ${e.typname} = ${JSON.stringify(e.labels)}`);

  console.log("\n=== Tables in public ===");
  const t = await sql`
    select tablename from pg_tables where schemaname = 'public' order by tablename
  `;
  for (const r of t) console.log(`  public.${r.tablename}`);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
