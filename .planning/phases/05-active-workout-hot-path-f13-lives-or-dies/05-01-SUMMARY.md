---
phase: 05-active-workout-hot-path-f13-lives-or-dies
plan: 01
subsystem: offline-first plumbing (schemas + setMutationDefaults + persister durability)
tags: [phase-5, plan-01, schemas, plumbing, offline-first, persister, mutationDefaults, wave0, F13, zod4, tanstack-query, setMutationDefaults, scope.id]

# Dependency graph
requires:
  - phase: 04-plans-exercises-offline-queue-plumbing
    provides: |
      app/lib/query/{client,persister,network,keys}.ts 4-file split;
      8 existing setMutationDefaults blocks; randomUUID() utility;
      networkMode: 'offlineFirst' + retry: 1 default; onlineManager.subscribe
      → resumePausedMutations close (Pitfall 8.12); mutate-not-mutateAsync
      convention; Zod parse-not-cast boundary pattern.
  - phase: 02-schema-rls-type-generation
    provides: |
      workout_sessions + exercise_sets schema + RLS policies "Users can manage
      own sessions" + "Users can manage own sets" (with check via parent-FK);
      app/types/database.ts generated types for both tables;
      app/scripts/test-rls.ts cross-user harness (clientA/clientB/admin pattern).
  - phase: 01-bootstrap-infra-hardening
    provides: |
      Typed createClient<Database> in app/lib/supabase.ts; module-load-order
      contract in app/app/_layout.tsx (client.ts → persister.ts → network.ts).

provides:
  - 2 NEW Zod schemas (sessions.ts + sets.ts) — strict D-15 validation
    (weight_kg .min(0).max(500).multipleOf(0.25), reps .int().min(1).max(60),
    set_type enum default 'working') for Plan 02's RHF set-row form gate.
  - 3 NEW query-key factories (sessionsKeys, setsKeys, lastValueKeys)
    appended to app/lib/query/keys.ts.
  - 5 NEW setMutationDefaults blocks (['session','start'], ['session','finish'],
    ['set','add'], ['set','update'], ['set','remove']) appended to
    app/lib/query/client.ts. Total mutationKeys registered: 13 (8 Phase 4 +
    5 Phase 5). All register at module top-level (Pitfall 1 — module-load-
    order invariant inherited from Phase 4 D-01).
  - Hot-path durability gates (closes Phase 4 D-02 deferral):
      • persister throttleTime: 500 (PITFALLS §1.3 — halves the in-memory
        mutation window vs default 1000ms).
      • AppState 'background'/'inactive' listener calls
        persistQueryClientSave({ queryClient, persister: asyncStoragePersister })
        so the most-recent set survives a force-quit within the throttleTime
        window (two-belt mitigation per CONTEXT.md D-25).
  - Wave 0 verification harness (5 scripts, all green):
      • test:session-schemas (4 cases)
      • test:set-schemas (10 cases)
      • test:offline-queue EXTENDED (7 assertions: 4 Phase 4 + 3 Phase 5
        — 25× ['set','add'] paused-mutation persist/restart)
      • test:sync-ordering EXTENDED (10 assertions: 5 Phase 4 + 5 Phase 5
        — start + 25 sets + finish FIFO replay under shared scope.id, no
        FK violations)
      • test:last-value-query (9 assertions across 5 cases: F7 set-position-
        aligned correctness + cross-user RLS gate — Assumption A3 CLOSED).
  - RESEARCH Open Q#2 (RESOLVED) wired: ['session','finish'].onSettled
    invalidates lastValueKeys.all so back-to-back sessions surface the
    just-finished session's working sets in F7 chips immediately, without
    waiting for the 15-min staleTime to expire.
  - scope.id contract docblock extended with the 5 new keys; each Plan 02
    hook bakes `scope: { id: 'session:<sessionId>' }` at useMutation()
    construction time per Pitfall 3 (static-string scope, not function).

affects:
  - 05-02 (Resource hooks + workout/[sessionId].tsx screen) — imports the
    5 new mutationKeys, 3 key factories, and 2 Zod schemas; uses the F7
    query exactly as proven by test-last-value-query.ts.
  - 05-03 (UI polish + plan-detail "Starta pass" CTA + draft-resume +
    banner) — relies on the durability gates and dual-write onMutate
    contract in ['session','start'].
  - All future phases — inherit the durability invariants (throttle: 500
    + AppState flush) for any new persisted mutation.

# Tech tracking
tech-stack:
  added: []   # No new libraries — all 5 setMutationDefaults reuse existing
              # @tanstack/react-query + @supabase/supabase-js + zod
  patterns:
    - "Phase 5 setMutationDefaults pattern: idempotent .upsert({ onConflict: 'id', ignoreDuplicates: true }) for CREATE/INSERT; .update({...}).eq('id', vars.id) for UPDATE; .delete().eq('id', vars.id) for DELETE. Optimistic onMutate → cancelQueries → snapshot → setQueryData → return { previous }; onError rollback; onSettled invalidate. retry: 1 across the board."
    - "Phase 5 scope.id binding pattern: hooks take sessionId param at construction; useMutation bakes `scope: { id: 'session:<sessionId>' }` STATICALLY (Pitfall 3 — function-shaped scope.id silently fails serial replay). 5 mutationKeys share the same session scope so START → 25 SETs → FINISH replay FIFO."
    - "Phase 5 durability two-belt: throttleTime: 500 (in-memory mutation window) + AppState 'background'/'inactive' synchronous persistQueryClientSave flush (OS-suspend gap). PITFALLS §1.3."
    - "Wave 0 dual-mode integration test: Node-only tsx with --env-file=.env.local; admin (service-role) seeds rows + cleans up; clientA/clientB (anon-key) sign in and run query-under-test. Mirrors test-rls.ts harness; reused for test-last-value-query.ts cross-user A3 closure."

key-files:
  created:
    - "app/lib/schemas/sessions.ts (75 LOC) — sessionFormSchema (notes ≤500 chars, F12-ready) + sessionRowSchema (Supabase response boundary, Pitfall 8.13 parse-not-cast). Both camelCase + PascalCase exports per plans.ts convention."
    - "app/lib/schemas/sets.ts (95 LOC) — setFormSchema with STRICT D-15: weight_kg .min(0).max(500).multipleOf(0.25) (PITFALLS §1.5 load-bearing), reps .int().min(1).max(60), set_type enum default 'working'. setRowSchema mirrors Tables<'exercise_sets'>. Type split exports SetFormInput (z.input) + SetFormOutput (z.output) per Phase 4 D-11."
    - "app/scripts/test-session-schemas.ts (94 LOC) — 4 Wave 0 cases."
    - "app/scripts/test-set-schemas.ts (123 LOC) — 10 Wave 0 cases incl. all D-15 strict rejections."
    - "app/scripts/test-last-value-query.ts (414 LOC) — 5 assertion blocks covering F7 correctness + Assumption A3 cross-user gate closure."
  modified:
    - "app/lib/query/keys.ts — appended sessionsKeys, setsKeys, lastValueKeys factories (~40 LOC added)."
    - "app/lib/query/client.ts — appended Phase 5 imports + 5 type aliases + 5 setMutationDefaults blocks (~430 LOC added; total file ~960 LOC). scope.id contract docblock extended."
    - "app/lib/query/persister.ts — added throttleTime: 500 option + named export asyncStoragePersister."
    - "app/lib/query/network.ts — added AppState 'background'/'inactive' listener calling persistQueryClientSave({ queryClient, persister: asyncStoragePersister })."
    - "app/scripts/test-offline-queue.ts — appended Phase 5 extension: 25× ['set','add'] paused-mutation persist/restart scenario (~120 LOC added)."
    - "app/scripts/test-sync-ordering.ts — appended Phase 5 extension: ['session','start'] + 25× ['set','add'] + ['session','finish'] FIFO replay scenario against real Supabase admin (~230 LOC added)."
    - "app/package.json — added 3 test:* npm scripts (test:session-schemas, test:set-schemas, test:last-value-query)."

key-decisions:
  - "D-25 implementation deviation: persister API uses persistQueryClientSave({ queryClient, persister }) (high-level helper from @tanstack/react-query-persist-client) instead of asyncStoragePersister.persistClient(queryClient) (which the PLAN specified). Reason: the low-level Persister.persistClient takes PersistedClient (not QueryClient) per query-persist-client-core type declarations — persistQueryClientSave is the correct wrapper that does dehydrate() + persistClient() in one call. Functionally equivalent (Assumption A2 PASS)."
  - "RESEARCH Open Q#2 (RESOLVED) wired into ['session','finish'].onSettled: in addition to invalidating sessionsKeys.active() + sessionsKeys.detail(id), also invalidates lastValueKeys.all so back-to-back sessions surface this session's working sets in F7 chips without waiting for the 15-min staleTime to expire."
  - "['set','update'] + ['set','remove'] enforce a session_id-required guard inside their mutationFn (matching Phase 4 ['plan-exercise','update']/['plan-exercise','remove'] pattern at lines 396/444). This forces Plan 02 hooks to pass session_id in the mutate payload — same payload field already drives scope.id at the call site."
  - "['session','start'] dual-write optimistic onMutate (sessionsKeys.active() + sessionsKeys.detail(vars.id)) mirrors the Phase 4 ['plan','create'] commits eca0540 + b87bddf lesson — seeds both the persistent banner cache AND the new-route detail cache so /workout/<newId> renders instantly without a 'Laddar…' flash."

patterns-established:
  - "Pattern: Phase 5 scope.id static-string contract — 5 new mutationKeys each carry `scope: { id: 'session:<sessionId>' }` bound at useMutation() time in lib/queries/*.ts; setMutationDefaults bodies do NOT declare scope (Pitfall 3 — function-shaped scope.id silently fails serial replay)."
  - "Pattern: D-15 multipleOf(0.25) load-bearing guard — weight_kg is numeric(6,2) so client values like 82.501 truncate server-side to 82.50; the Zod multipleOf(0.25) catches this BEFORE the mutation fires. Test:set-schemas has a dedicated rejection case ('reject: weight not multipleOf(0.25)') that is the regression gate."
  - "Pattern: AppState background-flush — every Phase 5+ persisted mutation type benefits from this. The handler fires synchronously on OS-signaled foreground exit (state === 'background' || 'inactive'), independent of the persister's throttle. Future plans should NOT add their own AppState listeners for persistence — this one covers all setMutationDefaults blocks."

requirements-completed: [F5, F6, F7, F8, F13]

# Metrics
duration: ~75 min
completed: 2026-05-13
---

# Phase 5 Plan 01: Schemas + Plumbing Wave 0 Summary

**Phase 5 hot-path contract layer (Zod schemas + 5 new setMutationDefaults + persister throttleTime: 500 + AppState background-flush + Wave 0 integration tests) is wired and proven; Plan 02 can ship the user-facing workout screen on top.**

## Performance

- **Duration:** ~75 min (sequential — Tasks 1/2/3 each took ~20–30 min including verification)
- **Started:** 2026-05-13T16:40Z
- **Completed:** 2026-05-13T17:55Z
- **Tasks:** 3/3
- **Files modified:** 11 (5 NEW + 6 MODIFIED)

## Accomplishments
- Strict D-15 Zod schemas for sets ship with all 10 PITFALLS §1.5 cases (`multipleOf(0.25)`, `int()`, `.max(500)`, etc.) proven via test:set-schemas.
- All 5 new mutationKeys register at module top-level in `client.ts` BEFORE persister hydrates — verified via test:offline-queue Phase 5 extension (25× `['set','add']` re-hydrate with intact mutationKey + scope.id).
- F13 durability two-belt (throttle: 500 + AppState background-flush) wired and type-verified — closes Phase 4 D-02 deferral with the correct `persistQueryClientSave` API (deviation from PLAN's literal call documented).
- Assumption A3 (PostgREST `!inner` + RLS cross-user gate) CLOSED — test:last-value-query Assertion 4 proves User B sees an empty Map for User A's exercise history.
- FIFO replay across 27 mutations under shared scope.id verified against real Supabase admin client (test:sync-ordering Phase 5 extension): START (order=1) → 25 SETs (orders=2..26) → FINISH (order=27), zero 23503 FK violations, 25 contiguous set_numbers in DB, finished_at landed after all sets.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author sessions + sets Zod schemas and append 3 query-key factories** — `9dabb83` (feat)
2. **Task 2: Append 5 new setMutationDefaults blocks + persister throttle + AppState background-flush** — `1d584ac` (feat)
3. **Task 3: Ship Wave 0 last-value query test + npm script wiring** — `637d58e` (feat)

## Files Created/Modified

### Created (5)
- `app/lib/schemas/sessions.ts` — `sessionFormSchema` (notes ≤500 chars, F12 schema-ready) + `sessionRowSchema` (Supabase response boundary).
- `app/lib/schemas/sets.ts` — `setFormSchema` (STRICT D-15: weight_kg `.min(0).max(500).multipleOf(0.25)`, reps `.int().min(1).max(60)`, set_type enum default 'working') + `setRowSchema`. Exports both `z.input` and `z.output` types for RHF v7 3-generic shape.
- `app/scripts/test-session-schemas.ts` — 4 Wave 0 cases.
- `app/scripts/test-set-schemas.ts` — 10 Wave 0 cases incl. all D-15 strict rejections.
- `app/scripts/test-last-value-query.ts` — Cross-user integration test, 9 PASS lines across 5 assertion blocks; closes Assumption A3.

### Modified (6)
- `app/lib/query/keys.ts` — appended `sessionsKeys` (`all`, `list`, `detail`, `active`), `setsKeys` (`all`, `list(sessionId)`), `lastValueKeys` (`all`, `byExercise(exerciseId)`) factories.
- `app/lib/query/client.ts` — appended Phase 5 imports (SessionRowSchema, SetRowSchema, sessionsKeys, setsKeys, lastValueKeys) + 5 type aliases + 5 setMutationDefaults blocks. Total mutationKeys: 13 (8 Phase 4 + 5 Phase 5). Extended scope.id contract docblock.
- `app/lib/query/persister.ts` — `createAsyncStoragePersister({ throttleTime: 500 })` + named export of `asyncStoragePersister` instance.
- `app/lib/query/network.ts` — added AppState listener that calls `persistQueryClientSave({ queryClient, persister: asyncStoragePersister })` on `'background'`/`'inactive'`.
- `app/scripts/test-offline-queue.ts` — Phase 5 extension: 25× `['set','add']` paused-mutation persist/restart (3 new PASS assertions).
- `app/scripts/test-sync-ordering.ts` — Phase 5 extension: `['session','start']` + 25× `['set','add']` + `['session','finish']` FIFO replay against admin Supabase client (5 new PASS assertions).
- `app/package.json` — added 3 `test:*` npm scripts.

## All 13 mutationKeys Registered in `client.ts`

After Plan 01, `client.ts` registers all 13 mutationKeys at module top-level:

**Phase 4 (8 — inherited unchanged):**
1. `['plan','create']`
2. `['plan','update']`
3. `['plan','archive']`
4. `['exercise','create']`
5. `['plan-exercise','add']`
6. `['plan-exercise','update']`
7. `['plan-exercise','remove']`
8. `['plan-exercise','reorder']` (no-op default)

**Phase 5 (5 — added by Plan 01):**
9. `['session','start']` — idempotent upsert + dual-write `sessionsKeys.active()` + `sessionsKeys.detail(id)`.
10. `['session','finish']` — UPDATE `finished_at .eq(id)`; `onSettled` invalidates `lastValueKeys.all` (Open Q#2 closure).
11. `['set','add']` — idempotent upsert + optimistic append to `setsKeys.list(session_id)`.
12. `['set','update']` — UPDATE `.eq(id)` + optimistic map-replace. `session_id` required at call-site.
13. `['set','remove']` — DELETE `.eq(id)` + optimistic filter-out. `session_id` required at call-site.

## Decisions Made

- **D-25 implementation deviation (Assumption A2 path):** `network.ts` uses `persistQueryClientSave({ queryClient, persister: asyncStoragePersister })` (high-level helper from `@tanstack/react-query-persist-client`) instead of the PLAN's literal `asyncStoragePersister.persistClient(queryClient)`. The low-level `Persister.persistClient` takes a `PersistedClient` (not a `QueryClient`) per `query-persist-client-core/_tsup-dts-rollup.d.ts` line 86–90 — `persistQueryClientSave` is the correct wrapper that does `dehydrate(queryClient)` + `persister.persistClient(persistedClient)` in one call. Functionally equivalent. **Documented in the commit message for Task 2 and verified by passing all type checks.**
- **Open Q#2 wiring:** `['session','finish'].onSettled` invalidates `lastValueKeys.all` so back-to-back sessions' F7 chips reflect this session's working sets within milliseconds, without waiting for the 15-min staleTime to expire.
- **Re-shipped TS literal-type fix in test-sync-ordering.ts Phase 5 extension:** the test's inline `set_type: "working"` was widened to `string` by TS, breaking the supabase-js generated insert type narrowing to the enum. Fixed by adding `as const` and typing the cast destination as the enum union. Pre-existing pattern from earlier tests using string literals — flagged as Rule 1 bug, fixed inline.

## Assumption Verifications

### Assumption A1 (createAsyncStoragePersister option name) — PASS

Verified via `node_modules/@tanstack/query-async-storage-persister/build/legacy/_tsup-dts-rollup.d.ts` line 22:
```
declare interface CreateAsyncStoragePersisterOptions {
  storage: AsyncStorage<string> | undefined | null;
  key?: string;
  throttleTime?: number;
  ...
}
```
The option name is `throttleTime` (not `throttleMs`); no rename needed.

### Assumption A2 (persister.persistClient API surface) — PASS (with deviation)

Verified via `node_modules/@tanstack/query-persist-client-core/build/legacy/_tsup-dts-rollup.d.ts` line 86–90:
```
declare interface Persister {
  persistClient: (persistClient: PersistedClient) => Promisable<void>;
  restoreClient: () => Promisable<PersistedClient | undefined>;
  removeClient: () => Promisable<void>;
}
```
The `persistClient` method takes a `PersistedClient`, NOT a `QueryClient`. The correct wrapper that takes `{ queryClient, persister }` and does dehydrate+persist is `persistQueryClientSave` (line 138 in the same `.d.ts`). Used in `network.ts`. **Deviation from PLAN's literal `asyncStoragePersister.persistClient(queryClient)` snippet documented in Task 2 commit message.**

### Assumption A3 (PostgREST `!inner` + RLS cross-user gate) — CLOSED

`test:last-value-query` Assertion 4: User B (signed in via anon-key) calls the same two-step query as User A (signed in via anon-key) for `exerciseAId` (which User A owns). User B's result Map is **size 0** — RLS via `workout_sessions!inner.user_id` correctly scopes the join so User B's filtered view of `workout_sessions` excludes User A's sessions. Plan 02 can ship `useLastValueQuery` without additional cross-user gating.

## Wave 0 Script Outputs (verification gate per VALIDATION.md)

| Script | Cases | Result |
|---|---|---|
| `test:session-schemas` | 4 | ALL PASS |
| `test:set-schemas` | 10 | ALL PASS (all D-15 strict rejections cover) |
| `test:offline-queue` (extended) | 7 (4 Phase 4 + 3 Phase 5) | ALL PASS |
| `test:sync-ordering` (extended) | 10 (5 Phase 4 + 5 Phase 5) | ALL PASS |
| `test:last-value-query` | 9 PASS lines across 5 logical assertions | ALL PASS |

Plan-level gate: `npx tsc --noEmit` clean; `git grep service_role|SERVICE_ROLE` outside `app/scripts/*` returns zero matches.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TS literal-type widening on `set_type: "working"` in test-sync-ordering.ts Phase 5 extension**
- **Found during:** Task 2 (post-extension run of `npx tsc --noEmit`)
- **Issue:** The generated `Database` types in `app/types/database.ts` declare `set_type` as the enum union `'working' | 'warmup' | 'dropset' | 'failure'`. The Phase 5 extension scenario in `test-sync-ordering.ts` builds a payload object inline with `set_type: "working"`, which TS widens to `string` — supabase-js's `.upsert()` generic then rejects it as a `RejectExcessProperties` mismatch.
- **Fix:** Cast the inline literal as `"working" as const`, and narrow the `vars` cast destination's `set_type` field to the full enum union (`"working" | "warmup" | "dropset" | "failure"`). Two changes in the same file.
- **Files modified:** `app/scripts/test-sync-ordering.ts`
- **Verification:** `npx tsc --noEmit` clean; `npm run test:sync-ordering` exits 0.
- **Committed in:** `1d584ac` (part of Task 2 commit).

### Documented (Non-Issue) Deviations

**2. [PATTERN clarification] persister.persistClient(queryClient) → persistQueryClientSave({ queryClient, persister })**
- **Reason:** PLAN's literal snippet was based on RESEARCH §Assumption A2 which the PLAN itself flagged for verification. Verification (Task 2 step A) confirmed the API shape requires the high-level wrapper. No functional change.
- **Files:** `app/lib/query/network.ts`
- **Committed in:** `1d584ac`.

## Deferred Issues

None. All blocking issues for Plan 02 are resolved.

## Threat Flags

No new security surface introduced beyond the threat model. T-05-05, T-05-06, T-05-08, T-05-11, T-05-12, T-05-13, T-05-14 all have mitigations in place per the threat model section of 05-01-PLAN.md:
- T-05-05/06 mitigated by Zod schemas (test:set-schemas proves rejections).
- T-05-08/11 mitigated by scope.id static-string contract + FIFO replay (test:sync-ordering Phase 5 extension proves START → 25 SETs → FINISH order with zero FK violations).
- T-05-12 mitigated by `.upsert(..., { onConflict: 'id', ignoreDuplicates: true })` everywhere CREATE/INSERT happens — test:upsert-idempotency (Phase 4) already covered the contract; the same Postgres ON CONFLICT semantics apply to `exercise_sets.id` PK.
- T-05-13 mitigated by throttleTime: 500 + AppState background-flush two-belt.
- T-05-14 mitigated by `networkMode: 'offlineFirst'` + `retry: 1` inherited from Phase 4.

## Self-Check: PASSED

**Verifying claimed files exist:**
- `app/lib/schemas/sessions.ts`: FOUND
- `app/lib/schemas/sets.ts`: FOUND
- `app/scripts/test-session-schemas.ts`: FOUND
- `app/scripts/test-set-schemas.ts`: FOUND
- `app/scripts/test-last-value-query.ts`: FOUND
- `app/lib/query/keys.ts`: modified (added 3 factories)
- `app/lib/query/client.ts`: modified (added 5 setMutationDefaults blocks + scope.id docblock extension)
- `app/lib/query/persister.ts`: modified (throttleTime: 500 + named export)
- `app/lib/query/network.ts`: modified (AppState background-flush listener)
- `app/scripts/test-offline-queue.ts`: modified (Phase 5 extension)
- `app/scripts/test-sync-ordering.ts`: modified (Phase 5 extension)
- `app/package.json`: modified (3 new test:* scripts)

**Verifying claimed commits exist (`git log --oneline | grep <hash>`):**
- `9dabb83`: FOUND — Task 1 (feat: sessions+sets schemas + 3 key factories)
- `1d584ac`: FOUND — Task 2 (feat: 5 setMutationDefaults + persister throttle + AppState flush)
- `637d58e`: FOUND — Task 3 (feat: F7 last-value query test + A3 closure)
