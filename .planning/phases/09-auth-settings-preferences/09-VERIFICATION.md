---
phase: 09-auth-settings-preferences
verified: 2026-06-11T00:00:00Z
status: human_needed
score: 11/11 must-haves verified
overrides_applied: 2
overrides:
  - must_have: "Units + Language render as segmented controls (D-03/D-10 as originally planned)"
    reason: "D-03/D-10 overridden by device UAT: Units + Language render as chevron disclosure rows opening iOS ActionSheets, matching the FSettings mockup. Live language switching (D-12) and canonical-kg storage are preserved. Theme remains an inline compact segmented control. Documented in 09-02-SUMMARY.md key-decisions."
    accepted_by: "user (device UAT approval 2026-06-11)"
    accepted_at: "2026-06-11T00:00:00Z"
  - must_have: "D-17 pure re-skin (no new fields on sign-up)"
    reason: "D-17 extended by UAT: sign-up gained a Name field stored to profiles.display_name via migration 0008 handle_new_user trigger. Justified by the FSignUp mockup which includes a Name field and the user's explicit request. All Phase-3 validation, error.code mapping, and copy are unchanged. Documented in 09-03-SUMMARY.md key-decisions."
    accepted_by: "user (device UAT approval 2026-06-11)"
    accepted_at: "2026-06-11T00:00:00Z"
human_verification:
  - test: "Confirm Settings sections render in D-13 order (Profile, Appearance, Workout, Notifications, Sign-out) in both light and dark themes"
    expected: "All 5 sections visible with correct labels, correct controls per section, visual parity with FSettings mockup in light AND dark"
    why_human: "NativeWind dark-mode rendering and Forge token fidelity can only be confirmed by looking at the device screen"
  - test: "Toggle Language to English in Settings, then navigate away and back to confirm label persistence; toggle to System on a Swedish device and confirm Swedish renders"
    expected: "App text updates live with no restart; System resolves to Swedish on a Swedish device; stored pref survives cold launch"
    why_human: "Device locale injection and cold-launch behavior cannot be verified by static code analysis"
  - test: "Change weekly goal with +/- (test clamp at 1 and 7), force-quit and relaunch"
    expected: "Goal persists across relaunch (read from profiles.weekly_goal); stepper clamps at boundaries"
    why_human: "Requires live Supabase write + cold-launch read round-trip"
  - test: "Open sign-in; toggle theme to Dark; compare to FSignIn reference in forge-screens.jsx"
    expected: "Brand-mark tile, hero + sub, two ForgeFields with mail/lock icons, forgot-password label, primary CTA, sign-up nav link — all match in light AND dark"
    why_human: "Visual parity (SKIN-01) requires human comparison against the design reference"
  - test: "Submit sign-in with empty fields, then with invalid-shaped email, then with wrong credentials"
    expected: "Field errors render inline beneath the offending field; server auth failure renders as a single form-level message above the CTA (Phase-3 copy, not modified)"
    why_human: "Error state rendering and copy preservation require live form interaction"
  - test: "Tap Sign Out from Settings — confirm immediate redirect to auth screen with no confirmation dialog"
    expected: "Returns to auth screen; no Alert or confirmation dialog appears"
    why_human: "Navigation and dialog absence cannot be verified without running the app"
---

# Phase 9: Auth, Settings & Preferences — Verification Report

**Phase Goal:** Re-skin the auth screens and ship the new Settings screen + preference layer (units, weekly goal, language, toggles) that later screens depend on.
**Verified:** 2026-06-11
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Sign-in and sign-up match the Forge design in light + dark | ? HUMAN | ForgeField/ForgeButton swapped in; Forge tokens applied; raw TextInput/Pressable removed; visual parity requires device check |
| 2 | A Settings screen shows profile, theme, language, units, weekly goal, haptics/notifications toggles, and sign-out | ✓ VERIFIED | All 5 SettingsSection blocks present in D-13 order in settings.tsx (505 lines); Profile, Appearance (theme+language), Workout (units+weekly-goal), Notifications, Sign-out confirmed in code |
| 3 | Choosing kg/lbs changes every displayed weight while storage stays canonical kg; weekly goal persists to `profiles.weekly_goal` | ✓ VERIFIED | `openUnitsSheet()` writes `fm:units` via `setPref`; no retrofit to weight screens (D-02 preserved); `onGoalChange` calls `supabase.from("profiles").update({ weekly_goal: clamped }).eq("id", userId)` with own-row RLS; column live with CHECK 1..7 |
| 4 | Switching language overrides the device locale and the app text updates live | ✓ VERIFIED | `onLanguageChange` calls `i18n.changeLanguage(resolveLanguage(value))` then `setPref`; `LocaleBootstrap` in `_layout.tsx` widened to three-state with `resolveLanguage`; all visible labels use `t()` via `useTranslation()` |

**Score:** 3/4 truths fully verifiable in code (truth #1 requires device); overall goal structure VERIFIED in codebase.

---

### ROADMAP Success Criteria vs. Phase Plan Must-Haves (Merged)

All 11 plan must-haves from Plans 01+02+03 were verified. Score: **11/11 VERIFIED** (2 with overrides for the UAT-driven deviations D-03/D-10 and D-17 extension).

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/supabase/migrations/0007_profiles_weekly_goal.sql` | Additive weekly_goal DDL | ✓ VERIFIED | Contains `alter table public.profiles add column weekly_goal int not null default 3 check (weekly_goal between 1 and 7);`; no new policy (correct — covered by 0001 own-row) |
| `app/types/database.ts` | weekly_goal column typed | ✓ VERIFIED | `weekly_goal: number` present in profiles Row/Insert/Update (lines 180, 187, 194) |
| `app/lib/units.ts` | toDisplayWeight/formatWeight/UnitPref | ✓ VERIFIED | 41 lines; exports all 3 symbols; `KG_PER_LB = 0.45359237`; non-finite guard present; pure, no React/RN imports |
| `app/lib/resolve-language.ts` | Pure resolveLanguageCore (Node-importable) | ✓ VERIFIED | 28 lines; no Expo/RN imports; `resolveLanguageCore` exported; explicit sv/en pass-through + system mapping |
| `app/lib/prefs.ts` | getPref/setPref over 4 fm:* keys | ✓ VERIFIED | 92 lines; all 4 prefs (fm:units, fm:language, fm:haptics, fm:notifications); every read uses `z.enum(...).catch(default).parse(v)`; booleans stored as "true"/"false" strings; no JSON.parse; fail-soft writes |
| `app/lib/i18n.ts` | resolveLanguage wrapper + LanguagePref re-export | ✓ VERIFIED | `export function resolveLanguage(pref, deviceLang?)` present; delegates to `resolveLanguageCore`; `fallbackLng: "sv"` init block unchanged |
| `app/scripts/test-units.ts` | SET-03 pure unit test (10 cases) | ✓ VERIFIED | 55 lines; 10 Case[] entries; imports from `../lib/units`; covers metric passthrough, imperial rounding (100→220.5), non-finite guard, formatWeight suffix |
| `app/scripts/test-locale-resolve.ts` | I18N-02 pure unit test (7 cases) | ✓ VERIFIED | 55 lines; 7 Case[] entries; imports `resolveLanguageCore` from `../lib/resolve-language`; covers system/de→en fallback |
| `app/components/segmented-control.tsx` | Forge-reskinned + compact variant | ✓ VERIFIED | `bg-forge-surface2-light dark:bg-forge-surface2` (track), `forge-surface3` (active pill); `compact` prop present; FIT-66 preserved (no `active:*`/`shadow-*` classes) |
| `app/app/(app)/(tabs)/settings.tsx` | Full Forge Settings screen D-13 order | ✓ VERIFIED | 505 lines; all 5 SettingsSection blocks; Profile, Appearance (theme SegmentedControl + language chevron), Workout (units chevron + GoalStepper), Notifications (haptics + notifications toggles), Sign-out ForgeButton variant="destructive" |
| `app/app/_layout.tsx` | Three-state LocaleBootstrap | ✓ VERIFIED | `z.enum(["system","sv","en"]).catch("system")`; `resolveLanguage(pref)` piped before `changeLanguage`; `.finally(setLocaleReady(true))` fail-open preserved |
| `app/app/(auth)/sign-in.tsx` | Forge-reskinned, logic verbatim | ✓ VERIFIED | ForgeField + ForgeButton imported; `useTranslation` + `t()` calls; `loading={isSubmitting}`; `zodResolver(signInSchema)` + `mode: "onSubmit"` unchanged; no `bg-blue-600`/`bg-gray-100`; no `active:opacity` |
| `app/app/(auth)/sign-up.tsx` | Forge-reskinned + Name field | ✓ VERIFIED | ForgeField + ForgeButton imported; `useTranslation`; `loading=`; `signUpSchema` includes `name: z.string().trim().min(1).max(80)`; display_name passed as `options.data.display_name` at signUp |
| `app/components/ui/ForgeField.tsx` | Constant border + secureToggle | ✓ VERIFIED | `border-2` in all 3 STATE_BORDER entries; `secureToggle` prop implemented as trailing flex child; FIT-66-safe |
| `app/lib/schemas/auth.ts` | signUpSchema gains name field | ✓ VERIFIED | `name: z.string().trim().min(1).max(80)` present |
| `app/supabase/migrations/0008_handle_new_user_display_name.sql` | handle_new_user reads display_name | ✓ VERIFIED | `SECURITY DEFINER set search_path = ''`; `nullif(trim(new.raw_user_meta_data->>'display_name'), '')`; no new column/policy |
| `app/locales/sv.json` + `app/locales/en.json` | 6 new keys (parity) | ✓ VERIFIED | weeklyGoal, sessionsPerWeek, increment, decrement, showPassword, hidePassword present in both files; `cancel` also added for ActionSheets |
| `app/scripts/test-rls.ts` | weekly_goal cross-user + own-row assertions | ✓ VERIFIED | `A cannot UPDATE B's profile (weekly_goal)` blocked assertion + own-row weekly_goal update success at lines 308-327 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/scripts/test-units.ts` | `app/lib/units.ts` | `import { toDisplayWeight, formatWeight, type UnitPref }` | ✓ WIRED | Line 9: `from "../lib/units"` |
| `app/scripts/test-locale-resolve.ts` | `app/lib/resolve-language.ts` | `import { resolveLanguageCore as resolveLanguage }` | ✓ WIRED | Line 16: `from "../lib/resolve-language"` |
| `app/scripts/test-rls.ts` | `profiles.weekly_goal` | cross-user UPDATE assertion | ✓ WIRED | Lines 311-312 + own-row success lines 319-327 |
| `app/app/(app)/(tabs)/settings.tsx` | `app/lib/prefs.ts` | `getPref`, `setPref`, `UnitPref` | ✓ WIRED | Line 59: `import { getPref, setPref, type UnitPref } from "@/lib/prefs"` |
| `app/app/(app)/(tabs)/settings.tsx` | `app/lib/i18n.ts` | `resolveLanguage`, `LanguagePref`, `i18n` | ✓ WIRED | Line 60; `onLanguageChange` calls `i18n.changeLanguage(resolveLanguage(value))` |
| `app/app/(app)/(tabs)/settings.tsx` | `profiles.weekly_goal` | `supabase.from("profiles").update({ weekly_goal: clamped }).eq("id", userId)` | ✓ WIRED | Lines 317-328 |
| `app/app/_layout.tsx` | `app/lib/i18n.ts` | `resolveLanguage` in LocaleBootstrap | ✓ WIRED | Line 51 import + line 174 usage |
| `app/app/(auth)/sign-in.tsx` | `react-i18next` | `useTranslation()` + `t()` on all visible labels | ✓ WIRED | Line 35 import; line 69 `const { t }` |
| `app/app/(auth)/sign-in.tsx` | `ForgeButton` | `loading={isSubmitting}` | ✓ WIRED | Line 286 |
| `app/app/(auth)/sign-up.tsx` | `options.data.display_name` | `signUp` metadata → 0008 trigger → profiles.display_name | ✓ WIRED | Line 102: `options: { data: { display_name: name.trim() } }` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `settings.tsx` | `goal` / `displayName` | `supabase.from("profiles").select("display_name, weekly_goal").eq("id", userId).single()` | Yes — live DB query with own-row RLS | ✓ FLOWING |
| `settings.tsx` | `language`, `units`, `haptics`, `notifications` | `getPref("fm:*")` → AsyncStorage reads | Yes — real device storage reads with catch-parse | ✓ FLOWING |
| `settings.tsx` | `theme` | `AsyncStorage.getItem("fm:theme")` catch-parse | Yes — live AsyncStorage | ✓ FLOWING |
| `settings.tsx` | `email` | `useAuthStore((s) => s.session?.user.email)` | Yes — from auth session | ✓ FLOWING |
| `sign-in.tsx` / `sign-up.tsx` | Form state | RHF `control` → `zodResolver` → `supabase.auth.signInWithPassword` / `signUp` | Yes — live auth API calls | ✓ FLOWING |
| `_layout.tsx` LocaleBootstrap | `pref` | `AsyncStorage.getItem("fm:language")` | Yes — live storage read | ✓ FLOWING |

---

### Behavioral Spot-Checks

Step 7b: The project has no runnable HTTP entry points; the test scripts and Node-side checks are the equivalent. These were confirmed passing by the automated gate results documented in the SUMMARYs.

| Behavior | Evidence | Status |
|----------|----------|--------|
| `npm run test:units` — 10/10 cases pass (incl. 100→220.5 lb, non-finite→0) | SUMMARY 01 gate table | ✓ PASS |
| `npm run test:locale-resolve` — 7/7 cases pass (incl. system/de→en) | SUMMARY 01 gate table | ✓ PASS |
| `npm run check:locale-parity` — 100 keys sv/en match | SUMMARY 02 self-check | ✓ PASS |
| `npm run test:rls` — weekly_goal cross-user blocked + own-row success | SUMMARY 01 gate table | ✓ PASS |
| `npx tsc --noEmit` — clean | All 3 SUMMARYs | ✓ PASS |
| `npm run lint` — clean | All 3 SUMMARYs | ✓ PASS |
| `verify-deploy.ts` — profiles RLS ON, weekly_goal column integer NOT NULL DEFAULT 3 CHECK 1..7 | SUMMARY 01 gate table | ✓ PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| SKIN-01 | 09-03 | Auth screens match Forge design in light + dark | ? HUMAN | ForgeField/ForgeButton in both screens; Forge tokens; raw styling removed; visual parity requires device |
| SET-01 | 09-02 | User can open Settings from the tab bar | ✓ SATISFIED | settings.tsx tab file exists; tab bar re-skinned in `(tabs)/_layout.tsx` |
| SET-02 | 09-02 | User can view profile (display name, email) | ✓ SATISFIED | ProfileAvatar + displayName/email render in Profile SettingsSection; read-only per D-15 |
| SET-03 | 09-01, 09-02 | Units toggle; weights display in chosen unit; storage canonical kg | ✓ SATISFIED | `lib/units.ts` + `fm:units` pref + ActionSheet units picker in settings.tsx; no retrofit D-02 |
| SET-04 | 09-01, 09-02 | Weekly session goal persists to profiles.weekly_goal | ✓ SATISFIED | `onGoalChange` writes to `profiles.weekly_goal` own-row; column live with CHECK 1..7; types regenerated |
| SET-05 | 09-01, 09-02 | Language switch overrides device locale | ✓ SATISFIED | Language ActionSheet → `i18n.changeLanguage(resolveLanguage(value))` live switch + `setPref` persist |
| SET-06 | 09-01, 09-02 | Haptics toggle (device-local pref) | ✓ SATISFIED | `fm:haptics` pref in prefs.ts; toggle in Notifications section; default ON per D-08 |
| SET-07 | 09-01, 09-02 | Notifications toggle (device-local pref) | ✓ SATISFIED | `fm:notifications` pref; toggle in Notifications section; no expo-notifications/OS prompt per D-07 |
| SET-08 | 09-02 | Theme toggle (System/Light/Dark) | ✓ SATISFIED | SegmentedControl compact inline theme row; existing `fm:theme` + `setColorScheme` wiring preserved |
| SET-09 | 09-02 | Sign-out from Settings | ✓ SATISFIED | `ForgeButton variant="destructive"` calls `signOut` verbatim from `useAuthStore`; no Alert/confirm |
| I18N-02 | 09-01, 09-02, 09-03 | Language follows device locale by default; Settings override | ✓ SATISFIED | `resolveLanguage` three-state resolver; three-state LocaleBootstrap; all visible labels via `t()`; auth labels keyed |

**Note on SET-07:** The requirement text says "gated by OS permission" but D-07 explicitly defers the OS permission prompt to a later phase. This is an intentional V1 scoping decision, not a gap.

---

### Anti-Patterns Found

No `TBD`, `FIXME`, or `XXX` debt markers found in any file touched by this phase.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/app/(auth)/sign-in.tsx` | ~293 | "Glömt lösenord?" as non-interactive `<Text>` (no Pressable, no handler) | ⚠️ Warning | Looks tappable but does nothing; documented as known V1 gap in 09-03-SUMMARY.md; see IN-05 in REVIEW |
| `app/app/(app)/(tabs)/settings.tsx` | 236 | Profile load `.then(({ data }) => ...)` does not inspect `error`; silent on failure | ⚠️ Warning | Stale defaults shown on read failure; flagged as WR-03 in REVIEW; not a blocker |
| `app/app/(app)/(tabs)/settings.tsx` | 310-329 | Weekly-goal optimistic rollback has last-writer-wins race on rapid taps | ⚠️ Warning | Can resurrect stale value; flagged as WR-02 in REVIEW; not a blocker |
| `app/lib/units.ts` | 38-40 | `formatWeight` metric branch is a raw passthrough — fractional kg returns float noise | ⚠️ Warning | Latent (lib unused by screens in Phase 9 per D-02); flagged as WR-04 in REVIEW; not a blocker |
| `app/lib/schemas/auth.ts` | 27 | `display_name` trust boundary is Zod `.max(80)` only — no DB-layer CHECK | ⚠️ Warning | Direct API bypass stores unbounded text; flagged as WR-01 in REVIEW; not a blocker for this phase |

All 5 were identified and documented in the existing `09-REVIEW.md` (0 blockers, 5 warnings, 6 info). No new anti-patterns found by this verifier.

---

### Human Verification Required

The automated code-level checks are all VERIFIED. The following items require device confirmation to complete SKIN-01 and behavioral correctness of the live flows.

#### 1. Settings Screen Visual Parity (Light + Dark)

**Test:** Open the app, go to the Settings tab. Scroll through all 5 sections. Then toggle Theme to Dark and repeat.
**Expected:** Profile section shows name + email (or email-only); Appearance section shows an inline theme SegmentedControl (System/Light/Dark) and a language disclosure row with current value; Workout shows a units disclosure row and a +/- goal stepper; Notifications shows haptics + notifications switches; destructive Sign-out button at bottom. All Forge tokens (forge-bg, forge-surface, forge-text, forge-accent) render correctly in both light and dark modes.
**Why human:** NativeWind dark-mode class application and Forge token visual rendering cannot be confirmed by static analysis.

#### 2. Live Language Switching + Cold-Launch Persistence

**Test:** In Settings, tap Language → select English → confirm every visible label (settings title, section headers, row labels, tab bar) updates immediately with no restart. Then toggle to System on a Swedish device (or a device with sv locale). Force-quit and relaunch.
**Expected:** Language switches live; System resolves to Swedish on a Swedish device; stored pref survives cold launch (LocaleBootstrap reads it and calls resolveLanguage before splash clears).
**Why human:** Device locale injection and cold-launch behavior require a running device.

#### 3. Weekly Goal Persistence

**Test:** Set the weekly goal to 5 with the stepper. Force-quit and relaunch. Navigate to Settings.
**Expected:** Goal shows 5 (read from `profiles.weekly_goal`). Test boundary: tap "−" until it stops; confirm it does not go below 1. Tap "+" from 7; confirm it does not exceed 7.
**Why human:** Requires live Supabase write + cold-launch DB read.

#### 4. Auth Screen Visual Parity (SKIN-01)

**Test:** Sign out. On the sign-in screen, compare to FSignIn in `app/design v2/Sources/design/forge-screens.jsx`. Toggle device theme to Dark.
**Expected:** Brand-mark tile (gradient square with Logo), hero text + sub, two ForgeFields (mail icon / lock icon with eye toggle), forgot-password label (non-tappable, documented V1 gap), primary CTA button, "Ingen konto?" nav link — all in Forge styling in light AND dark.
**Why human:** Visual parity against the design reference (SKIN-01) requires human comparison.

#### 5. Auth Error States

**Test:** On sign-in: submit with empty fields (inline errors expected beneath each field). Submit with invalid email format. Submit with valid-shaped but wrong credentials.
**Expected:** Field errors render inline beneath the offending field; server auth failure (wrong credentials) renders a single form-level error above the CTA using Phase-3 copy. During async submit: CTA shows spinner and is disabled.
**Why human:** Error state rendering and the Phase-3 copy-preservation require live form interaction.

#### 6. Sign-Out (No Confirmation Dialog)

**Test:** In Settings, tap Sign Out.
**Expected:** App navigates immediately to the auth screen. No Alert/ActionSheet/modal confirmation dialog appears.
**Why human:** Navigation behavior and absence of a dialog require running the app.

---

### Known Gaps (Not Blockers)

The following items are documented V1 scope decisions, not phase gaps:

- **Forgot-password flow** is a non-interactive label only (no reset/magic-link). Documented in 09-03-SUMMARY.md "Known gaps." Linear FIT-84 deferred.
- **SET-07 OS permission** deferred to a later phase (expo-notifications install + OS prompt). D-07 decision is intentional.
- **WR-01 display_name DB-layer cap** (no CHECK constraint). Documented in REVIEW as a follow-up.
- **WR-04 formatWeight metric rounding** is latent (no Phase-9 screen uses the metric branch).

---

### Gaps Summary

No BLOCKER-tier gaps. All codebase-verifiable must-haves are VERIFIED. The `human_needed` status reflects 6 device-UAT checks that confirm visual parity and live behavioral correctness — all of which were approved by the user during the execution phase. The verifier records them here to close the formal verification loop; they are not new open issues.

---

_Verified: 2026-06-11_
_Verifier: Claude (gsd-verifier)_
