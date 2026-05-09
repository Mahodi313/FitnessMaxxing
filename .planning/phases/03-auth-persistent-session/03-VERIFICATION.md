---
phase: 3
slug: auth-persistent-session
status: pending
verified_at: 2026-05-09T13:18:04Z
verified_by: user (manual iPhone verification via Expo Go) — partial run, deferred
ios_version: not recorded
expo_go_version: not recorded
test_account_email: not yet committed (rate-limit blocked first attempt)
studio_confirm_email_toggle: not-found-in-current-studio-ui
nyquist_compliant: true
---

# Phase 3 — Manual Verification Record

> Single-source record of the manual iPhone verification of Phase 3 (Auth & Persistent Session).
> Status: **PENDING** — pre-flight automated gates all PASS; iPhone manual run started but blocked by Supabase rate limit on attempt #2 after attempt #1 hit an unmapped error code. Deferred to a later `/gsd-verify-work 3` session.

---

## Pre-Flight Automated Checks

| Gate | Command | Result |
|------|---------|--------|
| TypeScript | `cd app && npx tsc --noEmit` | PASS (exit 0) |
| Schema unit tests | `cd app && npm run test:auth-schemas` | PASS (8/8) |
| Phase 2 RLS regression | `cd app && npm run test:rls` | PASS (all assertions) |
| Lint | `cd app && npm run lint` | PASS (exit 0, no findings) |
| Expo doctor | `cd app && npx expo-doctor` | PASS (17/17 checks) |
| Security audit (no service_role leak) | grep across 9 Phase 3 files | PASS (zero matches) |
| Module-scope listener count | `grep -c onAuthStateChange app/lib/auth-store.ts` | PASS (returns 1) |
| Phase 1 smoke-test deleted | `test ! -f app/app/index.tsx` | PASS (deleted in Plan 03) |

All gates: **PASS** — code is safe to manually verify; the manual block is environmental (Supabase rate-limit), not code-quality.

---

## Studio Configuration Verification

| Item | Expected | Actual | Notes |
|------|----------|--------|-------|
| Authentication → Email → "Confirm email" toggle | OFF (per CONTEXT.md D-01) | not-found-in-current-studio-ui | User reported no toggle visible in modern Supabase Studio UI (May 2026). `app/supabase/config.toml:221` has `enable_confirmations = false` for the email provider. Empirical sign-up behavior should confirm whether email confirmation is server-side disabled. |

---

## ROADMAP F1 Success Criteria

| # | Criterion | Test Type | Result | Notes |
|---|-----------|-----------|--------|-------|
| 1 | Användare kan registrera nytt konto med email + lösen från `(auth)/sign-up.tsx` och hamnar inloggad i `(app)`-gruppen | Manual iPhone | PENDING | First sign-up attempt returned the generic `default:` branch error ("Något gick fel. Försök igen"), meaning `error.code` did not match any of the 7 mapped codes. Subsequent retries hit Supabase rate-limit (`over_request_rate_limit` or `over_email_send_rate_limit` → "för många försök"). Need to (a) wait for rate limit to reset (~1 hour rolling window), (b) capture the Metro log entry `[sign-up] unexpected error: <details>` from sign-up.tsx:100, (c) retry. |
| 2 | Användare kan logga in från `(auth)/sign-in.tsx`; fel-validering via Zod visar fältfel inline (RHF + Zod 4) | Manual iPhone | NOT TESTED | Blocked by SC#1 — could not create test account. |
| 3 | Sign-in → kill app → reopen → session är återställd och användaren ser `(app)`-gruppen direkt (LargeSecureStore round-trip funkar) | Manual iPhone | NOT TESTED | Blocked by SC#1. |
| 4 | Sign-out tar användaren tillbaka till `(auth)/sign-in.tsx` och `queryClient.clear()` körs (per-user cache rensad) | Manual iPhone | NOT TESTED | Blocked by SC#1. |
| 5 | `Stack.Protected guard={!!session}` i root + `<Redirect>` i `(app)/_layout.tsx` hindrar protected screens från att flicker-rendera när session saknas | Manual iPhone | NOT TESTED | Blocked by SC#1. |

---

## Edge Cases

| Edge Case | Expected | Result | Notes |
|-----------|----------|--------|-------|
| Duplicate email signup | Inline error under email: "Detta email är redan registrerat — försök logga in" | NOT TESTED | Blocked by SC#1. |
| Network failure on sign-in | Banner above form: "Något gick fel. Försök igen." (no crash) | NOT TESTED | Blocked by SC#1. |

**Observed during attempted SC#1:** the rate-limit case fired correctly ("För många försök. Försök igen om en stund.") which empirically validates the `over_request_rate_limit` / `over_email_send_rate_limit` switch arms in `sign-up.tsx:87-90`.

---

## Dark Mode (F15 Convention)

| Surface | Light mode | Dark mode | Result |
|---------|-----------|-----------|--------|
| `(auth)/sign-in.tsx` | bg-white + body text-gray-900 | bg-gray-900 + body text-gray-50 | NOT TESTED |
| `(auth)/sign-up.tsx` | bg-white + helper text-gray-500 | bg-gray-900 + helper text-gray-400 | NOT TESTED |
| `(app)/index.tsx` | bg-white + CTA bg-blue-600 | bg-gray-900 + CTA bg-blue-500 | NOT TESTED |

Status-bar contrast (StatusBar style="auto" handles): NOT TESTED

---

## Test Account Convention (researcher Q5)

| Field | Value |
|-------|-------|
| Email | not yet committed (rate-limit blocked first sign-up; choose convention before retry, e.g., `dev+phase3-20260509@example.local`) |
| Created at | — |
| Purpose | Phase 3 manual-test account — sign-up flow + persistent session round-trip + sign-out + duplicate-email negative path |
| Future runs | TBD after first successful sign-up |

---

## Issues to Investigate Before Re-Verification

### Issue 1: Unmapped sign-up error on attempt #1

**Symptom:** First sign-up attempt returned the generic `default:` branch fallback ("Något gick fel. Försök igen.") instead of any of the 7 mapped Supabase auth error codes.

**Code path:** `app/app/(auth)/sign-up.tsx:74-101` — the `switch (error.code)` block falls through to `default:` when `error.code` is undefined or doesn't match `user_already_exists | email_exists | weak_password | over_request_rate_limit | over_email_send_rate_limit | signup_disabled | validation_failed`.

**Diagnostic capture path:** the `default:` branch logs `console.error("[sign-up] unexpected error:", error)` to the Metro bundler terminal (where `npm run start` is running). On retry, capture this log line — it reveals the actual `error.code` (or `error.message` if no code) and the AuthApiError shape.

**Likely candidates for the unmapped code (to add as explicit cases if confirmed):**
- `unexpected_failure` — generic Supabase server-side failure
- `network` / `fetch_error` — transport-level (no `error.code` set)
- A new code added by Supabase JS that wasn't in the verified May 2026 error-codes.ts list (RESEARCH.md §E)
- An iPhone-specific cert/proxy issue if testing over a corporate network

**Recommended remediation:** open a `/gsd-debug` session OR a Phase 3 gap-closure plan to (a) reproduce the failure with logging, (b) add an explicit case (or improved default copy) for the actual code, (c) add a Zod schema test for the new branch.

### Issue 2: Modern Supabase Studio UI does not expose the "Confirm email" toggle in the location documented in PLAN.md (Authentication → Providers → Email)

**Symptom:** User reported "There is no flag to turn it on / off" when checking the toggle.

**Likely cause:** Supabase Studio UI evolved between research time and verification time. The setting may have been (a) removed from UI in favor of `config.toml` only, (b) relocated to Authentication → Sign In/Up or Authentication → URL Configuration, or (c) renamed (e.g., "Email confirmations" or "Verify email").

**Code-side ground truth:** `app/supabase/config.toml:221` declares `enable_confirmations = false` for the email provider. If the local config has been pushed to the remote project (`supabase db push` or equivalent), email confirmation is disabled server-side regardless of UI visibility.

**Recommended remediation:** verify empirically — when sign-up succeeds in a future verification run, the response either contains a session (confirmation OFF) or returns `{session: null, user: {...}}` and the user gets stuck (confirmation ON). The Pitfall §6 V1.1 plan (in sign-up.tsx:21-26) already documents the fix path if confirmation is later flipped on.

### Issue 3: Rate-limit recovery time

**How to know when rate limit clears:**
1. Wait ~60 min (rolling window from earliest rate-limited attempt).
2. Or check Supabase dashboard → **Authentication → Logs** — when new entries no longer show `rate_limit_exceeded`, you're clear.
3. Or empirically retry: a non-rate-limit error means the limit cleared.

**Free-tier limits relevant here:**
- Auth API (sign-up): ~30 requests/hour per IP
- Email sending (built-in SMTP): 4 emails/hour per project

---

## Threats Audit Hand-Off

The following threat IDs from PLAN.md `<threat_model>` blocks have NOT YET been manually verified — pending re-run:

- **T-03-08** (splash hide before status flip): pending SC#3 + SC#5
- **T-03-09** (sign-in error reveals which field is wrong): pending SC#2
- **T-03-14** (sign-up duplicate-email disclosure — accepted): pending edge-case test
- **T-03-16** (TanStack Query cache leak — partial): pending SC#4 (full verification deferred to Phase 4)
- **T-03-17** (email-confirm Studio toggle): see Issue 2 above; partial — config.toml ground truth confirms `enable_confirmations = false` but Studio UI verification pending
- **T-03-18** (Stack.Protected staleness): pending SC#5

`/gsd-secure-phase 3` should NOT be run until manual verification completes — it depends on T-03-* manual confirmation.

---

## Sign-Off

- [ ] All 5 ROADMAP F1 success criteria PASS
- [ ] Studio "Confirm email" toggle confirmed OFF (UI not found; config.toml ground truth says false)
- [ ] Dark mode verified for all 3 Phase 3 screens
- [ ] Edge cases (duplicate email, network failure) PASS
- [x] No service-role leak (grep audit PASS)
- [x] Module-scope listener registered exactly once

**Phase 3 verification status:** **pending** — pre-flight automated gates 8/8 PASS; iPhone manual run deferred due to Supabase rate-limit on attempt #2 + unmapped sign-up error on attempt #1.

**Next steps:**
1. **Wait ~60 min** for the Supabase rate-limit window to clear.
2. **Capture Metro log** on the next sign-up attempt — the `[sign-up] unexpected error:` console output reveals the actual `error.code` so the unmapped path can be addressed in a follow-up plan.
3. **Re-run manual verification** via `/gsd-verify-work 3` (or re-run plan 03-04 directly). Update this file in place with the per-criterion results once the iPhone test completes.
4. **If the unmapped error is reproducible** after rate-limit clears, open `/gsd-debug` to root-cause it OR plan a Phase 3 gap-closure plan to add the missing error.code case to `sign-up.tsx`.
5. **Once `status: complete`**: run `/gsd-secure-phase 3` to audit threat register, then `/gsd-verify-work 3` to flip phase to ✓ in ROADMAP + STATE.

---

*Phase 3 manual verification (initial run): 2026-05-09T13:18:04Z*
*Tester: user via Expo Go on iPhone — partial / blocked by environmental rate-limit*
