# Phase 8: Forge Foundation - Research

**Researched:** 2026-06-09
**Domain:** Design-system foundation for React Native (Expo SDK 54) — NativeWind token migration, custom font loading (expo-font), react-i18next scaffold, static Skia primitives, custom component library
**Confidence:** HIGH (stack + tokens + i18n locked and verified; the only MEDIUM areas are Skia-Canvas-vs-SVG primitive port and exact Inter Display file extension)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Component library**
- **D-01:** Build the requirement-named set — `ForgeButton`, `ForgeField`, `ForgeCard`, `ForgeStat` (DSGN-04), `ProgressRing`, `Sparkline` (DSGN-05), `Logo`, `AppIcon` (DSGN-06) — **plus** the foundational shared pieces every later re-skin needs: `ForgeChip`, `SettingsRow`, and a re-skinned **TabBar shell**. All three already exist in `lib.jsx`. Build once now, minimize per-screen rework in Phases 9–12. Still no production-screen behavior change.
- **D-02:** Expose component variants/sizes via **explicit props** (e.g. `ForgeButton variant='primary'|'secondary'|'ghost'`, `size='lg'|'md'`), not className-only passthrough. Derive the exact variant/size enums from actual usage in `forge-screens.jsx`.
- **D-03:** `Logo`/`AppIcon` ship as token-driven **components only** this phase (gradient + white variants, shown in the gallery). Do **not** swap the real `app.json` app-icon/splash asset yet.

**Fonts / type system**
- **D-04:** Bundle **Inter Display Regular + SemiBold + Bold + JetBrains Mono Regular** — exactly the four files in ARCHITECTURE.md §2. Body text stays System (iOS SF Pro). Display drives headings + large numerals; mono drives weight/reps/chart-axis/set-number cells; stat numerals use tabular-nums (`tnum`/`ss01`) per DSGN-03.
- **D-05:** Fallback for any Inter Display weight that can't be sourced/loaded → the matching **standard Inter** weight (via `@expo-google-fonts/inter`, zero manual sourcing). Standard Inter preferred over the roadmap's Inter-Tight suggestion. On top of the architecture's fail-open splash gate (`catch(() => setFontsReady(true))`).

**Verification surface**
- **D-06:** Prove the foundation via a **dedicated dev-only gallery route** (e.g. `app/(app)/_forge-gallery.tsx`) rendering all token swatches, the font scale, `ProgressRing`, `Sparkline`, and an sv↔en toggle. Gated out of normal navigation; **kept in the repo** as a living reference. Not a throwaway.
- **D-07:** Verification is **manual device UAT in Expo Go** (consistent with v1 sign-offs) — the gallery *is* the test surface. No automated render-test (RN component testing isn't in the stack).

**Skia primitives**
- **D-08:** `ProgressRing` and `Sparkline` are built as **static** Skia primitives this phase. Mount/draw animations are explicit Phase 12 success criteria (MOTN-02/03).

**i18n scaffold**
- **D-09:** Transcribe the **full `I18N.sv` / `I18N.en` object** from `lib.jsx` into `locales/sv.json` + `locales/en.json` this phase (function-valued strings → `{{n}}` interpolations). The gallery flips a sample string to satisfy success criterion 4.
- **D-10:** Use **flat keys mirroring the `I18N` object 1:1** (`signIn`, `myPlans`, `lastTrained`…) in a **single default namespace**. No nested namespaces.

### Claude's Discretion
- Exact `variant`/`size` enum values per component — derive from `forge-screens.jsx` usage (D-02).
- Token block mechanics in `tailwind.config.js` — already specified by ARCHITECTURE.md §1 (flat `forge.*` colors + opacity-modifier syntax for rgba tokens, `fontFamily` + `borderRadius` extends).
- `FontBootstrap`/`LocaleBootstrap`/`useFontStore` wiring + splash-gate changes — already specified by ARCHITECTURE.md §2/§7.

### Deferred Ideas (OUT OF SCOPE)
- **Real iOS app-icon + splash asset swap** — later polish step (DSGN-06 satisfied by `Logo`/`AppIcon` components this phase).
- **ProgressRing/Sparkline mount + draw animations** — Phase 12 (MOTN-02/03). Static only here.
- **Sweep of existing hardcoded Swedish literals → `t()`** — Phase 11/15 per ARCHITECTURE.md. Phase 8 stands up scaffold + full locale files only. New strings in Phases 8–10 go straight through `t()`.
- **Automated RN render/smoke test for the gallery** — deferred; manual device UAT covers Phase 8.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DSGN-01 | Forge color tokens (light + dark) available app-wide | §"Token migration mechanics" — flat `forge.*` block in `tailwind.config.js` + opacity-modifier syntax for rgba tokens; values transcribed verbatim from `THEMES.forge` in `lib.jsx` |
| DSGN-02 | Custom type system (Inter Display + JetBrains Mono) loaded | §"Font sourcing" + §"Splash-gate integration" — expo-font `Font.loadAsync` in `FontBootstrap`, 4 files in `assets/fonts/`, `fontFamily` extends in tailwind, fail-open gate |
| DSGN-03 | Tabular numerals on stat/numeric cells | §"Tabular numerals" — `numStyle` from lib.jsx (`fontVariant: ['tabular-nums']` in RN); applied via a shared `tnum` style helper or `font-mono`/display family |
| DSGN-04 | Core component library (Button/Field/Card/Stat + Chip/SettingsRow/TabBar) | §"Component variant/size API" — full prop enums derived from `forge-screens.jsx` usage |
| DSGN-05 | ProgressRing + Sparkline render via installed Skia (no new charting dep) | §"Skia primitives" — Canvas/Path/Circle port of the lib.jsx SVG reference impls; STATIC |
| DSGN-06 | Logo + AppIcon as token-driven components | §"Skia primitives" / §"Logo & AppIcon" — Ascend mark port; component-only per D-03 |
| I18N-01 | Text renders from translation resources | §"i18n wiring" — `lib/i18n.ts` init, `locales/*.json`, `useTranslation()`; gallery proves with sv↔en toggle |
| I18N-04 | Locale-aware number/date formatting | §"Number/date formatting" — `Intl.NumberFormat` (Hermes-native on iOS) for `fmtNum`; `date-fns/locale` (`sv`/`enUS`) for dates |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

These are load-bearing directives. The planner MUST NOT recommend approaches that contradict them.

- **Stack is locked.** Expo SDK 54, NativeWind 4.2 + **Tailwind 3 only** (Tailwind 4 breaks NativeWind's `react-native-css-interop@0.2.3` peer dep). No version bumps.
- **`npx expo install` for native modules** (not `npm install`) — it pins the SDK-54-correct version. Applies to `expo-localization`, `expo-font`. Pure-JS packages (`i18next`, `react-i18next`, `@expo-google-fonts/*`, `react-native-svg` if added) use `npm install`.
- **F13 "never lose a set" is sacrosanct.** Phase 8 is purely presentational/additive. Do NOT touch `app/lib/query/client.ts`, `persister.ts`, `network.ts`, mutation defaults, query keys, or the persister. `npm run test:f13-brutal` must stay green.
- **Migration-as-truth.** Any DB change ships as a numbered SQL file in `app/supabase/migrations/`. (Phase 8 introduces **no** schema change — `0007_profiles_weekly_goal.sql` belongs to a later phase per the build-order doc; do not pull it forward unless the planner explicitly scopes it.)
- **expo-secure-store for auth tokens** (untouched here).
- **Zod for all external data** (no external data boundary crossed in Phase 8 except locale JSON, which is static/bundled).
- **Service-role-key isolation** (no DB access in Phase 8).
- **Per-phase `<threat_model>` STRIDE register required** in each plan; `gsd-secure-phase 8` audits to `threats_open: 0` before close. Phase 8's surface is small (see §Security Domain).
- **Branching:** never commit to `dev`/`main`; phase branch `gsd/phase-08-forge-foundation` (already checked out).
- **Linear:** run `npm run linear:issues` at session start; `npm run linear:sync-phase --phase 8` after planning.

## Summary

Phase 8 lays the v2.0 "Forge" design-system bedrock with **zero production-screen behavior change**. Almost every decision is already locked in four source-of-truth files (`lib.jsx`, `forge-screens.jsx`, the UI-SPEC, and ARCHITECTURE.md §1/§2/§7). The research here fills the implementation gaps those docs leave open and flags the small number of porting decisions the planner must make.

The dominant technical reality: **the reference implementations in `lib.jsx`/`forge-screens.jsx` are web React (DOM `<div>`, `<svg>`, CSS `background`, `boxShadow`, `backdropFilter`).** They are a *visual contract*, not copy-paste RN code. Every primitive must be re-authored in React Native primitives (`View`/`Text`/`Pressable` + NativeWind classes), and the two Skia primitives (`ProgressRing`, `Sparkline`) plus the `Icon` set must move from SVG-in-DOM to either `@shopify/react-native-skia` (installed) Canvas API or `react-native-svg` (NOT currently installed — a decision point, see Open Questions). Tokens, fonts, and i18n are mechanical transcriptions with verified recipes.

**Primary recommendation:** Sequence the phase as ARCHITECTURE.md §1 staged migration "Phase A" (tokens + fonts only, no screen changes), then build the `components/ui/` primitives against those tokens, then the dev-only gallery as the single UAT surface. Use Skia (already installed) for `ProgressRing` and `Sparkline`; use `react-native-svg` for the multi-path `Icon`/`Logo` set (cleaner stroke-path port than Skia for 30+ static icons) — install it via `npm install react-native-svg` (Expo-Go compatible, SDK-54 supported). Keep the live `(tabs)` navigation untouched: the "TabBar shell" (D-01) is built as a standalone presentational component shown in the gallery, NOT wired into expo-router's `<Tabs>` this phase.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Color tokens (DSGN-01) | Build config (`tailwind.config.js`) | Client render (NativeWind classes) | Tokens compile at build time into NativeWind's class table; consumed by RN components at render |
| Font loading (DSGN-02) | Client / App shell (`_layout.tsx` + `expo-font`) | — | Fonts must load on-device before first paint; gated by native splash |
| Tabular numerals (DSGN-03) | Client render (RN `Text` style) | — | `fontVariant`/`fontFeatureSettings` is a per-Text style prop |
| Component library (DSGN-04) | Client render (`components/ui/`) | Build config (token classes) | Presentational RN components |
| Skia primitives (DSGN-05) | Client render (Skia `<Canvas>`) | — | GPU-drawn on the client; no server/data tier |
| Logo/AppIcon (DSGN-06) | Client render (SVG/Skia) | — | Vector components, no native asset this phase |
| i18n strings (I18N-01) | Client (module-scope `i18n` engine) | App shell (`LocaleBootstrap` gate) | Pure-JS engine initialized at module load; locale read from AsyncStorage |
| Number/date format (I18N-04) | Client (Hermes `Intl` + `date-fns`) | — | Formatting is a render-time pure function |

## Standard Stack

All versions are **locked** by CLAUDE.md / STACK.md / ARCHITECTURE.md. This phase introduces no new locked decisions — it consumes the already-pinned set. Versions below were re-verified against the npm registry on 2026-06-09 (see Package Legitimacy Audit for the registry-vs-SDK-pin distinction).

### Core (already installed — confirmed in `app/package.json`)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `nativewind` | `^4.2.3` | Tailwind-class styling for RN | Locked; the token-class engine `forge.*` compiles into |
| `tailwindcss` | `^3.4.17` | Token source (`theme.extend`) | Locked at v3 — v4 breaks NativeWind's `react-native-css-interop@0.2.3` peer |
| `@shopify/react-native-skia` | `2.2.12` | ProgressRing + Sparkline (DSGN-05) | Already installed (v1 Phase 6); no new charting dep needed |
| `expo-font` | `~14.0.11` (SDK pin `~14.0.12`) | Custom font loading (DSGN-02) | Already installed; `Font.loadAsync`/`useFonts` |
| `expo-splash-screen` | `~31.0.13` | Splash gate for font/locale load | Already installed; `preventAutoHideAsync`/`hideAsync` |
| `expo-haptics` | `~15.0.8` | (Not used in Phase 8 gallery; available) | Already installed |
| `date-fns` | `^4.1.0` | Locale-aware date format (I18N-04) | Already installed; `date-fns/locale` `sv`/`enUS` |
| `zustand` | `^5.0.13` | `useFontStore` slice | Already installed; matches `auth-store`/`persistence-store` pattern |

### Supporting (NET-NEW — to install this phase)
| Library | Version | Purpose | Install command |
|---------|---------|---------|-----------------|
| `i18next` | `^26.3.1` | i18n engine (I18N-01) | `npm install i18next` |
| `react-i18next` | `^17.0.8` | `useTranslation()` hook (I18N-01) | `npm install react-i18next` |
| `expo-localization` | SDK-54 pin `~17.0.9` | Device-locale detection | `npx expo install expo-localization` |
| `@expo-google-fonts/inter` | `0.4.2` | D-05 fallback (standard Inter weights) | `npm install @expo-google-fonts/inter` |
| `react-native-svg` | `15.15.5` (use `npx expo install` for SDK pin) | Icon/Logo/AppIcon multi-path vectors | `npx expo install react-native-svg` |

> **`react-native-svg` is a recommendation, not a locked decision** — see Open Question OQ-1. The alternative is to render `Icon`/`Logo`/`AppIcon` with Skia (already installed, no new dep). The planner/discuss-phase should confirm before install. Tagged `[ASSUMED]`.

> **`@expo-google-fonts/jetbrains-mono` is NOT needed.** D-04 bundles JetBrains Mono Regular as a self-hosted file (same as Inter Display). The google-fonts JetBrains package would only be needed if you chose not to self-host — but ARCHITECTURE.md §2 already commits to a self-hosted `JetBrainsMono-Regular.ttf` in `assets/fonts/`. STACK.md lists the google-fonts JetBrains package as optional; do not install it.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Skia for `ProgressRing`/`Sparkline` | `react-native-svg` | SVG is simpler for the static port BUT DSGN-05 explicitly requires Skia, and Phase 12 animations (MOTN-02/03) are far easier on Skia's `useDerivedValue`/`AnimatedPath`. **Use Skia** — building static-on-SVG-then-rewriting-on-Skia in Phase 12 is wasted work. |
| `react-native-svg` for `Icon`/`Logo` | Skia Canvas for icons | Skia avoids a new dependency but Skia's `Path` requires SVG-path-string parsing (`Skia.Path.MakeFromSVGString`) for 30+ icons, and `react-native-svg`'s `<Path d="...">` is a 1:1 transcription of the lib.jsx `<path d>` strings. **react-native-svg is the lower-effort, lower-risk port for static stroke icons.** (OQ-1) |
| `i18next` + `react-i18next` | `lingui`, `i18n-js` | i18next is locked; lingui is extraction-workflow overkill for a 2-locale single-dev project; `i18n-js` has no hooks/TS. |
| `Intl.NumberFormat` (I18N-04) | `intl-pluralrules` polyfill | Hermes on iOS ships native `Intl` (confirmed) — no polyfill needed. |

**Installation (net-new, in order):**
```bash
cd app
npm install i18next react-i18next @expo-google-fonts/inter
npx expo install expo-localization react-native-svg
```

**Version verification (run 2026-06-09):**
- `npm view i18next version` → `26.3.1` [VERIFIED: npm registry — but tagged ASSUMED per provenance rule; cross-check with Context7/official before locking]
- `npm view react-i18next version` → `17.0.8`
- `npm view expo-localization version` → `56.0.6` ⚠️ this is the **unpinned latest = SDK 56 line**. The SDK-54-correct pin is `~17.0.9` (per STACK.md, verified via `expo install`). **Always install via `npx expo install expo-localization`** — `npm install expo-localization` would pull the SDK-56 version and break the build.
- `npm view @expo-google-fonts/inter version` → `0.4.2`
- `npm view react-native-svg version` → `15.15.5` (use `npx expo install` to get the SDK-54 pin, likely `15.11.x`–`15.x`)

## Package Legitimacy Audit

> slopcheck was not available in this research environment (no `pip`/`slopcheck` install attempted in a sandboxed agent). Per the graceful-degradation rule, all NET-NEW packages are tagged `[ASSUMED]` and the planner should gate each first-time install behind a `checkpoint:human-verify` task OR rely on the fact that every package below is independently documented in the locked STACK.md (which itself was produced by a prior verified research pass with `npm view` confirmation on 2026-06-09).

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `i18next` | npm | ~14 yrs | very high (10M+/wk) | github.com/i18next/i18next | n/a | Approved — industry-standard, in locked STACK.md |
| `react-i18next` | npm | ~9 yrs | very high | github.com/i18next/react-i18next | n/a | Approved — locked STACK.md |
| `expo-localization` | npm | Expo-official | high | github.com/expo/expo | n/a | Approved — Expo first-party; install via `expo install` |
| `@expo-google-fonts/inter` | npm | Expo-official | high | github.com/expo/google-fonts | n/a | Approved — Expo first-party asset pkg |
| `react-native-svg` | npm | ~9 yrs | very high (5M+/wk) | github.com/software-mansion/react-native-svg | n/a | Approved (pending OQ-1) — Software Mansion, Expo-supported |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*All five are Expo-ecosystem or i18next-org first-party packages with multi-year history and millions of weekly downloads. The slopsquatting risk is negligible; the real install risk is the `expo-localization` cross-version trap documented above (SDK 56 latest vs SDK 54 pin), which `npx expo install` solves.*

## Architecture Patterns

### System Architecture Diagram

```
APP LAUNCH (module load order — LOAD-BEARING, do not reorder)
   │
   ├─ SplashScreen.preventAutoHideAsync()          [existing, module scope]
   ├─ import "@/lib/query/client"                  [existing — DO NOT TOUCH]
   ├─ import "@/lib/query/persister"               [existing — DO NOT TOUCH]
   ├─ import "@/lib/query/network"                 [existing — DO NOT TOUCH]
   ├─ import "@/lib/i18n"   ◄── NEW (side-effect: i18n.init runs synchronously)
   └─ import useAuthStore                          [existing]
        │
        ▼
   RootLayout render
        └─ PersistQueryClientProvider
             ├─ ThemeBootstrap          [existing — reads fm:theme → setColorScheme]
             ├─ FontBootstrap   ◄── NEW (Font.loadAsync → useFontStore.setFontsReady, fail-open)
             ├─ LocaleBootstrap ◄── NEW (reads fm:language → i18n.changeLanguage → setLocaleReady)
             ├─ SplashScreenController  [MODIFIED gate: status!=='loading' && fontsReady && localeReady]
             ├─ RootNavigator           [existing]
             └─ StatusBar               [existing]

RENDER TIME (per component)
   forge.* token classes ──► NativeWind ──► RN View/Text styles
   font-display / font-mono ──► loaded Inter Display / JetBrains Mono families
   t('key') ──► react-i18next ──► active locale string (sv|en)
   Intl.NumberFormat / date-fns ──► locale-aware numerals & dates

DEV-ONLY GALLERY  app/(app)/_forge-gallery.tsx
   renders: swatches · type scale · every primitive×variant×size ·
            ProgressRing(static) · Sparkline(static) · Logo · AppIcon · sv↔en toggle
   (gated out of nav; NOT registered as a tab; reachable via direct route push in dev)
```

### Recommended Project Structure
```
app/
├── assets/fonts/                    # NEW dir
│   ├── InterDisplay-Regular.otf     # self-hosted from rsms/inter v4.1
│   ├── InterDisplay-SemiBold.otf
│   ├── InterDisplay-Bold.otf
│   └── JetBrainsMono-Regular.ttf    # self-hosted from JetBrains/JetBrainsMono
├── locales/                         # NEW dir
│   ├── sv.json                      # transcribed from I18N.sv
│   └── en.json                      # transcribed from I18N.en
├── lib/
│   ├── i18n.ts                      # NEW — i18next init module
│   ├── font-store.ts                # NEW — tiny Zustand slice (fontsReady, localeReady)
│   └── utils/
│       └── format.ts                # NEW — fmtNum (Intl) + fmtDate (date-fns) helpers
├── components/ui/                   # NEW dir (does not exist yet)
│   ├── Icon.tsx                     # react-native-svg port of lib.jsx Icon set
│   ├── ForgeButton.tsx
│   ├── ForgeField.tsx
│   ├── ForgeCard.tsx
│   ├── ForgeStat.tsx
│   ├── ForgeChip.tsx
│   ├── SettingsRow.tsx              # + SettingsSection
│   ├── TabBar.tsx                   # presentational shell (NOT wired to expo-router Tabs)
│   ├── ProgressRing.tsx            # Skia, static
│   ├── Sparkline.tsx               # Skia, static
│   ├── Logo.tsx                    # Ascend mark (svg)
│   └── AppIcon.tsx                 # gradient squircle + white Logo
├── app/(app)/_forge-gallery.tsx     # NEW — dev-only UAT surface (D-06)
└── tailwind.config.js               # MODIFIED — forge.* colors + fontFamily + borderRadius
```

> Note on dir convention: CONTEXT.md code-context says "New primitives go in a `components/ui/` dir." ARCHITECTURE.md §8 writes `components/ui/forge/*`. **Reconcile to one path before building** (OQ-2). The UI-SPEC says `app/components/ui/`. Recommend `app/components/ui/` (flat) per UI-SPEC + CONTEXT, since there is only one design system.

### Pattern 1: Token migration — `THEMES.forge` → `tailwind.config.js`
**What:** Mirror the locked `THEMES.forge` palette into a flat `forge.*` color block + `fontFamily` + `borderRadius` extends. Hex tokens go in directly; rgba/opacity tokens (`text2`, `text3`, `border`, `accentSoft`, `borderStrong`, `tabBg`) are expressed at use-site via NativeWind's opacity-modifier syntax.
**When to use:** Wave 0 / first task — everything downstream depends on it.
**Example:**
```js
// tailwind.config.js — theme.extend (values verbatim from lib.jsx THEMES.forge)
// Source: CITED ARCHITECTURE.md §1 + lib.jsx lines 236-276
colors: {
  forge: {
    bg:       { DEFAULT: '#000000', light: '#FAFAF7' },
    surface:  { DEFAULT: '#0E0E10', light: '#FFFFFF' },
    surface2: { DEFAULT: '#18181B', light: '#F2F1EC' },
    surface3: { DEFAULT: '#222226', light: '#E8E7E1' },
    text:     { DEFAULT: '#FFFFFF', light: '#0A0A0A' },
    accent:     { DEFAULT: '#FF5A1F', light: '#E14E10' },
    accentText: { DEFAULT: '#FFFFFF', light: '#FFFFFF' },
    success:  { DEFAULT: '#30D158', light: '#1E9E45' },
    warn:     { DEFAULT: '#FFD60A', light: '#B68000' },
    danger:   { DEFAULT: '#FF453A', light: '#D70015' },
    gradFrom: { DEFAULT: '#FF7A2E', light: '#FF7A2E' },
    gradTo:   { DEFAULT: '#FF2D55', light: '#FF3D5E' },
    // rgba tokens — DO NOT hardcode alpha here; apply opacity at use-site:
    //   text2  → text-forge-text/62   (dark) ;  light uses #4D4D4D → add forge.text2.light if needed
    //   text3  → text-forge-text/38   (dark)
    //   border → border-forge-text/8  (dark)
    //   accentSoft → bg-forge-accent/14 (dark)
  },
},
fontFamily: {
  display: ['InterDisplay', 'Inter', 'System'],  // family names must match Font.loadAsync keys
  mono:    ['JetBrainsMono', 'Menlo'],
},
borderRadius: {
  'forge-sm': '10px',  // lib.jsx radius.sm
  'forge-md': '14px',  // radius.md
  'forge-lg': '20px',  // radius.lg
  'forge-xl': '28px',  // radius.xl
},
```
**Gotcha (light-mode rgba tokens):** dark-mode `text2`/`text3`/`border` are opacity-of-white, so `text-forge-text/62` works (white @ 62%). But **light-mode** `text2`=`#4D4D4D`, `text3`=`#8B8B8B` are *solid hex, not opacity-of-black*. The opacity-modifier trick only round-trips for dark mode. For light mode you need either (a) explicit `forge.text2`/`forge.text3` solid-hex tokens with a `dark:` opacity override, or (b) `text-forge-text/62 dark:... light:...`. **Recommend adding solid `forge.text2`/`forge.text3`/`forge.borderStrong` tokens with both DEFAULT (dark rgba-as-hex-approx) and light hex, and using `dark:`/light classes** — cleaner than mixing opacity and solid. The planner should resolve this precisely (OQ-3). This is the single most error-prone part of the token migration.

### Pattern 2: Font loading + splash gate (DSGN-02)
**What:** Load 4 self-hosted font files via `expo-font`, gate the splash on `fontsReady && localeReady && status!=='loading'`, fail open.
**When to use:** Wave 0, alongside token migration.
**Example:**
```tsx
// Source: CITED ARCHITECTURE.md §2 (adapted — note .otf for Inter Display)
import * as Font from 'expo-font';
function FontBootstrap() {
  const setFontsReady = useFontStore(s => s.setFontsReady);
  useEffect(() => {
    Font.loadAsync({
      'InterDisplay':          require('../assets/fonts/InterDisplay-Regular.otf'),
      'InterDisplay-SemiBold': require('../assets/fonts/InterDisplay-SemiBold.otf'),
      'InterDisplay-Bold':     require('../assets/fonts/InterDisplay-Bold.otf'),
      'JetBrainsMono':         require('../assets/fonts/JetBrainsMono-Regular.ttf'),
    }).then(() => setFontsReady(true))
      .catch(() => setFontsReady(true)); // FAIL-OPEN — D-05 + ARCHITECTURE.md §2
  }, []);
  return null;
}
```
**Family-name → weight mapping note:** RN does NOT synthesize weights from one family the way the web does. With NativeWind/RN you typically register **each weight as its own family name** and select it explicitly. `fontFamily: { display: ['InterDisplay', ...] }` only maps the `font-display` class to the **Regular** family. SemiBold/Bold need either separate utility classes (e.g. extend `fontFamily` with `display-semibold`/`display-bold`) OR a small set of Text style helpers. The lib.jsx contract uses weights 400/600/700 of Inter Display extensively (every heading + numeral). **The planner must decide how the 3 display weights are exposed** (3 fontFamily entries, or a `<Display weight>` text component). Recommend 3 fontFamily classes: `font-display` (400), `font-display-semibold` (600), `font-display-bold` (700). (OQ-4)

### Pattern 3: i18n init (I18N-01, D-09/D-10)
**What:** Module-scope i18next init with flat single-namespace resources; `LocaleBootstrap` applies the saved override before the splash clears.
**Example:**
```ts
// app/lib/i18n.ts — Source: CITED ARCHITECTURE.md §7
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import sv from '../locales/sv.json';
import en from '../locales/en.json';

i18n.use(initReactI18next).init({
  resources: { sv: { translation: sv }, en: { translation: en } },
  lng: Localization.getLocales()[0]?.languageCode ?? 'sv',
  fallbackLng: 'sv',                       // CONTEXT default app language is Swedish
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',                 // i18next v26 default; ensures plural/format JSON shape
});
export default i18n;
```
```tsx
// LocaleBootstrap (sibling in _layout.tsx) — reads saved override, gates splash
function LocaleBootstrap() {
  const setLocaleReady = useFontStore(s => s.setLocaleReady);
  useEffect(() => {
    AsyncStorage.getItem('fm:language')
      .then(v => { const l = z.enum(['sv','en']).catch('sv').parse(v); return i18n.changeLanguage(l); })
      .catch(() => {})
      .finally(() => setLocaleReady(true));   // fail-open like FontBootstrap
  }, []);
  return null;
}
```
**Interpolation transcription (D-09):** function-valued lib.jsx strings become i18next interpolations:
- `setsSavedBody: (n) => \`${n} set sparade. Avsluta passet?\`` → `"setsSavedBody": "{{n}} set sparade. Avsluta passet?"` (sv) / `"{{n}} sets saved. Finish workout?"` (en)
- `pbSub: (kg, reps) => \`${kg} kg × ${reps} reps\`` → `"pbSub": "{{kg}} kg × {{reps}} reps"` (both locales)
- `noSetsBody`, `welcomeSub`, all others → direct string copy.
- **Source verbatim:** `lib.jsx` lines 7–223. There are exactly **3 function-valued keys** (`setsSavedBody`, `pbSub`, plus none other — `noSetsBody` is a plain string). Every other key is a plain string. The sv and en objects have the **same key set** (verified by reading both halves) — a 1:1 completeness diff in Phase 15 will be trivial.

### Pattern 4: Static Skia ProgressRing (DSGN-05, D-08)
**What:** Two concentric circles via Skia `<Canvas>` + `<Circle>` (stroke-only), the foreground one a partial arc via `strokeDasharray`-equivalent using a sweep `Path` or `start`/`end` on a circle path. STATIC — no `useSharedValue`.
**Port note:** lib.jsx uses SVG `<circle strokeDasharray={\`${dash} ${c}\`} strokeLinecap="round">` rotated -90°. The Skia equivalent: build a circular `Path` with `addArc`, render with `<Path style="stroke" strokeWidth strokeCap="round">`, and set the foreground arc's sweep angle to `value * 360`. Gradient via Skia `<SweepGradient>` or `<LinearGradient>` child of the `<Path>`. Center content (`children`) overlays via an absolutely-positioned `<View>` sibling of `<Canvas>`.
```tsx
// Conceptual — Source: lib.jsx ProgressRing (lines 424-452) ported to Skia
// import { Canvas, Path, Skia, SweepGradient, vec } from '@shopify/react-native-skia';
const r = (size - stroke) / 2;
const cx = size / 2, cy = size / 2;
const bg = Skia.Path.Make(); bg.addCircle(cx, cy, r);
const fg = Skia.Path.Make();
fg.addArc({ x: cx-r, y: cy-r, width: 2*r, height: 2*r }, -90, 360 * Math.min(1, Math.max(0, value)));
// <Canvas style={{width:size,height:size}}>
//   <Path path={bg} style="stroke" strokeWidth={stroke} color={trackColor} />
//   <Path path={fg} style="stroke" strokeWidth={stroke} strokeCap="round" color={color}>
//     {gradient && <SweepGradient c={vec(cx,cy)} colors={gradient} />}
//   </Path>
// </Canvas>
```
**Default values (from lib.jsx + UI-SPEC):** `size` 80 (104 on Home hero), `stroke` 8 (11 on hero), `value` 0..1, `color`=accent, `trackColor`=`rgba(255,255,255,0.08)` dark / `rgba(0,0,0,0.06)` light, `gradient?: [gradFrom, gradTo]`.

### Pattern 5: Static Skia Sparkline (DSGN-05, D-08)
**What:** Skia `Path` line built from `moveTo`/`lineTo` over normalized data, optional gradient fill area, last-point dot + halo. STATIC.
**Port note:** lib.jsx normalizes with `pad = strokeWidth + 2`, maps each point to `[x,y]`, builds path string, and a fill path closing to the baseline. Skia: `Skia.Path.Make()` + `moveTo`/`lineTo`; fill area is a second path closed to `height`; gradient fill `color@0.35 → transparent` via `<LinearGradient start=vec(0,0) end=vec(0,height)>`. Dot = `<Circle r={strokeWidth+1.5}>` + halo `<Circle r={strokeWidth+4.5} opacity={0.18}>`.
**Defaults:** `width` 200 (340 on history card), `height` 48 (56 on history), `color`=accent, `fill` true, `showDot` true, `strokeWidth` 2 (2.5 on history). (lib.jsx lines 457-488, used in FHistory line 591.)

### Pattern 6: Logo / AppIcon (DSGN-06, D-03)
**What:** `Logo` = Ascend mark (two rising rounded bars + peak dot), `react-native-svg` `<Path>`/`<Circle>` 1:1 from lib.jsx (lines 667-688). `gradient` variant uses `<LinearGradient>` stroke; `white` variant uses `#fff` stroke. `AppIcon` = gradient squircle `<View>` (NativeWind `bg` + radius `size*0.28`) containing white `Logo` at `size*0.62` with a brand-colored shadow.
**Brand discipline (UI-SPEC + README):** Ascend mark = brand only (Logo/AppIcon, header brand tiles, PR trophy badge, ProgressRing fill). The **barbell** icon stays a **content** icon (plan cards, Planer tab) — never rendered in brand gradient.

### Pattern 7: TabBar shell — build standalone, do NOT wire to live Tabs
**What:** Build `TabBar.tsx` as a presentational component matching lib.jsx `TabBar` (floating, blurred `bg-forge-tabBg`, active=accent+weight600, inactive=text3+weight500, label 10.5px) and render it in the gallery only.
**Why not wire it:** The live `(tabs)/_layout.tsx` uses expo-router `<Tabs>` with `@expo/vector-icons` Ionicons and `tabBarStyle`/`tabBarIcon`. Swapping the live tab bar to a custom `tabBar={() => <ForgeTabBar/>}` is a **navigation-behavior-adjacent change** that risks the "no screen-behavior change" boundary and the floating/blur layout interacting with `SafeAreaView`. CONTEXT D-01 explicitly scopes it as "re-skin the shell's appearance only … wires to existing expo-router tabs without changing routes/behavior" — interpret conservatively: **build the component now, wire it in Phase 9+** when a screen re-skin is in scope. (OQ-5)

### Anti-Patterns to Avoid
- **Copy-pasting lib.jsx/forge-screens.jsx as RN code.** They are web React (`<div>`, CSS `background`, `boxShadow`, `backdropFilter`, `<svg>`). Every line must be re-authored in RN primitives + NativeWind. Treat them as a *visual spec*.
- **Adding animation to ProgressRing/Sparkline.** Explicitly Phase 12 (MOTN-02/03). No `useSharedValue`/`withTiming` this phase.
- **Hardcoding rgba-with-alpha as Tailwind hex values.** NativeWind 4 may not resolve `#RRGGBBAA` reliably — use opacity modifiers (dark) / solid tokens (light) per Pattern 1.
- **Re-skinning a production screen.** Phase boundary: the gallery is the ONLY new visible surface. `(tabs)/index`, `workout/*`, auth, settings stay on their v1 `bg-gray-*`/`text-blue-*` classes (which coexist with `forge.*`).
- **Touching `app/lib/query/*`.** F13 gate. Nothing in Phase 8 needs it.
- **Installing `expo-localization` via `npm install`.** Pulls SDK-56 latest; breaks SDK-54 build. Use `npx expo install`.
- **Sweeping existing Swedish literals into `t()`.** Deferred to Phase 11/15.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Locale string lookup + interpolation | Custom `t()` + dictionary | `i18next` + `react-i18next` | Plurals, interpolation, fallback, re-render-on-change all solved |
| Device locale detection | Parse `navigator`/`NativeModules` | `expo-localization` `getLocales()` | First-party, synchronous, SDK-pinned |
| Number formatting (`1 234,5`) | Manual `replace(/,/g,' ')` | `Intl.NumberFormat('sv-SE')` (Hermes-native) | lib.jsx's `fmtNum` is a hack; Intl handles all locales correctly |
| Date formatting | Manual month-name maps | `date-fns/format` + `sv`/`enUS` locale | Already installed; locale objects ship with it |
| Activity ring / sparkline | d3 + custom SVG math | `@shopify/react-native-skia` (installed) | GPU-drawn, animation-ready for Phase 12; no new dep |
| Font loading + splash hold | Manual `Asset` + timer | `expo-font` `Font.loadAsync` + `expo-splash-screen` | Race-free; already installed |
| Vector icons | Per-icon PNG assets | `react-native-svg` `<Path>` (or Skia) | 1:1 port of lib.jsx path strings; scalable, tintable |

**Key insight:** Almost every "hard" part of this phase already has a locked, first-party solution. The actual work is *transcription and porting*, not invention. The only genuine engineering decisions are the SVG-vs-Skia icon port (OQ-1) and how the 3 Inter Display weights are exposed as classes (OQ-4).

## Common Pitfalls

### Pitfall 1: Tailwind v4 silently breaks NativeWind
**What goes wrong:** Upgrading or letting a transitive bump pull Tailwind 4 makes `react-native-css-interop@0.2.3` (NativeWind 4's engine) fail its `tailwindcss: "~3"` peer; classes stop resolving.
**Why it happens:** `npm install tailwindcss` with no pin grabs v4.
**How to avoid:** Keep `tailwindcss@^3.4.17` pinned (already is). Never run an unpinned tailwind install. (PITFALLS.md.)
**Warning signs:** `forge-*` classes render as no-ops; build warns about peer mismatch.

### Pitfall 2: `expo-localization` SDK-56 version trap
**What goes wrong:** `npm install expo-localization` installs `56.0.6` (unpinned latest) into an SDK-54 project → native module mismatch / build failure.
**How to avoid:** `npx expo install expo-localization` (resolves SDK-54 pin `~17.0.9`).
**Warning signs:** Expo doctor flags version mismatch; runtime "incompatible native module".

### Pitfall 3: RN doesn't synthesize font weights
**What goes wrong:** Setting `font-display` + a `font-bold` Tailwind class does NOT produce Inter Display Bold — RN renders the Regular file at faux-bold or ignores it.
**Why it happens:** RN selects a font by exact family name; there's no weight synthesis across one registered family.
**How to avoid:** Register each weight as its own family (`InterDisplay`, `InterDisplay-SemiBold`, `InterDisplay-Bold`) and map each to a distinct class/component. (OQ-4, Pattern 2.)
**Warning signs:** Headings look like the wrong weight; SemiBold == Regular on device.

### Pitfall 4: Light-mode rgba tokens don't round-trip via opacity modifier
**What goes wrong:** `text-forge-text/62` gives white@62% in dark (correct) but black@62% in light — but the design's light `text2` is `#4D4D4D` (a warm gray, NOT black@62%). Colors drift subtly in light mode.
**How to avoid:** Add solid `forge.text2/text3/border/borderStrong` light-hex tokens; use `dark:`-prefixed opacity for dark and solid for light. (Pattern 1 gotcha, OQ-3.)
**Warning signs:** Light-mode secondary text looks too pure-black or wrong-temperature vs the spec.

### Pitfall 5: Skia `<Canvas>` sizing / overflow
**What goes wrong:** Skia `<Canvas>` needs explicit width/height; Sparkline halo (`overflow:visible` in web) can clip in RN.
**How to avoid:** Size the `<Canvas>` to `width`/`height` props; if the last-point halo extends past bounds, pad the canvas or inset the path (lib.jsx already pads by `strokeWidth+2`).
**Warning signs:** Ring/sparkline cut off; dot halo clipped.

### Pitfall 6: Gallery route accidentally appears in navigation
**What goes wrong:** A file at `app/(app)/_forge-gallery.tsx` could be picked up as a route; if named as a tab child it would show as a tab.
**How to avoid:** Place it OUTSIDE `(tabs)` (it's already `(app)/_forge-gallery`), leading underscore keeps expo-router from treating it as a default child of a layout's tab list; reach it via explicit `router.push('/_forge-gallery')` in dev only. Confirm it does not render in the live tab bar. (D-06, OQ-6.)
**Warning signs:** A "forge-gallery" tab/route visible in normal app navigation.

### Pitfall 7: Splash never clears if a gate flag is never set
**What goes wrong:** Adding `fontsReady`/`localeReady` to the splash gate but forgetting the fail-open `.catch`/`.finally` → a font/AsyncStorage error hangs on the splash forever.
**How to avoid:** Both `FontBootstrap` and `LocaleBootstrap` must set their ready flag on BOTH success and failure (Patterns 2 & 3). (ARCHITECTURE.md §2 fail-open; risk register row "Font loading failure".)
**Warning signs:** App stuck on splash on a device with a corrupt `fm:language` value or missing font.

## Code Examples

### Tabular numerals in RN (DSGN-03)
```tsx
// lib.jsx numStyle (line 617) ported to RN style. RN uses `fontVariant` array;
// `fontFeatureSettings` is iOS-supported via fontVariant 'tabular-nums'.
// Source: lib.jsx numStyle + RN Text style API
export const tnum = { fontVariant: ['tabular-nums'] as const };
// usage: <Text style={tnum} className="font-display-bold text-forge-text">{value}</Text>
```
> Note: RN's `Text` supports `fontVariant: ['tabular-nums']` natively (iOS). The web-only `fontFeatureSettings: '"tnum","ss01"'` (`ss01` stylistic set) is NOT a standard RN style prop — `ss01` may be lost. The Inter Display family's default figures + `tabular-nums` cover the alignment requirement (DSGN-03 = alignment). The `ss01` stylistic refinement is cosmetic and acceptable to drop. [ASSUMED — verify on device whether numerals align; alignment is the testable requirement]

### Number / date formatting (I18N-04)
```ts
// app/lib/utils/format.ts
// Source: ARCHITECTURE.md §7 + Hermes Intl (iOS) confirmed via Expo localization docs
import { format } from 'date-fns';
import { sv, enUS } from 'date-fns/locale';

export const fmtNum = (n: number, locale: 'sv' | 'en') =>
  new Intl.NumberFormat(locale === 'sv' ? 'sv-SE' : 'en-US').format(n);
// sv-SE → "14 540" (space thousands, comma decimal); en-US → "14,540"

export const fmtDate = (d: Date, locale: 'sv' | 'en', fmt = 'd MMM yyyy') =>
  format(d, fmt, { locale: locale === 'sv' ? sv : enUS });
```

### ForgeChip (DSGN-04) — illustrative RN port
```tsx
// Source: forge-screens.jsx ForgeChip (lines 205-218) → RN
// <View className="flex-row items-center gap-1 px-[9px] py-1 rounded-lg
//                  bg-forge-surface2 border border-forge-text/8 dark:border-forge-text/8">
//   {icon && <Icon name={icon} size={12} color={accent} strokeWidth={2} />}
//   <Text className="text-xs font-semibold text-forge-text/62">{children}</Text>
// </View>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `i18n-js` / `react-native-i18n` | `i18next` + `react-i18next` v17 | ongoing | Hooks API, TS types, plurals — locked choice |
| Intl polyfills in RN | Hermes-native `Intl` (iOS) | RN 0.70+ / Hermes | No polyfill needed for `Intl.NumberFormat` |
| SVG charts via `react-native-svg` + d3 | Skia GPU paths | Skia 1.x+ | Animation-ready, faster; DSGN-05 mandates Skia |
| `Localization.locale` (string) | `Localization.getLocales()[0].languageCode` | expo-localization 14+ | Use `getLocales()`; old `.locale` deprecated |

**Deprecated/outdated:**
- `Localization.locale` string accessor — use `getLocales()`.
- Inter-Tight as the display fallback (ROADMAP note) — **superseded by D-05**: use standard Inter via `@expo-google-fonts/inter`.
- lib.jsx `fmtNum` (`toLocaleString('sv-SE').replace(/,/g,' ')`) — replace with `Intl.NumberFormat` (handles decimals correctly; the lib hack mangles decimal commas).

## Runtime State Inventory

> Phase 8 is **greenfield-additive** (new files + token/font/i18n scaffolding). It is NOT a rename/refactor/migration. No existing runtime state is renamed or migrated. The five categories are answered explicitly below for completeness:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no DB/datastore key is renamed or added (no `0007` migration in Phase 8 per build-order). | None |
| Live service config | None — no n8n/Datadog/external-service config touched. | None |
| OS-registered state | None — no Task Scheduler / launchd / pm2 entries. `app.json` app-icon/splash NOT swapped (D-03). | None |
| Secrets/env vars | None — no new secret/env var. `fm:language` AsyncStorage key is new but holds a UI pref, not a secret; read by `LocaleBootstrap`. | None (new key writes happen in Settings phase, not Phase 8) |
| Build artifacts | New `assets/fonts/` files must be bundled by Metro (handled by `require()` + expo-font). New deps require `npm install` then a Metro restart. | Restart Metro after install; confirm font files committed to git (not gitignored) |

**Note on `fm:language`:** ARCHITECTURE.md §3 lists `fm:language` as new in Phase 8. In Phase 8, `LocaleBootstrap` only *reads* it (it won't exist yet for existing users → falls back to device locale via `expo-localization`, then `sv`). It is *written* by the Settings language picker, which is a later phase. No migration of existing data needed.

## Common Pitfalls (security cross-ref)
See §Security Domain.

## Validation Architecture

> Nyquist validation is enabled (`workflow.nyquist_validation: true`). Per D-07, verification is **manual device UAT in Expo Go via the dev-only gallery** — there is NO RN render-test harness in the stack. This section defines what the gallery must render to prove each success criterion, the manual UAT steps, and the cheap static checks that CAN be automated.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None for RN component rendering (D-07 — no RN testing harness in stack). The gallery route IS the test surface. |
| Config file | none |
| Quick run command | `cd app && npx tsc --noEmit` (type check) ; `cd app && npm run lint` (expo lint) |
| Full suite command | `cd app && npx tsc --noEmit && npm run lint && npm run test:f13-brutal` (F13 regression must stay green) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File/Surface |
|--------|----------|-----------|-------------------|--------------|
| DSGN-01 | `forge.*` classes resolve to correct hex/rgba | static + manual | `npx tsc --noEmit` (compile) + gallery swatch grid visual | gallery swatches (dark+light) |
| DSGN-02 | Inter Display + JetBrains Mono render | manual UAT | — | gallery type-scale section on device |
| DSGN-03 | Numerals align (tabular) | manual UAT | — | gallery: column of stacked numbers must align decimal/digits |
| DSGN-04 | Every primitive renders in every variant/size, light+dark | manual UAT | `npx tsc --noEmit` (prop-type correctness) | gallery component matrix |
| DSGN-05 | ProgressRing + Sparkline render via Skia | manual UAT | — | gallery: ring at a few `value`s; sparkline with sample data |
| DSGN-06 | Logo (gradient+white) + AppIcon render | manual UAT | — | gallery brand section |
| I18N-01 | Text from translation resources | manual UAT | static: a `sv.json`/`en.json` key-parity check script (cheap, automatable) | gallery sv↔en toggle flips a sample string |
| I18N-04 | `1 234,5` (sv) vs `1,234.5` (en); locale dates | manual UAT | a tiny pure-function unit check of `fmtNum`/`fmtDate` is automatable (no RN render needed) | gallery number/date sample reacting to toggle |

### Sampling Rate
- **Per task commit:** `cd app && npx tsc --noEmit` (catches token-class typos, prop-type mismatches, bad requires).
- **Per wave merge:** `npx tsc --noEmit && npm run lint` + manual gallery smoke (open gallery, flip dark/light, flip sv/en).
- **Phase gate:** Full gallery UAT in Expo Go on a physical iPhone (all sections render in both themes + both locales) AND `npm run test:f13-brutal` green (proves the additive change didn't disturb the offline queue).

### Wave 0 Gaps
- [ ] `app/components/ui/` directory — does not exist yet (must be created).
- [ ] `app/assets/fonts/` directory + 4 font files — must be sourced & committed.
- [ ] `app/locales/` directory + `sv.json`/`en.json` — must be created from lib.jsx.
- [ ] (Optional, cheap) `app/scripts/check-locale-parity.ts` — asserts `Object.keys(sv) === Object.keys(en)` so the sv/en completeness diff is automatable now and in Phase 15. Recommend adding; it is the one genuinely automatable i18n test.
- [ ] (Optional) `app/lib/utils/__tests__` — pure-function checks for `fmtNum`/`fmtDate` (no test runner in stack; would require adding one — DEFER per D-07, but the functions are pure and trivially verifiable in the gallery).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Expo SDK / Metro | everything | ✓ | `~54.0.33` | — |
| `@shopify/react-native-skia` | ProgressRing, Sparkline | ✓ installed | `2.2.12` | — |
| `expo-font`, `expo-splash-screen` | font load + gate | ✓ installed | `~14.0.11`, `~31.0.13` | — |
| `date-fns` (+ locales) | I18N-04 dates | ✓ installed | `^4.1.0` | — |
| Hermes `Intl.NumberFormat` (iOS) | I18N-04 numbers | ✓ (Hermes-native on iOS) | n/a | `Intl` confirmed on iOS Hermes; no polyfill |
| `i18next` / `react-i18next` | I18N-01 | ✗ to install | `^26.3.1` / `^17.0.8` | none — required |
| `expo-localization` | locale detect | ✗ to install | SDK pin `~17.0.9` | hardcode `lng:'sv'` (degraded) |
| `@expo-google-fonts/inter` | D-05 fallback | ✗ to install | `0.4.2` | system font (degraded look) |
| `react-native-svg` | Icon/Logo/AppIcon | ✗ to install (pending OQ-1) | SDK pin (~15.x) | render icons via Skia (no new dep) |
| Inter Display font files | DSGN-02 | ✗ to source | rsms/inter v4.1 | standard Inter via @expo-google-fonts/inter (D-05) |
| JetBrains Mono Regular | DSGN-02 (mono) | ✗ to source | JetBrains/JetBrainsMono | — (required for mono cells) |

**Missing dependencies with no fallback:** `i18next`, `react-i18next` (required); JetBrains Mono file (required for mono numeric cells).
**Missing dependencies with fallback:** `expo-localization` (→ hardcoded default locale), Inter Display (→ standard Inter per D-05), `react-native-svg` (→ Skia icons).

### Font sourcing detail (the primary gap this research fills)
- **Inter Display** — NOT on Google Fonts and has **no `@expo-google-fonts` package** [CITED: STACK.md "What NOT to Add"]. Self-host from the official rsms/inter releases (latest **v4.1**, "Inter Display" introduced as a static family in v4.0 via the `opsz` axis) [CITED: github.com/rsms/inter/releases]. License: **SIL Open Font License 1.1** (Inter is OFL — free to bundle in apps; include the license file). Distribution ships static OTFs in an `extras/otf/` (or `Inter Desktop`) folder named `InterDisplay-Regular.otf`, `InterDisplay-SemiBold.otf`, `InterDisplay-Bold.otf` (also `-Medium`, `-Black`, etc.) [ASSUMED — exact folder/extension: ARCHITECTURE.md §2 wrote `.otf` for Inter Display and `.ttf` for JetBrains Mono; confirm by inspecting the downloaded zip. Both `.otf` and `.ttf` load fine via expo-font].
- **JetBrains Mono Regular** — from JetBrains/JetBrainsMono releases, **OFL 1.1**, ships TTFs; bundle `JetBrainsMono-Regular.ttf`. (Also available as `@expo-google-fonts/jetbrains-mono@0.4.1` but D-04/ARCHITECTURE commit to self-hosting — do not add the package.) [CITED: STACK.md]
- **Physical location:** `app/assets/fonts/` (4 files). `require()`'d in `FontBootstrap`. Must be committed (not gitignored).
- **D-05 fallback path:** if any Inter Display weight can't be sourced/loaded, register the matching standard Inter weight from `@expo-google-fonts/inter` under the SAME family name in the `Font.loadAsync` map (e.g. `'InterDisplay-Bold': Inter_700Bold`). Look is preserved; only the optical-size Display refinement is lost. On top of the fail-open splash catch.

## Security Domain

> `security_enforcement: true`, ASVS L1, block-on-high. Phase 8's attack surface is small (presentational/additive, no auth, no DB, no network writes), but the per-phase `<threat_model>` STRIDE register is still required by CLAUDE.md.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface touched (auth-store untouched) |
| V3 Session Management | no | Sessions untouched (`expo-secure-store` / `LargeSecureStore` not modified) |
| V4 Access Control | no | No data access; gallery is dev-only behind the existing `(app)` session guard |
| V5 Input Validation | yes (minimal) | `fm:language` read from AsyncStorage is parsed with `z.enum(['sv','en']).catch('sv')` (corrupt-value safe, mirrors existing `fm:theme` pattern). Locale JSON is static/bundled. No user free-text enters the i18n engine in Phase 8. |
| V6 Cryptography | no | No crypto |
| V14 Configuration | yes (minimal) | New deps from first-party registries; no secrets added; font files are static assets |

### Known Threat Patterns for {Expo RN presentational layer}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Corrupt/injected `fm:language` AsyncStorage value | Tampering | `z.enum(['sv','en']).catch('sv')` parse in `LocaleBootstrap` (same hardening as `fm:theme` in `ThemeBootstrap`) |
| i18n interpolation injection (untrusted value into `{{n}}`) | Tampering/Injection | Phase 8 only interpolates app-controlled values (`n`, `kg`, `reps`); `interpolation.escapeValue:false` is safe here because RN `<Text>` does not interpret markup (no XSS surface like web). Note for later phases: if user content is ever interpolated, it is still safe in RN `<Text>` (no HTML rendering). |
| Dev-only gallery reachable in production build | Info disclosure (minor) | Gallery is behind the `(app)` session guard and not in the tab nav; consider a `__DEV__` guard on the route so it cannot be reached in a release/TestFlight build (defense-in-depth; low severity since it shows no real data — only sample/SAMPLE data). |
| Slopsquatted dependency at install | Supply chain (Tampering) | All net-new deps are i18next-org / Expo first-party with multi-year history (see Package Legitimacy Audit). Pin versions; `expo install` for native modules. |
| Malicious font file | Tampering | Source Inter/JetBrains from official OFL releases only; commit the exact files reviewed. |

**Expected STRIDE register size for Phase 8 plans:** small (≈4–6 threats, all `mitigate` or `accept`), reflecting the minimal surface. `gsd-secure-phase 8` should reach `threats_open: 0` easily.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `react-native-svg` is the right tool for Icon/Logo/AppIcon (vs Skia) | Standard Stack / OQ-1 | Low — if Skia preferred, no new dep; either works. Re-port effort if switched mid-build. |
| A2 | Inter Display ships as `.otf` static files named `InterDisplay-{Weight}.otf` | Font sourcing | Low — extension may be `.ttf`; both load via expo-font. Confirm by inspecting zip. ARCHITECTURE.md §2 already assumed `.otf`. |
| A3 | `ss01` stylistic set is not preservable via RN style props; `tabular-nums` alone satisfies DSGN-03 | Code Examples (tnum) | Low — alignment (the requirement) is met by `tabular-nums`; only a cosmetic refinement lost. Verify on device. |
| A4 | All net-new package versions (i18next 26.3.1 etc.) are legitimate | Package Legitimacy Audit | Low — confirmed via `npm view`; all first-party/established orgs; but tagged ASSUMED per provenance rule (registry existence ≠ verified). |
| A5 | The TabBar shell should be built standalone and NOT wired to live `<Tabs>` this phase | Pattern 7 / OQ-5 | Medium — if the intent was to wire it live, the plan misses a task. CONTEXT D-01 language ("no navigation behavior change", "no screen-behavior change") supports the conservative reading. |
| A6 | Light-mode rgba tokens need solid-hex token entries (opacity modifier doesn't round-trip) | Pattern 1 / OQ-3 | Medium — if not handled, light-mode secondary colors drift from spec. |
| A7 | The 3 Inter Display weights must be exposed as 3 distinct font classes/families | Pattern 2 / OQ-4 | Medium — RN weight-synthesis gotcha; wrong approach = headings render at wrong weight. |
| A8 | No `0007` profiles migration in Phase 8 (it belongs to a later phase) | Project Constraints | Low — build-order doc §8 lists `0007` under "Phase 8 Foundation" but CONTEXT/REQUIREMENTS scope Phase 8 to tokens/fonts/i18n/components with NO schema change. Confirm scope. (OQ-7) |

## Open Questions

1. **OQ-1 — Icon/Logo/AppIcon: `react-native-svg` or Skia?**
   - Known: Skia is installed (no new dep); `react-native-svg` gives 1:1 `<Path d>` transcription of lib.jsx's 30+ icon path strings.
   - Unclear: whether the team prefers zero-new-deps (Skia) over port simplicity (svg).
   - Recommendation: `react-native-svg` for static stroke icons (lower port risk); reserve Skia for ProgressRing/Sparkline (DSGN-05 mandate + Phase 12 animation). Confirm in discuss-phase.

2. **OQ-2 — Component dir path: `components/ui/` (flat) or `components/ui/forge/`?**
   - CONTEXT + UI-SPEC say `app/components/ui/`; ARCHITECTURE.md §8 says `components/ui/forge/`.
   - Recommendation: flat `app/components/ui/` (one design system). Pick one before building so imports are consistent.

3. **OQ-3 — Light-mode rgba token strategy.** Solid-hex tokens for `text2/text3/border/borderStrong/accentSoft` light values vs opacity-modifier. Recommend solid-hex + `dark:` opacity. Planner must specify exact token entries.

4. **OQ-4 — How are 3 Inter Display weights exposed?** 3 `fontFamily` classes (`font-display`/`font-display-semibold`/`font-display-bold`) vs a `<Display weight>` component. Recommend 3 classes.

5. **OQ-5 — TabBar: build-only this phase, or wire into live `<Tabs>`?** Recommend build-only (gallery), wire in Phase 9+. (A5.)

6. **OQ-6 — Gallery route guarding.** Confirm `app/(app)/_forge-gallery.tsx` (a) doesn't appear in the tab bar, (b) is reachable in dev (router.push), (c) optionally `__DEV__`-guarded against release builds.

7. **OQ-7 — Is `0007_profiles_weekly_goal.sql` in Phase 8 scope?** Build-order doc §8 includes it, but CONTEXT/REQUIREMENTS/UI-SPEC describe Phase 8 as zero-schema-change. Recommend: NOT in Phase 8 (defer to the dashboard phase that consumes `weekly_goal`). Confirm.

## Sources

### Primary (HIGH confidence)
- `app/design v2/Sources/design/lib.jsx` (read in full) — `THEMES.forge` (lines 228-277), `I18N.sv`/`I18N.en` (7-223), `numStyle` (617), `ProgressRing` (424-452), `Sparkline` (457-488), `Logo`/`AppIcon` (667-702), `Icon` set (381-419), `TabBar` (580-612), `fmtNum` (660).
- `app/design v2/Sources/design/forge-screens.jsx` (lines 1-1058 read; primitives + usages) — `ForgeField`, `ForgeChip`, `ForgeStat`, `ForgeInput`, `SettingsRow`/`SettingsSection`, variant/size usage across FSignIn/FHome/FPlanDetail/FWorkout/FHistory/FSessionDetail/FChart/FSettings/FSignUp.
- `.planning/research/ARCHITECTURE.md` §1 (token migration), §2 (font loading + splash gate), §3 (pref storage / `fm:language`), §7 (i18n), §8 (Phase 8 build order + files), risk register.
- `.planning/research/STACK.md` — net-new dep versions, "What NOT to Add", Inter Display self-host requirement, Hermes Intl note.
- `.planning/phases/08-forge-foundation/08-CONTEXT.md` (D-01..D-10) + `08-UI-SPEC.md` (full component inventory, variant/size enums, color/type/spacing).
- `app/app/_layout.tsx`, `app/app/(app)/_layout.tsx`, `app/app/(app)/(tabs)/_layout.tsx`, `app/tailwind.config.js`, `app/lib/persistence-store.ts`, `app/global.css` (read directly — integration points).
- `CLAUDE.md` (constraints, conventions, security frameworks).

### Secondary (MEDIUM confidence)
- `npm view <pkg> version` (run 2026-06-09) — i18next 26.3.1, react-i18next 17.0.8, expo-localization latest 56.0.6 (SDK-56!), @expo-google-fonts/inter 0.4.2, react-native-svg 15.15.5.
- github.com/rsms/inter/releases — Inter v4.1, "Inter Display" static family since v4.0, woff/static distribution, OFL.
- Expo localization docs + Hermes Intl (Medium, FormatJS) — Hermes ships `Intl` on iOS; `Intl.NumberFormat` works with `sv-SE`.

### Tertiary (LOW confidence)
- Exact Inter Display zip folder layout / file extension (`.otf` vs `.ttf`) — inferred from ARCHITECTURE.md §2 + Inter's known distribution structure; confirm by inspecting the download.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions locked + re-verified on registry; only `react-native-svg` is a pending choice (OQ-1).
- Token migration: HIGH (values verbatim) / MEDIUM on the light-mode rgba mechanics (OQ-3) and font-weight class exposure (OQ-4).
- i18n: HIGH — recipe is from ARCHITECTURE.md §7, deps verified, Hermes Intl confirmed.
- Skia primitives: MEDIUM — port from web-SVG reference to Skia Canvas API is mechanical but unverified on-device this session; DSGN-05 only requires static render.
- Pitfalls: HIGH — Tailwind-v4, expo-localization SDK trap, and RN font-weight gotcha are well-established.

**Research date:** 2026-06-09
**Valid until:** 2026-07-09 (stable stack; 30 days)
