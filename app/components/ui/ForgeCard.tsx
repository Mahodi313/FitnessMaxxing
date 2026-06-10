// app/components/ui/ForgeCard.tsx
//
// Phase 8 (Forge Foundation), Plan 08-04 — DSGN-04 / D-02.
// The base container primitive — the shell behind hero cards, plan rows, stat
// grids, session rows and settings cards. Token-driven, explicit-prop API
// (padding / radius / tint / interactive). 08-UI-SPEC.md §ForgeCard.
//
// Analog: app/components/active-session-banner.tsx (card-shell View with token
// bg/border/radius + the canonical NativeWind dark-flip on a container, line 58)
// + segmented-control.tsx FIT-66 pressed callback for the interactive variant.
//
// FIT-66 (08-PATTERNS.md §FIT-66, T-08-08): when `interactive`, pressed feedback
// is a Pressable style-callback — NEVER an `active:opacity-*` className.
//
// Light+dark parity: every color class pairs a `-light` base token with a
// `dark:` DEFAULT token (tailwind.config.js OQ-3).
//
// References:
//   - .planning/phases/08-forge-foundation/08-UI-SPEC.md §ForgeCard
//   - .planning/phases/08-forge-foundation/08-PATTERNS.md §ForgeCard, §FIT-66

import { type ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "./Icon";

export type ForgeCardPadding = "sm" | "md" | "lg";
export type ForgeCardRadius = "md" | "lg" | "xl";
export type ForgeCardTint = "surface" | "accentSoft";

export type ForgeCardProps = {
  children: ReactNode;
  padding?: ForgeCardPadding;
  radius?: ForgeCardRadius;
  tint?: ForgeCardTint;
  interactive?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
};

const PADDING: Record<ForgeCardPadding, string> = {
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

const RADIUS: Record<ForgeCardRadius, string> = {
  md: "rounded-forge-md",
  lg: "rounded-forge-lg",
  xl: "rounded-forge-xl",
};

// tint → background (surface vs accent-soft), light base + dark: sibling.
const TINT_BG: Record<ForgeCardTint, string> = {
  surface: "bg-forge-surface-light dark:bg-forge-surface",
  accentSoft: "bg-forge-accentSoft-light dark:bg-forge-accentSoft",
};

const TEXT3_LIGHT = "#8B8B8B";

export function ForgeCard({
  children,
  padding = "lg",
  radius = "lg",
  tint = "surface",
  interactive = false,
  onPress,
  accessibilityLabel,
}: ForgeCardProps) {
  const containerClass = `${PADDING[padding]} ${RADIUS[radius]} ${
    TINT_BG[tint]
  } border border-forge-border-light dark:border-forge-border`;

  if (interactive) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        className={`flex-row items-center justify-between gap-2 ${containerClass}`}
        // FIT-66 — pressed feedback via style callback, never active:opacity-*.
        style={({ pressed }) => (pressed ? { opacity: 0.85 } : null)}
      >
        <View className="flex-1">{children}</View>
        <Icon name="chevronRight" size={20} color={TEXT3_LIGHT} />
      </Pressable>
    );
  }

  return <View className={containerClass}>{children}</View>;
}

export default ForgeCard;
