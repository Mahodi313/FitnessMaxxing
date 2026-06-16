# Phase 15: Bilingual & Release Hardening - Pattern Map

**Mapped:** 2026-06-16
**Files analyzed:** 7 (2 NEW, 4 MODIFY, 1 conditional MODIFY) + 1 already-done verification
**Analogs found:** 6 / 6 (the 1 doc artifact has no code analog by design)

This phase is hardening/closeout — no new features. Every new/modified file clones an
existing, proven pattern that the research already located by file + line number. The
planner should treat these excerpts as copy-from sources, not just references.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/scripts/check-i18n-coverage.ts` (NEW) | test / build-gate | batch (static scan) | `app/scripts/check-locale-parity.ts` | exact (same role + flow) |
| `app/lib/i18n.ts` (MODIFY) | config (i18next singleton) | transform | itself (in-place init edit) | exact (self) |
| `app/app/(app)/(tabs)/_layout.tsx` (MODIFY) | route / layout (ForgeTabBar) | event-driven (tab switch) | `app/components/ui/PrBanner.tsx` + `(tabs)/index.tsx` worklet idiom | role-match (worklet pattern) |
| `app/package.json` §scripts (MODIFY) | config | n/a | existing `check:locale-parity` / `test:locale-resolve` lines | exact (sibling entry) |
| `.github/workflows/phase-branch.yml` (MODIFY) | config (CI) | n/a | existing `test:rls` step in same `test` job | exact (sibling step) |
| `app/scripts/test-locale-resolve.ts` (CONDITIONAL MODIFY) | test | batch | itself (add a `Case` row) | exact (self) |
| `.planning/phases/15-…/15-UAT.md` (NEW) | doc artifact | n/a | none (matrix doc) | no analog — by design |

**Already done (NOT a target — list as satisfied):**
`ScaleDecorator` on plan-row reorder is **already wired** at
`app/app/(app)/plans/[id].tsx:552` (verified — wraps `<PlanExerciseRow>` inside the
`DraggableFlatList renderItem`). Forge §07 row 4 (plan-row reorder) is satisfied. **Do
not re-implement.**

## Pattern Assignments

### `app/scripts/check-i18n-coverage.ts` (NEW — test / build-gate, batch)

**Analog:** `app/scripts/check-locale-parity.ts` (read in full — 48 lines)

Clone three things from the analog: the **Node-only header convention**, the **import
of `sv.json` as the assertion source**, and the **exit-code gate shape**. The new check
is *orthogonal* to parity — it asserts `t()`-call coverage + flags hardcoded JSX strings,
not sv↔en symmetry. Keep `check-locale-parity.ts` unchanged; this runs alongside it.

**Header / Node-only convention** (analog lines 1-27) — clone verbatim with Phase-15 wording:
```typescript
// File: app/scripts/check-i18n-coverage.ts
// ...
// This script is Node-only — it is NEVER imported from a Metro-bundled path.
```
(CLAUDE.md Node-script isolation; the audit gate `git grep "service_role"` must stay clean.)

**Import + assertion-source pattern** (analog lines 26-30):
```typescript
import sv from "../locales/sv.json";
const svKeys = new Set(Object.keys(sv));
```
For Phase 15, extend with the nested-namespace allowlist (RESEARCH Pattern 1 / Pitfall 1):
```typescript
const flatKeys = new Set(Object.keys(sv));            // ~205 top-level keys
const NESTED_PREFIXES = ["exercise.", "equip."];      // runtime-concatenated — EXCLUDE
function keyIsCovered(key: string): boolean {
  if (flatKeys.has(key)) return true;
  return NESTED_PREFIXES.some((p) => key.startsWith(p));
}
```

**Exit-code gate idiom — copy this exact shape** (analog lines 35-47):
```typescript
if (missing.length === 0) {
  console.log(`PASS — ...`);
  process.exit(0);
}
console.error("FAIL — ...");
/* print the missing keys + flagged hardcoded strings */
process.exit(1);
```

**Core scan logic (NEW — no analog; build per RESEARCH Pattern 1):**
- Enumerate `app/app/**/*.tsx` + `app/components/**/*.tsx` (Node `fs.globSync`; fallback `fast-glob`).
- Assertion 1 — literal-only regex `t\(\s*['"]([^'"]+)['"]` → collect keys → `keyIsCovered()`.
- Assertion 2 — flag user-visible JSX text children NOT wrapped in `{t(...)}`/`{var}`/punctuation.
- Exclusions for the hardcoded-string flag (RESEARCH Pitfall 3): `testID`, icon `name=`,
  `key=`, `href`, `className`/`style` strings, `console.*` args, `format()` date patterns,
  single-glyph punctuation (`×` `—` `·`).
- The literal-only regex naturally skips `t(variable)` / `t(exerciseNameKey(...))` — that
  is correct (RESEARCH Pitfall 2); do NOT try to resolve dynamic args.

---

### `app/lib/i18n.ts` (MODIFY — config, transform)

**Analog:** itself (in-place edit of the existing `.init()` block — read in full, 78 lines).

The init is a **synchronous module-load block** (lines 37-46). D-04 adds two `__DEV__`-gated
options INSIDE this `.init({...})` object **without disturbing** `fallbackLng: "sv"`,
`interpolation.escapeValue: false`, `compatibilityJSON: "v4"`, or the `lng:` line. The
`resolveLanguage` export (lines 68-77) is untouched.

**Current init block to preserve** (lines 37-46):
```typescript
i18n.use(initReactI18next).init({
  resources: {
    sv: { translation: sv },
    en: { translation: en },
  },
  lng: Localization.getLocales()[0]?.languageCode ?? "sv",
  fallbackLng: "sv",                       // UNCHANGED — production fallback stays Swedish
  interpolation: { escapeValue: false },
  compatibilityJSON: "v4",
});
```

**Add (D-04 — both `__DEV__`-gated; RESEARCH Pattern 2):**
```typescript
  // D-04: dev-only loudness. saveMissing gates missingKeyHandler firing.
  saveMissing: __DEV__,
  missingKeyHandler: __DEV__
    ? (_lngs, _ns, key) => {
        console.error(`[i18n] MISSING KEY: "${key}"`);  // console.error, NOT throw
      }
    : undefined,
```
**console.error, not throw** (RESEARCH Pattern 2 + D-04 discretion): throwing inside a
render-time `t()` crashes the tree on the first miss and hides every other missing key.
`console.error` raises a red LogBox banner while sv-fallback still renders, so the dev sees
the whole screen in one pass. **Both options MUST stay `__DEV__`-gated** so Metro
dead-code-strips them from the release bundle (RESEARCH Pitfall 4 / T-15-01).

---

### `app/app/(app)/(tabs)/_layout.tsx` (MODIFY — route/layout, event-driven)

**Analog (worklet idiom):** `app/components/ui/PrBanner.tsx:71` + `app/app/(app)/(tabs)/index.tsx:585-595`.
**Analog (file being edited):** `_layout.tsx` `ForgeTabBar` (read in full, 151 lines).

D-07's single genuine motion gap: active tab icon springs scale `0.92 → 1` on switch.
Outside the log-a-set hot path (D-08 — confirmed; `(tabs)/index.tsx` write passage untouched).

**The default Forge curve — copy verbatim** (`PrBanner.tsx:71`, also `index.tsx:587`):
```typescript
// §07 motion spec — damping 18 / stiffness 220.
const SPRING = { damping: 18, stiffness: 220 } as const;
```

**The established worklet pattern to clone** (`index.tsx:585-595` shape):
```typescript
const scale = useSharedValue(isActive ? 1 : 0.92);
useEffect(() => {
  scale.value = withSpring(isActive ? 1 : 0.92, SPRING);
}, [isActive]);
const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
// <Animated.View style={iconStyle}><Icon .../></Animated.View>
```

**Structural refactor required** (RESEARCH Pitfall 5): the current renderer maps
`state.routes.map((route, index) => …)` inline (lines 79-128). Per-item hooks in a `.map()`
violate Rules of Hooks. **Extract a `ForgeTabButton` child component** so each
`useSharedValue`/`useEffect` lives in its own instance. The `<Icon>` (lines 107-112) gets
wrapped in `Animated.View` inside that child.

**Preserve these existing details (appearance + behavior contract):**
- Pressed feedback stays in the `style({ pressed })` callback (line 105) — never
  `active:opacity-*` (FIT-66 / CLAUDE.md / MEMORY NativeWind className-not-style rule).
- `accessibilityRole="tab"`, `accessibilityState`, `accessibilityLabel={t(labelKey)}` (lines 100-102).
- Light/dark `accent`/`text3` raw colors via `useColorScheme()` (lines 69-72).
- Navigation `onPress` emit/navigate logic (lines 85-94) — unchanged.

**Tab content crossfade (Forge §07 "Tab switch" effect (b)) — DO NOT add** unless UAT
shows horizontal slide. expo-router's default tab transition fades (no slide); treat as
satisfied and verify visually only (RESEARCH Open Q1).

---

### `app/package.json` §scripts (MODIFY — config)

**Analog:** the sibling gate-script lines (read directly).

Existing gate scripts (lines 13-35):
```json
"test:rls": "tsx --env-file-if-exists=.env.local scripts/test-rls.ts",
"test:locale-resolve": "tsx scripts/test-locale-resolve.ts",
"test:f13-brutal": "tsx --env-file-if-exists=.env.local scripts/verify-f13-brutal-test.ts",
"check:locale-parity": "tsx scripts/check-locale-parity.ts",
```

**Add one line in the same block** (no env file needed — pure source scan, like `check:locale-parity`):
```json
"test:i18n-coverage": "tsx scripts/check-i18n-coverage.ts",
```

---

### `.github/workflows/phase-branch.yml` (MODIFY — config, CI)

**Analog:** the `test:rls` step inside the same `test` job (read in full, lines 26-59).

Existing `test` job step structure (lines 48-59):
```yaml
      - name: TypeScript check
        run: npx tsc --noEmit

      - name: Lint
        run: npx expo lint

      - name: RLS tester
        run: npm run test:rls
        env:
          EXPO_PUBLIC_SUPABASE_URL: ${{ secrets.EXPO_PUBLIC_SUPABASE_URL }}
          EXPO_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.EXPO_PUBLIC_SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

**Add a NEW hard step in the same `test` job** (D-03 — no env block needed; scan reads
source + `sv.json` only, no secrets):
```yaml
      - name: i18n coverage gate
        run: npm run test:i18n-coverage
```
**No `continue-on-error`, no `|| true`** (T-15-02 — CI gate-weakening). It must fail the
job on exit 1 exactly like `test:rls`. The `defaults.run.working-directory: app` (lines
30-32) already scopes `npm run` to the `app/` cwd — no `cd` needed.

---

### `app/scripts/test-locale-resolve.ts` (CONDITIONAL MODIFY — test, batch)

**Analog:** itself (read in full, 55 lines — `Case[]` table + loop + exit-code).

**Likely NO change** (RESEARCH Wave-0: all 7 D-11 cases already covered; sufficient to mark
I18N-02 Complete per D-02). Edit ONLY if UAT reveals an uncovered device-locale case. If so,
append to the existing `cases` array (lines 25-35) following the exact `Case` shape:
```typescript
{ name: "resolveLanguage('system','nb') === 'en' (Nordic neighbor → en)", pref: "system", deviceLang: "nb", expected: "en" },
```
The loop + exit-code gate (lines 37-54) needs no change — it already counts failures and
`process.exit(1)` on any.

---

### `.planning/phases/15-…/15-UAT.md` (NEW — doc artifact, no code analog)

Screen × combo matrix (D-05). 12 screens × 4 combos (sv-light / sv-dark / en-light /
en-dark). No code analog — pattern is the established device-UAT-iteration artifact (MEMORY).
Screen list is already enumerated from the router tree in RESEARCH §"Code Examples":
`(auth)/sign-in`, `(auth)/sign-up`, `(tabs)/index`, `(tabs)/history`, `(tabs)/settings`,
`plans/new`, `plans/[id]`, `plans/[id]/exercise-picker`,
`plans/[id]/exercise/[planExerciseId]/edit`, `workout/[sessionId]`, `history/[sessionId]`,
`exercise/[exerciseId]/chart`. EXCLUDE `_forge-gallery.tsx` (dev-only) + all `_layout.tsx`.

## Shared Patterns

### Node-only build-gate (tsx + exit-code)
**Source:** `app/scripts/check-locale-parity.ts` (whole file is the template)
**Apply to:** `check-i18n-coverage.ts` (new), and the wiring in `package.json` + `phase-branch.yml`.
- Node-only header comment block (never Metro-bundled).
- `import sv from "../locales/sv.json"` as the source of truth.
- `console.log("PASS …"); process.exit(0)` / `console.error("FAIL …"); process.exit(1)`.
- npm script: `"<name>": "tsx scripts/<name>.ts"`.
- CI: hard step `run: npm run <name>` in the `test` job — no `continue-on-error`.

### Forge §07 spring worklet (default curve)
**Source:** `app/components/ui/PrBanner.tsx:71`, `app/app/(app)/(tabs)/index.tsx:587`
**Apply to:** the tab-bar icon scale animation (and any future Forge motion).
```typescript
const SPRING = { damping: 18, stiffness: 220 } as const;
// useSharedValue → useEffect(withSpring(target, SPRING), [dep]) → useAnimatedStyle(transform)
```
UI-thread worklet only; never blocks a state write (D-08 / MOTN-01 ≤3s budget).

### NativeWind className-not-style for box decoration; style() for pressed/opacity only
**Source:** `app/app/(app)/(tabs)/_layout.tsx:104-105` (pressed feedback in `style({pressed})`)
**Apply to:** all Pressable edits in the tab bar (and any re-skin) — MEMORY rule. Box
styling (bg/border/radius/size) stays in `className`; only opacity/shadow in the `style()`
callback. Animated transforms go through Reanimated `useAnimatedStyle`, not inline style().

### Case[]-table + loop + exit-code unit test
**Source:** `app/scripts/test-locale-resolve.ts:18-54`
**Apply to:** any conditional extension of the locale-resolve test (D-02). Append `Case`
rows; never restructure the loop.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.planning/phases/15-…/15-UAT.md` | doc artifact | n/a | Manual device-UAT matrix; intentionally a doc, not code. Structure follows the established device-UAT-iteration artifact (MEMORY), enumerated from the router tree (RESEARCH §Code Examples). |

## Metadata

**Analog search scope:** `app/scripts/`, `app/lib/`, `app/app/(app)/(tabs)/`,
`app/components/ui/`, `app/app/(app)/plans/`, `app/package.json`, `.github/workflows/`.
**Files read for excerpts:** `check-locale-parity.ts`, `i18n.ts`, `test-locale-resolve.ts`,
`(tabs)/_layout.tsx`, `PrBanner.tsx` (55-89), `(tabs)/index.tsx` (575-599),
`plans/[id].tsx` (545-569), `phase-branch.yml` (22-61), `package.json` scripts block.
**Pattern extraction date:** 2026-06-16
**Note:** RESEARCH.md already named every analog with exact line numbers; all were verified
against live source during this mapping. No discrepancies found.
