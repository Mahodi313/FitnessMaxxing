// app/components/ui/ForgeField.tsx
//
// Phase 8 (Forge Foundation), Plan 08-04 — DSGN-04 / D-02.
// Controlled text input primitive. Token-driven, explicit-prop state enum
// (default | focused | error) driving the border, with an optional leading
// Icon slot. Ported from app/design v2/Sources/design/forge-screens.jsx
// (ForgeField, line 69) and 08-UI-SPEC.md §ForgeField.
//
// Analog: app/components/segmented-control.tsx (conditional-className idiom)
// + RN TextInput. The `state` prop selects the border class exactly the way
// segmented-control selects by `selected` (08-PATTERNS.md §ForgeField).
//
// Light+dark parity: every color class pairs a `-light` base token with a
// `dark:` DEFAULT token (tailwind.config.js OQ-3; config DEFAULT = dark).
//
// References:
//   - .planning/phases/08-forge-foundation/08-UI-SPEC.md §ForgeField
//   - .planning/phases/08-forge-foundation/08-PATTERNS.md §ForgeField

import { useState } from "react";
import {
  type KeyboardTypeOptions,
  TextInput,
  View,
} from "react-native";

import { Icon, type IconName } from "./Icon";

export type ForgeFieldState = "default" | "focused" | "error";

export type ForgeFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  icon?: IconName;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  /** Controlled visual state. When omitted, focus is tracked internally. */
  state?: ForgeFieldState;
  multiline?: boolean;
  /**
   * Explicit screen-reader label (WR-02). Use when there is no `placeholder`,
   * or when the placeholder is not a good spoken label. Falls back to
   * `placeholder` so the field is never announced with an undefined label.
   */
  accessibilityLabel?: string;
};

// state → border classes (UI-SPEC §ForgeField: focused = border-2 accent;
// error = danger border; default = hairline forge-border).
const STATE_BORDER: Record<ForgeFieldState, string> = {
  default: "border border-forge-border-light dark:border-forge-border",
  focused:
    "border-2 border-forge-accent-light dark:border-forge-accent",
  error: "border-2 border-forge-danger-light dark:border-forge-danger",
};

// Tertiary ink (text3) for the leading icon + placeholder — light hex /
// dark rgba (UI-SPEC §Color text3).
const TEXT3_LIGHT = "#8B8B8B";

export function ForgeField({
  value,
  onChangeText,
  placeholder,
  icon,
  secureTextEntry = false,
  keyboardType,
  state,
  multiline = false,
  accessibilityLabel,
}: ForgeFieldProps) {
  const [focused, setFocused] = useState(false);

  // Controlled `state` prop wins; otherwise derive focused from internal state.
  const resolvedState: ForgeFieldState =
    state ?? (focused ? "focused" : "default");

  // WR-02: never hand VoiceOver/TalkBack an undefined label. Prefer the
  // explicit prop, then the placeholder, then a generic last-resort so the
  // field is always announced even when a caller supplies neither.
  const a11yLabel = accessibilityLabel ?? placeholder ?? "Text field";

  return (
    <View
      className={`flex-row items-center gap-2 px-4 rounded-forge-md bg-forge-surface-light dark:bg-forge-surface ${
        STATE_BORDER[resolvedState]
      } ${multiline ? "min-h-[96px] py-3" : "h-14"}`}
    >
      {icon ? (
        <Icon name={icon} size={18} color={TEXT3_LIGHT} strokeWidth={1.8} />
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={TEXT3_LIGHT}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={a11yLabel}
        className="flex-1 text-[16px] text-forge-text-light dark:text-forge-text"
        style={multiline ? { textAlignVertical: "top" } : undefined}
      />
    </View>
  );
}

export default ForgeField;
