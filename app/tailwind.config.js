/** @type {import('tailwindcss').Config} */
//
// Phase 8 (Forge Foundation), Plan 08-02. The `forge.*` block below mirrors the
// LOCKED `THEMES.forge` palette VERBATIM from
//   app/design v2/Sources/design/lib.jsx (lines 236-276).
// It is the single source of truth for every Forge primitive's colors, type
// families and corner radii (DSGN-01). Values are transcribed 1:1 — do not
// re-derive (08-PATTERNS.md §tailwind.config.js, 08-RESEARCH.md Pattern 1).
//
// darkMode/content/presets are UNCHANGED — only `theme.extend` grows. Existing
// v1 `bg-gray-*`/`text-blue-*` classes coexist with the new `forge.*` tokens.
//
// OQ-3 (the most error-prone part — RESEARCH Pitfall 4): the secondary-text /
// border / accentSoft tokens are opacity-of-white in DARK mode but SOLID hex in
// LIGHT mode (e.g. light text2 = #4D4D4D, a warm-gray, NOT black @62%). So each
// such token carries BOTH a DEFAULT (dark) value AND a `light` solid-hex value,
// and consumers flip with `dark:`/light classes. The DEFAULT (dark) values are
// kept as rgba strings so `forge-text2` round-trips the true dark color; dark
// secondary text MAY ALSO be expressed at use-site via the opacity modifier
// (e.g. `text-forge-text/62`) — the solid token exists so LIGHT mode is correct.
//
// OQ-4 (RN does not synthesize weights — RESEARCH Pitfall 3): the 3 Inter Display
// weights are 3 SEPARATE fontFamily classes (`font-display`, `font-display-semibold`,
// `font-display-bold`). Family names MUST match the Font.loadAsync keys in
// app/app/_layout.tsx. Body text stays System (D-04).
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        forge: {
          // Solid-hex tokens — verbatim from THEMES.forge (DEFAULT = dark, light = light).
          bg: { DEFAULT: "#000000", light: "#FAFAF7" },
          surface: { DEFAULT: "#0E0E10", light: "#FFFFFF" },
          surface2: { DEFAULT: "#18181B", light: "#F2F1EC" },
          surface3: { DEFAULT: "#222226", light: "#E8E7E1" },
          text: { DEFAULT: "#FFFFFF", light: "#0A0A0A" },
          accent: { DEFAULT: "#FF5A1F", light: "#E14E10" },
          accentText: { DEFAULT: "#FFFFFF", light: "#FFFFFF" },
          success: { DEFAULT: "#30D158", light: "#1E9E45" },
          warn: { DEFAULT: "#FFD60A", light: "#B68000" },
          danger: { DEFAULT: "#FF453A", light: "#D70015" },
          gradFrom: { DEFAULT: "#FF7A2E", light: "#FF7A2E" },
          gradTo: { DEFAULT: "#FF2D55", light: "#FF3D5E" },
          // OQ-3 — rgba-in-dark / solid-hex-in-light tokens. DEFAULT keeps the
          // true dark rgba so `forge-text2` etc. resolve correctly in dark mode;
          // `light` is the solid warm-gray hex so LIGHT mode is correct. Use
          // `dark:`/light class pairs at use-site (the opacity modifier
          // `text-forge-text/62` only round-trips for DARK mode).
          text2: { DEFAULT: "rgba(255,255,255,0.62)", light: "#4D4D4D" },
          text3: { DEFAULT: "rgba(255,255,255,0.38)", light: "#8B8B8B" },
          border: { DEFAULT: "rgba(255,255,255,0.08)", light: "rgba(0,0,0,0.07)" },
          borderStrong: {
            DEFAULT: "rgba(255,255,255,0.14)",
            light: "rgba(0,0,0,0.14)",
          },
          accentSoft: {
            DEFAULT: "rgba(255,90,31,0.14)",
            light: "rgba(225,78,16,0.10)",
          },
          // TabBar shell backdrop (Plan 04) — translucent in both themes.
          tabBg: {
            DEFAULT: "rgba(20,20,22,0.85)",
            light: "rgba(255,255,255,0.85)",
          },
        },
      },
      fontFamily: {
        // OQ-4 — 3 SEPARATE Inter Display families (RN does not synthesize
        // weights). Names MUST match the Font.loadAsync keys in _layout.tsx.
        // Fallbacks: standard Inter → System (D-05 per-weight fail-open).
        display: ["InterDisplay", "Inter", "System"],
        "display-semibold": ["InterDisplay-SemiBold", "Inter", "System"],
        "display-bold": ["InterDisplay-Bold", "Inter", "System"],
        mono: ["JetBrainsMono", "Menlo"],
      },
      borderRadius: {
        // lib.jsx THEMES.forge.radius — sm/md/lg/xl.
        "forge-sm": "10px",
        "forge-md": "14px",
        "forge-lg": "20px",
        "forge-xl": "28px",
      },
    },
  },
  plugins: [],
};
