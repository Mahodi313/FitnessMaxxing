// app/components/ui/Logo.tsx
//
// Phase 8 (Forge Foundation), Plan 08-03 — DSGN-06 / D-03.
// The "Ascend" brand mark — two rising rounded bars + a peak dot — ported 1:1
// from the design source
//   app/design v2/Sources/design/lib.jsx  (Logo, lines 667-688).
// (08-PATTERNS.md §Logo/AppIcon — NO ANALOG; 08-UI-SPEC.md §Logo.)
//
// Component only (D-03): this phase ships Logo/AppIcon as token-driven RN
// components shown in the gallery — it does NOT swap the real app.json
// app-icon/splash asset.
//
// Brand discipline (08-UI-SPEC.md): the Ascend mark is BRAND-only (Logo,
// AppIcon, header brand tiles, PR trophy badge, ProgressRing fill). The barbell
// glyph is content (see Icon.tsx) — never render barbell in the brand gradient.
//
// Variants (lib.jsx line 667):
//   'gradient' → orange→pink LinearGradient stroke on transparent (standalone)
//   'white'    → white stroke (sits inside a gradient tile / AppIcon squircle)
// Stroke width 7 (lib.jsx `sw`), 64×64 viewBox, strokeLinecap="round".

import { useId } from "react";
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from "react-native-svg";

export type LogoVariant = "gradient" | "white";

export type LogoProps = {
  size?: number;
  variant?: LogoVariant;
  /** Gradient start (default brand gradFrom). */
  from?: string;
  /** Gradient end (default brand gradTo). */
  to?: string;
};

export function Logo({
  size = 64,
  variant = "gradient",
  from = "#FF7A2E",
  to = "#FF2D55",
}: LogoProps) {
  const id = useId();
  // gradient variant strokes from the <LinearGradient>; white variant strokes #fff.
  const strokeRef = variant === "white" ? "#fff" : `url(#${id})`;
  const sw = 7;

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {variant === "gradient" && (
        <Defs>
          {/* lib.jsx gradient: x1=0 y1=64 → x2=64 y2=0 (bottom-left → top-right). */}
          <LinearGradient id={id} x1="0" y1="64" x2="64" y2="0" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
      )}
      <Path
        d="M10 50 L10 30 Q10 26 14 26 L18 26 Q22 26 22 30 L22 50"
        stroke={strokeRef}
        strokeWidth={sw}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M32 50 L32 18 Q32 14 36 14 L40 14 Q44 14 44 18 L44 50"
        stroke={strokeRef}
        strokeWidth={sw}
        strokeLinecap="round"
        fill="none"
      />
      {/* Peak dot — white variant fills #fff, gradient variant fills the gradient. */}
      <Circle cx="54" cy="14" r="5" fill={variant === "white" ? "#fff" : strokeRef} />
    </Svg>
  );
}

export default Logo;
