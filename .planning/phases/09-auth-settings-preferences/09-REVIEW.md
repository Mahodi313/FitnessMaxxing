---
phase: 09-auth-settings-preferences
reviewed: 2026-06-11T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - app/lib/units.ts
  - app/lib/prefs.ts
  - app/lib/i18n.ts
  - app/lib/resolve-language.ts
  - app/lib/schemas/auth.ts
  - app/components/segmented-control.tsx
  - app/components/ui/SettingsRow.tsx
  - app/components/ui/ForgeField.tsx
  - app/app/(app)/(tabs)/settings.tsx
  - app/app/(app)/(tabs)/_layout.tsx
  - app/app/_layout.tsx
  - app/app/(auth)/sign-in.tsx
  - app/app/(auth)/sign-up.tsx
  - app/supabase/migrations/0007_profiles_weekly_goal.sql
  - app/supabase/migrations/0008_handle_new_user_display_name.sql
  - app/scripts/test-units.ts
  - app/scripts/test-locale-resolve.ts
  - app/scripts/test-rls.ts
findings:
  critical: 0
  warning: 5
  info: 6
  total: 11
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-06-11
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Phase 9 ships the Forge re-skin of auth/settings plus a new preference layer
(`lib/prefs.ts`, `lib/units.ts`, `lib/resolve-language.ts`), migration 0008
(display-name capture in `handle_new_user`), and migration 0007 (`weekly_goal`).

The security posture is strong and the team's own conventions are followed
closely:

- **0008 SECURITY DEFINER + `set search_path = ''`** matches 0001 exactly, uses
  fully-qualified `public.profiles`, and reads user metadata via
  `raw_user_meta_data->>'display_name'` with `nullif(trim(...), '')`. No SQL
  injection surface — the value is bound as a parameter inside the plpgsql
  INSERT, not concatenated. **No injection/abuse vector found here.** The Zod
  `.max(80)` trust boundary is the only length guard, which is acceptable given
  no HTML/SQL sink (verified BLOCKER candidate → cleared).
- **RLS:** 0007 correctly relies on the inherited 0001 own-row policy (no new
  table, no new policy needed), and `test-rls.ts` was extended with cross-user
  `weekly_goal` UPDATE-blocked + own-row UPDATE-allowed assertions (T-09-03).
- **`resolveLanguageCore` / `prefs.ts`** are genuinely corrupt-tolerant: every
  read is `z.enum(...).catch(default).parse(...)` and booleans avoid `JSON.parse`
  exactly as the header claims — no throw path reaches the UI.
- **FIT-66 is respected** across all touched components: no `active:*` / `shadow-*`
  NativeWind classes; pressed feedback and shadows live on `style={({pressed})=>}`
  callbacks and inline iOS shadow objects.

No BLOCKER-tier defects. The findings below are correctness/robustness warnings
and quality items. The most material is **WR-01** (no length cap on
`display_name` at the DB layer — the 80-char trust boundary is purely
client-side and a direct API caller bypasses it), and **WR-02** (the weekly-goal
optimistic write has a last-writer-wins race that can resurrect a stale value).

## Warnings

### WR-01: `display_name` trust boundary is client-side only — direct API bypass stores unbounded text

**File:** `app/supabase/migrations/0008_handle_new_user_display_name.sql:34-38`
**Issue:** The migration header asserts "The trust boundary is the Zod
`signUpSchema.name.max(80)` at the form boundary." That guarantee only holds for
the app UI. `supabase.auth.signUp({ options: { data: { display_name } } })` is an
unauthenticated public endpoint; an attacker (or a buggy client) can call it
directly with a multi-megabyte `display_name`, and `handle_new_user` will write
it verbatim into `public.profiles.display_name` (which is `text`, unbounded). The
0001 column has no `CHECK (length(...) <= n)`. Compare this to the defense-in-depth
pattern the team itself applied to `weekly_goal` in 0007
(`check (weekly_goal between 1 and 7)`), explicitly to stop "a tampered client
write." `display_name` got the client-only guard 0007 was written to avoid.
**Fix:** Add a DB-layer cap mirroring the Zod bound, e.g. truncate or constrain
in the trigger:
```sql
insert into public.profiles (id, display_name)
values (
  new.id,
  nullif(left(trim(new.raw_user_meta_data->>'display_name'), 80), '')
);
```
(or add `check (display_name is null or char_length(display_name) <= 80)` to the
column in a follow-up migration). `left(...)` is the lighter touch since it never
fails the signup insert.

### WR-02: Weekly-goal optimistic update has a last-writer-wins race that can resurrect a stale value

**File:** `app/app/(app)/(tabs)/settings.tsx:310-329`
**Issue:** `onGoalChange` captures `previous = goal` (the value at call time) and
restores it on failure. If the user taps `+` rapidly (e.g. 3→4→5 before the first
network round-trip returns), each handler captures its own `previous` and fires
its own async write. The writes can resolve out of order, and a *failed* early
write rolls `goal` back to its captured `previous` (e.g. 3) even though the user
has since advanced to 5 — silently reverting a value the user explicitly set and
that may have successfully persisted. There is no request-sequencing or
in-flight guard. Because `weekly_goal` is user data, a wrong rollback is a
correctness defect, not just cosmetic.
**Fix:** Guard against stale rollback — only roll back if the current state still
equals the optimistic value this handler wrote, or serialize writes:
```ts
setGoal(clamped);
if (!userId) return;
void supabase.from("profiles").update({ weekly_goal: clamped }).eq("id", userId)
  .select().single()
  .then(({ data, error }) => {
    if (error || !data) {
      // Only revert if no later tap superseded this one.
      setGoal((cur) => (cur === clamped ? previous : cur));
      console.warn("[settings] weekly_goal persist failed — rolled back");
    }
  });
```

### WR-03: Profile/prefs load effects swallow the error branch — a failed read leaves stale optimistic UI with no signal

**File:** `app/app/(app)/(tabs)/settings.tsx:229-241`
**Issue:** The profile-load `.then(({ data }) => ...)` destructures only `data`
and never inspects `error`. A transient RLS/network failure resolves with
`data === null`, the early `return` fires, and the screen keeps `displayName = null`
+ `goal = 3` (defaults) with no retry and no log. Unlike `onGoalChange` (which logs
on failure) and the auth screens (which map `error.code`), this read path is
silent. For the Settings screen specifically this means a user whose profile read
fails sees a phantom "name not set / goal 3" state and, if they then bump the
stepper, writes against a goal that doesn't reflect the server. Promise rejection
(not just `{error}`) is also unhandled — `.then` without `.catch` on a Supabase
call that rejects (rare, but possible on a thrown fetch) is an unhandled rejection.
**Fix:** Inspect `error` and add a `.catch`:
```ts
.then(({ data, error }) => {
  if (error) { console.warn("[settings] profile load failed", error.message); return; }
  if (!data) return;
  setDisplayName(data.display_name ?? null);
  if (typeof data.weekly_goal === "number") setGoal(data.weekly_goal);
})
.catch((e) => console.warn("[settings] profile load threw", e));
```

### WR-04: `formatWeight` emits locale-naive / unrounded metric strings — fractional kg render with full float noise

**File:** `app/lib/units.ts:28-40`
**Issue:** `toDisplayWeight` rounds the *imperial* branch to 0.5 but the metric
branch is a raw passthrough. `formatWeight(72.4999999, "metric")` returns
`"72.4999999 kg"`, and template-literal coercion of any non-integer kg value
(half-plate weights like 2.5, 7.5 are normal in this app) prints whatever float
is stored. The imperial branch is safe, but the metric branch has no formatting
discipline at all, so display weights are inconsistent between unit modes. This is
a display-correctness gap for a module whose sole job is display transform. (Note:
the module is currently unused by screens — D-02 "no retrofit" — so impact is
latent, but the helper is exported and `test-units.ts` only checks integer inputs,
so the gap ships untested.)
**Fix:** Normalize the metric branch too, or round/trim in `formatWeight`:
```ts
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
return `${fmt(v)} ${unit === "imperial" ? "lb" : "kg"}`;
```
and add a fractional-kg case to `test-units.ts`.

### WR-05: `setPref` boolean coercion relies on a non-exhaustive ternary that types `string` as `boolean`-or-`string`

**File:** `app/lib/prefs.ts:85-91`
**Issue:** `const stored: string = typeof value === "boolean" ? (...) : value;`
narrows `value` to the non-boolean members of `PrefMap[K]` in the else branch.
For the generic `K extends PrefKey`, TypeScript cannot prove the else branch is a
`string` for every instantiation — `PrefMap[K]` is a union (`UnitPref | LanguagePref
| boolean`), and the else branch's residual type after removing `boolean` is
`UnitPref | LanguagePref`, which *happens* to be string-assignable today, but the
contract is fragile: add a future numeric pref (e.g. `fm:restSeconds: number`) and
this line silently coerces a number into the `string` slot at runtime
(`AsyncStorage.setItem(key, 123)` stringifies, but the type annotation lies). The
guard only special-cases `boolean`; any non-string non-boolean pref breaks the
invariant without a compile error at the call site.
**Fix:** Make the serializer total and explicit per value type, or assert the
residual:
```ts
const stored: string =
  typeof value === "boolean" ? (value ? "true" : "false") : String(value);
```
`String(value)` makes the intent (everything serializes to string) explicit and
future-proof, instead of relying on the union happening to be all-strings.

## Info

### IN-01: `notifications` translation key is reused for both a section header and a row label

**File:** `app/app/(app)/(tabs)/settings.tsx:461,471`
**Issue:** `SettingsSection label={t("notifications")}` and the bell `SettingsRow
label={t("notifications")}` both render "Notiser" / "Notifications" — the section
header and the row inside it are identical text. This reads as a duplicated label
to a screen-reader user and looks like a copy bug. A distinct section key (e.g.
`notificationsSection` or reuse `appearance`-style grouping) would disambiguate.
**Fix:** Add a separate key for the section header, or rename the row (the SV/EN
JSON already has unused `restTimer`/`account` keys to model the pattern).

### IN-02: `i18n.ts` init `lng` uses the raw device languageCode, bypassing `resolveLanguageCore` for the first frame

**File:** `app/lib/i18n.ts:42`
**Issue:** `lng: Localization.getLocales()[0]?.languageCode ?? "sv"` feeds the raw
device code (e.g. `"de"`, `"fr"`) straight into i18next at module init. For any
non-sv/non-en device this sets an engine language with no resource, so i18next
falls back to `fallbackLng: "sv"` for the brief window before `LocaleBootstrap`
runs `changeLanguage(resolveLanguage(...))` → `"en"`. The net effect: a German-locale
user with no saved pref sees Swedish for the first frame, then English. Harmless
(LocaleBootstrap corrects it before splash clears) but the init `lng` should
ideally route through the same resolver to avoid the sv→en flicker and to keep one
source of truth for the system→engine mapping.
**Fix:** `lng: resolveLanguageCore("system", Localization.getLocales()[0]?.languageCode)`
so init and bootstrap agree.

### IN-03: ActionSheet language/units options bypass i18n for two of three labels

**File:** `app/app/(app)/(tabs)/settings.tsx:283,266`
**Issue:** `openLanguageSheet` hardcodes `"Svenska"` / `"English"` (intentional —
language names are conventionally shown in their own language), but `openUnitsSheet`
uses `t("metric")`/`t("imperial")` while the row value also uses `t(...)`. The
language sheet mixes `t("system")` (translated) with two hardcoded strings, which
is defensible but undocumented as a deliberate choice in-code (the comment only
covers live-switching). Low risk; flagging for consistency review.
**Fix:** Add a one-line comment that the language endonyms are intentionally not
translated, matching the iOS Settings convention.

### IN-04: `initials` derivation can emit a broken surrogate for emoji/multi-byte names

**File:** `app/app/(app)/(tabs)/settings.tsx:332-339`
**Issue:** `w[0]?.toUpperCase()` takes the first UTF-16 code unit of each name
token. A display name beginning with an astral-plane character (emoji, some CJK
extension chars) yields half a surrogate pair, rendering a tofu/replacement glyph
in the avatar. Cosmetic only (avatar initials), and the trigger normalizes empty
names to null, but `Array.from(w)[0]` would be code-point-safe.
**Fix:** `const ch = Array.from(w)[0]; return ch ? ch.toUpperCase() : "";`

### IN-05: Forgot-password is a non-interactive `<Text>` masquerading as an action

**File:** `app/app/(auth)/sign-in.tsx:293-297`
**Issue:** "Glömt lösenord?" renders as a plain `<Text>` with no `Pressable`, no
`accessibilityRole`, and no handler — it looks tappable (styled like a link via
`text3`) but does nothing. A user tapping it gets no feedback. This is dead UI, not
a wiring bug per se (password reset may be out of V1 scope), but shipping a
visible-but-inert "link" is a UX defect a reviewer should flag.
**Fix:** Either wire it to a reset flow, gate it behind a `__DEV__`/feature flag, or
remove it until the flow exists. If kept as a placeholder, make it visually
non-interactive (don't style it as an accent/link affordance).

### IN-06: `test-units.ts` exercises only integer inputs — fractional-kg and rounding-boundary cases are untested

**File:** `app/scripts/test-units.ts:17-32`
**Issue:** All cases use whole-number kg (0, 100, 500). The 0.5-rounding logic
(`roundHalf`) and the metric fractional passthrough (see WR-04) have zero coverage
at the values most likely to expose a bug (e.g. `toDisplayWeight(2.5, "imperial")`,
`toDisplayWeight(72.4, "imperial")` near a .5 boundary). A rounding regression
would pass the current suite.
**Fix:** Add boundary cases: `toDisplayWeight(2.5,"imperial")` (≈5.5),
`toDisplayWeight(1.13,"imperial")` (≈2.5 boundary), and a fractional metric
`formatWeight(72.5,"metric")` assertion.

---

_Reviewed: 2026-06-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
