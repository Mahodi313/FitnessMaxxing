---
phase: 08-forge-foundation
plan: 04
subsystem: ui
tags: [forge-components, nativewind, design-system, token-driven, fit-66, settings-row, tabbar, react-i18next, tnum, dsgn-04]

# Dependency graph
requires:
  - phase: 08-forge-foundation
    plan: 02
    provides: "forge.* token palette in tailwind.config.js (colors light+dark, fontFamily display/mono, forge-sm/md/lg/xl radii, forge.tabBg) consumed verbatim — no hardcoded palette"
  - phase: 08-forge-foundation
    plan: 03
    provides: "Icon.tsx (33-name IconName union) composed into ForgeButton/Field/Card/Stat/Chip/SettingsRow/TabBar leading/trailing/tile/chevron slots"
  - phase: 08-forge-foundation
    plan: 01
    provides: "tnum tabular-numeral helper (lib/utils/format.ts) applied to ForgeStat value; react-i18next runtime for TabBar labels"
  - phase: 06-history-read-side-polish
    provides: "segmented-control.tsx FIT-66 token-driven Pressable idiom (conditional-className + pressed style-callback + explicit shadow object) — the template every Forge pressable mirrors"
provides:
  - "ForgeButton.tsx — variant primary|secondary|ghost|destructive × size lg|md|sm, explicit token-driven props, FIT-66 pressed callback + accentShadow object, optional leading/trailing Icon, loading spinner, a11y"
  - "ForgeField.tsx — controlled TextInput (value/onChangeText), state enum default|focused|error driving border, optional leading Icon slot, multiline"
  - "ForgeCard.tsx — padding/radius/tint(surface|accentSoft) enums + interactive (FIT-66 Pressable + chevron) container shell"
  - "ForgeStat.tsx — UPPERCASE eyebrow label + font-display-bold tnum value + unit + success/danger delta pill; size/align enums (key_link: tnum on numeral)"
  - "ForgeChip.tsx — default|accent|success variant pill with optional accent leading Icon"
  - "SettingsRow.tsx — SettingsRow (icon tile + label + value/chevron/toggle/control variants, last-row border suppression) + SettingsSection (UPPERCASE header + rounded group); 44×26 toggle is a FIT-66 Pressable, accessibilityRole=switch"
  - "TabBar.tsx — STANDALONE presentational tab shell (plans/history/settings), i18n labels via useTranslation, active/onSelect props; NOT wired to live <Tabs> (OQ-5)"
affects: [08-05-forge-gallery, forge-components, settings-language-picker, phase-09-plans-reskin, phase-11-settings-reskin]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Token-driven Record<Variant,string> / Record<Size,string> class maps selected by explicit enum props (D-02), mirroring segmented-control's conditional-className idiom — no className passthrough"
    - "Light+dark parity convention ESTABLISHED for forge.* tokens: base class = `-light` suffix token (light hex), `dark:` sibling = DEFAULT token (dark value). e.g. `bg-forge-surface-light dark:bg-forge-surface`. Config DEFAULT is dark, `light` suffix is the light hex (tailwind OQ-3); this plan is the first forge.* consumer so it sets the pattern for Plans 05+ and Phases 9-12"
    - "FIT-66 across every pressable (ForgeButton, interactive ForgeCard, SettingsRow row + toggle, TabBar tab): pressed feedback via `Pressable style={({pressed})=>...}` callback + explicit iOS shadow STYLE object (accentShadow) — never active:/shadow- NativeWind classes (T-08-08)"
    - "tnum readonly-tuple → mutable TextStyle bridge: `{ fontVariant: [...tnum.fontVariant] }` at the use-site copies the Plan-01 `as const` tuple into a fresh mutable array so RN's TextStyle.fontVariant (mutable FontVariant[]) type-checks, without mutating the shared format.ts artifact"
    - "TabBar i18n labels via react-i18next useTranslation() — first useTranslation consumer in the app (I18N-01)"

key-files:
  created:
    - app/components/ui/ForgeButton.tsx
    - app/components/ui/ForgeField.tsx
    - app/components/ui/ForgeCard.tsx
    - app/components/ui/ForgeStat.tsx
    - app/components/ui/ForgeChip.tsx
    - app/components/ui/SettingsRow.tsx
    - app/components/ui/TabBar.tsx
  modified: []

key-decisions:
  - "Light+dark token convention: base class uses the `-light` suffix token (light hex) with a `dark:` sibling on the DEFAULT (dark) token — `bg-forge-surface-light dark:bg-forge-surface`. tailwind.config DEFAULT is dark and `light` is the light-hex suffix (OQ-3); pairing them this way gives correct light+dark parity. No prior forge.* consumer existed, so this plan establishes the convention for all downstream forge components."
  - "tnum applied via a fresh mutable copy `{ fontVariant: [...tnum.fontVariant] }` (aliased TNUM) — the Plan-01 helper's `as const` tuple is a readonly type RN's mutable TextStyle.fontVariant rejects. Copying at the use-site keeps the shared format.ts artifact (a prior-wave file) untouched. tnum is still imported from @/lib/utils/format and applied to the value Text (key_link satisfied)."
  - "ForgeButton takes an explicit `label: string` prop (not children) so a11y accessibilityLabel + numberOfLines truncation are guaranteed and the variant/size class maps stay the single styling authority (D-02 explicit-prop API)."
  - "TabBar is built standalone with `active`/`onSelect` props (gallery-demoable) and is NOT imported by the live (tabs)/_layout.tsx — OQ-5 / T-08-09 phase boundary preserved (no navigation-behavior change). Live re-skin lands in Phase 9+."

patterns-established:
  - "Forge primitive shape: file-header rationale block citing UI-SPEC/PATTERNS lines + forge-screens.jsx source line; token-driven enum→class Record maps; light+dark parity on every color class; FIT-66 on every pressable"
  - "Light+dark forge.* parity: `<prop>-forge-<token>-light dark:<prop>-forge-<token>`"

requirements-completed: [DSGN-04]

# Metrics
duration: ~18min
completed: 2026-06-10
---

# Phase 8 Plan 04: Forge Component Library Primitives Summary

**Seven token-driven, explicit-prop Forge primitives — ForgeButton (4 variants × 3 sizes), ForgeField (3 states), ForgeCard, ForgeStat (tnum), ForgeChip, SettingsRow + SettingsSection, and a standalone TabBar shell — each composing the Wave 3 Icon and Wave 2 forge.* tokens, with FIT-66 honored on every pressable, full light+dark parity, and the live <Tabs> left untouched (OQ-5).**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-10
- **Completed:** 2026-06-10
- **Tasks:** 3 (all auto, no checkpoints)
- **Files modified:** 7 (all created)

## Accomplishments
- **Task 1 — interactive primitives:** `ForgeButton` with the full 4-variant (`primary|secondary|ghost|destructive`) × 3-size (`lg|md|sm`) matrix via token-driven `Record<Variant,string>` / `Record<Size,string>` class maps (D-02 explicit-prop API), an explicit `accentShadow` iOS shadow object on `primary` and a `Pressable` pressed-style callback (FIT-66 — no `active:`/`shadow-` classes), optional leading/trailing `Icon`, a loading `ActivityIndicator`, and a11y role/state/label. `ForgeField` is a controlled `TextInput` (`value`/`onChangeText`) whose `state` enum (`default|focused|error`) selects the border class (focused = `border-2` accent), with an optional leading `Icon` slot, `multiline`, and placeholder→a11y-label.
- **Task 2 — static primitives:** `ForgeCard` (`padding`/`radius`/`tint` surface|accentSoft enums + `interactive` FIT-66 Pressable with chevron); `ForgeStat` (UPPERCASE eyebrow label + `font-display-bold` `tnum` value + unit + success/danger delta pill, `size`/`align` enums); `ForgeChip` (`default|accent|success` variant pill with optional accent leading `Icon`). Every color class carries a `dark:` sibling for light+dark parity.
- **Task 3 — settings + tab shell:** `SettingsRow` (28×28 accent-soft icon tile + 15px accent `Icon`, label + `value`/`chevron`/`toggle`/`control` variants, `last` border suppression) and `SettingsSection` (UPPERCASE header + rounded surface group) exported from one file; the 44×26 toggle is a custom FIT-66 `Pressable` (`accessibilityRole="switch"`, knob position via `transform`). `TabBar` is a STANDALONE presentational shell (plans/history/settings, `useTranslation` labels, `active`/`onSelect` props) — deliberately NOT imported by the live `(tabs)/_layout.tsx` (OQ-5).

## Task Commits

Each task was committed atomically:

1. **Task 1: ForgeButton + ForgeField** — `804d1bc` (feat) [FIT-78]
2. **Task 2: ForgeCard + ForgeStat + ForgeChip** — `5b41a8c` (feat) [FIT-78]
3. **Task 3: SettingsRow + SettingsSection + TabBar shell** — `60aa639` (feat) [FIT-78]

## Files Created/Modified
- `app/components/ui/ForgeButton.tsx` (created, Task 1) — 4-variant × 3-size CTA; token-driven class maps; FIT-66 pressed callback + `accentShadow` object; optional Icon; loading spinner; a11y.
- `app/components/ui/ForgeField.tsx` (created, Task 1) — controlled `TextInput`; `state` enum → border; leading Icon; multiline; light+dark parity.
- `app/components/ui/ForgeCard.tsx` (created, Task 2) — `padding`/`radius`/`tint` enums + `interactive` FIT-66 Pressable with chevron; surface|accentSoft tint.
- `app/components/ui/ForgeStat.tsx` (created, Task 2) — eyebrow label + `font-display-bold` `tnum` value + unit + delta pill; `size`/`align` enums.
- `app/components/ui/ForgeChip.tsx` (created, Task 2) — `default|accent|success` variant pill + accent leading Icon.
- `app/components/ui/SettingsRow.tsx` (created, Task 3) — `SettingsRow` + `SettingsSection`; icon tile, value/chevron/toggle/control variants, FIT-66 toggle (switch a11y).
- `app/components/ui/TabBar.tsx` (created, Task 3) — standalone tab shell; i18n labels; `active`/`onSelect`; not wired to live tabs (OQ-5).

## Decisions Made
- **Light+dark token convention established** (first forge.* consumer): base = `-light` suffix token, `dark:` = DEFAULT token (`bg-forge-surface-light dark:bg-forge-surface`). Downstream forge components (Plan 05 gallery, Phases 9-12 re-skins) follow this.
- **tnum mutable-copy bridge** (`{ fontVariant: [...tnum.fontVariant] }`) so the Plan-01 `as const` readonly tuple type-checks against RN's mutable `TextStyle.fontVariant` without editing the shared `format.ts` artifact. `tnum` is still imported and applied to the value Text (key_link satisfied).
- **ForgeButton uses an explicit `label` prop** (not children) to guarantee a11y label + truncation and keep the variant/size class maps the single styling authority (D-02).
- **TabBar standalone, not wired to live `<Tabs>`** (OQ-5 / T-08-09) — preserves the no-navigation-change phase boundary; live re-skin is Phase 9+.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tnum readonly-tuple vs mutable TextStyle.fontVariant type error**
- **Found during:** Task 2 (ForgeStat implementation)
- **Issue:** The Plan-01 `tnum` helper declares `fontVariant: ['tabular-nums'] as const` (readonly tuple). Passing it directly as a `<Text>` `style` failed `tsc` (TS2769/TS2352): RN's `TextStyle.fontVariant` is a mutable `FontVariant[]`, and the readonly tuple is not assignable (and a direct `as TextStyle` cast was rejected for insufficient overlap).
- **Fix:** Aliased a use-site constant `const TNUM: TextStyle = { fontVariant: [...tnum.fontVariant] }` — a fresh mutable array copy — and applied `TNUM` to the value Text + delta Text. `format.ts` (a prior-wave artifact) left untouched.
- **Files modified:** app/components/ui/ForgeStat.tsx
- **Verification:** `cd app && npx tsc --noEmit` exits 0; `tnum` import + `font-display-bold` greps pass.
- **Committed in:** `5b41a8c` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking type error)
**Impact on plan:** The fix was required for the task to compile and keeps the shared format.ts helper unmodified. No scope creep — the component API and styling match the plan exactly.

## Issues Encountered
- Two lint warnings surfaced on the Task 3 run (`import/first` on ForgeStat's TNUM const placed mid-file, and an unused `TEXT2_LIGHT` in SettingsRow). Both fixed before the Task 3 commit (moved TNUM below all imports; removed the unused constant). Final `tsc` + `expo lint` both exit 0 with 0 errors / 0 warnings.

## Threat Model Compliance
- **T-08-08 (Tampering/stability — pressables using NativeWind active:/shadow-):** Mitigated. Every pressable (ForgeButton, interactive ForgeCard, SettingsRow row + 44×26 toggle, TabBar tab) uses a `Pressable style={({pressed})=>...}` callback for pressed feedback and an explicit iOS shadow STYLE object (`accentShadow`) for the primary button glow. `grep` for `active:opacity`/`shadow-(sm|md|lg|xl)` in code returns 0 across all 7 files (the only matches are in FIT-66 rationale comments).
- **T-08-09 (Elevation/behavior drift — TabBar wired to live <Tabs>):** Mitigated. `TabBar.tsx` is standalone presentational with `active`/`onSelect` props; `grep "ui/TabBar"` on `app/app/(app)/(tabs)/_layout.tsx` returns 0 — live routing untouched (OQ-5).

No new threat surface beyond the plan's register. All Phase 8 props are app-controlled; no external/user input flows through these primitives.

## Verification Results
- `cd app && npx tsc --noEmit` → exit 0 (after each task).
- `cd app && npm run lint` (expo lint) → exit 0, **0 errors / 0 warnings**.
- FIT-66: `grep "active:opacity\|shadow-(sm|md|lg|xl)"` in code across all 7 components → 0 (matches are comment-only); pressed-callback present on ForgeButton.
- ForgeButton exports the 4-variant + 3-size unions; ForgeField uses controlled `value`/`onChangeText` + `state` border.
- ForgeStat imports `tnum` from `@/lib/utils/format` and applies it with `font-display-bold` (key_link); ForgeChip 3-variant union present; ForgeCard `tint` + `interactive` present.
- SettingsRow exports both `SettingsRow` and `SettingsSection`; toggle uses `accessibilityRole="switch"` + style-callback.
- TabBar uses `t(key)` for labels + `active`/`onSelect`; live `(tabs)/_layout.tsx` does NOT import `ui/TabBar` (grep → 0).
- No dependency bumps: this plan's 3 commits (`804d1bc^..HEAD`) touch only the 7 component files — `app/package.json`, `app/package-lock.json`, and `app/lib/query/*` (F13) unchanged.

## User Setup Required
None — no external service configuration. (Restart Metro before opening the Plan 05 gallery so the 7 new files bundle — a dev convenience, not a config step.)

## Next Phase Readiness
- DSGN-04 (core component library) closed. Plan 08-05 (gallery) can import all 7 primitives and render each variant/size in both themes for manual UAT (D-06/D-07), plus the sv↔en toggle proving TabBar's `useTranslation` labels flip live.
- The light+dark forge.* parity convention (`-light` base + `dark:` DEFAULT) is set for every downstream forge consumer.
- TabBar is ready to be wired into the live `<Tabs>` in Phase 9+ (currently standalone, OQ-5).
- F13 untouched; no new dependency added.

## Self-Check: PASSED

All 7 created files verified present on disk (ForgeButton/ForgeField/ForgeCard/ForgeStat/ForgeChip/SettingsRow/TabBar); all 3 task commits (`804d1bc`, `5b41a8c`, `60aa639`) verified in git history. tsc + expo lint both exit 0; FIT-66 honored on every pressable; live <Tabs> not wired (OQ-5); no dependency bumps.

---
*Phase: 08-forge-foundation*
*Completed: 2026-06-10*
