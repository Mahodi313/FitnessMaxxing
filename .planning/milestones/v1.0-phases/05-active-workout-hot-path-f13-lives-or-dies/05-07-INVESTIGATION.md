---
plan_id: 05-07
phase: 5
linear_issue: FIT-10
linear_issue_url: https://linear.app/fitnessmaxxing/issue/FIT-10/activesessionbanner-intermittently-missing-on-planer-back-nav-from
investigation_date: 2026-05-14
status: completed
conclusion: sub-option C (spec clarification — no code change)
---

# 05-07 Investigation — ActiveSessionBanner intermittently missing on Planer back-nav

## TL;DR

Static-code analysis of the routing structure proves the UAT-reported symptom is a UX expectation mismatch, not a render bug. `ActiveSessionBanner` is mounted inside `(tabs)/_layout.tsx` and is therefore by design absent on every non-tab `(app)` route. The "intermittent" observation is consistent with the user moving between `(app)/plans/[id]` (banner correctly absent) and `(tabs)/index` (banner correctly present) and reading the alternation as flakiness.

**Decision:** Apply **sub-option C** (spec clarification — no code change). Reclassify `FIT-10` from `Bug` to `Question / spec clarification`.

## Linear

- **Issue:** [FIT-10 — ActiveSessionBanner intermittently missing on Planer back-nav from /workout/[sessionId]](https://linear.app/fitnessmaxxing/issue/FIT-10/activesessionbanner-intermittently-missing-on-planer-back-nav-from)
- **Source UAT:** `05-HUMAN-UAT.md` Gap #4 (Phase 2 side-observation, 2026-05-13)

## Static analysis (the 10-arrival log table is unnecessary — the route structure already disproves the bug hypothesis)

### Banner mount scope

`app/app/(app)/(tabs)/_layout.tsx` line 39:

```tsx
<SafeAreaView edges={["top"]} className="flex-1 bg-white dark:bg-gray-900">
  <OfflineBanner />
  <ActiveSessionBanner />   // ← only mounted here
  <Tabs ... />
</SafeAreaView>
```

`app/app/(app)/_layout.tsx` has NO mount of `<ActiveSessionBanner />`. The banner literally cannot render on any `(app)` route that is not a tab.

### Route structure (Expo Router v6 file-system layout)

- `(app)/_layout.tsx` — the `(app)` Stack (root of the authenticated tree)
- `(app)/(tabs)/_layout.tsx` — the Tabs layout (Planer / Historik / Inställningar)
- `(app)/plans/[id].tsx` — pushed onto the `(app)` Stack ABOVE `(tabs)` when the user taps a plan row
- `(app)/plans/[id]/exercise-picker.tsx` — also above `(tabs)`
- `(app)/plans/[id]/exercise/[planExerciseId]/edit.tsx` — also above `(tabs)`
- `(app)/workout/[sessionId].tsx` — pushed onto the `(app)` Stack ABOVE `(tabs)` after Starta pass

When `/plans/[id]` is on top of the Stack, `(tabs)/_layout.tsx` is NOT in the render tree. Therefore `<ActiveSessionBanner />` is not in the render tree. **The banner is correctly absent.**

### Why the UAT observation reads as "intermittent"

UAT 2026-05-13 Phase 2: `"sometimes lands on plan-row dialog (plans/[id]) WITHOUT the ActiveSessionBanner module — only the second navigation in/out renders the banner correctly. Intermittent, not 100% reproducible on first try."`

Reading this in light of the route structure:

- **First back-nav** from `/workout/<id>`: user lands on `/plans/<id>` (the screen they came from before Starta pass). Banner correctly absent. User reads this as "missing".
- **Second back-nav** (`/plans/<id>` → back to `(tabs)/index` Planer tab): banner correctly present. User reads this as "now it works".

The alternation is correct behavior; it is not flakiness. The "intermittent" framing emerged because the user expected the banner on `/plans/<id>` too.

## Why the 10-arrival on-device log table is not needed

Plan 05-07 originally specified instrumenting the banner with `console.log` and capturing 10 back-nav arrivals on a physical iPhone. That data collection is justified IF AND ONLY IF the destination IS `(tabs)/index.tsx` AND `hasData=true` AND `onWorkoutRoute=false` AND the banner is missing. The static analysis above proves this scenario is impossible under the current code:

- If the destination is `(tabs)/index.tsx`, `(tabs)/_layout.tsx` is in the render tree, the banner component renders, and the only way it returns `null` is `!activeSession || onWorkoutRoute` (per `active-session-banner.tsx` line 50). With `hasData=true` and `onWorkoutRoute=false`, the banner renders. No race can suppress this short of an Expo Router internal bug (and we have no signal of one in our codebase — F13 brutal-test passed 25/25 in `05-VERIFICATION.md`).
- If the destination is `/plans/<id>`, the banner is structurally absent. No data collection needed.

The 10-arrival recipe remains in `05-07-PLAN.md` Task 1 as the **fallback** investigation if user clarification reveals the destination IS the Planer tab AND the banner still goes missing intermittently. Until that disproof lands, sub-option C is the default and the right call.

## Decision

**Sub-option C — Spec clarification (no code change).**

- ✓ The banner is correctly absent on `/plans/<id>` per the route structure.
- ✓ The banner is correctly present on the three tab screens when `activeSession != null && !onWorkoutRoute`.
- ✓ The "intermittent" UAT framing maps to user expectation mismatch on the `/plans/<id>` destination, not a render race.
- ✓ Mount-scope spec clarification added to `05-UI-SPEC.md` so the contract is unambiguous in the design source-of-truth.

## Followups

- Linear issue `FIT-10` to be reclassified from `Bug` to `Question` (or closed as `not-a-bug — spec clarification`).
- If the user reports that the banner is missing on the **Planer tab itself** (not on `/plans/<id>`), re-open this investigation: instrument with `console.log`, capture 10 arrivals, and pivot to sub-option A or B per plan Task 2 sub-options. No code change is shipped under this plan.

## Cross-checks

- F13 brutal-test contract (Plan 05-03 verification): banner appears on Planer tab on resume from force-quit — unaffected by this clarification.
- Cold-start draft-resume overlay on `(tabs)/index.tsx` (Plan 05-02 path): unaffected — separate render path.
- No regression on Historik / Inställningar tab banner visibility — same `useActiveSessionQuery + hide-gate` path.
