# FitnessMaxxing V2 — Forge design handoff

This folder is the design spec for the V2 (App Store) redesign. Direction: **Forge**
— premium, Apple-Fitness DNA, pure-black / warm-off-white parity, single orange
accent, "Ascend" logo. Built dark + light, Swedish + English.

## Files

| File | What it is | Use it for |
|---|---|---|
| `lib.jsx` | Design tokens (`THEMES.forge`), i18n strings (SV + EN), icon set, `Logo`/`AppIcon`, `ProgressRing`, `Sparkline`, `FullChart` | **Source of truth for tokens.** Mirror `THEMES.forge` into `tailwind.config.js`. |
| `forge-screens.jsx` | All 17 screens as React components (`FSignIn`, `FHome`, `FWorkout`, …) | Reference layout/structure when migrating each RN screen. |
| `Forge Design Spec.html` | The annotated spec page (sources referenced) | Read the section annotations + Android notes + implementation map. |
| `Forge Design Spec — view in browser.html` | Self-contained version | Double-click to view in a browser, no build step. |

## How to point Claude Code at it

Drop this `design/` folder into your repo (e.g. `app/docs/design/`), then:

```
claude "Read docs/design/lib.jsx → THEMES.forge. Mirror its colors, radius
and font tokens into tailwind.config.js, replacing the stock blue/gray scale."
```

```
claude "Read FHome in docs/design/forge-screens.jsx. Migrate
app/(app)/(tabs)/index.tsx to match — keep all existing TanStack Query logic
and offline behaviour, only change JSX structure + NativeWind classes."
```

If a file feels too big, scope it: "read section 02 (colors) and 05 (components)
of Forge Design Spec.html" — sections are numbered 01–09.

## Migration order (from spec section 09)

1. `tailwind.config.js` — tokens
2. `app/_layout.tsx` — load Inter Display + Inter + JetBrains Mono via expo-font
3. `components/` — ForgeButton, ForgeField, ForgeCard, ProgressRing, Sparkline, Logo
4. `active-session-banner.tsx` — re-skin
5. tab screens + workout — swap stock blue/gray for tokens, lift headings to Display scale
6. PR celebration banner in `workout/[sessionId].tsx`
7. Activity ring on Home (Skia — already in your stack)
8. i18n: pull Swedish copy into `sv.json`, mirror to `en.json`

## What is NOT a brand change

The barbell icon stays as a **content** icon (plan cards) and the "Planer"
tab-bar icon. The Ascend mark is the brand logo only.
