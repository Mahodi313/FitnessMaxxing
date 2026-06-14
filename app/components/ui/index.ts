// app/components/ui/index.ts
//
// Phase 8 (Forge Foundation), Plan 08-05. Barrel for the Forge primitive
// library so consumers import from a single `@/components/ui` entry point
// (08-05-PLAN.md key_links pattern). Re-exports the Wave-3 vector/Skia
// primitives (Plan 03) + the Wave-4 Forge components (Plan 04).

export { Icon, type IconName, type IconProps } from "./Icon";
export { Logo, type LogoProps, type LogoVariant } from "./Logo";
export { AppIcon, type AppIconProps } from "./AppIcon";
export { ProgressRing, type ProgressRingProps } from "./ProgressRing";
export { Sparkline, type SparklineProps } from "./Sparkline";
export { PrTrophy, type PrTrophyProps } from "./PrTrophy";
export { PrBanner, type PrBannerProps } from "./PrBanner";

export {
  ForgeButton,
  type ForgeButtonProps,
  type ForgeButtonVariant,
  type ForgeButtonSize,
} from "./ForgeButton";
export {
  ForgeField,
  type ForgeFieldProps,
  type ForgeFieldState,
} from "./ForgeField";
export {
  ForgeCard,
  type ForgeCardProps,
  type ForgeCardPadding,
  type ForgeCardRadius,
  type ForgeCardTint,
} from "./ForgeCard";
export {
  ForgeStat,
  type ForgeStatProps,
  type ForgeStatSize,
  type ForgeStatAlign,
  type ForgeStatDelta,
} from "./ForgeStat";
export { ForgeChip, type ForgeChipProps, type ForgeChipVariant } from "./ForgeChip";
export {
  SettingsRow,
  SettingsSection,
  type SettingsRowProps,
  type SettingsSectionProps,
} from "./SettingsRow";
export { TabBar, type TabBarProps, type TabKey } from "./TabBar";
