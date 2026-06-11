// app/components/segmented-control.tsx
//
// Phase 6: Reusable generic NativeWind-baserat segmented-control primitive.
//
// Designed to back Phase 6's chart-route MetricToggle (Max vikt / Total volym)
// and WindowToggle (1M / 3M / 6M / 1Y / All), but typed generically so V1.1+
// polish surfaces (RPE-scale, set-typ-toggle, F15 manual dark-mode toggle)
// inherit the same primitive without a new install.
//
// NativeWind primary path (06-CONTEXT.md "Segmented-control-komponent" +
// 06-UI-SPEC.md §Visuals "Segmented Control"): NO new client-bundled
// dependency. The 06-PATTERNS.md "no analog found" entry resolves here.
//
// Shape:
//   <View flex-row rounded-lg bg-gray-100 dark:bg-gray-800 p-1
//         role=tablist aria-label={accessibilityLabel}>
//     <Pressable flex-1 py-2 px-3 rounded-md role=tab
//                + bg-white dark:bg-gray-700 shadow-sm when selected>
//       <Text text-sm font-semibold
//             + text-gray-900 dark:text-gray-50 when selected
//             else text-gray-500 dark:text-gray-400>
//         {option.label}
//       </Text>
//     </Pressable>
//     ...
//
// Accessibility floor (06-UI-SPEC.md Accessibility):
//   - Parent role="tablist" + aria-label.
//   - Each Pressable role="tab" + state.selected + label=option.label.
//   - hitSlop={{ top: 4, bottom: 4 }} per segment (parent p-1 + segment
//     py-2 = effective hit-target ≥44pt; hitSlop guarantees the floor).
//
// Reusable across V1.1+; co-located with active-session-banner.tsx and
// offline-banner.tsx under app/components/.
//
// FIT-66 bug-fix (2026-05-15): the original implementation joined dynamic
// NativeWind classes via a `cn(...)` helper (`active:opacity-80` on every
// segment, `shadow-sm` on the selected segment). On iPhone via Expo Go the
// chart screen crashed with "Couldn't find a navigation context" — the
// react-native-css-interop 0.2.3 `printUpgradeWarning` codepath recursed
// through the React fiber tree (~24 String.replace + JSON.stringify steps)
// to attribute the warning and hit React Navigation's NavigationStateContext
// default-value sentinel, which throws when read outside a NavigationContainer.
//
// Fix: drop the two NativeWind classes that trigger the warning recursion.
//   - `active:opacity-80` → Pressable's native `style={({ pressed }) => …}` callback
//   - `shadow-sm`         → explicit iOS shadow style props (V1 is iOS-only)
// All other styling stays on NativeWind className — the pressed-state and
// shadow are the only properties css-interop is unsafe with here.
//
// Phase 9 Forge re-skin (Plan 09-02, 09-UI-SPEC §Color):
//   - track   `bg-gray-100 dark:bg-gray-800`  → `forge-surface2` (light+dark parity)
//   - active  pill `bg-white dark:bg-gray-700` → `forge-surface3`
//   - active  text → `text-forge-text`; inactive text → `text-forge-text2`
//   Each `-light` base token pairs with a `dark:` DEFAULT token per the
//   established Forge light+dark parity rule (08-PATTERNS §Light+dark token
//   parity). The generic `<T extends string>` API + a11y tablist roles are
//   UNCHANGED. FIT-66 stays preserved: pressed feedback + selected-pill shadow
//   remain on `style={({ pressed }) => [...]}` callbacks + explicit iOS shadow
//   objects — NEVER `active:opacity-*` / `shadow-*` classes. Pill label is
//   Caption/600; optical pill padding (6px 12px) is applied via inline `style`,
//   not arbitrary Tailwind classes (NativeWind 4 / Tailwind 3 purge).

import { Pressable, Text, View } from "react-native";

type Option<T extends string> = { label: string; value: T };

type Props<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (v: T) => void;
  accessibilityLabel: string;
  /**
   * Compact, content-sized variant for inline Settings rows (FSettings mockup
   * parity): pills size to their text (no flex stretch), 12px label, track
   * padding 3 + 2px gap, selected pill = `forge-surface`. Default (false) keeps
   * the full-width `flex-1` segments the Phase-6 chart toggles rely on.
   */
  compact?: boolean;
};

// iOS shadow style for the selected segment — matches Tailwind's shadow-sm
// visual (small, soft, low-offset). V1 is iOS-only so elevation is omitted.
const selectedShadow = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 2,
} as const;

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  compact = false,
}: Props<T>) {
  return (
    <View
      className="flex-row rounded-forge-sm bg-forge-surface2-light dark:bg-forge-surface2"
      // Track padding/gap as optical inline numbers (NativeWind 4 / Tailwind 3
      // purges off-scale arbitrary classes). Compact = content-sized + right of
      // its row; default = full-width flex segments (chart toggles).
      style={
        compact
          ? { padding: 13, columnGap: 24, alignSelf: "center" }
          : { padding: 4 }
      }
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const base = compact
          ? "rounded-forge-sm items-center justify-center"
          : "flex-1 rounded-forge-sm items-center justify-center";
        // Selected pill: compact → `forge-surface` (FSettings mockup); default →
        // `forge-surface3` (raised look the chart toggles use).
        // Selected pill raised in `forge-surface3` (lighter than the surface2
        // track) so the active segment reads clearly instead of as crammed
        // text — both variants. (The mockup's recessed `forge-surface` had near-
        // zero contrast on device.)
        const selectedBg = selected
          ? " bg-forge-surface3-light dark:bg-forge-surface3"
          : "";
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            hitSlop={compact ? { top: 8, bottom: 8 } : { top: 4, bottom: 4 }}
            className={base + selectedBg}
            // Optical pill padding (6px 12px) via inline style — NativeWind 4 /
            // Tailwind 3 purges off-scale arbitrary classes. FIT-66: pressed
            // feedback + selected shadow stay on the style callback / inline
            // objects, never `active:`/`shadow-*` classes.
            style={({ pressed }) => [
              compact
                ? {
                    paddingVertical: 11,
                    paddingHorizontal: 12,
                    borderRadius: 9,
                    // Uniform pill width so System/Ljust/Mörkt read as an even
                    // 3-segment control, not ragged content-sized chips.
                    minWidth: 70,
                  }
                : { paddingVertical: 6, paddingHorizontal: 12 },
              selected ? selectedShadow : null,
              pressed ? { opacity: 0.8 } : null,
            ]}
          >
            <Text
              // Caption/600 — active=forge-text, inactive=forge-text2.
              className={
                selected
                  ? "text-forge-text-light dark:text-forge-text"
                  : "text-forge-text2-light dark:text-forge-text2"
              }
              style={{ fontWeight: "600", fontSize: compact ? 15 : 14 }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
