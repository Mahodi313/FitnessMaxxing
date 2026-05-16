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

import { Pressable, Text, View } from "react-native";

type Option<T extends string> = { label: string; value: T };

type Props<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (v: T) => void;
  accessibilityLabel: string;
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
}: Props<T>) {
  return (
    <View
      className="flex-row rounded-lg bg-gray-100 dark:bg-gray-800 p-1"
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            hitSlop={{ top: 4, bottom: 4 }}
            className={
              selected
                ? "flex-1 py-2 px-3 rounded-md items-center justify-center bg-white dark:bg-gray-700"
                : "flex-1 py-2 px-3 rounded-md items-center justify-center"
            }
            style={({ pressed }) => [
              selected ? selectedShadow : null,
              pressed ? { opacity: 0.8 } : null,
            ]}
          >
            <Text
              className={
                selected
                  ? "text-sm font-semibold text-gray-900 dark:text-gray-50"
                  : "text-sm font-semibold text-gray-500 dark:text-gray-400"
              }
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
