# Phase 15: Bilingual & Release Hardening - Research

**Researched:** 2026-06-16
**Domain:** i18n completeness tooling, release-candidate device UAT, motion-table gap closure (Expo SDK 54 / react-i18next / Reanimated 4)
**Confidence:** HIGH (all claims verified against live code; one i18next API option confirmed via official docs)

## Summary

This is a hardening/closeout phase — no new features. The work is *proving* i18n
completeness, closing the few genuine gaps, and applying the one genuinely-missing
motion-table animation. Verification against the live code confirms the CONTEXT.md
decisions are sound and the scope is small:

- **i18n tooling (D-01):** `check-locale-parity.ts` already proves sv↔en key-set parity (205 keys). The NEW `test:i18n-coverage` gate is a *stronger, orthogonal* check: it must enumerate every `t('...')` literal across `app/app/**` + `app/components/**`, assert each exists in `sv.json`, AND flag user-visible JSX literals bypassing `t()`. The codebase has 359 `t()` calls across 17 files. Two real complications exist: (a) **nested namespaces** `exercise.*` and `equip.*` accessed via *runtime-concatenated* keys (`t('exercise.' + seed_key + '.name')`), and (b) **dynamic `t(variable)` calls** (`t(labelKey)`, `t(exerciseNameKey(...))`). Both are unresolvable statically and MUST be whitelisted/excluded or the scan false-fails.
- **missingKeyHandler (D-04):** `app/lib/i18n.ts` init is a clean synchronous block. i18next exposes a top-level `missingKeyHandler` option (requires `saveMissing: true`) — add it `__DEV__`-gated with `console.error`, leaving `fallbackLng: 'sv'` and the init structure untouched.
- **I18N-02 (D-02):** `resolveLanguageCore` + `test-locale-resolve.ts` (7 cases) + the `_layout.tsx` `LocaleBootstrap` already implement and test the D-11 mapping fully. I18N-02 needs *verification during UAT* and a requirement-row flip to Complete — minimal-to-no code.
- **Motion (D-07/D-08):** Of 8 motion rows, **7 are already satisfied** — including plan-row reorder (`ScaleDecorator` is already wired in `plans/[id].tsx:552`). The **single genuine gap is the tab-bar icon scale 0.92→1** in `(tabs)/_layout.tsx`, which sits outside the hot path.

**Primary recommendation:** Build `test:i18n-coverage` as a regex-based tsx scanner (cloning `check-locale-parity.ts`) with an explicit exclusion list for the two nested namespaces and dynamic-key call sites; add a `__DEV__` `missingKeyHandler`; apply ONLY the tab-bar icon scale animation; extend `test-locale-resolve.ts` if any D-11 case is uncovered; wire `test:i18n-coverage` into `phase-branch.yml`; and drive the four-combo device UAT through a `15-UAT.md` matrix.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| t()-key coverage scan | Node script (build-time) | CI | Static-analysis gate; never Metro-bundled (CLAUDE.md Node-script isolation) |
| missingKeyHandler | Client (i18next runtime, `__DEV__` only) | — | Dev-time loudness; must not ship to production bundle |
| Language resolution (D-11) | Client (`resolve-language.ts` pure core) | Node test | Pure mapping; Node-importable for `test-locale-resolve.ts` |
| Tab-bar icon scale animation | Client (Reanimated UI thread / worklet) | — | UI-thread worklet; outside the log-a-set write path (D-08) |
| Release-regression gate | CI (`phase-branch.yml`) | local npm scripts | Joins tsc/lint/RLS + `test:f13-brutal` as final gate (D-03) |
| Device UAT (sv/en × light/dark) | Manual (real iPhone) | `15-UAT.md` artifact | Catches layout breakage + wrong-translation that static analysis cannot (D-01 manual half) |

## Standard Stack

No new dependencies. Everything needed is already installed (verified `app/package.json`):

| Library | Installed Version | Purpose in Phase 15 | Source |
|---------|-------------------|---------------------|--------|
| `i18next` | `^26.3.1` | `missingKeyHandler` + `saveMissing` options (D-04) | [VERIFIED: package.json] |
| `react-i18next` | `^17.0.8` | `useTranslation()`/`t()` (unchanged) | [VERIFIED: package.json] |
| `react-native-reanimated` | `~4.1.1` | Tab-bar icon scale worklet (D-07) | [VERIFIED: package.json] |
| `react-native-worklets` | `0.5.1` | Reanimated 4 worklet runtime | [VERIFIED: package.json] |
| `react-native-draggable-flatlist` | `^4.0.3` | `ScaleDecorator` (already wired — no change) | [VERIFIED: package.json] |
| `tsx` | `^4.21.0` | runs the new `test:i18n-coverage` Node script | [VERIFIED: package.json] |
| `expo-localization` | `~17.0.9` | device-locale read in `resolveLanguage` wrapper (unchanged) | [VERIFIED: package.json] |

**Installation:** None. This phase adds no packages.

## Package Legitimacy Audit

> Not applicable — Phase 15 installs **no external packages**. All tooling reuses already-installed, already-audited dependencies (audited at install time in Phases 8–14). slopcheck gate skipped (zero new installs).

## Architecture Patterns

### System Architecture Diagram

```
                       ┌─────────────────────────────────────────┐
  DEV-TIME LOUDNESS    │  i18n.ts init (sync, module-load)        │
  ┌──────────────┐     │  + __DEV__ missingKeyHandler →           │
  │ on device,   │────▶│    console.error("[i18n] MISSING: "+key) │
  │ missing key  │     │  fallbackLng:'sv' UNCHANGED (production)  │
  └──────────────┘     └─────────────────────────────────────────┘

  BUILD-TIME GATE
  ┌────────────────────┐   enumerate t('lit')    ┌──────────────────┐
  │ app/app/**         │──────────────────────▶  │ test:i18n-       │
  │ app/components/**  │   flag JSX literals      │ coverage.ts      │
  │  (.tsx source)     │──────────────────────▶  │ (tsx, exit 0/1)  │
  └────────────────────┘                         └────────┬─────────┘
                                                          │ assert each key
                                                          ▼
                                       ┌──────────────────────────────┐
                                       │ locales/sv.json (205 keys)    │
                                       │  - flat keys + 2 namespaces:  │
                                       │    exercise.* , equip.*       │
                                       │    (dynamic-keyed — EXCLUDE)  │
                                       └──────────────────────────────┘

  CI / RELEASE-REGRESSION GATE (phase-branch.yml `test` job)
   tsc ──▶ lint ──▶ test:rls ──▶ [NEW] test:i18n-coverage ──▶ check:locale-parity
                                                 └──▶ test:f13-brutal (release gate)

  MOTION (UI thread / worklet — outside hot path)
   tab switch ──▶ (tabs)/_layout.tsx ForgeTabBar
                   icon: useSharedValue(0.92) ─withSpring(1,{damping:18,stiffness:220})▶ scale
```

### Recommended Project Structure (additions only)

```
app/
├── scripts/
│   └── check-i18n-coverage.ts      # NEW — t()-coverage + hardcoded-string scan (D-01)
├── lib/
│   └── i18n.ts                     # EDIT — add __DEV__ missingKeyHandler (D-04)
├── scripts/
│   └── test-locale-resolve.ts      # EDIT (only if a D-11 case is uncovered) (D-02)
└── app/(app)/(tabs)/
    └── _layout.tsx                 # EDIT — tab-bar icon scale 0.92→1 (D-07)
.github/workflows/
└── phase-branch.yml                # EDIT — wire test:i18n-coverage into `test` job (D-03)
.planning/phases/15-bilingual-release-hardening/
└── 15-UAT.md                       # NEW — screen×combo matrix (D-05)
```

### Pattern 1: i18n coverage scanner (regex-based tsx, cloning check-locale-parity.ts)

**What:** A Node-only `tsx` script with the proven exit-code gate shape. **Recommendation: regex-based grep over the .tsx source, NOT full AST.** Rationale: the existing toolchain (`tsx`, no Babel/SWC parser dependency) makes regex the lower-friction path, and the t()-call surface is simple string literals. An AST approach (e.g. `@typescript-eslint/parser`) would be more precise but adds a parser dependency and complexity disproportionate to a 17-file / 359-call surface. The two unresolvable cases (nested namespaces + dynamic keys) require an exclusion list *regardless* of regex vs AST — AST does not solve them — so regex's only cost (lower literal-extraction precision) is mitigated by a conservative pattern.

**When to use:** As the `test:i18n-coverage` gate (D-01/D-03).

**Two assertions the scan must make:**

1. **Every statically-resolvable `t('literal')` key exists in `sv.json`.** Match `t\(\s*['"]([^'"]+)['"]` → collect keys → assert each is a key in `sv.json` (top-level) OR begins with an allowed nested-namespace prefix.
2. **No user-visible JSX string literal bypasses `t()`.** Match `<Text ...>literal</Text>` and JSX text nodes containing letters → flag any that are not `{t(...)}` / `{variable}` / pure punctuation/whitespace.

**Example (skeleton — clone from `check-locale-parity.ts`):**
```typescript
// Source: app/scripts/check-locale-parity.ts (proven exit-code gate to clone)
import sv from "../locales/sv.json";
import { readFileSync } from "node:fs";
import { globSync } from "node:fs"; // or fast-glob if preferred; node 22 has fs.globSync

const flatKeys = new Set(Object.keys(sv));               // 205 top-level keys
const NESTED_PREFIXES = ["exercise.", "equip."];          // dynamic-keyed namespaces — see below

function keyIsCovered(key: string): boolean {
  if (flatKeys.has(key)) return true;
  return NESTED_PREFIXES.some((p) => key.startsWith(p));  // exercise.* / equip.* resolved at runtime
}
// glob app/app/**/*.tsx + app/components/**/*.tsx, regex t('...'), assert keyIsCovered, exit 1 on miss
```

### Pattern 2: __DEV__ missingKeyHandler (D-04)

**What:** A loud dev-time signal when `t('key')` resolves to a missing key, without touching production behavior.

**How (i18next option name + signature — CITED):** i18next exposes a top-level
`missingKeyHandler(lngs, ns, key, fallbackValue, updateMissing, options)` callback.
**It only fires when `saveMissing: true` is also set.** Gate BOTH behind `__DEV__` so
neither the handler nor `saveMissing` ships to the production bundle (Metro dead-code-
eliminates `if (__DEV__)` branches in release builds).

```typescript
// Source: https://www.i18next.com/overview/configuration-options (missingKeyHandler / saveMissing)
i18n.use(initReactI18next).init({
  resources: { sv: { translation: sv }, en: { translation: en } },
  lng: Localization.getLocales()[0]?.languageCode ?? "sv",
  fallbackLng: "sv",                       // UNCHANGED — production fallback stays Swedish
  interpolation: { escapeValue: false },
  compatibilityJSON: "v4",
  // D-04: dev-only loudness. saveMissing gates missingKeyHandler firing.
  saveMissing: __DEV__,
  missingKeyHandler: __DEV__
    ? (_lngs, _ns, key) => {
        console.error(`[i18n] MISSING KEY: "${key}"`);   // console.error, NOT throw — see rationale
      }
    : undefined,
});
```

**console.error vs throw (D-04 discretion):** Use **`console.error`**, not `throw`.
Rationale: this init is a *synchronous module-load* block and `t()` is called inside
render. Throwing inside `missingKeyHandler` would crash the render tree on the first
missing key — that is *too* loud (it converts a cosmetic gap into a white-screen and
blocks the dev from even reaching the screen to see *what else* is missing). `console.error`
produces a red LogBox banner on device (highly visible) while letting the sv-fallback
still render, so the dev sees the whole screen and every missing key in one pass. This
matches the "loudest option that doesn't crash legitimate dev flows" instruction.

### Pattern 3: Tab-bar icon scale 0.92→1 (D-07/D-08)

**What:** On tab switch, the active tab's icon springs from scale 0.92 to 1. The single genuine motion gap.

**Where:** `app/app/(app)/(tabs)/_layout.tsx` — the `ForgeTabBar` renderer (the icon is `<Icon>` inside each `<Pressable>`). This is OUTSIDE `(tabs)/index.tsx`'s log-a-set write passage — confirmed hot-path-safe (D-08).

**Pattern (matches the codebase's established worklet idiom — `PrBanner.tsx:71`, `(tabs)/index.tsx:587`):**
```typescript
// Source: app/components/ui/PrBanner.tsx:71 + app/app/(app)/(tabs)/index.tsx:587 (established Forge §07 curve)
const SPRING = { damping: 18, stiffness: 220 } as const;  // the default Forge curve

// Per tab item: drive scale off isActive. Wrap the Icon in Animated.View.
const scale = useSharedValue(isActive ? 1 : 0.92);
useEffect(() => {
  scale.value = withSpring(isActive ? 1 : 0.92, SPRING);
}, [isActive]);
const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
// <Animated.View style={iconStyle}><Icon .../></Animated.View>
```
**Note:** `ForgeTabBar` maps `state.routes` to render items. To use hooks per item without
violating the Rules of Hooks, extract the per-tab body into a child component
(`<ForgeTabButton route={...} isActive={...} />`) so each `useSharedValue`/`useEffect`
is in its own component instance. This is a structural refactor of the existing renderer,
not a new screen.

### Anti-Patterns to Avoid
- **Don't make the scan AST-heavy.** A full TypeScript-parser scan over 17 files is over-engineering for a string-literal surface; regex + an exclusion list is the proven, lower-risk path (Pattern 1 rationale).
- **Don't flag nested-namespace dynamic keys as missing.** `t('exercise.' + seed_key + '.name')` and `t('equip.' + equipment)` resolve at runtime against the `exercise.*` / `equip.*` namespaces. A flat-key existence check WILL false-fail on these — they must be in the exclusion prefix list.
- **Don't `throw` in the missingKeyHandler.** It crashes the render tree and hides every *other* missing key (Pattern 2 rationale).
- **Don't touch `(tabs)/index.tsx` for motion.** D-08 / MOTN-01 — the log-a-set write passage is off-limits.
- **Don't re-implement plan-row reorder motion.** `ScaleDecorator` is already wired (`plans/[id].tsx:552`). The motion table row is already satisfied.
- **Don't use `active:opacity-*` / inline `style()` for box-decoration** (CLAUDE.md / MEMORY — NativeWind className-not-style rule). Pressed feedback stays in the `style({pressed})` callback as already done in `_layout.tsx:105`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Missing-key detection at runtime | A custom proxy wrapper around `t()` | i18next's built-in `missingKeyHandler` + `saveMissing` | Native i18next feature; zero wrapper indirection (Pattern 2) |
| sv↔en parity | A second parity loop in the new script | Existing `check-locale-parity.ts` (keep it) | Already passes; new gate is orthogonal (t()-coverage ≠ parity) |
| Plan-row reorder spring | A hand-rolled `withSpring` on the drag row | `ScaleDecorator` (already wired) | Library handles translateY + scale + sibling slide (Forge §07 row 4 already satisfied) |
| Device-locale → engine-language mapping | New resolver | `resolveLanguageCore` (already exists + tested) | D-11 already implemented; this phase verifies only (D-02) |
| UAT structure | Ad-hoc notes | `15-UAT.md` screen×combo matrix | Matches established device-UAT-iteration pattern (MEMORY) |

**Key insight:** Phase 15 is verification-heavy and build-light. The most expensive
work is the *manual* four-combo device sweep — the automatable surface is one small Node
script, one i18next option, and one worklet.

## Runtime State Inventory

> This is a hardening phase touching only build-tooling, a dev-only handler, and one animation. It introduces **no** new stored data, service config, OS-registered state, secrets, or build artifacts.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified: no schema/migration/datastore change in scope (CONTEXT "no new features"). | None |
| Live service config | None — verified: no Supabase/CI-secret change; `phase-branch.yml` edit adds a step, doesn't rename anything. | None |
| OS-registered state | None — verified: no notification/Task-Scheduler/launchd change. | None |
| Secrets/env vars | None — verified: `missingKeyHandler` reads no secret; `__DEV__` flag is build-time. | None |
| Build artifacts | None — no `pyproject`/`package` rename; new `check-i18n-coverage.ts` is a fresh script, not a rename. | None |

## Common Pitfalls

### Pitfall 1: Nested-namespace keys false-fail the coverage scan
**What goes wrong:** The scan sees `t('exercise.bench-press.name')` (constructed at runtime as `t('exercise.' + seed_key + '.name')`) and reports "missing key" because `sv.json` has no *flat* key `exercise.bench-press.name` — instead it has a nested `exercise` object.
**Why it happens:** `sv.json` is mostly flat (205 top-level keys) but has **2 nested namespaces**: `exercise` and `equip` (verified via `Object.entries(sv).filter(v => typeof v === 'object')`). Their members are addressed by runtime-concatenated keys.
**How to avoid:** Maintain `NESTED_PREFIXES = ["exercise.", "equip."]`; treat any extracted key with one of these prefixes as covered (Pattern 1). Document the list in the script header so a future namespace addition updates it.
**Warning signs:** Scan fails with keys like `exercise.*` / `equip.*` in the "missing" list.

### Pitfall 2: Dynamic `t(variable)` calls are unresolvable statically
**What goes wrong:** The scan tries to resolve `t(labelKey)`, `t(exerciseNameKey(t, id))`, `tk(...)` and either errors or under/over-reports.
**Why it happens:** ~Several call sites pass a variable/function-result, not a literal (verified: `_layout.tsx:124` `t(labelKey)`, `plans/[id].tsx:558` `exerciseNameKey(...)`). These can't be enumerated by regex.
**How to avoid:** The literal-only regex `t\(\s*['"]...['"]` naturally skips `t(variable)` — that's correct (don't try to resolve them). The *values* those variables can take are guaranteed-covered by other means: tab labels (`plans`/`history`/`settings`) are static keys present in `sv.json`; exercise/equip keys fall under the nested-prefix allowlist. Add a one-line comment per dynamic call site if a reviewer needs reassurance, but no scan logic is needed.
**Warning signs:** Scan throws on a non-literal `t()` argument — means the regex is too greedy; tighten to literal-only.

### Pitfall 3: Hardcoded-string false positives
**What goes wrong:** The JSX-literal scan flags non-user-facing strings as "untranslated."
**Why it happens:** Many string props/values are NOT user copy.
**How to avoid:** Exclude these from the hardcoded-string flag: `accessibilityLabel`/`accessibilityHint` *when already `{t(...)}`*, `testID`, `style`/`className` string values, icon `name=` props, `key=` props, route `href` strings, `console.*` args, `format()` date-pattern strings (e.g. `"d MMM yyyy"`), and single-glyph punctuation (`×`, `—`, `·`). Restrict the positive match to JSX **text children** and a known set of copy-bearing props. Expect to tune the exclusion list across 1–2 iterations.
**Warning signs:** The flag list is dominated by `testID`/icon-name/date-format strings.

### Pitfall 4: missingKeyHandler leaks into production
**What goes wrong:** `saveMissing`/`missingKeyHandler` ships in the release bundle, adding overhead or surfacing console noise to end users.
**Why it happens:** Forgetting the `__DEV__` gate.
**How to avoid:** Gate BOTH `saveMissing: __DEV__` AND `missingKeyHandler: __DEV__ ? fn : undefined`. Metro strips `__DEV__`-false branches in release. STRIDE-relevant (see Security Domain).
**Warning signs:** A production export shows i18n missing-key console output.

### Pitfall 5: Per-tab hooks in a `.map()` violate Rules of Hooks
**What goes wrong:** Adding `useSharedValue`/`useEffect` directly inside `state.routes.map(...)` in `ForgeTabBar`.
**Why it happens:** The tab bar renders items in a loop.
**How to avoid:** Extract a `ForgeTabButton` child component so each item's hooks live in their own component instance (Pattern 3 note).
**Warning signs:** "Rendered more hooks than during the previous render" or hook-order lint errors.

## Code Examples

### Enumerate every screen for the UAT matrix (router tree → screen list)
```
# Verified via Glob app/app/**/*.tsx (excluding _layout / dev-only gallery):
(auth)/sign-in.tsx                                  → Sign in
(auth)/sign-up.tsx                                  → Sign up
(app)/(tabs)/index.tsx                              → Home / Plans (active-session swap, set-log, toast)
(app)/(tabs)/history.tsx                            → History list (+ saved toast)
(app)/(tabs)/settings.tsx                           → Settings (theme/language/units/restTimer/sign-out)
(app)/plans/new.tsx                                 → New plan
(app)/plans/[id].tsx                                → Plan detail (DraggableFlatList + ScaleDecorator)
(app)/plans/[id]/exercise-picker.tsx                → Exercise picker (filters, create-new)
(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx → Plan-exercise edit (steppers, targets)
(app)/workout/[sessionId].tsx                       → Active workout (set-log hot path, PR banner, rest timer)
(app)/history/[sessionId].tsx                       → Session detail (breakdown, e1RM, trophy)
(app)/exercise/[exerciseId]/chart.tsx               → Exercise chart (range, draw-on-mount)
# EXCLUDE from UAT: (app)/_forge-gallery.tsx (dev-only), all *_layout.tsx
```

### Existing exit-code gate idiom to clone
```typescript
// Source: app/scripts/check-locale-parity.ts:35-47
if (missing.length === 0) { console.log("PASS — ..."); process.exit(0); }
console.error("FAIL — ..."); /* print details */ process.exit(1);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| sv↔en parity only (`check-locale-parity.ts`) | + t()-coverage + hardcoded-string scan (`test:i18n-coverage`) | Phase 15 (D-01) | Catches the two failure shapes parity misses: missing-keyed `t()` AND strings that bypass `t()` |
| Silent sv-fallback on missing key | `__DEV__` `missingKeyHandler` console.error | Phase 15 (D-04) | Gaps surface immediately on device, not just in CI |
| `compatibilityJSON: "v3"` (legacy) | `"v4"` (already set in `i18n.ts:45`) | Phase 8 | Confirms current i18next plural/format JSON; no migration needed |

**Deprecated/outdated:** None relevant. i18next v26 `missingKeyHandler` signature is current.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `console.error` (not `throw`) is the right dev-loudness level | Pattern 2 / D-04 | LOW — explicit CONTEXT discretion; reversible one-line change |
| A2 | Regex scan (not AST) is sufficient for 17-file / 359-call surface | Pattern 1 / D-01 | LOW — exclusion list needed either way; if regex proves leaky, swap extraction to `@typescript-eslint/parser` without changing the gate contract |
| A3 | The only genuine motion gap is tab-bar icon scale | D-07 | LOW — verified 7/8 rows satisfied incl. ScaleDecorator at `plans/[id].tsx:552`; tab crossfade is debatable (see Open Q1) |

**Note:** A1–A3 are LOW risk — all are either explicit CONTEXT discretion areas or directly code-verified.

## Open Questions (RESOLVED)

1. **[RESOLVED — Plan 15-02] Tab-switch "crossfade content 0→1" — in scope or already-satisfied?**
   - What we know: Forge §07 row "Tab switch" lists TWO effects: (a) tab-bar icon scale 0.92→1 (the confirmed gap), and (b) "Crossfade content 0→1 (no slide)." expo-router/React-Navigation already does a default fade between tab screens (no horizontal slide), so (b) may be satisfied by the navigator default.
   - What's unclear: whether the planner wants to explicitly tune/verify the content crossfade or treat it as already-met.
   - Recommendation: treat the **icon scale** as the deliverable (D-07's explicit "likely just tab-bar icon scale"); verify content crossfade visually during UAT and only act if it slides horizontally. Do NOT add a custom content-transition animation unless UAT shows a regression.

2. **[RESOLVED — answered at runtime by Plan 15-01 Task 1] Does the coverage scan currently surface any missing keys / hardcoded strings?**
   - What we know: I18N-01 is marked `[x]` Complete and `check-locale-parity.ts` passes (205/205). This strongly implies near-zero gaps.
   - What's unclear: the *exact* count won't be known until the new scan is written and run — that is itself the first deliverable.
   - Recommendation: the planner should sequence "write + run the scan" as Wave-1 task 1, then treat any surfaced misses as gap-closure tasks. Expectation per CONTEXT: few-to-none.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `tsx` | `test:i18n-coverage` script | ✓ | `^4.21.0` | — |
| Node `fs.globSync` | scanner file enumeration | ✓ | Node 22 (CI) / local | use `fast-glob` (already transitive) if globSync unavailable |
| Reanimated 4 / worklets | tab-icon animation | ✓ | `~4.1.1` / `0.5.1` | — |
| Real iPhone + Expo Go | device UAT (D-05/D-06) | ✓ (established workflow) | SDK 54 | none — UAT requires hardware (per MEMORY device-UAT loop) |
| GitHub Actions runner | CI gate (D-03) | ✓ | `phase-branch.yml` | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** Node `globSync` (use `fast-glob` if needed).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Project convention: standalone `tsx` scripts with table-of-cases + exit-code gate (no Jest/Vitest) |
| Config file | none — each gate is an npm script in `app/package.json` |
| Quick run command | `cd app && npm run test:i18n-coverage` (new) |
| Full suite command | `npm run test:i18n-coverage && npm run check:locale-parity && npm run test:locale-resolve && npm run test:rls && npm run test:f13-brutal` |

### Phase Requirements / Success Criteria → Validation Map
| Success Criterion | Behavior | Validation Type | Command / Artifact |
|-------------------|----------|-----------------|--------------------|
| SC1 (zero missing keys, every screen) | every `t()` key exists + no bypassed literal | automated | `npm run test:i18n-coverage` (exit 0) |
| SC1 (right translation, no layout break) | wrong-translation / truncation / wrap | manual device | `15-UAT.md` rows × 4 combos |
| SC2 (full sv/en × light/dark UAT) | every screen renders in 4 combos | manual device | `15-UAT.md` matrix all-checked |
| SC3 (final regression gate) | F13 + cross-user RLS green | automated | `npm run test:f13-brutal` + `npm run test:rls` (both exit 0) |
| SC4 (motion applied, hot-path intact) | tab-icon scale present; ≤3s log-a-set holds | manual + automated | visual UAT (tab switch) + `npm run test:f13-brutal` (budget gate) |
| I18N-02 (D-02 close-out) | D-11 device→engine mapping | automated + manual | `npm run test:locale-resolve` (7 cases) + UAT language-toggle verification |
| I18N-03 (primary) | both languages complete | automated + manual | `test:i18n-coverage` + `15-UAT.md` |

### Sampling Rate
- **Per task commit:** `npm run test:i18n-coverage` (the new gate) + relevant existing gate.
- **Per wave merge:** full suite above.
- **Phase gate:** full suite green + `15-UAT.md` fully checked across all 4 combos before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `app/scripts/check-i18n-coverage.ts` — covers SC1/I18N-03 (the t()-coverage + hardcoded-string gate). **NEW.**
- [ ] `app/package.json` script `test:i18n-coverage` → `tsx scripts/check-i18n-coverage.ts`.
- [ ] `15-UAT.md` matrix scaffold (12 screens × 4 combos) — covers SC2.
- [ ] `test-locale-resolve.ts` — already covers all 7 D-11 cases; **no gap** unless UAT reveals an uncovered device-locale case (e.g. `nb`/`da` Nordic neighbors → expect `en`; add a case only if desired). Existing coverage is sufficient to mark I18N-02 Complete.
- Framework install: none — `tsx` already present.

## Security Domain

> `security_enforcement` is enabled project-wide (CLAUDE.md). Phase 15 introduces **no new data path** — STRIDE surface is minimal but two items matter for the planner's `<threat_model>`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth change |
| V3 Session Management | no | No session change |
| V4 Access Control | no | RLS unchanged; `test:rls` stays green as the regression check |
| V5 Input Validation | yes (carry-forward) | `resolveLanguage` already returns only `'sv'|'en'` literal union (no free text to engine) — T-09-04/T-08-11 lineage; unchanged |
| V6 Cryptography | no | — |
| V14 Configuration | yes | CI-gate addition must not weaken existing tsc/lint/RLS gates; dev handler must not ship to production |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| `missingKeyHandler`/`saveMissing` leaks into production bundle | Information Disclosure | `__DEV__`-gate BOTH options; verify a production `expo export` shows no i18n missing-key output (Pitfall 4) |
| New CI step accidentally relaxes the `test` job (e.g. `|| true`, `continue-on-error`) | Tampering (gate bypass) | Add `test:i18n-coverage` as a hard step in the existing `test` job — no `continue-on-error`; it must fail the job on exit 1, exactly like `test:rls` (D-03) |
| Coverage scan reads source only — no secret/env access | (none) | Scan imports `sv.json` + reads `.tsx`; never touches `.env.local` or service-role key (CLAUDE.md Node-script isolation upheld) |

**Threat IDs:** suggest `T-15-01` (dev-handler production leak — mitigate), `T-15-02` (CI gate weakening — mitigate). Both `disposition: mitigate`. No new accepted risks expected.

## Sources

### Primary (HIGH confidence)
- `app/scripts/check-locale-parity.ts`, `app/lib/i18n.ts`, `app/lib/resolve-language.ts`, `app/scripts/test-locale-resolve.ts` — read in full (i18n init, resolver, existing gates)
- `app/app/_layout.tsx` (LocaleBootstrap, lines 227-242), `app/app/(app)/(tabs)/_layout.tsx` (ForgeTabBar), `app/app/(app)/plans/[id].tsx:552` (ScaleDecorator) — read in full / targeted
- `app/components/ui/PrBanner.tsx:71`, `app/app/(app)/(tabs)/index.tsx:587` — established `withSpring(damping 18/stiffness 220)` worklet idiom
- `app/design v2/Sources/design/Forge Design Spec.html` §07 (lines 526-592) — full 8-row motion table
- `app/package.json` (deps + scripts), `.github/workflows/phase-branch.yml` (CI `test` job) — verified versions + gate wiring
- `.planning/REQUIREMENTS.md` §I18N/§MOTN, `.planning/ROADMAP.md` §Phase 15 — requirement + success-criteria source
- Codebase greps: 359 `t()` calls / 17 files; nested namespaces `exercise`/`equip`; dynamic `t(var)` call sites — [VERIFIED: grep]

### Secondary (MEDIUM confidence)
- [i18next configuration options — `missingKeyHandler` / `saveMissing`](https://www.i18next.com/overview/configuration-options) — [CITED] option name + signature + saveMissing dependency

### Tertiary (LOW confidence)
- None — all claims verified against live code or cited docs.

## Metadata

**Confidence breakdown:**
- i18n tooling design: HIGH — verified key count, nested namespaces, and dynamic-key call sites directly in source
- missingKeyHandler: HIGH — i18next option confirmed via docs; init structure read in full
- I18N-02 close-out: HIGH — resolver + 7-case test + LocaleBootstrap all read; mapping confirmed
- Motion gap: HIGH — verified 7/8 rows satisfied (ScaleDecorator already wired); single gap isolated to tab-bar icon
- UAT matrix: HIGH — screen list enumerated from router tree via Glob
- CI wiring: HIGH — `phase-branch.yml` `test` job read in full

**Research date:** 2026-06-16
**Valid until:** 2026-07-16 (stable — no fast-moving deps; tied to SDK 54 / i18next 26 already pinned)
