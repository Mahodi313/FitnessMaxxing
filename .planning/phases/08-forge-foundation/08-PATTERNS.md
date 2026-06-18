# Phase 8: Forge Foundation - Pattern Map

**Mapped:** 2026-06-09
**Files analyzed:** 26 (new + modified)
**Analogs found:** 22 / 26 (4 net-new categories have partial/role analogs only)

> **Critical framing for the planner:** The reference files `app/design v2/Sources/design/lib.jsx` and `forge-screens.jsx` are **web React** (DOM `<div>`/`<svg>`, CSS `background`/`boxShadow`/`backdropFilter`). They are the **visual + token + i18n contract — NOT RN code to copy**. Every primitive must be re-authored in RN primitives (`View`/`Text`/`Pressable`) + NativeWind classes. Each "Analog" column below points at the closest **real RN file under `app/`**; the lib.jsx line refs are the *spec* (what to render), the analog is *how to render it in this codebase*.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog (real RN) | Match Quality |
|-------------------|------|-----------|--------------------------|---------------|
| `app/tailwind.config.js` | config | transform (build-time tokens) | self (current empty `theme.extend`) | exact (modify) |
| `app/app/_layout.tsx` | provider/app-shell | event-driven (bootstrap gate) | self (`ThemeBootstrap` + `SplashScreenController`) | exact (modify) |
| `app/lib/font-store.ts` | store | event-driven | `app/lib/persistence-store.ts` | exact |
| `app/lib/i18n.ts` | config/provider | transform (module-scope init) | `app/lib/supabase.ts` (module-singleton + side-effect) | role-match |
| `app/locales/sv.json` | data (resource) | static | lib.jsx `I18N.sv` (lines 8-119) | source-transcribe |
| `app/locales/en.json` | data (resource) | static | lib.jsx `I18N.en` (lines 120-222) | source-transcribe |
| `app/lib/utils/format.ts` | utility | transform (pure fn) | `date-fns` usage in `chart.tsx` (lines 52-53) | partial |
| `app/components/ui/Icon.tsx` | component | static render | `active-session-banner.tsx` (Ionicons usage) → re-author w/ react-native-svg | role-match |
| `app/components/ui/ForgeButton.tsx` | component | request-response (onPress) | `segmented-control.tsx` (token-driven Pressable + variant classes) | role-match |
| `app/components/ui/ForgeField.tsx` | component | request-response (controlled input) | `segmented-control.tsx` + RN `TextInput` | partial |
| `app/components/ui/ForgeCard.tsx` | component | static render | `active-session-banner.tsx` (card-shell View) | role-match |
| `app/components/ui/ForgeStat.tsx` | component | static render | `active-session-banner.tsx` (label+value stack) | partial |
| `app/components/ui/ForgeChip.tsx` | component | static render | `segmented-control.tsx` (inline pill) | role-match |
| `app/components/ui/SettingsRow.tsx` | component | request-response (onPress/onToggle) | `active-session-banner.tsx` (full-row Pressable) | role-match |
| `app/components/ui/TabBar.tsx` | component | static render (gallery-only) | `app/app/(app)/(tabs)/_layout.tsx` (live tab structure — DO NOT wire) | role-match |
| `app/components/ui/ProgressRing.tsx` | component | static render (Skia) | `chart.tsx` Skia import block (lines 60-66) | role-match |
| `app/components/ui/Sparkline.tsx` | component | static render (Skia) | `chart.tsx` Skia import block (lines 60-66) | role-match |
| `app/components/ui/Logo.tsx` | component | static render (svg) | none (new react-native-svg surface) | no analog |
| `app/components/ui/AppIcon.tsx` | component | static render | `Logo.tsx` (this phase) | no analog |
| `app/app/(app)/_forge-gallery.tsx` | route (dev-only) | static render | `app/app/(app)/(tabs)/settings.tsx` (ScrollView screen) | role-match |
| `app/assets/fonts/*` (4 files) | asset | static | none | n/a (binary asset) |
| `app/scripts/check-locale-parity.ts` (optional) | utility/test | transform | `app/scripts/*` (existing tsx scripts) | role-match |

---

## Pattern Assignments

### `app/tailwind.config.js` (config, transform) — MODIFY

**Analog:** self (current state, read in full).

**Current state (lines 10-12)** — the only thing to change is `theme.extend`:
```js
  theme: {
    extend: {},
  },
```
- `darkMode: "class"`, `presets: [require("nativewind/preset")]`, and `content` globs are already correct — **do not touch them**. Existing `bg-gray-*`/`text-blue-*` v1 classes coexist with the new `forge.*` block untouched.

**Token block to add** — values verbatim from `THEMES.forge` (lib.jsx) per ARCHITECTURE.md §1 / RESEARCH.md Pattern 1. Use the flat `forge.*` colors + `fontFamily` (display/mono) + `borderRadius` (`forge-sm/md/lg/xl`) extends exactly as specified in RESEARCH.md lines 241-271.

**Load-bearing decisions the planner must honor (do NOT re-derive):**
- **Light-mode rgba tokens (RESEARCH Pitfall 4 / OQ-3):** add **solid** `forge.text2`/`forge.text3`/`forge.border`/`forge.borderStrong`/`forge.accentSoft` light-hex tokens with a `dark:` opacity override. The opacity-modifier trick (`text-forge-text/62`) only round-trips for dark mode (white@62%); light `text2`=`#4D4D4D` is a solid warm-gray, not black@62%.
- **3 display weights = 3 fontFamily classes (RESEARCH Pitfall 3 / OQ-4):** `font-display` (400), `font-display-semibold` (600), `font-display-bold` (700). RN does NOT synthesize weights from one family; `font-display` + `font-bold` will NOT produce Inter Display Bold.

---

### `app/lib/font-store.ts` (store, event-driven) — NEW

**Analog:** `app/lib/persistence-store.ts` (read in full — this is the exact shape to copy).

**Copy this pattern verbatim** (persistence-store.ts lines 13-23), extended to two flags (`fontsReady`, `localeReady`):
```ts
import { create } from "zustand";

type PersistenceState = {
  hydrated: boolean;
  setHydrated: (v: boolean) => void;
};

export const usePersistenceStore = create<PersistenceState>((set) => ({
  hydrated: false,
  setHydrated: (v) => set({ hydrated: v }),
}));
```
- **No persistence** (ARCHITECTURE §2 line 152 — `useFontStore` does NOT need persistence). Same as persistence-store: plain `create`, two booleans + two setters.
- File-header comment convention: every `lib/*.ts` in this repo opens with a `// app/lib/<name>.ts` path line + a phase/decision rationale block (see auth-store.ts lines 1-37, persistence-store.ts lines 1-11). Match it.

---

### `app/lib/i18n.ts` (config/provider, module-scope init) — NEW

**Analog:** `app/lib/supabase.ts` (module-singleton + module-scope side-effect convention) + `app/lib/auth-store.ts` lines 82-129 (module-scope side-effects run once per bundle).

**Module-scope-init pattern** — i18next init runs synchronously at import, exactly like auth-store's listener registration. Source recipe is RESEARCH.md lines 302-316 / ARCHITECTURE §7:
```ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import sv from '../locales/sv.json';
import en from '../locales/en.json';

i18n.use(initReactI18next).init({
  resources: { sv: { translation: sv }, en: { translation: en } },
  lng: Localization.getLocales()[0]?.languageCode ?? 'sv',
  fallbackLng: 'sv',                  // CONTEXT default app language is Swedish
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});
export default i18n;
```
- **Synchronous module-scope init** mirrors how auth-store registers `onAuthStateChange` at module load (auth-store.ts header lines 4-8: "Module-scope effects run ONCE per JS bundle load — bundler import cache makes it Strict-Mode safe"). The same guarantee applies to `i18n.init`.
- **Import for side-effect at top of `_layout.tsx`** — same convention as `import "@/lib/query/network"` (already done in _layout.tsx line 32). i18n init must run before any JSX. ARCHITECTURE §7 line 460.

---

### `app/locales/sv.json` + `app/locales/en.json` (data resource, static) — NEW

**Source (not a code analog — a transcription source):** lib.jsx `I18N.sv` = **lines 8-119**, `I18N.en` = **lines 120-222**.

**Transcription rules (D-09 / D-10 — locked):**
- **Flat keys, single default namespace, 1:1 with the `I18N` object** (`signIn`, `myPlans`, `lastTrained`…). No nested namespaces.
- **Exactly 3 function-valued keys** become `{{...}}` interpolations; every other key is a plain string copy:
  - `setsSavedBody` (lib.jsx line 71 sv / 178 en): `(n) => ...` → `"{{n}} set sparade. Avsluta passet?"` (sv) / `"{{n}} sets saved. Finish workout?"` (en)
  - `pbSub` (lib.jsx line 76 sv / 183 en): `(kg, reps) => ...` → `"{{kg}} kg × {{reps}} reps"` (both locales)
  - (`noSetsBody` is a **plain string**, not function-valued — direct copy.)
- sv and en have the **same key set** (verified) — Phase 15 completeness diff stays trivial.

---

### `app/lib/utils/format.ts` (utility, pure transform) — NEW

**Analog:** `date-fns` + locale usage in `chart.tsx` (lines 52-53: `import { format } from "date-fns"; import { sv } from "date-fns/locale";`).

**Recipe (RESEARCH.md lines 446-456 / I18N-04):**
```ts
import { format } from 'date-fns';
import { sv, enUS } from 'date-fns/locale';

export const fmtNum = (n: number, locale: 'sv' | 'en') =>
  new Intl.NumberFormat(locale === 'sv' ? 'sv-SE' : 'en-US').format(n);

export const fmtDate = (d: Date, locale: 'sv' | 'en', fmt = 'd MMM yyyy') =>
  format(d, fmt, { locale: locale === 'sv' ? sv : enUS });
```
- `Intl.NumberFormat` is Hermes-native on iOS — **no polyfill** (RESEARCH State-of-the-Art). Do NOT reuse lib.jsx's `fmtNum` `.replace(/,/g,' ')` hack (mangles decimals).
- **tnum helper** (DSGN-03) co-locate here or in a `ui` style module: `export const tnum = { fontVariant: ['tabular-nums'] as const };` (RESEARCH lines 439). RN ignores web-only `fontFeatureSettings '"ss01"'` — alignment is delivered by `tabular-nums` alone.

---

### `app/components/ui/ForgeButton.tsx` (component, request-response) — NEW

**Analog:** `app/components/segmented-control.tsx` (read in full — the canonical token-driven NativeWind component in this repo).

**Variant/size-via-explicit-props pattern** — segmented-control selects classes by a boolean; ForgeButton selects by `variant`/`size` enums (D-02). Mirror its **conditional-className structure** (segmented-control.tsx lines 93-101):
```tsx
className={
  selected
    ? "flex-1 py-2 px-3 rounded-md items-center justify-center bg-white dark:bg-gray-700"
    : "flex-1 py-2 px-3 rounded-md items-center justify-center"
}
```

**CRITICAL — FIT-66 pressed-state / shadow workaround (segmented-control.tsx lines 36-49, 64-69, 98-101):** Do NOT put `active:opacity-*` or `shadow-*` on NativeWind `className`. The `react-native-css-interop@0.2.3` upgrade-warning codepath recurses the fiber tree and crashes outside a NavigationContainer. Instead:
- pressed feedback → `Pressable` `style={({ pressed }) => [...]}` callback
- shadow (the `primary` accent shadow) → explicit iOS shadow style object (like `selectedShadow`, lines 64-69), NOT a Tailwind shadow class.

This is **load-bearing for every Forge primitive that has a press/shadow state** (ForgeButton, ForgeCard interactive, SettingsRow).

**Variant/size enums:** derive from `forge-screens.jsx` usage + UI-SPEC §ForgeButton (variants `primary|secondary|ghost|destructive`; sizes `lg|md|sm`).

---

### `app/components/ui/ForgeField.tsx` (component, controlled input) — NEW

**Analog:** `app/components/segmented-control.tsx` (token-driven class structure) + RN `TextInput`.

- Controlled input via `value`/`onChangeText` props (UI-SPEC §ForgeField). `state: 'default'|'focused'|'error'` selects border class (`focused` = `border-2 border-forge-accent`) — use the same conditional-className idiom as segmented-control (lines 93-101).
- Leading `Icon` slot uses the new `Icon` component.

---

### `app/components/ui/ForgeCard.tsx` / `ForgeStat.tsx` / `ForgeChip.tsx` (component, static) — NEW

**Analog:** `app/components/active-session-banner.tsx` (card-shell `View` with token bg/border/radius) + `segmented-control.tsx` (chip-pill idiom).

**Card-shell + dark: variant pattern** (active-session-banner.tsx line 58 — the canonical NativeWind dark-flip on a container):
```tsx
className="flex-row items-center justify-between gap-2 bg-blue-100 dark:bg-blue-950 border border-blue-300 dark:border-blue-800 px-4 py-3 mx-4 mt-2 rounded-lg"
```
- For Forge, swap the literal blue classes for `bg-forge-surface dark:...`, `border-forge-border`, `rounded-forge-lg`. Same structural shape.
- **ForgeStat** uses the label-over-value stack idiom (active-session-banner.tsx lines 62-72: nested `View` with two `Text` rows). Apply `tnum` (from format.ts) + `font-display-bold` on the numeral. UPPERCASE eyebrow label uses `text-forge-text/38` (dark) / solid `forge.text3` (light).
- **ForgeChip** mirrors a single segmented-control pill: inline `flex-row items-center` `View`, `px-[9px] py-1 rounded-lg bg-forge-surface2 border border-forge-text/8`, 12px weight-600 text (RESEARCH lines 461-467).

---

### `app/components/ui/SettingsRow.tsx` (component, request-response) — NEW

**Analog:** `app/components/active-session-banner.tsx` (full-row `Pressable` with leading icon + label/value + chevron + a11y).

**Full-row Pressable + a11y pattern** (active-session-banner.tsx lines 54-75): `Pressable` wrapping `flex-row items-center justify-between`, leading icon tile, label stack, trailing chevron. Reuse:
- `accessibilityRole="button"` + `accessibilityLabel` (line 56-57)
- trailing `Ionicons name="chevron-forward"` → replace with new `Icon name="chevronRight"` (line 74)
- For the toggle variant, the 44×26 pill is a custom `Pressable` — apply the FIT-66 pressed-style-callback rule.

---

### `app/components/ui/TabBar.tsx` (component, static — GALLERY ONLY) — NEW

**Analog:** `app/app/(app)/(tabs)/_layout.tsx` (the LIVE expo-router `<Tabs>` — read for structure, **DO NOT modify or wire to it**).

- **Build standalone presentational only.** RESEARCH Pattern 7 / OQ-5 / Pitfall 6: do NOT swap the live `<Tabs>` `tabBar` prop this phase — that is a navigation-behavior-adjacent change that risks the "no screen-behavior change" boundary. Render `TabBar.tsx` in the gallery only; wire live in Phase 9+.
- Items + icons from UI-SPEC §TabBar (`plans`/barbell, `history`/clock, `settings`/settings). Active = `text-forge-accent` + weight 600; inactive = `text-forge-text/38` + weight 500.

---

### `app/components/ui/ProgressRing.tsx` + `Sparkline.tsx` (component, static Skia) — NEW

**Analog:** `app/app/(app)/exercise/[exerciseId]/chart.tsx` (lines 60-66 — the only existing `@shopify/react-native-skia` consumer in the repo; import idiom + Canvas mental model).

**Skia import idiom** (chart.tsx lines 60-66):
```tsx
import {
  Circle,
  matchFont,
  RoundedRect,
  Text as SkiaText,
} from "@shopify/react-native-skia";
```
- For ProgressRing/Sparkline add `Canvas`, `Path`, `Skia`, `SweepGradient`/`LinearGradient`, `vec` to this import set. `@shopify/react-native-skia@2.2.12` is **already installed** (package.json line 38) — no new charting dep (DSGN-05).
- **STATIC ONLY (D-08 / RESEARCH Anti-Patterns):** chart.tsx imports `useDerivedValue`/`useSharedValue` from reanimated (line 66) for its animated tooltip — **do NOT copy that** into ProgressRing/Sparkline. Mount/draw animation is Phase 12 (MOTN-02/03).
- Spec/port: ProgressRing = lib.jsx lines 424-452 (concentric circles → Skia `Path` arc, sweep = `value*360`, `strokeCap="round"`, gradient via `<SweepGradient>`); Sparkline = lib.jsx lines 457-488 (normalized `moveTo`/`lineTo` path + closed fill area + last-point dot/halo). Defaults in RESEARCH Patterns 4-5.
- Canvas sizing gotcha (RESEARCH Pitfall 5): give `<Canvas>` explicit width/height; pad for the halo (`strokeWidth+2`).

---

### `app/components/ui/Icon.tsx` (component, static svg) — NEW

**Analog:** `react-native-svg` (to install via `npx expo install` — D-11). Closest existing usage idiom: `active-session-banner.tsx` Ionicons (`<Ionicons name color size />`) — replicate the **`name`-enum + `color`/`size`/`strokeWidth` prop shape**, but render `<Svg><Path d=.../></Svg>`.

- Source: lib.jsx `Icon` (lines 381-419) — the `<path d="...">` strings transcribe 1:1 into react-native-svg `<Path d="...">`. Name enum in UI-SPEC §Icon.
- 24×24 viewBox, `strokeWidth` 1.8 default, `strokeLinecap/join="round"`.
- **Brand discipline (UI-SPEC / README):** barbell = **content** icon; Ascend mark = brand only (Logo/AppIcon). Never render barbell in brand gradient.

---

### `app/components/ui/Logo.tsx` + `AppIcon.tsx` (component, static) — NEW — NO ANALOG

- No existing RN vector-brand component. Author from lib.jsx `Logo` (lines 667-688) + `AppIcon` (lines 691+) using `react-native-svg` (`<Path>`/`<Circle>` + `<LinearGradient>` stroke). `AppIcon` = gradient-squircle `View` (NativeWind `bg` + `radius size*0.28`) wrapping a white `Logo` at `size*0.62`. Props/defaults in UI-SPEC §Logo/§AppIcon. Component-only (D-03 — no `app.json`/native asset swap).

---

### `app/app/_layout.tsx` (provider/app-shell, bootstrap gate) — MODIFY

**Analog:** self — `ThemeBootstrap` (lines 84-100) and `SplashScreenController` (lines 64-74) are the EXACT templates for the two new bootstrap siblings.

**1. `FontBootstrap` — copy the `ThemeBootstrap` shape** (lines 84-100), swap the AsyncStorage read for `Font.loadAsync`, fail-open (RESEARCH Pattern 2):
```tsx
function FontBootstrap() {
  const setFontsReady = useFontStore(s => s.setFontsReady);
  useEffect(() => {
    Font.loadAsync({
      'InterDisplay':          require('../assets/fonts/InterDisplay-Regular.otf'),
      'InterDisplay-SemiBold': require('../assets/fonts/InterDisplay-SemiBold.otf'),
      'InterDisplay-Bold':     require('../assets/fonts/InterDisplay-Bold.otf'),
      'JetBrainsMono':         require('../assets/fonts/JetBrainsMono-Regular.ttf'),
    }).then(() => setFontsReady(true))
      .catch(() => setFontsReady(true)); // FAIL-OPEN — D-05 / Pitfall 7
  }, []);
  return null;
}
```

**2. `LocaleBootstrap` — reuse `ThemeBootstrap`'s exact AsyncStorage + Zod-enum-catch idiom** (lines 86-98). ThemeBootstrap reads `fm:theme`; LocaleBootstrap reads `fm:language` and calls `i18n.changeLanguage()`, fail-open via `.finally(setLocaleReady)`:
```tsx
// Pattern lifted directly from ThemeBootstrap (lines 87-97):
void AsyncStorage.getItem("fm:language")
  .then((v) => {
    const l = z.enum(["sv", "en"]).catch("sv").parse(v);
    return i18n.changeLanguage(l);
  })
  .catch(() => {})
  .finally(() => setLocaleReady(true));
```
- `AsyncStorage`, `z`, `useColorScheme` are already imported in _layout.tsx (lines 5-7) — `z.enum().catch().parse()` is the established corrupt-value-tolerant pattern (ThemeBootstrap line 89-92, T-07-01 mitigation). Reuse it.

**3. Extend the splash gate** — `SplashScreenController` currently fires `hideAsync()` when `status !== "loading"` (lines 65-72). Per ARCHITECTURE §2/§7 + RESEARCH diagram (lines 178-185), the gate becomes `status !== 'loading' && fontsReady && localeReady`. Read all three from their stores in the controller; the effect dep array must include all three.

**4. Add the module-scope side-effect import** — add `import "@/lib/i18n";` near the other side-effect imports (alongside line 32 `import "@/lib/query/network";`). **Place it AFTER the `@/lib/query/*` imports (lines 30-32)** — those are LOAD-BEARING and must not be reordered (lines 18-29 header).

**5. Mount the two new siblings** inside `PersistQueryClientProvider` next to `<ThemeBootstrap />` (line 182):
```tsx
<ThemeBootstrap />
<FontBootstrap />        {/* NEW */}
<LocaleBootstrap />      {/* NEW */}
<SplashScreenController />
<RootNavigator />
<StatusBar style={isDark ? "light" : "dark"} />
```

**DO NOT TOUCH (F13 gate):** `@/lib/query/client`, `persister`, `network` imports (lines 30-32) and the `PersistQueryClientProvider` `onSuccess`/`onError` callbacks (lines 166-180). Phase 8 is additive only.

---

### `app/app/(app)/_forge-gallery.tsx` (route, dev-only) — NEW

**Analog:** `app/app/(app)/(tabs)/settings.tsx` (a `ScrollView`-based screen under `(app)`).

- **Out-of-nav gating (RESEARCH Pitfall 6 / D-06 / OQ-6):** file lives at `(app)/_forge-gallery` (OUTSIDE `(tabs)`); leading underscore keeps expo-router from treating it as a default tab child. Reach via `router.push('/_forge-gallery')` in dev; `__DEV__`-guard against release. Confirm it never appears in the live tab bar.
- Renders every section from UI-SPEC §Verification Surface (swatches, type scale, every primitive×variant×size, static ProgressRing/Sparkline, Logo/AppIcon, sv↔en toggle) in **both** themes.
- Screen-container + SafeAreaView + `useColorScheme` idiom: copy from `chart.tsx` (lines 48-50) / settings.tsx.

---

## Shared Patterns

### NativeWind `dark:` variant (light↔dark parity)
**Source:** `active-session-banner.tsx` line 58, `segmented-control.tsx` lines 79, 95-108, `offline-banner.tsx` line 46.
**Apply to:** EVERY Forge primitive (UI-SPEC: light+dark parity REQUIRED).
**Pattern:** pair every color class with its `dark:` sibling on the same element — `bg-X dark:bg-Y border-A dark:border-B text-M dark:text-N`. No theming infra change; `darkMode: "class"` + NativeWind `useColorScheme` already wired. For Forge, the light side often resolves to a solid `forge.*` light token and the dark side to a `/opacity` modifier (see tailwind.config OQ-3 note).

### FIT-66 — pressed-state + shadow must bypass NativeWind className
**Source:** `segmented-control.tsx` lines 36-49 (incident writeup), 64-69 (`selectedShadow` object), 98-101 (`style={({pressed}) => [...]}` callback).
**Apply to:** every primitive with a press or shadow state (ForgeButton, interactive ForgeCard, SettingsRow toggle, any pressable in the gallery).
**Rule:** `active:opacity-*` and `shadow-*` as NativeWind classes can crash via the css-interop upgrade-warning recursion. Use `Pressable` `style` callback for pressed feedback and an explicit iOS shadow style object for shadows.

### Module-scope side-effect, run once per bundle
**Source:** `auth-store.ts` header lines 4-15 + lines 82-129; `_layout.tsx` side-effect imports lines 30-32.
**Apply to:** `lib/i18n.ts` (synchronous init at import) + its side-effect import in `_layout.tsx`.

### Zustand store (no persistence)
**Source:** `persistence-store.ts` (full file).
**Apply to:** `lib/font-store.ts` — same `create<State>((set) => ({...}))` shape, two boolean flags + setters.

### Corrupt-value-tolerant AsyncStorage read (Zod enum catch)
**Source:** `_layout.tsx` `ThemeBootstrap` lines 87-97 (`z.enum([...]).catch(default).parse(v)`).
**Apply to:** `LocaleBootstrap` reading `fm:language`. Prevents a corrupt pref from hanging the splash (Pitfall 7).

### File-header rationale comment
**Source:** every existing file — auth-store.ts lines 1-37, persistence-store.ts lines 1-11, segmented-control.tsx lines 1-49, chart.tsx lines 1-39.
**Apply to:** all new files. Open with `// <path>` + phase/decision/reference block citing CONTEXT/RESEARCH/UI-SPEC lines.

### a11y on interactive primitives
**Source:** `segmented-control.tsx` lines 80-91 (`accessibilityRole`/`State`/`Label`, `hitSlop`), `active-session-banner.tsx` lines 56-57, 65.
**Apply to:** ForgeButton, ForgeField, SettingsRow, TabBar, gallery toggles.

---

## No Analog Found

Files with no close existing match (planner uses the lib.jsx spec + RESEARCH.md patterns):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `app/components/ui/Logo.tsx` | component | static svg | No RN vector-brand component exists; first `react-native-svg` `<Path>` brand mark (lib.jsx 667-688). |
| `app/components/ui/AppIcon.tsx` | component | static | New gradient-squircle composite; depends on `Logo.tsx` (this phase). |
| `app/components/ui/Icon.tsx` | component | static svg | No `react-native-svg` icon set exists; existing icons are `@expo/vector-icons` Ionicons (different lib). Prop-shape analog only. |
| `app/assets/fonts/*` | asset | static | Binary `.otf`/`.ttf` files — sourced (rsms/inter, JetBrains/JetBrainsMono), not authored. |

---

## Metadata

**Analog search scope:** `app/lib/`, `app/components/`, `app/app/`, `app/app/(app)/`, `app/tailwind.config.js`, `app/package.json`; spec sources `app/design v2/Sources/design/lib.jsx`, `.planning/research/ARCHITECTURE.md`.
**Files scanned:** auth-store.ts, persistence-store.ts, supabase.ts, _layout.tsx (root + (app)), tailwind.config.js, segmented-control.tsx, active-session-banner.tsx, offline-banner.tsx, chart.tsx, package.json, lib.jsx (targeted line ranges).
**Pattern extraction date:** 2026-06-09
