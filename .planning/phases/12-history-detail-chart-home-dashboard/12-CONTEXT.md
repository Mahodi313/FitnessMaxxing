# Phase 12: History, Detail, Chart & Home Dashboard - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Re-skin the **three read-side screens** to the Forge design **and** add the **Home activity-ring dashboard** backed by **new RLS-scoped read-side RPCs**.

**Screens / surfaces in scope:**
- **History list** (`app/app/(app)/(tabs)/history.tsx`) — re-skin to `FHistory`: lifetime-stats eyebrow + Forge session rows + a **weekly-volume overview card** (volume + delta + sparkline) that carries DASH-03/DASH-04.
- **Session detail** (`app/app/(app)/history/[sessionId].tsx`) — re-skin to `FSessionDetail`: custom header, 3-stat grid, notes block, exercise breakdown. Preserve the existing edit-notes (F12) + delete-session flows.
- **Exercise chart** (`app/app/(app)/exercise/[exerciseId]/chart.tsx`) — re-skin to `FChart`: custom header, hero stat, range selector, the Victory Native XL chart, stats row + "Senaste 10 passen" list.
- **Home dashboard** — the **Planer tab** (`app/app/(app)/(tabs)/index.tsx`, re-skinned in Phase 10) gains the **activity-ring hero** layered above the existing plan list (`FHome` hero region). The plan list itself is **already Forge** (Phase 10) — Phase 12 adds only the hero.

**In scope:** SKIN-06, DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, MOTN-02, MOTN-03.

**Out of scope (own phases — do NOT build here):**
- **PR detection, e1RM (Epley), PR trophies, celebration banner** — **Phase 13 (F18 / PR-01..05)**. The mocks (`FHistory` row trophy, `FSessionDetail` PB trophy, `FChart` e1RM hero) show them; **Phase 12 omits all PR markup entirely** (no inert/scaffolded slots — D-13, parallel to Phase 11 D-06). The chart hero shows a real non-PR stat in the interim (D-08); Phase 13 swaps it to e1RM.
- **Rest timer** — Phase 14.
- **Global i18n zero-missing-keys audit** — Phase 15 (I18N-03). Phase 12 fully i18ns the screens it touches.
- **Mutation / offline-queue write path + F13 hot path** — untouched. These are read-side screens; `npm run test:f13-brutal` stays green (SKIN-08 standing constraint). New RPCs are read-only (`stable`, `security invoker`).
- **Editing the profile display name, the active-workout screen, plans/exercise CRUD** — prior/other phases.

</domain>

<decisions>
## Implementation Decisions

### Home dashboard hero (DASH-01, DASH-02, MOTN-02)
- **D-01:** **Mock-pure activity-ring hero** per `FHome` (lines 125-158): `ProgressRing` (sessions-this-week / weekly_goal) + a **streak chip** + a **this-week-volume chip**. **No delta and no sparkline on the Home hero** — those live on the History screen (D-05). The hero sits **above the existing Phase-10 plan list** on the Planer tab; the plan list is unchanged.
- **D-02:** **During an active session, swap the ring-hero for the active-session banner** (per `FHomeActive`, lines 1766-1769). The banner is already built (Phase 10, `app/components/active-session-banner.tsx`); the hero (+ volume framing) hides while a session is live and the banner takes its place. Idle → ring-hero; active → banner.
- **D-03:** **Offline / cold-start = cached last value.** Persist the dashboard-aggregate query through the existing TanStack persister (same offline-first read pattern as the history list) so the hero shows last-known numbers instantly at cold start and silently refreshes when online. A skeleton shows only on a truly empty cache (brand-new install).
- **D-04 (DASH-05 empty state):** **Brand-new user (0 finished sessions) → zeroed hero + prompt.** Ring at 0/goal, streak 0, volume 0, with a "Logga ditt första pass"-style nudge. The hero is present from day one (teaches the layout); the History volume card shows its own empty copy.

### Dashboard aggregate semantics (DASH-05 RPCs)
- **D-05 (DASH-03/DASH-04 placement):** **The weekly-volume card (volume + `+12%` delta + sparkline) lives on the History screen, NOT the Home hero** (`FHistory` lines 565-594). This is the **mock-literal split**. DASH-03 (volume + delta vs prior week) and DASH-04 (sparkline) are therefore **satisfied by the History volume card** — the phase verifier MUST check the History screen for them, not Home. The "dashboard read-side" spans Home (ring/streak/volume) + History (delta/sparkline).
- **D-06 (week boundary):** **Calendar week, Monday–Sunday (ISO week)**, resetting Monday 00:00 (local). "This week" = current Mon–Sun; "prior week" = the preceding Mon–Sun (drives the delta). Weekly goal (1–7) maps to a calendar week. Matches the Swedish week convention.
- **D-07 (streak definition):** **Streak = consecutive calendar weeks that met the weekly goal** (e.g. 5 = five Mon–Sun weeks in a row at ≥ `weekly_goal` sessions). NOT a daily streak (the mock's "12 dagar" is overridden — daily streaks punish rest days). **The streak chip label flips from "dagar/days" to "veckor/weeks"** — adjust the i18n keys accordingly.
- **D-08 (sparkline series):** **Weekly total volume over the last ~8–12 weeks** (one point per calendar week). Visualizes the week-over-week trend the `+12%` delta summarizes; pairs with the "VECKANS VOLYM" framing.
- **D-09 (lifetime stats):** **History header eyebrow shows lifetime stats — total session count + total hours trained** ("24 pass · 87 timmar", `FHistory` line 556-558). New all-time aggregate (count of finished sessions + Σ duration). Another RPC field.

### Exercise chart re-skin (SKIN-06, MOTN-03)
- **D-10 (metric toggle):** **Keep the Max-vikt / Total-volym metric toggle**, re-skinned to a Forge segmented control. The mock drops it, but it's a working v1 capability (two views of progression) — preserve it. Chart line + hero + stats reflect the active metric.
- **D-11 (range selector):** **Adopt the mock's 3-state range — 30d / 90d / All — default 90d** (`FChart` lines 818-833; mock highlights the middle = 90d, which matches v1's current 3M default). Replaces v1's 5-state (1M/3M/6M/1Y/All). Re-skinned to a Forge segmented control. Map each option to a since-timestamp for the RPC.
- **D-12 (chart hero stat — e1RM deferred):** **Hero = the active metric's current best/latest value + its change over the selected range**, computed from existing data (e.g. "107.5 kg" current max weight + range delta). This is **real, non-PR data** — NOT a scaffolded PR placeholder, so it does not violate the D-13 omission rule. **Phase 13 swaps the hero metric to estimated 1RM (PR-05).**
- **D-13 (PR markup OMITTED):** **No PR trophies, no e1RM, no celebration anywhere this phase** — every History row, every session-detail exercise, and the chart render plain (no trophy column, no PB badge). Exactly the **Phase 11 D-06** stance: no inert/scaffolded slots, no dead UI. **Phase 13 (PR-04/PR-05)** introduces the markup when PR detection lands.
- **D-14 (below the chart):** **Add the mock's 3-stat row (top set / vol-per-session / avg RPE) AND keep the "Senaste 10 passen" tappable list** below it (`FChart` lines 852-857 + v1 list). Summary + drill-down. Avg-RPE uses existing F11 RPE data. The "Senaste 10 passen" tap-to-source-session routing (Phase 6 BLOCKER-2) is preserved.

### Session detail & History rows (SKIN-06)
- **D-15 (exercise breakdown — Claude's discretion, resolved to hybrid):** **Forge card frame (exercise name + max-weight stat on the right, per the mock) WITH the expanded per-set list kept beneath** (weight × reps + RPE per set, re-skinned). The mock's reps-only summary ("4 × 8·6·6·5") drops per-set weight/RPE, which is the point of reviewing a logged session — so keep the full per-set detail. *(User chose "you decide"; Claude resolved to the detail-preserving hybrid.)*
- **D-16 (History row):** **Full mock row** (`FHistory` lines 597-638): stacked **date badge (DD / MON)** + plan name + **"X set · Y kg · Z min" meta** (adds duration, already computed on the detail screen). Forge surface/border card. Plan-name fallback ("— ingen plan" → i18n key) preserved.
- **D-17 (custom in-content header on BOTH detail + chart):** **Hide the native Stack header; render the mock's custom Forge header** — circular back button + circular ellipsis button (`FSessionDetail` lines 653-661, `FChart` lines 773-781) + eyebrow + display-font title. Consistent with the **Phase 11 D-09** workout header. The **ellipsis hosts the existing delete-session action** (re-skinned to the inline-overlay overflow-menu → delete-confirm flow already in `history/[sessionId].tsx`).

### Motion (MOTN-02, MOTN-03)
- **D-18 (full tasteful motion set):** **On mount:** ring fills 0→value (spec §07 spring), chart line draws left→right, sparkline draws in, and the big volume/hero numbers count up. Premium feel consistent with the Phase 11 motion table. **Honor the OS reduce-motion setting** — snap to final values when reduce-motion is enabled. (Note: the Phase 8 `ProgressRing` is currently **static** — Phase 12 adds the fill-on-mount animation.)
- **D-19 (ring overflow / goal beaten):** **Ring overfills past 100% with a glow / second-lap treatment** when sessions exceed the weekly goal (e.g. 5/4); the label shows the real count. Celebrates beating the goal (planner owns the exact Skia treatment — second arc, accent glow, or hue shift).

### Carried-forward locks (do NOT re-derive or regress)
- **D-20 (unit conversion — adopt Phase 9 helper, CONVERT EVERYTHING):** These read-side screens **finally adopt the Phase 9 `fm:units` kg↔display helper** (Phase 9 D-01/D-02 deferred this to Phase 12). When **lbs** is selected, **convert every weight figure — per-set weights, max/top-set, total volume, sparkline values, and the chart axes — to lbs** (round per Phase 9 D-01: nearest 0.5 lb for weights). Storage stays canonical **kg**; RPCs return kg; the client converts for display. Internally consistent (the "Total volym" chart metric matches the displayed weight unit), even though lbs-volume numbers get large.
- **D-21 (full i18n sweep):** **Every string these screens render gets sv+en keys** in `app/locales/{sv,en}.json` routed through `t()` — same approach as Phase 9/10/11. The v1 screens are **hardcoded Swedish** ("Historik", "Inga pass än", "Senaste 10 passen", "Max vikt", "Total volym", "Laddar…", delete-confirm copy, etc.). Includes the **streak chip relabel** (D-07: dagar→veckor) and new dashboard/chart/lifetime-stat strings. Follow Phase 8 D-10 flat 1:1 key convention.
- **D-22 (inline-overlay pattern, never Modal portal):** The session-detail **overflow-menu / delete-confirm / edit-notes overlays** keep the inline-overlay pattern + their **manual keyboard-height lift** (the edit-notes overlay's `Keyboard` listener + `paddingBottom = keyboardHeight + 16`, UAT 2026-05-16). Re-skin chrome only; preserve the offline-critical logic (mutate-not-mutateAsync, `useFocusEffect` overlay reset).
- **D-23 (new RPCs follow DB conventions):** All new dashboard + chart-aggregate RPCs are **`security invoker` + `stable` + `set search_path = ''`** with fully-qualified `public.*` references and `set_type = 'working'` filtering — **exactly like `0006_phase6_chart_rpcs.sql`**. Migration-as-truth (next numbered SQL in `app/supabase/migrations/`, likely `0011_*`), `npm run gen:types` co-committed, `verify-deploy.ts` after push, and a **cross-user `test:rls` assertion** added for each new RPC. Functions referenced by `verify-deploy.ts` (pg_proc).
- **D-24 (F13 untouched):** No mutation defaults, query keys, persister scope-bindings, or `exercise_sets` logging behavior are touched. `npm run test:f13-brutal` stays green.

### Claude's Discretion
- **D-15 was resolved** to the hybrid (detail-preserving) breakdown — but exact card composition + where the max-weight stat sits is the planner's call.
- **RPC shape** — whether the dashboard aggregates ship as **one combined RPC** (ring count + streak + this/prior-week volume + lifetime count/hours + weekly-volume series) or **several** is the planner/researcher's call. The chart hero delta + stats row (top set / vol-per-session / avg RPE over the selected range) likely need a **new or extended chart-summary RPC** beyond the existing `get_exercise_chart` / `get_exercise_top_sets` — flagged for research below.
- Exact Reanimated/Skia implementation of the ring fill, chart line draw, sparkline draw, number count-ups, and the overflow-glow (D-18/D-19) — non-blocking, follow spec §07 curves.
- Exact Forge token/class choices per control — follow `THEMES.forge` + how `forge-screens.jsx` composes the primitives.
- `t()` key namespace/names for the new strings (follow Phase 8 D-10 flat-key convention).
- Whether the History lifetime eyebrow (D-09) and the volume card (D-05) read from the same RPC.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase definition
- `.planning/ROADMAP.md` → "Phase 12: History, Detail, Chart & Home Dashboard" — goal + 4 success criteria (history/detail/chart match Forge; Home shows animated ring + streak + weekly volume+delta + sparkline; aggregates from RLS-scoped read-side RPCs with a clean empty state; chart line draws on mount).
- `.planning/REQUIREMENTS.md` → rows **SKIN-06, DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, MOTN-02, MOTN-03** (and the SKIN-08 / F13 standing constraint). Also note **PR-04, PR-05 are Phase 13** (the reason PR trophies + e1RM hero are omitted — D-13).
  - **Coverage note (D-05):** DASH-03 + DASH-04 are intentionally satisfied on the **History** screen's volume card, not the Home hero (mock-literal split). The verifier MUST check History for the delta + sparkline.

### Design source of truth (read first)
- `app/design v2/Sources/design/forge-screens.jsx` — the in-scope reference components:
  - `FHome` (line 88) — **activity-ring hero (lines 125-158)**: `ProgressRing` + `weekSessions` label + streak `ForgeChip` + volume `ForgeChip`. Status row + page title + plan list (plan list already Phase 10).
  - `FHomeActive` (line 1742) — **active-session variant**: swaps the ring-hero for `<FActiveSessionBanner>` (lines 1766-1769) when a session is live (D-02).
  - `FHistory` (line 550) — lifetime eyebrow (556), **volume overview card with delta + `Sparkline` (565-594)** (D-05/D-09), session rows w/ date badge (597-638) — **OMIT the row trophy (627-635) per D-13**.
  - `FSessionDetail` (line 649) — custom header (653-661), 3-stat grid (673-699), notes block (701-715), exercise breakdown (717-760) — **OMIT the PB trophy (739-746) per D-13**.
  - `FChart` (line 769) — custom header (774-781), **hero stat (793-816) — show current-best not e1RM per D-12**, range selector (818-833), `FullChart` (841-848), stats row `FChartStat` (852-877).
  - `ProgressRing`, `Sparkline`, `FullChart`, `ForgeChip`, `ForgeStat`, `Icon`, `TabBar` — primitives.
- `app/design v2/Sources/design/lib.jsx` — `THEMES.forge` tokens, `numStyle` (tabular nums), `Icon` paths, `Logo`, `SAMPLE` data shapes (`spark`, `chart`, `history`).
- `app/design v2/Sources/design/Forge Design Spec.html` → **§07 Motion & micro-interactions** — the motion table (D-18): ring fill, chart draw, default spring **damping 18 / stiffness 220**; iOS-port notes.
- `app/design v2/Sources/design/README.md` — migration order + brand (Ascend) vs content-icon (barbell/trophy) rules.

### Architecture & stack (locked — do not re-derive)
- `.planning/research/ARCHITECTURE.md` — token system, fonts, §7 i18n (`react-i18next`, `lib/i18n.ts`, `t()`).
- `.planning/research/STACK.md` — pinned versions; **Skia 2.2.12 + Victory Native XL 41 already in stack** (no new charting dep), Reanimated 4 for motion, `expo-localization` for week/locale.
- `.planning/research/PITFALLS.md` — Tailwind-v4-breaks-NativeWind (stay on Tailwind 3); Skia 2.x `matchFont` (no null-typeface fallback — see existing chart fix FIT-67).

### Database conventions (MUST follow for the new RPCs + migration)
- `CLAUDE.md` → "Database conventions" + "Security conventions" — migration-as-truth (next numbered SQL, likely `0011_*`), `security invoker` + `set search_path = ''`, `(select auth.uid())` RLS reliance, `npm run gen:types` co-commit, `verify-deploy.ts` after push, cross-user `test:rls` extension per new RPC.
- `app/supabase/migrations/0006_phase6_chart_rpcs.sql` — **the exact pattern to copy** for the new dashboard RPCs: `get_session_summaries` (history list, already used), `get_exercise_chart` (per-day metric), `get_exercise_top_sets` (Senaste 10). All `security invoker`, `stable`, `set search_path=''`, `set_type='working'`, RLS-respecting via the caller's JWT.

### F13 / hot-path constraint (MUST verify, do not regress)
- `CLAUDE.md` → "Project / Constraints" — Core Value ("never lose a set"); ≤3s log budget; offline-first.
- `app/scripts/verify-f13-brutal-test.ts` — `npm run test:f13-brutal`. Read-side phase; run green after.

### Phase carry-forward (locked)
- `.planning/phases/09-auth-settings-preferences/09-CONTEXT.md` — **D-01/D-02 units helper** (`fm:units`, canonical kg, nearest-0.5-lb; existing weight-display screens "adopt the helper when re-skinned in Phase 12" — this phase does it, D-20). `weekly_goal` (D-04, `profiles.weekly_goal` int 1–7 default 3) — drives the ring. `fm:*` Zod-catch pref read pattern.
- `.planning/phases/10-plans-exercises-re-skin/10-CONTEXT.md` — Phase-10 re-skin of the **Planer tab** (the Home hero layers on top); `0010` plan-name snapshot (history plan-name resilience); Forge component composition precedent.
- `.planning/phases/11-active-workout-re-skin-high-risk-f13/11-CONTEXT.md` — **D-06 PR-omission stance** (the model for D-13), **D-09 custom in-content header** (the model for D-17), **§07 motion table + spring curve** (D-18), live-`t()` re-skin precedent.

### Existing read-side code (to re-skin)
- `app/app/(app)/(tabs)/history.tsx` — v1 history list (`useSessionsListInfiniteQuery`, cursor pagination, RefreshControl, empty state, post-delete toast). Re-skin to `FHistory` + add the volume card.
- `app/app/(app)/history/[sessionId].tsx` — v1 session detail (notes edit F12, summary chips, per-exercise cards, overflow→delete inline overlays, keyboard-lift). Re-skin to `FSessionDetail`.
- `app/app/(app)/exercise/[exerciseId]/chart.tsx` — v1 chart (Victory Native XL `CartesianChart`, metric toggle, 5-state window, Skia tooltip, Senaste-10 list). Re-skin to `FChart`.
- `app/lib/queries/sessions.ts`, `app/lib/queries/sets.ts`, `app/lib/queries/exercise-chart.ts` — existing read-side query hooks; new dashboard hooks follow these patterns.

### ⚠ Research flags (open mechanism decisions for the phase-researcher)
- **Dashboard aggregate RPC(s) (DASH-05):** design the RLS-scoped read-side RPC(s) for: sessions-this-week count, consecutive-goal-weeks streak (D-07), this-week + prior-week volume (D-06 Mon–Sun), lifetime session count + total hours (D-09), and the weekly-volume sparkline series (~8–12 weeks, D-08). Decide one combined vs several. Verify week-boundary math in Postgres (`date_trunc('week', ...)` is Mon-based — confirm) and that all respect `security invoker` RLS.
- **Chart-summary aggregates (D-12/D-14):** the hero range-delta + stats row (top set, vol-per-session, avg RPE over the selected range) likely need a **new or extended** chart-summary RPC beyond `get_exercise_chart`/`get_exercise_top_sets`. Confirm avg-RPE is computable from `exercise_sets.rpe` (nullable — handle NULLs).
- **`ProgressRing` mount animation (MOTN-02):** the Phase 8 ring is static — confirm the Skia animation approach (Reanimated shared value driving the sweep) and the overflow-glow (D-19).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/components/ui/*` (Phase 8) — `ProgressRing`, `Sparkline`, `ForgeCard`, `ForgeChip`, `ForgeStat`, `Icon`, `TabBar`, `SegmentedControl` (re-skinned Phase 9). Compose all re-skins + the dashboard hero from these. `ProgressRing`/`Sparkline` already render via installed Skia (DSGN-05) — Phase 12 animates them (D-18).
- `app/components/active-session-banner.tsx` — **already Forge** (Phase 10); rendered in the hero slot during an active session (D-02).
- `app/components/segmented-control.tsx` — re-skinned Forge (Phase 9); reuse for the chart metric toggle + range selector (D-10/D-11).
- `app/lib/units.ts` (Phase 9) — the kg↔display conversion/format helper; adopt on every weight/volume figure (D-20).
- `app/lib/queries/{sessions,sets,exercise-chart}.ts` — existing read-side hooks (offline-queue-aware, persister-hydrated). New dashboard hooks follow these; chart hooks extend for the summary aggregates.
- `app/app/(app)/exercise/[exerciseId]/chart.tsx` — the Victory Native XL `CartesianChart` + Skia tooltip + `matchFont` FIT-67 fix are reusable as-is under the Forge skin.
- `app/lib/i18n.ts`, `app/locales/{sv,en}.json` — add the per-screen + dashboard + chart keys (D-21).
- `app/types/database.ts` — `profiles.weekly_goal` ✓ (Phase 9), `exercise_sets.rpe` ✓ (F11), `workout_sessions.started_at/finished_at` ✓. New RPC return types added by `gen:types` after the migration.

### Established Patterns
- **Read-side RPC** — `security invoker` + `stable` + `set search_path=''` + `set_type='working'` (0006). New dashboard RPCs copy this exactly.
- **Offline-first reads** — TanStack persister hydrates list/detail caches at cold start (D-03 extends this to the dashboard query).
- **Inline-overlay (not Modal portal)** — overflow/delete-confirm/edit-notes; manual keyboard-height lift (D-22).
- **Custom in-content Forge header** — Phase 11 D-09 precedent (D-17).
- **Unit display** — canonical kg storage, convert on display via `fm:units` helper (D-20).
- **Dark/light** via NativeWind `dark:` variants + Forge tokens; Skia primitives consume hex (theme-derived) since NativeWind classes don't apply inside the Skia canvas (existing chart pattern).
- **Reanimated 4** wired (metro/babel) — drives the ring fill / chart draw / count-ups (D-18).

### Integration Points
- `app/supabase/migrations/0011_*.sql` (new, RPCs) → `app/types/database.ts` (regen) → `app/scripts/test-rls.ts` (new assertions) → `app/scripts/verify-deploy.ts` (new function names).
- `(tabs)/index.tsx` (Planer/Home) ← activity-ring hero + active-session swap (D-01/D-02), new dashboard query hook (D-03/D-04).
- `(tabs)/history.tsx` ← `FHistory` re-skin + volume card (D-05) + lifetime eyebrow (D-09) + Forge rows (D-16) + i18n.
- `history/[sessionId].tsx` ← `FSessionDetail` re-skin (D-15) + custom header (D-17) + i18n; preserve overlays (D-22).
- `exercise/[exerciseId]/chart.tsx` ← `FChart` re-skin (D-10/D-11/D-12/D-14) + custom header (D-17) + chart draw-on-mount (D-18) + i18n.
- `locales/{sv,en}.json` ← new keys (D-21).
- **F13 risk: NONE for the hot path** (read-side, no mutation/queue/persister-for-logging touched). Verify `test:f13-brutal` green after.

</code_context>

<specifics>
## Specific Ideas

- The Home hero is the user's first-glance "am I on track this week" surface — keep it mock-pure (ring + streak + volume), let the History screen own the deeper volume trend (delta + sparkline). Don't crowd the hero.
- Streak = consecutive goal-weeks, not days. A gym app with rest days should reward hitting your weekly target, not punish a Tuesday off. The chip says "veckor/weeks", not "dagar/days".
- The chart hero must show real data now (current best + range delta) — it's not a PR placeholder, it's a genuine progression stat. Phase 13 elevates it to e1RM. (Contrast: PR trophies have NO data to back them yet, so they're omitted entirely.)
- Keep the chart's working v1 depth (metric toggle, Senaste-10 drill-down) while adopting the Forge frame + 3-state range — fidelity yields to not-removing-useful-features, same instinct as Phase 11 D-01.
- Per-set weight + RPE on session detail is the reason to look back at a pass — keep the expanded list; the mock's reps-only summary is too lossy.
- Beating your weekly goal should feel good — the ring overfills/glows rather than flatly capping. Earned delight.
- Convert everything to the chosen unit (incl. volume + axes) so the screen never mixes kg and lbs — even though lbs-volume numbers are large, a mixed-unit screen is worse.

</specifics>

<deferred>
## Deferred Ideas

- **PR detection (e1RM/Epley), PR trophies on history rows + session-detail exercises, chart e1RM hero + range delta, celebration banner + sweep** — **Phase 13 (F18 / PR-01..05)**. Phase 12 omits all PR markup (D-13) and shows a real current-best chart hero (D-12) that Phase 13 swaps to e1RM.
- **Rest timer** — Phase 14.
- **Global i18n zero-missing-keys audit** across all screens + both languages — Phase 15 (I18N-03). Phase 12 fully i18ns the screens it touches.
- **Reduce-motion as an in-app Settings pref** — Phase 12 honors the OS reduce-motion setting (D-18); a dedicated in-app toggle is not in scope (no SET requirement for it).
- **Session-detail exercise ordering by `plan_exercises.order_index`** — v1 orders by exercise_id UUID (WR-05 in 06-REVIEW.md); a known V1.1 polish gap, not re-opened here unless the re-skin makes it trivial.

### Reviewed Todos (not folded)
None — `todo.match-phase 12` returned 0 matches.

</deferred>

---

*Phase: 12-History, Detail, Chart & Home Dashboard*
*Context gathered: 2026-06-13*
