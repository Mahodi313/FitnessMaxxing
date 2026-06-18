// app/components/ui/ForgeButton.tsx
//
// Phase 8 (Forge Foundation), Plan 08-04 — DSGN-04 / D-02.
// The core Forge call-to-action primitive. Token-driven, explicit-prop API
// (variant + size enums, NOT className passthrough) derived from the variant/
// size usage across app/design v2/Sources/design/forge-screens.jsx
// (FSignIn / FWorkout / overlays) and 08-UI-SPEC.md §ForgeButton.
//
// Analog: app/components/segmented-control.tsx — the canonical token-driven
// NativeWind Pressable in this repo (conditional-className idiom + a11y).
//
// FIT-66 (08-PATTERNS.md §FIT-66, T-08-08): pressed feedback and shadows MUST
// bypass NativeWind className. `active:opacity-*` / `shadow-*` classes route
// through the react-native-css-interop@0.2.3 upgrade-warning codepath, which
// recurses the fiber tree and crashes outside a NavigationContainer. So:
//   - pressed feedback → Pressable `style={({ pressed }) => [...]}` callback
//   - the primary accent shadow → explicit iOS shadow STYLE object (accentShadow)
//
// Light+dark parity (08-UI-SPEC.md): every color class pairs a `-light` base
// token (light hex) with a `dark:` DEFAULT token (dark value) — config DEFAULT
// is dark, the `light` suffix is the light hex (tailwind.config.js OQ-3).
//
// References:
//   - .planning/phases/08-forge-foundation/08-UI-SPEC.md §ForgeButton
//   - .planning/phases/08-forge-foundation/08-PATTERNS.md §ForgeButton, §FIT-66

import { ActivityIndicator, Pressable, Text } from "react-native";
import { useColorScheme } from "nativewind";

import { Icon, type IconName } from "./Icon";

export type ForgeButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "destructive";
export type ForgeButtonSize = "lg" | "md" | "sm";

export type ForgeButtonProps = {
  label: string;
  variant?: ForgeButtonVariant;
  size?: ForgeButtonSize;
  icon?: IconName;
  iconPosition?: "leading" | "trailing";
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  onPress?: () => void;
};

// FIT-66 — explicit iOS shadow STYLE object for the `primary` accent glow.
// Mirrors UI-SPEC §ForgeButton "accent shadow (dark: 0 8-12px 24-32px
// accent/40-50)". NEVER a `shadow-*` NativeWind class.
const accentShadow = {
  shadowColor: "#FF5A1F",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.45,
  shadowRadius: 16,
} as const;

// variant → container color classes (light base + dark: sibling for parity).
const VARIANT_CONTAINER: Record<ForgeButtonVariant, string> = {
  primary: "bg-forge-accent-light dark:bg-forge-accent",
  secondary: "bg-forge-surface3-light dark:bg-forge-surface3",
  ghost:
    "bg-transparent border border-forge-border-light dark:border-forge-border",
  destructive:
    "bg-transparent border border-forge-border-light dark:border-forge-border",
};

// variant → label color classes.
const VARIANT_LABEL: Record<ForgeButtonVariant, string> = {
  primary: "text-forge-accentText-light dark:text-forge-accentText",
  secondary: "text-forge-text-light dark:text-forge-text",
  ghost: "text-forge-text-light dark:text-forge-text",
  destructive: "text-forge-danger-light dark:text-forge-danger",
};

// size → container height / horizontal padding / radius (UI-SPEC §size→height).
const SIZE_CONTAINER: Record<ForgeButtonSize, string> = {
  lg: "h-[58px] px-6 rounded-forge-lg",
  md: "h-[52px] px-5 rounded-forge-md",
  sm: "h-9 px-4 rounded-full",
};

// size → label font size.
const SIZE_LABEL: Record<ForgeButtonSize, string> = {
  lg: "text-[17px]",
  md: "text-[16px]",
  sm: "text-[14px]",
};

// size → leading/trailing icon px.
const SIZE_ICON: Record<ForgeButtonSize, number> = { lg: 20, md: 18, sm: 16 };

export function ForgeButton({
  label,
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "leading",
  loading = false,
  disabled = false,
  fullWidth = false,
  onPress,
}: ForgeButtonProps) {
  const isDisabled = disabled || loading;
  // WR-02 — light+dark parity for the Icon + ActivityIndicator, which take a
  // raw color prop and so cannot use the VARIANT_LABEL NativeWind classes.
  // Derive the hex from the active scheme so it tracks the same token pairs the
  // label uses (tailwind.config.js: accentText, danger, text).
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  // Label/icon ink color (matches VARIANT_LABEL tokens, for the Icon + spinner).
  //   primary     → accentText  (#FFFFFF both modes)
  //   destructive → danger      (light #D70015 / dark #FF453A)
  //   secondary,ghost → text    (light #0A0A0A / dark #FFFFFF)
  const inkColor =
    variant === "primary"
      ? "#FFFFFF"
      : variant === "destructive"
        ? isDark
          ? "#FF453A"
          : "#D70015"
        : isDark
          ? "#FFFFFF"
          : "#0A0A0A";

  const iconNode = icon ? (
    <Icon name={icon} size={SIZE_ICON[size]} color={inkColor} strokeWidth={2} />
  ) : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      className={`flex-row items-center justify-center gap-2 ${
        SIZE_CONTAINER[size]
      } ${VARIANT_CONTAINER[variant]} ${fullWidth ? "w-full" : "self-start"}`}
      style={({ pressed }) => [
        variant === "primary" ? accentShadow : null,
        isDisabled ? { opacity: 0.4 } : pressed ? { opacity: 0.85 } : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={inkColor} />
      ) : (
        <>
          {iconPosition === "leading" ? iconNode : null}
          <Text
            className={`${SIZE_LABEL[size]} ${VARIANT_LABEL[variant]}`}
            style={{ fontWeight: "600", letterSpacing: -0.2 }}
            numberOfLines={1}
          >
            {label}
          </Text>
          {iconPosition === "trailing" ? iconNode : null}
        </>
      )}
    </Pressable>
  );
}

export default ForgeButton;
