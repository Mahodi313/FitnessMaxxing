---
status: complete
phase: 03-auth-persistent-session
source: [03-01-schemas-store-SUMMARY.md, 03-02-root-auth-signin-SUMMARY.md, 03-03-signup-app-group-SUMMARY.md, 03-04-manual-verify-SUMMARY.md]
started: 2026-05-09T15:46:57Z
updated: 2026-05-09T16:30:00Z
gaps_status: accepted-deferred
gaps_target: V1.1 (Phase 8)
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: From `app/`, kill any running Metro/Expo. Run `npx expo start --clear`. Open Expo Go on iPhone and load the project. Metro builds with no red errors. App opens to the sign-in screen ("Logga in" heading, Email field, Lösen field, blue "Logga in" button, "Inget konto? Registrera" link below). No blank flash, no splash flicker, no red error screen.
result: pass

### 2. Sign-Up Creates Account → Routes to (app) (SC#1)
expected: On sign-in screen, tap "Inget konto? Registrera" → sign-up screen renders. Enter a fresh email (e.g., `dev+phase3-20260509@example.local`), password ≥12 chars, matching confirmPassword. Tap "Skapa konto". Within ~2s the screen replaces with the (app) home: "Inloggad som <email>", "FitnessMaxxing" heading, "Plan-skapande kommer i nästa fas." note, and a "Logga ut" button. NO generic banner error ("Något gick fel..."). If a banner DOES appear, capture the Metro log line `[sign-up] unexpected error:` from the terminal where `expo start` is running and report it verbatim — this is the unmapped-error follow-up from the prior partial run.
result: issue
reported: "Yes, but we have email confirmation on. so that message comes then I confirm in email then i sign in"
severity: major

### 3. Sign-In With Valid Credentials (SC#2)
expected: From sign-in screen, type the email used in Test 2 and the same password. Tab/blur the email field with a malformed value first ("not-an-email") → inline red error appears under the field. Fix it. Submit with empty password → inline error "Lösen krävs". Submit with the wrong password → inline error "Fel email eller lösen" under the password field (generic — does NOT distinguish which field is wrong). Submit with correct credentials → screen replaces with (app) home showing "Inloggad som <email>".
result: pass
reported: "Det funkar att logga in men vi har fixat så felhanteringen behandlas efter submit"
note: Validation trigger changed from `mode: "onBlur"` (per 03-02 SUMMARY) to submit-only. Sign-in success path verified; Zod + Supabase error mapping now fire on submit. SUMMARY/UI-SPEC documentation drift — fold into next phase polish if onBlur is desired UX, otherwise update SUMMARY to reflect current behavior.

### 4. Persistent Session Round-Trip (SC#3)
expected: While signed in (from Test 3), fully kill the app — swipe up from app-switcher and dismiss Expo Go. Re-open Expo Go, re-launch the project. App lands DIRECTLY on the (app) home ("Inloggad som <email>") without showing the sign-in screen first, with no visible flash of sign-in. This proves LargeSecureStore round-trip and Stack.Protected staleness handling.
result: pass

### 5. Sign-Out Returns to Sign-In (SC#4)
expected: On (app) home, tap "Logga ut". Within ~1s the screen replaces with the (auth) sign-in screen. The email and password fields are empty. No crash, no banner errors. (TanStack cache is cleared in the same flow — observable later in Phase 4 when per-user data exists; for V1 personal-app there's no cross-user data to leak yet.)
result: pass

### 6. Stack.Protected No-Flicker (SC#5)
expected: During Tests 2/3/4/5 transitions, watch for any momentary flash of the "wrong" group's screen — e.g., a blink of (app) before sign-in finishes loading, or sign-in showing for a frame after a successful sign-in. Expected: no such flickers; transitions are clean splash-→target with no intermediate-frame leak.
result: pass
reported: "yes no flickers"

### 7. Edge Case — Duplicate Email Sign-Up
expected: From sign-in, navigate to sign-up. Enter the SAME email used in Test 2, plus a valid password and matching confirmPassword. Tap "Skapa konto". Inline red error appears under the email field: "Detta email är redan registrerat — försök logga in". No banner; the password fields stay valid.
result: issue
reported: "Jag fick bekräftelse meddelande med samma email så nej det fungerade inte."
severity: major

### 8. Edge Case — Network Failure on Sign-In
expected: Turn iPhone airplane mode ON. From sign-in, enter any valid-shape email and password and tap "Logga in". Within a few seconds a dismissible banner appears at the top of the form: "Något gick fel. Försök igen." (or "För många försök..." if the rate-limit case fires instead). App does NOT crash. Turn airplane mode OFF and retry — sign-in works normally.
result: pass
reported: "Yes, it works and it doesn't crash. I get the error message Något gick fel. But I also get console errors sign in unexpected error netowrk requeswt. failed status AuthRerybleFetchError. Maybe its ok?"
note: Console errors `[sign-in] unexpected error: ... Network request failed ... AuthRetryableFetchError` are intentional diagnostic logging from the `default:` branch in `app/app/(auth)/sign-in.tsx`. AuthRetryableFetchError is Supabase JS's error class for network-layer failures with no `error.code` field, so it falls through to `default:` (correctly maps to the generic banner). Not a defect. Worth considering: add an explicit network/offline branch arm in a future polish pass to suppress the console.error noise and show a more specific copy ("Du verkar vara offline. Kolla din anslutning.") — out-of-scope for current phase.

### 9. Dark Mode — Sign-In Screen
expected: iOS Settings → Display & Brightness → toggle Dark/Light. Return to the app on the sign-in screen. Background flips white ↔ near-black. Heading + label text flips dark-gray ↔ near-white. TextInput backgrounds flip light-gray ↔ dark-gray. The "Logga in" CTA flips blue-600 ↔ blue-500. The "Registrera" link flips blue-600 ↔ blue-400. Status-bar icons (clock/battery) flip with the theme.
result: pass

### 10. Dark Mode — Sign-Up Screen
expected: From sign-in, tap "Registrera". Toggle iOS theme via Settings. Same surfaces as Test 9 flip correctly: bg, headings, all 3 field inputs, CTA, link colors. The "Minst 12 tecken" helper text flips gray-500 ↔ gray-400.
result: pass

### 11. Dark Mode — (app)/index.tsx
expected: While signed in, toggle iOS theme. (app) home flips: bg-white ↔ bg-gray-900, "Inloggad som ..." text flips, "FitnessMaxxing" heading flips, "Logga ut" CTA flips blue-600 ↔ blue-500.
result: pass

## Summary

total: 11
passed: 9
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Sign-up creates account and routes directly to (app) home with email/password (no email confirmation step) per ROADMAP F1 SC#1 + locked decision D-01 (enable_confirmations = false)."
  status: accepted-deferred
  acceptance_decision: "User chose 2026-05-09 to accept the email-confirmation flow as the actual designed behavior for V1; deferred deep-link callback handler to V1.1 (Phase 8). SC#1 reframed in ROADMAP.md to include the confirmation step."
  reason: "User reported: Yes, but we have email confirmation on. so that message comes then I confirm in email then i sign in"
  severity: major
  test: 2
  root_cause: "Supabase Studio dashboard has 'Confirm email' toggle ON despite app/supabase/config.toml:221 declaring enable_confirmations=false. Studio is authoritative for the live project until config.toml is pushed via `supabase config push` (currently blocked because config.toml has localhost site_url + low email rate-limits that would clobber production)."
  artifacts:
    - path: "Supabase Studio → Authentication → email-confirmation toggle (live state)"
      issue: "Studio toggle ON; not aligned with config.toml ground truth"
    - path: "app/supabase/config.toml:154"
      issue: "site_url=http://127.0.0.1:3000 — would clobber production redirect base if config.toml were pushed"
  missing: []
  resolution: "Manual: user toggles 'Confirm email' OFF in Supabase Studio dashboard. Re-run UAT Tests 2 + 7 to verify."
- truth: "Duplicate-email sign-up shows inline error 'Detta email är redan registrerat — försök logga in' under email field (D-03, ROADMAP edge-case)."
  status: accepted-deferred
  acceptance_decision: "User chose 2026-05-09 to accept current behavior. Downstream of gap-1; resolves automatically when email confirmation is OFF or when V1.1 deep-link handler is added. Code path in app/app/(auth)/sign-up.tsx already maps user_already_exists/email_exists — will fire once Supabase stops suppressing them."
  reason: "User reported: Jag fick bekräftelse meddelande med samma email så nej det fungerade inte."
  severity: major
  test: 7
  root_cause: "Downstream of gap-1: with email confirmation ON, Supabase's anti-enumeration policy suppresses user_already_exists/email_exists error codes for unconfirmed signups and silently resends the confirmation email instead. Once enable_confirmations is OFF, the duplicate-email error code will fire and the existing switch arm in app/app/(auth)/sign-up.tsx (user_already_exists | email_exists) will map it inline."
  artifacts: []
  missing: []
  resolution: "Same as gap-1 — flipping Studio toggle should auto-resolve. Re-run UAT Test 7 to verify."
  related_to: "test 2 — same root cause"
