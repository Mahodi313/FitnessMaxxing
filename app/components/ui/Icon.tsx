// app/components/ui/Icon.tsx
//
// Phase 8 (Forge Foundation), Plan 08-03 — DSGN-06 / D-11.
// Shared stroke-based icon set ported 1:1 from the design source
//   app/design v2/Sources/design/lib.jsx  (Icon, line 381) — every `<path d="...">`
// string is transcribed verbatim into a react-native-svg `<Path d="...">`.
// (08-PATTERNS.md §Icon.tsx; 08-UI-SPEC.md §Icon; 08-RESEARCH.md §"Don't Hand-Roll".)
//
// Engine: react-native-svg (D-11) — chosen over Skia for the 30+ static stroke
// icons because `<Path d>` is a 1:1 transcription of the lib.jsx path strings
// (no SVG-string → Skia.Path parsing), and it is Expo-Go compatible.
//
// Contract (from lib.jsx Icon props): 24×24 viewBox, strokeLinecap/join="round",
// default size 20, default strokeWidth 1.8, default fill "none". `color` drives
// the stroke (the lib.jsx default 'currentColor' has no RN equivalent, so we
// default to a Forge text token hex — caller passes a token color at use-site).
//
// Brand discipline (08-UI-SPEC.md): the `barbell` icon is a CONTENT icon (plan
// cards, Planer tab). The Ascend mark is brand-only and lives in Logo/AppIcon —
// never render barbell in the brand gradient.

import Svg, { Path, Circle, Rect } from "react-native-svg";

// Name enum — verbatim from 08-UI-SPEC.md §Icon / lib.jsx Icon switch.
export type IconName =
  | "barbell"
  | "ascend"
  | "flame"
  | "clock"
  | "chart"
  | "settings"
  | "plus"
  | "check"
  | "checkCircle"
  | "chevronRight"
  | "chevronLeft"
  | "chevronDown"
  | "ellipsis"
  | "close"
  | "grip"
  | "play"
  | "pause"
  | "trash"
  | "pencil"
  | "spark"
  | "trophy"
  | "user"
  | "bell"
  | "globe"
  | "scale"
  | "arrowUp"
  | "arrowRight"
  | "wifi"
  | "wifiOff"
  | "eye"
  | "lock"
  | "mail"
  | "list";

export type IconProps = {
  name: IconName;
  size?: number;
  /** Stroke color. Pass a Forge token color at the use-site (default = light-text token hex). */
  color?: string;
  strokeWidth?: number;
  fill?: string;
};

export function Icon({
  name,
  size = 20,
  color = "#0A0A0A",
  strokeWidth = 1.8,
  fill = "none",
}: IconProps) {
  // Shared stroke props (lib.jsx Icon `props` object, line 382).
  const stroke = {
    stroke: color,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const svg = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill,
  };

  switch (name) {
    case "barbell":
      return (
        <Svg {...svg}>
          <Path d="M2 12h2M20 12h2M5 8v8M19 8v8M8 6v12M16 6v12M8 12h8" {...stroke} fill="none" />
        </Svg>
      );
    case "ascend":
      return (
        <Svg {...svg}>
          <Path
            d="M4 20v-6.5Q4 11.5 5.5 11.5L7.5 11.5Q9 11.5 9 13.5L9 20M14 20V7Q14 5 15.5 5L17.5 5Q19 5 19 7L19 20"
            {...stroke}
            fill="none"
          />
          <Circle cx="21" cy="5.4" r="1.7" fill={color} stroke="none" />
        </Svg>
      );
    case "flame":
      return (
        <Svg {...svg}>
          <Path
            d="M12 22c4 0 7-3 7-7 0-3-2-5-3-7-1 2-2 3-4 3 0-2 1-4 1-6 0-2-2-3-3-3 .5 4-4 5-4 11 0 5 2 9 6 9z"
            {...stroke}
            fill="none"
          />
        </Svg>
      );
    case "clock":
      return (
        <Svg {...svg}>
          <Circle cx="12" cy="12" r="9" {...stroke} fill="none" />
          <Path d="M12 7v5l3 2" {...stroke} fill="none" />
        </Svg>
      );
    case "chart":
      return (
        <Svg {...svg}>
          <Path d="M3 20h18M6 16V9M11 16V5M16 16v-7M21 16v-3" {...stroke} fill="none" />
        </Svg>
      );
    case "settings":
      return (
        <Svg {...svg}>
          <Circle cx="12" cy="12" r="3" {...stroke} fill="none" />
          <Path
            d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
            {...stroke}
            fill="none"
          />
        </Svg>
      );
    case "plus":
      return (
        <Svg {...svg}>
          <Path d="M12 5v14M5 12h14" {...stroke} fill="none" />
        </Svg>
      );
    case "check":
      return (
        <Svg {...svg}>
          <Path d="M4 12l5 5L20 6" {...stroke} fill="none" />
        </Svg>
      );
    case "checkCircle":
      // lib.jsx renders this filled (fill={color} stroke="none").
      return (
        <Svg {...svg} fill={color}>
          <Path
            d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 14.4l-4-4 1.4-1.4L11 13.6l5.6-5.6L18 9.4l-7 7z"
            fill={color}
            stroke="none"
          />
        </Svg>
      );
    case "chevronRight":
      return (
        <Svg {...svg}>
          <Path d="M9 6l6 6-6 6" {...stroke} fill="none" />
        </Svg>
      );
    case "chevronLeft":
      return (
        <Svg {...svg}>
          <Path d="M15 6l-6 6 6 6" {...stroke} fill="none" />
        </Svg>
      );
    case "chevronDown":
      return (
        <Svg {...svg}>
          <Path d="M6 9l6 6 6-6" {...stroke} fill="none" />
        </Svg>
      );
    case "ellipsis":
      return (
        <Svg {...svg} fill={color}>
          <Circle cx="5" cy="12" r="2" fill={color} stroke="none" />
          <Circle cx="12" cy="12" r="2" fill={color} stroke="none" />
          <Circle cx="19" cy="12" r="2" fill={color} stroke="none" />
        </Svg>
      );
    case "close":
      return (
        <Svg {...svg}>
          <Path d="M6 6l12 12M18 6L6 18" {...stroke} fill="none" />
        </Svg>
      );
    case "grip":
      return (
        <Svg {...svg} fill={color}>
          <Circle cx="9" cy="6" r="1.4" fill={color} stroke="none" />
          <Circle cx="9" cy="12" r="1.4" fill={color} stroke="none" />
          <Circle cx="9" cy="18" r="1.4" fill={color} stroke="none" />
          <Circle cx="15" cy="6" r="1.4" fill={color} stroke="none" />
          <Circle cx="15" cy="12" r="1.4" fill={color} stroke="none" />
          <Circle cx="15" cy="18" r="1.4" fill={color} stroke="none" />
        </Svg>
      );
    case "play":
      return (
        <Svg {...svg} fill={color}>
          <Path d="M8 5l12 7-12 7V5z" fill={color} stroke="none" />
        </Svg>
      );
    case "pause":
      return (
        <Svg {...svg} fill={color}>
          <Rect x="6" y="5" width="4" height="14" rx="1" fill={color} stroke="none" />
          <Rect x="14" y="5" width="4" height="14" rx="1" fill={color} stroke="none" />
        </Svg>
      );
    case "trash":
      return (
        <Svg {...svg}>
          <Path
            d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
            {...stroke}
            fill="none"
          />
        </Svg>
      );
    case "pencil":
      return (
        <Svg {...svg}>
          <Path d="M17 3l4 4-12 12H5v-4L17 3z" {...stroke} fill="none" />
        </Svg>
      );
    case "spark":
      return (
        <Svg {...svg}>
          <Path
            d="M12 3v4M12 17v4M5 12H1M23 12h-4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"
            {...stroke}
            fill="none"
          />
        </Svg>
      );
    case "trophy":
      return (
        <Svg {...svg}>
          <Path
            d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4zM5 4H3v2a3 3 0 0 0 3 3M19 4h2v2a3 3 0 0 1-3 3"
            {...stroke}
            fill="none"
          />
        </Svg>
      );
    case "user":
      return (
        <Svg {...svg}>
          <Circle cx="12" cy="8" r="4" {...stroke} fill="none" />
          <Path d="M4 21a8 8 0 0 1 16 0" {...stroke} fill="none" />
        </Svg>
      );
    case "bell":
      return (
        <Svg {...svg}>
          <Path
            d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0"
            {...stroke}
            fill="none"
          />
        </Svg>
      );
    case "globe":
      return (
        <Svg {...svg}>
          <Circle cx="12" cy="12" r="9" {...stroke} fill="none" />
          <Path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" {...stroke} fill="none" />
        </Svg>
      );
    case "scale":
      return (
        <Svg {...svg}>
          <Path
            d="M12 3v18M5 9l7-6 7 6M5 9l-3 7a4 4 0 0 0 8 0L7 9zM19 9l3 7a4 4 0 0 1-8 0l3-7z"
            {...stroke}
            fill="none"
          />
        </Svg>
      );
    case "arrowUp":
      return (
        <Svg {...svg}>
          <Path d="M12 19V5M5 12l7-7 7 7" {...stroke} fill="none" />
        </Svg>
      );
    case "arrowRight":
      return (
        <Svg {...svg}>
          <Path d="M5 12h14M12 5l7 7-7 7" {...stroke} fill="none" />
        </Svg>
      );
    case "wifi":
      return (
        <Svg {...svg}>
          <Path d="M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01" {...stroke} fill="none" />
        </Svg>
      );
    case "wifiOff":
      return (
        <Svg {...svg}>
          <Path
            d="M2 2l20 20M8.5 15.5a5 5 0 0 1 6 0M5 12a10 10 0 0 1 5-2.7M19 12a10 10 0 0 0-4.7-2.6M12 19h.01"
            {...stroke}
            fill="none"
          />
        </Svg>
      );
    case "eye":
      return (
        <Svg {...svg}>
          <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" {...stroke} fill="none" />
          <Circle cx="12" cy="12" r="3" {...stroke} fill="none" />
        </Svg>
      );
    case "lock":
      return (
        <Svg {...svg}>
          <Rect x="4" y="11" width="16" height="11" rx="2" {...stroke} fill="none" />
          <Path d="M8 11V7a4 4 0 0 1 8 0v4" {...stroke} fill="none" />
        </Svg>
      );
    case "mail":
      return (
        <Svg {...svg}>
          <Rect x="2" y="5" width="20" height="14" rx="2" {...stroke} fill="none" />
          <Path d="M2 7l10 7L22 7" {...stroke} fill="none" />
        </Svg>
      );
    case "list":
      return (
        <Svg {...svg}>
          <Path
            d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
            {...stroke}
            fill="none"
          />
        </Svg>
      );
    default:
      // lib.jsx default branch — a bare circle.
      return (
        <Svg {...svg}>
          <Circle cx="12" cy="12" r="9" {...stroke} fill="none" />
        </Svg>
      );
  }
}

export default Icon;
