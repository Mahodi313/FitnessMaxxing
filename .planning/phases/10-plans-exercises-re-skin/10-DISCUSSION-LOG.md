# Phase 10: Plans & Exercises Re-skin - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-12
**Phase:** 10-Plans & Exercises Re-skin
**Areas discussed:** Muscle-group taxonomy, Picker filters, Starter exercise library, i18n boundary, Seed delivery/backfill, Seed list contents, Plan actions + boundaries, Empty states + optional targets

---

## Muscle-group taxonomy

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed bilingual list | Canonical key set, displayed via t(); equipment stays free-text | ✓ |
| Fixed list + 'Other' free-text | Canonical list + escape hatch storing free-text | |
| Keep free-text | Stay as-is, stored as written | |

**User's choice:** Fixed bilingual list
**Notes:** Stored as a language-neutral key, rendered via t() — doesn't violate I18N-05 since the user isn't typing it. Equipment remains free-text (matches mockup: muscle group = dropdown, equipment = text field).

### Group list granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Match mockup: 5 groups | Bröst/Rygg/Ben/Axlar/Armar (arms=bi+tri) + implicit Other | ✓ |
| Finer: ~8 groups | Adds Biceps/Triceps/Core/Glutes split | |
| You pick the list | User edits a candidate set | |

**User's choice:** Match mockup: 5 groups
**Notes:** Dropdown and filter pills share the same 5 keys. Legacy free-text values best-effort mapped; unmapped → Other.

---

## Picker filters

| Option | Description | Selected |
|--------|-------------|----------|
| All + single-select group | "Alla/All" default + 5 single-select pills, AND-combined with search | ✓ |
| Single-select, no All | Exactly the static mockup, one group always active | |
| Search-only (drop pills) | Honor SKIN-03 literal text, skip pills | |

**User's choice:** All + single-select group
**Notes:** Resolves the SKIN-03 ("browse + create-new") vs ROADMAP criterion-2 ("browse + filters + create-new") conflict in favor of building filters, now justified by the keyed taxonomy + seed content.

---

## Starter exercise library

| Option | Description | Selected |
|--------|-------------|----------|
| No seed — re-skin only | User-scoped model, empty for fresh installs | |
| Seed into my own exercises | ~15-20 inserted into user's exercises table | |
| Global read-only library | Separate seeded table, merged query | |
| (User question) Public exercise API? | User asked whether to source via API / ship via gql | ✓ (explored) |

**User's choice:** Explored an API/dataset approach, then chose "Curated bilingual seed (~15-20)" after discussion.
**Notes:** Discussed free-exercise-db (MIT, ~870, English-only), wger (CC-BY-SA), ExerciseDB/RapidAPI (paid). Ruled out runtime API (conflicts with offline-first + free-tier). Bilingual snag (all public datasets English-first) made a curated bilingual seed the better fit for this re-skin phase. Full dataset import deferred.

### Seed name bilinguality

| Option | Description | Selected |
|--------|-------------|----------|
| Truly bilingual (needs migration) | Add seed_key column; seed rows render name+equipment via t() | ✓ |
| Swedish-only seed (no migration) | Plain Swedish strings, don't flip in EN mode | |

**User's choice:** Truly bilingual (needs migration)
**Notes:** Migration 0010 adds nullable `seed_key`; editing a seed row clears the key → becomes normal free-text.

---

## Seed delivery / backfill

| Option | Description | Selected |
|--------|-------------|----------|
| Client first-run seed | AsyncStorage flag fm:exercises_seeded, offline-queue insert, works for existing+new | ✓ |
| Migration backfill + trigger | Server-side INSERT…SELECT + handle_new_user extension | |
| One-time backfill only | Migration seeds existing users once | |

**User's choice:** Client first-run seed
**Notes:** Existing user (already has an account) backfills on next launch; idempotent; RLS-respecting; no superuser migration.

---

## Seed list contents

| Option | Description | Selected |
|--------|-------------|----------|
| Approve as-is | Lock the 18 proposed exercises | |
| Approve, planner can refine | Guide not hard list, ~15-20, planner may adjust | ✓ |
| Let me edit it | User types changes | |

**User's choice:** Approve, planner can refine
**Notes:** ~18 candidate set across the 5 groups, compounds first (see CONTEXT.md D-08). Planner may swap names/counts.

---

## Plan actions + boundaries

| Option | Description | Selected |
|--------|-------------|----------|
| Keep archive-only | Preserve soft-archive, no destructive delete | |
| Archive + hard delete | Add permanent delete with confirmation | ✓ |

**User's choice:** Archive + hard delete
**Notes:** Grounded in existing code — plan detail already has reorder, remove, archive (ActionSheetIOS), and "Starta pass" → /workout/[id]. Boundary confirmed: Phase 10 re-skins the "Starta pass" button; the workout screen is Phase 11.

### Hard delete vs history

| Option | Description | Selected |
|--------|-------------|----------|
| Always preserve history | Delete plan + template, all logged sessions/sets survive (FK null + name snapshot) | ✓ |
| Block delete if used | Only zero-session plans deletable; used plans archive-only | |

**User's choice:** Always preserve history
**Notes:** Honors "never lose a set". Mechanism (FK ON DELETE SET NULL + plan-name snapshot) flagged for the phase-researcher. Confirmation dialog required.

---

## Empty states + optional targets

| Option | Description | Selected |
|--------|-------------|----------|
| Add now, set targets later | Tap adds with null targets; edit targets later | ✓ |
| Prompt for targets on add | Open targets editor on every add | |

**User's choice:** Add now, set targets later
**Notes:** Matches current flow; targets fully optional (range, one bound, or none). Empty states = re-skin existing patterns to Forge (Claude's discretion).

---

## Claude's Discretion

- Muscle-group legacy-value → key mapping mechanism.
- Archive/delete affordance pattern (iOS action-sheet vs inline Forge control).
- Exact seed_key values, translation-key namespace, seed equipment modeling.
- Forge token/class choices per control.
- Tab-bar wiring (Phase 8 TabBar shell vs styled Expo Tabs).
- Empty-state styling (re-skin existing patterns).

## Deferred Ideas

- Global read-only exercise library / build-time free-exercise-db import — own phase.
- Home activity-ring dashboard — Phase 12.
- Active-workout screen re-skin (destination of "Starta pass") — Phase 11.
- Global i18n zero-missing-keys audit — Phase 15.
- Editing the profile display name — carried from Phase 9, still deferred.
