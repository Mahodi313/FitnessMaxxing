---
phase: 02-schema-rls-type-generation
reviewed: 2026-05-09T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - app/supabase/migrations/0001_initial_schema.sql
  - app/types/database.ts
  - app/lib/supabase.ts
  - app/app/_layout.tsx
  - app/scripts/test-rls.ts
  - app/scripts/verify-deploy.ts
  - app/.env.example
  - app/package.json
  - app/supabase/config.toml
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-09
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found (no BLOCKER findings)

## Summary

Phase 02 delivers the initial Supabase schema, RLS policies, generated types, the typed Supabase client, and two Node-only verification harnesses. The headline security gates (service-role-key isolation, wrapped `(select auth.uid())` everywhere, `with check` on all writable policies, search-path-hardened `SECURITY DEFINER` trigger) are all correctly in place — `git grep "service_role\|SERVICE_ROLE"` matches only `app/scripts/test-rls.ts`, `app/.env.example`, `.planning/`, and `CLAUDE.md`, exactly as the convention requires.

No BLOCKER findings. The defects below are all WARNING/INFO and concentrate in the verification scripts (cleanup correctness, region hardcoding, untyped clients) rather than the production-runtime client path. Most notable concerns:

- `test-rls.ts` cleanup uses unpaginated `admin.auth.admin.listUsers()` — silently misses test users beyond the default page size, leading to leak-and-skip cleanup behavior over time.
- `verify-deploy.ts` hardcodes the eu-north-1 pooler hostname; non-EU projects break.
- `test-rls.ts` does not pass `<Database>` to `createClient`, so table/column typos aren't caught at compile time — the file is the regression detector for RLS, and a silent typo would manifest as a false PASS.

The migration intentionally has no `IF NOT EXISTS` guards (per D-04/D-06); this is documented in CONTEXT and acceptable for a single-environment Supabase project where re-application is via `db reset`, not idempotent re-run.

## Warnings

### WR-01: `cleanupTestUsers` does not paginate `listUsers` — leak-and-skip risk over time

**File:** `app/scripts/test-rls.ts:148`
**Issue:** `admin.auth.admin.listUsers()` is paginated; the default page size is 50 and `data.users` is only the first page. As the project's `auth.users` table grows (real users + accumulated test users from any cleanup that previously failed), test users beyond page 1 will be silently skipped by the cleanup loop. Once skipped, they stay forever (until manually purged) and could collide with future test runs (the script currently uses fixed emails `rls-test-a@...` / `rls-test-b@...`, so a leaked user blocks the next `createUser` with `email_exists`). The script will then throw a setup error rather than fail an assertion — recoverable but obscures the root cause.

This is a real defect for the harness's robustness, not just a hypothetical: any aborted run that throws between `createUser` and end-cleanup creates a leak, and the cleanup-at-start path is the only recovery.

**Fix:**
```ts
async function cleanupTestUsers() {
  let page = 1;
  const perPage = 1000; // listUsers max
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Cleanup listUsers failed: ${error.message}`);
    if (!data.users.length) break;
    for (const u of data.users) {
      if (u.email && u.email.startsWith(TEST_EMAIL_PREFIX)) {
        try { await purgeUserData(u.id); } catch (purgeErr) {
          console.warn(`  WARN: purgeUserData(${u.email}) threw: ${(purgeErr as Error).message}`);
        }
        const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
        if (delErr) console.warn(`  WARN: deleteUser(${u.email}) failed: ${delErr.message}`);
      }
    }
    if (data.users.length < perPage) break;
    page++;
  }
}
```

### WR-02: `verify-deploy.ts` hardcodes eu-north-1 pooler host — breaks for any non-EU project

**File:** `app/scripts/verify-deploy.ts:12`
**Issue:** The pooler `host: "aws-1-eu-north-1.pooler.supabase.com"` is hardcoded. The script is documented in CLAUDE.md as the canonical drift-verification entry point on Windows-without-Docker; if the project is ever moved to a different region, restored from a different region, or used as a template for a project in another region, this script silently fails to connect with no useful error pointing at the cause. The project ref (`mokmiuifpdzwnceufduu`) is also derived correctly from the URL on line 9, but the region is not — a contradiction that should be resolved by parsing the region from env or from the URL host as well.

**Fix:** Either (a) read the pooler host from a new `SUPABASE_DB_POOLER_HOST` env var with a sensible default, or (b) accept a full `SUPABASE_DB_URL` connection string and parse it via the `postgres` constructor:
```ts
const poolerHost = process.env.SUPABASE_DB_POOLER_HOST
  ?? `aws-1-${process.env.SUPABASE_REGION ?? "eu-north-1"}.pooler.supabase.com`;
const sql = postgres({ host: poolerHost, /* ... */ });
```
And document the new env in `.env.example`.

### WR-03: `test-rls.ts` uses untyped `SupabaseClient` — table/column typos compile silently

**File:** `app/scripts/test-rls.ts:27,60,64,68`
**Issue:** The harness calls `createClient(url, key, ...)` (not `createClient<Database>`) and types the resulting clients as `SupabaseClient` (not `SupabaseClient<Database>`). Every `.from("exercise_sets")` / `.insert({...})` / `.eq("user_id", ...)` is therefore untyped against the schema. A typo like `.from("exercise_set")` (missing `s`) returns a runtime "relation does not exist" error from PostgREST that the assertion harness will *interpret as a successful RLS block* in `assertWriteBlocked` (line 108: `if (result.error) { pass(...) }`). That collapses the harness's load-bearing role — the test would pass while testing nothing.

This is the highest-impact warning: the file IS the RLS regression detector for every future schema migration, per the new CLAUDE.md "Cross-user verification is a gate" convention.

**Fix:**
```ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

const admin: SupabaseClient<Database> = createClient<Database>(url, serviceKey, { /* ... */ });
const clientA: SupabaseClient<Database> = createClient<Database>(url, anonKey, { /* ... */ });
const clientB: SupabaseClient<Database> = createClient<Database>(url, anonKey, { /* ... */ });
```
Optionally tighten `assertWriteBlocked` to inspect the error code and only accept `42501` / `PGRST301`-style RLS errors, treating "relation does not exist" / "column does not exist" as a hard fail.

### WR-04: `verify-deploy.ts` leaks the postgres connection on error

**File:** `app/scripts/verify-deploy.ts:90-93`
**Issue:** The top-level `.catch(...)` calls `process.exit(1)` without first calling `await sql.end()`. `postgres@3` opens a real TCP socket at module import; if any query in `main()` throws, the catch block exits without closing the pool. On Windows this typically triggers a noisy unhandled-rejection warning at exit; on a CI runner the script may also exit before the connection is fully closed, leaving Supabase's pooler holding the slot for a few seconds. Minor in a one-shot script but trivially fixed.

**Fix:**
```ts
main().catch(async (e) => {
  console.error(e);
  try { await sql.end({ timeout: 5 }); } catch { /* ignore */ }
  process.exit(1);
});
```

## Info

### IN-01: Missing `INSERT` policy on `profiles` is intentional but undocumented at policy level

**File:** `app/supabase/migrations/0001_initial_schema.sql:114`
**Issue:** The comment "(no INSERT policy — handle_new_user trigger inserts via SECURITY DEFINER, bypassing RLS by design)" is correct and is the right design, but a future reviewer scanning only the policies table (e.g., via `pg_policies`) will see that `profiles` has no INSERT policy and may assume it's a gap. Consider adding a single-line policy comment in the migration file explaining the bypass, or a `comment on table public.profiles is '...'` SQL statement so the rationale travels with the schema, not just the migration file.

**Fix:** Add at the end of section 5:
```sql
comment on table public.profiles is
  'INSERT path is handle_new_user trigger (SECURITY DEFINER); RLS therefore has SELECT+UPDATE policies only. Direct client INSERT is correctly blocked.';
```

### IN-02: AES key reuse window in `LargeSecureStore.setItem`

**File:** `app/lib/supabase.ts:59-62`
**Issue:** `setItem` writes the new AES key to SecureStore (inside `_encrypt`) BEFORE writing the new ciphertext to AsyncStorage. If a crash occurs between `_encrypt` (which sets the new SecureStore key) and `AsyncStorage.setItem`, the SecureStore now has a key that decrypts nothing — and the OLD ciphertext in AsyncStorage is now undecryptable (it was encrypted with the previous key, which has just been overwritten). This silently invalidates the user's session and forces a re-login.

This is acceptable for an auth-token wrapper (worst case = user logs in again, which is the same UX as token expiry) and the recipe is the canonical Supabase pattern, so this is informational. If you ever extend `LargeSecureStore` for non-auth data where a re-fetch isn't free, write the ciphertext first under a temp key, then atomically swap.

**Fix:** No change required for the auth-only use case; document in a comment that crash-during-setItem invalidates the previous session as a known accepted tradeoff.

### IN-03: Module-level `AppState`/`NetInfo` listeners accumulate on Fast Refresh

**File:** `app/lib/supabase.ts:83-87` and `app/app/_layout.tsx:17-33`
**Issue:** Both files register listeners at module top-level. In production this fires once per app launch and is fine. In dev, Fast Refresh can re-execute the module, attaching a second listener while the first is still live — `focusManager.setEventListener` overwrites the previous registration (TanStack Query keeps only the latest), but `AppState.addEventListener` does NOT — `supabase.ts` will end up with N listeners after N hot reloads, each calling `startAutoRefresh` / `stopAutoRefresh`. Functionally harmless (idempotent operations), but creates noisy duplicate behavior in dev tools and is a smell that bites later if you put non-idempotent work in the callback.

**Fix:** Phase 04+ may want to wrap the auth listener in a guarded singleton:
```ts
declare global { var __fmAppStateSub: { remove(): void } | undefined; }
globalThis.__fmAppStateSub?.remove();
globalThis.__fmAppStateSub = AppState.addEventListener("change", (state) => { /* ... */ });
```

### IN-04: `assertEmpty` will report a false PASS if the row was already deleted by a prior assertion

**File:** `app/scripts/test-rls.ts:89-99`
**Issue:** `assertEmpty` only checks "no rows returned." If a previous DELETE assertion in the same run (incorrectly) removed the target row, the SELECT would correctly return empty for a different reason than RLS, and `assertEmpty` would pass without proving RLS works. In the current ordering (SELECT before UPDATE/DELETE in every block), this is not exploitable, but it's fragile to reordering. Since the file is the regression gate, defending against future-edit footguns is worth a sentence.

**Fix:** Add a positive control check at the top of each block:
```ts
// Confirm the row STILL exists from admin's perspective before claiming RLS hides it from A.
const { data: adminCheck } = await admin.from("plan_exercises").select("id").eq("id", peB.id).single();
if (!adminCheck) fail("precondition: B's plan_exercise still exists in admin view"); else pass("precondition: B's plan_exercise exists");
```
Optional — current ordering is safe as written, but this future-proofs it.

### IN-05: `package.json` `gen:types` uses `>` redirect — works in PowerShell and bash but encoding differs

**File:** `app/package.json:12`
**Issue:** `npx supabase gen types typescript --project-id ... > types/database.ts` works on both shells, but PowerShell defaults output redirection to UTF-16-LE on Windows (legacy behavior in older PowerShell versions; PowerShell 7+ defaults to UTF-8). If the user is on Windows PowerShell 5.1 (the default with Windows 11 unless they've installed PS7), the generated `database.ts` will have a UTF-16 BOM and TypeScript may parse it strangely. The current commit shows the file is plain ASCII so this hasn't manifested yet, but the script will silently break for a future contributor on PS5.1.

**Fix:** Use the supabase CLI's built-in `--output` flag (if available in this version) or invoke via `node`:
```json
"gen:types": "npx supabase gen types typescript --project-id mokmiuifpdzwnceufduu --output types/database.ts"
```
Verify the CLI version supports `--output`; otherwise wrap with a tiny tsx/node shim that does the file write explicitly with UTF-8 encoding.

---

_Reviewed: 2026-05-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
