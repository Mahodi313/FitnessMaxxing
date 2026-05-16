# Phase 3 — UI Review

**Audited:** 2026-05-09
**Baseline:** `03-UI-SPEC.md` (approved design contract)
**Screenshots:** not captured (React Native project — Metro is not a web server; CLI Playwright path inapplicable. Code-only audit + UAT 9/11 PASS as observational evidence.)
**Adversarial stance:** every pillar starts at "fail" until evidence proves contract met.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 2/4 | Implementation diverges from UI-SPEC's password vocabulary (`Lösenord` shipped vs `Lösen` contracted) on **5+ surfaces**; internally consistent but the contract was not updated to reflect the deviation. |
| 2. Visuals | 3/4 | All declared dark-mode pairs present; banner-error uses bare colored Text without close-icon affordance; out-of-palette `text-blue-700/blue-300` introduced for info banner without spec amendment. |
| 3. Color | 3/4 | 60/30/10 split correctly applied; one out-of-contract color (`text-blue-700 dark:text-blue-300` on sign-up info banner) and one hardcoded hex (`#9CA3AF` placeholderTextColor) bypass the palette token system. |
| 4. Typography | 4/4 | Two weights (`font-semibold` + default `font-normal`), three sizes (`text-3xl`, `text-base`, `text-sm`) — strictly within UI-SPEC's declared scale. Heading `text-2xl` reserved for future use as contract states. |
| 5. Spacing | 4/4 | All Tailwind spacing classes are 4-multiples on the declared scale (gap-1/2/4/6, mt-8, py-3/4, px-2/4). Inline `paddingHorizontal:16, paddingVertical:48` on ScrollView matches UI-SPEC literal values. Zero arbitrary `[Npx]` values. |
| 6. Experience Design | 2/4 | **No `accessibilityLabel`, `accessibilityRole`, `accessibilityLiveRegion` anywhere** despite UI-SPEC declaring these required. RHF `mode` was downgraded from contract's `'onBlur'` to `'onSubmit'` (UAT Test 3 documents but spec was never updated). No `returnKeyType="next"` keyboard chaining between email→password. RHF `setFocus` cannot fire because Controllers don't expose refs. |

**Overall: 18/24**

---

## Top 5 Priority Fixes

1. **[BLOCKER — Pillar 6] Wire VoiceOver / accessibility props on every form field.** UI-SPEC `Accessibility Floor` row 3 requires every TextInput to carry `accessibilityLabel` and every error `<Text>` to carry `accessibilityLiveRegion="polite"`. Zero such props exist in `sign-in.tsx`, `sign-up.tsx`, or `(app)/index.tsx`. **User impact:** screen-reader users get a label but no programmatic field association, and validation errors do not announce on submit failure. **Fix:** add `accessibilityLabel="Email"` / `accessibilityLabel="Lösenord"` to each `<TextInput>` and `accessibilityLiveRegion="polite"` (Android) + role-aware structure to each error `<Text>`. Add `accessibilityRole="button"` on the four `<Pressable>` CTAs and nav-links.

2. **[WARNING — Pillar 1] Reconcile UI-SPEC vocabulary drift OR update the spec.** UI-SPEC §Copywriting Contract says password label = `Lösen` and primary errors `Lösen krävs` / `Fel email eller lösen` / `Lösen matchar inte`. Implementation ships `Lösenord` and `Lösenord krävs` / `Fel email eller lösenord` / `Lösenord matchar inte`. Affected lines: `sign-in.tsx:172, 68`; `sign-up.tsx:215, 253, 105`; `lib/schemas/auth.ts:21, 24, 33`. **User impact:** none for end-user (`Lösenord` is the more conventional Swedish form) but the design contract is now out of sync with shipped strings — every future audit will (correctly) re-flag this. **Fix:** decide canonical form, then either (a) bulk-rename `Lösenord` → `Lösen` to honor the existing contract, or (b) update `03-UI-SPEC.md` §Copywriting Contract to read `Lösenord` everywhere and re-approve. Option (b) is preferred (matches Swedish UX norms) but requires a one-line spec amendment commit so future agents do not re-detect the drift.

3. **[WARNING — Pillar 6] Re-add RHF `mode: "onBlur"` per UI-SPEC, OR amend spec to confirm submit-only validation.** UI-SPEC §Interaction Contracts row 7 + §Copywriting Contract §"Error states — additional rules" both declare that errors fire on first blur of an invalid field. `sign-in.tsx:51` and `sign-up.tsx:62` ship `mode: "onSubmit"` with the comment claiming it is RHF default (true) but contradicting the spec. UAT Test 3 documented this deviation but the spec was not updated. **User impact:** users typing an obviously-bad email get no feedback until they submit; iOS pattern for auth forms is per-field validation on blur. **Fix:** flip `mode` back to `"onBlur"` on both `useForm` calls (a 1-character change × 2 files), or amend `03-UI-SPEC.md` §Interaction Contracts and §Copywriting Contract to officially adopt `onSubmit` and re-approve.

4. **[WARNING — Pillar 6] Wire `returnKeyType` + `onSubmitEditing` keyboard chaining between email→password (and password→confirmPassword on sign-up).** Currently the iOS keyboard "return" key on email does not advance to password — the user must tap manually. UI-SPEC's `Accessibility Floor` row 5 only contracts the keyboard *type* (email-address vs default), not advancement, but iOS auth-form muscle memory (Mail.app, Settings, every native form) is `next`-chained. **User impact:** ~2 extra taps per sign-in attempt; against the project's "≤ 3 second logging" performance ethos. **Fix:** on email TextInput add `returnKeyType="next"` + `onSubmitEditing={() => passwordRef.current?.focus()}`; on password add `returnKeyType="go"` (sign-in) / `"next"` (sign-up) + `onSubmitEditing={handleSubmit(onSubmit)}` (or chain to confirm). Requires lifting `useRef<TextInput>` per field — minor refactor inside Controller render fns.

5. **[WARNING — Pillar 3] Fold `text-blue-700/dark:text-blue-300` info banner into the contract palette.** `sign-up.tsx:166` introduces `text-blue-700 dark:text-blue-300` for the info banner showing "Vi har skickat ett bekräftelsemail…" — these are NOT in UI-SPEC §Color (which declares `blue-600/blue-500/blue-400` only). The info banner is also an undocumented surface — UI-SPEC has no row for "info banner" (only `bannerError` for destructive). **User impact:** none today (color reads fine, banner is functional), but spec drift will propagate if Phase 4+ copies the pattern. **Fix:** either (a) re-style the info banner to use existing palette tokens (`text-blue-600 dark:text-blue-400` matches the link-text role), or (b) amend UI-SPEC §Color to add an "info" role with `blue-700 dark:blue-300` and §Visuals to add an "info banner" component row. (Option b is more honest — info banners ARE a real UI surface that emerged from the email-confirmation reality.)

### Minor recommendations (not in top 5)

- **[Pillar 6]** UAT Test 8 noted the `AuthRetryableFetchError → "Något gick fel. Försök igen."` mapping creates user friction (generic copy + scary console.error noise). Add an explicit `default` arm sub-branch detecting `error.name === "AuthRetryableFetchError"` and surface a network-specific copy (e.g., `"Du verkar vara offline. Kolla din anslutning."`). UI-SPEC explicitly punted offline-banner work to Phase 4, so this is V1.1 territory — but adding the explicit branch is one switch-case and removes the documented friction.
- **[Pillar 6]** The dismissible banner is a `<Pressable><Text>` with no close-icon affordance. Users may not realize the banner is tappable. Add a small "✕" `<Text>` aligned end, or an `accessibilityHint="Tryck för att stänga"` so VoiceOver announces dismissibility.
- **[Pillar 1]** `signInSchema` collapses empty-email and malformed-email into `"Email måste vara giltigt"` because `z.email()` rejects empty strings with the email-format error rather than a min-length error. UI-SPEC distinguishes `Email krävs` (empty) from `Email måste vara giltigt` (malformed). Add `z.string().min(1, { error: "Email krävs" }).pipe(z.email({ error: "Email måste vara giltigt" }))` if the distinction is desired — or amend spec.
- **[Pillar 2]** Sign-up info banner (line 162-170) renders BELOW the heading and ABOVE the field block. When `infoBanner` is set the form is `reset()` so fields are empty — so the user sees a banner with empty fields below it. Visually this could look like an error state. Consider rendering the info banner full-screen-style (replacing the form) when active, since the user's next action is "go to inbox," not "edit fields."
- **[Pillar 3]** `placeholderTextColor="#9CA3AF"` is a hardcoded hex on 5 sites (sign-in:145,178; sign-up:188,221,259). This is the documented Pitfall §7 mitigation (NativeWind 4's `placeholder:text-*` selector is unreliable on RN), so it's a justified workaround. Consider extracting to a `const PLACEHOLDER_GRAY = "#9CA3AF"` constant in `lib/colors.ts` so a single edit retunes all five.

---

## Detailed Findings

### Pillar 1: Copywriting (2/4)

**Method:** Cross-referenced every UI-SPEC §Copywriting Contract row against literal strings in `sign-in.tsx`, `sign-up.tsx`, `(app)/index.tsx`, and `lib/schemas/auth.ts`.

**WARNING — UI-SPEC vocabulary drift on `Lösen` ↔ `Lösenord`:**

| UI-SPEC contract | Implementation | File:line |
|------------------|----------------|-----------|
| Field label `Lösen` (sign-in + sign-up) | `Lösenord` | sign-in.tsx:172, sign-up.tsx:215 |
| Field label `Bekräfta lösen` (sign-up) | `Bekräfta lösenord` | sign-up.tsx:253 |
| Schema error `Lösen krävs` (sign-in empty pwd) | `Lösenord krävs` | lib/schemas/auth.ts:33 |
| Schema error `Lösen matchar inte` (sign-up confirm mismatch) | `Lösenord matchar inte` | lib/schemas/auth.ts:24 |
| `Bekräfta ditt lösen` (sign-up confirm empty) | `Bekräfta ditt lösenord` | lib/schemas/auth.ts:21 |
| Supabase invalid_credentials → `Fel email eller lösen` | `Fel email eller lösenord` | sign-in.tsx:68 |
| `Lösen för svagt — minst 12 tecken` (weak_password) | `Lösenord för svagt — minst 12 tecken` | sign-up.tsx:105 |

The implementation is internally consistent (always uses the long form `Lösenord`), and `Lösenord` is the more conventional Swedish UX form (Apple iCloud, Google, banking apps all use it). But the contract says `Lösen` and the contract is the audit baseline. Score 2 (not 1) because end-user copy quality is fine; score not 3 because seven separate strings drift simultaneously.

**WARNING — Empty email collapses with malformed email error:**
- UI-SPEC distinguishes `Email krävs` (empty) from `Email måste vara giltigt` (malformed).
- `lib/schemas/auth.ts:19,32` use bare `z.email({ error: "Email måste vara giltigt" })` — Zod 4's `z.email()` rejects empty strings with the email-format error, so the empty case never produces `Email krävs`.

**WARNING — Undocumented copy on `email_not_confirmed` and info-banner paths:**
- `sign-in.tsx:75` ships `"Bekräfta ditt email först. Kolla din inkorg för bekräftelselänken."`
- `sign-up.tsx:79` ships `"Vi har skickat ett bekräftelsemail till {email}. Klicka på länken i mailet och logga sedan in."`
- Neither string is in UI-SPEC §Copywriting Contract. They emerged because the production Supabase Studio toggle is ON (UAT gap-1, accepted-deferred). Necessary for shipped reality, but they're net-new copy with no spec row.

**PASS — Generic-string audit:**
- No `Submit`, `OK`, `Cancel`, `Click Here` in the codebase.
- No `Loading...` or `Please wait` (loading uses contextual `Loggar in…` / `Skapar konto…`).
- No `went wrong` (the `Något gick fel. Försök igen.` is contract copy from UI-SPEC §Error states).

**PASS — Headings, helper text, nav-links match UI-SPEC verbatim:**
- `Logga in` / `Skapa konto` headings ✓
- `Minst 12 tecken` helper ✓
- `Inget konto? Registrera` / `Har du redan ett konto? Logga in` ✓
- `Inloggad som {email}` greeting ✓
- `FitnessMaxxing` heading ✓
- `Plan-skapande kommer i nästa fas.` ✓
- `Logga ut` button label ✓

### Pillar 2: Visuals (3/4)

**Method:** Checked component structure, focal points, dark-mode coverage, and affordance signals.

**PASS — Visual hierarchy:** Heading (text-3xl semibold) > Label (text-sm semibold) > Body (text-base normal) > Muted helper (text-base normal text-gray-500). Hierarchy reads correctly in light and dark.

**PASS — Focal points:** Each screen has one clear focal point — the `Skapa konto` / `Logga in` heading anchors the top, the primary CTA anchors the bottom, fields stack vertically with `gap-4`. UI-SPEC §Visuals component-stacking matches.

**PASS — Dark-mode pair coverage:** All required pairs from UI-SPEC §Color present:
- bg-white ↔ bg-gray-900 (SafeAreaView × 3 screens)
- text-gray-900 ↔ text-gray-50 (body, label, heading)
- bg-gray-100 ↔ bg-gray-800 (TextInput bg)
- border-gray-300 ↔ border-gray-700 (default border) + border-red-600 ↔ border-red-400 (error border)
- bg-blue-600 ↔ bg-blue-500 (CTA × 3)
- text-blue-600 ↔ text-blue-400 (link × 2)
- text-red-600 ↔ text-red-400 (error × everywhere)
- text-gray-500 ↔ text-gray-400 (helper text on sign-up)

UAT Tests 9, 10, 11 PASSed independently — physical dark-mode toggle on iPhone confirms.

**WARNING — Banner has no dismiss affordance:**
The dismissible error banner (sign-in:121-127, sign-up:154-160) is a bare `<Pressable><Text>` with no "✕" icon, no border, and no `accessibilityHint`. Users may not realize the banner is tappable. Additionally, dismissibility on a transient-error banner is questionable — the user usually wants the error to clear automatically when they retry, not require a manual close.

**WARNING — No icon-only buttons:**
- Pillar-2 audit-method asks "are icon-only buttons paired with aria-labels or tooltips?" — there ARE no icon-only buttons in Phase 3 (UI-SPEC explicitly says no icons required; password eye-toggle is "allowed but not contracted"). N/A clean.

**WARNING — Sign-up info-banner sits visually like an error:**
When `email_not_confirmed` triggers the info banner (`sign-up.tsx:164-170`), the form is `reset()` (line 84) — so the user sees a colored banner with three empty fields below it. `text-blue-700 dark:text-blue-300` is friendlier than red but the layout still reads "form needs more input" when the actual next action is "leave the app and check inbox." A full-screen takeover or larger info card would communicate "you're done here" more clearly.

### Pillar 3: Color (3/4)

**Method:** Counted accent occurrences and audited for out-of-palette colors.

**Accent (blue) usage breakdown:**
- `bg-blue-600 dark:bg-blue-500` — primary CTA × 3 (sign-in, sign-up, sign-out) ✓ matches UI-SPEC reserve §1
- `text-blue-600 dark:text-blue-400` — nav links × 2 (sign-in:219, sign-up:300) ✓ matches §2
- `focus:border-blue-600 dark:focus:border-blue-500` — focused field × 5 (sign-in:154,187; sign-up:197,230,268) ✓ matches §3

10 distinct accent usages across 3 screens; all align with UI-SPEC's three reserved roles.

**WARNING — Out-of-contract `text-blue-700 dark:text-blue-300`:**
`sign-up.tsx:166` introduces a fourth blue shade for the info banner. UI-SPEC §Color lists only blue-600/500/400. This is the only accent-token outside the palette and it is not in any contract row.

**Hardcoded colors:**
- `placeholderTextColor="#9CA3AF"` × 5 (sign-in:145,178; sign-up:188,221,259) — equivalent to `gray-400`, justified by Pitfall §7 (NativeWind `placeholder:` selector unreliable). Hex chosen because the prop takes a literal RN color, not a class.
- No other hex/rgb literals in the codebase. ✓

**PASS — 60/30/10 distribution:**
- Dominant 60%: bg-white/gray-900 — every screen background ✓
- Secondary 30%: bg-gray-100/gray-800 — TextInput backgrounds ✓
- Accent 10%: blue-* — CTAs + links + focus borders ✓

**PASS — Destructive (red) reserved correctly:**
`text-red-600 dark:text-red-400` appears only on (a) field-error text, (b) field-error border, (c) banner-error text. UI-SPEC §Color "Destructive color is read-only in Phase 3" — confirmed; no destructive *actions* use red.

### Pillar 4: Typography (4/4)

**Method:** Counted distinct sizes and weights actually rendered.

**Sizes used (3 distinct):**
| Size | Tailwind | Roles |
|------|----------|-------|
| 30px | `text-3xl` | Display — sign-in heading "Logga in", sign-up heading "Skapa konto", (app) heading "FitnessMaxxing" |
| 16px | `text-base` | Body text, field input text, error text, helper text, banner text, CTA button labels, nav links |
| 14px | `text-sm` | Field labels ("Email", "Lösenord", "Bekräfta lösenord") |

UI-SPEC declared four roles (Body, Label, Heading text-2xl, Display text-3xl). `text-2xl` Heading is intentionally unused — UI-SPEC §Typography "Heading reserved for future per-section headings inside (app) surface (not exercised in Phase 3)." ✓

**Weights used (2 distinct):**
- `font-semibold` (600) — headings, labels, CTA labels, nav-link tap target
- default `font-normal` (400) — body, field input, error text, helper text

`font-bold`, `font-medium`, `font-light` — zero occurrences. Strict adherence to UI-SPEC's "two weights only" rule. ✓

**No size/weight outliers, no inline `style={{fontSize: ...}}`, no font-family overrides.** System default (San Francisco on iOS) used throughout per UI-SPEC §Design System.

This pillar is the cleanest in the phase. Score: 4.

### Pillar 5: Spacing (4/4)

**Method:** Enumerated all spacing classes and audited for arbitrary values.

**Spacing classes in use (all 4-multiples per UI-SPEC scale):**
- `gap-1` (xs/4px) — nav-link inline label-to-tap-target gap (sign-in:211, sign-up:292) ✓
- `gap-2` (sm/8px) — heading sub-block, label-to-input gap (sign-in:114, 136, 170; sign-up:147, 179, 213, 251) ✓
- `gap-4` (md/16px) — field block container (sign-in:130; sign-up:173) ✓
- `gap-6` (lg/24px) — main vertical rhythm container (sign-in:112; sign-up:145; (app)/index:28) ✓
- `mt-8` (xl/32px) — separator above nav-link (sign-in:211; sign-up:292) ✓
- `px-2` (sm/8px) — nav-link tap padding (sign-in:217; sign-up:298) ✓
- `px-4` (md/16px) — TextInput inner padding (sign-in:150,183; sign-up:193,226,264; (app)/index:28) ✓
- `py-3` (12px) — TextInput vertical, nav-link vertical (sign-in:150,183,217; sign-up:193,226,264,298) ✓ (12px is not in declared scale but UI-SPEC §Spacing explicitly uses py-3 for TextInputs)
- `py-4` (md/16px) — primary CTA vertical (sign-in:203; sign-up:284; (app)/index:40) ✓

**Inline pixel spacing (intentional, matches UI-SPEC):**
- `paddingHorizontal: 16, paddingVertical: 48` on ScrollView contentContainerStyle (sign-in:107-109; sign-up:140-142). UI-SPEC §Visuals "Screen container" specifies these literal pixel values.

**No arbitrary `[Npx]` values, no `[Nrem]` values, no inline `marginTop: 13`-style spacing.**

**Touch targets:**
- Primary CTA: `py-4` (16+16) + text-base line-height 24 = ~56pt height ≥ 44pt ✓
- Nav link: `py-3 px-2` wrapping text-base = ~48pt vertical ≥ 44pt ✓
- Sign-out button: `py-4` ≥ 44pt ✓
- TextInput: `py-3` + text-base = ~48pt ≥ 44pt ✓

Touch-target floor honored on every interactive element.

This pillar passes cleanly. Score: 4.

### Pillar 6: Experience Design (2/4)

**Method:** Checked state coverage (loading, error, empty, disabled), interaction patterns (focus, keyboard chaining, accessibility), and adherence to UI-SPEC §Interaction Contracts.

**PASS — Loading state on submit:**
- `isSubmitting` flips button to `disabled` + label changes to `Loggar in…` / `Skapar konto…` (sign-in:202,206; sign-up:283,287). ✓
- No global ActivityIndicator or spinner — UI-SPEC §Visuals "no global activity indicator" honored.
- Splash-hold pattern (`SplashScreen.preventAutoHideAsync` + `SplashScreenController`) prevents flicker on cold-start. UAT Test 6 PASS.

**PASS — Error state:**
- Field-level errors render below each field with red text + red border on the input. ✓
- Banner errors render above the field block, dismissible by tap. ✓
- Switch-case mapping for 7 sign-up Supabase error codes + 4 sign-in error codes. ✓
- WR-04 fix: `default` branch logs full error shape — diagnostic-friendly without leaking secrets.

**PASS — Disabled state on submit-in-flight:**
`disabled={isSubmitting}` + `disabled:opacity-60` Tailwind variant ✓.

**PASS — Cold-start splash gating:**
`RootNavigator` returns `null` while `status === 'loading'` (`_layout.tsx:82`); `SplashScreenController` `useEffect` calls `hideAsync()` on first non-loading status (line 62-68). UAT Test 6 PASS.

**PASS — Defense-in-depth routing:**
`(app)/_layout.tsx:22-25` AND `(auth)/_layout.tsx:17-20` both have symmetric Redirect guards (WR-01 fix). UAT Tests 4, 5, 6 PASS.

**BLOCKER — Zero `accessibilityLabel` / `accessibilityRole` / `accessibilityLiveRegion` instrumentation:**
Grep across `app/app/**` returned **0 matches** for any of these props. UI-SPEC §Accessibility Floor:
- Row 3 "Form labels": "Every TextInput has a sibling `<Text>` label visually associated above it (gap-2 column) AND `accessibilityLabel` matching the visible label string"
- Row 4 "Error association": "Each field's error `<Text>` has `accessibilityLiveRegion='polite'` (Android) — iOS VoiceOver picks up the error via re-render announcement"

The visible label is rendered (sibling `<Text>` exists), but the `accessibilityLabel` PROP is nowhere. Without it, iOS VoiceOver reads the input as "text field, secure" with no semantic name; with it, VoiceOver reads "Email, text field" / "Lösenord, secure text field". This is the most-cited accessibility miss in the audit.

**WARNING — RHF mode contract drift:**
`sign-in.tsx:51` and `sign-up.tsx:62` use `mode: "onSubmit"` (RHF default) while UI-SPEC §Interaction Contracts row 7 says: "Field blur | User leaves a field with invalid input | RHF `mode: 'onBlur'` fires Zod resolver → fieldState.error set". UAT Test 3 documented this divergence ("Validation trigger changed from `mode: 'onBlur'` … to submit-only.") but the spec was not amended. Audit cannot ratify a divergence the spec hasn't accepted.

**WARNING — RHF `setFocus` cannot fire (no refs through Controller):**
UI-SPEC §Accessibility Floor row 6: "After Zod fails on submit, RHF `setFocus(firstErrorField)` runs (RHF default) so VoiceOver lands on the first invalid field." For `setFocus` to actually move focus, the Controllers (sign-in.tsx:132, sign-up.tsx:175) must wire a ref to the underlying TextInput. Currently `<Controller render={({field}) => <TextInput value={field.value} ... />}>` does not pass `field.ref` to TextInput. RHF flips `shouldFocusError: true` by default but the focus call is a no-op without a ref target. **User impact:** keyboard-only / VoiceOver users get no focus jump on submit-with-errors.

**WARNING — No `returnKeyType` / `onSubmitEditing` keyboard chaining:**
Grep returned 0 matches. Standard iOS auth pattern is email→`next`→password→`go`. Currently the iOS keyboard's return key shows "return" and dismisses keyboard rather than advancing. Adds friction; ~2 extra taps per sign-in.

**WARNING — Generic copy on transient network failure:**
UAT Test 8 user-reported: "I get the error message Något gick fel. But I also get console errors … `AuthRetryableFetchError`. Maybe its ok?" The default branch correctly catches the offline case but the generic copy doesn't tell the user *why* it failed or *what* to do (retry vs check connection). UI-SPEC §Copywriting Contract intentionally punted offline-banner work to Phase 4, so this is documented as future polish in the UAT note — but it surfaces as friction in the experience pillar.

**ACCEPTED-DEFERRED — Sign-up direct-to-(app) routing:**
UAT gap-1: production Studio "Confirm email" toggle is ON. Sign-up returns `{session: null}`, the new info banner code path (sign-up.tsx:77-86) detects this and shows `infoBanner`. **Not a Phase 3 visual defect** — it's an environmental config drift that was explicitly accepted and deferred to V1.1 (Phase 8). Score not deducted further on this account; it would be worth deducting if the code crashed or showed `Något gick fel` instead of the info banner, but the Pitfall §6 detection is in place.

**Pillar 6 score reasoning:** Loading + error + disabled + routing patterns are all present and correct. The `setFocus` + `accessibilityLabel` + `accessibilityLiveRegion` + `returnKeyType` gaps form a coherent VoiceOver/keyboard-flow miss, plus the unratified `mode` drift, push this pillar to 2/4 (notable gaps requiring rework before V1 ship — or before claiming the UI-SPEC contract is fully met).

---

## Files Audited

- `app/app/_layout.tsx` (104 lines — root: SplashScreen hold, focusManager/onlineManager, RootNavigator with Stack.Protected, SplashScreenController)
- `app/app/(auth)/_layout.tsx` (21 lines — auth group with WR-01 symmetric Redirect)
- `app/app/(auth)/sign-in.tsx` (229 lines — primary auth surface)
- `app/app/(auth)/sign-up.tsx` (310 lines — primary auth surface)
- `app/app/(app)/_layout.tsx` (26 lines — protected group with defense-in-depth Redirect)
- `app/app/(app)/index.tsx` (47 lines — post-login placeholder)
- `app/lib/schemas/auth.ts` (37 lines — Swedish error copy + Zod validation contract)
- `app/tailwind.config.js` (12 lines — vanilla v3 with darkMode:class)
- `app/global.css` (3 lines — Tailwind base/components/utilities)

**Files referenced by audit but not in primary surface:**
- `.planning/phases/03-auth-persistent-session/03-UI-SPEC.md` (audit baseline)
- `.planning/phases/03-auth-persistent-session/03-UAT.md` (observational evidence)
- `.planning/phases/03-auth-persistent-session/03-VERIFICATION.md` (gap-1, gap-2 acceptance record)

**Audit gates run:**
- Grep for hardcoded hex/rgb: 5 matches, all `#9CA3AF` placeholderTextColor (Pitfall §7 — justified)
- Grep for arbitrary `[Npx]` / `[Nrem]` Tailwind values: 0 matches
- Grep for `font-(thin|light|normal|medium|bold|extrabold)`: 0 matches (only `font-semibold`)
- Grep for distinct `text-(size)`: 3 sizes (`text-sm`, `text-base`, `text-3xl`) — all in spec
- Grep for `accessibilityLabel|accessibilityRole|accessibilityLiveRegion`: 0 matches — finding driver
- Grep for `returnKeyType|onSubmitEditing|inputAccessoryView`: 0 matches — finding driver
- Grep for `service_role|SERVICE_ROLE` across 9 Phase 3 files: 0 matches (security gate clean — sanity check, not an audit pillar)
- Registry safety audit: skipped (no `components.json`; UI-SPEC declares "shadcn registry is React-DOM only and incompatible with this React Native runtime")
