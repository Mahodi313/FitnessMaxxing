# Phase 11: Active Workout Re-skin (HIGH RISK — F13) - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Re-skin the **hot-path active-workout screen** (`app/app/(app)/workout/[sessionId].tsx`) and its **three inline overlays** to the Forge design, and add the set-logged motion + haptic — **without touching the offline-queue mutation path or regressing the ≤3s "never lose a set" budget (F13)**.

**Screens / surfaces in scope:**
- **Active-workout screen** (`workout/[sessionId].tsx`) — header, exercise cards, logged-set list, set-input row, per-card set-progress dots, defensive empty-state.
- **Finish/Avsluta overlay** — lives *inside* the workout screen (`AvslutaOverlay`).
- **Draft-resume overlay** + **saved-toast** ("Passet sparat") — both live in **`app/app/(app)/(tabs)/index.tsx`**, which Phase 10 re-skinned the *chrome* of but explicitly **left these two overlays verbatim** (`tabs/index.tsx` lines 25-27). Phase 11 reaches back into that file to re-skin only those two overlays + the toast.

**In scope:** SKIN-04, SKIN-05, MOTN-01, MOTN-04, MOTN-05. (SKIN-08 / F13 no-regression is a standing constraint, already marked Complete.)

**Out of scope (own phases — do NOT build here):**
- **PR celebration banner + per-set trophy markers** — the Forge `FWorkout`/`FFinishOverlay` mocks show them, but PR detection (PR-01..05, e1RM/Epley) is **Phase 13 (F18)**. Phase 11 **omits them entirely** (all sets render the plain success check). See D-06 + Deferred Ideas.
- **Active-session-banner re-skin** — **already done in Phase 10** (commit 78c6132, design spec §04: live timer + plan + progress). SKIN-05 lists the banner, but it is **carried-forward-complete**; Phase 11 only *verifies* it, does not rebuild it.
- **Home activity-ring dashboard** — Phase 12 (DASH-01..05).
- **Rest timer** — Phase 14.
- **Mutation/offline-queue internals** — `useAddSet/useUpdateSet/useRemoveSet`, `setMutationDefaults`, persister, scope-binding, `useFinishSession` — **untouched**. This is a *presentational* re-skin over a frozen write path.

</domain>

<decisions>
## Implementation Decisions

### Layout model (SKIN-04)
- **D-01:** **Keep the all-exercises vertical scroll, apply the Forge skin** — do NOT adopt the mock's single-exercise paginated model. The current proven interaction (one `ScrollView` of stacked exercise cards) is the lowest-F13-risk path; the mock's "Övning 1/6" framing, single-exercise focus, and "Up next" card are **dropped** as redundant in a full scroll. Each card adopts the mock's visual treatment (set-table + dots + input-row) but the screen stays scroll-of-all-cards.
- **D-02:** **Per-card set-progress dots** replace the current `"3/4 set klart"` counter chip — each exercise card carries the mock's done/current/remaining progress bars (FWorkout lines 373-387). This satisfies SKIN-04's "progress dots" requirement. The global "Exercise N/6" label and the between-cards "Up next" hint are **not** rendered (D-01).

### Logged-set list rendering (SKIN-04)
- **D-03:** **Forge structured set-table** (`# | weight | reps | RPE | check`, set-number badge, display-font numerals with `kg` unit suffix) per FWorkout lines 415-466 — replaces the current individual row components.
- **D-04:** **Explicit edit/delete affordances replace swipe-to-delete.** **Tap row = enter inline edit** (preserves the v1 `EditableSetRow` flow); a **trailing ✕ (delete) icon per row** replaces the `ReanimatedSwipeable` swipe-left gesture. Discoverable, fits the grid, preserves the ≤3s edit/delete flow. *(Recommended by Claude after user chose "you decide" on the affordance shape.)*
- **D-05:** **RPE column is always rendered**, showing a muted `–` (or blank) when the set has no RPE value — consistent grid across exercises, matches the mock. (Do NOT collapse the column per-exercise.)

### Design extras — what's in vs out (SKIN-04 / SKIN-05)
- **D-06:** **PR celebration banner + per-set trophy markers are OMITTED entirely** (no banner, no trophy column; all sets show the plain `checkCircle` success icon). Phase 13 introduces the markup when it adds PR detection. No inert/scaffolded PR slots — no dead UI. *(User resolved an initial omit-vs-scaffold contradiction in favor of full omission.)*
- **D-07:** **Add the live header timer** (`42:18`) to the workout header — reuse the active-session-banner's `formatElapsed(...)` + `started_at` logic (`app/components/active-session-banner.tsx`). Display-font / tabular-nums, accent pill per FWorkout lines 345-354.
- **D-08:** **Add the finish-overlay stats row** (total **sets** / total **volume kg** / **duration min**) to the Avsluta/finish overlay, per `FFinishOverlay` lines 1652-1657 (`FFOStat`). Stats are computed client-side from the session's logged sets (sets count, Σ weight×reps, elapsed since `started_at`).

### Header chrome (SKIN-04)
- **D-09:** **Custom in-content Forge header; hide the native Stack header** (`headerShown: false`). Render the mock's header: **circular back button (left) + live timer pill (center, D-07) + accent "Avsluta/Finish" button (right)** per FWorkout lines 341-360. The custom header owns its safe-area inset and back-navigation. (Replaces the current `Stack.Screen` `headerShown:true` + `title:"Pass"` + `Avsluta` headerRight.)

### Set-input row (SKIN-04)
- **D-10:** **Adopt the mock's input-row exactly** — tall (56px) accent-bordered `ForgeInput` fields, **large display-font value with a small uppercase unit label underneath** (KG / REPS / RPE), and a **full-width accent "Klart/Done" button with a check icon** per FWorkout lines 468-495 + `ForgeInput` lines 526-545. **MUST preserve** the v1 keyboard wiring: `decimal-pad`/`number-pad`, `inputMode`, `selectTextOnFocus`, `returnKeyType:"done"`, `mode:"onSubmit"` RHF, and the prefill logic (session-prefill → F7 fallback) — so the ≤3s log flow survives.

### Motion & haptics (MOTN-01 / MOTN-04 / MOTN-05)
- **D-11:** **Implement the full spec §07 motion table** (gated behind `fm:haptics` for the haptic component — Phase 9 D-08, default on):
  - **Set logged (MOTN-01):** logged row **slides in from bottom + check icon scales 0.8→1 + haptic `impactMedium`**. Must not breach the ≤3s budget — animation is fire-and-forget, never blocks the optimistic write.
  - **Overlay open (MOTN-04):** **backdrop opacity 0→0.5 + card translateY 24→0, spring** (≈240ms; default curve **damping 18, stiffness 220**) — applied to the Avsluta, draft-resume, and saved-toast overlays, all staying **inline-rendered (no modal portals)**.
  - **PR-celebration animation row is EXCLUDED** (Phase 13, per D-06).
- **D-12:** **MOTN-05 — haptics respect the `fm:haptics` toggle.** The new set-logged `impactMedium` call reads the `fm:haptics` pref (the Phase 9 gate this phase finally *adopts* on the workout screen — Phase 9 D-08 deferred existing/new haptic call-site gating to "Phases 11/12 during re-skin"). Reanimated visual animations are NOT gated (only the haptic feedback is).

### Empty-state (defensive)
- **D-13:** The plan-has-no-exercises defensive empty-state (`WorkoutBody`, reachable only if a plan's exercises were removed mid-pass) is **re-skinned to Forge tokens** (Forge icon/card, accent back button) **and i18n'd** (sv+en keys via `t()`) — consistent with D-14.

### i18n (carried convention)
- **D-14:** **Full i18n sweep of every string the workout screen + the three overlays render.** The workout screen currently has **hardcoded Swedish literals** (`"Pass"`, `"Avsluta"`, `"Vikt"`, `"Reps"`, `"Klart"`, `"Ta bort"`, `"Avsluta passet?"`, `"Inget set är loggat…"`, `"Återställer pass…"`, `"Laddar…"`, empty-state copy, etc.). All get **sv+en keys added to `app/locales/{sv,en}.json`** and routed through `t()` — same approach as Phase 9/10. (Phase 8 D-09 only transcribed `lib.jsx`'s `I18N` map, not these per-screen literals.)

### Carried-forward locks (do NOT re-derive or regress)
- **D-15:** **Inline-overlay pattern, never Modal portal** (Phase 4/5 + SKIN-05 explicit) — overlays use explicit RN styles on layout primitives (absolute scrim, flex), NativeWind for inner card content. The `AvslutaOverlay` keyboard-height handling (manual `Keyboard` listener + `paddingBottom = keyboardHeight + 16`, UAT 2026-05-16) MUST be preserved through the re-skin.
- **D-16:** **Avsluta primary button = accent (NOT red)** — finishing a pass is the intended terminal state, not data loss (PITFALLS §6.6). The **draft-resume "Avsluta sessionen / End session"** button **stays danger-colored** (FDraftResumeOverlay lines 1915-1922) because closing an orphaned draft IS data-loss-adjacent.
- **D-17:** **Mutation wiring untouched** — `useAddSet/useUpdateSet/useRemoveSet` stay scope-bound to `session:${sessionId}`, all use `mutate` (NOT `mutateAsync`, which doesn't resolve for paused offline mutations under `networkMode:'offlineFirst'`). `useFinishSession` payload (incl. `notes`) unchanged. The hydration gate, `useFocusEffect` cleanup, and `OfflineBanner` second instance are preserved.

### Claude's Discretion
- Exact edit/delete affordance pixel-placement and whether delete needs a confirm (logged-set delete is recoverable — likely no confirm, mirror v1).
- Exact Forge token/class choices per control — follow `THEMES.forge` + how `forge-screens.jsx` composes the primitives.
- Where the per-card progress-dots + counter sit relative to the card header.
- Reanimated implementation details (entering animation vs shared value) for the set-logged slide+scale, as long as it's non-blocking and respects the §07 spring curve.
- `t()` key namespace/names for the new per-screen strings (follow Phase 8 D-10 flat-key convention).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase definition
- `.planning/ROADMAP.md` → "Phase 11: Active Workout Re-skin (HIGH RISK — F13)" — goal + 4 success criteria (active-workout screen matches Forge with set log/input row/progress dots; the 3 overlays + banner match design and stay inline-rendered; logging a set plays animation + haptic with `npm run test:f13-brutal` green and ≤3s intact; haptics respect Settings toggle).
- `.planning/REQUIREMENTS.md` → rows **SKIN-04, SKIN-05, MOTN-01, MOTN-04, MOTN-05** (and the SKIN-08 / F13 standing constraint). Also note **PR-01..05 are Phase 13** (the reason PR markup is omitted — D-06).

### Design source of truth (read first)
- `app/design v2/Sources/design/forge-screens.jsx` — the in-scope reference components:
  - `FWorkout` (line 335) — header (341), set-progress dots (373), **PR banner (389) — OMIT per D-06**, logged-set table (415), input row (468). `ForgeInput` (line 526).
  - `FFinishOverlay` (line 1590) — finish/Avsluta overlay: trophy block, notes textarea + counter, **stats row `FFOStat` (1652/1684)**, accent Finish + ghost Continue buttons.
  - `FDraftResumeOverlay` (line 1817) — draft-resume: pulsing-dot icon, meta strip, accent "Återuppta/Resume" + **danger "Avsluta sessionen/End session"** (D-16).
  - `FSavedToast` (line 1931) — "Passet sparat / Workout saved" success pill, bottom-centered above tab bar.
  - `FActiveSessionBanner` (line 1706) — **reference only; already implemented Phase 10.**
- `app/design v2/Sources/design/lib.jsx` — `THEMES.forge` tokens, `numStyle` (tabular nums), `Icon` paths.
- `app/design v2/Sources/design/Forge Design Spec.html` → **§07 Motion & micro-interactions (line 525)** — the motion table (D-11): set-logged row/check/`impactMedium`, PR-celebration (excluded), overlay backdrop+card spring (240ms), default spring **damping 18 / stiffness 220**; and the iOS-port notes (haptics map to `Haptics.impactAsync`).
- `app/design v2/Sources/design/README.md` — migration order + brand vs content-icon rules.

### Architecture & stack (locked — do not re-derive)
- `.planning/research/ARCHITECTURE.md` — token system, fonts, §7 i18n (`react-i18next`, `lib/i18n.ts`, `t()`).
- `.planning/research/STACK.md` — pinned versions; **Reanimated 4 already in stack** (no new dep for the motion table), `expo-haptics` installed. No new charting dep.
- `.planning/research/PITFALLS.md` — §6.6 (finish button is accent not red); Tailwind-v4-breaks-NativeWind (stay on Tailwind 3).

### F13 / hot-path constraint (MUST verify, do not regress)
- `CLAUDE.md` → "Project / Constraints" — Core Value ("never lose a set"); ≤3s log budget; offline-first.
- `app/scripts/verify-f13-brutal-test.ts` — `npm run test:f13-brutal`. **NOTE: this is a DATABASE-integrity check** (verifies recently-logged sets persisted to Supabase with correct `set_count`), **not a UI/layout test** — so the D-01 layout re-skin does not break it mechanically. The real constraint is preserving the **mutation path (D-17)**. Run it green after the re-skin (log sets in-app, then run the script).

### Phase carry-forward (locked)
- `.planning/phases/08-forge-foundation/08-CONTEXT.md` — component library (`components/ui/*`), tokens, fonts, i18n scaffold, flat 1:1 i18n keys (D-10).
- `.planning/phases/09-auth-settings-preferences/09-CONTEXT.md` — **D-08 haptics gate** (`fm:haptics`, default on; existing call sites adopt the gate "during re-skin in Phases 11/12" — this phase does it). `fm:*` Zod-catch pref read pattern.
- `.planning/phases/10-plans-exercises-re-skin/10-CONTEXT.md` — live-`t()` re-skin precedent; the "Starta pass" CTA whose destination IS this screen.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/app/(app)/workout/[sessionId].tsx` — the screen to re-skin. Key components to restyle in place: `WorkoutScreen` (header + Avsluta overlay mount), `WorkoutBody` (scroll + empty-state), `ExerciseCard` (header/dots/set-table/input-row), `LoggedSetRow` (→ table row + ✕ delete, D-04), `EditableSetRow` (inline edit — preserve), `LastValueChip` (F7 "Förra:"), `AvslutaOverlay` (→ FFinishOverlay + stats, D-08), `formatTargetChip`.
- `app/components/active-session-banner.tsx` — **already Forge** (Phase 10); source of the `formatElapsed(ms)` + `started_at` timer logic to reuse for the in-screen header timer (D-07).
- `app/app/(app)/(tabs)/index.tsx` — hosts `DraftResumeOverlay` (subcomponent ~line 511) + the "Passet sparat" toast (state at ~line 115, render at ~line 476). Re-skin these two to `FDraftResumeOverlay` / `FSavedToast` — **the overlay/toast LOGIC (cold-start detection, prev-value ref, 2s timer) is offline-critical; restyle chrome only** (lines 25-27 warn this).
- `app/components/ui/*` (Phase 8) — `ForgeButton`, `ForgeCard`, `ForgeField/ForgeInput`-equivalent, `Icon`, tokens. Compose the re-skin from these (+ a workout set-table treatment).
- `app/lib/queries/sets.ts`, `app/lib/queries/sessions.ts` — `useAddSet/useUpdateSet/useRemoveSet/useFinishSession/useSetsForSessionQuery` — **call sites unchanged (D-17)**; finish-overlay stats (D-08) read from `useSetsForSessionQuery` data already in scope.
- `app/lib/i18n.ts`, `app/locales/{sv,en}.json` — add the per-screen workout/overlay keys (D-14).
- Settings `fm:haptics` read pattern (`app/app/(app)/(tabs)/settings.tsx` `getPref("fm:haptics")`) — reuse for the MOTN-01 haptic gate (D-12).

### Established Patterns
- **Inline-overlay (not Modal portal)** — absolute scrim + flex, explicit RN styles; NativeWind inner content. Backdrop-tap dismiss on Avsluta (recoverable); force-decision on draft-resume (orphan must be resolved). Preserve `AvslutaOverlay`'s manual keyboard-height lift.
- **Optimistic offline mutation** — `mutate` not `mutateAsync`; synchronous navigation after `finishSession.mutate`. Animation/haptic must be non-blocking.
- **Haptics gate** — `fm:haptics` (default on) via `getPref` Zod-catch read; gate only the haptic, not the visual animation.
- **Dark/light** via NativeWind `dark:` variants + Forge tokens — every re-skinned surface covers both.
- **Reanimated 4** already wired (`metro.config.js`/`babel.config.js`) — used today only for `ReanimatedSwipeable` (being replaced by ✕, D-04); now also drives the set-logged + overlay motion (D-11).

### Integration Points
- `workout/[sessionId].tsx` ← custom header (D-09, `headerShown:false`), per-card dots + set-table + input-row re-skin, ✕-delete (D-04), set-logged motion+haptic (D-11/D-12), finish-overlay stats (D-08), empty-state re-skin (D-13), i18n sweep (D-14).
- `(tabs)/index.tsx` ← draft-resume + saved-toast re-skin (chrome only) + overlay spring (D-11).
- `locales/{sv,en}.json` ← new workout/overlay keys (D-14).
- `fm:haptics` pref ← read on the workout screen for the new `impactMedium` call (D-12).
- **F13 risk: this IS the hot path (HIGH RISK phase).** Mitigation: D-17 freezes the mutation/queue layer; the re-skin is presentational. Verify `test:f13-brutal` green + manual ≤3s UAT after.

</code_context>

<specifics>
## Specific Ideas

- The workout screen is the app's single most-used surface — the re-skin must *feel* as fast as v1 (≤3s knapptryck→sparat). Motion is additive polish, never a gate on the write.
- Keep the proven full-scroll-of-cards interaction; the mock's single-exercise pagination is prettier in a static mock but riskier for the real logging loop — fidelity yields to F13 here (D-01).
- PR trophies are tempting eye-candy in the mock, but PR detection is its own phase (13). Ship the re-skin clean; let Phase 13 light up the trophies.
- The draft-resume "End session" is the one place red is correct — closing an orphaned live draft is the data-loss-adjacent action. Everywhere else, accent.
- The header timer and finish-overlay stats are the two "earned" additions from the mock that need no new data model — pure derivations from `started_at` + logged sets.

</specifics>

<deferred>
## Deferred Ideas

- **PR celebration banner + per-set trophy markers + e1RM (Epley) detection** — Phase 13 (F18 / PR-01..05). Phase 11 omits the markup (D-06); Phase 13 adds detection + banner sweep animation + history/chart PR surfacing.
- **Home activity-ring dashboard** (streak, weekly volume, sparkline) — Phase 12 (DASH-01..05).
- **Rest timer** — Phase 14 (sequenced last; notification / JS-suspension risk kept away from the re-skin).
- **Global i18n zero-missing-keys audit** across all screens + both languages — Phase 15 (I18N-03). Phase 11 fully i18ns the screens it touches.

### Reviewed Todos (not folded)
None — `todo.match-phase 11` returned 0 matches.

</deferred>

---

*Phase: 11-Active Workout Re-skin (HIGH RISK — F13)*
*Context gathered: 2026-06-13*
