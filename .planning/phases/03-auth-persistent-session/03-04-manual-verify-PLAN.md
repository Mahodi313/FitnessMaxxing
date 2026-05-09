---
phase: 03-auth-persistent-session
plan: 04
type: execute
wave: 4
depends_on: ["03-01", "03-02", "03-03"]
files_modified:
  - .planning/phases/03-auth-persistent-session/03-VERIFICATION.md
autonomous: false
requirements: [F1]
tags: [verification, manual, iphone, expo-go, success-criteria]

must_haves:
  truths:
    - "All 5 ROADMAP F1 success criteria pass manual iPhone verification on Expo Go"
    - "Verification record is written to 03-VERIFICATION.md with timestamp + iOS version + Expo Go version + tester (user) confirmation per criterion"
    - "Studio 'Confirm email' toggle has been verified OFF before sign-up test (Pitfall §6 mitigation)"
    - "Sign-up duplicate-email + sign-in invalid-credentials inline-error UX has been visually confirmed"
    - "LargeSecureStore round-trip (sign-in → kill app → reopen → land directly in (app)) confirmed"
    - "Sign-out → queryClient.clear runs (verified via behavior — re-sign-in shows clean state)"
    - "Cold-start flicker check passed (no white flash between native splash and either (auth) or (app))"
    - "Light + dark mode rendering verified for all 3 Phase 3 screens"
  artifacts:
    - path: ".planning/phases/03-auth-persistent-session/03-VERIFICATION.md"
      provides: "Verification record with per-criterion PASS/FAIL + screenshots/notes; signed off by the user"
      contains: "Success Criterion #1"
      contains_also: "Success Criterion #5"
      min_lines: 80
  key_links:
    - from: "03-VERIFICATION.md"
      to: "ROADMAP.md Phase 3 Success Criteria"
      via: "1:1 mapping criterion → manual test → result"
      pattern: "Success Criterion #"
    - from: "03-VERIFICATION.md"
      to: "03-VALIDATION.md Manual-Only Verifications table"
      via: "follows the same checklist structure"
      pattern: "Manual-Only Verifications"
---

<objective>
Close Phase 3 by exercising all 5 ROADMAP success criteria for F1 on a real iPhone via Expo Go. Phase 3 has NO automated UI/integration test framework (consistent with Phase 1+2 conventions); the kill-and-reopen success criterion (#3) cannot be reproduced by any JS test runner. This plan is the contractual manual-verification gate.

Purpose: Plans 01-03 ship the code; this plan proves it works. The user (single developer per CLAUDE.md ## Developer Profile / Solo Developer + Claude Workflow) is the human verifier — they run the steps on their iPhone and record the result. After this plan, `/gsd-secure-phase 3` audits the threat register and `/gsd-verify-work 3` flips the phase to complete in STATE.md + ROADMAP.md.

Output: A signed `03-VERIFICATION.md` with PASS/FAIL + notes per criterion + Studio-toggle confirmation + dark-mode confirmation. Records the Phase 3 manual-test email convention (researcher Q5) so future runs know which account to use.
</objective>

<execution_context>
@C:/Users/Mahod/Desktop/Projects/FitnessMaxxing/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Mahod/Desktop/Projects/FitnessMaxxing/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/03-auth-persistent-session/03-CONTEXT.md
@.planning/phases/03-auth-persistent-session/03-RESEARCH.md
@.planning/phases/03-auth-persistent-session/03-VALIDATION.md
@.planning/phases/03-auth-persistent-session/03-UI-SPEC.md
@.planning/phases/03-auth-persistent-session/03-01-SUMMARY.md
@.planning/phases/03-auth-persistent-session/03-02-SUMMARY.md
@.planning/phases/03-auth-persistent-session/03-03-SUMMARY.md
@CLAUDE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Pre-flight automated checks before manual verification</name>
  <files>(no files modified — verification commands only)</files>
  <read_first>
    - .planning/phases/03-auth-persistent-session/03-01-SUMMARY.md (Plan 01 completion record)
    - .planning/phases/03-auth-persistent-session/03-02-SUMMARY.md (Plan 02 completion record)
    - .planning/phases/03-auth-persistent-session/03-03-SUMMARY.md (Plan 03 completion record)
    - .planning/phases/03-auth-persistent-session/03-RESEARCH.md "Validation Architecture" → "Sampling Rate" → "Per wave merge"
  </read_first>
  <action>
Run all automated gates from `app/` cwd. If any fails, STOP — manual verification is wasted on broken code. Report failures and re-route to the relevant plan for fix.

Commands to run sequentially (in order, stop on first failure):

```bash
cd app

# Gate 1: TypeScript clean
npx tsc --noEmit
echo "TSC exit: $?"

# Gate 2: Schema unit tests pass (Plan 01)
npm run test:auth-schemas
echo "Schema tests exit: $?"

# Gate 3: Phase 2 RLS regression intact
npm run test:rls
echo "RLS tests exit: $?"

# Gate 4: Lint clean (eslint-config-expo)
npm run lint
echo "Lint exit: $?"

# Gate 5: Expo doctor — no native-version drift
npx expo-doctor
echo "Doctor exit: $?"

# Gate 6: Security audit — no service_role leak in Phase 3 files
grep -rE "service_role|SERVICE_ROLE" app/lib/auth-store.ts app/lib/schemas/auth.ts app/scripts/test-auth-schemas.ts app/app/\(auth\)/_layout.tsx app/app/\(auth\)/sign-in.tsx app/app/\(auth\)/sign-up.tsx app/app/\(app\)/_layout.tsx app/app/\(app\)/index.tsx app/app/_layout.tsx 2>/dev/null
echo "Security audit exit: $? (1 = no matches = pass; 0 = matches = FAIL)"

# Gate 7: Module-scope listener registered exactly once
grep -c "supabase.auth.onAuthStateChange(" app/lib/auth-store.ts
# expect: 1

# Gate 8: Phase 1 smoke-test file deleted
test ! -f app/app/index.tsx
echo "Smoke-test deleted exit: $? (0 = deleted = pass)"
```

If all gates pass (TSC=0, schema=0, rls=0, lint=0, doctor=0, security audit returns "exit: 1" meaning grep found nothing, listener count=1, smoke-test test exits 0), proceed to Task 2 (manual verification on iPhone).

If ANY gate fails: do NOT proceed. Note the failure in 03-VERIFICATION.md as "BLOCKED: pre-flight failure on gate N — see Plan 0X for fix" and exit. The user must re-run the relevant plan before this plan can complete.
  </action>
  <verify>
    <automated>cd app &amp;&amp; npx tsc --noEmit &amp;&amp; npm run test:auth-schemas &amp;&amp; npm run test:rls &amp;&amp; npm run lint &amp;&amp; npx expo-doctor</automated>
  </verify>
  <acceptance_criteria>
    - All 8 gates above pass; output of the verify-command chain exits 0
    - `app/app/index.tsx` does not exist (Phase 1 smoke-test deleted in Plan 03)
    - Security audit grep returns zero matches (exit code 1) across all 9 Phase 3 files listed
    - `grep -c "supabase.auth.onAuthStateChange(" app/lib/auth-store.ts` returns exactly `1`
  </acceptance_criteria>
  <done>
    All automated checks green; safe to invoke the user for manual verification. If any gate failed, the plan is BLOCKED and the user is told which prior plan to fix.
  </done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 2: Confirm Supabase Studio "Confirm email" toggle is OFF (D-01 + Pitfall §6)</name>
  <what-to-do>
    The signup happy-path (Success Criterion #1) DEPENDS on `supabase.auth.signUp` returning a session immediately. If "Confirm email" is ON in Studio, sign-up will return `{ session: null, user: {...} }` and the user will get stuck on the sign-up screen with no feedback (Pitfall §6 documented in `app/app/(auth)/sign-up.tsx`).

    **This is a checkpoint:human-action because there is no Studio API exposed to read this toggle programmatically from the CLI** — the only reliable way to confirm is the Studio UI. (Supabase CLI manages migrations + types but does NOT expose Auth provider toggles via `supabase` CLI commands as of the verified versions in 03-RESEARCH.md.)
  </what-to-do>
  <how-to-verify>
    1. Open https://supabase.com/dashboard/project/mokmiuifpdzwnceufduu (project ref from CLAUDE.md / `app/package.json`'s `gen:types` script)
    2. Navigate: Authentication → Providers → Email
    3. Locate the "Confirm email" toggle
    4. Verify it is OFF (toggle in the disabled / left position)
    5. If ON: turn it OFF and click "Save" before continuing. Document this state change in 03-VERIFICATION.md (Studio toggle was ON → flipped OFF for V1).
  </how-to-verify>
  <resume-signal>
    Reply with one of:
    - `confirmed-off` — toggle was already OFF; proceed to Task 3
    - `flipped-off` — toggle was ON, now OFF; proceed to Task 3 (note this in 03-VERIFICATION.md)
    - `cannot-access` — Studio access blocked; document in 03-VERIFICATION.md and BLOCK Phase 3 phase-gate until resolved
  </resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Manual iPhone verification — all 5 ROADMAP F1 success criteria</name>
  <what-built>
    Plans 01-03 shipped:
    - Zod 4 schemas + Zustand auth-store with module-scope onAuthStateChange listener (Plan 01)
    - Root layout with SplashScreen.preventAutoHideAsync + SplashScreenController + Stack.Protected (Plan 02)
    - (auth) group layout + sign-in screen with full error mapping (Plan 02)
    - (auth) sign-up screen with confirmPassword + 7-case error mapping (Plan 03)
    - (app) group layout with Redirect defense-in-depth (Plan 03)
    - (app)/index.tsx with email greeting + sign-out button (Plan 03)
    - Phase 1 smoke-test app/app/index.tsx deleted (Plan 03)
  </what-built>
  <how-to-verify>
    **Setup (5 min):**
    1. Confirm iPhone is on the same Wi-Fi as the dev machine
    2. From `app/` cwd, run `npm run start` — wait for the QR code
    3. Open Expo Go on iPhone, scan the QR code
    4. Wait for the bundle to load — first cold start may take ~30s
    5. Decide on the test email convention (researcher Q5). Recommended: `dev+phase3-{YYYYMMDD}@<your-domain>.local` so this account is identifiable as a Phase 3 manual-test account. Document the chosen email in 03-VERIFICATION.md.

    **Success Criterion #1 — Sign-up + auto-login (5 min):**
    1. The app should open on `(auth)/sign-in.tsx` (since no session exists yet on this iPhone)
    2. Tap "Inget konto? Registrera" → navigates to `(auth)/sign-up.tsx`
    3. Heading reads "Skapa konto"
    4. Below the password field, helper text "Minst 12 tecken" is visible (gray, NOT red)
    5. Enter the chosen test email + a 12+ char password (twice)
    6. Tap "Skapa konto"; button label briefly shows "Skapar konto…"
    7. **Expected:** App routes to `(app)/index.tsx`. You see "FitnessMaxxing" + "Inloggad som <test-email>" + "Plan-skapande kommer i nästa fas." + "Logga ut" button.
    8. **PASS** if you land in (app) without manual navigation.
    9. **FAIL** if: stays on sign-up screen, lands somewhere else, or shows an error you didn't expect.

    **Success Criterion #2 — Inline Zod errors on sign-in (5 min):**
    1. Sign out (tap "Logga ut" — Criterion #4 verifies this works)
    2. You should now be on `(auth)/sign-in.tsx`
    3. Tap the email field, type `not-an-email`, then tap the password field (BLUR triggers validation per RHF onBlur mode)
    4. **Expected:** Below email field: red border + "Email måste vara giltigt" inline
    5. Clear email field; type the valid test email; tap submit without entering a password
    6. **Expected:** Below password field: red border + "Lösen krävs"
    7. Type any wrong password (e.g., "wrongpassword12") + tap submit
    8. **Expected:** Below password field: red border + "Fel email eller lösen" (NOT distinguishing wrong-email-vs-wrong-password per ASVS V2.1.4)
    9. **PASS** if all 3 inline errors render in the correct positions with correct Swedish copy.
    10. **FAIL** if errors appear in a banner instead of inline; or are in English; or appear/disappear at the wrong times.

    **Success Criterion #3 — Cold-start session restore (LargeSecureStore round-trip) (5 min):**
    1. Sign in successfully with the test account (you should land in (app)/index.tsx)
    2. **Force-quit Expo Go**: swipe up from the bottom of the iPhone screen, find Expo Go's app card, swipe it up to dismiss
    3. Reopen Expo Go from the home screen, scan the QR again (or tap the recent project entry)
    4. **Expected:** native iOS splash held briefly → lands DIRECTLY in `(app)/index.tsx` showing "Inloggad som <test-email>" — NEVER flashes the sign-in screen during the transition
    5. **PASS** if no flash of (auth) and you land in (app).
    6. **FAIL** if you see (auth)/sign-in.tsx flash before (app); or if you stay on (auth) (LargeSecureStore restore broken); or if there's a white blank screen between splash and content (Pitfall §5 not mitigated).

    **Success Criterion #4 — Sign-out + per-user cache flush (3 min):**
    1. Currently signed in (continuing from #3). Tap "Logga ut".
    2. **Expected:** Atomic transition to `(auth)/sign-in.tsx` (no flash of empty (app)). The sign-in form is empty.
    3. Sign back in with the SAME test account.
    4. **Expected:** Lands in (app)/index.tsx with "Inloggad som <test-email>" — same email as before but state is fresh (no leftover query data from the prior session).
    5. **PASS** if sign-out → sign-in flow is clean and the post-login state is fresh.
    6. **FAIL** if there's a flash of stale data; or if signOut hangs (deadlock from Pitfall §2 not mitigated); or if landing screen shows the wrong email.
    7. **Note:** Phase 3 has no API-bound queries yet (Phase 4 owns the first plan/exercise queries). So "stale cache leak" cannot be visually proven yet — this criterion is partially deferred to Phase 4 manual verification, where signing out as user A and signing in as user B should NOT show user A's plans. For now, verify the auth-state transition is clean.

    **Success Criterion #5 — Stack.Protected + Redirect defense-in-depth (5 min):**
    1. Currently signed in. Force-quit Expo Go.
    2. Reopen — observe the cold-start sequence carefully.
    3. **Expected:** native splash holds → either (a) flash directly to (app)/index.tsx if status flips fast, OR (b) splash holds slightly longer if status takes time. NEVER (c) flash of (auth)/sign-in then jump to (app) (which would mean root Stack.Protected is staleness-vulnerable).
    4. Sign out. Force-quit. Reopen.
    5. **Expected:** native splash holds → flash to (auth)/sign-in.tsx. NEVER (app) for a frame.
    6. **PASS** if both directions show clean splash → final-route transitions with NO peek of the wrong group.
    7. **FAIL** if there's any visible flicker of (auth) before (app) when authed, or (app) before (auth) when unauthed.

    **Dark mode verification (3 min):**
    1. Open iOS Settings → Developer → Dark Appearance → ON
    2. (Or for simulator: Settings → Developer → Dark Appearance toggle)
    3. Reopen the app. Cycle through: (auth)/sign-in (sign out first if needed) → (auth)/sign-up → (app)/index.tsx
    4. **Expected per UI-SPEC.md Color §60/30/10:** all backgrounds are `bg-gray-900`-equivalent dark; body text is `text-gray-50`-equivalent light; field backgrounds are `bg-gray-800` slightly lighter than screen; CTA blue is `bg-blue-500` (slightly brighter than light-mode `bg-blue-600`); muted text is `text-gray-400`; error text is `text-red-400`.
    5. **PASS** if all surfaces have proper dark-mode treatment with no unstyled white-on-dark or invisible-on-dark elements.
    6. **FAIL** if any text becomes invisible (e.g., black on dark gray); or if the placeholder text vanishes.
    7. Toggle Dark Appearance OFF. Verify light-mode also looks correct.

    **Edge case — Duplicate email (3 min):**
    1. On (auth)/sign-up.tsx, enter the same test email + any 12+ char password (twice)
    2. Tap "Skapa konto"
    3. **Expected:** "Detta email är redan registrerat — försök logga in" appears INLINE under the email field (red border + red text)
    4. **PASS** if inline error matches the copy.
    5. **FAIL** if it appears as a banner; or if it's in English; or if the form submits without error.

    **Edge case — Network failure (3 min):**
    1. Toggle iPhone Airplane Mode ON (or disconnect Wi-Fi if Airplane Mode breaks Expo Go connection — Wi-Fi off, mobile data off works too)
    2. Try to sign in with the test account
    3. **Expected:** Banner above the form: "Något gick fel. Försök igen." — NO uncaught exception, NO white-screen-of-death
    4. Toggle network back ON. Sign in works again.
    5. **PASS** if banner appears with the expected copy and no crash.
    6. **FAIL** if uncaught exception; or red-screen; or no error feedback.
  </how-to-verify>
  <resume-signal>
    Reply with one of:
    - `all-pass` — all 5 success criteria + dark-mode + 2 edge cases PASS; proceed to Task 4 to write 03-VERIFICATION.md
    - `partial: <n,m,...>` — list of FAILED criteria (e.g., `partial: 3,5`); Task 4 will record failures and BLOCK the phase gate
    - `blocked` — cannot complete verification (e.g., iPhone unavailable, Expo Go broken, network issue not related to the test); document and re-schedule
  </resume-signal>
</task>

<task type="auto">
  <name>Task 4: Write 03-VERIFICATION.md with the manual-test record</name>
  <files>.planning/phases/03-auth-persistent-session/03-VERIFICATION.md</files>
  <read_first>
    - .planning/phases/03-auth-persistent-session/03-VALIDATION.md "Manual-Only Verifications" table (template structure for the criterion → test → result format)
    - .planning/phases/01-bootstrap-infra-hardening/ — check if a similar `01-VERIFICATION.md` exists (Phase 1 manual gate pattern); if present, mirror its structure
    - The user's resume-signal from Task 2 + Task 3 (Studio toggle state + which criteria passed/failed)
  </read_first>
  <action>
Create `.planning/phases/03-auth-persistent-session/03-VERIFICATION.md` with the structure below.

The user's responses from Task 2 and Task 3 fill in the result columns. Do NOT invent results — copy them verbatim from the resume signals. If any criterion failed (`partial:` resume signal), set `status: blocked` in the frontmatter and list the failures clearly so `/gsd-verify-work 3` doesn't promote the phase.

EXACT structure (fill in placeholders from user's resume signals):

```markdown
---
phase: 3
slug: auth-persistent-session
status: <complete | blocked>
verified_at: <ISO timestamp from `date -u +"%Y-%m-%dT%H:%M:%SZ"` at write time>
verified_by: user (manual iPhone verification via Expo Go)
ios_version: <ASK USER if not stated; otherwise "iOS 17+ per Phase 1 dev env">
expo_go_version: <ASK USER if not stated; otherwise "current">
test_account_email: <chosen email from Task 3 setup, e.g. dev+phase3-20260509@example.local>
studio_confirm_email_toggle: <off | flipped-off-during-verify | cannot-access — from Task 2 resume signal>
nyquist_compliant: true (manual-only path documented per 03-VALIDATION.md frontmatter)
---

# Phase 3 — Manual Verification Record

> Single-source record of the manual iPhone verification of Phase 3 (Auth & Persistent Session).
> Per CLAUDE.md ## Conventions, manual-only verification is the V1 convention for runtime behavior; no integration framework exists yet.

---

## Pre-Flight Automated Checks

| Gate | Command | Result |
|------|---------|--------|
| TypeScript | `cd app && npx tsc --noEmit` | <PASS / FAIL> |
| Schema unit tests | `cd app && npm run test:auth-schemas` | <PASS / FAIL> |
| Phase 2 RLS regression | `cd app && npm run test:rls` | <PASS / FAIL> |
| Lint | `cd app && npm run lint` | <PASS / FAIL> |
| Expo doctor | `cd app && npx expo-doctor` | <PASS / FAIL> |
| Security audit (no service_role leak) | grep across 9 Phase 3 files | <PASS / FAIL> |
| Module-scope listener count | `grep -c onAuthStateChange app/lib/auth-store.ts` returns 1 | <PASS / FAIL> |
| Phase 1 smoke-test deleted | `test ! -f app/app/index.tsx` | <PASS / FAIL> |

All gates: <PASS / BLOCKED>

---

## Studio Configuration Verification

| Item | Expected | Actual | Notes |
|------|----------|--------|-------|
| Authentication → Email → "Confirm email" toggle | OFF (per CONTEXT.md D-01) | <off / flipped-off / cannot-access> | <user notes from Task 2 resume signal> |

---

## ROADMAP F1 Success Criteria

| # | Criterion | Test Type | Result | Notes |
|---|-----------|-----------|--------|-------|
| 1 | Användare kan registrera nytt konto med email + lösen från `(auth)/sign-up.tsx` och hamnar inloggad i `(app)`-gruppen | Manual iPhone | <PASS / FAIL> | <test account email + observed behavior> |
| 2 | Användare kan logga in från `(auth)/sign-in.tsx`; fel-validering via Zod visar fältfel inline (RHF + Zod 4) | Manual iPhone | <PASS / FAIL> | <which inline errors verified: invalid email, empty password, invalid_credentials> |
| 3 | Sign-in → kill app → reopen → session är återställd och användaren ser `(app)`-gruppen direkt (LargeSecureStore round-trip funkar) | Manual iPhone | <PASS / FAIL> | <observation about cold-start splash → (app) transition> |
| 4 | Sign-out tar användaren tillbaka till `(auth)/sign-in.tsx` och `queryClient.clear()` körs (per-user cache rensad) | Manual iPhone | <PASS / FAIL> | <atomic-transition observation; partial deferral to Phase 4 noted> |
| 5 | `Stack.Protected guard={!!session}` i root + `<Redirect>` i `(app)/_layout.tsx` hindrar protected screens från att flicker-rendera när session saknas | Manual iPhone | <PASS / FAIL> | <observation about no-flicker on cold-start in both signed-in + signed-out directions> |

---

## Edge Cases

| Edge Case | Expected | Result | Notes |
|-----------|----------|--------|-------|
| Duplicate email signup | Inline error under email: "Detta email är redan registrerat — försök logga in" | <PASS / FAIL> | <observed copy + position> |
| Network failure on sign-in | Banner above form: "Något gick fel. Försök igen." (no crash) | <PASS / FAIL> | <observed behavior on Airplane Mode> |

---

## Dark Mode (F15 Convention)

| Surface | Light mode | Dark mode | Result |
|---------|-----------|-----------|--------|
| `(auth)/sign-in.tsx` | bg-white + body text-gray-900 | bg-gray-900 + body text-gray-50 | <PASS / FAIL> |
| `(auth)/sign-up.tsx` | bg-white + helper text-gray-500 | bg-gray-900 + helper text-gray-400 | <PASS / FAIL> |
| `(app)/index.tsx` | bg-white + CTA bg-blue-600 | bg-gray-900 + CTA bg-blue-500 | <PASS / FAIL> |

Status-bar contrast (StatusBar style="auto" handles): <icons visible in both modes — PASS / FAIL>

---

## Test Account Convention (researcher Q5)

| Field | Value |
|-------|-------|
| Email | <chosen test email, e.g., dev+phase3-20260509@example.local> |
| Created at | <ISO date> |
| Purpose | Phase 3 manual-test account — sign-up flow + persistent session round-trip + sign-out + duplicate-email negative path |
| Future runs | Use this email for any Phase 3 regression check; do NOT delete from Supabase Auth (it doubles as the duplicate-email negative test) |

---

## Threats Audit Hand-Off

The following threat IDs from PLAN.md `<threat_model>` blocks have been manually verified by behavior:

- **T-03-08** (splash hide before status flip): verified by SC#3 + SC#5 (no white flash)
- **T-03-09** (sign-in error reveals which field is wrong): verified by SC#2 (generic "Fel email eller lösen")
- **T-03-14** (sign-up duplicate-email disclosure — accepted): verified inline error matches D-03
- **T-03-16** (TanStack Query cache leak — partial): SC#4 verifies auth-state transition is clean; full cross-user verification is deferred to Phase 4 (where the first user-data queries land)
- **T-03-17** (email-confirm Studio toggle): verified OFF in Task 2 above
- **T-03-18** (Stack.Protected staleness): verified by SC#5

`/gsd-secure-phase 3` is the next gate; it audits the FULL T-03-* register and writes `03-SECURITY.md`.

---

## Sign-Off

- [<X if pass, blank if blocked>] All 5 ROADMAP F1 success criteria PASS
- [<X / blank>] Studio "Confirm email" toggle confirmed OFF
- [<X / blank>] Dark mode verified for all 3 Phase 3 screens
- [<X / blank>] Edge cases (duplicate email, network failure) PASS
- [<X / blank>] No service-role leak (grep audit PASS)
- [<X / blank>] Module-scope listener registered exactly once

**Phase 3 verification status:** <complete | blocked>

**Next steps:**
- If `complete`: run `/gsd-secure-phase 3` to audit threat register, then `/gsd-verify-work 3` to flip phase to ✓ in ROADMAP + STATE
- If `blocked`: list of failed criteria, plan to remediate (which Plan 0X to revisit), then re-run Plan 04 manual verification

---

*Phase 3 manual verification: <ISO timestamp>*
*Tester: user via Expo Go on iPhone*
```

After writing the file, append a line to `.planning/STATE.md` in the "Last activity" section noting Phase 3 manual verification complete (or blocked) — but DO NOT modify ROADMAP phase status (that's `/gsd-verify-work`'s job).
  </action>
  <verify>
    <automated>test -f .planning/phases/03-auth-persistent-session/03-VERIFICATION.md &amp;&amp; grep -q "Success Criterion" .planning/phases/03-auth-persistent-session/03-VERIFICATION.md</automated>
  </verify>
  <acceptance_criteria>
    - File `.planning/phases/03-auth-persistent-session/03-VERIFICATION.md` exists
    - File frontmatter has `status: complete` OR `status: blocked` (matching the Task 3 resume signal)
    - File frontmatter has `verified_at` with a real ISO timestamp (not `<placeholder>`)
    - File frontmatter has `test_account_email` with a real email (not `<placeholder>`)
    - File frontmatter has `studio_confirm_email_toggle` set to one of: `off`, `flipped-off-during-verify`, `cannot-access`
    - Each of the 5 ROADMAP success criteria has a row with `PASS` or `FAIL` (not `<PASS / FAIL>` placeholder)
    - Each edge case row has a real result
    - Each dark-mode surface row has a real result
    - File is well-formed Markdown (no broken table syntax — `| col1 | col2 |` rows aligned)
    - All `<placeholder>` text from the template is replaced with real values
  </acceptance_criteria>
  <done>
    03-VERIFICATION.md exists with the user's verified state per criterion. If status=complete, the phase is ready for `/gsd-secure-phase 3` and `/gsd-verify-work 3`. If status=blocked, the failed criteria are clearly listed for remediation.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Manual verification → 03-VERIFICATION.md record | The record is the source of truth for the phase gate; it cannot be falsified by the planner — only the user (human verifier) supplies PASS/FAIL via resume signals |
| Studio toggle confirmation → user-attested | No CLI exposes this toggle; manual confirmation is the only mechanism (Pitfall §6 mitigation) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-03-21 | Repudiation | Verification result is unfalsifiable / no audit log | accept | V1 personal app, single-developer; the user is also the verifier; trust model is "trust yourself". Future V1.1+ may add EAS Build CI with screenshot capture if multi-tester verification becomes relevant. |
| T-03-22 | Information Disclosure | 03-VERIFICATION.md commits the test account email to git | accept | Test email is non-sensitive (e.g., `dev+phase3@example.local`); password is NEVER recorded. Real user email (`mehdiipays@gmail.com` per memory) is documented in CLAUDE.md → Developer Profile section but NOT used as the Phase 3 test account by recommendation. |
| T-03-23 | Tampering | User signs off PASS but actual behavior failed | accept | Solo-dev workflow; the user is incentivized not to lie to themselves. `/gsd-verify-work` reads 03-VERIFICATION.md frontmatter for the gate decision; no automated re-verification. Trust model documented. |

**No HIGH-severity unmitigated threats.** This plan is a verification gate, not a code-producing plan; threat surface is the verification record itself, which is bounded by the user's honesty + a few git-committed test accounts.
</threat_model>

<verification>
- File `.planning/phases/03-auth-persistent-session/03-VERIFICATION.md` exists post-Task-4
- The verification file contains all 5 ROADMAP F1 success criteria (grep `Success Criterion` returns ≥5 matches across rows + headings)
- Pre-flight gates from Task 1 all passed (verify by re-running the chain: `cd app && npx tsc --noEmit && npm run test:auth-schemas && npm run test:rls && npm run lint && npx expo-doctor` exits 0)
</verification>

<success_criteria>
- [ ] All Plan 04 tasks complete (pre-flight + Studio toggle + manual iPhone + verification record)
- [ ] 03-VERIFICATION.md frontmatter has `status: complete` (PASS path) or `status: blocked` with explicit failure list (BLOCK path)
- [ ] Studio "Confirm email" toggle confirmed OFF
- [ ] Test account convention recorded (researcher Q5)
- [ ] Threat register hand-off section names which T-03-* IDs were manually verified vs deferred to `/gsd-secure-phase 3`
- [ ] No code changes in this plan (verification-only — Plans 01-03 own the code surface)
</success_criteria>

<output>
After completion, create `.planning/phases/03-auth-persistent-session/03-04-SUMMARY.md` documenting:
- Pre-flight gate results (PASS / FAIL per gate)
- Studio toggle state (off / flipped-off / cannot-access)
- 5 success criteria results (PASS / FAIL per criterion)
- 2 edge cases + dark mode results
- Test account convention recorded
- Recommended next gate: `/gsd-secure-phase 3` for full T-03-* threat register audit
- If status=blocked: list of failures + recommended remediation plan(s)
</output>
