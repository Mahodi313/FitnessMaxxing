---
phase: 3
slug: auth-persistent-session
asvs_level: 1
audited_at: 2026-05-09
auditor: gsd-security-auditor
threats_total: 23
threats_closed: 23
threats_open: 0
unregistered_flags: 0
block_on: high
status: secured
---

# Phase 3 — Security Audit (Threat Register)

> Verifies that every threat declared in the four PLAN.md `<threat_model>` blocks for Phase 3 (T-03-01..23) has its mitigation present in implemented code, OR a valid acceptance / transfer disposition. Implementation files are read-only inputs to this audit.

## Summary

| Disposition | Total | Closed | Open |
|-------------|-------|--------|------|
| `mitigate` | 15 | 15 | 0 |
| `accept` | 7 | 7 | 0 |
| `transfer` | 1 | 1 | 0 |
| **All** | **23** | **23** | **0** |

**ASVS L1 baseline:** all controls cited inline (V2.1.1, V2.1.4, V5, V8.3, V14) verified or accepted-with-rationale.

**`block_on: high` evaluation:** zero OPEN threats; phase is unblocked for advancement.

---

## Threat Verification — `mitigate` (15)

| Threat ID | Category | Component | Evidence (file:line / pattern) |
|-----------|----------|-----------|--------------------------------|
| T-03-01 | Tampering | LargeSecureStore session blob | `app/lib/supabase.ts:27-71` — `LargeSecureStore` class wraps AsyncStorage with AES-256-CTR; per-key encryption key in expo-secure-store (line 37, 43, 68); `react-native-get-random-values` polyfill imported FIRST (line 8). Phase 3 adds NO new code touching SecureStore — auth-store.ts uses only the typed supabase client (`app/lib/auth-store.ts:25` import). |
| T-03-02 | DoS | onAuthStateChange callback deadlock | `app/lib/auth-store.ts:64-69` — listener callback contains only `useAuthStore.setState({...})`; grep for `await ` in file returns ONLY line 47 (inside `signOut` action, not the listener). Comment header lines 17-21 documents the rule. |
| T-03-03 | Information Disclosure | TanStack Query cache leakage on signOut | `app/lib/auth-store.ts:39-57` — `signOut` action calls `await supabase.auth.signOut()` (line 47) then `queryClient.clear()` (line 48). **Note:** ordering reversed in commit `88a9b6f` (WR-06) vs Plan 01 — new ordering closes a refetch-window where in-flight queries on protected screens could repopulate cache between clear and signOut completion. By the time `clear()` runs, listener has fired SIGNED_OUT, protected screens unmounted, in-flight queries cancelled. Mitigation intent (no leak) preserved; mechanism strengthened. |
| T-03-04 | Information Disclosure | Console error logs leak credentials | `app/lib/auth-store.ts:53,92` — `console.warn` logs only `error.message` and the init-failure error object (no email/password/session); `app/app/(auth)/sign-in.tsx:89-94` and `app/app/(auth)/sign-up.tsx:122-127` — `console.error` logs only `{ code, message, status, name }` (no credentials). Verified by grep of `console.*` calls across all Phase 3 files. |
| T-03-05 | Spoofing | Schema bypass — malformed input → Supabase | `app/lib/schemas/auth.ts:17-36` (Zod 4 with `z.email()` + `error:` parameter); `app/app/(auth)/sign-in.tsx:46` and `app/app/(auth)/sign-up.tsx:58` — `resolver: zodResolver(signInSchema/signUpSchema)` wired to RHF before any `supabase.auth.*` call. 8/8 schema cases green via `app/scripts/test-auth-schemas.ts` (`npm run test:auth-schemas` in package.json). ASVS V5 input-validation gate. |
| T-03-07 | Tampering | Strict-Mode dual-mount duplicates listener | `app/lib/auth-store.ts:64` — `supabase.auth.onAuthStateChange(` at MODULE scope (not inside any hook). `grep -c "supabase.auth.onAuthStateChange(" app/lib/auth-store.ts` returns exactly 1. `useEffect` is NOT imported in this file (zero matches). |
| T-03-08 | DoS | Splash hide before status flip → blank flash | `app/app/_layout.tsx:32` — `SplashScreen.preventAutoHideAsync()` at module scope (with `.catch()` per WR-03 in commit `f95efee`); `app/app/_layout.tsx:60-70` — `SplashScreenController` calls `SplashScreen.hideAsync()` from `useEffect` only when `status !== "loading"` (WR-02 fix). `app/app/_layout.tsx:82` — `RootNavigator` returns null while `status === "loading"` (Pitfall §5 mitigation — prevents empty-navigator blank flash). UAT Tests 4+6 confirmed no flicker. |
| T-03-09 | Information Disclosure | Sign-in error reveals which field is wrong | `app/app/(auth)/sign-in.tsx:66-69` — `case "invalid_credentials"` maps to generic `setError("password", { message: "Fel email eller lösenord" })`. Does NOT distinguish wrong-email vs wrong-password (ASVS V2.1.4). UAT Test 3 (with wrong password) confirmed inline copy "Fel email eller lösenord" under password field. |
| T-03-11 | Information Disclosure | Console error logs leak credentials (sign-in) | `app/app/(auth)/sign-in.tsx:89-94` — `console.error("[sign-in] unexpected error:", { code, message, status, name })` — extracts only safe diagnostic fields. WR-04 (commit `2e856dd`) hardened this to log full error shape (no longer the raw `error` object that could in theory carry user input). Grep for `console.log(password|email|session)` returns zero matches. |
| T-03-12 | Tampering | XSS / SQL injection via TextInput | `app/app/(auth)/sign-in.tsx:46` + `app/app/(auth)/sign-up.tsx:58` — Zod schema validation precedes any Supabase call. Supabase Auth (GoTrue) treats credentials as opaque parameters in REST body — no SQL composition with user input on client. RLS at the DB enforces tenant isolation regardless. |
| T-03-13 | Spoofing | Stack.Protected guard staleness on cold start | `app/app/_layout.tsx:82` — `RootNavigator` returns null while `status === "loading"` so neither (auth) nor (app) mounts during the bootstrap race. Defense-in-depth at `app/app/(app)/_layout.tsx:22-24` (Redirect when no session) AND `app/app/(auth)/_layout.tsx:17-19` (WR-01 — symmetric Redirect to /(app) when session present, prevents authed user landing on auth screens for stale frame). UAT Test 6 confirmed no flicker. |
| T-03-15 | Spoofing | Weak password accepted client-side | Two-tier validation: `app/lib/schemas/auth.ts:20` — `password: z.string().min(12, { error: "Minst 12 tecken" })` (D-12, ASVS V2.1.1); `app/app/(auth)/sign-up.tsx:103-105` — `case "weak_password"` maps to inline "Lösenord för svagt — minst 12 tecken" under password field, catches server-side rejection if Supabase policy is stricter than client. |
| T-03-16 | Information Disclosure | Stale TanStack cache leaks user A → user B | `app/lib/auth-store.ts:47-48` — `signOut` calls `supabase.auth.signOut()` then `queryClient.clear()`. WR-06 reordering (commit `88a9b6f`) hardens this further: signOut fires SIGNED_OUT → protected screens unmount → in-flight queries cancel → THEN `clear()` runs against an empty active set. Per Plan 01 contract (T-03-03 + T-03-16 share the same code path). UAT Test 5 PASS for atomic transition; full cross-user cache verification deferred to Phase 4 per UAT.md note (where first user-data queries land). |
| T-03-18 | Tampering | Stack.Protected staleness frame | `app/app/(app)/_layout.tsx:20-26` — narrow `useAuthStore((s) => s.session)` selector + `<Redirect href="/(auth)/sign-in" />` when session is null (defense-in-depth, ROADMAP SC#5). Symmetric guard at `app/app/(auth)/_layout.tsx:15-21` (WR-01). UAT Test 6 PASS. |
| T-03-20 | Information Disclosure | (app)/index.tsx PII leak in JSX | `app/app/(app)/index.tsx:23-33` — only `session?.user.email` is rendered (line 23, 33). No `session.user.id`, `session.access_token`, `session.refresh_token`, or any other identity material in the JSX tree. Selector is narrow (D-10). |

---

## Threat Verification — `accept` (7)

Each acceptance is documented with a rationale in source comments and/or PLAN.md. Per CLAUDE.md ## Conventions → Security → "Out-of-scope for V1 (deferred — document in SECURITY.md accepted-risks per phase if encountered)" — the conventions document is the canonical accepted-risks log.

| Threat ID | Category | Component | Acceptance Rationale (verified) |
|-----------|----------|-----------|--------------------------------|
| T-03-06 | Repudiation | No audit log for sign-up/sign-in events | V1 personal app, no audit-logging requirement. CLAUDE.md ## Conventions → "Out-of-scope for V1" line 194: "Audit logging for admin operations (no admin surface in V1; Supabase logs cover platform layer)". Supabase platform logs cover IdP layer (visible in dashboard → Authentication → Logs — referenced in 03-VERIFICATION.md Issue 3). |
| T-03-14 | Information Disclosure | Sign-up duplicate-email reveals account existence | D-03 documented acceptance: Supabase API exposes `error.code === "user_already_exists"` regardless of UI. `app/app/(auth)/sign-up.tsx:95-102` maps inline under email field consistent with API behavior — UI does NOT add disclosure beyond what the API already provides. Code comment line 8-9 + line 97-98 document the acceptance. NOTE: under email-confirmation-ON regime (UAT gap-1 acceptance), Supabase suppresses these codes via anti-enumeration — the inline error path will only trigger after V1.1 deep-link handler lands. Switch arms remain in code; mitigation intent preserved. |
| T-03-17 | Spoofing | Email-confirm Studio toggle silent breakage | **Original mitigation (Pitfall §6 code comment + manual gate):** verified — `app/app/(auth)/sign-up.tsx:21-26` has the documentary comment block for Pitfall §6, AND lines 71-86 implement a defensive `if (!data.session)` branch that surfaces an info banner ("Vi har skickat ett bekräftelsemail till …") rather than silently leaving the user on the form. **Manual gate FAILED:** Studio toggle is ON in production (UAT 03-VERIFICATION.md frontmatter `studio_confirm_email_toggle: ON`); local config.toml says `enable_confirmations=false` but cannot be pushed without first fixing localhost-only `site_url`. **Revised acceptance:** user explicitly accepted-deferred to V1.1 / Phase 8 on 2026-05-09 (03-UAT.md Gaps gap-1 + 03-VERIFICATION.md Acknowledged Gaps §1). The defensive `if (!data.session)` branch + info banner ensures no silent-breakage UX even with Studio toggle ON — the original threat (silent failure) is actually MITIGATED by code added during execution; the deferral covers the UX completeness gap (deep-link handler), not the security threat. CLOSED with revised acceptance. |
| T-03-19 | Repudiation | Sign-out timing side-channel reveals signed-in state | V1 personal app, single-user; signed-in/signed-out states are not adversarial. `app/lib/auth-store.ts:53` — `console.warn` on signOut error logs only `error.message` (not credentials). Comment header lines 17-21 documents the convention. CLAUDE.md ## Conventions → "Out-of-scope for V1" baseline. |
| T-03-21 | Repudiation | Verification result is unfalsifiable / no audit log | V1 solo developer; user is also the verifier (CLAUDE.md ## Developer Profile). 03-UAT.md is git-committed and serves as the manual audit trail. Plan 04 PLAN.md `<threat_model>` documents the trust-yourself acceptance for V1; multi-tester verification + CI screenshot capture deferred to V1.1+. |
| T-03-22 | Information Disclosure | 03-VERIFICATION.md commits test-account email to git | `.planning/phases/03-auth-persistent-session/03-VERIFICATION.md` line 9 — `test_account_email: not committed (gap-1 acceptance; rotation via Supabase dashboard if needed)`. Real test account email NOT committed; placeholder convention only. Personal user email per CLAUDE.md MEMORY is not used as the Phase 3 test account. Acceptance condition met (no PII committed). |
| T-03-23 | Tampering | User signs off PASS but actual behavior failed | Solo-dev workflow trust-yourself model documented in Plan 04 PLAN.md. UAT 03-UAT.md frontmatter `gaps_status: accepted-deferred` and 03-VERIFICATION.md `status: complete` are the human-attested gate. `/gsd-verify-work` reads frontmatter for the gate decision; no automated re-verification — same trust model as Phase 1+2. |

---

## Threat Verification — `transfer` (1)

| Threat ID | Category | Component | Transfer Mechanism (verified) |
|-----------|----------|-----------|-------------------------------|
| T-03-10 | Spoofing | Brute-force credential stuffing via repeated sign-in submits | **Transferred to Supabase platform rate-limit.** Mechanism verified two ways: (1) client UI maps the platform error — `app/app/(auth)/sign-in.tsx:78-80` and `app/app/(auth)/sign-up.tsx:107-109` map `over_request_rate_limit` / `over_email_send_rate_limit` to user-facing banner "För många försök. Försök igen om en stund." (2) **Empirically validated** during UAT — 03-04-manual-verify-SUMMARY.md "Attempt #2+: hit Supabase free-tier auth rate-limit" + 03-VERIFICATION.md "Edge Cases / Rate-limit case ... was empirically validated during the prior pre-acceptance run." Free-tier limits are documented in 03-VERIFICATION.md (auth API ~30 req/h per IP; email 4/h per project). Client-side rate-limit deferred to V1.1 per CLAUDE.md ## Conventions → "Out-of-scope for V1" line 191 ("WAF / DDoS protection ... app-level rate-limit deferred"). |

---

## Unregistered Flags

None. The four SUMMARY files contain `## Threat Model Coverage` tables (not `## Threat Flags` sections) which map 1:1 to declared threat IDs. No new attack surface was introduced during execution beyond the registered T-03-01..23 set.

---

## Phase-3-specific checklist alignment (CLAUDE.md Phase-specific checklists)

- **API2 / V2 / M3 — Broken authentication:** verified — sessions stored via `LargeSecureStore` (AES blob in AsyncStorage, key in expo-secure-store), never AsyncStorage in plaintext. Service-role key audit gate: `grep -E "service_role|SERVICE_ROLE"` against `app/lib/` and `app/app/` returns ZERO matches.
- **V2.1.1 (passwords ≥12 chars):** verified at `app/lib/schemas/auth.ts:20` (sign-up) — `password: z.string().min(12, ...)`. Sign-in deliberately omits min(12) per D-13 (server is final arbiter; avoids locking out legacy/rotated passwords).
- **V2.1.4 (no field-level disclosure on credential failure):** verified at `app/app/(auth)/sign-in.tsx:66-69` — generic "Fel email eller lösenord" under password field for `invalid_credentials`.
- **V3 (session management):** Supabase JS handles refresh-token rotation (`autoRefreshToken: true` at `app/lib/supabase.ts:76`); `AppState` foreground/background listener at `app/lib/supabase.ts:88-92` starts/stops auto-refresh appropriately (WR-05 disposes listener on Fast Refresh per commit `c8c2acd`).
- **M4 (deep-link anti-phishing):** N/A in V1 — `detectSessionInUrl: false` at `app/lib/supabase.ts:78`. V1.1 deep-link handler is the explicit V1.1 carry-over (see T-03-17 acceptance, ROADMAP Phase 8 F1.1).

---

## Recent fix-commits incorporated into this audit

| Commit | WR ID | Effect on threat coverage |
|--------|-------|---------------------------|
| `f95efee` | WR-02, WR-03 | Splash hideAsync moved to useEffect + preventAutoHideAsync `.catch()` — strengthens T-03-08 mitigation (no native-bridge call inside render). |
| `2e856dd` | WR-04 | Default-branch console.error logs full error shape `{ code, message, status, name }` — strengthens T-03-04 / T-03-11 (still no credential leak; better diagnostic for future unmapped codes). |
| `c8c2acd` | WR-05 | AppState listener disposed on Fast Refresh (`module.hot?.dispose`) — adjacent to T-03-07 (no listener duplication on dev reloads). |
| `88a9b6f` | WR-06 | signOut reordered to call `supabase.auth.signOut()` BEFORE `queryClient.clear()` — strengthens T-03-03 / T-03-16 by closing in-flight-query refetch window (intent preserved; mechanism stronger than original Plan 01 ordering). |

All four reinforcements were code-side hardenings of already-mitigated threats. None introduce new attack surface.

---

## Sign-off

**Phase 3 threat register:** 23/23 closed. **`threats_open: 0`.** Phase advancement is unblocked from a security gate perspective.

**Next gate:** `/gsd-verify-work 3` (or equivalent) to flip Phase 3 to ✓ in ROADMAP + STATE.

**V1.1 carry-over reminder (informational, not a security blocker):**
- T-03-17 V1.1 deep-link handler (auth-callback.tsx + Supabase verifyOtp/exchangeCodeForSession). The defensive `if (!data.session)` branch in sign-up.tsx already prevents silent UX breakage with Studio toggle ON; the V1.1 work is UX completeness (auto-route from confirm-email link), not a security gap.
- Client-side rate-limit (V1.1+) per CLAUDE.md out-of-scope.
- Audit logging (V2 / pre-TestFlight).

*Audited 2026-05-09 by gsd-security-auditor against PLAN files 03-01..04 and implementation as of branch `gsd/phase-03-auth-persistent-session` (HEAD `6a747a1`).*
