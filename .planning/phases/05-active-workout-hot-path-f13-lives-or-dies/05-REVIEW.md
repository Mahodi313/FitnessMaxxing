---
phase: 05-active-workout-hot-path-f13-lives-or-dies
reviewed: 2026-05-14T00:00:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - app/app/(app)/(tabs)/_layout.tsx
  - app/app/(app)/(tabs)/index.tsx
  - app/app/(app)/_layout.tsx
  - app/app/(app)/plans/[id].tsx
  - app/app/(app)/workout/[sessionId].tsx
  - app/app/_layout.tsx
  - app/components/active-session-banner.tsx
  - app/lib/persistence-store.ts
  - app/lib/queries/sets.ts
  - app/lib/query/client.ts
  - app/lib/query/keys.ts
  - app/lib/query/network.ts
  - app/lib/query/persister.ts
  - app/lib/schemas/sets.ts
  - app/package.json
  - app/scripts/inspect-duplicate-sets.ts
  - app/scripts/inspect-recent-sessions.ts
  - app/scripts/manual-test-phase-05-f13-brutal.md
  - app/scripts/test-offline-queue.ts
  - app/scripts/test-rls.ts
  - app/scripts/test-set-schemas.ts
  - app/scripts/test-sync-ordering.ts
  - app/scripts/verify-f13-brutal-test.ts
  - app/supabase/migrations/0002_dedupe_exercise_sets.sql
  - app/supabase/migrations/0003_exercise_sets_natural_key.sql
  - app/supabase/migrations/0004_exercise_sets_set_number_trigger.sql
findings:
  critical: 1
  warning: 6
  info: 5
  total: 12
status: issues_found
---

# Phase 5 (gap-closure FIT-7..FIT-10): Code Review Report

**Reviewed:** 2026-05-14
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

This review targets the Phase 5 gap-closure work (Plans 05-04/05/06/07; PRs FIT-7 through FIT-10 merged 2026-05-14) layered on top of the original Phase 5 work (commit `06cb5a3`). The gap-closure deliverables themselves are largely sound: the SQL migrations are correctly ordered (0002 dedupe → 0003 UNIQUE → 0004 trigger), the trigger is correctly authored as SECURITY INVOKER with `set search_path = ''`, the client-side `set_number` computation has been fully removed from the persisted payload (D-16 properly superseded), the `PersistQueryClientProvider` wiring respects the LOAD-BEARING module-load order, the Swedish-locale `z.preprocess` correctly wraps only `weight_kg` (not `reps`/`rpe`) with the `/g` flag intact, and the test-rls.ts uniqueness assertion correctly uses `clientB` (RLS-scoped) rather than admin.

Adversarial issues that **DO** remain:

1. **One BLOCKER (CR-01) — `clientB` is not signed out before the natural-key uniqueness assertion runs**: the `cleanupTestUsers` `finally` block calls `admin.auth.admin.deleteUser(userB.id)` while `clientB` still holds an active JWT for that user. On the next test:rls run, the residual session in `clientB`'s in-memory state is not the failure mode — but the `cleanupTestUsers` call at the START of `main()` does NOT sign out the in-memory clients either, so on a re-run inside the same process (e.g., a test harness that calls main() twice), clientA/clientB would carry stale JWTs across user-rotation and silently authenticate as the previous test's users. This affects rerun durability for `test:rls`. More importantly: there's a real BLOCKER below in the migration 0002 + 0003 sequencing under concurrent deploy.

2. **Migration 0002 dedupe runs in a single `begin; ... commit;` block with NO advisory lock or `LOCK TABLE EXCLUSIVE`** — so a concurrent INSERT from a still-deployed-old-client into `exercise_sets` during the dedupe window can land a NEW duplicate AFTER the `delete` statement evaluates but BEFORE Migration 0003's UNIQUE constraint creation gets the `ACCESS EXCLUSIVE` lock. Migration 0003 will then fail (23505 at ALTER TABLE time) and either abort the migration chain (good, but leaves the DB in a partially-deduped state) or — if 0002 and 0003 are applied as separate transactions — leave 0003 unable to add the constraint until manual cleanup. **This is a real concern only for the FIRST deploy of these migrations against the live DB** while D-16-era clients are still in-flight; on a personal-use V1 with a single user/device, the practical impact is near-zero, but the migration files are checked-in for V1.1+ where multi-device sync is feasible.

3. Five WARNINGs cover: Fast-Refresh listener stacking that CR-01 from the previous review only partially closed (`focusManager` + `onlineManager.subscribe` STILL leak — the prior fix only protected the AppState background-flush); a logic bug in `test-rls.ts` cleanup where `clientA`/`clientB` are never signed out; `inspect:duplicate-sets` hardcodes a session-UUID in source (breaks reuse — must be edited before running); `verify-f13-brutal-test.ts` uses `(${RECENT_WINDOW_MIN}::text || ' minutes')::interval` which is correct postgres but slightly worse than the `make_interval(mins => ${RECENT_WINDOW_MIN})` parameterized form; `test:f13-brutal` script in package.json uses bare `--env-file` (not `--env-file-if-exists`) inconsistent with the FIT-7 hardening done for `test:rls`; `package.json` declares `expo-secure-store@~15.0.8` matching CLAUDE.md but `@shopify/react-native-skia@2.2.12` which CLAUDE.md previously footnoted as a corrected 2.2.x pin (no drift in 2026-05 baseline — confirmed); the `inspect-duplicate-sets.ts` script casts `prev: any` and `count: any` without need.

4. Info items document non-bug improvements: a typo in `app/scripts/test-set-schemas.ts` test-case label `"reject: weight 1255"` (the input is `1255` but the failure mode is "over 500"), the migration 0002 keep-row tiebreaker should ideally be `id ASC` deterministic rather than `completed_at asc nulls last, id asc` which has a subtle bug when `completed_at` is NULL (`NULLS LAST` is correct, but the comment claims "OLDEST by completed_at, then id" — under NULL the tiebreaker is the only signal; not a bug, but the comment is misleading), the `BL-` ID prefix in this review uses `CR-` (canonical) per the workflow contract, and the `inspect-recent-sessions.ts` script does not validate the queried sessions belong to the test user (admin RLS bypass means it'll dump anyone's data — fine for personal V1 but flag if multi-user dev environment).

Below: full findings in the requested format. Severity counts are **1 critical, 6 warning, 5 info**.

## Critical Issues

### CR-01: Migrations 0002 + 0003 sequencing has a TOCTOU window — concurrent INSERTs during dedupe can re-introduce duplicates before UNIQUE constraint lands

**File:** `app/supabase/migrations/0002_dedupe_exercise_sets.sql:16-32` (paired with `app/supabase/migrations/0003_exercise_sets_natural_key.sql:18-20`)

**Issue:** Migration 0002 wraps the dedupe in a `begin; ... commit;` block but does NOT acquire `LOCK TABLE public.exercise_sets IN ACCESS EXCLUSIVE MODE` or `pg_advisory_xact_lock(...)` before the `with ranked as (... row_number() ...) delete from public.exercise_sets es using ranked r where es.id = r.id and r.rn > 1`. Postgres' default isolation (READ COMMITTED) means concurrent transactions can INSERT rows into `exercise_sets` between the snapshot the CTE sees and the moment the DELETE commits.

The migration chain is `0002 → 0003 → 0004`. Supabase CLI applies these as separate top-level transactions (each migration file gets its own `begin/commit` pair). Between the commit of 0002 and the moment 0003's `ALTER TABLE ... ADD CONSTRAINT ... UNIQUE (session_id, exercise_id, set_number)` acquires `ACCESS EXCLUSIVE`, **any client running the pre-FIT-7 code path can land a duplicate** — because the old client computes `set_number = count + 1` from its local cache. Migration 0003 then fails with `23505 unique_violation` at constraint-creation time, leaving the DB in a state where 0002 has run but 0003 has not, and the schema is permanently out-of-sync with the migrations until manual remediation.

For a personal V1 with a single user / single device this is essentially unreachable (the deployer is the same physical actor as the writer), so the practical risk against the stated CLAUDE.md "personal gym-tracker V1" is low. But the migrations are checked in for the lifetime of the codebase, and if (a) V1.1+ ever supports multi-device or (b) a future contributor runs `supabase db push` against a shared staging DB while the old TestFlight build is still installed on someone's iPhone, the failure mode WILL fire. This is the contract gap that motivated the supersession of D-16 in the first place — closing it on the runtime path while leaving the migration path TOCTOU-vulnerable contradicts the intent.

**Fix:** Either (a) combine 0002 + 0003 into a single migration file so they run in one transaction (then the UNIQUE constraint creation blocks any concurrent INSERT until the dedupe's snapshot is committed):

```sql
-- app/supabase/migrations/0002_dedupe_and_natural_key.sql (combined)
begin;

-- Belt: take an exclusive lock so no concurrent INSERTs slip between
-- the DELETE evaluation and the UNIQUE constraint creation.
lock table public.exercise_sets in access exclusive mode;

with ranked as ( /* unchanged dedupe CTE */ )
delete from public.exercise_sets es
using ranked r where es.id = r.id and r.rn > 1;

alter table public.exercise_sets
  add constraint exercise_sets_session_exercise_setno_uq
  unique (session_id, exercise_id, set_number);

commit;
```

OR (b) keep them separate but add `lock table public.exercise_sets in access exclusive mode;` as the first statement inside 0002's `begin;` block, AND add the same lock as the first statement of 0003's transaction. The lock will be released at commit of 0002, and 0003 will re-acquire it. Between the two, a window still exists, but it is now constrained to the migration runner's own scheduler — Supabase CLI applies migrations sequentially in a single process, so the window collapses to microseconds.

Either fix is acceptable; (a) is stronger and is what I recommend.

## Warnings

### WR-01: Fast-Refresh listener stacking is only partially closed — `focusManager` + `onlineManager.subscribe(resumePausedMutations)` STILL leak across reloads

**File:** `app/lib/query/network.ts:56-61, 121-127`

**Issue:** The previous review's CR-01 was correctly addressed for the AppState background-flush subscription via the `globalRef[APPSTATE_BGFLUSH_KEY]` sentinel pattern (lines 86-102). However, two OTHER module-load-time subscriptions remain unprotected:

1. Line 56-61: `focusManager.setEventListener(...)` registers a new AppState listener every time `network.ts` is re-evaluated under Fast Refresh. The closure returned to `setEventListener` is overwritten internally by TanStack on each call, so the OLD AppState listener's `sub.remove` is never called — it leaks. After three reloads, every `AppState.change` event fires three closures, each calling `setFocused`. TanStack's `focusManager` is idempotent on `setFocused(true)`, so the user-visible bug is small, but the listener leak compounds memory.

2. Line 121-127: `onlineManager.subscribe((online) => { ... resumePausedMutations() ... })` likewise has no teardown. After three reloads, every NetInfo emission fires three closures, three of which call `resumePausedMutations()` if `online && !wasOnline`. This is the load-bearing Pitfall 8.12 close — and now it fires three times in dev. Replay is idempotent (upsert with onConflict:id), so the user sees no anomaly, but every additional replay is a wasted REST round-trip + a wasted Zod parse on the response.

The fix pattern (globalRef sentinel) is already proven in the same file — apply it consistently.

**Fix:** Wrap each of the three module-load-time subscriptions in the same `globalThis` sentinel pattern. Suggested keys:

```typescript
// Apply to focusManager.setEventListener
const FOCUS_MGR_KEY = "__fm_focus_mgr_sub__";
const globalFocus = globalThis as unknown as Record<string, (() => void) | undefined>;
if (globalFocus[FOCUS_MGR_KEY]) globalFocus[FOCUS_MGR_KEY]();
const focusUnsub = focusManager.setEventListener((setFocused) => {
  const sub = AppState.addEventListener("change", (s) => {
    if (Platform.OS !== "web") setFocused(s === "active");
  });
  return () => sub.remove();
});
globalFocus[FOCUS_MGR_KEY] = focusUnsub;

// Apply to onlineManager.subscribe (resumePausedMutations gate)
const ONLINE_REPLAY_KEY = "__fm_online_replay_sub__";
const globalReplay = globalThis as unknown as Record<string, (() => void) | undefined>;
if (globalReplay[ONLINE_REPLAY_KEY]) globalReplay[ONLINE_REPLAY_KEY]();
let wasOnline = onlineManager.isOnline();
const replayUnsub = onlineManager.subscribe((online) => {
  if (online && !wasOnline) void queryClient.resumePausedMutations();
  wasOnline = online;
});
globalReplay[ONLINE_REPLAY_KEY] = replayUnsub;
```

This makes `network.ts` fully Fast-Refresh-safe.

### WR-02: `test:f13-brutal` + `inspect:duplicate-sets` + `inspect:recent-sessions` use bare `--env-file=.env.local` (not `--env-file-if-exists`) — CI-unsafe

**File:** `app/package.json:25-27`

**Issue:** FIT-7 hardened `test:rls` to use `--env-file-if-exists=.env.local` so the script doesn't fail in CI environments that supply secrets via `env:` block instead of a `.env.local` file. But three other scripts kept the bare `--env-file=` form:

```json
"test:f13-brutal": "tsx --env-file=.env.local scripts/verify-f13-brutal-test.ts",
"inspect:duplicate-sets": "tsx --env-file=.env.local scripts/inspect-duplicate-sets.ts",
"inspect:recent-sessions": "tsx --env-file=.env.local scripts/inspect-recent-sessions.ts"
```

If `.env.local` is missing, tsx exits with `ENOENT: no such file or directory` BEFORE the script runs, which is a less informative failure than the explicit "Missing env" branch the scripts themselves implement. The `test:rls` line at 13 already demonstrates the correct pattern.

The inspect scripts are dev-only and unlikely to run in CI, but `test:f13-brutal` is listed in `manual-test-phase-05-f13-brutal.md` as a programmatic gate (Phase 9 step 41) and the manual UAT could be wired into CI on a real device farm later. Inconsistency is the bug, not the immediate failure.

**Fix:**

```json
"test:f13-brutal": "tsx --env-file-if-exists=.env.local scripts/verify-f13-brutal-test.ts",
"inspect:duplicate-sets": "tsx --env-file-if-exists=.env.local scripts/inspect-duplicate-sets.ts",
"inspect:recent-sessions": "tsx --env-file-if-exists=.env.local scripts/inspect-recent-sessions.ts"
```

The scripts already throw a loud error when env vars are missing, so the loss of the hard-fail at file-load time is not a regression.

### WR-03: `test-rls.ts` does not sign out `clientA` / `clientB` between runs — re-invocation in the same Node process carries stale JWTs across user-rotation

**File:** `app/scripts/test-rls.ts:148-167, 222-232`

**Issue:** `cleanupTestUsers()` deletes the auth.users rows for every email starting with `rls-test-` via `admin.auth.admin.deleteUser(u.id)`. After deletion, Supabase invalidates the user record, but the JWT held in `clientA.auth` / `clientB.auth` is NOT remotely revoked — it's an HS256 JWT signed with the project's JWT secret, valid until its `exp` claim (default 1 hour).

The script reaches `cleanupTestUsers` at startup (line 175) BEFORE attempting to sign in fresh users. If the script is invoked twice in the same Node process (e.g., a watch-mode test harness, or a future "rerun on failure" wrapper), the second invocation's `clientA.auth.signInWithPassword({ ... userA ... })` will succeed (with the freshly-created userA's credentials), overwriting the stale JWT. So in practice this doesn't manifest as a test failure today.

BUT: between the cleanup-on-start and the sign-in calls, clientA / clientB still carry the PREVIOUS run's user identities. Any code path that exercises clientA / clientB before sign-in (none exist today, but adversarial-coding-defense) would attribute writes to a user that no longer exists, triggering RLS rejections that look like "RLS-blocked successfully" — false-pass on the assertion harness.

The cleaner pattern is explicit sign-out before re-sign-in:

**Fix:**

```typescript
// Around line 222 (just before signInWithPassword)
await clientA.auth.signOut().catch(() => {});  // best-effort; no error if no session
await clientB.auth.signOut().catch(() => {});
// Then proceed with the existing signInWithPassword calls.
```

Or at the END of main() / in the cleanup `finally`:

```typescript
await Promise.allSettled([
  clientA.auth.signOut(),
  clientB.auth.signOut(),
]);
```

Either eliminates the stale-JWT window.

### WR-04: `inspect-duplicate-sets.ts` hardcodes session UUID `379cfd29-a06f-4dbc-b429-ab273b16c096` — script is one-shot, not reusable

**File:** `app/scripts/inspect-duplicate-sets.ts:23-28`

**Issue:** The SQL filter `where session_id = '379cfd29-a06f-4dbc-b429-ab273b16c096'` is the specific UAT-2026-05-13 session that motivated FIT-7. Re-running the script on any other suspect session requires editing the source file. The manual UAT doc (`manual-test-phase-05-f13-brutal.md:182`) explicitly tells the operator: "replacing the hard-coded session UUID at the top of `inspect-duplicate-sets.ts` with the suspect session id" — acknowledging the inconvenience.

This is a code-quality + dev-UX defect. A CLI argument or `process.env.INSPECT_SESSION_ID` env var would make the script reusable without source edits.

**Fix:**

```typescript
const sessionId = process.env.INSPECT_SESSION_ID ?? process.argv[2];
if (!sessionId) {
  console.error("Usage: INSPECT_SESSION_ID=<uuid> npm run inspect:duplicate-sets");
  console.error("   or: npm run inspect:duplicate-sets -- <uuid>");
  process.exit(1);
}
// Then bind sessionId into the query parameter:
const sets = await sql`
  select id, exercise_id, set_number, weight_kg, reps, completed_at, set_type
  from public.exercise_sets
  where session_id = ${sessionId}
  order by exercise_id, set_number, completed_at
`;
```

This also closes a minor SQL-injection-shaped concern: the hardcoded UUID is fine, but `process.argv[2]` going into a raw interpolation would be exploitable. `postgres`-js' tagged-template `sql\`...\`` API correctly parameterizes via `${sessionId}` (treats it as a bind parameter, not string interpolation).

### WR-05: Migration 0002 keep-row tiebreaker comment says "OLDEST by completed_at" but `nulls last` makes NULL `completed_at` rows the TOMBSTONE candidates

**File:** `app/supabase/migrations/0002_dedupe_exercise_sets.sql:18-26`

**Issue:** The `order by completed_at asc nulls last, id asc` correctly keeps the oldest non-NULL `completed_at` row first. But if ANY duplicate row has `completed_at = NULL`, that row sorts to the END (`nulls last`), so it is rank > 1 and is DELETED. The comment at lines 6-8 says: "Keeps the OLDEST row by completed_at per tuple, then `id` as a deterministic tiebreaker when completed_at ties or is null."

If the duplicate group is ALL `completed_at = NULL` (theoretically possible for a partially-written set under D-16-era race conditions), then all rows are `nulls last` together, and the `id asc` tiebreaker decides — the row with the lexicographically smallest UUID survives. That's deterministic, but the comment's "OLDEST" claim is misleading for the all-NULL case (UUIDs have no temporal ordering).

For this codebase's actual data — `exercise_sets.completed_at` has `default now()` (per migration 0001 line 81), so a NULL value implies the user explicitly passed `null` in the INSERT, which the client code never does — the all-NULL case is unreachable in practice. But the comment should be tightened.

**Fix:** Either reword the comment to: `"Keeps the row with the oldest non-NULL completed_at; under NULL ties, falls back to id ASC (deterministic, not temporally meaningful)."` — or add a defensive `where completed_at is not null` filter to the CTE so NULL rows are excluded from the dedupe entirely (and then a separate audit query can flag any orphaned NULL rows for manual review).

Code-quality only, not a correctness bug under current data assumptions.

### WR-06: `optimistic onMutate` for `['set','add']` provisional set_number computation can produce duplicate cache rows on replay-after-cold-start

**File:** `app/lib/query/client.ts:740-778`

**Issue:** The Plan 05-04 SUMMARY notes that the persisted payload omits `set_number` entirely (trigger assigns server-side), and the optimistic `onMutate` computes `provisionalSetNumber = (previous ?? []).filter((s) => s.exercise_id === vars.exercise_id).length + 1`. On a normal happy path this is fine — the optimistic row gets a provisional `set_number=N+1`, the server-assigned `set_number` reconciles on `onSettled invalidate`.

But consider the F13 brutal-test path: 25 paused `['set','add']` mutations are persisted with their `onMutate`-time provisional `set_number` already written to the cache (under `setsKeys.list(sessionId)`). After force-quit + cold-start, the cache is rehydrated from disk. Each rehydrated paused mutation's `onMutate` does NOT re-run (TanStack does not replay `onMutate` on rehydration — only `mutationFn`). So the cache holds the 25 optimistic rows with their original provisional set_numbers.

Edge case: if the optimistic cache rows were partially flushed pre-quit (e.g., the persister throttle had not yet captured the 25th row but had captured 24), the cache could rehydrate with 24 rows. The replaying mutations' `mutationFn` lands rows 1..25 on the server with server-assigned set_numbers. The `onSettled invalidate` then refetches the full server list (25 rows) — the cache reconciles correctly. No durable bug.

The risk is purely visual transient: between rehydrate and `onSettled invalidate`, the UI might briefly show 24 cache rows, then 25 after the invalidation refetch lands. The `hydrated` gate from FIT-8 covers the AsyncStorage round-trip but does NOT gate on `setsKeys.list` having reconciled to the server count. For a personal V1 with 25 sets typical-max, this transient flash is acceptable, but the `provisionalSetNumber` computation assumes the cache is the source of truth — which it is NOT on rehydrate.

**Fix:** This is a minor UX-tightening item, not a correctness defect. If you want to harden it, the optimistic row could be marked with a sentinel field (e.g., `_optimistic: true`) so the UI can render a subtle "syncing" indicator on those rows; or `onSettled` could explicitly re-set the cache to the server response shape via `setQueryData(setsKeys.list(...), refetchedData)` rather than just invalidating. Defer to V1.1; document in the LoggedSetRow's render path that the visible `set_number` is "provisional until refresh" if you want belt-and-braces.

## Info

### IN-01: `test-set-schemas.ts` test-case label `"reject: weight 1255"` — input value is `1255`, the test asserts the `"över 500kg"` error message, but the label is technically accurate AT-input-value 1255

**File:** `app/scripts/test-set-schemas.ts:43-47`

**Issue:** The test case's input is `{ weight_kg: 1255, reps: 5 }`. The expected error message includes `"över 500kg"`. The label reads `"reject: weight 1255"` which is true, but adds nothing the input field doesn't already encode. A clearer label: `"reject: weight 1255 (> 500kg cap)"`. Style only.

**Fix:** Rename label to `"reject: weight 1255 (exceeds 500kg max)"` for clarity. Optional.

### IN-02: `inspect-recent-sessions.ts` does not scope by `user_id` — admin-RLS-bypass dumps EVERY user's recent sessions

**File:** `app/scripts/inspect-recent-sessions.ts:22-34`

**Issue:** The query `from public.workout_sessions ws left join auth.users p on p.id = ws.user_id where ws.started_at > now() - interval '90 minutes'` does NOT filter by `user_id`. The script connects via the admin postgres user (bypasses RLS by default since service-role JWT or direct DB access). For personal V1 there's exactly one user, so this is fine. For dev environments with multiple test users, the script dumps all of them.

**Fix:** Accept an optional `USER_EMAIL` env var:

```typescript
const userFilter = process.env.USER_EMAIL;
const sessions = userFilter
  ? await sql`... where p.email = ${userFilter} and ws.started_at > ...`
  : await sql`... where ws.started_at > ...`;
```

Documentation tightening only.

### IN-03: `migration 0004` trigger relies on SECURITY INVOKER + RLS to scope the MAX query — explicit but the failure mode under RLS-policy regression is silent

**File:** `app/supabase/migrations/0004_exercise_sets_set_number_trigger.sql:36-56`

**Issue:** The trigger function comment correctly notes: `"SELECT MAX(set_number) inside the function only sees rows the inserting user can read."` This is correct for the current RLS policy (`Users can manage own sets` USING clause checks the parent workout_session's user_id). But if a future RLS migration accidentally weakens the SELECT policy on `exercise_sets`, the trigger would silently see rows from other users' sessions and assign a `set_number` based on the wrong MAX — leading to UNIQUE-constraint violations that look like 23505 collisions instead of an RLS bug.

For defense-in-depth, the SELECT inside the trigger could explicitly join to `workout_sessions` and filter on `user_id = (select auth.uid())`:

```sql
new.set_number := coalesce(
  (
    select max(es.set_number) + 1
    from public.exercise_sets es
    join public.workout_sessions ws on ws.id = es.session_id
    where es.session_id = new.session_id
      and es.exercise_id = new.exercise_id
      and ws.user_id = (select auth.uid())
  ),
  1
);
```

This is belt-and-suspenders — RLS already enforces the same predicate — but it makes the trigger's correctness independent of the SELECT policy on `exercise_sets`. Defer to V1.1; documented here for future hardening.

### IN-04: `setMutationDefaults` `['set','add']` mutationFn comment claims `gen:types` will eventually surface trigger DEFAULTs — verify Supabase gen:types roadmap

**File:** `app/lib/query/client.ts:719-728`

**Issue:** The comment reads:

```
// Cast: types/database.ts gen:types doesn't surface trigger DEFAULTs so
// exercise_sets.Insert still types set_number as required (number).
// ... Drop the cast once Supabase gen:types learns trigger-DEFAULT surfacing.
```

This is accurate as of 2026-05-14 (Supabase typegen does NOT inspect triggers, only column DEFAULT clauses). The cast is correctly localized and documented. The comment is a future-cleanup breadcrumb — when/if Supabase ships a typegen pass that distinguishes "trigger-filled NOT NULL columns" from "column-default NOT NULL columns", this cast becomes droppable.

No action; documentation is correct.

### IN-05: `verify-f13-brutal-test.ts` `set_count` is read from a correlated subquery aliased `set_count` — `Number(target.set_count)` cast is necessary because `count(*)` returns `bigint` and postgres-js maps `bigint` to string by default

**File:** `app/scripts/verify-f13-brutal-test.ts:45, 76`

**Issue:** The script correctly does `Number(target.set_count)` at line 76 because postgres-js types `bigint` (count's return) as `string` by default. Confirmed correct. The IN-noticing here is: the same lib could be configured via `postgres({ types: { bigint: postgres.BigInt } })` to bring this in-line, but the cast pattern is fine for a single call site.

Documentation only. No action.

---

_Reviewed: 2026-05-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
