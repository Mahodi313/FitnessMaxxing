# Phase 12: History, Detail, Chart & Home Dashboard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-13
**Phase:** 12-History, Detail, Chart & Home Dashboard
**Areas discussed:** Dashboard hero layout, Dashboard aggregate semantics, Exercise chart re-skin, Session-detail & history rows, DASH-03/04 coverage reconciliation, Motion feel, History lifetime stats, Volume unit conversion, Activity ring overflow

---

## Dashboard hero layout — delta/sparkline placement

| Option | Description | Selected |
|--------|-------------|----------|
| Ring hero + volume card | Home gets both the ring hero AND a volume card (delta + sparkline) | |
| Single enriched hero | Cram ring + streak + volume + delta + sparkline into one hero card | |
| Mock-literal split | Home hero = ring + streak + volume chip; delta + sparkline only on History | ✓ |

**User's choice:** Mock-literal split → **D-05**

## Dashboard hero layout — active-session behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Swap hero for banner | Live session → hide ring-hero, show active-session banner (FHomeActive) | ✓ |
| Banner above hero | Keep ring-hero visible, pin banner above it | |

**User's choice:** Swap hero for banner → **D-02**

## Dashboard hero layout — offline / cold start

| Option | Description | Selected |
|--------|-------------|----------|
| Cached last value | Persist dashboard query; show last-known numbers, refresh online | ✓ |
| Skeleton until loaded | Show skeleton until RPC resolves; never show stale numbers | |
| You decide | Match the existing persister setup | |

**User's choice:** Cached last value → **D-03**

---

## DASH-03/04 coverage reconciliation

| Option | Description | Selected |
|--------|-------------|----------|
| Re-scope to History | DASH-03/04 satisfied by the History volume card; verifier checks History | ✓ |
| Delta arrow on Home | Add just the delta arrow to the Home volume chip; sparkline on History | |
| Reconsider — both on Home | Put delta + sparkline on Home after all | |

**User's choice:** Re-scope to History → **D-05** (verifier note in CONTEXT canonical_refs)
**Notes:** Raised proactively so the phase verifier doesn't flag DASH-03/04 as missing on Home.

---

## Dashboard aggregate semantics — week boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Calendar week (Mon–Sun) | ISO week, resets Monday; matches Swedish convention | ✓ |
| Rolling 7 days | Last 7 days from now; no reset day | |
| Calendar week (Sun–Sat) | US convention | |

**User's choice:** Calendar week Mon–Sun → **D-06**

## Dashboard aggregate semantics — streak definition

| Option | Description | Selected |
|--------|-------------|----------|
| Consecutive goal-weeks | Consecutive calendar weeks hitting the weekly goal | ✓ |
| Consecutive workout-days | Days in a row with a session (mock-literal "12 dagar") | |
| Consecutive active-weeks | Consecutive weeks with ≥1 session (not goal-gated) | |

**User's choice:** Consecutive goal-weeks → **D-07** (chip relabels dagar→veckor)

## Dashboard aggregate semantics — sparkline series

| Option | Description | Selected |
|--------|-------------|----------|
| Weekly volume, last ~8–12 wks | Total volume per calendar week | ✓ |
| Daily volume, last ~30 days | Volume per day | |
| Per-session volume, last N | One point per finished session | |

**User's choice:** Weekly volume, last ~8–12 weeks → **D-08**

## Dashboard aggregate semantics — new-user empty state

| Option | Description | Selected |
|--------|-------------|----------|
| Zeroed hero + prompt | Ring 0/goal, streak 0, volume 0, "log first session" nudge | ✓ |
| Hide hero until 1st session | Suppress hero until ≥1 finished session | |
| You decide | Match Forge empty-state patterns | |

**User's choice:** Zeroed hero + prompt → **D-04**

---

## Exercise chart re-skin — metric toggle

| Option | Description | Selected |
|--------|-------------|----------|
| Keep toggle (Forge) | Preserve Max-vikt/Total-volym toggle, Forge segmented | ✓ |
| Drop toggle, weight only | Mock-faithful single line; volume in stats row | |
| You decide | Pick based on clean-vs-capability | |

**User's choice:** Keep toggle → **D-10**

## Exercise chart re-skin — range selector

| Option | Description | Selected |
|--------|-------------|----------|
| Mock 3-state, default 90d | 30d / 90d / All, default 90d | ✓ |
| Keep v1 5-state | 1M / 3M / 6M / 1Y / All | |

**User's choice:** Mock 3-state, default 90d → **D-11**

## Exercise chart re-skin — interim hero stat (e1RM is Phase 13)

| Option | Description | Selected |
|--------|-------------|----------|
| Current best + range delta | Active metric's latest/best value + change over range (real data) | ✓ |
| Omit hero until Phase 13 | No hero stat this phase | |
| You decide | Consistency with D-06 omission vs real data | |

**User's choice:** Current best + range delta → **D-12** (Phase 13 swaps to e1RM)

## Exercise chart re-skin — below the chart

| Option | Description | Selected |
|--------|-------------|----------|
| Stats row + keep the list | Mock stats row (top set / vol-per-session / avg RPE) AND Senaste-10 list | ✓ |
| Stats row only (mock) | Replace list with stats row | |
| Keep list only | Keep Senaste-10, skip stats row | |

**User's choice:** Stats row + keep the list → **D-14**

---

## Session-detail & history rows — exercise breakdown

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid: Forge card + full sets | Mock card frame + keep expanded per-set list (weight×reps+RPE) | (resolved) |
| Mock compressed summary | "sets × reps" + max weight only | |
| You decide | Detail vs density | ✓ |

**User's choice:** "You decide" → Claude resolved to the **hybrid** (detail-preserving) → **D-15**

## Session-detail & history rows — PR markers

| Option | Description | Selected |
|--------|-------------|----------|
| Omit until Phase 13 | No trophies anywhere; plain rows/exercises (Phase 11 D-06 stance) | ✓ |
| Scaffold inert slots | Render empty trophy containers (rejected pattern) | |

**User's choice:** Omit until Phase 13 → **D-13**

## Session-detail & history rows — history row anatomy

| Option | Description | Selected |
|--------|-------------|----------|
| Full mock row | Date badge (DD/MON) + plan + sets·vol·duration | ✓ |
| Keep v1 row, Forge-skinned | Date string + plan + set/vol, no badge/duration | |

**User's choice:** Full mock row → **D-16**

## Session-detail & history rows — header style

| Option | Description | Selected |
|--------|-------------|----------|
| Custom Forge header (both) | Hide native nav; circular back + ellipsis + eyebrow + title on detail & chart | ✓ |
| Keep native nav bar | Re-skin tint only | |

**User's choice:** Custom Forge header (both) → **D-17**

---

## Motion feel (MOTN-02/03)

| Option | Description | Selected |
|--------|-------------|----------|
| Full tasteful set | Ring fill + chart draw + sparkline draw + number count-ups; honor reduce-motion | ✓ |
| Required two only | Just ring fill + chart line draw | |
| You decide | Follow §07 + library defaults | |

**User's choice:** Full tasteful set → **D-18**

## History lifetime stats

| Option | Description | Selected |
|--------|-------------|----------|
| Show count + hours | Lifetime session count + total hours eyebrow | ✓ |
| Count only | Session count, drop hours | |
| Omit eyebrow | Just the "Historik" title | |

**User's choice:** Show count + hours → **D-09**

## Volume unit conversion

| Option | Description | Selected |
|--------|-------------|----------|
| Convert everything | Weights + volume + sparkline + axes all convert to lbs | ✓ |
| Weights convert, volume stays kg | Mixed units | |
| You decide | Whichever reads cleaner | |

**User's choice:** Convert everything → **D-20**

## Activity ring overflow (goal beaten)

| Option | Description | Selected |
|--------|-------------|----------|
| Cap full, label '5 / 4' | Ring caps at 100%, label shows real count | |
| Overfill / glow | Ring overfills past 100% with glow/second-lap | ✓ |
| Cap full, label '4 / 4' | Ring full, label clamps to goal | |

**User's choice:** Overfill / glow → **D-19**

---

## Claude's Discretion

- **D-15** exercise breakdown — user said "you decide"; resolved to the detail-preserving hybrid.
- RPC shape (one combined dashboard RPC vs several); chart-summary aggregate RPC for the hero delta + stats row — flagged for research.
- Exact Reanimated/Skia implementation of ring fill, chart draw, sparkline draw, number count-ups, overflow-glow.
- Forge token/class choices; `t()` key namespacing.
- Whether the lifetime eyebrow (D-09) and the History volume card (D-05) share an RPC.

## Deferred Ideas

- PR detection / e1RM / trophies / celebration banner → Phase 13 (PR-01..05).
- Rest timer → Phase 14.
- Global i18n zero-missing-keys audit → Phase 15 (I18N-03).
- Reduce-motion as an in-app Settings pref (OS setting honored this phase; no in-app toggle).
- Session-detail exercise ordering by `plan_exercises.order_index` (v1 WR-05 polish gap).
