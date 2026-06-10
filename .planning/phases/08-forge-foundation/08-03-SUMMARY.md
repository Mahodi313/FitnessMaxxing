---
phase: 08-forge-foundation
plan: 03
subsystem: ui
tags: [react-native-svg, skia, icon-set, brand-logo, app-icon, progress-ring, sparkline, static-primitives, forge-components, dsgn-05, dsgn-06]

# Dependency graph
requires:
  - phase: 08-forge-foundation
    plan: 01
    provides: "react-native-svg@15.12.1 installed (Icon/Logo/AppIcon engine, D-11); @shopify/react-native-skia@2.2.12 already in stack (ProgressRing/Sparkline)"
  - phase: 08-forge-foundation
    plan: 02
    provides: "Forge token palette in tailwind.config.js (forge.* colors, brand gradFrom #FF7A2E / gradTo #FF2D55 used as Logo/AppIcon defaults); accent #FF5A1F used as primitive defaults"
  - phase: 06-history-read-side-polish
    provides: "chart.tsx Skia import idiom (Canvas mental model) — reused WITHOUT its reanimated tooltip imports (D-08 static-only)"
provides:
  - "Icon.tsx — shared react-native-svg stroke icon set with a 33-name `IconName` union (barbell..list), ported 1:1 from lib.jsx path strings (size/color/strokeWidth/fill props)"
  - "Logo.tsx — Ascend brand mark (two rising bars + peak dot, sw 7) with gradient | white variants"
  - "AppIcon.tsx — gradient-squircle (svg Rect + diagonal LinearGradient) wrapping a white Logo; FIT-66 explicit iOS shadow style object (D-03 component-only, no app.json swap)"
  - "ProgressRing.tsx — STATIC Skia activity ring (bg circle + fg arc Path, value clamped 0..1, optional SweepGradient, center children overlay)"
  - "Sparkline.tsx — STATIC Skia line + gradient fill + last-point dot/halo from number[] (halo-padded Canvas, guards data.length<2)"
affects: [08-04-forge-components, 08-05-forge-gallery, forge-components, settings-language-picker, tabbar]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "react-native-svg <Svg><Path d>/<Circle>/<Rect> for static stroke vectors (D-11) — 1:1 transcription of lib.jsx path strings, no Skia.Path string parsing"
    - "react-native-svg <Defs><LinearGradient gradientUnits='userSpaceOnUse'> stroke/fill for the brand gradient (Logo gradient variant, AppIcon squircle)"
    - "Skia <Canvas> + Skia.Path.Make().addArc(rect,-90,360*v) for a static progress arc; <SweepGradient c={vec(cx,cy)}> child of the fg <Path> for the optional gradient fill"
    - "Skia Sparkline: moveTo/lineTo line Path + .copy()-closed fill Path to baseline + <LinearGradient> vertical fade (color@0x59 → color@0x00 hex-alpha) + dot/halo <Circle>s; Canvas padded by halo radius so the last-point halo never clips (Pitfall 5)"
    - "FIT-66 shadow discipline: AppIcon brand drop-shadow is an explicit iOS shadow STYLE object (shadowColor/Offset/Opacity/Radius), never a shadow-* NativeWind class"
    - "T-08-06 render-DoS guard: ProgressRing clamps value 0..1 (NaN→0); Sparkline early-returns on data.length<2 (no zero-divisor / undefined min/max)"

key-files:
  created:
    - app/components/ui/Icon.tsx
    - app/components/ui/Logo.tsx
    - app/components/ui/AppIcon.tsx
    - app/components/ui/ProgressRing.tsx
    - app/components/ui/Sparkline.tsx
  modified: []

key-decisions:
  - "Icon default `color` is the Forge light-text hex `#0A0A0A` (lib.jsx default 'currentColor' has no RN equivalent). Callers pass a token color at the use-site (the gallery + Plan 04 components drive color from forge.* tokens). The prop shape mirrors the existing Ionicons name/color/size analog."
  - "AppIcon's gradient squircle is rendered with a react-native-svg <Rect rx ry> + diagonal <LinearGradient> (same engine as Logo, D-11) rather than a NativeWind background — NativeWind cannot render a gradient background, and this keeps the brand-gradient surface on one vector engine."
  - "Sparkline gradient opacity is expressed as hex-alpha suffixes on the color string (`${color}59` ≈ 0.35, `${color}00` = transparent) so the lib.jsx `stopOpacity 0.35 → 0` maps to a Skia <LinearGradient colors> array without a separate opacity channel."
  - "Sparkline draws the halo Circle BEFORE the solid dot (reverse of lib.jsx source order) so the opaque dot paints on top of its own translucent halo — same visual, correct z-order in Skia's painter model."

requirements-completed: [DSGN-05, DSGN-06]

# Metrics
duration: ~12min
completed: 2026-06-10
---

# Phase 8 Plan 03: Vector + Skia Primitive Layer Summary

**Built the brand + data-viz building blocks of the Forge library: a shared 33-name react-native-svg `Icon` set (path strings ported 1:1 from lib.jsx), the Ascend `Logo` (gradient + white) and gradient-squircle `AppIcon` brand components, and two STATIC Skia primitives `ProgressRing` and `Sparkline` — all token-driven, no new dependency, and with no animation primitives (D-08).**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-06-10
- **Tasks:** 2 (both auto, no checkpoints)
- **Files modified:** 5 (all created)

## Accomplishments
- **Task 1 (`9d86fc1`):** `Icon.tsx` (react-native-svg, D-11) with a 33-member `IconName` union covering the full UI-SPEC enum (`barbell`..`list`); every `<path d="...">` string transcribed verbatim from lib.jsx `Icon` (line 381). 24×24 viewBox, `strokeWidth` 1.8 default, round caps/joins, `fill="none"` default; filled glyphs (`checkCircle`, `ellipsis`, `grip`, `play`, `pause`) honor lib.jsx's `fill={color} stroke="none"`. `Logo.tsx` — Ascend mark (two rising rounded bars + peak dot, sw 7) with `gradient`/`white` variants via a `<LinearGradient>` stroke. `AppIcon.tsx` — gradient squircle (svg `<Rect rx ry>` + diagonal `<LinearGradient>`) wrapping a white `<Logo size={size*0.62}>`, with a brand-colored drop shadow as an explicit iOS shadow STYLE object (FIT-66). Component-only (D-03 — no `app.json` swap).
- **Task 2 (`714086b`):** `ProgressRing.tsx` — STATIC Skia `<Canvas>` with a background full-circle `Path` and a foreground arc `Path` (`addArc(rect, -90, 360*clamp(value))`), round stroke cap, optional `<SweepGradient>` child, center `children` overlay; `value` clamped to 0..1 (T-08-06). `Sparkline.tsx` — STATIC Skia normalized `moveTo`/`lineTo` line `Path`, a `.copy()`-closed fill `Path` to the baseline with a vertical `<LinearGradient>` fade, and a last-point dot + soft halo; the Canvas is padded by the halo radius so the halo never clips (Pitfall 5), and `data.length < 2` is guarded (T-08-06). Neither file imports any reanimated animation primitive (D-08).

## Task Commits

Each task was committed atomically:

1. **Task 1: Icon set (react-native-svg) + Logo + AppIcon** — `9d86fc1` (feat) [FIT-77]
2. **Task 2: Static Skia ProgressRing + Sparkline** — `714086b` (feat) [FIT-77]

## Files Created/Modified
- `app/components/ui/Icon.tsx` (created, Task 1) — react-native-svg icon set; `IconName` union; lib.jsx path strings 1:1; size/color/strokeWidth/fill props.
- `app/components/ui/Logo.tsx` (created, Task 1) — Ascend mark; `variant: 'gradient' | 'white'`; `from`/`to` brand-gradient stops; `<LinearGradient gradientUnits="userSpaceOnUse">`.
- `app/components/ui/AppIcon.tsx` (created, Task 1) — gradient-squircle View wrapping white Logo; FIT-66 explicit iOS shadow style object; radius `size*0.28`, Logo `size*0.62`.
- `app/components/ui/ProgressRing.tsx` (created, Task 2) — static Skia ring; clamp 0..1; optional `gradient: [from,to]` SweepGradient; `children` center overlay.
- `app/components/ui/Sparkline.tsx` (created, Task 2) — static Skia line + gradient fill + dot/halo; `data: number[]`; halo-padded Canvas; `data.length<2` guard.

## Decisions Made
- **Icon default color = `#0A0A0A`** (Forge light-text hex). lib.jsx's `'currentColor'` has no RN equivalent; callers pass a `forge.*` token color at the use-site. Prop shape mirrors the existing Ionicons `name`/`color`/`size` analog.
- **AppIcon gradient via react-native-svg, not NativeWind.** NativeWind can't render a gradient background; an svg `<Rect rx ry>` + diagonal `<LinearGradient>` keeps the whole brand-gradient surface on one vector engine (consistent with Logo, D-11).
- **Sparkline gradient as hex-alpha on the color string** (`${color}59` ≈ 0.35, `${color}00` = transparent) so lib.jsx's `stopOpacity 0.35 → 0` maps onto a Skia `<LinearGradient colors>` array.
- **Sparkline halo drawn before the dot** so the opaque dot paints over its own translucent halo (correct z-order under Skia's painter model; identical visual to lib.jsx).

## Deviations from Plan

None - plan executed exactly as written. The two interpolation/port judgment calls (Icon default-color hex in place of `'currentColor'`; AppIcon gradient rendered via svg rather than a CSS background that RN cannot express) are direct web→RN translations of the lib.jsx spec, not scope changes — both are documented above. The plan's own `<read_first>` cited lib.jsx lines and these ports follow the RESEARCH/PATTERNS guidance verbatim.

## Threat Model Compliance
- **T-08-06 (Denial of Service — render):** Mitigated. `ProgressRing` clamps `value` to 0..1 (`Number.isFinite` guard → 0 on NaN) so a malformed prop cannot produce a NaN arc sweep. `Sparkline` early-returns on `data.length < 2`, eliminating the `(length-1)===0` zero-divisor and the `Math.min/max` over an empty/degenerate array. Neither primitive can crash the Canvas on bad input.
- **T-08-07 (Information disclosure — sample data):** Accepted (per the register). These primitives render only app-controlled sample/numeric data in Phase 8; no real user/PII data flows through them. No new surface introduced.

No new threat surface beyond the plan's register.

## Verification Results
- `cd app && npx tsc --noEmit` → exit 0 (after Task 1 and again after Task 2).
- `cd app && npm run lint` (expo lint) → exit 0, 0 errors / 0 warnings.
- No animation imports: `^import.*(useSharedValue|useDerivedValue|withTiming|reanimated)` across `app/components/ui/` returns 0 matches (the only grep hits are the explanatory "MUST NOT import …" comment lines, not import statements). STATIC confirmed (D-08).
- F13 untouched: `git status --short app/lib/query/` is empty — no offline-queue file modified.
- No new dependency: `package.json` unchanged; ProgressRing/Sparkline use the already-installed `@shopify/react-native-skia@2.2.12`; Icon/Logo/AppIcon use the already-installed `react-native-svg@15.12.1` (Plan 01). No bump to skia, react-native-svg, nativewind, or tailwindcss.
- Acceptance greps: `Icon.tsx` imports from `react-native-svg`, exports `IconName` including `barbell` + `ascend`, default `strokeWidth` 1.8; `Logo.tsx` exports `variant: 'gradient' | 'white'`; `AppIcon.tsx` renders `<Logo>` with an explicit shadow style object (no `shadow-` class); both Skia files import `Canvas` + `Path`; `ProgressRing` clamps + supports `gradient`; `Sparkline` accepts `data: number[]`.

## User Setup Required
None - no external service configuration. (Restart Metro before opening the Plan 05 gallery so the new files bundle — a dev convenience, not a config step.)

## Next Phase Readiness
- DSGN-05 (ProgressRing + Sparkline via installed Skia) + DSGN-06 (Logo + AppIcon token-driven components) closed.
- Plan 08-04 (Forge components) can import `Icon` (leading/trailing icon slots on ForgeButton/ForgeField, SettingsRow chevron/tile, ForgeChip accent icon) and the brand components.
- Plan 08-05 (gallery) can render the ProgressRing at several values, the Sparkline with sample data, Logo gradient+white, and AppIcon — the manual-UAT surface (D-06/D-07).
- F13 untouched; no new dependency added.

## Self-Check: PASSED

All 5 created files verified present on disk; both task commits (`9d86fc1`, `714086b`) verified in git history. tsc + lint both exit 0; no animation imports; F13 query layer unmodified.

---
*Phase: 08-forge-foundation*
*Completed: 2026-06-10*
