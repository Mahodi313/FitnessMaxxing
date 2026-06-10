// app/components/ui/TabBar.tsx
//
// Phase 8 (Forge Foundation), Plan 08-04 — DSGN-04 / D-01 / OQ-5.
// A STANDALONE, presentational re-skin of the bottom tab bar. Ported from
//   app/design v2/Sources/design/lib.jsx (TabBar, ~lines 580-612) and
//   08-UI-SPEC.md §TabBar shell.
//
// SCOPE (OQ-5 / 08-PATTERNS.md §TabBar / Pitfall 6 / T-08-09): this is a
// gallery-only component. It is NOT wired into the live expo-router <Tabs>
// (app/app/(app)/(tabs)/_layout.tsx) this phase — doing so would be a
// navigation-behavior-adjacent change that breaks the phase boundary. It takes
// `active` + `onSelect` props so the Plan 05 gallery can demo it in isolation.
//
// i18n: tab labels come from the i18n map via useTranslation() (I18N-01) —
// no hardcoded copy.
//
// Light+dark parity: every color class pairs a `-light` base token with a
// `dark:` DEFAULT token (tailwind.config.js OQ-3).
//
// References:
//   - .planning/phases/08-forge-foundation/08-UI-SPEC.md §TabBar shell
//   - .planning/phases/08-forge-foundation/08-PATTERNS.md §TabBar (OQ-5)

import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { Icon, type IconName } from "./Icon";

export type TabKey = "plans" | "history" | "settings";

export type TabBarProps = {
  active: TabKey;
  onSelect: (key: TabKey) => void;
};

const ACCENT_LIGHT = "#E14E10";
const TEXT3_LIGHT = "#8B8B8B";

const ITEMS: { key: TabKey; icon: IconName }[] = [
  { key: "plans", icon: "barbell" },
  { key: "history", icon: "clock" },
  { key: "settings", icon: "settings" },
];

export function TabBar({ active, onSelect }: TabBarProps) {
  const { t } = useTranslation();

  return (
    <View
      className="flex-row border-t border-forge-border-light bg-forge-tabBg-light dark:border-forge-border dark:bg-forge-tabBg"
      style={{ paddingTop: 10, paddingBottom: 28 }}
    >
      {ITEMS.map(({ key, icon }) => {
        const isActive = key === active;
        return (
          <Pressable
            key={key}
            onPress={() => onSelect(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={t(key)}
            className="flex-1 items-center gap-1"
            // FIT-66 — pressed feedback via style callback, never active:opacity-*.
            style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
          >
            <Icon
              name={icon}
              size={22}
              color={isActive ? ACCENT_LIGHT : TEXT3_LIGHT}
              strokeWidth={isActive ? 2 : 1.6}
            />
            <Text
              className={`text-[10.5px] ${
                isActive
                  ? "text-forge-accent-light dark:text-forge-accent"
                  : "text-forge-text3-light dark:text-forge-text3"
              }`}
              style={{ fontWeight: isActive ? "600" : "500", letterSpacing: -0.1 }}
            >
              {t(key)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default TabBar;
