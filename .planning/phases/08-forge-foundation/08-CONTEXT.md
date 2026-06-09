# Phase 8: Forge Foundation - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Land the design-system bedrock every later v2.0 screen inherits — Forge color tokens (light + dark), the custom type system, the react-i18next scaffold, and the core component library — with **zero screen-behavior change**. No real/production screen is re-skinned in this phase; only the foundation those re-skins (Phases 9–15) consume is built, plus a dev-only gallery to prove it.

**In scope:** DSGN-01..06 (tokens, fonts, tabular numerals, component library, Skia ProgressRing/Sparkline, Ascend Logo/AppIcon components), I18N-01 (text renders from translation resources), I18N-04 (locale-aware number/date formatting).

**Out of scope (own phases):** any production-screen re-skin (Phases 9–12), the real iOS app-icon/splash asset swap, mount/draw animations for the ring + chart (Phase 12 / MOTN-02/03), the sweep of existing hardcoded Swedish literals into `t()` (Phase 11/15 per ARCHITECTURE.md).
</domain>

<decisions>
## Implementation Decisions

### Component library
- **D-01:** Build the requirement-named set — `ForgeButton`, `ForgeField`, `ForgeCard`, `ForgeStat` (DSGN-04), `ProgressRing`, `Sparkline` (DSGN-05), `Logo`, `AppIcon` (DSGN-06) — **plus** the foundational shared pieces every later re-skin clearly needs: `ForgeChip`, `SettingsRow`, and a re-skinned **TabBar shell**. All three already exist in `lib.jsx`. Goal: build once now, minimize per-screen rework in Phases 9–12. Still no production-screen behavior change.
- **D-02:** Expose component variants/sizes via **explicit props** (e.g. `ForgeButton variant='primary'|'secondary'|'ghost'`, `size='lg'|'md'`), not className-only passthrough. Predictable, token-driven, matches how `forge-screens.jsx` consumes them. Derive the exact variant/size enums from actual usage in `forge-screens.jsx`.
- **D-03:** `Logo`/`AppIcon` ship as token-driven **components only** this phase (gradient + white variants, shown in the gallery). Do **not** swap the real `app.json` app-icon/splash asset yet — deferred to a later polish step to keep Phase 8 to "no app-shell change" and avoid native asset-regen risk.

### Fonts / type system
- **D-04:** Bundle **Inter Display Regular + SemiBold + Bold + JetBrains Mono Regular** — exactly the four files in ARCHITECTURE.md §2. Body text stays System (iOS SF Pro). Display font drives headings + large numerals; mono drives weight/reps/chart-axis/set-number cells; stat numerals use tabular-nums (`tnum`/`ss01`) per DSGN-03.
- **D-05:** Fallback for any Inter Display weight that can't be sourced/loaded → the matching **standard Inter** weight (available via `@expo-google-fonts/inter`, zero manual sourcing). Keeps the Inter look; only the Display optical-size refinement is lost. Standard Inter is preferred over the roadmap's Inter-Tight suggestion as the safer, more-available substitute. This is on top of the architecture's fail-open splash gate (`catch(() => setFontsReady(true))`).

### Verification surface
- **D-06:** Prove the foundation via a **dedicated dev-only gallery route** (e.g. `app/(app)/_forge-gallery.tsx`) rendering all token swatches, the font scale, `ProgressRing`, `Sparkline`, and an sv↔en toggle. Gated out of normal navigation; **kept in the repo** as a living reference for Phases 9–15 and the manual UAT surface. Not a temporary throwaway.
- **D-07:** Verification is **manual device UAT in Expo Go** (consistent with v1 phase sign-offs) — the gallery *is* the test surface. No automated render-test is added (RN component testing isn't in the stack).

### Skia primitives
- **D-08:** `ProgressRing` and `Sparkline` are built as **static** Skia primitives this phase (DSGN-05 only requires they render via the installed Skia — no new charting dependency). Mount/draw animations are explicit Phase 12 success criteria (MOTN-02/03) and are built when the dashboard consumes them.

### i18n scaffold
- **D-09:** Transcribe the **full `I18N.sv` / `I18N.en` object** from `lib.jsx` into `locales/sv.json` + `locales/en.json` this phase (function-valued strings → `{{n}}` interpolations, e.g. `setsSavedBody`, `pbSub`, `noSetsBody`). It's a complete ready-made map; doing it once means Phases 9–15 just call `t()` against keys that already exist. The gallery flips a sample string to satisfy success criterion 4.
- **D-10:** Use **flat keys mirroring the `I18N` object 1:1** (`signIn`, `myPlans`, `lastTrained`…) in a **single default namespace**. Zero transformation, easiest sv↔en completeness diff in Phase 15. No nested namespaces.

### Claude's Discretion
- Exact `variant`/`size` enum values per component — derive from `forge-screens.jsx` usage (D-02).
- Token block mechanics in `tailwind.config.js` — already specified by ARCHITECTURE.md §1 (flat `forge.*` colors + opacity-modifier syntax for rgba tokens, `fontFamily` + `borderRadius` extends); planner follows that.
- `FontBootstrap`/`LocaleBootstrap`/`useFontStore` wiring + splash-gate changes — already specified by ARCHITECTURE.md §2/§7; planner follows that.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design source of truth (read first)
- `app/design v2/Sources/design/lib.jsx` — **THE token + i18n + primitive source of truth.** `THEMES.forge` (mirror into `tailwind.config.js`), the full `I18N.sv`/`I18N.en` string map (transcribe to locales), and reference implementations of `ProgressRing`, `Sparkline`, `FullChart`, `Logo`, `AppIcon`, `TabBar`, `numStyle` (tabular nums).
- `app/design v2/Sources/design/forge-screens.jsx` — all 17 reference screens; the authoritative source for component **variant/size API** and how each primitive is actually used.
- `app/design v2/Sources/design/Forge Design Spec.html` — annotated spec, sections 01–09 (scope by section if too large, e.g. 02 colors, 05 components).
- `app/design v2/Sources/design/README.md` — migration order (section 09) + "what is NOT a brand change" (barbell stays a content icon; Ascend is brand-only).

### Architecture & stack (locked decisions — do not re-derive)
- `.planning/research/ARCHITECTURE.md` — §1 token migration (`forge.*` flat tokens + opacity modifiers), §2 font loading (`FontBootstrap` + `useFontStore` + splash gate, fail-open), §7 i18n (react-i18next + expo-localization, `lib/i18n.ts`, `locales/*.json`), and the Phase 8 file list (§ "Phase 8 — Foundation").
- `.planning/research/STACK.md` — pinned versions (NativeWind 4.2 + Tailwind 3 only, Skia 2.2.12 already installed, expo-font, no new charting dep).
- `.planning/research/PITFALLS.md` — Tailwind-v4-breaks-NativeWind pitfall (stay on Tailwind 3).

### Phase definition
- `.planning/ROADMAP.md` → "Phase 8: Forge Foundation" — goal, 4 success criteria, and the research flags (font sourcing; Inter-Tight fallback note — superseded by D-05).
- `.planning/REQUIREMENTS.md` → DSGN-01..06, I18N-01, I18N-04 rows.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/tailwind.config.js` — empty `theme.extend: {}`, `darkMode: "class"`, NativeWind preset. Extend with `forge.*` colors + `fontFamily` (display/mono) + `borderRadius` (`forge-sm/md/lg/xl`). Existing `bg-gray-*`/`text-blue-*` classes coexist untouched.
- `app/app/_layout.tsx` — load-bearing ordering: `SplashScreen.preventAutoHideAsync()` → `PersistQueryClientProvider` → `ThemeBootstrap` + `SplashScreenController` + `RootNavigator`. Add `FontBootstrap` (and `LocaleBootstrap`) as siblings; extend the splash gate to wait on `fontsReady` AND `localeReady` AND auth.
- `app/lib/auth-store.ts`, `app/lib/persistence-store.ts` — existing Zustand slices; pattern to follow for the tiny new `app/lib/font-store.ts` (`fontsReady`, `setFontsReady`; no persistence).
- `app/components/` — existing `active-session-banner.tsx`, `offline-banner.tsx`, `segmented-control.tsx`. New primitives go in a `components/ui/` dir.
- `app/global.css`, `app/metro.config.js`, `app/babel.config.js` — NativeWind/Reanimated wiring already in place.

### Established Patterns
- **Dark/light flip** already wired (`darkMode: "class"` + NativeWind `useColorScheme`); every new component uses the `dark:` variant — no theming infra change.
- **Skia already installed** (`@shopify/react-native-skia@2.2.12`) + Victory Native XL from v1 Phase 6 — `ProgressRing`/`Sparkline` use installed Skia, no new charting dependency (DSGN-05).
- **AsyncStorage prefs** convention (`fm:theme`, `fm:language`, `fm:notifications`) — `LocaleBootstrap` reads `fm:language` and calls `i18n.changeLanguage()` before the splash clears.

### Integration Points
- `tailwind.config.js` ← `THEMES.forge` tokens.
- `app/_layout.tsx` ← `FontBootstrap` + `LocaleBootstrap` + module-scope `import '@/lib/i18n'`.
- `app/assets/fonts/` ← Inter Display (R/SB/B) + JetBrains Mono (R) files.
- New: `app/lib/i18n.ts`, `app/lib/font-store.ts`, `app/locales/{sv,en}.json`, `app/components/ui/*`, `app/(app)/_forge-gallery.tsx` (dev-only).
- **F13 risk: NONE** — everything in this phase is presentational/additive; no mutation defaults, query keys, or persister are touched. `npm run test:f13-brutal` must stay green.
</code_context>

<specifics>
## Specific Ideas

- The `I18N` object in `lib.jsx` is a complete, ready-made bilingual string map — transcribe directly, don't author new copy.
- Apple-Fitness DNA direction: pure-black / warm-off-white parity, single bright orange accent (`#FF5A1F` dark / `#E14E10` light), Ascend logo. Keep the barbell icon as a *content* icon (plan cards + Planer tab), Ascend as the brand mark only (per README).
- Stat numerals must align — use tabular-nums (`numStyle` in lib.jsx: `fontVariantNumeric: 'tabular-nums'`, `fontFeatureSettings: '"tnum","ss01"'`).
</specifics>

<deferred>
## Deferred Ideas

- **Real iOS app-icon + splash asset swap** (gradient squircle, on-brand home-screen presence) — DSGN-06 is satisfied this phase by the `Logo`/`AppIcon` *components*; the actual `app.json`/native asset replacement is a later polish step.
- **ProgressRing/Sparkline mount + draw animations** — Phase 12 (MOTN-02/03: animated activity ring, chart draws on mount). Static primitives only in Phase 8.
- **Sweep of existing hardcoded Swedish literals → `t()`** — already scheduled for Phase 11/15 per ARCHITECTURE.md; Phase 8 only stands up the scaffold + full locale files. New strings introduced in Phases 8–10 go straight through `t()`.
- **Automated RN render/smoke test for the component gallery** — considered, deferred (no RN component-testing harness in the stack); manual device UAT covers Phase 8.

</deferred>

---

*Phase: 8-Forge Foundation*
*Context gathered: 2026-06-09*
