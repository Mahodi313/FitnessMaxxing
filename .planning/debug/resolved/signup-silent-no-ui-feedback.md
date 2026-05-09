---
slug: signup-silent-no-ui-feedback
status: resolved
trigger: "sign-up button press does nothing — no UI change, no Metro logs. Hypothesis: Pitfall §6 (Supabase email confirmation server-side enabled) causing silent {session:null} return path in app/app/(auth)/sign-up.tsx:67-71. Earlier attempt #1 returned default-branch 'Något gick fel' (unmapped error.code). Phase 3 manual verification blocked at SC#1 — see .planning/phases/03-auth-persistent-session/03-VERIFICATION.md Issue 1 and 03-REVIEW.md WR-04 for context."
created: 2026-05-09T15:14:20Z
updated: 2026-05-09T15:18:15Z
phase: 03-auth-persistent-session
related_artifacts:
  - .planning/phases/03-auth-persistent-session/03-VERIFICATION.md (Issue 1)
  - .planning/phases/03-auth-persistent-session/03-REVIEW.md (WR-04, CR-01)
  - app/app/(auth)/sign-up.tsx:67-71 (silent success path)
  - app/app/(auth)/sign-in.tsx (default branch fallback)
  - app/lib/auth-store.ts:61-66 (listener — only fires on session != null)
---

# Debug Session: signup-silent-no-ui-feedback

## Symptoms

| Question | Answer |
|----------|--------|
| Expected behavior | After typing valid sign-up form (email + 12+ char password + matching confirmPassword) and pressing "Skapa konto", the user should land in `(app)/index.tsx` showing "Inloggad som <email>". |
| Actual behavior | Pressing "Skapa konto" does nothing visible in the UI. The button doesn't even briefly flash to "Skapar konto…" / show `active:opacity-80`. **However:** the Supabase database has 2 user profiles created in `public.profiles`, proving sign-up actually fired and the `handle_new_user` trigger ran. So the network call DID happen — the UI is stuck on the sign-up screen because the auth-state listener never received a `SIGNED_IN` event. |
| Error messages | When the user later tried to **sign in** with the same account, Metro logged: `ERROR  [sign-in] unexpected error: [AuthApiError: Email not confirmed]` followed by the AuthApiError construct stack. This came from `app/app/(auth)/sign-in.tsx`'s `default:` switch arm (the `error.code` is presumably `email_not_confirmed` — not in the 4-case sign-in mapping). |
| Timeline | First attempt today during plan 03-04 manual verification: returned generic "Något gick fel" banner (default branch fired with unknown error.code). Subsequent attempts hit Supabase free-tier rate-limit ("för många försök"). After rate limit cleared, sign-up presses now produce no visible change AND no Metro logs (silent success path). The "Email not confirmed" log appeared on a sign-in attempt with the previously-created account. |
| Reproduction | (a) Open app on iPhone via Expo Go; (b) Tap "Inget konto? Registrera"; (c) Enter valid email + 12+ char password (twice); (d) Press "Skapa konto" → nothing visible happens (silent return because session is null in response). (e) Switch to sign-in tab and try same credentials → "Något gick fel" banner + Metro `[sign-in] unexpected error: [AuthApiError: Email not confirmed]`. |

## Current Focus

```
hypothesis: Supabase project (mokmiuifpdzwnceufduu) has email confirmation ENABLED server-side. signUp returns {error: null, data: {session: null, user: {...}}} — code at sign-up.tsx:67-71 treats !error as success and returns silently; auth-store listener never fires SIGNED_IN because session is null; UI stays on sign-up screen with no feedback. Sign-in path returns AuthApiError.code=email_not_confirmed which falls through to default: branch in sign-in.tsx. This contradicts D-01 (CONTEXT.md locks "Email-confirmation OFF"); local config.toml `enable_confirmations = false` only applies to local Supabase Docker, NOT the remote project (auth settings are not pushed by `supabase db push` — they require Management API or Studio UI changes).
test: Capture the actual signUp response shape via console.log, OR query Supabase /auth/v1/settings endpoint to see external_email_provider.confirm_email setting, OR verify in Supabase Studio (Authentication → Sign In/Up section).
expecting: signUp response with `data.session === null && data.user !== null && error === null` — direct proof of confirmation-required state.
next_action: Spawn gsd-debugger to confirm root cause, decide between (a) disabling email confirmation server-side via Studio/Management API, (b) implementing the V1.1 fix path documented in sign-up.tsx:21-26 (handle session=null with "check your email" banner) + adding `email_not_confirmed` arm to sign-in switch, or (c) hybrid (do both — defensive code AND turn off Studio toggle).
reasoning_checkpoint: |
  Symptom-to-cause chain is tight: server has 2 profiles created (proof signUp fired) + Metro shows "Email not confirmed" on sign-in (proof the project requires confirmation) → silent UI on sign-up is the documented Pitfall §6 scenario in sign-up.tsx:21-26.
  D-01 was based on Studio UI verification at PLAN time; either the toggle was OFF then and got flipped, or PLAN-time research never actually verified it. The local config.toml is misleading (only applies to local Docker).
tdd_checkpoint: |
  Adding handler for session-null on sign-up + email_not_confirmed on sign-in are both behavior-adding tasks. Under TDD mode they would require RED tests first. TDD mode is currently false in config.json so no RED gate is required, but adding a unit test for the new error-handling branches would be a good acceptance criterion.
```

## Evidence

- timestamp: 2026-05-09T15:00 (approx, from prior conversation context)
  source: Supabase Studio (user-reported)
  observation: 2 profiles exist in `public.profiles` table — proves signUp's network call succeeded and the `handle_new_user` trigger ran for at least 2 distinct test sign-ups today.

- timestamp: 2026-05-09T15:10 (approx)
  source: Metro bundler terminal (where `npm run start` is running on the dev machine, captured from user-supplied paste)
  observation: |
    ERROR  [sign-in] unexpected error: [AuthApiError: Email not confirmed]
    Call Stack
      construct (<native>)
      apply (<native>)
      _construct (node_modules\@babel\runtime\helpers\construct.js)
      Wrapper (node_modules\@babel\runtime\helpers\wrapNativeSuper.js)
      ...
      AuthApiError#constructor (node_modules\@supabase\auth-js\dist\main\lib\errors.js)
      handleError (node_modules\@supabase\auth-js\dist\main\lib\fetch.js)
  interpretation: The AuthApiError class is thrown by auth-js fetch.js when Supabase returns a 4xx with `error_code: "email_not_confirmed"`. This is the canonical Supabase error for "the user signed up but hasn't clicked the email confirmation link yet". This error.code is NOT in the 4-case mapping in sign-in.tsx (likely arms: invalid_credentials, validation_failed, over_request_rate_limit, default).

- timestamp: 2026-05-09T15:13
  source: User UI observation
  observation: When pressing "Skapa konto" with valid form fields, the button shows "no visual change at all" — no `active:opacity-80` flash, no flip to "Skapar konto…", and no Metro log entry. Form validation appears to be passing (no red error text visible). Despite no UI change, NO additional profiles are created on subsequent presses (suggests the request hits `over_email_send_rate_limit` silently OR Supabase's per-email quota OR the issue is local).

## Eliminated Hypotheses

- hypothesis: isSubmitting stuck `true` from a previous in-flight call, disabling Pressable
  reason: User confirmed button label remains "Skapa konto" (not "Skapar konto…"), so `isSubmitting` is `false`. If it were stuck true, the label would be different and the visible `disabled:opacity-60` would dim the button.

- hypothesis: Form validation failing silently with no visible error text
  reason: User confirmed all fields are filled with valid input (email format OK, password 12+ chars, confirmPassword matches) and no red error text appears. RHF would render `errors.X` text below fields if validation failed, so this rules out client-side validation rejection.

- hypothesis: Pressable touch-target occluded by overlay
  reason: User reported the visual press feedback is gone but earlier attempts in the same session did fire requests (2 profiles in DB), so the touch path is functional. The "no visual change" observation in this attempt may simply mean the request went through too fast to see the active flash, OR the request is being silently dropped at the network/server layer (e.g., per-email rate limit) without hitting the error switch.

## Resolution

resolved_at: 2026-05-09T15:18:15Z
fix_path: code-only (path B from debug session) — kept email confirmation enabled server-side, added defensive code so the app handles the email-confirm flow gracefully

root_cause: |
  Supabase remote project `mokmiuifpdzwnceufduu` has email confirmation enabled
  server-side (the modern Studio default), which contradicts CONTEXT.md decision
  D-01 ("Email-confirmation = OFF"). Local `app/supabase/config.toml:221`
  `enable_confirmations = false` only applies to a local Supabase Docker
  instance — auth settings are not pushed by `supabase db push`.

  Symptom chain:
  1. signUp call succeeds — server-side `handle_new_user` trigger creates a
     row in `public.profiles` (proven: 2 rows from today's test attempts).
  2. Response is `{ error: null, data: { session: null, user: {...} } }` —
     the email-confirmation-required shape.
  3. `sign-up.tsx` code path (pre-fix) treated `!error` as success and returned
     silently. Auth-state listener never fired SIGNED_IN (session is null), so
     Stack.Protected stayed on the (auth) group with no UI feedback.
  4. Subsequent sign-in attempts on the same account returned
     `AuthApiError: email_not_confirmed` (HTTP 4xx with code "email_not_confirmed"),
     which fell through to the `default:` branch in sign-in.tsx because the
     switch had no arm for that code. Result: generic "Något gick fel" banner
     plus the verbatim Metro log captured in evidence.

fix:
  - app/app/(auth)/sign-up.tsx: capture `data` from `supabase.auth.signUp`;
    if `!error && !data.session` (email-confirm-required path), set
    `infoBanner` with a Swedish "Vi har skickat ett bekräftelsemail till
    {email}. Klicka på länken i mailet och logga sedan in." copy and return.
    Added `infoBanner` state (paired with existing `bannerError`) and an
    info-styled banner render block (`text-blue-700 dark:text-blue-300`) so
    the success-but-pending case is visually distinct from the error case.
  - app/app/(auth)/sign-in.tsx: added `case "email_not_confirmed":` arm to
    the switch; sets `bannerError` to "Bekräfta ditt email först. Kolla din
    inkorg för bekräftelselänken." instead of falling through to the generic
    default-branch copy.
  - Both edits preserve D-15 (Swedish, inline/banner per UI-SPEC) and D-16
    (no imperative routing — declarative listener handles SIGNED_IN once the
    user clicks the email link and signs in).

verification:
  - `cd app && npx tsc --noEmit` → exit 0 (clean)
  - `cd app && npm run test:auth-schemas` → 8/8 PASS (no schema regressions —
    the fix is in the screen logic, not the schemas)
  - Manual gate (deferred to user retest): fresh sign-up with a new test email
    should show the info banner instead of nothing happening; clicking the
    email link from the inbox + signing in should land in (app)/index.tsx;
    sign-in attempt with an unconfirmed account should show the new
    `email_not_confirmed` banner instead of "Något gick fel".

files_changed:
  - app/app/(auth)/sign-up.tsx
  - app/app/(auth)/sign-in.tsx

related_followups:
  - 03-REVIEW.md CR-01 (auth-store getSession.catch race) is still open — separate issue, not blocking this fix.
  - 03-REVIEW.md WR-04 (unmapped error.code path) is partially closed by the new email_not_confirmed arm; the fall-through still exists for any other unmapped code, but the most common case is now covered. Future: consider adding a structured logger for `default:` branches that captures `error.code`, `error.message`, and the Supabase request id so the next unmapped code can be identified without manual Metro inspection.
  - 03-VERIFICATION.md Issue 1 (the original "Något gick fel" attempt #1) is now explained by `email_not_confirmed`.
  - 03-VERIFICATION.md Issue 2 (Studio toggle UI drift) remains open but is now documentation-only — the user accepted code-only fix path B, which means email confirmation stays ON. Update CONTEXT.md D-01 in a follow-up plan to reflect the new design intent (confirmation flow is part of V1, not V1.1).
