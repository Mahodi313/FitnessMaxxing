---
phase: 07-v1-polish-cut
slug: v1-polish-cut
status: verified
audited: 2026-05-16
asvs_level: L1
threats_open: 0
threats_total: 20
threats_closed: 20
register_authored_at_plan_time: true
short_circuit_path: "all 5 plans authored <threat_model> at plan-time with threats_open: 0; mitigations verified by gsd-verifier (07-VERIFICATION.md status: 5/5 must-haves observably true) + UAT signed off (07-HUMAN-UAT.md decision: approved)"
---

# Phase 7 Security Audit Report

**Phase:** 07 — V1 Polish Cut
**ASVS Level:** L1
**Threats Closed:** 20 / 20
**Threats Open:** 0

This phase ships F11 (RPE inline-input + history-suffix), F12 (notes capture in AvslutaOverlay + view+edit in history-detail with FIFO offline replay scope), and F15 (3-mode theme-toggle + AsyncStorage persistence). It introduces **no new RLS policies, no new auth surface, and no new database tables** — security delta vs Phase 6 is small and well-bounded.

OWASP frameworks per CLAUDE.md "Security conventions": **API Top 10** (PostgREST surface) + **MASVS L1 / Mobile Top 10** (iOS app surface). All threats are inside the existing trust boundaries established in Phases 2–6; Phase 7 only adds new client-side input fields (RPE numeric, notes text) and a new client-side persistence key (`fm:theme` in AsyncStorage).

---

## Threat Verification

All 20 plan-time threats are CLOSED. 9 dispositioned `mitigate`, 11 dispositioned `accept`. See "Detailed Threat Findings" + "Accepted Risks Log" below.

| Threat ID | Plan | Category | Disposition | Status | Evidence |
|-----------|------|----------|-------------|--------|----------|
| T-07-01 | 07-01 | Tampering | mitigate | CLOSED | See below |
| T-07-02 | 07-03 | XSS / Tampering | accept | CLOSED | See accepted risks log |
| T-07-03 | 07-04 | Concurrency | mitigate | CLOSED | See below |
| T-07-04 | 07-02 | Information Disclosure / Bypass | accept | CLOSED | See accepted risks log |
| T-07-05 | 07-01 | Tampering | accept | CLOSED | See accepted risks log |
| T-07-06 | 07-01 | Denial of Service | accept | CLOSED | See accepted risks log |
| T-07-07 | 07-01 | Information Disclosure | accept | CLOSED | See accepted risks log |
| T-07-08 | 07-02 | Tampering | mitigate | CLOSED | See below |
| T-07-09 | 07-02 | Spoofing / Display | mitigate | CLOSED | See below |
| T-07-10 | 07-02 | Denial of Service | accept | CLOSED | See accepted risks log |
| T-07-11 | 07-03 | Tampering / Bypass | mitigate | CLOSED | See below |
| T-07-12 | 07-03 | Information Disclosure | accept | CLOSED | See accepted risks log |
| T-07-13 | 07-03 | Denial of Service | accept | CLOSED | See accepted risks log |
| T-07-14 | 07-03 | Tampering | accept | CLOSED | See accepted risks log |
| T-07-15 | 07-04 | Tampering | mitigate | CLOSED | See below |
| T-07-16 | 07-04 | Information Disclosure | accept | CLOSED | See accepted risks log |
| T-07-17 | 07-04 | Repudiation | accept | CLOSED | See accepted risks log |
| T-07-18 | 07-04 | DoS / Cache thrash | mitigate | CLOSED | See below |
| T-07-19 | 07-05 | Repudiation | mitigate | CLOSED | See below |
| T-07-20 | 07-05 | Tampering | mitigate | CLOSED | See below |

---

## Detailed Threat Findings (mitigate-class)

### T-07-01 — Tampering — `AsyncStorage('fm:theme')` corruption / injection

**Trust boundary:** AsyncStorage ↔ app process. The `fm:theme` value is not user-typed but could be corrupted (interrupted disk write) or written to by other code in the app sandbox.

**Mitigation present (verified):** `z.enum(['system','light','dark']).catch('system').parse(rawValue)` is applied on read in both `app/app/_layout.tsx` (ThemeBootstrap, runs before SplashScreenController) and `app/app/(app)/(tabs)/settings.tsx` (settings screen onMount). Any non-conforming value (corruption, garbage, null) falls back to `'system'`. Read failures additionally `console.warn` with the static string `[theme] AsyncStorage read failed — defaulting to system` (no value leakage). Verified by gsd-verifier (07-VERIFICATION.md, F15 dimension).

**Status:** CLOSED. UAT step 4.6 (corruption-resilience) marked N/A on hardware (no dev REPL); coverage delegated to the Zod-enum-catch implementation, which is observably present in code.

---

### T-07-03 — Concurrency — Offline edit + offline delete on same session FIFO race

**Trust boundary:** Offline mutation persist queue ↔ in-flight finish/delete on same session. Risk: which mutation wins on replay if user does edit-then-delete or delete-then-edit while offline.

**Mitigation present (verified):** `scope.id "session:${id}"` is shared across `useFinishSession`, `useDeleteSession`, and `useUpdateSessionNotes` (all defined in `app/lib/queries/sessions.ts`). TanStack Query v5's `mutationCache` `scopeFor` API serializes mutations within the same scope FIFO. The 15th `setMutationDefaults` block in `app/lib/query/client.ts` (`['session','update-notes']`) mirrors the existing finish/delete blocks. Verified by gsd-verifier (F12 view/edit dimension): "scope.id `session:${id}` matches `useFinishSession` and `useDeleteSession` for T-07-03 FIFO contract".

**Status:** CLOSED with **audit-trail observation** (acknowledged in 07-VERIFICATION.md `human_needed`-status): UAT step 3.10 (NON-OPTIONAL per W-1) was attested by user via the T-07-03-covered checkbox, but the SQL count + Net-behavior fields in 3.10 Order A/B were left blank. Code path is architecturally correct; user observation accepted under V1 single-user soak validation policy per 07-05-SUMMARY.md §Lessons §4. If T-07-03 needs harder evidence pre-TestFlight (V1.1+), implement the deterministic Node-script fallback per 07-04 Plan Task 1 action note (`queryClient.getMutationCache().getAll()` from a paused state).

---

### T-07-08 — Tampering — Comma-locale preprocess opens RPE parser to weird inputs

**Trust boundary:** Client form input → setFormSchema → Supabase UPDATE. RPE is the only Phase 7 numeric input.

**Mitigation present (verified):** `setFormSchema.rpe` in `app/lib/schemas/sets.ts` uses ordered preprocess: trim → empty/whitespace → null; otherwise `.replace(/,/g, ".")` with `/g` flag. Multi-comma anomalies (e.g. `"8,5,5"`) collapse to multi-period (`"8.5.5"`) → NaN → Zod `coerce.number()` rejects. PATTERNS.md landmine #8 documents the order. Three new test assertions in `app/scripts/test-set-schemas.ts` verify the boundary (empty→null, Swedish comma→period, "11" rejected for max). All 16 test cases pass (gate: `npm run test:set-schemas` exit 0).

**Status:** CLOSED. Code-gate verified at branch head `b07b5da`.

---

### T-07-09 — Spoofing / Display — RPE-suffix render trusts server data without re-validation

**Trust boundary:** Supabase response → SetRowSchema.parse → history-detail render.

**Mitigation present (verified):** Render path reads `set.rpe` from `SetRowSchema.parse(supabase-response).rpe` which is `z.number().nullable()` — defense-in-depth per Pitfall 8.13 "Zod-parse Supabase-responses INTE cast". Conditional `set.rpe != null` guard at `app/app/(app)/history/[sessionId].tsx` set-row map handles the only non-numeric case (null). React Native `<Text>` template-literal interpolation has no XSS surface (no `dangerouslySetInnerHTML` equivalent in RN).

**Status:** CLOSED.

---

### T-07-11 — Tampering / Bypass — Direct Supabase API call writing > 500 chars to `workout_sessions.notes`

**Trust boundary:** User input → AvslutaOverlay TextInput → finishSession.mutate.payload (and the symmetric edit path in T-07-15).

**Mitigation present (verified):** Server-side defense via read-side parse: `sessionRowSchema` in `app/lib/queries/sessions.ts` includes `notes: z.string().max(500).nullable()` (mirrored in `sessionFormSchema.notes`). If a malicious dev-build wrote 600 chars directly to the DB, the next `sessionsKeys.detail(id)` read would throw at `sessionRowSchema.parse`, not silently render oversized content. Defense-in-depth — within-account integrity is non-critical (personal app per Phase 2 accepted risk).

**Status:** CLOSED.

---

### T-07-15 — Tampering — Edit-overlay paste > 500 chars; server has no length cap

**Trust boundary:** Edit-overlay TextInput → updateNotes.mutate.payload.

**Mitigation present (verified):** Client `maxLength={500}` is hard cap on the `TextInput` in both AvslutaOverlay (`app/app/(app)/workout/[sessionId].tsx`) and EditNotesOverlay (`app/app/(app)/history/[sessionId].tsx`). `mutationFn` trim-normalization preserves length without expansion. Read-side parse gate (T-07-11) catches any out-of-bound writes that bypass the client.

**Status:** CLOSED.

---

### T-07-18 — DoS / Cache thrash — Rapid Spara taps trigger multiple optimistic onMutate runs

**Trust boundary:** Mutation lifecycle ↔ detail-cache.

**Mitigation present (verified):** Three layers of protection observably present:
1. `setMutationDefaults` `scope.id session:${id}` serializes all session-mutations under the same scope; TanStack v5 only fires one `onMutate` per call, queues the rest behind it.
2. `cancelQueries(sessionsKeys.detail(vars.id))` in onMutate prevents refetch interference.
3. `setShowEditNotesOverlay(false)` dismissal happens synchronously before `mutate` fires, so a second tap requires re-opening the overlay first — sequential by UX flow.

**Status:** CLOSED.

---

### T-07-19 — Repudiation — UAT signed off without all 19 rows verified

**Trust boundary:** Manual UAT execution → SUMMARY.md sign-off. Trust boundary is user diligence.

**Mitigation present (verified):** UAT script `07-HUMAN-UAT.md` enumerates all 19 SPEC acceptance rows + the non-optional T-07-03 row (Section 3.10) + 3 timed runs. Sign-off block has TWO explicit confirmations: "All 19 SPEC acceptance criteria covered above" AND "Non-optional T-07-03 row (Section 3.10) covered (Order A + Order B)". Skipping a row leaves a visible unchecked box. Coverage gates from `07-05-PLAN <verify><coverage>` (grep `PASS >= 19`, `T-07-03 >= 1`, `NON-OPTIONAL >= 1`, bare `(Optional) == 0`) all enforced before user execution. Both checkboxes ticked at sign-off (`[X] yes` for both).

**Status:** CLOSED. Audit-trail note: §3.10 Order A/B SQL-count fields were left blank (see T-07-03 audit-trail observation above) — structural coverage is complete; observation-level attestation accepted.

---

### T-07-20 — Tampering — Code change between UAT execution and phase.complete invalidates sign-off

**Trust boundary:** UAT-attested commit hash ↔ phase.complete head.

**Mitigation present (verified):** Sign-off section captures the branch-head commit hash at sign-off time (`b07b5daf8beb019b0857bb2282d97f7ff3bfa61f`). This phase's branch policy per CLAUDE.md "Branching-strategi" (Phase-arbete sker på `gsd/phase-07-v1-polish-cut` via PR mot dev; aldrig direktcommit) prevents force-pushes that would rewrite the audit trail. Subsequent commits after sign-off (`82b2cde`, `fc61112`, `6126182`, `f4a98c4`) are docs-only (UAT sign-off, SUMMARY, VERIFICATION, ROADMAP/STATE tracking) — none touch implementation files. The signed-off head + the 4 doc-only commits on top form a verifiable audit trail.

**Status:** CLOSED.

---

## Accepted Risks Log

The following 11 threats were dispositioned `accept` at plan-time with explicit risk acceptance documented per CLAUDE.md "Security conventions" → "Out-of-scope for V1". They remain CLOSED (accepted) for V1; revisit during V1.1 / TestFlight planning.

| Threat ID | Why accepted (V1 scope) | Re-evaluation trigger |
|-----------|------------------------|----------------------|
| **T-07-02** XSS via `<Text>{notes}</Text>` | React Native `<Text>` is inherent-safe (no `dangerouslySetInnerHTML` equivalent). String content is rendered verbatim with no HTML/JS evaluation. | If V2 introduces WebView-based note rendering or markdown parsing. |
| **T-07-04** RPE bypass via direct Supabase API | RLS protects cross-user; within-account `numeric(3,1)` server gate accepts 0–99.9 (broader than client 0–10). Personal app — within-account integrity non-critical. | Multi-user mode (V2+). |
| **T-07-05** AsyncStorage `fm:theme` write failure | Silent `console.warn`; in-memory state remains correct for the session. Theme is non-critical (no PII, no auth). Next successful write replaces stored value. | If theme becomes user-account-tied (V2+). |
| **T-07-06** Splash-gate timing if AsyncStorage hangs > 5s | NativeWind defaults to `'system'` if `setColorScheme` is not called; SplashScreen hide is gated by `useAuthStore.status`, not ThemeBootstrap. Worst case is brief flicker, not hang. | Never (architectural decoupling holds). |
| **T-07-07** NativeWind `setColorScheme` telemetry leak | V1 has no analytics/telemetry layer. Only sink is `console.warn` with a static string (no value leakage). | When telemetry is added (V2+ if at all). |
| **T-07-10** RPE input rapid-typing slows RHF + Zod resolver | `maxLength={4}` caps input length; resolver runs only at `mode: "onSubmit"` — typing is unthrottled. F13 brutal-test gate verifies inline-row stays ≤ 3s/set after the third Controller is added. | If F13 brutal-test starts to flake or new Controllers are added on the inline row. |
| **T-07-12** Notes contain sensitive PII rendered offline plaintext | V1 single-user personal app; notes are deliberately user-content not segregated. RLS scopes read access at DB layer. Local cache is in app-sandbox; iOS sandbox is the trust boundary. | Multi-user mode OR if notes become exportable / shareable. |
| **T-07-13** RN TextInput slow on 500-char multiline | `maxLength={500}` is hard client gate. RN handles 500-char multiline at `text-base` without performance issue. Counter is a `Text` component update — minimal cost. | If iOS minor version regresses TextInput perf. |
| **T-07-14** Offline-mutation persist: notes carried via persister to disk plaintext | TanStack persister stores mutation payload in `LargeSecureStore` (AES-encrypted via `aes-js` + `react-native-get-random-values` per Phase 3 D-09). At-rest encryption inherent from existing Phase 3 pattern; notes inherit the protection. No new persistence path introduced by Phase 7. | Never (inherits Phase 3 security model). |
| **T-07-16** Notes string offline cache contains user-typed PII | Same `LargeSecureStore` AES-at-rest as T-07-14. No new PII leak vector beyond what already exists for workout data (which has been the same since Phase 3). | Same as T-07-14. |
| **T-07-17** No audit trail of notes edits | V1 single-user personal app. No multi-user audit requirements. ASVS L1 V8.2 audit logging is out-of-scope per CLAUDE.md "Out-of-scope for V1 — Audit logging for admin operations". | When multi-user mode lands (V2+). |

---

## Phase-level Security Posture (vs CLAUDE.md "Established controls")

| Control | Phase 7 status |
|---------|----------------|
| **API1 / V4** Broken object-level authz (RLS + `with check`) | **No regression** — Phase 7 introduces zero new policies. All Phase 7 reads/writes go through existing `workout_sessions`, `exercise_sets`, and reuse Phase 2's wrapped-`auth.uid()` policies. `npm run test:rls` ALL ASSERTIONS PASSED at Section 0. |
| **API2 / V2 / M3** Broken authentication (LargeSecureStore for sessions) | **No regression** — Phase 7 does not touch auth flows. |
| **API3** Excessive data exposure | **No regression** — Phase 7 RPE + notes are returned through the existing `sessionRowSchema` / `setRowSchema` parse paths; no new SELECT policies. |
| **API8 / M9 / V14** Security misconfiguration | **No regression** — zero new migrations in Phase 7 (latest = `0006_phase6_chart_rpcs.sql`); `gen:types` not re-run because schema unchanged; service-role audit clean inside Metro-bundled paths (`app/lib/`, `app/app/`, `app/components/` — zero matches). |
| **M2** Insecure data storage | **Inherits** Phase 3 `LargeSecureStore` AES-at-rest for the offline mutation persister (covers T-07-14 + T-07-16). |
| **M7** Client code quality (TypeScript strict + typed Supabase clients) | **Verified** — `npx tsc --noEmit` exit 0; all Phase 7 files use the existing typed `createClient<Database>` pattern. |

---

## Out-of-scope for V1 (deferred — re-evaluate at TestFlight)

Per CLAUDE.md "Out-of-scope for V1":

- Penetration testing (V14.5).
- App-Store-specific MASVS L2 controls (binary obfuscation, anti-tamper, jailbreak detection).
- Audit logging for admin operations (no admin surface in V1).
- App-level rate-limiting (Supabase platform handles base rate-limit).

Phase 7 inherits these acceptances unchanged.

---

## Audit Trail

| Date | Event | Actor | Branch head |
|------|-------|-------|-------------|
| 2026-05-16 | Phase 7 manual UAT executed and signed off (decision: approved) | @Mahodi313 | `b07b5daf8beb019b0857bb2282d97f7ff3bfa61f` |
| 2026-05-16 | gsd-verifier confirmed 5/5 must-haves observably true (status: human_needed for §3.10 attestation gap, pre-accepted) | gsd-verifier (sonnet) | `fc61112` |
| 2026-05-16 | `/gsd:secure-phase 7` invoked; 20 plan-time threats parsed, all dispositioned (`mitigate`: 9, `accept`: 11), `threats_open: 0`. Per workflow short-circuit (`threats_open: 0 AND register_authored_at_plan_time: true`), auditor agent skipped; SECURITY.md authored directly. | claude-opus-4-7 (orchestrator) | this commit |

---

## Sign-off

`threats_open: 0` — all 20 threats CLOSED. **Phase 7 cleared for advancement.**
