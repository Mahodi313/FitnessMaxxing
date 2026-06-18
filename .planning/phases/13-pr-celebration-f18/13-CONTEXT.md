# Phase 13: PR Celebration (F18) - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Detect personal bests via **estimated 1RM (Epley), computed client-side so detection works offline**, and surface the result across the app:

**Surfaces in scope (PR-01 … PR-05):**
- **Detection engine** — a logged working set whose e1RM beats the prior best for that exercise is a PB; computed client-side over the local cache (PR-01).
- **Active-workout screen** (`app/app/(app)/workout/[sessionId].tsx`) — a PR set gets a **trophy** in the set list (PR-02) and a **celebration banner with gradient-sweep** appears during the workout (PR-03).
- **History list** (`app/app/(app)/(tabs)/history.tsx`) — PR sessions marked with a trophy (PR-04, mock `FHistory` line 627).
- **Session detail** (`app/app/(app)/history/[sessionId].tsx`) — surfaces PR/e1RM per exercise (PR-04, mock `FSessionDetail` line 739).
- **Exercise chart** (`app/app/(app)/exercise/[exerciseId]/chart.tsx`) — hero swaps from current-best (Phase 12 D-12) to **estimated 1RM + change over range** (PR-05, mock `FChart` line 793).

This phase **clarifies HOW** to build PR detection + surfacing. New capabilities belong in other phases.

**Out of scope (do NOT build here):**
- **`is_pr` persisted column / schema change** — explicitly out-of-scope per REQUIREMENTS ("PR is derivable client-side; avoids schema + sync complexity"). PR is **derived**, never stored.
- **Rest timer** — Phase 14. **Global i18n zero-missing-keys audit** — Phase 15 (this phase i18ns the strings it adds).
- **F13 hot-path write internals** — mutation defaults, queue, persister scope-bindings, `exercise_sets` logging behavior untouched. `npm run test:f13-brutal` stays green (SKIN-08 standing constraint).
- **Re-skinning the screens themselves** — already Forge (Phases 11/12). Phase 13 only adds the PR markup the prior phases deliberately omitted (Phase 12 D-13).

</domain>

<decisions>
## Implementation Decisions

### PR detection rules
- **D-01 (pure e1RM):** A PR is decided **solely by Epley e1RM = `weight_kg × (1 + reps/30)`**. A higher-rep set at lower weight CAN beat a heavier set (e.g. 90×10 ≈ 120 beats 100×5 ≈ 116.7). One comparable number per set. **No separate "weight PR" type** — single trophy concept everywhere.
- **D-02 (first set = baseline, not a PR):** The very first working set on an exercise (no prior best) is **NOT** celebrated — it silently establishes the baseline. Prevents every new exercise from auto-triggering a trophy.
- **D-03 (working sets only):** Only `set_type = 'working'` counts — for both the candidate set and the prior best. Warmup/dropset/failure ignored. Matches `last-value` + all existing RPCs.
- **D-04 (weight > 0 required):** Sets with `weight_kg ≤ 0` (bodyweight / no external load) yield e1RM = 0 and can never be a PR (Epley is meaningless without external weight). V1 has no bodyweight marking anyway.
- **D-05 (any increase counts):** Any e1RM increase `> 0` over the prior best is a PR — **no threshold, no rounding gate**. Most rewarding, simplest. (A near-identical follow-up set that nudges higher is technically a new best — accepted.)

### Prior-best reference & offline source
- **D-06 (all-time best per exercise, via a new persisted RPC):** The comparison reference is the **all-time best working set per exercise**. Source = a new **RLS-scoped read-side RPC** returning the best-candidate set(s) per exercise, **cached + persisted through the existing TanStack persister** (same offline pattern as `last-value` / dashboard). Online = exact; offline = last-synced value. **No `is_pr` column** (REQUIREMENTS / D-13 carry-forward).
- **D-07 (within-session comparison):** Detection also compares each logged set against **sets already logged earlier in the current session**, so a second PR set in the same session correctly beats the first (pairs with D-15 banner-per-PR).
- **D-08 (single formula source of truth — `lib/e1rm.ts`):** A **shared `lib/e1rm.ts` (Epley) util is the ONLY formula source**. The RPC returns **raw sets (weight + reps)**; JS computes e1RM **everywhere** — live in-workout detection, chart hero (PR-05), session-detail (PR-04), and the range delta. Guarantees the in-workout detection and the chart hero never drift. Node-importable + unit-testable (units.ts / resolve-language.ts precedent — see [[feedback_verify_phase_state_from_disk]] pattern of pure modules).
  - **Rationale:** SQL-computed e1RM would put the formula in two places (numeric type / rounding drift between SQL and the live client compare). One JS util eliminates the drift surface.

### Celebration banner behavior (PR-03)
- **D-09 (floating overlay — never disturbs hot-path layout):** The banner renders **absolutely-positioned (floating)** so the set list, input row, and **"Klart" button never shift position**. Keeps the mock's look (gradient surface + trophy + "Nytt personbästa" + `{kg} kg × {reps} · set N`, mock line 389) but **never touches hot-path geometry** — protects the ≤3s muscle-memory. Inline-rendered, **no Modal portal** (Phase 11/12 D-22 carry-forward).
  - **NOTE:** This overrides the mock's literal inline-above-the-set-card placement (mock line 389-413) specifically to protect the log-set budget. Same look, safe geometry.
- **D-10 (auto-dismiss ~3-4s):** Banner scales in (0.96→1 + gradient sweep, spec §07) + haptic, dwells ~3-4s, then fades out. No tap required; never blocks logging.
- **D-11 (one banner per PR set):** Each set that beats the prior best (incl. an earlier set in the same session, D-07) triggers a **fresh banner with that set's numbers**. Multiple breakthroughs each get celebrated. (Not a single updating banner.)
- **D-12 (set-row trophy = PR-at-log-time):** The trophy on a set row (PR-02) is set **only on sets that were a PR when they were logged**. A later, higher set does NOT remove an earlier set's trophy. Historically honest, consistent with D-11.
- **D-13 (trophy replaces the check):** On a PR row the **trophy (gradient circle) replaces the green check-circle** (mock line 454-464); a normal row shows the check. Cleanest in the narrow 36px column.

### Read-side PR surfacing (PR-04, PR-05)
- **D-14 (history trophy = "was a PR when logged"):** A history session gets a trophy if **any set in it was a PR at the time it was logged** (beat the then-current best). **Historically accurate — trophies do not migrate** when later records are set. Consistent with the set-row trophy (D-12) + banner-per-PR (D-11). Requires the read-side RPC to derive PR status **chronologically** (running max e1RM per exercise ordered by `completed_at`), not retrospectively. Derived, never stored.
- **D-15 (session detail e1RM + per-exercise trophy):** Session detail shows **per-exercise e1RM** and a **trophy on exercises that hit a PR-at-the-time in that session** (mock `FSessionDetail` 739-746). Derived via the same chronological logic + `lib/e1rm.ts`. Sits within the Phase 12 D-15 hybrid exercise card (exact placement = planner's call).
- **D-16 (chart hero = best e1RM in range + delta vs range-start):** The chart hero (PR-05) swaps from current-best (Phase 12 D-12) to: **big numeral = highest e1RM among working sets in the selected range (30d/90d/All)**; **delta chip = best-e1RM-in-range minus earliest-e1RM-in-range** (reuses the Phase 12 D-12 current-best-delta pattern). Computed via `lib/e1rm.ts` from RPC sets. Mock `FChart` 793 ("107.5 kg" + "+15.5 kg").

### Carried-forward locks (do NOT regress)
- **D-17 (F13 / ≤3s is sacred):** Detection + banner are **fire-and-forget after `addSet.mutate`** (Phase 11 D-12 motion/haptic precedent); the local e1RM compare is cheap and **never blocks the set save**. No mutation defaults / query keys / persister scope-bindings / `exercise_sets` logging behavior touched (Phase 12 D-24 style). `npm run test:f13-brutal` stays green.
- **D-18 (haptic respects `fm:haptics`):** The PR `notificationSuccess` haptic goes through the **same `fm:haptics` gate** as the set-logged haptic (Phase 11 MOTN-05 / D-12). Off when the toggle is off.
- **D-19 (reduce-motion snaps):** The gradient sweep + 0.96→1 scale **honor the OS reduce-motion setting** (Phase 12 D-18) — snap to final state, no animation, but the banner + trophy still render.
- **D-20 (unit display via reactive store):** Every weight/e1RM/volume figure these surfaces render goes through the **reactive `useUnitStore`** (Phase 12 D-20 / FIT-111) — storage canonical kg, display converted live; a kg↔lbs toggle re-renders the chart hero, session detail, and any PR numerals without restart. e1RM is computed in kg then display-converted.
- **D-21 (full i18n for new strings):** Every new PR string gets sv+en keys routed through `t()` (Phase 8 D-10 flat 1:1 convention). Existing keys `personalBest`, `pbSub` ("{{kg}} kg × {{reps}} reps"), `estimated1RM` already exist in `locales/{sv,en}.json` — reuse; add any new ones (e.g. banner set-number suffix) at parity.

### Claude's Discretion
- **RPC shape** — whether the all-time-best-per-exercise reference (D-06) and the chronological history/detail PR derivation (D-14/D-15) ship as one combined RPC or several, and whether the chart-summary RPC (`get_exercise_summary`) is extended vs a new function — researcher/planner's call. Must follow DB conventions (D-23 of Phase 12: `security invoker` + `stable` + `set search_path=''` + `set_type='working'`, migration-as-truth, `gen:types` co-commit, `verify-deploy.ts`, cross-user `test:rls` per new RPC).
- **Chronological PR derivation mechanism** — Postgres window function (running max e1RM per exercise ordered by `completed_at`) vs alternative; verify it respects RLS via the caller's JWT.
- **Exact Skia/Reanimated sweep implementation** — gradient-sweep across the banner surface + scale spring (§07 damping 18 / stiffness 220) — follow spec §07 curves.
- **Exact session-detail layout** — where the e1RM stat + per-exercise trophy sit inside the Phase 12 D-15 hybrid exercise card.
- **`t()` key names** for any new strings (flat-key convention).
- **e1RM display precision** — how many decimals the hero / banner show (e1RM is an estimate; rounding is cosmetic, not part of the PR-margin gate per D-05).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase definition
- `.planning/ROADMAP.md` → "Phase 13: PR Celebration (F18)" — goal + 3 success criteria (offline e1RM PB detection over local cache; trophy in set list + celebration banner with sweep; history marks PR sessions, session detail + chart surface PR/estimated 1RM with range delta).
- `.planning/REQUIREMENTS.md` → rows **PR-01, PR-02, PR-03, PR-04, PR-05**. Also the **Out of Scope** row: **no `is_pr` persisted column** (PR derived client-side) and the **SKIN-08 / F13** standing constraint.

### Design source of truth (read first)
- `app/design v2/Sources/design/forge-screens.jsx`:
  - `FWorkout` — **PR celebration banner (lines 389-413)**: gradient surface, trophy block, `t.personalBest` + `t.pbSub('105','6')` + "· set 3". **Set-list PR trophy (lines 454-464)** — trophy replaces `checkCircle` on `s.pb` rows (D-13).
  - `FHistory` (line 550) — **session-row trophy (lines 627-635)** on `s.pb` rows (D-14).
  - `FSessionDetail` (line 649) — **per-exercise PB trophy (lines 739-746)** on `e.pb` exercises (D-15).
  - `FChart` (line 769) — **hero stat (lines 793-816)**: `t.estimated1RM` + 52px numeral + success delta chip "+15.5 kg" (D-16). Replaces the Phase 12 current-best hero.
  - `ProgressRing`, `Sparkline`, `FullChart`, `ForgeChip`, `Icon` (`trophy`, `arrowUp`, `checkCircle`) — primitives.
- `app/design v2/Sources/design/lib.jsx` — `THEMES.forge` tokens (`gradFrom`, `gradTo`, `accent`, `success`, `surface`), `numStyle` (tabular nums), `Icon` paths (`trophy`).
- `app/design v2/Sources/design/Forge Design Spec.html`:
  - **§07 Motion** (line ~551): "PR celebration — Banner scales 0.96→1 + gradient sweep across surface + haptic `notificationSuccess`" (D-10/D-19).
  - **Migration table row 6** (line ~747): "New `PRBanner` shown when `e1RM > prev e1RM`. Uses gradient surface + trophy icon. Mount after set lands." (D-09).

### Existing code to extend / re-use
- `app/app/(app)/workout/[sessionId].tsx` (1560 lines) — the hot-path active-workout screen; set list + input row + `addSet.mutate`. PR detection hooks in fire-and-forget after the mutate (D-17); banner mounts as a floating overlay (D-09); set-row trophy slot (D-12/D-13).
- `app/lib/queries/sets.ts` — `useAddSet` / `useSetsForSessionQuery` (working-set list for the current session; in-session comparison source for D-07). Mutation defaults live in `lib/query/client.ts` — **do not touch** (D-17).
- `app/lib/queries/last-value.ts` — the offline-first, persister-hydrated, RLS-scoped read-side pattern the **new all-time-best RPC hook should mirror** (D-06): `Record` not `Map` for JSON round-trip; per-exercise queryKey; `set_type='working'`; `(select auth.uid())` RLS reliance; invalidation on `['session','finish'].onSettled`.
- `app/lib/queries/exercise-chart.ts` + `app/app/(app)/exercise/[exerciseId]/chart.tsx` — current chart hero is the Phase 12 D-12 **current-best placeholder** explicitly built to be swapped to e1RM here (D-16). `get_exercise_summary` (migration 0011) already returns `top_set_weight_kg` + `top_set_reps`; `chartData` memo + `useUnitStore` dep already wired.
- `app/supabase/migrations/0011_*.sql` — `get_exercise_summary` / `get_dashboard_summary` — the **exact convention** for any new/extended RPC (D-06/D-14): `security invoker` + `stable` + `set search_path=''` + `set_type='working'`, fully-qualified `public.*`.
- `app/supabase/migrations/0006_phase6_chart_rpcs.sql` — `get_exercise_chart` / `get_exercise_top_sets` — second reference RPC pattern.

### Conventions & constraints (locked — do not re-derive)
- `CLAUDE.md` → "Database conventions" + "Security conventions" — migration-as-truth (next numbered SQL, likely `0012_*`), `gen:types` co-commit, `verify-deploy.ts` after push, cross-user `test:rls` extension per new RPC, `(select auth.uid())` wrapping, `using` + `with check` on writable policies (these RPCs are read-only).
- `CLAUDE.md` → "Project / Constraints" — Core Value ("never lose a set"), ≤3s log budget, offline-first (D-17).
- `app/scripts/verify-f13-brutal-test.ts` — `npm run test:f13-brutal`. Run green after (read-side + fire-and-forget; expect no regression). **Known amber: FIT-107** — count-only precondition (25-set fixture), environmental, not a regression.

### Phase carry-forward (locked)
- `.planning/phases/12-history-detail-chart-home-dashboard/12-CONTEXT.md` — **D-12** (chart hero is a current-best placeholder Phase 13 swaps to e1RM — drives D-16), **D-13** (PR markup omitted in Phase 12, introduced here), **D-20** (reactive `useUnitStore` / FIT-111 — drives D-20), **D-22** (inline-overlay never Modal — drives D-09), **D-24** (F13 untouched — drives D-17), **D-18/§07 motion** (drives D-10/D-19).
- `.planning/phases/11-active-workout-re-skin-high-risk-f13/11-CONTEXT.md` — **D-12** (set-logged motion + `fm:haptics`-gated haptic, fire-and-forget after `addSet.mutate` — the exact pattern for D-17/D-18), **D-06** (PR-trophy omitted in Phase 11, introduced here), **D-09** (custom in-content header).
- `.planning/phases/09-auth-settings-preferences/09-CONTEXT.md` — `fm:units` canonical-kg/display helper + `fm:haptics` pref (D-18/D-20).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/components/ui/*` — `Icon` (`trophy`/`arrowUp`/`checkCircle`), `ForgeChip`, `ForgeStat`, gradient token access via `THEMES.forge`. Compose the banner + trophy from these.
- `app/lib/queries/last-value.ts` — the canonical offline-first persister-hydrated RLS read-side hook to mirror for the all-time-best-e1RM reference query (D-06).
- `app/lib/units.ts` + `app/lib/units-store.ts` (`useUnitStore`, FIT-111) — reactive kg↔display conversion for every PR numeral (D-20).
- `app/lib/i18n.ts` + `app/locales/{sv,en}.json` — `personalBest`, `pbSub`, `estimated1RM` already present; add new keys at parity (D-21).
- Reanimated 4 + Skia (in stack) — drive the §07 banner sweep + scale spring (D-10), reduce-motion aware (D-19).

### Established Patterns
- **e1RM has no util yet** — `lib/e1rm.ts` is NEW (D-08); grep confirms e1RM/1RM only appears in `chart.tsx` comments + `_forge-gallery.tsx`, never implemented.
- **Read-side RPC** — `security invoker` + `stable` + `set search_path=''` + `set_type='working'` (0006/0011). New PR-reference + history-derivation RPCs copy this.
- **Fire-and-forget post-mutate side-effects** — Phase 11 D-12 (motion + gated haptic after `addSet.mutate`) is the exact pattern for PR detection + banner (D-17).
- **Inline-overlay, never Modal portal** — Phase 11/12 D-22 (D-09 banner is a floating in-tree overlay).
- **Pure Node-importable module for testable logic** — `units.ts` / `resolve-language.ts` precedent; `lib/e1rm.ts` follows (D-08) with a `test:e1rm` script.

### Integration Points
- `app/supabase/migrations/0012_*.sql` (new RPCs) → `app/types/database.ts` (regen via `gen:types`) → `app/scripts/test-rls.ts` (cross-user assertions per new RPC) → `app/scripts/verify-deploy.ts` (new function names in pg_proc check).
- `lib/e1rm.ts` (new) → consumed by `workout/[sessionId].tsx` (detection), `exercise/[exerciseId]/chart.tsx` (hero/delta), `history/[sessionId].tsx` (per-exercise), and the read-side RPC hooks.
- `workout/[sessionId].tsx` ← detection (D-01..D-08/D-17) + floating banner (D-09/D-10/D-11) + set-row trophy (D-12/D-13) + haptic gate (D-18).
- `(tabs)/history.tsx` ← session-row trophy from the chronological-derivation RPC (D-14).
- `history/[sessionId].tsx` ← per-exercise e1RM + trophy (D-15).
- `exercise/[exerciseId]/chart.tsx` ← e1RM hero swap + range delta (D-16); `chartData` memo already deps `useUnitStore`.
- `locales/{sv,en}.json` ← new PR keys (D-21).
- **F13 risk: NONE for the hot path** — detection is read-side + fire-and-forget; no mutation/queue/persister-for-logging touched. Verify `test:f13-brutal` green after (D-17).

</code_context>

<specifics>
## Specific Ideas

- **Pure e1RM, one formula, one util.** The whole feature hinges on a single comparable number per set. Keep Epley in exactly one place (`lib/e1rm.ts`) so the in-workout celebration and the chart hero can never disagree.
- **The trophy tells the truth about when.** A PR trophy — on a set row, a history row, or a session-detail exercise — means "this beat your best *at the time*". Trophies don't migrate when you later lift more. Earned moments stay where they happened.
- **Never let celebration touch the budget.** The banner is delight layered *on top of* the ≤3s log path — floating, fire-and-forget, never shifting the "Klart" button. The mock's inline placement is overridden precisely to protect muscle-memory.
- **First-ever lift is a baseline, not a party.** Trophies must stay rare enough to feel earned — every new exercise auto-celebrating would cheapen them.
- **Beat by anything counts.** No margin threshold — a new best is a new best. e1RM decimals are cosmetic (estimate noise), not a gate.

</specifics>

<deferred>
## Deferred Ideas

- **`is_pr` persisted column** — explicitly out-of-scope (REQUIREMENTS); PR stays derived. Revisit only if the chronological-derivation RPC proves too costly at scale (not a V1 concern for a single user).
- **Separate "weight PR" / rep-PR types** — rejected (D-01); pure e1RM only. A future milestone could add heaviest-single or per-rep-range PRs if desired.
- **PR-margin threshold / "significant PR" tiering** — rejected (D-05, any increase counts). A future "big PR vs small PR" visual distinction is possible but not now.
- **Rest timer** — Phase 14.
- **Global i18n zero-missing-keys audit** — Phase 15 (I18N-03). Phase 13 fully i18ns its own new strings.
- **Reduce-motion as an in-app Settings pref** — honors OS setting only (D-19); no SET requirement for an in-app toggle.

### Reviewed Todos (not folded)
None — `todo.match-phase 13` not run (init reported no pending todos; STATE.md "Pending Todos: None yet").

</deferred>

---

*Phase: 13-PR Celebration (F18)*
*Context gathered: 2026-06-14*
