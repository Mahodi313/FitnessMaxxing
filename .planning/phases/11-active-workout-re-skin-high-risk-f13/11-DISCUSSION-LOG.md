# Phase 11: Active Workout Re-skin (HIGH RISK — F13) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-13
**Phase:** 11-Active Workout Re-skin (HIGH RISK — F13)
**Areas discussed:** Layout model, Set list rendering, Motion & haptics, Design extras (PR/timer/stats), Progress dots, Edit/delete affordance, Header chrome, RPE column, Empty-state, Input row

---

## Layout model (SKIN-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Single-exercise paginated | Match the mock literally — one exercise focused, progress dots, 'Up next', swipe to advance. Faithful but a real interaction-model change to the F13 hot path. | |
| Keep all-exercises scroll, Forge skin | Preserve the proven vertical-scroll-of-cards (lowest F13 risk), apply Forge tokens/table/dots per card. | ✓ |
| You decide / hybrid | Recommend after weighing risk vs fidelity. | |

**User's choice:** Keep all-exercises scroll, Forge skin (→ D-01)
**Notes:** Drops the mock's "Övning 1/6" framing and "Up next" card as redundant in a full scroll.

---

## Set list rendering (SKIN-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Forge table + preserve swipe/tap | Mock table layout but keep tap-to-edit + swipe-left-delete. | |
| Forge table + explicit edit/delete | Table layout with a visible affordance instead of swipe. | ✓ |
| You decide | Recommend best affordance. | |

**User's choice:** Forge table + explicit edit/delete (→ D-03, D-04)
**Notes:** Swipe-to-delete dropped in favor of a visible affordance. Affordance shape chosen via a follow-up ("you decide" → Claude recommended tap-row-edit + trailing ✕).

---

## Motion & haptics (MOTN-01 / MOTN-04 / MOTN-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Full motion table | Set-logged slide+scale+haptic AND overlay backdrop/card springs per spec §07, gated behind fm:haptics. | ✓ |
| Set-logged motion only | Just MOTN-01 now; defer overlay springs. | |
| You decide | Recommend scope. | |

**User's choice:** Full motion table (→ D-11, D-12)
**Notes:** PR-celebration animation excluded (Phase 13). Haptic gated by fm:haptics; visual animation not gated.

---

## Design extras — PR / timer / finish stats (SKIN-04 / SKIN-05) — multiSelect

| Option | Description | Selected |
|--------|-------------|----------|
| Add header timer | Live '42:18' elapsed timer in workout header, reusing banner's formatElapsed + started_at. | ✓ |
| Add finish-overlay stats | Computed sets / kg / min stats row in the finish overlay. | ✓ |
| Omit PR banner + trophies | Leave out PR markup; Phase 13 adds it. | ✓ (resolved) |
| Scaffold PR slots (empty) | Placeholder PR banner/trophy slots wired but inert. | ✗ (resolved away) |

**User's choice:** Add header timer + Add finish-overlay stats + Omit PR (→ D-06, D-07, D-08)
**Notes:** Initial multiSelect returned BOTH "Omit" and "Scaffold" (contradiction). Resolved in a follow-up → **Omit entirely** (no dead UI).

---

## Progress dots (SKIN-04) — follow-up given the scroll layout

| Option | Description | Selected |
|--------|-------------|----------|
| Per-card set dots, drop 'Up next' | Each card carries the mock's set-progress dots replacing the counter chip; drop 'Up next' + 'Exercise N/6'. | ✓ |
| Per-card dots + keep 'Up next' | Per-card dots AND a between-cards 'Up next' hint. | |
| You decide | Recommend treatment. | |

**User's choice:** Per-card set dots, drop 'Up next' (→ D-02)

---

## Edit/delete affordance (SKIN-04) — follow-up

| Option | Description | Selected |
|--------|-------------|----------|
| Tap row = edit, trailing ✕ = delete | Tap enters inline edit; trailing ✕ icon replaces swipe. | ✓ (Claude rec) |
| Trailing edit icon + delete in edit mode | Pencil enters edit; delete lives inside the edit row. | |
| You decide | Recommend. | |

**User's choice:** "You decide" → Claude recommended **Tap row = edit, trailing ✕ = delete** (→ D-04)
**Notes:** Chosen for fastest, most-discoverable edit/delete on a grid row while preserving the ≤3s flow.

---

## Header chrome (SKIN-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Custom Forge header, hide native | headerShown:false; circular back + timer pill + accent Finish, owns safe-area + back-nav. | ✓ |
| Keep native Stack header, Forge-tint | Restyle the native header; timer + Finish as headerRight. | |
| You decide | Recommend. | |

**User's choice:** Custom Forge header, hide native (→ D-09)

---

## RPE column (SKIN-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Always show column, '–' when null | Render RPE for every set; muted '–' when absent. | ✓ |
| Hide RPE column when no set has it | Collapse the column per-exercise when all null. | |
| You decide | Recommend. | |

**User's choice:** Always show column, '–' when null (→ D-05)

---

## Empty-state (defensive)

| Option | Description | Selected |
|--------|-------------|----------|
| Re-skin to Forge + i18n | Forge tokens + accent back button, copy via t() (sv+en). | ✓ |
| Minimal Forge tint only | Forge colors, keep structure; still i18n copy. | |
| You decide | Recommend effort level. | |

**User's choice:** Re-skin to Forge + i18n (→ D-13)

---

## Input row (SKIN-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Adopt mock input-row exactly | Tall accent fields, display-font value + unit-label-underneath, full-width accent Klart + check. | ✓ |
| Forge-skin current inline row | Keep current single-line row, apply Forge tokens. | |
| You decide | Recommend. | |

**User's choice:** Adopt mock input-row exactly (→ D-10)
**Notes:** MUST preserve v1 keyboard wiring (decimal/number pads, selectTextOnFocus, onSubmit RHF, prefill) so ≤3s log flow survives.

---

## Claude's Discretion

- Edit/delete affordance pixel-placement; whether logged-set delete needs a confirm (likely none — recoverable, mirror v1).
- Exact Forge token/class choices per control (follow THEMES.forge + forge-screens.jsx).
- Placement of per-card progress dots relative to the card header.
- Reanimated implementation details for the set-logged slide+scale (non-blocking, §07 spring curve).
- `t()` key namespace/names for new per-screen strings (Phase 8 D-10 flat-key convention).

## Deferred Ideas

- PR celebration banner + per-set trophies + e1RM (Epley) detection — Phase 13 (PR-01..05).
- Home activity-ring dashboard — Phase 12 (DASH-01..05).
- Rest timer — Phase 14.
- Global i18n zero-missing-keys audit — Phase 15 (I18N-03).
