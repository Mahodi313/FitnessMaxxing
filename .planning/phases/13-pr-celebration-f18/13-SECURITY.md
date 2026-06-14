# 13-SECURITY.md — Phase 13 (PR Celebration, F18)

**Phase:** 13 — pr-celebration-f18
**ASVS Level:** 1 · **block_on:** high
**threats_open: 0**
**Threats Closed:** 14/14 (12 mitigate + 2 accept)
**Audited:** 2026-06-14 · register authored at plan time (`register_authored_at_plan_time: true`)

This audit verifies each declared threat mitigation against the implemented code. Implementation
files were read-only throughout. No new threats were scanned; each register entry was verified
by its declared disposition.

---

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-13-01 | Information disclosure | mitigate | CLOSED | All 4 RPCs declared `security invoker` — `0012_phase13_pr_rpcs.sql:96,150,187,224`. Cross-user RLS assertions present per RPC in `test-rls.ts:1125-1222` (A querying B's exercise/sessions returns empty/filtered). Functions bodies join `public.workout_sessions s ... s.finished_at is not null` so caller-JWT RLS from migration 0001 scopes every row. |
| T-13-02 | Tampering/Elevation | mitigate | CLOSED | `set search_path = ''` on all 4 functions — `0012_…sql:98,152,189,226`; all schema refs fully qualified (`public.exercise_sets`, `public.workout_sessions`). Deploy gate `verify-deploy.ts:173-211` (`phase13Functions`) asserts `prosecdef=false` AND `proconfig` contains `search_path=` for each, `process.exit(1)` on failure. |
| T-13-03 | Tampering | mitigate | CLOSED | `e1rm.ts:48-50` — `!Number.isFinite` → 0, `weightKg <= 0` → 0, `reps <= 0` → 0 before the multiply. Unit-covered in `test-e1rm.ts:42-51` (NaN/±Infinity/0/-5 cases) + npm script `test:e1rm` added in `app/package.json`. |
| T-13-04 | Tampering | mitigate | CLOSED | All 4 functions take typed `uuid` / `timestamptz` / `uuid[]` params (`0012_…sql:85,178-179,217`); `language sql` bodies use parameter binding only — no `execute`/`format`/string concatenation anywhere in the migration. |
| T-13-05 | Tampering | mitigate | CLOSED | SQL e1RM expression `weight_kg * (1 + reps / 30.0)` appears only in `order by` / `over(...)` window clauses (`0012_…sql:108,166,235`); `returns table` signatures expose raw `weight_kg`,`reps`,`was_pr`/`has_pr` only — no e1RM column. `get_session_pr_flags` returns `(session_id, has_pr boolean)` only. No `.tsx` consumes a SQL e1RM column (grep clean). |
| T-13-06 | Tampering | mitigate | CLOSED | Zod `.parse()` at every `supabase.rpc()` boundary, never `as`-cast: `pr-history.ts:46` (PrHistoryRowSchema), `best-e1rm.ts:69` (BestWorkingSetRowSchema), `exercise-sets-in-range.ts:58` (SetInRangeRowSchema), `session-pr-flags.ts:50` (SessionPrFlagRowSchema). |
| T-13-07 | Information disclosure | mitigate | CLOSED | `best-e1rm.ts:51,58,77` — `userId` read from auth store, `if (!userId) return {}` belt-and-braces guard, `enabled: !!userId`; RPC is RLS-scoped INVOKER (T-13-01). Cached via existing persister; row data is non-PII (weight_kg/reps). |
| T-13-08 | Denial of service | mitigate | CLOSED | `client.ts:849-853` — only an ADDITIVE `invalidateQueries({ queryKey: bestE1rmKeys.all })` inside the EXISTING `['session','finish']` `onSettled`. No mutation-default added, no `onMutate`/`scope`/`mutationFn` change. Hot-path keys (`set/add`, etc.) untouched. |
| T-13-09 | Denial of service | mitigate | CLOSED | `[sessionId].tsx:664-763` — PR detection + banner + haptics run AFTER `addSet.mutate(...)`, as `void getPref(...).then(...)` fire-and-forget; never `await`ed, never preceding the mutate. Inputs are in-memory cache (`bestE1rm`, `setsForThisExercise`), no hot-path fetch. |
| T-13-10 | Tampering | mitigate | CLOSED | `[sessionId].tsx:84` imports `epley1RM`; detection at :714,719,732 and derived trophy at :627,645 call `epley1RM` — no inline `w*(1+r/30)` in the screen (grep confirms the only match is a comment stating it is NOT inline). |
| T-13-11 | Information disclosure | mitigate | CLOSED | `PrBanner.tsx:121` `useReducedMotion()`; :126-133 snaps both `scale` and `sweep` to final on reduce-motion. Haptics gated behind `getPref("fm:haptics")` at `[sessionId].tsx:699-701,756-761`; `prefs.ts:46-49` corrupt-tolerant enum-catch default ON. |
| T-13-12 | Tampering | mitigate | CLOSED | Every read-side e1RM via `epley1RM`: `chart.tsx:381,386`, `history/[sessionId].tsx:805`. `history.tsx` list renders only the `has_pr` boolean (no e1RM). No inline formula and no SQL e1RM column consumed across read-side screens (grep clean). |
| T-13-13 | Information disclosure | accept | CLOSED-accepted | Success-only delta is consistent with code: `chart.tsx:398-404` shows chip only when `heroDeltaKg > 0` (else `null`); `history.tsx:413` gates the chip on `deltaPct >= 0`. Negative delta renders no chip — cosmetic, no data exposure. Accepted-risk rationale below. |
| T-13-SC | Tampering | accept | CLOSED-accepted | `git diff origin/dev...HEAD -- package.json app/package.json` shows zero `dependencies`/`devDependencies` changes — only an additive `test:e1rm` npm SCRIPT entry. No package installs to verify. Accepted-risk rationale below. |

---

## Accepted Risks Log

- **T-13-13 (delta chip never scolds).** A negative week-over-week / range delta deliberately
  renders NO chip rather than a red down-indicator. This is a UX-honesty/cosmetic choice with no
  data-exposure surface (the numeral is already shown; the chip only adds a success framing).
  Verified consistent with `chart.tsx:401-404` and `history.tsx:413`. Accepted for V1.

- **T-13-SC (supply-chain / installs).** Phase 13 introduced zero new package dependencies. The
  only `package.json` delta is the additive `test:e1rm` script. Nothing to install, nothing to
  verify. Accepted.

- **Banner/trophy asymmetry (WR-03, documented, not a registered threat).** The floating PR banner
  is an ephemeral one-shot; the per-row trophy self-heals from derived state. Deleting a just-PR'd
  set leaves the banner "spent" while the trophy disappears. Documented at `[sessionId].tsx:607-621`
  as an accepted UX-honesty gap, NOT data loss — the in-session `bestE1rm` baseline is deliberately
  frozen (invalidates only on `['session','finish']`) to preserve the offline-first contract. No
  security impact.

---

## Unregistered Flags

None. No `## Threat Flags` section is present in any of `13-01-SUMMARY.md` … `13-05-SUMMARY.md`;
no new attack surface appeared during implementation that lacks a register mapping. All new entry
points (the 4 RPCs + the 4 query wrappers) map to registered threats T-13-01..T-13-12.

---

## Code-Review Cross-Check (13-REVIEW.md WR-01..WR-06)

The review findings already addressed do not weaken any mitigation:
- WR-01 (filter PR folds to working sets) reinforces T-13-05/10/12 single-population consistency.
- WR-02 (epoch-sort chart hero) and WR-05 (route y-axis through `formatWeightValue`) keep display
  numerals consistent with the single e1RM source (T-13-12).
- WR-03 (banner/trophy asymmetry documented) — accepted UX gap, logged above.
- WR-04 / WR-06 are display/i18n correctness, no security surface.

---

**Result: SECURED — all 12 mitigate threats verified CLOSED in code, both accept threats
CLOSED-accepted with rationale. threats_open: 0.**
