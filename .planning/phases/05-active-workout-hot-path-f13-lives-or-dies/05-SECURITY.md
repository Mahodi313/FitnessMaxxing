---
phase: 5
slug: active-workout-hot-path-f13-lives-or-dies
asvs_level: 1
audited_at: 2026-05-14
auditor: gsd-security-auditor
threats_total: 26
threats_closed: 26
threats_open: 0
unregistered_flags: 0
post_plan_findings_audited: 1
block_on: high
status: secured
---

# Phase 5 — Security Audit (Threat Register)

> Verifies that every threat declared in the seven Phase 5 PLAN.md `<threat_model>` blocks (T-05-01..16 + T-05-04-01..05 + T-05-05-01/02 + T-05-06-01/02 + T-05-07-01/02) has its mitigation present in implemented code, OR a valid acceptance disposition documented in the accepted-risks log below. Implementation files are read-only inputs to this audit.

## Summary

| Disposition | Total | Closed | Open |
|-------------|-------|--------|------|
| `mitigate`  | 18    | 18     | 0    |
| `accept`    | 8     | 8      | 0    |
| `transfer`  | 0     | 0      | 0    |
| **All**     | **26**| **26** | **0**|

**ASVS L1 baseline:** OWASP API Top 10 + Mobile Top 10 controls (API1/V4 RLS, API2/V2/M3 sessions, API3 cross-user reads, API4 rate-limiting deferred, API8 misconfiguration, M2 storage, M7 client code) verified per CLAUDE.md "Security conventions" §Established controls. Additional V5 (input validation) and V11 (anti-flood / DoS) gates exercised against the F13 hot path.

**`block_on: high` evaluation:** zero OPEN threats; phase is unblocked for advancement.

**Post-plan findings audited:** 1 (CR-01 from 05-REVIEW.md — TOCTOU between Migrations 0002 + 0003). See §Post-Plan Findings below — disposition: **mitigate (fixed via Migration 0005)**, not accepted.

---

## Threat Verification — `mitigate` (18)

| Threat ID  | Category | Component | Evidence (file:line / pattern) |
|------------|----------|-----------|--------------------------------|
| T-05-01    | Tampering, Elevation of Privilege | `exercise_sets` cross-user INSERT via parent-FK forge | RLS policy `Users can manage own sets` declared in `app/supabase/migrations/0001_initial_schema.sql:141-144` with `using` AND `with check` both gated by `exists (select 1 from public.workout_sessions where id = session_id and user_id = (select auth.uid()))`. Cross-user regression: `app/scripts/test-rls.ts:680-709` ("Phase 5 extension: A cannot INSERT exercise_set into B's session"); `app/scripts/test-rls.ts:701-712` ("A cannot UPDATE weight_kg on B's exercise_set"). 39 PASS / 0 FAIL per 05-VERIFICATION.md line 145. |
| T-05-02    | Tampering, Elevation of Privilege | `workout_sessions` cross-user INSERT with B's user_id | RLS policy `Users can manage own sessions` in `app/supabase/migrations/0001_initial_schema.sql:137-138` declares `for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))`. Client never accepts user_id from form input — `useStartSession` is called from `app/app/(app)/plans/[id].tsx` with `user_id` read from `useAuthStore`. Cross-user regression: `app/scripts/test-rls.ts:650-660` ("Phase 5 extension: A cannot INSERT workout_session with B's user_id"). |
| T-05-03    | Information Disclosure | `exercise_sets` cross-user SELECT | `useSetsForSessionQuery` in `app/lib/queries/sets.ts:61-76` does NOT accept user_id parameter — server RLS scopes via the parent FK. Cross-user regression: `app/scripts/test-rls.ts:407-411` ("A cannot SELECT B's exercise_set"). 39 PASS. |
| T-05-04    | Information Disclosure | `useLastValueQuery` `!inner` join cross-user | Two-gate defense in `app/lib/queries/last-value.ts:69-81`: (a) `workout_sessions!inner(id, user_id, finished_at, started_at)` — RLS-scoped via the inner-join contract; (b) belt-and-braces `.eq("workout_sessions.user_id", userId)` at line 78. Plan 01 closed Assumption A3 via `app/scripts/test-last-value-query.ts` Assertion 4 ("User B sees empty Map for User A's history" — 9/9 PASS post FIT-13 per 05-VERIFICATION.md). |
| T-05-05    | Tampering (V5 input validation) | `setFormSchema.weight_kg` | `app/lib/schemas/sets.ts:44-53` declares `.min(0).max(500).multipleOf(0.25)` inside the `z.preprocess` wrapper. Rejection cases proven in `app/scripts/test-set-schemas.ts:43-58` (weight 1255 rejected with "över 500kg"; weight not multipleOf(0.25) rejected with "0.25kg"; negative weight rejected with "0 eller högre"). 13/13 PASS per 05-VERIFICATION.md line 142. |
| T-05-06    | Tampering (V5 input validation) | `setFormSchema.reps` | `app/lib/schemas/sets.ts:54-58` declares `.int().min(1).max(60)`. Rejection cases proven in `app/scripts/test-set-schemas.ts:61-76` (reps 0 rejected with "Minst 1 rep"; reps 5.5 rejected; reps 61 rejected with "Över 60 reps"). |
| T-05-07    | Information Disclosure | `useLastValueQuery` narrow select | `app/lib/queries/last-value.ts:92` `.select("set_number, weight_kg, reps, completed_at")` — exactly the four columns needed for the F7 chip; excludes `notes` (F12 future) and `rpe` (F11 future). |
| T-05-08    | DoS (self-inflicted, FIFO replay) | `setMutationDefaults` scope.id contract | scope.id docblock in `app/lib/query/client.ts:208-212` declares `['session','start']` / `['session','finish']` / `['set','add']` / `['set','update']` / `['set','remove']` all bind `scope.id = 'session:<sessionId>'` at call site. Call-site bindings: `app/lib/queries/sessions.ts:119, 129` and `app/lib/queries/sets.ts:85, 92, 99`. FIFO replay regression: `app/scripts/test-sync-ordering.ts:506-550` (Phase 5 ext B — `start (order=1) → 25 sets (orders=2..26) → finish (order=27)`). 10/10 PASS per 05-VERIFICATION.md line 144. |
| T-05-11    | Tampering (FK ordering on replay) | START → SETs → FINISH replay order | Shared session scope (same evidence as T-05-08). Regression: `app/scripts/test-sync-ordering.ts:512-516` ("Phase 5 ext B: no 23503 FK violations during replay"). |
| T-05-12    | Data integrity (idempotency) | Upsert idempotency on replay | Every CREATE mutationFn uses `.upsert(vars, { onConflict: 'id', ignoreDuplicates: true })`: `app/lib/query/client.ts:587` (`['session','start']`) and `app/lib/query/client.ts:733` (`['set','add']`). Inherited Phase 4 `test:upsert-idempotency` (6 PASS) plus Migration 0003 UNIQUE constraint on `(session_id, exercise_id, set_number)` — duplicate replay is a no-op. |
| T-05-13    | Data integrity (F13 force-quit) | Two-belt persister durability | **Belt 1:** `app/lib/query/persister.ts:57-60` `createAsyncStoragePersister({ storage: AsyncStorage, throttleTime: 500 })` — half the default 1000ms in-memory mutation window. **Belt 2:** `app/lib/query/network.ts:96-112` AppState `background`/`inactive` listener calls `persistQueryClientSave({ queryClient, persister: asyncStoragePersister })` synchronously on OS-suspend signal, guarded by globalThis sentinel `APPSTATE_BGFLUSH_KEY` for Fast-Refresh safety. **Programmatic gate:** `app/scripts/verify-f13-brutal-test.ts` — exit 0 with assertions on contiguous set_numbers + finished_at-after-all-sets per 05-VERIFICATION.md line 146. **Physical-iPhone UAT** routed to 05-HUMAN-UAT.md (recommended-but-not-blocking per user direction). |
| T-05-14    | Data integrity / DoS (retry storm) | `networkMode: 'offlineFirst' + retry: 1` | `app/lib/query/client.ts:73-84` declares `networkMode: 'offlineFirst'` on both queries and mutations + `retry: 1` mutation default. Captive-portal resume wired via `app/lib/query/network.ts:140-155` (`onlineManager.subscribe(resumePausedMutations)` guarded by `ONLINEMANAGER_RESUME_KEY` sentinel — WR-01 fix). |
| T-05-15    | Information Disclosure | `useActiveSessionQuery` cross-user | `app/lib/queries/sessions.ts:48-67` double-gates: (a) client-side `.eq("user_id", userId)` at line 57; (b) server-side RLS `Users can manage own sessions`. `.maybeSingle()` at line 61 avoids row-count leak via error shape. Cross-user regression: `app/scripts/test-rls.ts:666-672` ("A cannot UPDATE notes on B's workout_session"). |
| T-05-10    | Information Disclosure (API8) | Service-role-key isolation | Audit gate (`git grep "service_role\|SERVICE_ROLE" -- "*.ts" "*.tsx" "*.js" "*.jsx"`) returns matches ONLY in `app/scripts/test-last-value-query.ts:47,52`, `app/scripts/test-reorder-constraint.ts:34,37`, `app/scripts/test-rls.ts:37,42`, `app/scripts/test-sync-ordering.ts:32,35`, `app/scripts/test-upsert-idempotency.ts:24,27` — all Node-only scripts. Zero matches under `app/lib/`, `app/app/`, or `app/components/` (verified via `git grep ... -- "app/lib/*" "app/app/*" "app/components/*"` — empty result). |
| T-05-04-01 | Tampering (natural key) | Duplicate `(session_id, exercise_id, set_number)` | `app/supabase/migrations/0003_exercise_sets_natural_key.sql:18-20` `ALTER TABLE public.exercise_sets ADD CONSTRAINT exercise_sets_session_exercise_setno_uq UNIQUE (session_id, exercise_id, set_number);`. Migration 0005 (idempotent superseder) at `app/supabase/migrations/0005_exercise_sets_dedupe_and_uq_combined.sql:102-118` re-asserts via `IF NOT EXISTS` DO-block guard. Constraint enforced in production: `npm run inspect:duplicate-sets` lists `exercise_sets_session_exercise_setno_uq type=u UNIQUE`. Cross-user regression: `app/scripts/test-rls.ts:799-824` ("Phase 5 gap-closure: duplicate (session_id, exercise_id, set_number) rejected with 23505 unique_violation"). |
| T-05-04-02 | Tampering (trigger surface) | Server-side `set_number` trigger | `app/supabase/migrations/0004_exercise_sets_set_number_trigger.sql:32-56` declares `create or replace function public.assign_exercise_set_number() returns trigger language plpgsql set search_path = '' as $$ ... $$;` — explicitly SECURITY INVOKER (no `security definer` keyword; per Postgres default invoker semantics) AND `set search_path = ''` per CLAUDE.md Pitfall §7. All schema references inside the function body (`public.exercise_sets`) are fully qualified. |
| T-05-04-03 | Information Disclosure (trigger leak) | Trigger MAX(set_number) cross-user gate | Same evidence as T-05-04-02 — SECURITY INVOKER means the trigger's `select max(set_number)` runs under the caller's RLS context (`Users can manage own sets` USING clause filters to the caller's parent session). Migration `app/supabase/migrations/0004_exercise_sets_set_number_trigger.sql:9-12` documents the invariant explicitly. |
| T-05-05-01 | DoS | PersistQueryClientProvider hydration gate never flips | `app/app/_layout.tsx:132-152` mounts `<PersistQueryClientProvider client persistOptions onSuccess onError>`. **Happy path:** `onSuccess` at line 138-143 flips `usePersistenceStore.getState().setHydrated(true)`. **Degraded-but-unblocked:** `onError` at line 144-152 ALSO flips `setHydrated(true)` and logs `console.warn("[persistence] hydration failed — proceeding without cache restore")` so a silent AsyncStorage crash cannot leave the screen stuck on "Återställer pass…". Consumer: `app/app/(app)/workout/[sessionId].tsx:144-157` (`if (!hydrated) return …Återställer pass…`). Store implementation: `app/lib/persistence-store.ts:20-23`. |
| T-05-06-01 | Tampering (locale bypass) | Swedish-locale `"5,0,0,0"` weight_kg | `app/lib/schemas/sets.ts:44-47` declares `z.preprocess((val) => (typeof val === "string" ? val.replace(/,/g, ".") : val), …)` BEFORE the inner `.coerce.number().min(0).max(500).multipleOf(0.25)` chain. The `/g` flag is intentional — `"102,5,5"` normalizes to `"102.5.5"` → `Number("102.5.5") = NaN` → schema rejects. Regression: `app/scripts/test-set-schemas.ts:84-99` (3 cases — "102,5" coerces to 102.5; "102.5" coerces to 102.5; "102,5,5" rejects with "Vikt krävs"). 13/13 PASS. |

---

## Threat Verification — `accept` (8)

All accepted-risk entries below are documented in their originating PLAN.md `<threat_model>` blocks and recorded in this SECURITY.md accepted-risks log per CLAUDE.md "Security conventions" §Out-of-scope for V1.

### A1. T-05-09 — AsyncStorage plaintext for paused mutations

- **Category:** Information Disclosure (M2 — Insecure data storage)
- **Component:** Paused-mutation cache persisted via `asyncStoragePersister` in `app/lib/query/persister.ts`
- **Rationale:** The persisted cache holds `weight_kg` (kilograms) and `reps` (integers) for `exercise_sets` plus `started_at`/`finished_at` timestamps for `workout_sessions`. Per CLAUDE.md V1 threat model, weight and rep counts are NOT PII; they reveal no identity, no contact info, no medical history. Auth tokens are encrypted at rest via `LargeSecureStore` (AES-encrypted blob in AsyncStorage with key in `expo-secure-store` — Phase 1 established). The query cache itself is intentionally NOT encrypted to keep the offline-first hot path latency-free.
- **Revisit trigger:** F12 notes column (Phase 7) — if users start writing free-text into `notes`, that surface contains potential PII (training partner names, gym location habits) and the cache encryption decision must be re-opened.
- **Evidence of acceptance:** 05-03-SUMMARY.md line 141 ("T-05-09: AsyncStorage plaintext for sets queue — accepted — weight_kg + reps are NOT PII per V1 threat model").

### A2. T-05-04-04 — Concurrent INSERT race surfacing 23505

- **Category:** DoS (transient retry cost)
- **Component:** `exercise_sets` UNIQUE constraint enforcement under concurrent INSERT
- **Rationale:** Two concurrent INSERTs into the same `(session_id, exercise_id)` with NULL `set_number` could both compute the same MAX+1 before either commits; the second fails with 23505. Client retry path (`retry: 1` in `app/lib/query/client.ts:83`) + `.upsert(..., { onConflict: 'id', ignoreDuplicates: true })` (`app/lib/query/client.ts:733`) handle the retry idempotently — the row id is client-generated UUID and stable across retries. One extra RTT is acceptable in the personal-V1 single-user scenario where concurrent INSERTs require the same physical user to log a set on two devices within the same millisecond.
- **Revisit trigger:** V1.1+ multi-device sync — soak tests under realistic concurrent load may justify an advisory-lock pattern.
- **Evidence of acceptance:** `app/supabase/migrations/0004_exercise_sets_set_number_trigger.sql:18-26` documents the trade-off in-source.

### A3. T-05-04-05 — Migration 0002 destructive delete (repudiation)

- **Category:** Repudiation (audit trail)
- **Component:** Migration 0002 dedupe DELETE on `exercise_sets`
- **Rationale:** Migration 0002 deletes duplicate `(session_id, exercise_id, set_number)` rows produced by D-16-era client races. The keep-row policy is deterministic (`order by completed_at asc nulls last, id asc` per `app/supabase/migrations/0002_dedupe_exercise_sets.sql:27-39`); the pre-migration state was captured by `app/scripts/inspect-duplicate-sets.ts` (committed AS-IS and runnable via `npm run inspect:duplicate-sets`). The personal-V1 scope means the deployer + writer are the same physical actor — no third-party audit trail is required. 6 silent duplicates from UAT 2026-05-13 session 379cfd29 were the sole production-deployed surface.
- **Revisit trigger:** Multi-tenant deployment (V2+) — formal audit log required.
- **Evidence of acceptance:** `app/scripts/inspect-duplicate-sets.ts` committed AS-IS; 05-04-SUMMARY.md documents the pre-migration inspect output as the audit baseline.

### A4. T-05-05-02 — AsyncStorage cache poisoning (offline tampering)

- **Category:** Tampering (pre-existing D-08 risk)
- **Component:** AsyncStorage write surface for the TanStack Query cache
- **Rationale:** Pre-existing Phase 1 D-08 acceptance — the query cache stored in AsyncStorage is not encrypted by design (LargeSecureStore encrypts only auth tokens). A device-rooted attacker with shell access could rewrite the persisted cache before app startup; on rehydrate, the malicious cache would replace canonical server state until the next refetch. Mitigation cost (AES-encrypting the entire query cache) outweighs the personal-V1 threat — the attacker already has device-level access and would have easier paths to inject data via the Supabase REST surface with stolen auth tokens.
- **Revisit trigger:** TestFlight + App Store launch (V2+) — MASVS L2 anti-tamper controls become in-scope.
- **Evidence of acceptance:** Phase 1 D-08 established; carried forward.

### A5. T-05-06-02 — Locale-display cosmetic mismatch

- **Category:** Information Disclosure (cosmetic)
- **Component:** Weight display "102.5" vs Swedish "102,5"
- **Rationale:** The schema normalizes input comma → period (T-05-06-01 mitigation) but does NOT persist the user's locale preference. Display strings always use the period. For a personal Swedish-locale user this is a UX inconsistency, not a security issue — no information is leaked or tampered with. Deferred to V1.1.
- **Revisit trigger:** Multi-locale TestFlight users.
- **Evidence of acceptance:** Plan 05-06 SUMMARY documents the deferral.

### A6. T-05-07-01 — ActiveSessionBanner wrong-session display

- **Category:** Information Disclosure
- **Component:** `app/components/active-session-banner.tsx` mount on `(tabs)` only
- **Rationale:** `useActiveSessionQuery` (`app/lib/queries/sessions.ts:48-67`) is RLS-scoped to the authenticated user — the banner can never display another user's session, only one of the current user's own sessions or none. Worst-case failure mode is missing-banner (cache miss with no session shown), not wrong-banner. The banner is intentionally mounted only on `(tabs)` per `app/app/(app)/(tabs)/_layout.tsx:39` and the UI-SPEC mount-scope clarification at 05-UI-SPEC.md line 289.
- **Evidence of acceptance:** 05-UI-SPEC.md line 289 documents the mount scope; `app/components/active-session-banner.tsx:50` defensive null-return when no active session.

### A7. T-05-07-02 — `refetchOnMount: 'always'` Supabase read cost

- **Category:** DoS (free-tier budget)
- **Component:** `useActiveSessionQuery` and the banner re-mount path
- **Rationale:** Sub-option B chosen knowingly in 05-07 INVESTIGATION — banner re-mounts on every tab focus trigger a fresh query, costing one PostgREST round-trip per tab switch. Supabase free-tier budget is ample for the personal-V1 user (< 50K req/month). The freshness guarantee outweighs the marginal cost.
- **Evidence of acceptance:** 05-07 INVESTIGATION-LOG documents the trade-off.

### A8. T-05-16 — Draft-resume "Avsluta sessionen" misclick

- **Category:** UX / data destruction risk
- **Component:** Phase 5 Plan 03 draft-resume overlay
- **Rationale:** Destructive-red styling + force-decision (no backdrop-dismiss) UX. Recoverable in practice because the session row + its sets remain visible in Historik (Phase 6 read-side) — Avsluta sets `finished_at`, it does not delete data.
- **Evidence of acceptance:** 05-03-SUMMARY.md line 145.

---

## Post-Plan Findings

### CR-01 (05-REVIEW.md) — Migration 0002 + 0003 TOCTOU window

- **Original disposition:** Critical blocker (one BLOCKER in 05-REVIEW.md).
- **Final disposition:** **mitigate (fixed)**, NOT accepted.
- **Fix:** `app/supabase/migrations/0005_exercise_sets_dedupe_and_uq_combined.sql` — explicit `begin;`/`commit;` block + `LOCK TABLE public.exercise_sets IN ACCESS EXCLUSIVE MODE` (line 77) + idempotent dedupe CTE (lines 82-94) + `IF NOT EXISTS`-guarded `ADD CONSTRAINT` DO block (lines 102-118). Applied to deployed DB; `npm run inspect:duplicate-sets` confirms the UNIQUE constraint is present and no duplicates remain post-replay.
- **Audit note:** The orchestrator's threat-register prompt flagged this finding as a candidate for accept-with-rationale. Audit verifies the fix is implemented in code rather than accepted — the LOCK TABLE statement is present at migration 0005 line 77, the IF NOT EXISTS DO-block guard is present at lines 102-118, and the explicit transaction wrap is present at lines 73 + 120. This is the stronger disposition.

---

## Unregistered Flags (new attack surface introduced during implementation with no threat mapping)

**None.** All seven Phase 5 plans declared their threat models up-front; the 05-04..05-07 gap-closure plans (FIT-7..FIT-10) introduced new threats but all were recorded in their respective PLAN frontmatter (T-05-04-* for FIT-7 migrations; T-05-05-* for FIT-8 hydration; T-05-06-* for FIT-9 locale; T-05-07-* for FIT-10 banner mount scope). 05-01-SUMMARY.md and 05-02-SUMMARY.md `## Threat Flags` sections each enumerate every implementation-time threat and map it back to a register ID. 05-03-SUMMARY.md `## Threat Flags` confirms zero new surface. 05-04..05-07 SUMMARY files contain no `## Threat Flags` section but their PLAN-frontmatter threat models were the source of the post-plan T-05-04-* / 05-* / 06-* / 07-* threat IDs that this audit verifies.

---

## CLAUDE.md compliance check

- **API1 / V4 (BOLA):** RLS with `(select auth.uid())` + `with check` on every writable policy — `app/supabase/migrations/0001_initial_schema.sql:137-144`. Cross-user regression updated to cover all Phase 5 new shapes — `app/scripts/test-rls.ts:631-824` (Phase 5 extension + gap-closure assertions).
- **API2 / V2 / M3 (Broken auth):** Session storage via LargeSecureStore — established Phase 1, unchanged.
- **API3 (Excessive data exposure):** RLS scopes at DB layer; narrow `.select()` on `useLastValueQuery` — `app/lib/queries/last-value.ts:92`.
- **API8 / M9 / V14 (Misconfig):** Migration-as-truth — Migrations 0002/0003/0004/0005 all live in `app/supabase/migrations/`. `verify-deploy.ts` confirms deployed state (05-VERIFICATION.md line 147).
- **M2 (Insecure data storage):** Paused-mutation cache plaintext accepted-with-rationale (T-05-09 / A1 above).
- **M7 (Client code quality):** TypeScript strict per Expo template; `createClient<Database>` enforced; `tsc --noEmit` clean (05-VERIFICATION.md line 139).
- **Service-role isolation:** Audited green — matches only in `app/scripts/*.ts` (allowlist).

---

_Audited: 2026-05-14_
_Auditor: Claude (gsd-security-auditor)_
_ASVS Level: 1 (project baseline per CLAUDE.md)_
_block_on threshold: high (per orchestrator config — any HIGH-severity gap blocks; this audit returned 0)_
