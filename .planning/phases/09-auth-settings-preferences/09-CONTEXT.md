# Phase 9: Auth, Settings & Preferences - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Re-skin the two existing auth screens (sign-in, sign-up) to the Forge design, and build the **new Settings screen + the preference layer** every later v2.0 screen depends on: units (kg/lbs), weekly session goal, language, theme, haptics, notifications, and sign-out.

**In scope:** SKIN-01 (Forge re-skin of sign-in/sign-up, light + dark), SET-01..09 (Settings screen + profile view + all preference controls + sign-out), I18N-02 (device-locale default + Settings language override). Lands the deferred `0007_profiles_weekly_goal` migration (Phase 8 D-12) because SET-04 persists to `profiles.weekly_goal`. Builds the canonical kg↔display **conversion/format helper** and the `fm:units` / `fm:haptics` pref reads.

**Out of scope (own phases):**
- Applying the unit-conversion helper and the haptics gate to **existing** weight-displaying / haptic call sites (active workout, history, chart) — those screens adopt the helper/gate when they are re-skinned in **Phases 11 & 12**. Phase 9 builds the helper + pref and applies them only to net-new Phase 9 surfaces.
- `expo-notifications` install + OS permission request + any real notification delivery — **Phase 14** (rest timer) owns the dependency and the permission UX. SET-07 in Phase 9 is a stored pref only.
- The Home activity ring that *consumes* `weekly_goal` — **Phase 12** (dashboard). Phase 9 only persists the goal value.
- Editing the profile display name — SET-02 is view-only; a name-edit flow is a new capability (deferred).
- F13 hot path — untouched. `npm run test:f13-brutal` must stay green.

</domain>

<decisions>
## Implementation Decisions

### Units & conversion (SET-03)
- **D-01:** Storage stays canonical **kg** everywhere; display converts per the `fm:units` pref. lbs are rounded to the **nearest 0.5 lb** (e.g. 100 kg → 220.5 lb). kg displays unchanged.
- **D-02:** Phase 9 builds the **pref (`fm:units`, default Metric/kg)** + a single canonical **kg↔display conversion/format helper**, and applies it only to net-new Phase 9 surfaces. Existing weight-displaying screens (active workout, history, chart) adopt the helper when re-skinned in Phases 11/12 — **no retrofit / no hot-path touch this phase.**
- **D-03:** Units control is the existing **SegmentedControl** (re-skinned to Forge), two-state Metric (kg) / Imperial (lbs).

### Weekly goal (SET-04) + migration
- **D-04:** The deferred **`0007_profiles_weekly_goal.sql`** migration lands **in this phase** (necessity — SET-04's success criterion persists to `profiles.weekly_goal`). Column: `weekly_goal int NOT NULL DEFAULT 3 CHECK (weekly_goal BETWEEN 1 AND 7)`. Follows DB conventions: migration-as-truth, `gen:types` in the same commit, `verify-deploy.ts` after push, and an updated **cross-user `test:rls` assertion** for the new column on `profiles`.
- **D-05:** Goal input is a **`+/-` stepper** in a SettingsRow. UI clamps **1–7**; default 3.
- **D-06:** Phase 9 only **persists** the goal — the Home activity ring that reads it is Phase 12.

### Notifications & haptics (SET-06 / SET-07)
- **D-07:** **Notifications (SET-07) = stored pref only.** Toggle writes `fm:notifications` (Zod-guarded bool). **No `expo-notifications` install, no OS permission prompt** this phase — both defer to Phase 14, which reads the pref AND requests permission when it wires local notifications. (Avoids prompting for a permission nothing uses yet.)
- **D-08:** **Haptics (SET-06) = pref + live gate, no retrofit.** Toggle writes `fm:haptics` (default **on**). Settings interactions and any **new** haptic calls check the pref; **existing** v1 `expo-haptics` call sites adopt the gate as their screens are re-skinned (11/12). `expo-haptics` is already installed.
- **D-09:** Both toggles render as iOS-style **switches**.

### Language & locale (SET-05 / I18N-02)
- **D-10:** Language control is **three-state: System / Svenska / English** (mirrors the theme control). `fm:language` stores `'system' | 'sv' | 'en'`.
- **D-11:** **`System` resolves** via `expo-localization`: Swedish device locale → `sv`; **any other locale → English fallback** (the two bundled languages are sv + en). Matches i18next `fallbackLng: 'en'`.
- **D-12:** Switching language updates app text **live via `i18n.changeLanguage()` — no restart.** New strings introduced this phase go through `t()` against the keys already in `locales/{sv,en}.json` (built in Phase 8).

### Settings screen structure
- **D-13:** Section order (top → bottom), using the Phase 8 `SettingsSection`: **Profile → Appearance (theme + language) → Workout (units + weekly goal) → Notifications (haptics + notifications) → Sign-out**.
- **D-14:** Widget mapping: **SegmentedControl** for theme (3) / language (3) / units (2); **stepper** for weekly goal; **switches** for haptics + notifications. Built from Phase 8 `SettingsRow` / `SettingsSection` / `TabBar` and the re-skinned `SegmentedControl`.
- **D-15:** **Profile (SET-02) is read-only:** show display name + email; when `display_name` is null, show email only. No name-edit flow.
- **D-16:** **Sign-out (SET-09):** neutral/secondary `ForgeButton` pinned at the **bottom** of Settings; **no confirmation dialog** (locked — non-destructive, reversible). Keeps the existing Phase 3 sign-out logic (`useAuthStore.signOut()` → `queryClient.clear()` → `supabase.auth.signOut()` → `Stack.Protected` re-eval; no imperative navigation).

### Auth re-skin (SKIN-01)
- **D-17:** **Pure visual re-skin** of sign-in / sign-up to Forge using `forge-screens.jsx` as the layout/API reference. The Phase 3 auth flow, **RHF + Zod validation, and copy are unchanged.**
- **D-18:** **Errors:** field-level validation renders **inline beneath each `ForgeField`**; server auth failures (wrong credentials, etc.) render as a **form-level message above the submit button**.
- **D-19:** **Submit button** shows an inline **spinner and is disabled** during the async auth call (prevents double-submit).

### Claude's Discretion
- Exact `fm:*` AsyncStorage read/write wiring + Zod guards — follow the established `fm:theme` enum-catch pattern in `settings.tsx`.
- Naming/location of the units helper (`lib/units.ts` or similar) and the prefs store/hook shape — follow existing `lib/*-store.ts` Zustand + AsyncStorage conventions.
- Precise Forge token/class choices per control — planner follows `lib.jsx` `THEMES.forge` + the spec.
- Whether language/units prefs live in a shared prefs store or per-key reads — planner's call, consistent with how `fm:theme` is read today.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase definition
- `.planning/ROADMAP.md` → "Phase 9: Auth, Settings & Preferences" — goal + 4 success criteria (auth parity light/dark; Settings screen contents; kg/lbs display with canonical-kg storage + `weekly_goal` persistence; live language override).
- `.planning/REQUIREMENTS.md` → rows **SKIN-01, SET-01..SET-09, I18N-02**.

### Design source of truth (read first)
- `app/design v2/Sources/design/forge-screens.jsx` — auth screen layout + component **variant/size API**; the `surface`/`border` card + accent-button patterns the Settings screen composes from. (No dedicated full Settings screen exists in the 17 references — compose from Phase 8 primitives.)
- `app/design v2/Sources/design/lib.jsx` — `THEMES.forge` tokens, `numStyle` (tabular nums), and the `I18N.sv`/`I18N.en` map already transcribed into `locales/*.json`.
- `app/design v2/Sources/design/Forge Design Spec.html` — annotated spec; scope to the form-error / settings / auth sections.
- `app/design v2/Sources/design/README.md` — migration order + brand vs content-icon rules.

### Architecture & stack (locked decisions — do not re-derive)
- `.planning/research/ARCHITECTURE.md` — §7 i18n (react-i18next + expo-localization, `lib/i18n.ts`, `fallbackLng`, `changeLanguage`), §1 tokens, §2 fonts. The Phase 9 file list if present.
- `.planning/research/STACK.md` — pinned versions; confirms `expo-haptics`/`expo-localization`/`react-i18next` installed, **`expo-notifications` NOT** (defer to Phase 14).
- `.planning/research/PITFALLS.md` — Tailwind-v4-breaks-NativeWind (stay on Tailwind 3).

### Phase 8 carry-forward (locked)
- `.planning/phases/08-forge-foundation/08-CONTEXT.md` — D-12 (weekly_goal migration deferral, now resolved here), component library, i18n scaffold, `SettingsRow`/`SettingsSection`/`TabBar` build-only primitives, `fm:*` AsyncStorage convention.

### Database conventions (MUST follow for the 0007 migration)
- `CLAUDE.md` → "Database conventions" + "Security conventions" — migration-as-truth, RLS `(select auth.uid())` + `with check`, `gen:types` co-commit, `verify-deploy.ts`, cross-user `test:rls` extension for `profiles.weekly_goal`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/app/(app)/(tabs)/settings.tsx` — current Settings tab (theme SegmentedControl + `fm:theme` enum-catch read + `setColorScheme`, dev gallery entry, sign-out). The theme block + the Zod-enum-catch AsyncStorage pattern is the template for the new prefs. Re-skin and extend this file.
- `app/components/segmented-control.tsx` — reused (re-skinned to Forge) for theme / language / units.
- `app/components/ui/*` (Phase 8) — `SettingsRow`, `SettingsSection`, `TabBar`, `ForgeButton`, `ForgeField`, `ForgeCard`, `ForgeChip` — compose the Settings screen + re-skin auth from these.
- `app/lib/auth-store.ts` — `signOut()` + `session.user.email`; reused as-is for SET-02 profile email + SET-09 sign-out.
- `app/lib/i18n.ts`, `app/locales/{sv,en}.json` — i18n scaffold + full bilingual map already in place; Phase 9 wires `t()` + the language override.
- `app/app/(auth)/sign-in.tsx`, `sign-up.tsx`, `(auth)/_layout.tsx` — existing RHF+Zod auth screens to re-skin (logic unchanged).
- `app/types/database.ts` — `profiles` row has `display_name: string | null`; **no `weekly_goal` yet** — added by the 0007 migration.

### Established Patterns
- **AsyncStorage `fm:*` prefs** with Zod `enum/boolean.catch(default).parse(value)` on read (see `fm:theme` in `settings.tsx`) — apply to `fm:units`, `fm:language`, `fm:haptics`, `fm:notifications`.
- **Theme/dark-light** already wired (`darkMode: "class"` + NativeWind `useColorScheme`); auth + settings re-skins use `dark:` variants — no theming infra change.
- **Migration discipline** — numbered SQL in `app/supabase/migrations/` (next = `0007_*`), `npm run gen:types`, `verify-deploy.ts`, `test:rls` extension. Studio is read-only.

### Integration Points
- `app/supabase/migrations/0007_profiles_weekly_goal.sql` (new) → `app/types/database.ts` (regen) → `app/scripts/test-rls.ts` (new assertion).
- New: `app/lib/units.ts` (kg↔display helper), prefs read/write wiring (units/haptics/notifications/language) following the `fm:theme` pattern.
- `app/lib/i18n.ts` ← language override (`changeLanguage`) driven by `fm:language` + `expo-localization` resolution.
- Settings screen ← Phase 8 `SettingsSection`/`SettingsRow` + re-skinned `SegmentedControl` + stepper + switches.
- **F13 risk: NONE** — additive/presentational; no mutation defaults, query keys, or persister touched. `test:f13-brutal` stays green.

</code_context>

<specifics>
## Specific Ideas

- lbs round to **nearest 0.5** — plate-gym granularity, avoids noisy decimals in dense set rows.
- Language + theme controls should feel like siblings (both three-state SegmentedControls, "System" first).
- Sign-out is deliberately low-emphasis (neutral, no confirm) — it's reversible by signing back in.
- Settings groups by mental model: who you are → how it looks → how you train → what it pings → leave.

</specifics>

<deferred>
## Deferred Ideas

- **Apply the kg↔display unit helper to existing weight-display screens** (active workout, history, chart) — Phases 11 & 12 (adopt during re-skin).
- **Gate existing `expo-haptics` call sites behind `fm:haptics`** — Phases 11/12 (adopt during re-skin).
- **`expo-notifications` install + OS permission request + real notification delivery** — Phase 14 (rest timer).
- **Home activity ring consuming `weekly_goal`** — Phase 12 (dashboard).
- **Editing the profile display name** — new capability; not in SET-02 (view-only). Future phase if wanted.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 9-Auth, Settings & Preferences*
*Context gathered: 2026-06-11*
