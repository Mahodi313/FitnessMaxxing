// app/components/ui/ForgeStat.tsx
//
// Phase 8 (Forge Foundation), Plan 08-04 — DSGN-04 / DSGN-03 / D-02.
// Label-over-value stat primitive: an UPPERCASE eyebrow label, a large
// Inter-Display tabular numeral value, an optional unit, and an optional
// success/danger delta pill. Ported from
//   app/design v2/Sources/design/forge-screens.jsx (ForgeStat, line 318)
// and 08-UI-SPEC.md §ForgeStat.
//
// Analog: app/components/active-session-banner.tsx label-over-value stack
// (lines 62-72 — nested View with two Text rows).
//
// DSGN-03: the value Text uses `font-display-bold` + the `tnum` style helper
// from app/lib/utils/format.ts so numerals align (tabular figures).
//
// Light+dark parity: every color class pairs a `-light` base token with a
// `dark:` DEFAULT token (tailwind.config.js OQ-3).
//
// References:
//   - .planning/phases/08-forge-foundation/08-UI-SPEC.md §ForgeStat
//   - .planning/phases/08-forge-foundation/08-PATTERNS.md §ForgeStat

import { Text, type TextStyle, View } from "react-native";

import { tnum } from "@/lib/utils/format";

// The Plan-01 `tnum` helper types `fontVariant` as a readonly tuple (`as const`)
// so the constant is immutable; RN's TextStyle.fontVariant is a mutable
// `FontVariant[]`. Copying the tuple into a fresh mutable array at the use-site
// satisfies tsc without mutating the shared (prior-wave) format.ts artifact.
const TNUM: TextStyle = { fontVariant: [...tnum.fontVariant] };

import { Icon } from "./Icon";

export type ForgeStatSize = "sm" | "md" | "lg";
export type ForgeStatAlign = "left" | "center" | "right";
export type ForgeStatDelta = { value: string; direction: "up" | "down" };

export type ForgeStatProps = {
  label: string;
  value: string;
  unit?: string;
  delta?: ForgeStatDelta;
  size?: ForgeStatSize;
  align?: ForgeStatAlign;
};

// size → value font size (UI-SPEC §ForgeStat: sm 18 / md 22 / lg 28-30).
const VALUE_SIZE: Record<ForgeStatSize, string> = {
  sm: "text-[18px]",
  md: "text-[22px]",
  lg: "text-[29px]",
};

const ALIGN_ITEMS: Record<ForgeStatAlign, string> = {
  left: "items-start",
  center: "items-center",
  right: "items-end",
};

export function ForgeStat({
  label,
  value,
  unit,
  delta,
  size = "md",
  align = "left",
}: ForgeStatProps) {
  return (
    <View className={ALIGN_ITEMS[align]}>
      {/* UPPERCASE eyebrow label — 10-11px, weight 600, text3 (UI-SPEC). */}
      <Text
        className="text-[10px] text-forge-text3-light dark:text-forge-text3"
        style={{ fontWeight: "600", letterSpacing: 1, textTransform: "uppercase" }}
      >
        {label}
      </Text>

      <View className="flex-row items-baseline gap-1">
        <Text
          className={`font-display-bold text-forge-text-light dark:text-forge-text ${VALUE_SIZE[size]}`}
          style={TNUM}
        >
          {value}
        </Text>
        {unit ? (
          <Text className="text-[13px] text-forge-text2-light dark:text-forge-text2">
            {unit}
          </Text>
        ) : null}
      </View>

      {delta ? (
        <View
          className={`mt-1 flex-row items-center gap-0.5 rounded-full px-2 py-0.5 ${
            delta.direction === "up"
              ? "bg-forge-success-light/15 dark:bg-forge-success/15"
              : "bg-forge-danger-light/15 dark:bg-forge-danger/15"
          }`}
        >
          <Icon
            name={delta.direction === "up" ? "arrowUp" : "arrowRight"}
            size={12}
            color={delta.direction === "up" ? "#1E9E45" : "#D70015"}
            strokeWidth={2}
          />
          <Text
            className={`text-[12px] ${
              delta.direction === "up"
                ? "text-forge-success-light dark:text-forge-success"
                : "text-forge-danger-light dark:text-forge-danger"
            }`}
            style={[{ fontWeight: "600" }, TNUM]}
          >
            {delta.value}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default ForgeStat;
