# Phase 13: PR Celebration (F18) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 13-PR Celebration (F18)
**Areas discussed:** PR detection rules, Prior-best & offline source, Celebration banner behavior, Read-side PR surfacing, Banner placement vs hot-path, Trophy vs check icon, Carry-forward locks

---

## PR detection rules

### PR definition
| Option | Description | Selected |
|--------|-------------|----------|
| Pure e1RM | Only estimated 1RM decides; higher reps at lower weight can beat a heavier set; one comparable number; matches PR-01/PR-05 | ✓ |
| e1RM + separate weight-PR | Two PR types (highest e1RM AND heaviest weight); double logic + UI | |
| You decide | — | |

**User's choice:** Pure e1RM (D-01).

### Edge cases (multiSelect)
| Option | Description | Selected |
|--------|-------------|----------|
| First set = no PR | Very first set on an exercise establishes baseline silently | ✓ |
| Working sets only | Only set_type='working' counts | ✓ |
| Require weight > 0 | 0kg/bodyweight → e1RM=0, never a PR | ✓ |
| Beat by any margin | Any increase >0, no threshold | (re-asked below) |

### Margin (follow-up, since the margin option was left unselected)
| Option | Description | Selected |
|--------|-------------|----------|
| Any increase > 0 | Smallest increase counts; most rewarding | ✓ |
| Rounded to 0.5 kg | Compare e1RM rounded to nearest 0.5 kg | |
| You decide | — | |

**User's choice:** Any increase > 0 (D-05). First-set-no-PR (D-02), working-only (D-03), weight>0 (D-04).

---

## Prior-best & offline source

| Option | Description | Selected |
|--------|-------------|----------|
| New persisted RPC | RLS-scoped best-per-exercise RPC, persisted via TanStack persister; offline = last-synced; also compare in-session | ✓ |
| Pure cache derivation | Only cached data; cache lacks all-time history → PRs missed/misfire | |
| You decide | — | |

**User's choice:** New persisted RPC (D-06/D-07).

### e1RM formula source of truth
| Option | Description | Selected |
|--------|-------------|----------|
| One JS util is the truth | Shared lib/e1rm.ts; RPC returns raw sets; JS computes everywhere; Node-testable | ✓ |
| SQL computes e1RM | RPC returns precomputed e1RM; formula in two places → drift risk | |
| You decide | — | |

**User's choice:** One JS util — `lib/e1rm.ts` (D-08).

---

## Celebration banner behavior

### Banner lifecycle
| Option | Description | Selected |
|--------|-------------|----------|
| Auto-dismiss after a few sec | Scales in (0.96→1 + sweep + haptic), ~3-4s, fades; no tap; doesn't disturb logging | ✓ |
| Stays until next set | Persists until next set/finish; takes set-list space | |
| Stays + manual close | Persistent banner with ✕ | |

**User's choice:** Auto-dismiss ~3-4s (D-10).

### Multiple PRs in a session
| Option | Description | Selected |
|--------|-------------|----------|
| Banner per PR set | Each beating set (incl. earlier same-session) triggers a fresh banner; row trophy only on log-time PRs | ✓ |
| One banner, updated | At most one banner; replaces content | |
| You decide | — | |

**User's choice:** Banner per PR set (D-11/D-12).

---

## Read-side PR surfacing

### History-row trophy meaning
| Option | Description | Selected |
|--------|-------------|----------|
| Was-a-PR-when-logged | Session gets trophy if any set was a PR at log-time; historically accurate; trophies don't migrate; needs chronological derivation | ✓ |
| Contains-all-time-best | Trophy if session holds current all-time best; simpler but trophies jump | |
| You decide | — | |

**User's choice:** Was-a-PR-when-logged (D-14/D-15).

### Chart e1RM hero (PR-05)
| Option | Description | Selected |
|--------|-------------|----------|
| Best e1RM in range + delta vs range-start | Big numeral = highest e1RM in range; delta = best minus earliest in range (Phase 12 D-12 pattern) | ✓ |
| Latest e1RM + delta vs range-start | Big numeral = most recent session's e1RM; can dip below best | |
| You decide | — | |

**User's choice:** Best e1RM in range + delta vs range-start (D-16).

---

## Banner placement vs hot-path

| Option | Description | Selected |
|--------|-------------|----------|
| Floating overlay (no layout shift) | Absolutely-positioned; set list/input/"Klart" never move; keeps mock look; protects ≤3s muscle-memory; inline, no Modal | ✓ |
| Inline exactly like the mock | Banner in flow above the set card, pushes content down | |
| You decide | — | |

**User's choice:** Floating overlay (D-09). Overrides the mock's literal inline placement (line 389) to protect the log-set budget.

---

## Trophy vs check icon

| Option | Description | Selected |
|--------|-------------|----------|
| Trophy replaces check | PR row = trophy only; normal row = green check (mock 454-464) | ✓ |
| Both (check + trophy) | Show both; cramped, off-mock | |

**User's choice:** Trophy replaces check (D-13).

---

## Carry-forward locks (multiSelect — confirm)

| Option | Description | Confirmed |
|--------|-------------|-----------|
| Haptic respects fm:haptics | PR notificationSuccess via same gate as set-log haptic (Phase 11 MOTN-05) | ✓ |
| Sweep snaps under reduce-motion | Honor OS reduce-motion (Phase 12 D-18); snap to final, banner/trophy still render | ✓ |
| F13/≤3s is sacred | Fire-and-forget after addSet.mutate; no hot-path mutation/queue/persister touched; test:f13-brutal green | ✓ |

**User's choice:** All three confirmed (D-17/D-18/D-19).

---

## Claude's Discretion

- RPC shape (one combined vs several; extend `get_exercise_summary` vs new function) — must follow Phase 12 D-23 DB conventions.
- Chronological PR-derivation mechanism (Postgres window function over running max e1RM ordered by completed_at).
- Exact Skia/Reanimated sweep + scale-spring implementation (§07 curves).
- Exact session-detail per-exercise e1RM + trophy placement inside the Phase 12 D-15 hybrid card.
- New `t()` key names (flat-key convention).
- e1RM display precision / decimals (cosmetic; not part of the PR-margin gate).

## Deferred Ideas

- `is_pr` persisted column — out-of-scope; PR derived. Revisit only if derivation proves costly at scale.
- Separate weight-PR / rep-PR types — rejected (D-01).
- PR-margin threshold / "significant PR" tiering — rejected (D-05).
- Rest timer — Phase 14. Global i18n zero-missing-keys audit — Phase 15.
- Reduce-motion as an in-app Settings pref — OS setting only (no SET requirement).
