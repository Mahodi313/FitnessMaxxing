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
  /**
   * Two-line layout: `[icon][label][value]` on line 1, then `control` on a
   * full-width line below. Used for wide segmented controls (Theme / Language /
   * Units) whose pills would otherwise overflow / clip on a single inline row
   * (UAT fix). Toggle/chevron/stepper rows stay inline.
   */
  stacked?: boolean;
};

const TEXT3_LIGHT = "#8B8B8B";
const ACCENT_LIGHT = "#E14E10";

// The 44x26 toggle pill — a custom Pressable (FIT-66: pressed feedback + knob
// position via style callback, never a NativeWind active:/transition class).
function Toggle({
  value,
  onToggle,
  label,
}: {
  value: boolean;
  onToggle?: (next: boolean) => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={() => onToggle?.(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      className={`h-[26px] w-11 justify-center rounded-full px-[2px] ${
        value
          ? "bg-forge-accent-light dark:bg-forge-accent"
          : "bg-forge-surface3-light dark:bg-forge-surface3"
      }`}
      style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
    >
      <View
        className="h-[22px] w-[22px] rounded-full bg-white"
        style={{ transform: [{ translateX: value ? 18 : 0 }] }}
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
  stacked = false,
}: SettingsRowProps) {
  const interactive = !!onPress && !toggle;

  // Stacked two-line layout: line 1 = [icon][label][value], line 2 = control
  // spanning the full row width so the SegmentedControl's flex-1 segments
  // expand to equal full-width pills (UAT fix — no clipping, visible labels).
  if (stacked) {
    return (
      <View
        className={`px-4 py-[14px] ${
          last
            ? ""
            : "border-b border-forge-border-light dark:border-forge-border"
        }`}
      >
        <View className="flex-row items-center gap-3">
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
        </View>

        <View style={{ marginTop: 10 }}>{control ?? null}</View>
      </View>
    );
  }

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
