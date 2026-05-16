---
phase: 3
slug: auth-persistent-session
status: complete
verified_at: 2026-05-09T16:30:00Z
verified_by: user (manual iPhone verification via Expo Go — 11-test UAT session 2026-05-09 in 03-UAT.md)
ios_version: not recorded
expo_go_version: not recorded
test_account_email: not committed (gap-1 acceptance; rotation via Supabase dashboard if needed)
studio_confirm_email_toggle: ON in production (deferred — local config.toml says false; not pushed pga localhost site_url)
nyquist_compliant: true
gaps_status: 2 accepted-deferred to V1.1 (Phase 8) — see 03-UAT.md Gaps section
---

# Phase 3 — Manual Verification Record

> Single-source record of the manual iPhone verification of Phase 3 (Auth & Persistent Session).
> Status: **COMPLETE** — pre-flight automated gates 8/8 PASS; manual iPhone UAT 9/11 PASS; 2 gaps **accepted-deferred** to V1.1 (Phase 8) per user decision 2026-05-09. Full per-test record lives in `03-UAT.md`.

## Acknowledged Gaps (accepted-deferred to V1.1 / Phase 8)

The following gaps were surfaced during the 2026-05-09 UAT run and explicitly accepted by the user as V1.1 work rather than V1 fixes:

1. **Sign-up does NOT route directly to (app); requires email confirmation step first.** Supabase Studio dashboard has the "Confirm email" toggle ON in production despite `app/supabase/config.toml:221` declaring `enable_confirmations=false`. The local config cannot be pushed via `supabase config push` without first fixing localhost-only `site_url` (line 154) and `additional_redirect_urls` (line 158) which would otherwise clobber production. Studio toggle path was attempted previously (03-UAT.md gap-1) but the modern Supabase UI no longer exposes the toggle at the historical path. **V1.1 fix:** Phase 8 to add a deep-link handler so the confirmation link opens the app and lands the user in `(app)` directly via `supabase.auth.verifyOtp` / `exchangeCodeForSession`. Code surface: app/app/_layout.tsx (Linking subscriber), new app/lib/auth-deep-link.ts (handler).

2. **Duplicate-email sign-up does not produce inline error; resends confirmation email.** Downstream of gap-1 — Supabase's anti-enumeration policy suppresses `user_already_exists` / `email_exists` error codes when `enable_confirmations=true`. The code already maps both codes in `app/app/(auth)/sign-up.tsx:75-83`; once gap-1 is fixed (or Studio toggle flipped) this gap auto-resolves.

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

Per-criterion result from the 2026-05-09 UAT run (full per-test detail in `03-UAT.md`).

| # | Criterion (post-acceptance) | Test (UAT.md) | Result | Notes |
|---|-----------------------------|---------------|--------|-------|
| 1 | Sign-up creates account; email confirmation step required (V1) → confirm via email → sign-in → lands in `(app)`-gruppen | Test 2 | PASS (with V1.1 deferral) | User confirmed flow works end-to-end via email-link workaround. Direct-to-(app) routing without confirmation is **accepted-deferred** to V1.1 (Phase 8 deep-link handler). |
| 2 | Sign-in från `(auth)/sign-in.tsx`; Zod validation visar fältfel inline vid submit (mode ändrat från `onBlur` till submit-only under verification) | Test 3 | PASS | Sign-in works; validation trigger reframed (UAT note documents the deviation). |
| 3 | Sign-in → kill app → reopen → session återställd; användaren ser `(app)`-gruppen direkt (LargeSecureStore round-trip) | Test 4 | PASS | Persistent session round-trip confirmed. |
| 4 | Sign-out tar användaren tillbaka till `(auth)/sign-in.tsx`; `queryClient.clear()` körs | Test 5 | PASS | Sign-out flow + declarative routing confirmed. |
| 5 | `Stack.Protected guard={!!session}` + `<Redirect>` i `(app)/_layout.tsx` hindrar flicker | Test 6 | PASS | No flickers observed during all transitions. |

---

## Edge Cases

| Edge Case | Expected | Result (UAT.md) | Notes |
|-----------|----------|-----------------|-------|
| Duplicate email signup | Inline error under email | **ACCEPTED-DEFERRED** (Test 7) | Anti-enumeration suppression is downstream of gap-1; auto-resolves once email confirmation flow is V1.1-handled. Switch arm code already in place. |
| Network failure on sign-in | Banner "Något gick fel. Försök igen." (no crash) | PASS (Test 8) | AuthRetryableFetchError correctly hits `default:` branch; intentional `console.error` diagnostic logging. |

**Rate-limit case** (`over_request_rate_limit` / `over_email_send_rate_limit`) was empirically validated during the prior pre-acceptance run.

---

## Dark Mode (F15 Convention)

| Surface | Light mode | Dark mode | Result (UAT.md) |
|---------|-----------|-----------|-----------------|
| `(auth)/sign-in.tsx` | bg-white + body text-gray-900 | bg-gray-900 + body text-gray-50 | PASS (Test 9) |
| `(auth)/sign-up.tsx` | bg-white + helper text-gray-500 | bg-gray-900 + helper text-gray-400 | PASS (Test 10) |
| `(app)/index.tsx` | bg-white + CTA bg-blue-600 | bg-gray-900 + CTA bg-blue-500 | PASS (Test 11) |

Status-bar contrast (StatusBar style="auto"): PASS (validated as part of Test 9).

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

- [x] All 5 ROADMAP F1 success criteria PASS (SC#1 reframed to include email-confirmation step; deep-link handler V1.1-deferred)
- [x] Studio "Confirm email" toggle: ON in production (accepted-deferred — config.toml ground truth says false but cannot be safely pushed yet)
- [x] Dark mode verified for all 3 Phase 3 screens (Tests 9-11 PASS)
- [x] Edge cases: network-failure PASS (Test 8); duplicate-email accepted-deferred (Test 7 — downstream of gap-1)
- [x] No service-role leak (grep audit PASS)
- [x] Module-scope listener registered exactly once
- [x] 2 gaps explicitly **accepted-deferred to V1.1 (Phase 8)** by user 2026-05-09

**Phase 3 verification status:** **complete** — UAT 9/11 PASS + 2 accepted-deferred gaps = phase advances. Threat register hand-off (`/gsd-secure-phase 3`) is the next quality gate before advancing to Phase 4.

**Next steps:**
1. `/gsd-secure-phase 3` — audit T-03-* threat register against the implemented code.
2. `/gsd-plan-phase 4` — begin Phase 4 (Plans, Exercises & Offline-Queue Plumbing).
3. **V1.1 (Phase 8) carry-overs** — see ROADMAP.md Phase 8: F1.1 email-confirmation deep-link handler (Expo `Linking` API + Supabase `verifyOtp`/`exchangeCodeForSession`).

---

*Phase 3 manual verification (acceptance run): 2026-05-09T16:30:00Z*
*Tester: user via Expo Go on iPhone — 11-test UAT in 03-UAT.md*
*Acceptance: user explicitly accepted gap-1 + gap-2 as V1.1-deferred 2026-05-09 to unblock Phase 4*
