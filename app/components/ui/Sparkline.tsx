// app/components/ui/Sparkline.tsx
//
// Phase 8 (Forge Foundation), Plan 08-03 — DSGN-05 / D-08 (static origin).
// Phase 12 (Plan 12-03) — D-18: animated left→right draw-in on mount. The
// Phase-8 static-only restriction is LIFTED here on purpose: this file now
// imports react-native-reanimated (useSharedValue / useDerivedValue /
// withSpring / withDelay / useReducedMotion) to drive the reveal on the UI
// thread. Minimal stroke sparkline with gradient fill + last-point dot, drawn
// with the already-installed @shopify/react-native-skia (no new charting dep).
// Ported from the design source
//   app/design v2/Sources/design/lib.jsx  (Sparkline, lines 457-488).
// (08-RESEARCH.md §Pattern 5; 12-RESEARCH.md §Mandate 3; 12-UI-SPEC.md §07.)
//
// ANIMATION (D-18, additive — no path math change): the line + area paths are
// wrapped in a <Group clip={clipRect}> whose width tweens 0→full via a
// `drawProgress` shared value on §07 spring (withSpring, damping 18 /
// stiffness 220). The last-point dot fades/scales in at the END of the draw via
// a delayed second shared value. useReducedMotion() (synchronous boolean) →
// snap to full immediately.
//
// Port (SVG → Skia): lib.jsx normalizes min/max with `pad = strokeWidth + 2`,
// builds a `moveTo`/`lineTo` line path, a closed fill path down to the baseline,
// a vertical gradient fill (color@0.35 → transparent), and a last-point dot + a
// soft halo. We rebuild each as a Skia Path / Circle.
//
// Pitfall 5 (Canvas sizing / overflow): the web version sets `overflow:visible`
// so the last-point halo (r = strokeWidth + 4.5) can extend past bounds. RN
// Skia <Canvas> clips to its size, so we PAD the Canvas by the halo radius and
// offset every coordinate by that pad so the halo is never clipped.
//
// T-08-06 (DoS-render): empty / single-element `data` is guarded — no NaN from a
// zero-length divisor or an undefined min/max.

import { useEffect } from "react";
import {
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Path,
  Skia,
  vec,
} from "@shopify/react-native-skia";
import {
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";

export type SparklineProps = {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  /** Render the gradient fill area under the line (default true). */
  fill?: boolean;
  /** Render the last-point dot + halo (default true). */
  showDot?: boolean;
  strokeWidth?: number;
};

// §07 motion spec (12-UI-SPEC.md §07): mount springs use damping 18 / stiffness 220.
const SPRING = { damping: 18, stiffness: 220 } as const;
// Dot reveal lands near the end of the draw.
const DOT_DELAY_MS = 260;

export function Sparkline({
  data,
  width = 200,
  height = 48,
  color = "#FF5A1F",
  fill = true,
  showDot = true,
  strokeWidth = 2,
}: SparklineProps) {
  // Reanimated hooks must run unconditionally (rules-of-hooks) — declare them
  // BEFORE the early-return guard below.
  const reduced = useReducedMotion();
  const drawProgress = useSharedValue(0); // 0 → 1 left-to-right reveal
  const dotProgress = useSharedValue(0); // 0 → 1 last-point dot fade/scale

  useEffect(() => {
    if (reduced) {
      drawProgress.value = 1;
      dotProgress.value = 1;
    } else {
      drawProgress.value = withSpring(1, SPRING);
      dotProgress.value = withDelay(DOT_DELAY_MS, withSpring(1, SPRING));
    }
  }, [reduced, drawProgress, dotProgress, data]);

  // T-08-06: guard empty / single-point data (lib.jsx returns null on empty; a
  // single point has no line, and (length - 1) === 0 would divide by zero).
  const valid = !!data && data.length >= 2;

  const max = valid ? Math.max(...data) : 0;
  const min = valid ? Math.min(...data) : 0;
  const range = max - min || 1;

  // Halo radius (lib.jsx: strokeWidth + 4.5). Pad the Canvas + offset all coords
  // by this so the halo on the last point is never clipped (Pitfall 5).
  const halo = strokeWidth + 4.5;
  const canvasW = width + halo * 2;
  const canvasH = height + halo * 2;

  // Inner padding matches lib.jsx `pad = strokeWidth + 2`, then everything is
  // shifted by `halo` to sit inside the padded Canvas.
  const pad = strokeWidth + 2;
  const pts = valid
    ? data.map((val, i) => {
        const x = halo + pad + (i / (data.length - 1)) * (width - pad * 2);
        const y = halo + pad + (1 - (val - min) / range) * (height - pad * 2);
        return [x, y] as const;
      })
    : [];

  // D-18 animated clip: a left→right rect that grows to cover the whole padded
  // canvas. Rebuilt reactively on the UI thread from drawProgress.
  const clipRect = useDerivedValue(() =>
    Skia.XYWHRect(0, 0, canvasW * drawProgress.value, canvasH),
  );
  // Dot fades + scales in at the end of the draw.
  const dotR = useDerivedValue(() => (strokeWidth + 1.5) * dotProgress.value);
  const haloR = useDerivedValue(() => (strokeWidth + 4.5) * dotProgress.value);
  const dotOpacity = useDerivedValue(() => dotProgress.value);
  const haloOpacity = useDerivedValue(() => 0.18 * dotProgress.value);

  if (!valid) return null;

  // Line path.
  const line = Skia.Path.Make();
  pts.forEach(([x, y], i) => (i === 0 ? line.moveTo(x, y) : line.lineTo(x, y)));

  // Closed fill path down to the baseline (lib.jsx fillD).
  const baseY = halo + height;
  const area = line.copy();
  area.lineTo(halo + width - pad, baseY);
  area.lineTo(halo + pad, baseY);
  area.close();

  const last = pts[pts.length - 1];

  return (
    <Canvas style={{ width: canvasW, height: canvasH }}>
      {/* D-18: line + area draw in left→right under an animated-width clip. */}
      <Group clip={clipRect}>
        {fill && (
          <Path path={area} style="fill">
            {/* color@0.35 → transparent, top → bottom (lib.jsx vertical gradient). */}
            <LinearGradient
              start={vec(0, halo)}
              end={vec(0, baseY)}
              colors={[`${color}59`, `${color}00`]}
            />
          </Path>
        )}
        <Path
          path={line}
          style="stroke"
          strokeWidth={strokeWidth}
          strokeCap="round"
          strokeJoin="round"
          color={color}
        />
      </Group>
      {showDot && (
        <>
          {/* Halo first (under), then the solid dot (lib.jsx draws dot then halo;
              order is reversed here so the opaque dot sits on top). Both fade +
              scale in via the delayed dotProgress (D-18). */}
          <Circle cx={last[0]} cy={last[1]} r={haloR} color={color} opacity={haloOpacity} />
          <Circle cx={last[0]} cy={last[1]} r={dotR} color={color} opacity={dotOpacity} />
        </>
      )}
    </Canvas>
  );
}

export default Sparkline;
