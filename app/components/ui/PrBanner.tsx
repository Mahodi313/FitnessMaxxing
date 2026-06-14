// app/components/ui/PrBanner.tsx
//
// Phase 13 (PR Celebration, F18), Plan 13-04 — PR-03 / D-09 / D-10 / D-11 / D-19.
// The floating celebration banner that mounts ON TOP of the active-workout set
// list when a logged working set beats the prior best e1RM. It is delight
// layered over the sacred log path — the CONSUMER renders it as an absolutely-
// positioned floating overlay (D-09); this component owns only the surface,
// the motion, the haptic-free visual, and the auto-dismiss timer.
//
// MOTION (§07 Motion Contract / UI-SPEC):
//   - Entry: scale 0.96 → 1.0 via withSpring(damping 18 / stiffness 220) — the
//     Forge §07 default, copied verbatim from Sparkline.tsx:65 (SPRING).
//   - Gradient SWEEP across the surface: a Skia <LinearGradient> whose start/end
//     vector tweens left→right via a `sweep` shared value, animated on the UI
//     thread through useDerivedValue (the EXACT Sparkline mechanism,
//     Sparkline.tsx:121-128 — animated Skia geometry from a Reanimated shared
//     value). This is a real Skia+Reanimated sweep, NOT a JS setInterval.
//   - Dwell ~3.5s then auto-dismiss (D-10) — a setTimeout(onDismiss) on mount,
//     cleared on unmount. No tap required (the banner is non-interactive).
//   - useReducedMotion() (synchronous boolean, Sparkline.tsx:80) → snap BOTH the
//     scale and the sweep to final immediately (D-19); the banner + trophy still
//     render, just without animation.
//
//   A7 BREADCRUMB (RESEARCH §856-864 fallback): the 0.96→1 scale spring can read
//   as a "pop" on device. If device-UAT (Task 3) reports a pop, swap the
//   withSpring below for `withTiming(1, { duration: 180, easing:
//   Easing.out(Easing.quad) })` — the same calm grow LoggedSetRow's check uses
//   ([sessionId].tsx:856-864). Left as a spring per the §07 spec until UAT says
//   otherwise.
//
// CRITICAL — NativeWind 4 box-decoration rule (project MEMORY / Pitfall 6):
// bg / border / radius / padding go in `className`; only the animated transform
// (scale) + opacity live in the inline animated `style`. The gradient WASH +
// SWEEP are a Skia <Canvas> absolute-fill layer UNDER the content — Skia draws
// its own gradient, so the className surface stays a transparent-bg rounded box
// with the accent border, and the wash shows through.
//
// UNITS (D-20): the banner shows the SET's actual weight/reps. weight is stored
// canonical kg → display-converted via the reactive useUnitStore + formatWeight
// (FIT-111) so a kg↔lb toggle re-renders live. reps is unitless.
//
// References:
//   - app/components/ui/Sparkline.tsx (SPRING :65, useReducedMotion :80,
//     useDerivedValue animated Skia geometry :121-128 — THE precedent)
//   - .planning/phases/13-pr-celebration-f18/13-UI-SPEC.md (Motion Contract;
//     Surface row 1; Color §1 banner wash gradFrom15→gradTo15 + accent30 border)
//   - app/lib/units-store.ts + app/lib/units.ts (D-20 reactive display unit)

import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Canvas, LinearGradient, Rect, vec } from "@shopify/react-native-skia";
import { useColorScheme } from "nativewind";
import { useTranslation } from "react-i18next";

import { Icon } from "@/components/ui/Icon";
import { useUnitStore } from "@/lib/units-store";
import { formatWeight } from "@/lib/units";

// §07 motion spec — damping 18 / stiffness 220 (Sparkline.tsx:65, Forge §07).
const SPRING = { damping: 18, stiffness: 220 } as const;
// Dwell before auto-dismiss (D-10 — ~3–4s).
const DWELL_MS = 3500;
// Sweep travel duration (UI-SPEC: ~600ms entry).
const SWEEP_MS = 600;

// Brand gradient endpoints — verbatim from THEMES.forge / the brand-mark tile.
const GRAD = {
  light: { from: "#FF7A2E", to: "#FF3D5E", accent: "#E14E10" },
  dark: { from: "#FF7A2E", to: "#FF2D55", accent: "#FF5A1F" },
} as const;

// 15% / 30% alpha suffixes for the wash + border (UI-SPEC §Color: gradFrom15 →
// gradTo15 wash, accent30 border). 8-digit hex (#RRGGBBAA): 0x26 ≈ 15%, 0x4D ≈ 30%.
const A15 = "26";
const A30 = "4D";

export type PrBannerProps = {
  /** The PR set's weight, stored canonical kg (display-converted via D-20). */
  weightKg: number;
  /** The PR set's reps (unitless). */
  reps: number;
  /** 1-based session set ordinal — rendered as the `· set {{n}}` suffix. */
  setNumber: number;
  /** Called once the dwell elapses (consumer removes this banner from state). */
  onDismiss: () => void;
  /** Banner width in px (the Skia wash canvas needs an explicit size). */
  width: number;
};

export function PrBanner({
  weightKg,
  reps,
  setNumber,
  onDismiss,
  width,
}: PrBannerProps) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const grad = GRAD[isDark ? "dark" : "light"];

  // D-20: reactive display unit — a Settings kg↔lb toggle re-renders this live.
  const unit = useUnitStore((s) => s.unit);

  // Banner height (md vertical padding 12 + 36px trophy tile = ~60px; the wash
  // canvas needs a concrete height. The content height drives it — measure once.)
  const [bannerH, setBannerH] = useState(0);

  // MOTION (Sparkline precedent). Hooks run unconditionally (rules-of-hooks).
  const reduced = useReducedMotion();
  const scale = useSharedValue(0.96); // 0.96 → 1 entry
  const sweep = useSharedValue(0); // 0 → 1 gradient sweep across the surface

  useEffect(() => {
    if (reduced) {
      // D-19: snap to final — banner still renders, no animation.
      scale.value = 1;
      sweep.value = 1;
    } else {
      scale.value = withSpring(1, SPRING); // A7: swap for withTiming if it "pops"
      sweep.value = withTiming(1, { duration: SWEEP_MS });
    }
  }, [reduced, scale, sweep]);

  // Auto-dismiss (D-10): a single timer, cleared on unmount. Fire-and-forget.
  useEffect(() => {
    const id = setTimeout(onDismiss, DWELL_MS);
    return () => clearTimeout(id);
  }, [onDismiss]);

  const bannerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // D-18/§07: the wash gradient SWEEPS — its start/end vector slides left→right
  // as `sweep` tweens 0→1, rebuilt on the UI thread (Sparkline:121-128 mechanism).
  const sweepW = Math.max(width, 1);
  const gradStart = useDerivedValue(() =>
    vec(-sweepW + sweepW * 2 * sweep.value, 0),
  );
  const gradEnd = useDerivedValue(() =>
    vec(sweepW * 2 * sweep.value, 0),
  );

  // Set numerals (D-20). The PR set's weight is canonical kg → display-converted
  // via formatWeight, which carries the CORRECT unit suffix ("105 kg" / "220.5
  // lb"). The banner sub reads e.g. "105 kg × 6 reps · set 3".
  //
  // UNIT-HONESTY (Rule 2 — D-20): the `pbSub` locale key hardcodes "kg" in its
  // template ("{{kg}} kg × {{reps}} reps"), so feeding it an IMPERIAL numeral
  // would mislabel a 220.5 lb set as "220.5 kg". To keep the banner unit-honest
  // under the kg↔lb toggle we interpolate `{{kg}}` with the FULLY-FORMATTED
  // weight (numeral + correct unit via formatWeight) and STRIP the template's
  // trailing " kg" literal so the suffix never doubles. Metric is unchanged
  // ("105 kg × 6 reps"); imperial now reads correctly ("220.5 lb × 6 reps").
  const weightLabel = formatWeight(weightKg, unit); // "105 kg" | "220.5 lb"
  const pbSubRaw = t("pbSub", { kg: weightLabel, reps: String(reps) });
  const pbSubFixed = pbSubRaw.replace(`${weightLabel} kg`, weightLabel);
  const sub = `${pbSubFixed} ${t("pbSetSuffix", { n: setNumber })}`;

  return (
    <Animated.View
      // Box-decoration in className (Pitfall 6): 16px radius + 1px accent30
      // border + md padding (12px vertical / 14px horizontal). The surface bg is
      // TRANSPARENT — the Skia wash canvas below provides the gradient fill.
      className="rounded-[16px] overflow-hidden"
      style={[
        {
          borderWidth: 1,
          borderColor: `${grad.accent}${A30}`,
          paddingVertical: 12,
          paddingHorizontal: 14,
        },
        bannerStyle,
      ]}
      onLayout={(e) => setBannerH(e.nativeEvent.layout.height)}
      // Non-interactive status surface; announce it for screen readers.
      accessibilityRole="text"
      accessibilityLabel={`${t("personalBest")}. ${sub}`}
    >
      {/* Animated gradient WASH + SWEEP — Skia canvas behind the content. The
          wash is the low-alpha gradFrom15 → gradTo15 surface fill; the sweep
          slides its gradient vector across on mount. */}
      {bannerH > 0 && (
        <Canvas
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width,
            height: bannerH,
          }}
          pointerEvents="none"
        >
          <Rect x={0} y={0} width={width} height={bannerH}>
            <LinearGradient
              start={gradStart}
              end={gradEnd}
              colors={[`${grad.from}${A15}`, `${grad.to}${A15}`]}
            />
          </Rect>
        </Canvas>
      )}

      {/* Content row: 36px gradient trophy tile + text block (md gap = 12). */}
      <View className="flex-row items-center" style={{ gap: 12 }}>
        {/* 36px gradient trophy TILE (10px radius — UI-SPEC ratified optical;
            18px white trophy). Gradient fill is the LinearGradient's own prop;
            radius/size live in its style (not a NativeWind box). */}
        <View
          className="items-center justify-center overflow-hidden"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: grad.from, // base; the gradient tile draws over it
          }}
        >
          <Canvas style={{ position: "absolute", width: 36, height: 36 }}>
            <Rect x={0} y={0} width={36} height={36}>
              <LinearGradient
                start={vec(0, 0)}
                end={vec(36, 36)}
                colors={[grad.from, grad.to]}
              />
            </Rect>
          </Canvas>
          <Icon name="trophy" size={18} color="#FFFFFF" strokeWidth={2.2} />
        </View>

        <View style={{ flex: 1 }}>
          {/* Title 14/700, letterSpacing -0.2 (UI-SPEC Typography). */}
          <Text
            className="font-display-bold text-forge-text-light dark:text-forge-text"
            style={{ fontSize: 14, letterSpacing: -0.2 }}
          >
            {t("personalBest")}
          </Text>
          {/* Sub 12/600, tabular-nums (UI-SPEC). */}
          <Text
            className="font-semibold text-forge-text2-light dark:text-forge-text2"
            style={{
              fontSize: 12,
              marginTop: 1,
              fontVariant: ["tabular-nums"],
            }}
          >
            {sub}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

export default PrBanner;
