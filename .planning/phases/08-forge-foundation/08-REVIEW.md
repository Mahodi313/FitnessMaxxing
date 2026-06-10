---
phase: 08-forge-foundation
reviewed: 2026-06-10T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - app/app/(app)/(tabs)/settings.tsx
  - app/app/(app)/_forge-gallery.tsx
  - app/app/_layout.tsx
  - app/components/ui/AppIcon.tsx
  - app/components/ui/ForgeButton.tsx
  - app/components/ui/ForgeCard.tsx
  - app/components/ui/ForgeChip.tsx
  - app/components/ui/ForgeField.tsx
  - app/components/ui/ForgeStat.tsx
  - app/components/ui/Icon.tsx
  - app/components/ui/Logo.tsx
  - app/components/ui/ProgressRing.tsx
  - app/components/ui/SettingsRow.tsx
  - app/components/ui/Sparkline.tsx
  - app/components/ui/TabBar.tsx
  - app/components/ui/index.ts
  - app/lib/font-store.ts
  - app/lib/i18n.ts
  - app/lib/utils/format.ts
  - app/scripts/check-locale-parity.ts
  - app/tailwind.config.js
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-06-10T00:00:00Z
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Phase 08 introduces an i18n engine (react-i18next), bilingual locales (sv/en), a Forge design-token palette in tailwind.config.js, self-hosted font loading, react-native-svg + Skia visual primitives, seven Forge UI component-library primitives, and a dev-only gallery route.

The implementation is generally well-structured. No hardcoded secrets, no service-role key leaks, no unsafe `eval`, no SQL injection surfaces, and no Metro-bundled paths importing Node-only scripts. The FIT-66 pattern (pressed feedback via style callbacks rather than NativeWind `active:` classes) is consistently applied. RLS-adjacent code is untouched.

Five warnings and four info items were found. The most impactful is a silent-corruption risk in the i18n language toggle in the gallery: `changeLanguage` is called but the selection is never persisted to `AsyncStorage('fm:language')`, so the user's language choice resets on every cold launch. A secondary concern is that the `localeReady` flag in `font-store.ts` is read via `useFontStore` from the wrong field name in `_layout.tsx` (both `fontsReady` and `localeReady` are read from `useFontStore`, but the `localeReady` setter is stored under `useFontStore` while the `SplashScreenController` reads it as `useFontStore((s) => s.localeReady)` — this is actually correct, but warrants a close look at a related issue below). Additionally, `ForgeField` uses `placeholder` as the `accessibilityLabel` for the `TextInput`, which produces a `undefined` label when no `placeholder` is supplied.

---

## Warnings

### WR-01: Language toggle in gallery never persists — `fm:language` is never written

**File:** `app/app/(app)/_forge-gallery.tsx:357–364`
**Issue:** The `I18nSection` component calls `i18n.changeLanguage("sv")` / `i18n.changeLanguage("en")` but never writes the selection to `AsyncStorage('fm:language')`. The `LocaleBootstrap` in `_layout.tsx` reads `fm:language` on every cold launch and applies the saved language before the splash clears. Because nothing writes that key anywhere in the codebase (confirmed by grep), the language override is ephemeral — it lives only for the lifetime of the current process and resets on every cold launch.

This is a gallery-only component, but the toggle is the _only_ user-facing surface for language switching (the settings screen has no language row yet). If the toggle is later promoted to the real settings screen without fixing the missing `setItem`, the feature is silently broken at launch.

**Fix:**
```typescript
onPress={() => {
  void i18n.changeLanguage("sv");
  void AsyncStorage.setItem("fm:language", "sv").catch(() =>
    console.warn("[i18n] AsyncStorage write failed — language not persisted")
  );
}}
```
Mirror the exact pattern used in `settings.tsx` `onChange` for theme persistence (lines 56–61).

---

### WR-02: `ForgeField` sets `accessibilityLabel={placeholder}` — undefined when no placeholder supplied

**File:** `app/components/ui/ForgeField.tsx:91`
**Issue:** `accessibilityLabel={placeholder}` is passed to the `TextInput`. `placeholder` is optional (`placeholder?: string`) and can be `undefined`. When a `ForgeField` is rendered without a `placeholder` prop (entirely valid per the API), the `TextInput` receives `accessibilityLabel={undefined}`. React Native then derives no label at all, making the field invisible to VoiceOver/TalkBack and failing WCAG 1.3.1 / MASVS L1 M9 (client code quality).

**Fix:**
```typescript
// Require a mandatory `label` prop for accessibility, or derive from placeholder:
accessibilityLabel={placeholder ?? label}
// Better: add a required or separate `accessibilityLabel` prop to ForgeFieldProps:
export type ForgeFieldProps = {
  ...
  accessibilityLabel?: string;
  ...
};
// Use-site:
accessibilityLabel={accessibilityLabel ?? placeholder}
```

---

### WR-03: `ForgeButton` `inkColor` is hardcoded dark-mode hex — wrong in light mode

**File:** `app/components/ui/ForgeButton.tsx:108–113`
**Issue:** The `inkColor` constant used for `ActivityIndicator` color and `Icon` stroke is computed once as a static hex:
```typescript
const inkColor =
  variant === "primary"
    ? "#FFFFFF"
    : variant === "destructive"
      ? "#D70015"
      : "#0A0A0A";
```
`#D70015` is the **light-mode** hex for `forge-danger` (matches `tailwind.config.js` `danger.light`). In dark mode, `forge-danger` is `#FF453A`. The destructive variant's `Icon` and `ActivityIndicator` will render with the light-mode danger color even when the device is in dark mode. The `VARIANT_LABEL` map correctly uses `text-forge-danger-light dark:text-forge-danger` for the `Text` label via NativeWind, but the Icon/spinner bypasses that. In dark mode, the spinner and icon on a destructive button will appear light-red on a dark surface instead of the brighter dark-mode red.

This is a visual fidelity regression, not a crash — but it contradicts the light+dark parity requirement established in `CLAUDE.md` and every other component in this phase.

**Fix:** Thread `useColorScheme` to switch between light and dark hex values:
```typescript
const { colorScheme } = useColorScheme();
const isDark = colorScheme === "dark";
const inkColor =
  variant === "primary"
    ? "#FFFFFF"
    : variant === "destructive"
      ? isDark ? "#FF453A" : "#D70015"
      : isDark ? "#FFFFFF" : "#0A0A0A";
```

---

### WR-04: `ProgressRing` `trackColor` default is dark-only — renders invisible track in light mode

**File:** `app/components/ui/ProgressRing.tsx:47`
**Issue:** The default `trackColor` is `"rgba(255,255,255,0.08)"` — a near-transparent white overlay that is intentionally subtle on a dark (`#000000`) background but is completely invisible on a light (`#FAFAF7`) background. In light mode, the background ring disappears, and only the foreground arc is visible. The gallery renders three rings with default `trackColor` and no light-mode override is documented in the prop or its usage sites in `_forge-gallery.tsx:321–327`.

**Fix:** Either document the requirement that callers must supply `trackColor` in light mode, or derive the default from the color scheme:
```typescript
// Option A: caller-supplied override (already supported, just undocumented):
<ProgressRing size={72} value={0.25} trackColor={isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)"} />

// Option B: thread colorScheme into ProgressRing and compute the default internally:
const { colorScheme } = useColorScheme();
const resolvedTrack = trackColor ?? (colorScheme === "dark"
  ? "rgba(255,255,255,0.08)"
  : "rgba(0,0,0,0.07)");
```
The gallery at `_forge-gallery.tsx:321–327` should be updated to supply the correct `trackColor` for the demonstrated light/dark split regardless of the fix chosen.

---

### WR-05: `Sparkline` area fill path closes to wrong x-coordinates — visual gap at data extremes

**File:** `app/components/ui/Sparkline.tsx:80–82`
**Issue:** The area (fill) path closes to hard-coded `halo + width - pad` and `halo + pad` as the right and left x-anchors:
```typescript
area.lineTo(halo + width - pad, baseY);
area.lineTo(halo + pad, baseY);
area.close();
```
But the actual data points span from `halo + pad` (first point) to `halo + pad + (width - pad * 2)` = `halo + width - pad` (last point), which coincidentally matches when `i / (data.length - 1) = 1`. However, `pts[pts.length - 1][0]` is exactly `halo + pad + (width - pad * 2) = halo + width - pad` only when the last data index equals `data.length - 1`, which is always true for the line — but the area baseline anchor is set independently, not derived from `pts[0][0]` and `pts[pts.length-1][0]`. If the caller ever changes the `pad` formula or if floating-point precision causes a slight mismatch, the fill polygon will not close flush to the line endpoints, producing a visual sliver gap or overlap at the endpoints. The fix is to anchor the area baseline explicitly to the actual first and last point x-values:
```typescript
const firstX = pts[0][0];
const lastX = pts[pts.length - 1][0];
area.lineTo(lastX, baseY);
area.lineTo(firstX, baseY);
area.close();
```

---

## Info

### IN-01: `settings.tsx` title "Inställningar" is hardcoded — not wired to i18n

**File:** `app/app/(app)/(tabs)/settings.tsx:67–69`
**Issue:** The screen title `"Inställningar"` is a hardcoded string literal, not a `t("settings")` call. The i18n engine is live as of this phase, and `sv.json`/`en.json` both define `"settings"` keys. This will render "Inställningar" even when the user switches the app language to English.

**Fix:**
```typescript
import { useTranslation } from "react-i18next";
const { t } = useTranslation();
// In JSX:
<Text ...>{t("settings")}</Text>
```

---

### IN-02: `_forge-gallery.tsx` `isDark` is computed but only used for header style — `useColorScheme` redundant

**File:** `app/app/(app)/_forge-gallery.tsx:407–408`
**Issue:** `const { colorScheme } = useColorScheme()` and `const isDark = colorScheme === "dark"` are declared in `ForgeGallery` and the only use of `isDark` is on lines 431–432 for the `headerStyle` hex colors. The NativeWind `dark:` class approach is used everywhere else in the file, making `isDark` a narrowly-scoped variable that could confuse a reader into thinking it drives more than it does. This is a minor readability concern, not a bug.

**Fix:** Either inline `isDark` into the two expressions that use it, or replace the two hex strings with token references to make the pattern consistent:
```typescript
// Inline (cleaner):
headerStyle: { backgroundColor: colorScheme === "dark" ? "#000000" : "#FAFAF7" },
```

---

### IN-03: `check-locale-parity.ts` does not verify nested key parity — future nesting silently breaks the gate

**File:** `app/scripts/check-locale-parity.ts:29–30`
**Issue:** The parity gate uses `Object.keys(sv)` / `Object.keys(en)`, which only compares top-level keys. The current locale files are intentionally flat (D-10), so this is not currently a bug. However, if a future key is accidentally nested (e.g. `{ "settings": { "theme": "..." } }` in one locale vs `{ "settings": "..." }` in the other), the gate will report a false pass — both files have `"settings"` as a top-level key. This is a documentation / forward-safety concern.

**Fix:** Add a comment documenting the flat-only assumption so future contributors know to update the script if D-10 is ever revised:
```typescript
// NOTE: This script only checks top-level keys (D-10 — flat namespace).
// If nested keys are ever introduced, replace Object.keys with a recursive
// key-collector function to avoid false passes.
```

---

### IN-04: `tailwind.config.js` `content` paths do not include `app/app/` subdirectory explicitly — relies on glob depth

**File:** `app/tailwind.config.js:27–31`
**Issue:** The `content` array uses `"./app/**/*.{ts,tsx}"`. In NativeWind 4 / Tailwind 3, `**` does match arbitrarily deep paths, so `app/(app)/(tabs)/settings.tsx` is included. This is correct. However, the `components` glob `"./components/**/*.{ts,tsx}"` does not include an `app/` prefix, which means it resolves relative to the `tailwind.config.js` location (assumed to be `app/`). If the config is ever run from a different cwd, the `./components/` path would be wrong. This matches the existing convention in the project, so it is not a regression — it is a fragility worth noting for new contributors.

**Fix:** None required for current project layout. Document in the config file that all paths are relative to `app/` (the `tailwind.config.js` directory).

---

_Reviewed: 2026-06-10T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
