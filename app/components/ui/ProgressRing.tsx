// app/components/ui/ProgressRing.tsx
//
// Phase 8 (Forge Foundation), Plan 08-03 — DSGN-05 / D-08.
// Apple-Fitness-style activity ring, drawn STATICALLY with the already-installed
// @shopify/react-native-skia (no new charting dep). Ported from the design source
//   app/design v2/Sources/design/lib.jsx  (ProgressRing, lines 424-452).
// (08-RESEARCH.md §Pattern 4; 08-PATTERNS.md §ProgressRing/Sparkline; 08-UI-SPEC.md.)
//
// STATIC ONLY (D-08): the ring renders at its target `value` with NO mount/draw
// animation. Animated fill is Phase 12 (MOTN-02). This file MUST NOT import
// useSharedValue / useDerivedValue / withTiming — chart.tsx imports those for its
// animated tooltip; we deliberately do not copy that.
//
// Port (SVG → Skia): lib.jsx uses an SVG <circle strokeDasharray> rotated -90°.
// The Skia equivalent is a background full-circle Path + a foreground arc Path
// built via `addArc(rect, -90, 360*clamp(value))`, both stroked with round caps.
// Optional sweep gradient via <SweepGradient> child of the foreground Path.
// Center `children` overlay via an absolutely-positioned <View> sibling of <Canvas>
// (lib.jsx wraps the svg + center content in a relative container).
//
// T-08-06 (DoS-render): `value` is clamped to 0..1 so a malformed prop cannot
// produce a NaN sweep that crashes the Canvas.

import { View } from "react-native";
import { useColorScheme } from "nativewind";
import { Canvas, Path, Skia, SweepGradient, vec } from "@shopify/react-native-skia";

export type ProgressRingProps = {
  size?: number;
  stroke?: number;
  /** Fill fraction 0..1 (clamped). */
  value: number;
  /** Solid foreground color (used when `gradient` is not supplied). */
  color?: string;
  /**
   * Track (background) ring color. When omitted, the default is derived from
   * the active color scheme (WR-04): a subtle white overlay in dark mode, a
   * subtle black overlay in light mode — so the track stays visible in both.
   */
  trackColor?: string;
  /** Optional sweep-gradient stops [from, to] — overrides `color`. */
  gradient?: [string, string];
  /** Center overlay content. */
  children?: React.ReactNode;
};

export function ProgressRing({
  size = 80,
  stroke = 8,
  value,
  color = "#FF5A1F",
  trackColor,
  gradient,
  children,
}: ProgressRingProps) {
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;

  // WR-04: the dark-only white-overlay default is invisible on the light bg
  // (#FAFAF7). Resolve the default from the scheme so the track stays visible
  // in both themes; an explicit `trackColor` prop still wins.
  const { colorScheme } = useColorScheme();
  const resolvedTrack =
    trackColor ??
    (colorScheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)");

  // T-08-06: clamp value to 0..1 — guards against NaN / out-of-range props.
  const v = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

  // Background full ring.
  const bg = Skia.Path.Make();
  bg.addCircle(cx, cy, r);

  // Foreground arc: start at -90° (12 o'clock), sweep value*360°.
  const fg = Skia.Path.Make();
  fg.addArc({ x: cx - r, y: cy - r, width: 2 * r, height: 2 * r }, -90, 360 * v);

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Canvas style={{ width: size, height: size, position: "absolute", top: 0, left: 0 }}>
        <Path path={bg} style="stroke" strokeWidth={stroke} color={resolvedTrack} />
        <Path path={fg} style="stroke" strokeWidth={stroke} strokeCap="round" color={color}>
          {gradient && (
            <SweepGradient c={vec(cx, cy)} colors={gradient} start={0} end={360} />
          )}
        </Path>
      </Canvas>
      {children}
    </View>
  );
}

export default ProgressRing;
