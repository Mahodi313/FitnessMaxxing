---
phase: 06-history-read-side-polish
slug: history-read-side-polish
status: verified
audited: 2026-05-15
asvs_level: L1
threats_open: 0
threats_total: 12
threats_closed: 12
---

# Phase 6 Security Audit Report

**Phase:** 06 — History & Read-Side Polish
**ASVS Level:** L1
**Threats Closed:** 12/12
**Threats Open:** 0

---

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-06-01 | Information disclosure | mitigate | CLOSED | See below |
| T-06-02 | Information disclosure | mitigate | CLOSED | See below |
| T-06-03 | Tampering | mitigate | CLOSED | See below |
| T-06-04 | Spoofing | mitigate | CLOSED | See below |
| T-06-05 | Tampering | mitigate | CLOSED | See below |
| T-06-06 | Spoofing/Info disclosure | mitigate | CLOSED | See below |
| T-06-07 | Information disclosure | accept | CLOSED | See accepted risks log below |
| T-06-08 | Information disclosure | mitigate | CLOSED | See below |
| T-06-09 | Tampering | mitigate | CLOSED | See below |
| T-06-10 | Elevation | mitigate | CLOSED | See below |
| T-06-11 | DoS/Info disclosure | accept | CLOSED | See accepted risks log below |
| T-06-12 | Tampering | mitigate | CLOSED | See below |

---

## Detailed Threat Findings

### T-06-01 — Information disclosure: get_session_summaries RPC client

**Disposition:** mitigate
**Status:** CLOSED

**DB-tier mitigation:**
- `app/supabase/migrations/0006_phase6_chart_rpcs.sql` lines 64–65: `language sql`, `security invoker` — the caller's JWT user_id flows through the existing RLS on `workout_sessions`.
- `set search_path = ''` at line 66; all schema refs fully qualified (`public.workout_sessions`, `public.workout_plans`, `public.exercise_sets`).

**Client Zod-parse boundary:**
- `app/lib/queries/sessions.ts` lines 178–187: `SessionSummarySchema` with `z.string().uuid()` + `.nullable()` + `z.coerce.number()` on every field; lines 208–210: `.map((row: unknown) => SessionSummarySchema.parse(row))` applied to every RPC row before it reaches the UI.

**Cross-user regression gate:**
- `app/scripts/test-rls.ts` lines 865–885: `clientA.rpc("get_session_summaries", ...)` assertion verifies A's call returns zero rows containing B's `sessB.id`.

---

### T-06-02 — Information disclosure: get_exercise_chart + get_exercise_top_sets RPCs

**Disposition:** mitigate
**Status:** CLOSED

**DB-tier mitigation (both RPCs):**
- `0006_phase6_chart_rpcs.sql` lines 105–108 (`get_exercise_chart`): `security invoker stable set search_path = ''`. Body uses `inner join public.workout_sessions s on s.id = es.session_id and s.finished_at is not null` — scopes through the session ownership RLS on parent table.
- `0006_phase6_chart_rpcs.sql` lines 154–156 (`get_exercise_top_sets`): same `security invoker stable set search_path = ''` flags. Same INNER JOIN to `workout_sessions`.

**Client Zod-parse boundary:**
- `app/lib/queries/exercise-chart.ts` lines 62–66: `ChartRowSchema`; line 125: `.map((row: unknown) => ChartRowSchema.parse(row))`.
- Lines 72–77: `TopSetRowSchema` with `z.coerce.number().int()` on `reps`; line 148: `.map((row: unknown) => TopSetRowSchema.parse(row))`.

**Cross-user regression gate:**
- `app/scripts/test-rls.ts` lines 891–909: `clientA.rpc("get_exercise_chart", { p_exercise_id: exB.id, ... })` asserts `chartAsA.length === 0`.
- Lines 915–933: `clientA.rpc("get_exercise_top_sets", { p_exercise_id: exB.id, ... })` asserts `topAsA.length === 0`.

---

### T-06-03 — Tampering: workout_sessions DELETE cross-user

**Disposition:** mitigate
**Status:** CLOSED

**DB-tier RLS:**
- Phase 2 migration (0001) established `using (user_id = (select auth.uid()))` on the DELETE policy for `workout_sessions`. The `get_session_summaries` function body does not touch this policy; direct REST DELETE path is what this threat targets.

**Client mutationFn:**
- `app/lib/query/client.ts`: block 14 `['session','delete']` mutationFn calls `supabase.from("workout_sessions").delete().eq("id", vars.id)` with the anon (user-scoped) client. The server-side RLS `using` clause rejects any attempt to delete a row where `user_id != auth.uid()`.

**Cross-user regression gate:**
- `app/scripts/test-rls.ts` lines 853–863: `assertWriteBlocked("Phase 6 extension: A cannot DELETE B's workout_session ...")`.
- Lines 935–955: defense-in-depth check verifies B's session is still present via admin query after A's delete attempt.

---

### T-06-04 — Spoofing: exercise_id URL tampering (chart route)

**Disposition:** mitigate
**Status:** CLOSED

**RLS chain returns empty on spoof:**
- Both `get_exercise_chart` and `get_exercise_top_sets` use `SECURITY INVOKER` so the caller's RLS filters exercise_sets by the user's own workout_sessions. A spoofed `exercise_id` belonging to a different user returns zero rows.

**Two-state empty-state rendering:**
- `app/app/(app)/exercise/[exerciseId]/chart.tsx` lines 240–243: `showWindowEmpty` and `showAllTimeEmpty` computed from `chartData.length === 0` and `allTimeChartQuery.data?.length`.
- Lines 266–293: renders "Inga pass i detta intervall" or "Inga pass än för den här övningen" — no data disclosed.

**URL param narrowing:**
- `chart.tsx` lines 100–102: `typeof rawParams.exerciseId === "string"` guard prevents array-param injection from poisoning the queryKey or RPC call.

---

### T-06-05 — Tampering: p_cursor / p_since / p_metric / metric / since / limit parameter tampering

**Disposition:** mitigate
**Status:** CLOSED

**timestamptz type enforcement (Postgres):**
- `0006_phase6_chart_rpcs.sql` line 50: `p_cursor timestamptz`; line 99: `p_since timestamptz`. Postgres rejects non-parseable strings at the RPC boundary with a type error before the function body executes.

**Zod literal union for metric on client:**
- `app/lib/queries/exercise-chart.ts` lines 59–60: `ChartMetric = "weight" | "volume"`, `ChartWindow = "1M" | "3M" | "6M" | "1Y" | "All"`. TypeScript enforces the literal at compile-time; the hook signature accepts only these values.

**CASE WHEN with no fall-through in SQL:**
- `0006_phase6_chart_rpcs.sql` lines 112–115: `case when p_metric = 'weight' then max(...) when p_metric = 'volume' then sum(...) end as value`. Unrecognised p_metric values produce NULL rows (visible empty-state), not an error or data disclosure.

**`enabled: !!exerciseId` guard:**
- `app/lib/queries/exercise-chart.ts` lines 127, 150: hooks disabled when `exerciseId` is falsy, preventing RPC calls with empty or undefined UUID params.

---

### T-06-06 — Spoofing/Info disclosure: deep-link to /history/<wrongId>

**Disposition:** mitigate
**Status:** CLOSED

**RLS returns empty on wrong ID:**
- `useSessionQuery` in `app/lib/queries/sessions.ts` lines 82–102 calls `.eq("id", id).single()` using the anon (user-scoped) Supabase client. RLS on `workout_sessions` prevents returning a row belonging to another user — the query returns an error.

**Error rendering with no data disclosure:**
- `app/app/(app)/history/[sessionId].tsx` lines 190–201: `if (sessionQuery.error)` renders `SafeAreaView` with `"Något gick fel. Försök igen."` — generic copy, no session data or user data exposed.

**sessionId param narrowing:**
- Lines 104–106: `typeof rawParams.sessionId === "string"` guard prevents array-param injection.

---

### T-06-08 — Information disclosure: stale cache after user-switch

**Disposition:** mitigate
**Status:** CLOSED

**queryClient.clear() on sign-out:**
- `app/lib/auth-store.ts` line 70: `queryClient.clear()` called in the explicit `signOut()` action.
- Line 99: `queryClient.clear()` called in the `onAuthStateChange` listener when session becomes null (covers server-side revocation and session expiry).
- Additionally, `asyncStoragePersister.removeClient()` is called alongside `queryClient.clear()` (lines 71, 100) to purge the AsyncStorage persisted snapshot — preventing the next user's cold-start from hydrating the prior session's listInfinite/detail/chart cache.

This `queryClient.clear()` wipes ALL cache keys including `sessionsKeys.listInfinite()`, `exerciseChartKeys`, and `exerciseTopSetsKeys` — all Phase 6 cache slots are covered.

---

### T-06-09 — Tampering: RPC SQL-injection via parameter

**Disposition:** mitigate
**Status:** CLOSED

**Parameterized supabase-js `.rpc()` API:**
- All three RPC invocations (`get_session_summaries`, `get_exercise_chart`, `get_exercise_top_sets`) use `supabase.rpc(name, params)` with an object argument — PostgREST serializes parameters as typed positional arguments, never concatenated into SQL.

**`language sql` positional parameters:**
- `0006_phase6_chart_rpcs.sql`: all three functions use `language sql` with parameters referenced as named bindings in the WHERE clause (e.g., `(p_cursor is null or s.started_at < p_cursor)`) — no string concatenation, no dynamic SQL.

**`set search_path = ''` on all three functions:**
- Lines 66, 108, 156 of `0006_phase6_chart_rpcs.sql`. Defends against search-path injection attacks where a malicious schema object shadows `public` functions.

---

### T-06-10 — Elevation: service-role key leaks into Phase 6 surface

**Disposition:** mitigate
**Status:** CLOSED

**Audit-grep gate result:**
- `git grep "service_role\|SERVICE_ROLE" -- "app/lib/" "app/app/" "app/components/" "app/supabase/migrations/"` returns **zero matches** (exit code 1 = no matches). No service-role reference exists in any Metro-bundled path.

**SECURITY INVOKER on all three RPCs:**
- `0006_phase6_chart_rpcs.sql` lines 64, 106, 154: each function explicitly declares `security invoker` (not `security definer`). No function runs with elevated privileges regardless of how it is called.

**`app/lib/supabase.ts`:**
- Lines 17–18: only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are consumed. No service-role key present.

**Service-role usage scoped to Node-only scripts:**
- `SUPABASE_SERVICE_ROLE_KEY` is referenced in `app/scripts/test-rls.ts` and `app/scripts/verify-deploy.ts` only — both are Node-only tsx scripts never bundled by Metro.

---

### T-06-12 — Tampering: anon-client direct DELETE on workout_sessions

**Disposition:** mitigate
**Status:** CLOSED

**Identical mitigation to T-06-03** — the anon client's `supabase.from("workout_sessions").delete()` is blocked by the Phase 2 RLS `using (user_id = (select auth.uid()))` policy. An anon request with no JWT (or a JWT for a different user) cannot delete any session row.

**Cross-user regression gate:**
- `app/scripts/test-rls.ts` lines 853–863: `assertWriteBlocked` covers this path (same assertion closes both T-06-03 and T-06-12).

---

## Accepted Risks Log

### T-06-07 — Information disclosure: persisted listInfinite/detail/chart caches in AsyncStorage

**Disposition:** accept
**Rationale:**
- The TanStack Query persister (Phase 4) serializes query cache to AsyncStorage. Phase 6 adds three new cache slots: `sessionsKeys.listInfinite()`, `exerciseChartKeys.byExercise(...)`, and `exerciseTopSetsKeys.byExercise(...)`.
- These caches contain: workout session UUIDs, set counts, volume aggregates (numeric), plan names (user-controlled text), chart data (numeric per-day aggregates), and top-set rows (session UUID + weight + reps).
- None of these constitute PII in the GDPR/CCPA sense. The data is fitness performance data the user themselves logged, stored on their own device.
- The auth blob (JWT + refresh token) is protected separately by `LargeSecureStore` (AES-256 encrypted in AsyncStorage with key in SecureStore) — it is NOT part of the persisted query cache.
- The mutation queue (paused delete operations) stores only the session UUID being deleted — no content.
- **V1 scope:** This app is a personal fitness tracker for a single user on their own device (no shared-device threat model in V1). The risk of another person accessing the device and reading AsyncStorage is accepted for V1; MASVS L2 data-at-rest encryption of the query cache is deferred to the App Store / TestFlight phase.
- **Residual risk:** Low. Accepted.

### T-06-11 — DoS/Info disclosure: PostgREST project-wide aggregate enable

**Disposition:** accept
**Rationale:**
- Phase 6 deliberately uses scoped RPC functions (`get_session_summaries`, `get_exercise_chart`, `get_exercise_top_sets`) rather than enabling the PostgREST `pgrst.db_aggregates_enabled` setting.
- Enabling project-wide aggregates would allow any authenticated client to run arbitrary aggregate queries over any accessible table, creating a broad data exposure surface and potential for expensive server-side aggregation (DoS).
- The RPC approach scopes each aggregate to its specific semantic (per-user, working-set-filtered, paginated/limited), providing both security and performance control.
- This disposition is documented in 06-RESEARCH.md §Alternatives Considered.
- **Residual risk:** None — the vector was deliberately rejected, not accepted-with-risk.

---

## Unregistered Threat Flags

The SUMMARY.md files for Plans 06-01a, 06-01b, 06-02, and 06-03 do not contain a `## Threat Flags` section with unregistered surface. The REVIEW.md findings (WR-01 through WR-07) are functional correctness and UX issues, not new security threats. They are recorded here for completeness:

- **WR-01** (toast dead-zone): UX issue — router.replace fires synchronously before toast mounts. Fixed by moving toast to the list screen via `?toast=deleted` query param. Not a security issue.
- **WR-03** (Reanimated worklet calling non-worklet JS): Fixed by pre-computing tooltip text arrays on the JS thread and mirroring via SharedValues. Not a security issue.
- **WR-05** (exercise card ordering): UX/functional issue (UUID-alphabetic order vs plan order). Not a security issue.

No unregistered security flags.

---

## Service-Role Isolation Gate

`git grep "service_role|SERVICE_ROLE" -- app/lib/ app/app/ app/components/ app/supabase/migrations/` → **0 matches**

Allowed paths verified clean:
- `app/scripts/test-rls.ts` — Node-only, not Metro-bundled
- `app/scripts/verify-deploy.ts` — Node-only, not Metro-bundled
- `app/.env.example` — template only
- `.planning/` — documentation only
- `CLAUDE.md` — documentation only

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-15 | 12 | 12 | 0 | gsd-security-auditor (sonnet) — `register_authored_at_plan_time: true`; verify-mitigations-exist mode |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-15

---

*Phase: 06-history-read-side-polish*
*Audited: 2026-05-15*
*Auditor: gsd-security-auditor*
