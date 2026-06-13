---
phase: 12
slug: history-detail-chart-home-dashboard
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-13
---

# 12-SECURITY.md — Phase 12 Threat Audit

**Phase:** 12 — history-detail-chart-home-dashboard
**ASVS Level:** L1 (OWASP API Top 10 + MASVS L1 per CLAUDE.md)
**block_on:** high
**threats_open: 0**
**Threats Closed:** 20/20

Verification of the plan-time STRIDE register against the implemented code. Every
`mitigate` threat was confirmed by a concrete code construct (not by documentation
or intent). The two `accept` dispositions were confirmed against implementation
reality.

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-12-01 | Information Disclosure | mitigate | CLOSED | `get_dashboard_summary` is `security invoker` (0011_phase12_dashboard_rpcs.sql:88) — RLS scopes every `public.workout_sessions`/`exercise_sets`/`profiles` read to caller JWT. Cross-user no-leak assertion: test-rls.ts:1049-1078 (A with no sessions must see all-zero; fails if B's session inflates). |
| T-12-02 | Information Disclosure | mitigate | CLOSED | `get_exercise_summary` is `security invoker` (0011:221). Cross-user assertion test-rls.ts:1081-1110 calls A with B's `exercise_id`, asserts `current_best/top_set_weight_kg/vol_per_session_kg/avg_rpe` all null (RLS-filtered via parent-FK). |
| T-12-03 | Tampering | mitigate | CLOSED | `p_tz` used ONLY as `at time zone p_tz` (0011:98,113,114,132,152,159) and `date_trunc('week', now() at time zone p_tz)`. Never string-concatenated; function is `language sql` (no `EXECUTE`/dynamic SQL). Postgres validates the zone string. |
| T-12-04 | Elevation of Privilege | mitigate | CLOSED | `set search_path = ''` on both functions (0011:90, 0011:223) + all refs fully-qualified `public.*`. Deploy gate: verify-deploy.ts:129-156 checks `prosecdef === false` AND `proconfig` contains `search_path=` for both phase12 functions, fails build otherwise. |
| T-12-05 | Tampering/DoS | mitigate | CLOSED | RPCs are `language sql` read-only (no INSERT/UPDATE/DELETE in 0011). `test:f13-brutal` gate wired (package.json → verify-f13-brutal-test.ts). No mutation defaults/persister scope/exercise_sets logging touched (see T-12-10/18 evidence). |
| T-12-06 | Tampering | accept | CLOSED (accepted) | units.ts: `toDisplayVolume`/`formatVolume`/`toDisplayWeight`/`formatWeight` are pure deterministic functions — no React, no I/O, no mutation; non-finite input returns 0 (units.ts:37,63 Pitfall-5 guard). Matches "pure deterministic on validated numeric input." |
| T-12-07 | Denial of Service | accept | CLOSED (accepted) | Animations are additive polish; reduce-motion snaps to final: chart.tsx:310 `drawProgress.value = reduced ? 1 : withSpring(1, SPRING)`. Never gates a read/write. Matches accepted-risk reality. |
| T-12-08 | Tampering | mitigate | CLOSED | Zod `.parse` at both hook boundaries: dashboard.ts:105 `DashboardSummarySchema.parse(...)`; exercise-chart.ts:259 `ExerciseSummarySchema.parse(...)`. All numerics `z.coerce.number()` (PostgREST string serialization); `weekly_volume_series` parsed as `z.array({week, volume_kg})` (dashboard.ts:57-68). |
| T-12-09 | Information Disclosure | mitigate | CLOSED | RLS scoping inherited from security-invoker RPCs (T-12-01). Client never aggregates across users — index.tsx/history.tsx contain zero `.rpc`/`.from`/raw-SQL data access; they render the RLS-scoped hook output only. |
| T-12-10 | Tampering/DoS | mitigate | CLOSED | keys.ts:136-155 adds only NEW additive factories (`dashboardKeys`, `exerciseSummaryKeys`). Existing Phase 4/5/6 factories byte-unchanged (keys.ts:10-115); no mutation defaults / persister scope in this file. dashboard.ts inherits `offlineFirst`, does not override networkMode (dashboard.ts:108). |
| T-12-11 | Information Disclosure | mitigate | CLOSED | Home hero (index.tsx) consumes `useDashboardSummaryQuery` (RLS-scoped invoker RPC, Zod-parsed); no client-side cross-user aggregation (no `.rpc`/`.from`/raw SQL in index.tsx). |
| T-12-12 | Tampering/DoS | mitigate | CLOSED | Home hero read-only; `test:f13-brutal` gate present; no mutation/queue/persister-scope touched (additive query keys only — T-12-10 evidence). |
| T-12-13 | Information Disclosure | mitigate | CLOSED | History volume/lifetime card consumes the same RLS-scoped invoker RPC via `useDashboardSummaryQuery`; history.tsx has no `.rpc`/`.from`/raw SQL — display only (12-06-SUMMARY:108). |
| T-12-14 | Tampering/DoS | mitigate | CLOSED | history.tsx render-only re-skin; preserved `useSessionsListInfiniteQuery` call site byte-unchanged (12-06-SUMMARY D-24 compliance); `test:f13-brutal` gate present. |
| T-12-15 | Tampering | mitigate | CLOSED | history/[sessionId].tsx: inline-overlay delete-confirm gated by `showDeleteConfirm` (lines 557-660), NOT a Modal portal; `deleteSession.mutate(...)` not mutateAsync (line 284, offline-safe); `onDeleteConfirm` (line 282) reachable only through the confirm overlay → confirmation required before irreversible delete. |
| T-12-16 | Tampering/DoS | mitigate | CLOSED | history/[sessionId].tsx is chrome-only re-skin; `mutate`-not-`mutateAsync` preserved (line 284); `test:f13-brutal` gate present (12-07-SUMMARY:90-91). |
| T-12-17 | Information Disclosure | mitigate | CLOSED | chart hero/stats use `get_exercise_summary` (security invoker, 0011:221); cross-user `test:rls` proves no leak (test-rls.ts:1081-1110). chart.tsx renders RLS-scoped hook data only — no `.rpc`/`.from`/raw SQL. |
| T-12-18 | Tampering/DoS | mitigate | CLOSED | chart.tsx read-only re-skin; only the NEW `exerciseSummaryKeys` slot consumed; existing 5-state `exerciseChartKeys`/`exerciseTopSetsKeys` factories untouched (keys.ts:87-115); `test:f13-brutal` gate present. |
| T-12-SC | Tampering (supply chain) | mitigate | CLOSED | `git diff origin/dev...HEAD -- app/package.json` returns empty — zero dependency additions this phase. Confirmed by every SUMMARY's "no packages installed" note (12-04/06/08-SUMMARY). |

## Defense-in-depth observations (informational, not gaps)

- **dashboard.ts:78** clamps `lifetime_hours` via `Math.max(0, v)` (WR-06) — guards
  against a negative interval from a rolled-back device clock / malformed offline
  replay corrupting the lifetime eyebrow. Client-only hardening beyond the register.
- **exercise-chart.ts:209-216** marks summary figures `.nullable()` (WR-02) so an
  all-NULL no-data row maps to the empty state rather than silently coercing to
  zeros — correctness hardening, no security impact.

## Unregistered Flags

None. Every Threat-Model Note / Threat-Surface section across SUMMARYs
(12-04/06/07/08) maps to a registered T-12-* ID. No new attack surface appeared
during implementation without a register mapping.

## Out-of-scope (per CLAUDE.md V1 accepted-risk policy)

WAF/DDoS (Supabase platform), penetration testing (pre-TestFlight), MASVS L2
binary controls, admin audit logging (no admin surface in V1). Not in Phase 12
scope; no new exposure introduced.

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-12-01 | T-12-06 | Unit-conversion math is pure deterministic functions on already-validated numeric input with non-finite guards; no untrusted input crosses the boundary. Behavior test covers correctness. | gsd-security-auditor | 2026-06-13 |
| AR-12-02 | T-12-07 | Mount/hero animations are additive presentational polish that never gate a read or write; reduce-motion snaps to the final frame. No data-path or availability impact. | gsd-security-auditor | 2026-06-13 |

*Accepted risks do not resurface in future audit runs.*

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-13 | 19 | 19 | 0 | gsd-security-auditor (opus) |

*19 distinct register IDs (T-12-01…18 + T-12-SC). T-12-SC was declared in all 8 plans and is consolidated into one supply-chain entry here.*

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-13

## Verdict

All 19 register entries CLOSED (17 mitigate verified in code + 2 accept confirmed
against implementation reality). `threats_open: 0`. Phase 12 clears the security
gate.
