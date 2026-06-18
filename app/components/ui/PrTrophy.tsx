// app/components/ui/PrTrophy.tsx
//
// Phase 13 (PR Celebration, F18), Plan 13-04 — PR-02 / D-12 / D-13.
// A reusable gradient trophy circle that REPLACES the green checkCircle on a
// set row that was a PR at log time (D-13 — replaces, never stacks; the 36px
// glyph column holds exactly one glyph). Also reused at other sizes by the
// later read-side surfaces (history-list 24px, session-detail 18px — the size
// ladder is the consumer's call via the `size` prop).
//
// Engine: expo-linear-gradient (the EXACT precedent for a static brand-gradient
// tile already shipped in this app — the brand-mark tile in
// app/app/(app)/(tabs)/index.tsx:216-230 renders `colors={[tk.gradFrom,
// tk.gradTo]}` start={0,0} end={1,1} ≈ 135°). A trophy circle is the same
// static gradient fill, so it rides the same dep — NO new package, NO Skia
// surface needed (Skia is reserved for the banner's ANIMATED sweep). The mock
// (forge-screens.jsx:454-461) renders the set-row trophy as a
// `linear-gradient(135deg, gradFrom, gradTo)` circle with a white trophy glyph.
//
// CRITICAL — NativeWind 4 box-decoration rule (project MEMORY / Pitfall 6,
// root cause of the Phase 10 "naked re-skin"): bg / border / radius / size go
// in `className`, NEVER in an inline `style()` callback (box props render NAKED
// under NativeWind 4). Here the gradient FILL is owned by <LinearGradient>
// (which legitimately takes colors as props — it is not a NativeWind box), and
// the ROUNDING + SIZE live in className (`rounded-full` + `w-…/h-…` via the
// size prop mapped to a style is unavoidable for a dynamic numeric size, so the
// circle uses an explicit width/height/borderRadius in the LinearGradient
// `style` — this is the gradient component's own sizing, NOT a NativeWind View,
// so the Pitfall-6 footgun does not apply to it). The wrapper stays minimal.
//
// References:
//   - .planning/phases/13-pr-celebration-f18/13-UI-SPEC.md (Trophy size ladder
//     36/24/18; Color §2 set-row trophy)
//   - app/app/(app)/(tabs)/index.tsx:212-230 (the brand-gradient tile precedent)
//   - app/components/ui/Icon.tsx (the `trophy` glyph, strokeWidth API)

import { useColorScheme } from "nativewind";
import { LinearGradient } from "expo-linear-gradient";

import { Icon } from "@/components/ui/Icon";

// Brand gradient endpoints — verbatim from THEMES.forge (lib.jsx:253-254 /
// :273-274) and the live brand-mark tile (index.tsx:98-99 / :111-112). gradFrom
// is shared across light/dark; gradTo differs (#FF3D5E light / #FF2D55 dark).
const GRAD = {
  light: { from: "#FF7A2E", to: "#FF3D5E" },
  dark: { from: "#FF7A2E", to: "#FF2D55" },
} as const;

export type PrTrophyProps = {
  /** Circle diameter in px. 24 = set-row / history (default); 18 = session
   *  detail; 36 = banner tile (the banner passes its own). Glyph scales to
   *  ~half the circle, matching the mock ladder (24→12, 36→18, 18→~10). */
  size?: number;
  /** Override the trophy glyph stroke (mock uses 2.2 everywhere). */
  strokeWidth?: number;
};

export function PrTrophy({ size = 24, strokeWidth = 2.2 }: PrTrophyProps) {
  const { colorScheme } = useColorScheme();
  const grad = GRAD[colorScheme === "dark" ? "dark" : "light"];
  // Glyph ≈ half the circle (mock: 24→12, 36→18, 18→10 ≈ 0.5×, rounded).
  const glyph = Math.round(size * 0.5);

  return (
    <LinearGradient
      colors={[grad.from, grad.to]}
      // 135° = top-left → bottom-right (matches the mock + the brand-mark tile).
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2, // full circle
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <Icon name="trophy" size={glyph} color="#FFFFFF" strokeWidth={strokeWidth} />
    </LinearGradient>
  );
}

export default PrTrophy;
