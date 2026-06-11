---
phase: 09-auth-settings-preferences
audited: 2026-06-11
asvs_level: 1
block_on: high
threats_total: 16
threats_closed: 16
threats_open: 0
status: SECURED
register_authored_at_plan_time: true
---

# Phase 9: Security Audit — Auth, Settings & Preferences

**Audited:** 2026-06-11
**ASVS Level:** 1 | **block_on:** high
**Result:** SECURED — 16/16 threats closed, 0 open.

Each declared mitigation was verified by reading the cited implementation file
and confirming the actual mitigating construct is present at the right entry
point (not by trusting documentation or SUMMARY claims). The addendum threat
T-09-16 (UAT-introduced display_name path) was assessed against ASVS L1 /
block_on=high and resolves to an **accepted low-severity defense-in-depth gap**,
not an OPEN blocker.

## Threat Verification

| Threat ID | Category | Disposition | Result | Evidence |
|-----------|----------|-------------|--------|----------|
| T-09-01 | Tampering | mitigate | CLOSED | `app/lib/prefs.ts:44-45` — `z.enum([...]).catch("metric"/"system")`; reads go through `getPref` (`:75-78`) `SCHEMAS[key].parse(raw)` — total over `string\|null`, never throws |
| T-09-02 | Tampering | mitigate | CLOSED | `app/lib/prefs.ts:46-53` — booleans stored as `"true"/"false"` strings + `z.enum(["true","false"]).catch(...).transform()`; `setPref` (`:86-87`) serializes boolean→string. No `JSON.parse` anywhere (grep confirms) |
| T-09-03 | Elevation/BOLA (API1) | mitigate | CLOSED | `0007_..._weekly_goal.sql:20-21` adds column under inherited 0001 own-row policy (no new policy, correct). `test-rls.ts:310-312` cross-user UPDATE-blocked assertion + `:314-331` own-row success assertion |
| T-09-04 | Tampering | mitigate | CLOSED | `app/lib/resolve-language.ts:24-26` returns only `'sv'\|'en'` literal union; `app/lib/i18n.ts:72-77` wrapper delegates to core. No free text reaches `changeLanguage` |
| T-09-05 | Tampering (defense-in-depth) | mitigate | CLOSED | `0007_..._weekly_goal.sql:21` `check (weekly_goal between 1 and 7)` server-side; `weekly_goal: number` present in regenerated `types/database.ts` (grep-confirmed in plan) |
| T-09-SC | Tampering | accept | CLOSED | Zero package installs this phase — `tech-stack.added: []` in all 3 SUMMARYs; migrations are first-party SQL. Logged in accepted-risk register below |
| T-09-06 | Tampering | mitigate | CLOSED | `settings.tsx:222-225` all fm:* reads via `getPref` (prefs.ts catch-parse); `:216-221` fm:theme via inline `z.enum().catch().parse` idiom |
| T-09-07 | Elevation/BOLA | mitigate | CLOSED | `settings.tsx:316-329` `.update({weekly_goal:clamped}).eq("id", userId).select().single()` + clamp `Math.min(7,Math.max(1,next))` (`:311`) + own-row RLS + DB CHECK; returned-row verified (`error\|\|!data` → rollback) |
| T-09-08 | Tampering | mitigate | CLOSED | `settings.tsx:254` `i18n.changeLanguage(resolveLanguage(value))` — resolver returns only `'sv'\|'en'` (verified T-09-04) |
| T-09-09 | DoS | mitigate | CLOSED | `_layout.tsx:180` `.finally(() => setLocaleReady(true))` fail-open preserved; corrupt/IO-failing locale pref cannot hang the splash gate |
| T-09-10 | Spoofing/Info-disclosure | mitigate | CLOSED | `settings.tsx:500` `onPress={signOut}` calls `useAuthStore.signOut` verbatim; `auth-store.ts:56-78` chain intact: `supabase.auth.signOut()` → `queryClient.clear()` → `asyncStoragePersister.removeClient()` (FIT-5 isolation, no regression) |
| T-09-11 | Privacy/over-permission | accept | CLOSED | `settings.tsx:303-306` notifications toggle writes `fm:notifications` only; grep `expo-notifications` in settings.tsx = NO match. Logged in accepted-risk register below |
| T-09-12 | Tampering/Info-disclosure | mitigate | CLOSED | `sign-in.tsx:77` `resolver: zodResolver(signInSchema)` + `sign-up.tsx:84` `zodResolver(signUpSchema)` unchanged; `schemas/auth.ts` Phase-3 schemas intact (password.min(12), email validation) |
| T-09-13 | Info-disclosure | mitigate | CLOSED | `sign-in.tsx:96-100` `invalid_credentials` → generic "Fel email eller lösenord" with explicit ASVS V2.1.4 comment "do NOT distinguish wrong-email vs wrong-password" — no field-level leak |
| T-09-14 | Spoofing (double-submit) | mitigate | CLOSED | `sign-in.tsx:286` + `sign-up.tsx:409` `loading={isSubmitting}` on ForgeButton (built-in disable during async); RHF `isSubmitting` from `formState` |
| T-09-15 | Tampering (session/M3) | accept | CLOSED | Re-skin is presentational; grep confirms no `supabase.auth.*`/`LargeSecureStore` edits in auth screens beyond the unchanged `signInWithPassword`/`signUp` calls. Logged in accepted-risk register below |
| T-09-16 | Tampering/Info-disclosure (ADDENDUM) | mitigate | CLOSED (with accepted residual) | See assessment below |

## T-09-16 Assessment (Addendum — UAT-introduced display_name path)

**Path:** sign-up Name input → Zod → `auth.signUp({options:{data:{display_name}}})`
→ `raw_user_meta_data` → `handle_new_user` trigger (0008) → `profiles.display_name`.

**Verified present:**
- **Form boundary cap:** `app/lib/schemas/auth.ts:23-27` — `z.string().trim().min(1).max(80)`.
- **Trigger safety:** `0008_handle_new_user_display_name.sql:28-41` — `security definer
  set search_path = ''`, fully-qualified `public.profiles`, value bound as a plpgsql
  **parameter** inside the INSERT (no string concatenation → no SQL-injection surface),
  `nullif(trim(...),'')` normalizes blank/whitespace to NULL. Matches the 0001
  `handle_new_user` signature/security exactly (verify-deploy confirmed DEFINER/search_path).
- **Wiring:** `sign-up.tsx:102` `options:{data:{display_name:name.trim()}}`.

**Residual gap (per code-review WR-01):** the `.max(80)` cap is **client-side only**.
`auth.signUp` is an unauthenticated public endpoint; a direct API caller can submit a
multi-megabyte `display_name` and the trigger writes it verbatim into the unbounded
`text` column (no DB-layer `CHECK (char_length <= n)` / `left()` cap, unlike the
defense-in-depth `weekly_goal` CHECK in 0007).

**Disposition at ASVS L1 / block_on=high:**
- **NOT a blocker.** There is **no code-execution / injection / XSS sink** — value is a
  bound parameter, stored as plain text, rendered only in RN `<Text>` (no HTML surface).
  The auditor independently confirmed the parameterized INSERT (no concat) in 0008.
- The only realized impact is **storage bloat / convention inconsistency** (the team's own
  defense-in-depth pattern applied to `weekly_goal` was not mirrored here). This is a
  **low-severity, defense-in-depth gap**, not a confidentiality/integrity/availability
  violation that ASVS L1 mandates blocking on.
- T-09-16 is therefore marked **CLOSED** (the declared mitigations — Zod bound, parameterized
  trigger, DEFINER/search_path — are all present in the implementation) with an **accepted
  residual risk** logged below and a tracked follow-up recommended.

## Accepted Risk Register

| ID | Risk | Rationale | Follow-up |
|----|------|-----------|-----------|
| T-09-SC | No package-install supply-chain review | Zero installs this phase; migrations are first-party SQL | None — re-assess on next dependency change |
| T-09-11 | Notifications pref stored without OS-permission gating | D-07 — stored pref only, no `expo-notifications`/OS prompt in V1; permission deferred to Phase 14 | Wire OS permission when notification delivery is built (Phase 14) |
| T-09-15 | Auth re-skin trusted not to touch session path | D-17 — presentational only; `supabase.auth.*` + LargeSecureStore unchanged (verified by grep) | None |
| T-09-16-R | `display_name` has no DB-layer length cap (client-side `.max(80)` only); direct `auth.signUp` API call can store unbounded text | No injection/exec sink (parameterized INSERT, plain-text store, RN no-HTML); storage-bloat only; below ASVS-L1 block threshold | RECOMMENDED: follow-up migration adding `left(trim(...),80)` in the trigger OR `check (display_name is null or char_length(display_name) <= 80)` on the column (mirrors 0007 defense-in-depth). Suggest a Linear `debt`/`low` issue. |

## Unregistered Flags

None. The `## Threat Flags` section of `09-01-SUMMARY.md` reads "None"; `09-02`/`09-03`
SUMMARYs surface no new security surface beyond the registered threats. The only
implementation surprise — the UAT-introduced display_name path — was supplied to this
audit as the explicit addendum threat T-09-16 and is verified above. No new attack
surface appeared without a threat mapping.

## Audit Notes

- Implementation files were treated as READ-ONLY; no implementation was modified.
- All automated gates were reported green pre-audit (tsc, lint, `test:rls` incl. cross-user
  weekly_goal, `verify-deploy` confirming `handle_new_user` DEFINER/search_path, device UAT).
  This audit independently re-verified the mitigating constructs in source, not the gate logs.
- Code-review warnings WR-02 (weekly_goal last-writer-wins race) and WR-03 (silent profile-load
  error branch) are **correctness/robustness** findings, not declared threats in the register;
  they are out of scope for this disposition-based audit and remain tracked by the code review.

_Auditor: gsd-security-auditor • 2026-06-11_
