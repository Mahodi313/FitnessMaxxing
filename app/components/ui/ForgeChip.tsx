// app/components/ui/ForgeChip.tsx
//
// Phase 8 (Forge Foundation), Plan 08-04 — DSGN-04 / D-01.
// Small inline pill primitive — a label with an optional leading accent Icon.
// Ported from app/design v2/Sources/design/forge-screens.jsx (ForgeChip,
// line 205) and 08-UI-SPEC.md §ForgeChip.
//
// Analog: app/components/segmented-control.tsx — a single inline pill (flex-row
// items-center, padding, rounded, token bg/border).
//
// Light+dark parity: every color class pairs a `-light` base token with a
// `dark:` DEFAULT token (tailwind.config.js OQ-3).
//
// References:
//   - .planning/phases/08-forge-foundation/08-UI-SPEC.md §ForgeChip
//   - .planning/phases/08-forge-foundation/08-PATTERNS.md §ForgeChip

import { type ReactNode } from "react";
import { Text, View } from "react-native";

import { Icon, type IconName } from "./Icon";

export type ForgeChipVariant = "default" | "accent" | "success";

export type ForgeChipProps = {
  children: ReactNode;
  icon?: IconName;
  variant?: ForgeChipVariant;
};

// variant → label color (light base + dark: sibling).
const VARIANT_LABEL: Record<ForgeChipVariant, string> = {
  default: "text-forge-text2-light dark:text-forge-text2",
  accent: "text-forge-accent-light dark:text-forge-accent",
  success: "text-forge-success-light dark:text-forge-success",
};

// variant → icon ink (Icon takes a hex; mirror the label color role).
const VARIANT_ICON: Record<ForgeChipVariant, string> = {
  default: "#E14E10", // accent-light — chip icon is rendered in accent (UI-SPEC)
  accent: "#E14E10",
  success: "#1E9E45",
};

export function ForgeChip({
  children,
  icon,
  variant = "default",
}: ForgeChipProps) {
  return (
    <View className="flex-row items-center gap-1 self-start rounded-lg border border-forge-border-light bg-forge-surface2-light px-[9px] py-1 dark:border-forge-border dark:bg-forge-surface2">
      {icon ? (
        <Icon name={icon} size={12} color={VARIANT_ICON[variant]} strokeWidth={2} />
      ) : null}
      <Text
        className={`text-[12px] ${VARIANT_LABEL[variant]}`}
        style={{ fontWeight: "600" }}
      >
        {children}
      </Text>
    </View>
  );
}

export default ForgeChip;
