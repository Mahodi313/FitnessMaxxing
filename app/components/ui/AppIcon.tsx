// app/components/ui/AppIcon.tsx
//
// Phase 8 (Forge Foundation), Plan 08-03 — DSGN-06 / D-03.
// The "home-screen icon" form of the brand: a gradient squircle containing the
// white Ascend Logo. Ported from the design source
//   app/design v2/Sources/design/lib.jsx  (AppIcon, lines 691-702).
// (08-PATTERNS.md §Logo/AppIcon — NO ANALOG; 08-UI-SPEC.md §AppIcon.)
//
// Component only (D-03): renders as an RN component for the gallery — it does
// NOT swap the real app.json app-icon/splash asset this phase.
//
// Port notes (web → RN):
//   - lib.jsx uses CSS `background: linear-gradient(135deg, from, to)`. NativeWind
//     cannot render a gradient background, so the squircle fill is drawn with a
//     react-native-svg <Rect> + diagonal <LinearGradient> (D-11, same engine as
//     Logo) sitting behind an absolutely-positioned white <Logo>.
//   - radius = size*0.28 (lib.jsx squircle), Logo size = size*0.62 (lib.jsx).
//   - SHADOW (FIT-66): lib.jsx `boxShadow: 0 size*0.14 size*0.32 ${from}40`.
//     Per 08-PATTERNS.md §FIT-66, shadows MUST be an explicit iOS shadow STYLE
//     object — NOT a `shadow-*` NativeWind className (the css-interop
//     upgrade-warning codepath can recurse the fiber tree and crash). So the
//     brand-colored drop shadow below is a plain RN style object.

import { useId } from "react";
import { View } from "react-native";
import Svg, { Rect, Defs, LinearGradient, Stop } from "react-native-svg";

import { Logo } from "./Logo";

export type AppIconProps = {
  size?: number;
  /** Squircle corner radius (default size*0.28). */
  radius?: number;
  /** Gradient start (default brand gradFrom). */
  from?: string;
  /** Gradient end (default brand gradTo). */
  to?: string;
};

export function AppIcon({
  size = 56,
  radius,
  from = "#FF7A2E",
  to = "#FF2D55",
}: AppIconProps) {
  const id = useId();
  const r = radius ?? size * 0.28;
  const logoSize = size * 0.62;

  // FIT-66 — explicit iOS shadow STYLE object (NOT a Tailwind shadow class).
  // Mirrors lib.jsx `boxShadow: 0 ${size*0.14}px ${size*0.32}px ${from}40`
  // (the `40` hex alpha ≈ 0.25 opacity → shadowOpacity 0.25).
  const shadowStyle = {
    shadowColor: from,
    shadowOffset: { width: 0, height: size * 0.14 },
    shadowOpacity: 0.25,
    shadowRadius: size * 0.32,
  };

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: r,
          alignItems: "center",
          justifyContent: "center",
        },
        shadowStyle,
      ]}
    >
      {/* Gradient squircle fill (135deg ≈ top-left → bottom-right diagonal). */}
      <Svg width={size} height={size} style={{ position: "absolute", top: 0, left: 0 }}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2={size} y2={size} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={size} height={size} rx={r} ry={r} fill={`url(#${id})`} />
      </Svg>
      <Logo size={logoSize} variant="white" />
    </View>
  );
}

export default AppIcon;
