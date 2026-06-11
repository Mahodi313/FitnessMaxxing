// app/components/ui/SettingsRow.tsx
//
// Phase 8 (Forge Foundation), Plan 08-04 — DSGN-04 / D-01.
// Settings list primitives: `SettingsRow` (icon tile + label + value/chevron/
// toggle/control variants) and `SettingsSection` (UPPERCASE group header +
// rounded surface container). Ported from
//   app/design v2/Sources/design/forge-screens.jsx
//   (SettingsSection line 951, SettingsRow line 967) and 08-UI-SPEC.md
//   §SettingsRow.
//
// Analog: app/components/active-session-banner.tsx — full-row Pressable with a
// leading icon + label stack + trailing chevron + a11y (lines 54-75).
//
// FIT-66 (08-PATTERNS.md §FIT-66, T-08-08): the 44x26 toggle is a custom
// Pressable whose pressed/knob feedback uses a style callback — NEVER an
// `active:opacity-*` className.
//
// Light+dark parity: every color class pairs a `-light` base token with a
// `dark:` DEFAULT token (tailwind.config.js OQ-3).
//
// References:
//   - .planning/phases/08-forge-foundation/08-UI-SPEC.md §SettingsRow
//   - .planning/phases/08-forge-foundation/08-PATTERNS.md §SettingsRow, §FIT-66

import { type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useColorScheme } from "nativewind";

import { Icon, type IconName } from "./Icon";

export type SettingsRowProps = {
  icon: IconName;
  label: string;
  value?: string;
  chevron?: boolean;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (next: boolean) => void;
  /** Inline control slot (e.g. a segmented control), right-aligned. */
  control?: ReactNode;
  onPress?: () => void;
  /** Suppress the bottom hairline (last row in a section). */
  last?: boolean;
};

const TEXT3_LIGHT = "#8B8B8B";
const ACCENT_LIGHT = "#E14E10";

// iOS-standard 51×31 toggle — a custom Pressable (FIT-66: pressed feedback +
// knob position + track color via style callback / inline objects, never a
// NativeWind active:/transition class). Track color is inline so the OFF state
// is a visible iOS-style grey (#39393D dark / #E9E9EA light) instead of a dark
// near-invisible surface; ON is the Forge accent.
function Toggle({
  value,
  onToggle,
  label,
}: {
  value: boolean;
  onToggle?: (next: boolean) => void;
  label: string;
}) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const trackColor = value
    ? isDark
      ? "#FF5A1F"
      : "#E14E10"
    : isDark
      ? "#39393D"
      : "#E9E9EA";
  return (
    <Pressable
      onPress={() => onToggle?.(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      className="h-[31px] w-[51px] justify-center rounded-full px-[2px]"
      style={({ pressed }) => [
        { backgroundColor: trackColor },
        pressed ? { opacity: 0.85 } : null,
      ]}
    >
      <View
        className="h-[27px] w-[27px] rounded-full bg-white"
        // Knob drop-shadow (boxShadow 0 1px 2px rgba(0,0,0,0.2)); inline iOS
        // shadow object, never a `shadow-*` class (FIT-66). Travel = 51 - 2 - 2
        // - 27 = 20.
        style={{
          transform: [{ translateX: value ? 20 : 0 }],
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.2,
          shadowRadius: 2,
        }}
      />
    </Pressable>
  );
}

export function SettingsRow({
  icon,
  label,
  value,
  chevron,
  toggle,
  toggleValue = false,
  onToggle,
  control,
  onPress,
  last = false,
}: SettingsRowProps) {
  const interactive = !!onPress && !toggle;

  const inner = (
    <View
      className={`min-h-[52px] flex-row items-center gap-3 px-4 py-[14px] ${
        last
          ? ""
          : "border-b border-forge-border-light dark:border-forge-border"
      }`}
    >
      {/* 28x28 accent-soft icon tile + 15px accent icon. */}
      <View className="h-7 w-7 items-center justify-center rounded-lg bg-forge-accentSoft-light dark:bg-forge-accentSoft">
        <Icon name={icon} size={15} color={ACCENT_LIGHT} strokeWidth={1.8} />
      </View>

      <Text
        className="flex-1 text-[15px] text-forge-text-light dark:text-forge-text"
        style={{ fontWeight: "500" }}
        numberOfLines={1}
      >
        {label}
      </Text>

      {value ? (
        <Text className="text-[15px] text-forge-text2-light dark:text-forge-text2">
          {value}
        </Text>
      ) : null}

      {control ?? null}

      {toggle ? (
        <Toggle value={toggleValue} onToggle={onToggle} label={label} />
      ) : null}

      {chevron ? (
        <Icon name="chevronRight" size={18} color={TEXT3_LIGHT} />
      ) : null}
    </View>
  );

  if (interactive) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        // FIT-66 — pressed feedback via style callback, never active:opacity-*.
        style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
      >
        {inner}
      </Pressable>
    );
  }

  return inner;
}

export type SettingsSectionProps = {
  label?: string;
  children: ReactNode;
};

export function SettingsSection({ label, children }: SettingsSectionProps) {
  return (
    <View className="mb-5">
      {label ? (
        <Text
          className="mb-2 px-1 text-[11px] text-forge-text3-light dark:text-forge-text3"
          style={{
            fontWeight: "600",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
      ) : null}
      <View className="overflow-hidden rounded-forge-lg border border-forge-border-light bg-forge-surface-light dark:border-forge-border dark:bg-forge-surface">
        {children}
      </View>
    </View>
  );
}

export default SettingsRow;
