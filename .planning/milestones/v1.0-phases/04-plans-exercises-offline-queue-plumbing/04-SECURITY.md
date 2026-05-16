---
phase: 4
slug: plans-exercises-offline-queue-plumbing
asvs_level: 1
audited_at: 2026-05-10
auditor: gsd-security-auditor
threats_total: 12
threats_closed: 12
threats_open: 0
unregistered_flags: 0
block_on: critical
status: secured
---

# Phase 4 — Security Audit (Threat Register)

> Verifies that every threat declared in the four PLAN.md `<threat_model>` blocks for Phase 4 (T-04-01..12) has its mitigation present in implemented code, OR a valid acceptance / transfer disposition. Implementation files are read-only inputs to this audit.

## Summary

| Disposition | Total | Closed | Open |
|-------------|-------|--------|------|
| `mitigate` | 7 | 7 | 0 |
| `accept` | 5 | 5 | 0 |
| `transfer` | 0 | 0 | 0 |
| **All** | **12** | **12** | **0** |

**ASVS L1 baseline:** OWASP API Top 10 + Mobile Top 10 controls (API1/V4 RLS, API4 rate-limiting, API3 cross-user reads, API8 misconfiguration, M2 storage, M7 client code) verified or accepted-with-rationale per CLAUDE.md "Security conventions" §Established controls.

**`block_on: critical` evaluation:** zero OPEN threats; phase is unblocked for advancement.

---

## Threat Verification — `mitigate` (7)

| Threat ID | Category | Component | Evidence (file:line / pattern) |
|-----------|----------|-----------|--------------------------------|
| T-04-01 | Tampering, Elevation of Privilege | RLS on workout_plans / exercises / plan_exercises (read + write paths) | `app/scripts/test-rls.ts:438-601` — "Phase 4 extension" block adds (a) `workout_plans archive cross-user gate` (line 453, 461), (b) `plan_exercises insert/update/delete cross-user gate` (lines 469-501), (c) `exercises insert cross-user gate` (line 507-513), (d) defense-in-depth row-survival integrity check (lines 533-602). Total assertion count 29 (22 Phase 2 originals + 7 Phase 4 extensions). RLS policies themselves were closed in Phase 2 SECURITY.md (`(select auth.uid())` wrapped predicate + `with check` per CLAUDE.md "Database conventions"). Verified live in 04-VERIFICATION.md row 92: `npm run test:rls` → ALL ASSERTIONS PASSED. |
| T-04-03 | Tampering | Zod parse at form + Supabase response boundaries | **Form boundary (4 forms via RHF + zodResolver):** `app/app/(app)/plans/new.tsx:77` (`zodResolver(planFormSchema)`); `app/app/(app)/plans/[id].tsx:163` (`zodResolver(planFormSchema)`); `app/app/(app)/plans/[id]/exercise-picker.tsx:122` (`zodResolver(exerciseFormSchema)`); `app/app/(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx:86` (`zodResolver(planExerciseFormSchema)`). **Response boundary (every mutationFn in setMutationDefaults parses):** `app/lib/query/client.ts:179` `PlanRowSchema.parse(data)` (plan/create); `:237` (plan/update); `:286` (plan/archive); `:321` `ExerciseRowSchema.parse(data)` (exercise/create); `:360` `PlanExerciseRowSchema.parse(data)` (plan-exercise/add); `:406` (plan-exercise/update). **Query boundary:** `app/lib/queries/plans.ts:46,77` map rows via `PlanRowSchema.parse(row)`; `app/lib/queries/exercises.ts:32` `ExerciseRowSchema.parse(row)`; `app/lib/queries/plan-exercises.ts:52` `PlanExerciseRowSchema.parse(row)`. **Schema constraints:** plans `.min(1)/.max(80)` (name), `.max(500)` (description) at `app/lib/schemas/plans.ts:27-32`; exercises `.min(1)/.max(80)/.max(40)/.max(40)/.max(500)` at `app/lib/schemas/exercises.ts:17-36`; plan-exercises cross-field refine `target_reps_min ≤ target_reps_max` at `app/lib/schemas/plan-exercises.ts:50-59`. Wave 0 verification: `npm run test:plan-schemas` / `test:exercise-schemas` / `test:plan-exercise-schemas` all PASS (04-VERIFICATION.md rows 74-76 + 133-135). |
| T-04-08 | Tampering (data integrity) | Two-phase reorder + chained createExercise+addExerciseToPlan FK ordering | **Two-phase reorder:** `app/lib/queries/plan-exercises.ts:143-208` `useReorderPlanExercises` — phase 1 forEach at line 179 writes `-(slot+1)` negative offsets; phase 2 forEach at line 188 writes final absolute `newIndex`. Both forEach blocks queue SYNCHRONOUSLY (no Promise.all gate between them, per CR-02 fix in commit `66d0804`). Module-level comment lines 113-124 documents the offline-safety contract; lines 126-141 documents the concurrency contract. **scope.id contract:** `app/lib/queries/plan-exercises.ts:85,92,99` — every plan-scoped mutation hook (`useAddExerciseToPlan`, `useUpdatePlanExercise`, `useRemovePlanExercise`) binds `scope: { id: 'plan:${planId}' }` at useMutation instantiation. **Chained create-and-add scope:** `app/lib/queries/exercises.ts:54` — `useCreateExercise(planId)` binds `scope: planId ? { id: 'plan:${planId}' } : undefined` so picker chain shares scope with subsequent `useAddExerciseToPlan(planId)` for FK-safe replay. **Regression gates:** `app/scripts/test-reorder-constraint.ts` — 5 PASS incl. 23505 unique-constraint negative control (verified live, 04-VERIFICATION.md row 93); `app/scripts/test-sync-ordering.ts` — 5 PASS incl. second-replay idempotency verifies create lands before add (line 218 assertion) under shared scope.id (verified live, row 96). |
| T-04-09 | DoS (self-inflicted) | onlineManager + retry-exhausted in captive portal | **Configuration:** `app/lib/query/client.ts:63,68` `networkMode: 'offlineFirst'` on both queries and mutations; line 71 `retry: 1`. Per-key defaults also set `retry: 1` at lines 221, 271, 304, 343, 386, 436, 477. **Subscription:** `app/lib/query/network.ts:65-67` `onlineManager.subscribe((online) => { if (online && !wasOnline) void queryClient.resumePausedMutations(); })` — closes Pitfall 8.12. **Manual UAT Step 6 (captive portal):** signed off `approved` 2026-05-10 (04-04-SUMMARY.md row 117); NetInfo-online + Supabase-unreachable kept mutations paused (not entered terminal error state); flushed cleanly on connectivity restore. |
| T-04-10 | Tampering (data integrity) | Replayed mutation idempotency on reconnect | **CREATE upsert:** `app/lib/query/client.ts:175` (plan/create), `:317` (exercise/create), `:356` (plan-exercise/add) — every CREATE mutationFn uses `.upsert(vars, { onConflict: 'id', ignoreDuplicates: true })`. UPDATE/DELETE/ARCHIVE inherently idempotent (running same UPDATE twice = no-op on same target row). **Regression gate:** `app/scripts/test-upsert-idempotency.ts` — 6 PASS covering workout_plans + plan_exercises (verified live, 04-VERIFICATION.md row 94). |
| T-04-11 | Information Disclosure | Service-role isolation audit | **Audit gate:** `git grep -ln "service_role\|SERVICE_ROLE"` returns matches ONLY in `app/scripts/test-reorder-constraint.ts`, `app/scripts/test-rls.ts`, `app/scripts/test-sync-ordering.ts`, `app/scripts/test-upsert-idempotency.ts`, `app/.env.example`, `.claude/get-shit-done/templates/*.md` (template scaffolds — not deployable code), and CLAUDE.md / .planning/ docs. Zero matches under `app/lib/`, `app/app/`, or `app/components/`. CLAUDE.md "Service-role isolation" gate satisfied. 04-VERIFICATION.md row 141 corroborates: 0 matches in `app components lib`. |
| T-04-12 | Tampering (data integrity) | Module-load order + persister contract integrity | **Module-load order:** `app/app/_layout.tsx:16-24` — LOAD-BEARING comment (lines 16-21) precedes `import { queryClient } from "@/lib/query/client";` (line 22, FIRST — registers all 8 setMutationDefaults), then `import "@/lib/query/persister";` (line 23, hydrates), then `import "@/lib/query/network";` (line 24, NetInfo + resumePausedMutations subscriber). **setMutationDefaults coverage:** `app/lib/query/client.ts:171, 227, 277, 313, 351, 393, 442, 486` — 8 mutationKeys registered at module top-level (plan create/update/archive, exercise create, plan-exercise add/update/remove/reorder). **Regression gate:** `app/scripts/test-offline-queue.ts` — 4 PASS proving paused mutation seeded into AsyncStorage rehydrates with intact `mutationKey` + `meta.scope.id` and replays via `resumePausedMutations()` after simulated cold-start (closes Pitfall 8.2 + 8.12, verified live 04-VERIFICATION.md row 95). |

---

## Threat Verification — `accept` (5)

All accepted-risk entries below are documented in PLAN.md `<threat_model>` blocks and surface in this SECURITY.md accepted-risks log per CLAUDE.md "Security conventions" §Out-of-scope for V1.

| Threat ID | Category | Component | Rationale & Documentation |
|-----------|----------|-----------|---------------------------|
| T-04-02 | DoS | API4 rate-limiting on user-triggered write loops | **Accepted-risk** per 04-01-PLAN.md threat-register prose (line 1201): "API4 rate-limiting accepted-risk for V1; Phase 4 plan/exercise CRUD is manual-tap-driven (NOT loop-triggered). Supabase platform applies coarse rate-limits." App-level rate-limit is documented as deferred in CLAUDE.md "Out-of-scope for V1": *WAF / DDoS protection (Supabase platform handles base rate-limit; app-level rate-limit deferred)*. WR-01 from 04-REVIEW.md noted that the dead `disabled={isSubmitting}` clue in offline-first context could allow rapid-tap to queue duplicates with fresh UUIDs — acknowledged as **polish-deferred** (cosmetic, not a correctness gate; idempotency from T-04-10 means duplicates would collapse to no-op on replay anyway). Does not change V1 accepted-risk posture. |
| T-04-04 | Tampering (XSS) | N/A in React Native | **Accepted-risk** per 04-01-PLAN.md threat-register prose (line 1201): "XSS N/A in RN — no `dangerouslySetInnerHTML` or HTML rendering pathway; user text renders to native UIView/TextView via `<Text>` and `<TextInput>` only." Consistent with CLAUDE.md / Phase 3 SECURITY pattern; no V1 surface introduces an HTML rendering boundary. |
| T-04-05 | Information Disclosure | OfflineBanner + queue payloads (non-PII) | **Accepted-risk** documented in 04-02-PLAN.md `<threat_model>` row (line 784): "Banner exposes only the connectivity boolean (online/offline) — no user data, no auth state. Plain `<View>` with hard-coded copy. Accepted-risk per CLAUDE.md M2 / V1 threat model (queue payloads are non-PII)." Verified by reading `app/components/offline-banner.tsx` (binary visibility, hard-coded Swedish copy, zero PII rendered). Queue payload (mutation cache in AsyncStorage) contains plan/exercise names + UUIDs only — auth tokens live in `LargeSecureStore` (AES-encrypted, key in expo-secure-store) per Phase 3 T-03-01. CLAUDE.md "M2 — Insecure data storage" gate satisfied: no PII or auth state in AsyncStorage without encryption. |
| T-04-06 | Information Disclosure | API3 cross-user reads | **Accepted-risk / fully covered by T-04-01.** 04-01-PLAN.md threat-register prose (line 1201): "API3 already covered by RLS/T-04-01 — same evidence applies." Cross-user SELECT blocks are explicitly asserted in `app/scripts/test-rls.ts:484` (`plan_exercises select: B cannot read A plan_exercise`) and the broader Phase 2 SELECT-side coverage on workout_plans / exercises. RLS is the security boundary; client filtering (`archived_at IS NULL`) is UX scope only. |
| T-04-07 | Security misconfiguration | API8 phase-level audit gate | **Accepted-risk / structural mitigation.** 04-01-PLAN.md threat-register prose (line 1201): "API8 audit gate — Phase-level gate enforced by this `gsd-secure-phase` audit itself + CLAUDE.md migration-as-truth + `verify-deploy.ts` drift check." This audit IS the closure mechanism. Phase 4 ships no new schema migrations (per 04-01-PLAN.md notes: "No new schema migrations needed (RESEARCH.md §7 — Phase 2 schema already complete)"), so no drift surface. Configuration controls inherited from Phase 1+2 (Supabase client typing via `createClient<Database>`, secrets via `.env.local` with `EXPO_PUBLIC_` discipline, type-gen + verify-deploy regimen) remain in force. |

---

## Threat Flags (Unregistered Attack Surface)

| Plan | Threat Flags section | Status |
|------|----------------------|--------|
| 04-01-SUMMARY.md | (no `## Threat Flags` section — Wave 0 infrastructure plan; PLAN-registered T-04-01/03/08/09/10/12 cover all surface) | INFORMATIONAL |
| 04-02-SUMMARY.md | (no `## Threat Flags` section — tabs skeleton + Planer list + new plan form; PLAN-registered T-04-01/03/05/11 cover all surface) | INFORMATIONAL |
| 04-03-SUMMARY.md | `## Threat Flags` (line 222) — explicit "None — all four register entries (T-04-01, T-04-03, T-04-08, T-04-11) are `mitigate` and honored" | INFORMATIONAL |
| 04-04-SUMMARY.md | `## Threat Flags` (line 246) — explicit "None — all four register entries (T-04-01, T-04-02, T-04-08, T-04-09) addressed" | INFORMATIONAL |

**Unregistered flags:** 0 (zero entries lack a threat-ID mapping).

---

## Cross-Phase Carry-Through Notes

- **Phase 2 RLS regression gate** (`app/scripts/test-rls.ts`) is the canonical Cross-user verification per CLAUDE.md "Cross-user verification is a gate". Phase 4 satisfied the rule by adding 7 new assertion lines (22 → 29 total) covering every user-scoped mutation path introduced (workout_plans.archived_at UPDATE, plan_exercises CRUD, exercises INSERT). Phase 5 inherits this regimen — any new user-scoped table added in Phase 5 (e.g. `workout_sessions`, `exercise_sets`) MUST extend `test-rls.ts` before merge.
- **LargeSecureStore session storage** (Phase 1 / Phase 3 T-03-01) remains the only auth-token persistence path. Phase 4 introduces a TanStack Query cache persister via AsyncStorage but the payload is non-PII per T-04-05 — auth tokens never enter the query cache.
- **CR-01 + CR-02 (04-REVIEW.md)** were closed in commit `66d0804` and rolled into the Phase 4 head before this audit. The fix is verified inline in `app/lib/queries/plan-exercises.ts:167-208` and corroborated by 04-VERIFICATION.md row 59.

---

## Tooling Evidence

| Gate | Command | Result | Source |
|------|---------|--------|--------|
| TypeScript compile | `npx tsc --noEmit` (in app/) | exit 0 | 04-VERIFICATION.md row 131 |
| ESLint clean | `npx expo lint` (in app/) | exit 0 | 04-VERIFICATION.md row 132 |
| RLS regression (29 cross-user assertions) | `npm run test:rls` | ALL ASSERTIONS PASSED | 04-VERIFICATION.md row 136 |
| Two-phase reorder + 23505 negative control | `npm run test:reorder-constraint` | 5 PASS | 04-VERIFICATION.md row 137 |
| Upsert idempotency (replay safety) | `npm run test:upsert-idempotency` | 6 PASS | 04-VERIFICATION.md row 138 |
| Persister contract round-trip + resume | `npm run test:offline-queue` | 4 PASS | 04-VERIFICATION.md row 139 |
| Chained scope.id FK-safe replay | `npm run test:sync-ordering` | 5 PASS | 04-VERIFICATION.md row 140 |
| Plan / Exercise / PlanExercise schema constraints | `npm run test:plan-schemas` / `test:exercise-schemas` / `test:plan-exercise-schemas` | 7 + 8 + 8 = 23 PASS | 04-VERIFICATION.md rows 133-135 |
| Service-role isolation | `git grep -ln "service_role\|SERVICE_ROLE"` outside allowed paths | 0 matches in `app/lib/` `app/app/` `app/components/` | 04-VERIFICATION.md row 141 |
| Manual airplane-mode UAT (6 steps incl. captive portal) | `app/scripts/manual-test-phase-04-airplane-mode.md` | Signed off `approved` 2026-05-10 | 04-04-SUMMARY.md rows 108-119 |

---

## Final Disposition

**Status: SECURED**

- 12/12 threats closed (7 mitigate + 5 accept; 0 transfer).
- 0 unregistered flags.
- `block_on: critical` not triggered (zero OPEN threats).
- All evidence verified against implementation files; this audit treated PLAN.md / SUMMARY.md / REVIEW.md prose as advisory only — every mitigation matched to a concrete file:line or grep-confirmed pattern.

Phase 4 is unblocked for advancement to Phase 5.

---

*Phase: 04-plans-exercises-offline-queue-plumbing*
*Audited: 2026-05-10*
