// app/components/ui/Sparkline.tsx
//
// Phase 8 (Forge Foundation), Plan 08-03 — DSGN-05 / D-08.
// Minimal stroke sparkline with gradient fill + last-point dot, drawn STATICALLY
// with the already-installed @shopify/react-native-skia (no new charting dep).
// Ported from the design source
//   app/design v2/Sources/design/lib.jsx  (Sparkline, lines 457-488).
// (08-RESEARCH.md §Pattern 5; 08-PATTERNS.md §ProgressRing/Sparkline; 08-UI-SPEC.md.)
//
// STATIC ONLY (D-08): renders the full path immediately with NO draw-on-mount
// animation (that is Phase 12 / MOTN-03). This file MUST NOT import
// useSharedValue / useDerivedValue / withTiming.
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

import { Canvas, Path, Circle, Skia, LinearGradient, vec } from "@shopify/react-native-skia";

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

export function Sparkline({
  data,
  width = 200,
  height = 48,
  color = "#FF5A1F",
  fill = true,
  showDot = true,
  strokeWidth = 2,
}: SparklineProps) {
  // T-08-06: guard empty / single-point data (lib.jsx returns null on empty; a
  // single point has no line, and (length - 1) === 0 would divide by zero).
  if (!data || data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  // Halo radius (lib.jsx: strokeWidth + 4.5). Pad the Canvas + offset all coords
  // by this so the halo on the last point is never clipped (Pitfall 5).
  const halo = strokeWidth + 4.5;
  const canvasW = width + halo * 2;
  const canvasH = height + halo * 2;

  // Inner padding matches lib.jsx `pad = strokeWidth + 2`, then everything is
  // shifted by `halo` to sit inside the padded Canvas.
  const pad = strokeWidth + 2;
  const pts = data.map((val, i) => {
    const x = halo + pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = halo + pad + (1 - (val - min) / range) * (height - pad * 2);
    return [x, y] as const;
  });

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
      {showDot && (
        <>
          {/* Halo first (under), then the solid dot (lib.jsx draws dot then halo;
              order is reversed here so the opaque dot sits on top). */}
          <Circle cx={last[0]} cy={last[1]} r={strokeWidth + 4.5} color={color} opacity={0.18} />
          <Circle cx={last[0]} cy={last[1]} r={strokeWidth + 1.5} color={color} />
        </>
      )}
    </Canvas>
  );
}

export default Sparkline;
