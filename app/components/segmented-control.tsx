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

import { Pressable, Text, View } from "react-native";

// Inline cn helper — no project-wide @/lib/utils utility exists (verified via
// grep app/lib/ app/components/ 2026-05-15). Filter falsy values + join with
// space; matches the conventional NativeWind className-builder shape.
function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

type Option<T extends string> = { label: string; value: T };

type Props<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (v: T) => void;
  accessibilityLabel: string;
};

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
            className={cn(
              "flex-1 py-2 px-3 rounded-md items-center justify-center active:opacity-80",
              selected && "bg-white dark:bg-gray-700 shadow-sm",
            )}
          >
            <Text
              className={cn(
                "text-sm font-semibold",
                selected
                  ? "text-gray-900 dark:text-gray-50"
                  : "text-gray-500 dark:text-gray-400",
              )}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
