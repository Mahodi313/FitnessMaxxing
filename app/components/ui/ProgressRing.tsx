// app/components/ui/ProgressRing.tsx
//
// Phase 8 (Forge Foundation), Plan 08-03 — DSGN-05 / D-08 (static origin).
// Phase 12 (Plan 12-03) — MOTN-02 / D-18 / D-19: animated mount fill + overflow
// glow. The Phase-8 static-only restriction is LIFTED here on purpose: this file
// now imports react-native-reanimated (useSharedValue / useDerivedValue /
// withSpring / useReducedMotion) to drive the sweep angle on the UI thread.
// Apple-Fitness-style activity ring, drawn with the already-installed
// @shopify/react-native-skia (no new charting dep). Ported from the design source
//   app/design v2/Sources/design/lib.jsx  (ProgressRing, lines 424-452).
// (08-RESEARCH.md §Pattern 4; 12-RESEARCH.md §Mandate 3; 12-UI-SPEC.md §07.)
//
// ANIMATION (MOTN-02 + D-18, additive — no math/layout change):
//   A `progress` shared value tweens 0→value on mount via §07 spring
//   (withSpring, damping 18 / stiffness 220). The foreground arc Path is rebuilt
//   reactively inside useDerivedValue so Skia re-renders on the UI thread.
//   useReducedMotion() (synchronous boolean, start-of-app) → snap to final.
//
// OVERFLOW / GOAL-BEATEN (D-19): when value > 1 we do NOT clamp. A second-lap
// foreground arc draws `(progress - 1) * 360` over the first lap, plus a wide
// low-opacity glow stroke underneath the second lap to celebrate the beat
// without a hue shift. The center `children` overlay ALWAYS shows the real count
// passed by the parent (e.g. "5 / 4"), never the capped fraction.
//
// Port (SVG → Skia): lib.jsx uses an SVG <circle strokeDasharray> rotated -90°.
// The Skia equivalent is a background full-circle Path + a foreground arc Path
// built via `addArc(rect, -90, 360*progress)`, both stroked with round caps.
// Optional sweep gradient via <SweepGradient> child of the foreground Path.
// Center `children` overlay via an absolutely-positioned <View> sibling of <Canvas>
// (lib.jsx wraps the svg + center content in a relative container).
//
// T-08-06 (DoS-render): `value` is sanitized to a finite non-negative number so a
// malformed prop cannot produce a NaN sweep that crashes the Canvas. Note the
// upper bound is NO LONGER clamped to 1 (D-19 overflow) — the first lap is capped
// at 360° via Math.min(progress, 1) inside the worklet instead.

import { useEffect } from "react";
import { View } from "react-native";
import { useColorScheme } from "nativewind";
import { Canvas, Path, Skia, SweepGradient, vec } from "@shopify/react-native-skia";
import {
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

export type ProgressRingProps = {
  size?: number;
  stroke?: number;
  /** Fill fraction; values > 1 overfill with a glow/second-lap (D-19). */
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

// §07 motion spec (12-UI-SPEC.md §07): mount springs use damping 18 / stiffness 220.
const SPRING = { damping: 18, stiffness: 220 } as const;

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
  // D-19 fix: the overflow glow stroke (stroke * 2.4) is drawn at radius r and
  // extends ~stroke*0.7 beyond the base ring. On a canvas sized exactly `size`
  // that bleed is clipped to the square canvas corners — the "orange square
  // around the ring" UAT report (2026-06-13). Enlarge the canvas by PAD on every
  // side and draw the ring centred in it; the ring geometry (r) is unchanged so
  // the visible ring looks identical, the glow just has room to render round.
  // The outer wrapper stays size×size (layout unaffected; RN Views don't clip
  // overflow by default, and the hero card's 20px padding absorbs the bleed).
  const PAD = Math.ceil(stroke);
  const canvas = size + PAD * 2;
  const cx = canvas / 2;
  const cy = canvas / 2;

  // WR-04: the dark-only white-overlay default is invisible on the light bg
  // (#FAFAF7). Resolve the default from the scheme so the track stays visible
  // in both themes; an explicit `trackColor` prop still wins.
  const { colorScheme } = useColorScheme();
  const resolvedTrack =
    trackColor ??
    (colorScheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)");

  // T-08-06: sanitize value to a finite non-negative number. Upper bound is NOT
  // clamped (D-19 overflow) — the first lap caps at 360° in the worklet below.
  const v = Math.max(0, Number.isFinite(value) ? value : 0);

  // Background full ring (static — never animates).
  const bg = Skia.Path.Make();
  bg.addCircle(cx, cy, r);

  // MOTN-02 / D-18: animated sweep. reduced is a synchronous boolean captured
  // at app start → snap to final; otherwise §07 spring 0→v on mount.
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = reduced ? v : withSpring(v, SPRING);
  }, [v, reduced, progress]);

  const arcRect = { x: cx - r, y: cy - r, width: 2 * r, height: 2 * r };

  // First-lap arc (0..360°), capped at one full lap. Rebuilt on the UI thread.
  const fgPath = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const sweep = Math.min(progress.value, 1) * 360;
    p.addArc(arcRect, -90, sweep);
    return p;
  });

  // D-19 second-lap arc — only sweeps once progress exceeds 1 (goal beaten).
  // Drawn over the first lap; the glow stroke underneath gives the celebration.
  const overflowPath = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const over = Math.max(0, progress.value - 1);
    if (over > 0) p.addArc(arcRect, -90, Math.min(over, 1) * 360);
    return p;
  });

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Canvas style={{ width: canvas, height: canvas, position: "absolute", top: -PAD, left: -PAD }}>
        <Path path={bg} style="stroke" strokeWidth={stroke} color={resolvedTrack} />
        {/* First lap (0→100%). */}
        <Path path={fgPath} style="stroke" strokeWidth={stroke} strokeCap="round" color={color}>
          {gradient && (
            <SweepGradient c={vec(cx, cy)} colors={gradient} start={0} end={360} />
          )}
        </Path>
        {/* D-19 overflow glow: wide low-opacity stroke UNDER the second lap. */}
        <Path
          path={overflowPath}
          style="stroke"
          strokeWidth={stroke * 2.4}
          strokeCap="round"
          color={color}
          opacity={0.22}
        />
        {/* D-19 overflow second lap (full-brightness, drawn over the first lap). */}
        <Path
          path={overflowPath}
          style="stroke"
          strokeWidth={stroke}
          strokeCap="round"
          color={color}
        >
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
