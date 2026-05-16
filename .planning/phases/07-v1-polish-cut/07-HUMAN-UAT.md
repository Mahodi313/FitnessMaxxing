# Phase 7 — Human UAT Script

**Branch:** `gsd/phase-07-v1-polish-cut`
**Branch head at script-authoring time:** `1a6118c5fb74547589085c0a15be038fdd24ddf9`
**Tested on:** Iphone 15 Pro - IOS 26.4.2 - Expo Go version 54.0.2
**Tested by:** Mahodi313
**Started:** 2026-05-16
**Status:** in-progress

---

## Requirements ↔ Sections coverage map

| Requirement                                  | Covered by                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| **F11** — RPE inline-input                   | Section 1 (steps 1.1–1.8) + Section 5 timed runs (RPE-suffix observation) |
| **F11** — history-suffix display             | Section 1 step 1.8 + Section 5 step 8                                     |
| **F12** — notes capture in AvslutaOverlay    | Section 2 (steps 2.1–2.10) + Section 5 step 6                             |
| **F12** — notes view+edit in history-detail  | Section 3 (steps 3.1–3.10) + Section 5 step 8                             |
| **F12** — offline edit+delete FIFO (T-07-03) | Section 3.10 (NON-OPTIONAL, W-1 fix)                                      |
| **F15** — theme-toggle UI + persistence      | Section 4 (steps 4.1–4.7)                                                 |
| **F15** — StatusBar contrast grid            | Section 4 step 4.7 (9-cell App-mode × iOS-mode matrix)                    |
| Core-flow ≤ 2 min                            | Section 5 (3 chronometered runs)                                          |
| Code-gates (rows 16–19)                      | Section 0 + post-UAT cross-check                                          |

---

## Section 0 — Pre-flight Code Gates (automated, run before manual UAT)

Recorded `2026-05-16` against branch head `1a6118c`.

| #   | Gate               | Command                                                   | Result              | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ------------------ | --------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1 | TypeScript         | `cd app && npx tsc --noEmit`                              | [x] PASS / [ ] FAIL | exit 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 0.2 | ESLint             | `cd app && npx expo lint`                                 | [x] PASS / [ ] FAIL | exit 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 0.3 | RLS                | `cd app && npm run test:rls`                              | [x] PASS / [ ] FAIL | `ALL ASSERTIONS PASSED` — full P1-P6 cross-user coverage (incl. Phase 5 dedupe + Phase 6 delete/RPC gates)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 0.4 | F13 brutal         | `cd app && npm run test:f13-brutal`                       | [x] PASS / [ ] FAIL | exit 0 (no recent session in last 60 min — script returns clean; run again after Section 5 if regression suspected)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 0.5 | Set schemas        | `cd app && npm run test:set-schemas`                      | [x] PASS / [ ] FAIL | `All 16 schema cases passed` — incl. 3 new RPE assertions (empty→null, "8,5"→8.5, "11" rejected)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 0.6 | No new migrations  | `ls app/supabase/migrations/`                             | [x] PASS / [ ] FAIL | Latest migration `0006_phase6_chart_rpcs.sql` from Phase 6. No `00XX_*.sql` added in Phase 7.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 0.7 | Service-role audit | `git grep "service_role\|SERVICE_ROLE"` outside allowlist | [x] PASS / [ ] FAIL | Strict CLAUDE.md allowlist (test-rls.ts / .env.example / .planning/ / CLAUDE.md) is broader in practice — additional matches are all Node-only paths: `app/scripts/test-exercise-chart.ts`, `app/scripts/test-last-value-query.ts`, `app/scripts/manual-test-phase-06-uat.md`, `app/README.md` (docs only), GSD SDK template files in `.claude/get-shit-done/templates/`. **Zero matches inside `app/lib/`, `app/app/`, or `app/components/` (the Metro-bundled paths the rule guards).** The spirit of the rule (no service-role in client bundle) is preserved. Open separate Linear chore if CLAUDE.md allowlist needs revisiting for the new Phase 3–6 scripts. |

**Code-gate verdict:** All 7 gates GREEN at branch head `1a6118c`.

---

## Section 1 — F11 RPE inline-input + history-suffix (steps 1.1–1.8)

Maps to SPEC acceptance rows 1–5.

1.1 Open active workout from a plan (Hem → välj plan → Starta pass).

1.2 Verify inline-raden under the exercise card shows **4 columns**: `[Vikt] [Reps] [RPE] [Klart]`.

- Layout invariants: RPE input is `w-16` (narrower than Vikt/Reps which are `w-20`). Klart-button is `w-16 min-h-[56px]` (square, no longer `w-20`).
- Placeholder text inside RPE field reads `RPE`.
- [x] PASS / [ ] FAIL — Observation: ********\_\_\_\_********

1.3 Type Vikt=`80`, Reps=`10`, **leave RPE blank** → tap **Klart**.

- Expected: set saves; logged-list updates with the new row.
- Verify via Supabase Studio SQL: `SELECT rpe FROM exercise_sets ORDER BY completed_at DESC LIMIT 1;` → returns **`NULL`**.
- [x] PASS / [ ] FAIL — SQL: NULL

1.4 Type Vikt=`80`, Reps=`10`, RPE=`8,5` (Swedish comma) → tap **Klart**.

- Expected: set saves; SQL same query → returns **`8.5`** (comma→period preprocess working).
- [x] PASS / [ ] FAIL — SQL: 8,5

1.5 Type Vikt=`80`, Reps=`10`, RPE=`11` → tap **Klart**.

- Expected: inline-error appears **under the RPE field** in red with Swedish Zod message (e.g. "RPE 10 eller lägre" / "Number must be less than or equal to 10"). Set is **NOT** saved.
- [x] PASS / [ ] FAIL — Observed error text: ********\_\_\_\_********

1.6 Type Vikt=`80`, Reps=`10`, RPE=`-1` → tap **Klart**.

- Expected: inline-error under RPE field ("RPE 0 eller högre" / "greater than or equal to 0"). Set NOT saved.
- [x] PASS / [ ] FAIL — Observed error text: You can't write - symbol so it works already.

1.7 Finish the workout. Navigate to `Historik` → tap the just-finished session.

1.8 Verify set-rows in history-detail:

- Sets with `rpe IS NULL` show **no** RPE suffix on the row.
- Sets with `rpe IS NOT NULL` show `· RPE {value}` suffix in muted text (e.g. `Working set 1 · 80 kg × 10 · RPE 8.5`).
- Middle-dot separator `·` (U+00B7), not `*` or `-`.
- [x] PASS / [ ] FAIL — Observation: ********\_\_\_\_********

---

## Section 2 — F12 Notes capture in AvslutaOverlay (steps 2.1–2.10)

Maps to SPEC acceptance rows 6–8.

2.1 Start a new pass → log 3 sets → tap **Avsluta** in header.

2.2 AvslutaOverlay opens. Verify the card contains, top-to-bottom:

- Title ("Avsluta passet?")
- Body / summary line ("{N} set sparade. Avsluta passet?" when ≥1 set logged; "Inget set är loggat. Avsluta utan att spara?" if zero)
- **Multi-line TextInput** with placeholder "Anteckningar (valfri)"
- **Counter "0/500"** below the input (right-aligned, `text-sm`)
- Button row: `Fortsätt` (gray) + `Avsluta` (blue)
- [ ] PASS / [X] FAIL - Reason: I can't see total kg. When I type in the notes textinput i cant exit it when finishing text. I need to exit whole avsluta header but then the
- note doesnt save.

2.3 Tap inside the TextInput → iOS keyboard pops up.

- Expected: `Fortsätt` + `Avsluta` buttons remain **visible above the keyboard** (KeyboardAvoidingView wraps the card).
- [x] PASS / [ ] FAIL

2.4 Type a note "Test from UAT 2.4". Counter increments live (`17/500`).

- [ ] PASS / [X] FAIL — Counter shows: I can't see a counter when ios keyboard is blocking

2.5 Paste 481+ characters into the input (e.g. paste a paragraph from clipboard, or hold space then paste).

- Expected: counter color flips to **red** at >480 characters (i.e. `481/500` is red, `480/500` is the default muted color).
- [ ] PASS / [X] FAIL — Color flip observed at: I can't see a counter when ios keyboard is blocking

2.6 Try to type past 500 (e.g. paste 600 chars, then attempt to add more).

- Expected: input **hard-caps at 500** (TextInput `maxLength={500}`). Counter never exceeds `500/500`.
- [x] PASS / [ ] FAIL

2.7 Tap backdrop (outside card) to dismiss. Re-open Avsluta.

- Expected: TextInput is **empty** (state reset on overlay close).
- [x] PASS / [ ] FAIL

2.8 Open Avsluta again → type `"Final note"` → tap **Avsluta** (the blue confirm button).

- Navigate to `Historik` → tap latest session.
- Verify notes-block displays `"Final note"` **above** the SummaryHeader chips.
- Verify SQL: `SELECT notes FROM workout_sessions ORDER BY finished_at DESC LIMIT 1;` → returns `"Final note"` exactly.
- [ ] PASS / [X] FAIL — When I type in the notes textinput i cant exit it when finishing text. I need to exit whole avsluta header but then the
- note doesnt save.

2.9 Repeat: start pass, log a set, finish with **empty TextInput** (don't type), tap Avsluta.

- Expected SQL: `SELECT notes FROM workout_sessions ORDER BY finished_at DESC LIMIT 1;` → returns **`NULL`**.
- [x] PASS / [ ] FAIL — SQL: ********\_\_\_\_********

2.10 Repeat with **whitespace-only** input (`"   "` — three spaces, no other chars).

- Expected SQL: returns **`NULL`** (D-N3 trim-normalization).
- [ ] PASS / [X] FAIL — SQL: When I type in the notes textinput i cant exit it when finishing text. I need to exit whole avsluta header but then the
- note doesnt save.

---

## Section 3 — F12 Notes view + edit in history-detail (steps 3.1–3.10)

Maps to SPEC acceptance rows 9–10. **Step 3.10 is NON-OPTIONAL per W-1 (T-07-03 FIFO verification).**

3.1 Navigate to a history session **with notes** (e.g. the one from Section 2.8).

3.2 Verify notes-block is visible **above** the SummaryHeader chips:

- Shows the notes text in regular weight.
- **Pencil-icon** on the right edge (tap target ≥44pt).
- [ ] PASS / [ ] FAIL - Cannot test

3.3 Tap pencil → edit-overlay opens.

- Pre-filled with current notes text.
- Keyboard auto-focuses on the TextInput.
- Same counter `{length}/500` behavior as Section 2.5/2.6.
- [ ] PASS / [ ] FAIL - Cannot test

3.4 Modify text to `"Edited note"` → tap **Spara**.

- Expected: overlay closes; notes-block **immediately** shows "Edited note" (optimistic update — no spinner / lag).
- SQL confirms: `SELECT notes FROM workout_sessions WHERE id='<sessionId>';` → `"Edited note"`.
- [ ] PASS / [ ] FAIL — SQL: ********\_\_\_\_******** - Cannot test

3.5 Tap pencil → **delete all text** (clear input) → tap **Spara**.

- Expected: notes-block flips to **"+ Lägg till anteckning"** affordance (accent color + circle icon).
- SQL: `SELECT notes ...` → `NULL`.
- [ ] PASS / [ ] FAIL — SQL: ********\_\_\_\_******** - Cannot test

3.6 Tap **"+ Lägg till anteckning"** (notes-null affordance) → overlay opens with **empty** TextInput.

- Type `"Added back"` → tap Spara.
- Notes-block re-renders with text + pencil-icon (back to filled state).
- [ ] PASS / [ ] FAIL When I type in the notes textinput i cant exit it when finishing text. I need to exit whole avsluta header but then the
- note doesnt save.

3.7 Tap pencil → modify text to "WILL CANCEL" → tap **Avbryt** (cancel button).

- Expected: overlay closes; notes-block still shows the **ORIGINAL** text (no save).
- Re-open pencil → TextInput shows the ORIGINAL text (no draft restoration — D-N4 ephemeral state).
- [ ] PASS / [ ] FAIL - Cannot test

3.8 **Offline edit** (T-07-03 single-mutation path): airplane mode ON → tap pencil → modify text to "Offline edit" → tap Spara.

- Expected: overlay closes; notes-block shows "Offline edit" optimistically.
- Reconnect (airplane mode OFF) → wait 5 sec.
- SQL confirms update landed: `"Offline edit"`.
- [ ] PASS / [ ] FAIL — SQL: ********\_\_\_\_********

3.9 **freezeOnBlur cleanup**: open edit-overlay → switch to `(tabs)/index` (Hem-tab) → switch back to history-detail.

- Expected: overlay is **closed**; tapping pencil again opens a **fresh** state (no stale draft visible).
- [ ] PASS / [ ] FAIL

### 3.10 — **NON-OPTIONAL** T-07-03 offline edit+delete race (W-1 fix)

**Purpose:** Exercises the `scope.id "session:${id}"` FIFO contract shared across `useFinishSession` / `useDeleteSession` / `useUpdateSessionNotes` (Plan 07-04 D-E3 + threat-register T-07-03). Without this row, T-07-03 is asserted in code but **never tested on hardware**.

**Setup:** ensure DevTools or React Query DevTools panel is reachable (Expo Dev Menu → Open React Query DevTools, or use the in-app inspector if wired). If neither is available, fall back to the deterministic node-script per the fallback note below.

**Order A — edit-then-delete:**
a. Pick a session that has notes (use one from Section 2.8 or 3.4 — record its sessionId here: `_______________________`).
b. Enable airplane mode.
c. Open the history-detail for that session.
d. Tap pencil → modify text to `"FIFO test A"` → tap **Spara**. Overlay closes; optimistic update shows new text.
e. Open overflow menu → **Ta bort** → confirm deletion. Session disappears from the list optimistically.
f. Disable airplane mode → wait 10 sec for both mutations to replay.

**Expected:** session is gone from the list. SQL: `SELECT count(*) FROM workout_sessions WHERE id='<sessionId>';` → **`0`**. No "stuck" mutation in the offline queue (DevTools mutation cache for this session is empty).

- [ ] PASS / [ ] FAIL
- SQL count: ****\_\_****
- DevTools mutation queue for this session: [ ] empty / [ ] non-empty (list mutation keys): ****\_\_****

**Order B — delete-then-edit** (create a fresh session with notes first):
a. Log a new session via Section 5's run-script with a notes-bearing finish. Record its sessionId: `_______________________`.
b. Enable airplane mode.
c. Open history-detail for the new session.
d. Open overflow menu → **Ta bort** → confirm. Queued; session optimistically gone (or shown in a deleted-pending state).
e. Tap **"+ Lägg till anteckning"** — the affordance should still work on the optimistically-deleted session because the detail-cache is still present (TanStack v5 paused mutation does not yet evict). Type `"FIFO test B"` → tap **Spara** (queued).
f. Disable airplane mode → wait 10 sec.

**Expected:** delete replays **first** (FIFO), then update-notes replays and 404s (session no longer exists). The `update-notes` `onError` fires; `setBannerError("Kunde inte spara anteckningen. Försök igen.")` lights the banner-error block briefly **OR** the rollback restores the (already deleted) cache to its previous state. Net result: session is gone; no orphan rows.

- SQL: `SELECT count(*) FROM workout_sessions WHERE id='<sessionId>';` → **`0`**.

- [ ] PASS / [ ] FAIL
- SQL count: ****\_\_****
- Banner-error observed: [ ] yes / [ ] no
- Net behavior description: ********\_\_\_\_********

**If 3.10 fails:** This is a **T-07-03 regression**. Capture a Linear issue:

```bash
npm run linear:create -- \
  --title "Bug: T-07-03 FIFO regression in offline edit+delete (Order A|B)" \
  --description "<paste DevTools mutation-cache snapshot + observed net behavior>" \
  --type bug --priority urgent --phase 7
```

**Do NOT mark Phase 7 approved** until 3.10 passes.

**Deterministic fallback (if airplane-mode toggling is flaky on this device):** Skip 3.10.d/e on hardware and substitute with a Node-script-driven assertion using `queryClient.getMutationCache().getAll()` from a paused state (see 07-04 Plan Task 1 action note). Mark 3.10 as `[ ] PASS via deterministic fallback` and attach the script output here:

- Output: ********\_\_\_\_********

---

## Section 4 — F15 Theme-toggle in Inställningar (steps 4.1–4.7)

Maps to SPEC acceptance rows 11–14.

4.1 Open `(tabs)/settings`. Verify a **`Tema`** section with SegmentedControl `[System | Ljust | Mörkt]` is visible between the email-row and the spacer above sign-out.

- [x] PASS / [ ] FAIL

4.2 With iPhone iOS in **Ljust** mode, app initially in **System** mode → tap **Mörkt**.

- Expected: app turns dark within 1 sec **without restart**. StatusBar icons turn light (so they're visible on the now-dark backdrop).
- [x] PASS / [ ] FAIL — Observed delay: **\_** sec

4.3 **Kill** the app (swipe up from app-switcher). Reopen via Expo Go.

- Expected: app starts in **Mörkt** mode (theme persisted to AsyncStorage under key `fm:theme`). **No FOUC** (no flicker from Ljust → Mörkt during splash — `ThemeBootstrap` rehydrates before `SplashScreenController` hides the splash).
- [x] PASS / [ ] FAIL — FOUC observed: [ ] no / [ ] yes (describe: ********\_\_\_\_********)

4.4 In settings, tap **Ljust** → app turns light immediately. StatusBar icons turn dark.

- [x] PASS / [ ] FAIL

4.5 Tap **System** → app follows iOS:

- With iPhone iOS=Ljust → app=Ljust.
- Toggle iPhone iOS to Mörkt (Control Center / Settings → Display & Brightness → Dark) → app flips to Mörkt automatically (no manual app interaction needed).
- [x] PASS / [ ] FAIL

4.6 (T-07-01 corruption-resilience) From a dev tool/REPL: `await AsyncStorage.setItem('fm:theme', 'hax')`. Kill + reopen app.

- Expected: app defaults to **System** mode, no crash. `console.warn '[theme] AsyncStorage read failed — defaulting to system'` may appear in the Metro console (acceptable).
- [ ] PASS / [ ] FAIL -N/A
- **If dev REPL not available, mark this row N/A** and document the Zod-enum-catch coverage in the SUMMARY instead (Plan 07-01 SUMMARY confirms the catch).

4.7 **StatusBar contrast across 9 (app-mode × iOS-mode) combinations**: walk through each pair and verify status-bar icons are **visible** against the backdrop (not white-on-white or black-on-black).

| App-mode \ iOS-mode | iOS Ljust           | iOS Mörkt           | iOS Auto (sunset)   |
| ------------------- | ------------------- | ------------------- | ------------------- |
| System              | [X] PASS / [ ] FAIL | [X] PASS / [ ] FAIL | [X] PASS / [ ] FAIL |
| Ljust               | [X] PASS / [ ] FAIL | [X] PASS / [ ] FAIL | [X] PASS / [ ] FAIL |
| Mörkt               | [X] PASS / [ ] FAIL | [X] PASS / [ ] FAIL | [X] PASS / [ ] FAIL |

---

## Section 5 — Core-flow ≤ 2 min × 3 timed runs (SPEC §6)

Maps to SPEC acceptance row 15.

For each run, use a stopwatch. **Start** when tapping the Hem-tab; **stop** when the history-detail screen has rendered the just-finished session.

**Run script** (8 steps, per CONTEXT.md `<specifics>` Core-flow):

1. Tap **Hem**-tab.
2. Tap **"Starta pass"** on an existing plan.
3. Log set 1: vikt + reps + RPE → **Klart**.
4. Log set 2: same exercise, next set → **Klart**.
5. Log set 3: **next exercise**, set 1 → **Klart**.
6. Tap **Avsluta** in header → AvslutaOverlay → (optionally) type a note → tap **Avsluta**.
7. Tap **Historik**-tab → tap the just-finished session.
8. Verify in detail view: **RPE-suffix on at least one set-row** + **notes-block displayed** (if a note was typed in step 6).

| Run | Start (HH:MM:SS) | End (HH:MM:SS) | Duration | Pass (≤ 2 min)?  | Notes / Bugs |
| --- | ---------------- | -------------- | -------- | ---------------- | ------------ |
| 1   |                  |                |          | [ ] YES / [ ] NO |              |
| 2   |                  |                |          | [ ] YES / [ ] NO |              |
| 3   |                  |                |          | [ ] YES / [ ] NO |              |

**Result:** 3 of 3 runs ≤ 2 min: [ ] YES / [ ] NO (SPEC §6 acceptance — all three must pass)

---

## Static gate cross-check (SPEC acceptance rows 16–19)

These are automated, already captured in Section 0. Re-run if any post-UAT code change is made.

| Row | Gate                      | Section 0 result | Notes                                                                                                                                                                     |
| --- | ------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 16  | No new `00XX_*.sql` in P7 | 0.6 PASS         | Latest migration `0006_phase6_chart_rpcs.sql` (Phase 6).                                                                                                                  |
| 17  | Service-role audit clean  | 0.7 PASS\*       | Zero matches inside Metro-bundled paths (`app/lib/`, `app/app/`, `app/components/`). Allowlist matches expanded by Phase 3–6 Node-only scripts (documented in Section 0). |
| 18  | `npm run test:rls` green  | 0.3 PASS         | All assertions passed (incl. Phase 5 dedupe + Phase 6 cross-user).                                                                                                        |
| 19  | `npm run test:f13-brutal` | 0.4 PASS         | Exit 0 (no recent session in lookback window — re-run after Section 5 to validate the post-Section-5 sessions).                                                           |

---

## Sign-off

- **Tested-by:** ********\_\_\_\_********
- **Date:** YYYY-MM-DD
- **Branch head commit at sign-off:** `____________________` (run `git rev-parse HEAD` at sign-off time; must match Section 0 capture or document any intermediate fixes below)
- **All 19 SPEC acceptance criteria covered above:** [ ] yes
- **Non-optional T-07-03 row (Section 3.10) covered (Order A + Order B):** [ ] yes _(W-1 — MUST be checked before approval)_
- **Decision:** [ ] approved / [ ] partial (list gaps below) / [ ] blocked (reason below)

**Carry-over Linear issues created during UAT:** ********\_\_\_\_******** (FIT-XX format, comma-separated)

**Partial / blocked notes:**

> _If decision is `partial` or `blocked`, list each gap with the section number it falls under (e.g. "3.10 Order B — banner-error never appeared; SQL count=1, session not deleted"). Open a Linear bug per gap before proceeding._

---

## Post-sign-off actions

If decision = **approved**:

1. Commit this file: `git add .planning/phases/07-v1-polish-cut/07-HUMAN-UAT.md && git commit -m "docs(07-05): UAT signed off, Phase 7 approved [FIT-73]"`.
2. Run `/gsd-secure-phase 7` → `/gsd-verify-work 7` → `/gsd phase.complete 7`.
3. Phase branch auto-PRs to `dev` via `.github/workflows/phase-branch.yml`.
4. 4-week personal soak validation begins per PRD §8.

If decision = **partial**:

- Each FAIL must have a Linear issue (`npm run linear:create -- --type bug --priority high --phase 7`).
- Fix issues in-branch (no `phase.complete`) or carry to a Phase 7.5 / V1.1 backlog with explicit acceptance.

If decision = **blocked**:

- Do not commit. Surface the blocker; phase remains in-progress until resolved.
