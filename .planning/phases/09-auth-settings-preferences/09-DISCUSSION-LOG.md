# Phase 9: Auth, Settings & Preferences - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-11
**Phase:** 9-Auth, Settings & Preferences
**Areas discussed:** Units & conversion, Weekly goal + migration, Notifications/haptics depth, Language control shape, Settings grouping & order, Settings control widgets, Auth error & loading states, Sign-out treatment

---

## Units & conversion (SET-03)

### lbs rounding
| Option | Description | Selected |
|--------|-------------|----------|
| Nearest 0.5 lb | 100 kg → 220.5 lb; plate-gym granularity, no noisy decimals | ✓ |
| Whole lb | Cleanest, loses precision | |
| One decimal | Most precise, noisy in dense rows | |

### Unit scope this phase
| Option | Description | Selected |
|--------|-------------|----------|
| Pref + helper now, screens adopt per phase | Build `fm:units` + kg↔display helper; existing screens adopt at re-skin (11/12); no hot-path touch | ✓ |
| Pref + helper + sweep all screens now | Retrofit history/workout/chart now; risk of double work + early hot-path touch | |

**User's choice:** Nearest 0.5 lb; pref + helper now, screens adopt per phase.

---

## Weekly goal + migration (SET-04)

### Goal input control
| Option | Description | Selected |
|--------|-------------|----------|
| Stepper +/- | Compact, precise, fits SettingsRow | ✓ |
| Preset chips (3/4/5/6) | Fast tap, but caps range | |
| Slider | Visual, imprecise on phone | |

### Default + range
| Option | Description | Selected |
|--------|-------------|----------|
| Default 3, range 1–7 | Realistic cadence; ring math sane | ✓ |
| Default 4, range 1–7 | More ambitious default | |
| Default 3, range 1–14 | Allows two-a-days; ring math odd >7 | |

**User's choice:** Stepper +/-; default 3, range 1–7.
**Notes:** Confirmed the deferred `0007_profiles_weekly_goal` migration must land in Phase 9 (Phase 8 D-12 deferral resolved here) since SET-04 persists to `profiles.weekly_goal`.

---

## Notifications / haptics depth (SET-06 / SET-07)

### Notifications depth
| Option | Description | Selected |
|--------|-------------|----------|
| Stored pref only | `fm:notifications` bool; no expo-notifications install, no permission prompt; Phase 14 owns it | ✓ |
| Install + request permission now | Front-loads Phase 14 dep; prompts for unused permission | |

### Haptics behavior
| Option | Description | Selected |
|--------|-------------|----------|
| Pref + live gate, no retrofit | `fm:haptics` (default on); new calls gate; existing sites adopt at re-skin | ✓ |
| Pref + gate every existing call site now | Touches active-workout hot path early | |
| Stored pref only | Toggle does nothing observable this phase | |

**User's choice:** Notifications = stored pref only; haptics = pref + live gate, no retrofit.

---

## Language control shape (SET-05 / I18N-02)

### Control shape
| Option | Description | Selected |
|--------|-------------|----------|
| Three-state: System / Svenska / English | Mirrors theme; `fm:language` = 'system'\|'sv'\|'en'; fits "device default + override" | ✓ |
| Two-state: Svenska / English | Loses explicit "follow device" state | |

### Locale fallback for `System`
| Option | Description | Selected |
|--------|-------------|----------|
| English fallback | Non-sv device → en; safer international default | ✓ |
| Swedish fallback | Odd for non-Swedish users | |

**User's choice:** Three-state; System → sv on Swedish device, English fallback otherwise. Live update via `changeLanguage`, no restart.

---

## Settings grouping & order

| Option | Description | Selected |
|--------|-------------|----------|
| Profile → Appearance → Workout → Notifications → Sign out | Grouped by mental model; sign-out pinned bottom | ✓ |
| Profile → Preferences (flat) → Sign out | Fewer headers, longer list | |
| You decide | Planner chooses from spec | |

**User's choice:** Profile → Appearance (theme+language) → Workout (units+goal) → Notifications (haptics+notifications) → Sign-out.

---

## Settings control widgets

| Option | Description | Selected |
|--------|-------------|----------|
| Segmented for theme/lang/units, stepper for goal, switches for haptics/notif | Consistent, idiomatic; reuses SegmentedControl | ✓ |
| Push-to-detail rows for theme/lang/units | More native-iOS feel; adds routes/taps | |
| ForgeChip rows for theme/lang/units | On-brand but diverges from existing SegmentedControl | |

**User's choice:** Segmented (theme/lang/units) + stepper (goal) + switches (haptics/notifications).

---

## Auth error & loading states (SKIN-01)

### Error rendering
| Option | Description | Selected |
|--------|-------------|----------|
| Inline under field + form-level for auth failures | Matches RHF per-field model; Forge spacing | ✓ |
| Single top banner for everything | Simpler, less precise | |
| You decide | Planner follows spec | |

### Submit + sign-out treatment
| Option | Description | Selected |
|--------|-------------|----------|
| Button spinner + disabled; sign-out neutral, pinned bottom | Prevents double-submit; sign-out low-emphasis, no confirm | ✓ |
| Button spinner + disabled; sign-out destructive-red | Emphatic but contradicts non-destructive framing | |

**User's choice:** Inline field errors + form-level auth-failure message; submit spinner+disabled; neutral sign-out pinned bottom, no confirm.

---

## Claude's Discretion

- `fm:*` AsyncStorage read/write wiring + Zod guards (follow `fm:theme` enum-catch pattern).
- Units helper location/name (`lib/units.ts`) + prefs store/hook shape (follow `lib/*-store.ts` conventions).
- Precise Forge token/class choices per control (follow `lib.jsx` `THEMES.forge` + spec).
- Shared prefs store vs per-key reads — planner's call.

## Deferred Ideas

- Apply kg↔display helper to existing weight-display screens — Phases 11/12.
- Gate existing `expo-haptics` call sites behind `fm:haptics` — Phases 11/12.
- `expo-notifications` install + permission + delivery — Phase 14.
- Home activity ring consuming `weekly_goal` — Phase 12.
- Editing profile display name — future phase (SET-02 is view-only).
