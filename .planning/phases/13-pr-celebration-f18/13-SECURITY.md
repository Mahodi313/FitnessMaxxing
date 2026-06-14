---
phase: 13
slug: pr-celebration-f18
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-14
---

# Phase 13 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Read-side feature (PR Celebration / F18): 4 new read-only Postgres RPCs, Zod-parsed query hooks, a fire-and-forget PR-detection + celebration banner, and read-side PR trophies. Zero new dependencies.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| client (caller JWT) → Postgres RPC | Authenticated client calls the 4 new read-only PR RPCs; rows must be scoped to the caller via RLS. Untrusted `p_exercise_id` / `p_since` / `p_session_ids` params cross here. | uuid / timestamptz / uuid[] params; workout set rows (non-PII) |
| Supabase RPC response → client | RPC rows (untyped at runtime — generated types are compile-time only) cross into the app and feed PR display + detection. | set rows, `was_pr` / `has_pr` booleans |
| cached best-reference → live detection | The persisted best-e1RM Record drives a UI-only celebration; a stale/absent value must degrade to "no PR", never an error or a blocked save. | numeric e1RM reference (non-PII) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-13-01 | Information disclosure | 4 PR RPCs (RLS inheritance) | mitigate | All 4 RPCs `security invoker` → inherit migration-0001 RLS; per-RPC cross-user `test:rls` assertions (`test-rls.ts:1128/1149/1175/1205`) | closed |
| T-13-02 | Tampering/Elevation | search_path hijack | mitigate | `set search_path = ''` + fully-qualified `public.*` on all 4 (`0012:98/152/189/226`); `verify-deploy.ts:173-211` `phase13Functions` deploy gate asserts `prosecdef=false` + `proconfig` search_path | closed |
| T-13-03 | Tampering | epley1RM numeric guards | mitigate | Non-finite / weight≤0 / reps≤0 → return 0 (`e1rm.ts:48-50`); unit-tested `test-e1rm.ts:42-51` (NaN, Infinity, zero, negative, 0-rep) | closed |
| T-13-04 | Tampering | SQL injection via RPC params | mitigate | Typed `uuid` / `timestamptz` / `uuid[]` params; no `EXECUTE`/`format()`/`||`/`quote_` in any function body | closed |
| T-13-05 | Tampering | SQL-vs-JS e1RM drift | mitigate | SQL e1RM used only in `over()` ordering / `was_pr` flag, never a returned column (`0012:108/124/166/235`); RAW `weight_kg`/`reps`/flags returned; all displayed numerals from `lib/e1rm.ts` (D-08) | closed |
| T-13-06 | Tampering | untyped RPC row trusted blindly | mitigate | Zod `.parse()` at every boundary (`best-e1rm.ts:69`, `pr-history.ts:46`, `session-pr-flags.ts:50`, `exercise-sets-in-range.ts:58`); no `as`-cast of RPC rows | closed |
| T-13-07 | Information disclosure | best-e1RM cache hydration | mitigate | `userId` belt-and-braces filter + `enabled: !!userId` (`best-e1rm.ts:51/58/77`) over RLS-scoped invoker RPC; flows through existing encrypted persister, no new sensitive storage slot | closed |
| T-13-08 | Denial of service | hot-path regression via query client edit | mitigate | Single additive `void invalidateQueries({queryKey: bestE1rmKeys.all})` in existing `session.finish` onSettled (`client.ts:853`); no `setMutationDefaults`/`onMutate`/scope edit; `test:f13-brutal` gate | closed |
| T-13-09 | Denial of service | detection blocking the set save | mitigate | Detection + banner + haptic fire-and-forget AFTER `addSet.mutate` (`[sessionId].tsx:641` then `:680-731`), never awaited; inputs from cached `bestE1rm` + in-memory sets — no hot-path fetch | closed |
| T-13-10 | Tampering | active-screen e1RM drift | mitigate | All e1RM via `epley1RM` (`[sessionId].tsx:611/621/691/696/701`); zero inline `w*(1+r/30)` in the screen | closed |
| T-13-11 | Information disclosure | reduce-motion / haptic respect | mitigate | `useReducedMotion()` snap (`PrBanner.tsx:121/126-133`, D-19); haptics behind `fm:haptics` pref gate (`[sessionId].tsx:676/725`, D-18) | closed |
| T-13-12 | Tampering | read-side e1RM drift | mitigate | Read-side screens import/use `epley1RM` (`chart.tsx:100/374/379`, `history/[sessionId].tsx:76/805`); zero inline formula; RPCs return no display e1RM column | closed |
| T-13-13 | Information disclosure | delta chip never scolds | accept | Success-only delta — no red/down branch (`chart.tsx:392-397`); cosmetic, no data exposure (Phase 12 D-12 carry-forward) | closed |
| T-13-SC | Tampering | supply-chain installs | accept | Zero new deps this phase — Phase 13 merge diff to `package.json` is exactly one line (`test:e1rm` script); no `dependencies`/`devDependencies` additions | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-13-01 | T-13-13 | Success-only delta chip (no red down-chip) is a deliberate UX decision (Phase 12 D-12) — a negative delta renders no chip. Cosmetic only; no data exposure. | Mahodi313 | 2026-06-14 |
| AR-13-02 | T-13-SC | No new dependencies introduced this phase; nothing to vet. Supply-chain disposition is accept-by-absence. | Mahodi313 | 2026-06-14 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-14 | 14 | 14 | 0 | gsd-security-auditor (opus) |

**Non-blocking hardening note (not a threat):** code-review warning WR-01 — `setsForThisExercise` in `[sessionId].tsx` filters by `exercise_id` only, not `set_type === 'working'`. Today every logged set is `working`, so the in-session PR baseline is correct; a future warmup-logging UI would need this tightened. Tracked in `13-REVIEW.md`. Does not affect any Phase 13 threat disposition.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-14
