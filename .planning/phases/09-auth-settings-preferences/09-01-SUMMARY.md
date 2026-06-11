---
phase: 09-auth-settings-preferences
plan: 01
subsystem: foundation
tags: [units, i18n, prefs, migration, rls, weekly-goal]
requires:
  - "profiles table + own-row RLS policies (0001)"
  - "i18next singleton + sv/en locales (Phase 8)"
  - "test-rls.ts cross-user harness (Phase 2)"
  - "test-auth-schemas.ts pure runner skeleton (Phase 3)"
provides:
  - "lib/units.ts — canonical kg↔display helper (toDisplayWeight/formatWeight/UnitPref)"
  - "lib/resolve-language.ts — pure three-state→two-state resolver core (Node-importable)"
  - "lib/i18n.ts resolveLanguage wrapper + LanguagePref"
  - "lib/prefs.ts — typed getPref/setPref over fm:units|language|haptics|notifications"
  - "profiles.weekly_goal column (live, NOT NULL DEFAULT 3 CHECK 1..7)"
  - "6 new bilingual i18n keys (weeklyGoal, sessionsPerWeek, increment, decrement, showPassword, hidePassword)"
  - "test:units + test:locale-resolve npm scripts"
affects:
  - "Plan 09-02 (Settings screen — consumes all helpers + live column + new keys)"
  - "Plan 09-03 (Auth re-skin — consumes showPassword/hidePassword keys)"
tech-stack:
  added: []
  patterns:
    - "fm:* corrupt-tolerant z.enum().catch(default).parse() read idiom centralized in lib/prefs.ts"
    - "pure resolver core extracted to a separate Node-importable module to avoid RN-import breakage under tsx"
    - "booleans persisted as 'true'/'false' strings + enum-catch (no JSON.parse throw surface)"
key-files:
  created:
    - app/lib/units.ts
    - app/lib/resolve-language.ts
    - app/lib/prefs.ts
    - app/scripts/test-units.ts
    - app/scripts/test-locale-resolve.ts
    - app/supabase/migrations/0007_profiles_weekly_goal.sql
  modified:
    - app/lib/i18n.ts
    - app/locales/sv.json
    - app/locales/en.json
    - app/package.json
    - app/scripts/test-rls.ts
    - app/types/database.ts
decisions:
  - "Extracted resolveLanguage's pure core into lib/resolve-language.ts (Rule 3) — importing lib/i18n.ts under Node breaks (expo-localization → react-native untranspiled). i18n.ts keeps a resolveLanguage(pref, deviceLang?) wrapper delegating to the core; the unit test imports the pure core."
metrics:
  duration: ~18 min
  completed: 2026-06-11
  tasks: 3
  files: 12
---

# Phase 9 Plan 01: Auth/Settings/Preferences Foundation Layer Summary

The Phase 9 contract layer every downstream screen consumes: pure kg↔display units helper, a Node-testable three-state language resolver, typed corrupt-tolerant `fm:*` pref wrappers, 6 new bilingual i18n keys, and the live `profiles.weekly_goal` column (NOT NULL DEFAULT 3 CHECK 1..7) with regenerated types and cross-user RLS coverage.

## What Was Built

**Task 1 — Pure helpers + Wave-0 unit tests** (commit `caf0f75`)
- `lib/units.ts`: `toDisplayWeight(kg, unit)` (metric passthrough; imperial = kg/0.45359237 rounded to nearest 0.5; non-finite → 0), `formatWeight` with `kg`/`lb` suffix, `UnitPref` type. Pure, no React, no side effects (D-01, Pitfall 5).
- `lib/resolve-language.ts`: `resolveLanguageCore(pref, deviceLang)` — pure, Node-importable (no Expo/RN imports). Explicit `'sv'`/`'en'` pass through; `'system'` → `'sv'` for Swedish device, `'en'` otherwise (D-10/D-11).
- `lib/i18n.ts`: added `export function resolveLanguage(pref, deviceLang?)` delegating to the core (supplying the live `Localization.getLocales()` locale by default) + `LanguagePref` re-export. Init block (`fallbackLng: "sv"`) untouched.
- `scripts/test-units.ts` (10 cases) + `scripts/test-locale-resolve.ts` (7 cases): pure Case[]-table runners mirroring `test-auth-schemas.ts`. Wired as `test:units` + `test:locale-resolve` in `package.json`.

**Task 2 — Typed prefs + i18n keys** (commit `9a5d47a`)
- `lib/prefs.ts`: typed `getPref`/`setPref` over `fm:units` (default metric), `fm:language` (default system), `fm:haptics` (default ON, D-08), `fm:notifications` (default OFF, D-07). Every read uses `z.enum(...).catch(default).parse(v)` (never throws on tampered/null — T-09-01/02). Booleans stored as `"true"`/`"false"` strings + enum-catch — NO `JSON.parse`. Writes are fail-soft `void setItem(...).catch(console.warn)`.
- 6 new keys added to BOTH `sv.json` + `en.json` in the same edit (parity gate): `weeklyGoal`, `sessionsPerWeek`, `increment`, `decrement`, `showPassword`, `hidePassword`. Parity holds at 99 keys.

**Task 3 — Live migration + types + RLS** (commit `e652a82`)
- `0007_profiles_weekly_goal.sql`: `alter table public.profiles add column weekly_goal int not null default 3 check (weekly_goal between 1 and 7);`. NO new policy — own-row profiles policies (0001) cover the column.
- Pushed live to `mokmiuifpdzwnceufduu` via `npx supabase db push` (succeeded non-interactively — the checkpoint did not require orchestrator handoff). Verified live: column `integer`, `NOT NULL`, `DEFAULT 3`, `CHECK ((weekly_goal >= 1) AND (weekly_goal <= 7))`.
- `types/database.ts` regenerated via `npm run gen:types` — `weekly_goal: number` present in profiles Row/Insert/Update.
- `test-rls.ts` extended: cross-user `weekly_goal` UPDATE blocked (T-09-03) + own-row weekly_goal update success.

## Verification Results

| Gate | Result |
|------|--------|
| `npm run test:units` | PASS — 10/10 cases (incl. 100→220.5 lb, non-finite→0) |
| `npm run test:locale-resolve` | PASS — 7/7 cases (incl. system/de→en) |
| `npm run check:locale-parity` | PASS — sv/en match at 99 keys |
| `npm run test:rls` | PASS — all assertions incl. weekly_goal cross-user blocked + own-row success |
| `verify-deploy.ts` | PASS — profiles RLS ON, own-row update policy (using+with_check) intact |
| live column check | PASS — integer NOT NULL DEFAULT 3 CHECK 1..7 |
| `npx tsc --noEmit` | clean |
| `npm run lint` | clean (exit 0) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] resolveLanguage extracted to a pure Node-importable core**
- **Found during:** Task 1 (running `npm run test:locale-resolve`)
- **Issue:** The plan specified the test import `resolveLanguage` from `lib/i18n.ts`. Importing `lib/i18n.ts` under Node `tsx` fails — it imports `expo-localization` → `react-native`, whose untranspiled JSX/flow esbuild cannot transform (`Transform failed ... Unexpected "typeof"` in react-native/index.js). The module-load `i18n.init({ lng: Localization.getLocales()... })` side effect makes any import of i18n.ts pull in RN.
- **Fix:** Extracted the pure mapping into `lib/resolve-language.ts` (`resolveLanguageCore`, no Expo/RN imports). `lib/i18n.ts` keeps `export function resolveLanguage(pref, deviceLang?)` as a thin wrapper that supplies the live device locale and delegates to the core — so screen code keeps the single `@/lib/i18n` import surface and the acceptance criterion "`lib/i18n.ts` contains `export function resolveLanguage`" still holds literally. `scripts/test-locale-resolve.ts` imports `resolveLanguageCore` (aliased to `resolveLanguage`) from the pure module.
- **Files modified:** app/lib/resolve-language.ts (new), app/lib/i18n.ts, app/scripts/test-locale-resolve.ts
- **Commit:** caf0f75

**2. [Rule 1 - Bug] null→undefined coercion in i18n.resolveLanguage wrapper**
- **Found during:** Task 1 (`tsc --noEmit`)
- **Issue:** `Localization.getLocales()[0]?.languageCode` is `string | null`, but the pure core's `deviceLang` param is `string | undefined` (TS2345).
- **Fix:** `?? undefined` appended to coerce `null` to `undefined` before delegating.
- **Commit:** caf0f75

**3. [Rule 1 - Bug] setPref ternary widening to string|boolean**
- **Found during:** Task 2 (`tsc --noEmit`)
- **Issue:** `const stored = typeof value === "boolean" ? ... : value` — TS kept `value` as `string | boolean` in the false branch (TS2345 against `setItem(string)`).
- **Fix:** Annotated `const stored: string`; the non-boolean branch (`UnitPref | LanguagePref` string literals) is assignable to `string`.
- **Commit:** 9a5d47a

## Checkpoint Resolution

Task 3 was a `checkpoint:human-action` blocking gate (push 0007 live). The push completed non-interactively: `npx supabase db push` with empty stdin defaulted the `[Y/n]` prompt to Yes and applied the migration successfully (`Finished supabase db push.`, exit 0). Per the orchestrator note, this means the executor proceeded with `gen:types` → `test:rls` → `verify-deploy` and finished the plan normally — no orchestrator handoff or MCP `apply_migration` was required.

## Known Stubs

None. All exports are wired and tested; the live column is consumable by Plan 09-02.

## Threat Flags

None — no new security surface beyond the plan's `<threat_model>`. The `weekly_goal` write crosses the existing profiles RLS boundary (covered by own-row policy + the new cross-user blocked assertion); the DB CHECK clamps 1..7 (T-09-05 defense-in-depth). Zero package installs (T-09-SC).

## Self-Check: PASSED

All 7 created/key files exist on disk; all 3 task commits (`caf0f75`, `9a5d47a`, `e652a82`) present in git history.
