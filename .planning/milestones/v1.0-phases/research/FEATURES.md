# Feature Research

**Domain:** Personal strength-training / gym workout tracker (iOS, single-user V1, App Store-eligible V2)
**Researched:** 2026-05-07
**Confidence:** HIGH (multiple independent 2026 reviews, vendor docs, and Reddit synthesis converge)
**Competitor set:** Hevy, Strong, FitNotes (incl. FitNotes 2/X for iOS), Liftin', with Jefit and Stronglifts as secondary references.

---

## Executive Summary

The strength-tracker category in 2026 is mature and converged. The four reference apps share an identical core loop:
**Plan → start session → for each exercise see "previous" set → log weight × reps → finish & save → review history (list + chart).**
Where they differ is on three axes: (1) **social/community** (Hevy ships it, Strong/FitNotes/Liftin' do not), (2) **programming intelligence** (Liftin' has auto-progression rules, Stronglifts/Jefit have built-in templates, others do not), and (3) **paywall posture** (Hevy and FitNotes have generous free tiers; Strong gates routines, Liftin' caps at 5 workouts/month free).

The PRD's F1–F15 covers the **entire core loop** correctly. The category-defining "previous value at logging time" feature (F7) is exactly what every competitor centers their UX on — Hevy literally calls it the `PREVIOUS` column. The PRD is well-aligned with table stakes for a personal-use V1.

However, **four near-table-stakes features are missing or under-specified** and should be added — for personal use to feel competent, and for V2 App Store launch to not feel broken vs. the free tier of Hevy. They are: rest timer, set type tagging (warm-up/working), explicit personal-record (PR) detection, and unit preference (kg/lbs). All are LOW complexity. Three small **cheap differentiators** are also identified.

---

## Feature Landscape

### Table Stakes (Users Expect These)

These are non-negotiable for the App Store version (V2). For personal V1, anything not in PRD is flagged as **GAP**. PRD requirements are noted with their F-ID.

| Feature | Why Expected | Complexity | Notes / Competitor Behavior |
|---------|--------------|------------|-----------------------------|
| **Email/password auth** (F1) | Cross-device sync, account recovery | LOW | All four ship this. Standard Supabase Auth. |
| **CRUD on workout plans/routines** (F2) | The "plan" is the unit of repeat work — without it the app is just a notepad | LOW | Hevy: "Routines". Strong: "Routines". FitNotes: "Routines". Identical model. |
| **Custom exercise creation** (F3, partial) | Every gym has weird machines; no library is complete | LOW | All four allow custom exercises. Hevy/Strong/Jefit ship a seeded library on top; FitNotes does too. PRD defers seed library — see GAP below. |
| **Reorder exercises within a plan** (F4) | Order matters for gym flow / supersets | LOW | All ship drag-to-reorder. |
| **Start session from a plan** (F5) | The "begin workout" tap is the most-used button in the app | LOW | All have a single primary CTA. |
| **Log set as (weight, reps) tuple** (F6) | The atomic unit of strength tracking | LOW | All four. Reps-only (bodyweight) and weight-only (timed) variants exist but PRD's vikt+reps covers >95% of use. |
| **Show previous performance per exercise at log time** (F7) | This is *the* category-defining feature. Hevy literally has a `PREVIOUS` column. Removing it = the app has no point. | LOW–MEDIUM | Source: hevyapp.com/features/track-exercises. Tap-to-copy from previous to current is a common micro-feature; consider in V1.1. |
| **Finish & persist session with timestamp** (F8) | Otherwise data is ephemeral | LOW | Trivially implied. |
| **History list (past sessions)** (F9) | Users want to glance at "what did I do Tuesday" | LOW | All ship calendar + list view. |
| **Per-exercise progress chart over time** (F10 — currently "Bör") | Mature competitors all have it; Reddit synthesis ranks it #2 most-cited feature (~70% of threads). Promote to "Måste" for V2 acceptance — keep "Bör" for V1 personal. | MEDIUM | victory-native or react-native-skia handles it. Plot max weight + total volume over time per exercise. |
| **Offline logging that survives no signal** (F13 — already bumped to "Måste") | Gyms have basements, dead zones, locker rooms. Reddit complaint #1 about Hevy is "needs internet". | MEDIUM–HIGH | Hevy fails here; Strong, FitNotes, Liftin' all work fully offline. PRD already correct. |
| **Dark mode** (F15) | iOS users expect it system-respecting in 2026 | LOW | Trivial with NativeWind `dark:` classes. PRD has it. |
| **Rest timer between sets** | Reddit-cited; Hevy, Strong, FitNotes, Fitbod all ship; users complain when missing | LOW | **GAP — not in PRD.** Auto-trigger countdown when a set is marked complete; per-exercise default duration. Implementable with a `setInterval` and a notification on background. Add as new F-ID, V1 "Bör" or V1.1. |
| **Set-type tagging (warm-up vs working set)** | All four reference apps support it; affects volume calculation and PR detection | LOW | **GAP — not in PRD.** A simple enum on `exercise_sets` (`set_type`: working/warmup/dropset/failure). Schema impact only — UI is one toggle/segmented control per set row. |
| **Personal record (PR) detection & callout** | Strong, Hevy, RepCount all auto-detect "best weight × reps", "estimated 1RM PR", "volume PR" and surface a star/celebration. This is the dopamine of the app. | LOW–MEDIUM | **GAP — not in PRD.** Estimated 1RM via Epley `w * (1 + r/30)` is a one-line function. Comparing to history per exercise on save is cheap. Strongly recommend adding for V2; for V1 personal it's still motivating. |
| **Unit preference (kg vs lbs)** | Mandatory for App Store — half your users are American | LOW | **GAP — not in PRD.** Profile-level setting; store all weights in one canonical unit (kg) and convert on display. Add now even for V1: trivial cost, big later cost if retrofitted. |
| **Apple Sign-In** (F14) | App Store requirement: if you offer email auth + any other social auth, Apple Sign-In is mandatory. For email-only it's not strictly required, but expected for iOS users. | LOW–MEDIUM | PRD correctly defers to V1.1. Important for V2 store submission. |
| **Notes per session** (F12 — currently "Kan") | All four competitors ship it. Used for "felt heavy", "skipped warmup", "new shoes". | LOW | One `text` column on `workout_sessions`. PRD has it as "Kan" — fine for personal V1; promote to "Bör" for V2. |

**Summary of GAPs vs. PRD:** 4 missing table-stakes features (rest timer, set-type tag, PR detection, unit preference). All are LOW complexity. Three are pure data-model + small UI; one (rest timer) is a small native feature. None block V1 if user is solo, but **all four should be in V2 before App Store**.

---

### Differentiators (Competitive Advantage)

Features that the PRD's *Core Value* ("Logga ett set och omedelbart se vad jag tog senast — utan att tappa data, någonsin") naturally supports, and where competitors are weak. These are *cheap-to-add wins for a personal-use app that wants V2 App Store potential*.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Bulletproof offline-first with visible sync state** | Hevy users complain about needing internet; Strong/FitNotes work offline but FitNotes has no cloud sync at all (iOS FitNotes 2 charges for it). A tracker that is *both* fully offline-loggable *and* cloud-synced *and* shows the user a clear "X sets pending sync" indicator would beat all four on this axis. PRD's "ALDRIG förlora ett set" is exactly this pitch. | MEDIUM | Already a V1 Måste (F13). Add a tiny `pending_sync_count` UI badge — turns a non-functional requirement into a marketable feature. |
| **Sub-3-second set logging (measured & defended)** | Reddit's #1 complaint is "logging disrupts workout flow" — cited in ~80% of threads. PRD already specifies ≤3s as a constraint. Treat as a feature, not just a perf goal: e.g., big touch targets, +/- steppers with last-used increment, no modal nesting, optimistic UI. | LOW | Pure UX discipline. Pre-fill weight/reps from previous set on the same exercise. |
| **"Quick repeat last session"** | Tap one button on home: "Repeat last Push Day" — pre-fills today's targets with last session's performance. Strong has a similar pattern; Hevy half-does it via routines. | LOW | Just a query `session WHERE plan_id = X ORDER BY started_at DESC LIMIT 1` plus a CTA. Aligns directly with Core Value. |
| **No paywall, no ads, ever** (V2 stance) | Hevy free is generous but pushes Pro; Strong gates routines; Liftin' caps free at 5 workouts/month. A genuinely free, ad-free personal tracker is rare and rated highly (FitNotes' free-forever stance is its #1 praised attribute). | LOW (it's a non-feature) | Document explicitly. Donations or one-time IAP for cosmetic themes is acceptable; subscriptions for core logging would be a category mistake. |
| **Plan-aware "previous"** (subtle but powerful) | Hevy's PREVIOUS column shows the last time *anywhere* you did the exercise. Some users want "last time on this *plan*" (e.g., last Push Day specifically), which is more apples-to-apples for progression. Showing both — global last and plan-scoped last — is a fast micro-differentiator. | LOW | Two queries instead of one; surface them both in the log row. Differentiator if marketed as "see your last Push Day, not your last bench". |

**Recommended cheap differentiators for V2** (if pursuing App Store): pick **2–3 of: visible sync state, sub-3s logging defended in App Store copy, quick-repeat-last-session, plan-aware previous**. All are <1 day of work each on top of table stakes.

---

### Anti-Features (Commonly Requested, Often Problematic)

The PRD's Section 3 (Icke-mål) and PROJECT.md's Out of Scope already list most of these correctly. Surfaced here with explicit *why* and *what to do instead* for the roadmap consumer.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Social feed / followers / leaderboards** | Hevy makes this its hook; users assume "modern app = social". | Massive scope: moderation, abuse reporting, blocking, GDPR, privacy settings, push infra. Distracts from core loop. PRD Core Value is *personal* — "logga *jag* tog senast", not "see what Linda did". | Out of scope V1 + V2. If ever, V3+. Document publicly so users self-select. |
| **AI coach / programming suggestions / "next workout" auto-gen** | Fitbod's pitch; users see "AI" everywhere in 2026. | Either it's a thin LLM wrapper (gimmicky, expensive per-user) or rule-based progression like Stronglifts (locks user into one methodology). Solving "what should I do next" is a different product. | Defer indefinitely. PRD Core Value is "see what *I* did", not "tell me what to do". A `notes` field (F12) lets the user write their own plan. |
| **Built-in exercise videos/animations** | "How do I do this exercise?" | Asset production cost is real (need shoots or licensing); storage/bandwidth real; users mostly already know the lifts. Liftin'/Strong/FitNotes don't ship videos in their core. | Out of scope. Link out to YouTube from exercise detail at most (V2+). PROJECT.md already excludes. |
| **Apple Watch app** (V1) | Reddit cites ~55% of users mention it. | Significant scaffolding (WatchOS target, separate sync logic, EAS build complexity), and PRD platform is "Windows-only dev, no Mac initially". Liftin's Watch integration is its main paid differentiator. | Defer to V2 (PROJECT.md correctly excludes V1). Re-evaluate at V2 — likely worth it for App Store credibility, but only after iPhone is rock solid. |
| **Android version** (V1) | Half the world's phones. | RN/Expo cost to add Android is "low" mechanically but high in QA, store listing, support. Doubles surface area before V1 has a single happy user. | Defer. Expo lets you flip the switch later. PRD/PROJECT correctly exclude. |
| **Pre-loaded exercise library (V1)** | Onboarding feels barren without it. Strong/Hevy/Jefit all seed 300+ exercises. | Curation is real work (names, muscle groups, equipment categories, i18n: Swedish vs English names); for *one user* (the dev) it's overhead. | PRD correctly defers (Out of Scope V1). The schema in ARCHITECTURE.md already permits null `user_id` for global seed in V2 — well-architected. **Note for V2 launch:** ship with seed before App Store — solo users will not patiently create 50 exercises before logging their first set. |
| **CSV export / data portability** (V1) | "I don't want to be locked in." | Real but premature concern for personal V1. | Defer to V2 (PROJECT.md correctly excludes). Trivial when needed: Supabase already speaks SQL → user can dump on demand. |
| **Programming templates (5/3/1, PPL, GZCLP)** | Reddit's ~65% of threads cite this. Stronglifts/Jefit/Liftin' built businesses on it. | Each template is a small product: needs progression logic, deload detection, AMRAP rules. Locks the data model into "program-as-first-class-citizen". | Defer to V2+ (PROJECT.md correct). The user can manually create a "5/3/1 Bench" plan and log it; that's good enough for personal V1. |
| **Real-time multiplayer / shared workouts** | Couples/training partners ask for it. | Sync conflict hell, presence infra, bidirectional updates. Not core. | PROJECT.md "delade pass" is V2+; keep there. |
| **Nutrition/macro tracking** | "While I'm tracking lifts, why not food?" | Different product, different competitors (MyFitnessPal). Bloats schema and UX. | Hard no. Out of scope forever for this app's identity. |
| **Body measurements tracking (chest, waist, etc.)** | All four competitors offer it. | Genuinely orthogonal to strength tracking; adds a whole UI surface. | V2 "Kan". Bodyweight alone (one number) is OK to add at V2; full circumference tracking is bloat. |
| **Gamification (streaks, badges, XP)** | Engagement growth-hacker default. | Distracts from "did I get stronger" with "did I log today". Also creates pressure to log on rest days. | Avoid. PR-detection (above) gives the dopamine without the dark patterns. |

---

## Feature Dependencies

```
F1 (auth) ──required-by──> F2, F3, F5–F13 (everything user-scoped)
                            │
F3 (exercises) ──required-by──> F4 (plan-exercises) ──required-by──> F5 (start session)
                                                                       │
F2 (plans) ──required-by──> F5 ──required-by──> F6 (log sets)
                                                  │
                                                  ├──required-by──> F7 (previous value lookup needs prior F6 data)
                                                  ├──required-by──> F8 (finish session)
                                                  ├──required-by──> F11 (RPE is a column on a set)
                                                  └──required-by──> [NEW] PR detection, set-type tag, rest timer

F8 ──required-by──> F9 (history) ──required-by──> F10 (chart from history)

F13 (offline) ──cross-cuts──> F6, F7, F8 (the entire write path must be offline-tolerant)
F14 (Apple Sign-In) ──enhances──> F1
F15 (dark mode) ──independent──> everything (theming layer)

[NEW] Unit preference (kg/lbs) ──must-precede──> F6 storage decision
                                  (decide canonical unit before first weight is persisted)

[NEW] Set-type tag ──enhances──> F7 (filter "previous" to working sets only)
                  ──enhances──> [NEW] PR detection (warmups don't count as PRs)

[NEW] Rest timer ──enhances──> F6 (triggered when a set is marked complete)
                ──independent──> everything else
```

### Dependency Notes

- **F7 depends on F6 and history reading:** The "previous value" display is just a query against past `exercise_sets` rows for the same exercise. It is the simplest yet most valuable feature in the app. Implement it the same day as F6 — they share UI.
- **Unit preference must land before any weight is stored:** Cheaper to decide canonical storage unit (kg) and conversion-on-display now than to migrate later. *Add to ARCHITECTURE schema review for Phase 1.*
- **F13 (offline) cross-cuts the write path:** Cannot be retrofitted cleanly. PRD/PROJECT correctly bumped this to V1 Måste. TanStack Query mutations + a local queue (the stack already supports this pattern) is the implementation path.
- **F10 (charts) requires no new data, only new screen:** Pure read-side. Defer cleanly to V1.1 if running short on time.
- **PR detection requires history query on save:** Couples to F8 (finish session) — compute PRs at session-end, persist to a `personal_records` table or a `?` column. LOW complexity.

---

## MVP Definition

### Launch With (V1 — personal use, weeks 1–6)

The bare minimum for the developer to use it daily without going back to paper. This matches PRD V1 Måste exactly:

- [x] **F1** Email/password auth — required for cross-device.
- [x] **F2** Create/edit/delete plans — the unit of repeat work.
- [x] **F3** Custom exercises — without a seeded library, custom is the only option.
- [x] **F4** Add/reorder exercises in a plan — flow matters.
- [x] **F5** Start session from plan — primary CTA.
- [x] **F6** Log sets (weight + reps) — atomic unit.
- [x] **F7** Show previous value at log time — **the core value proposition**. Without this the app has no point of existing.
- [x] **F8** Finish & save session.
- [x] **F9** History list.
- [x] **F13** Offline logging — already bumped, correctly.
- [ ] **[NEW] Unit preference (kg/lbs)** — *add to V1 even for personal use*. Trivial cost now, expensive cost to retrofit later. Default kg (Sweden); store canonical kg.

### Add After Validation (V1.1 — still personal use, weeks 6–10)

Trigger: V1 has been used for 4+ consecutive weeks without going back to paper (PRD §8 success criteria).

- [ ] **F10** Per-exercise progress chart — once enough data exists to graph.
- [ ] **F14** Apple Sign-In — required before any TestFlight/App Store path.
- [ ] **F15** Dark mode — pure quality-of-life.
- [ ] **F11** RPE field — power user, defer until F6 flow is fast.
- [ ] **F12** Session notes — defer until you've felt the lack of it.
- [ ] **[NEW] Rest timer** — between sets. Add when you've felt yourself looking at the wall clock.
- [ ] **[NEW] Set-type tag** (warmup/working) — once volume math gets confused by warmups.
- [ ] **[NEW] PR detection & celebration** — once you have enough history to break a PR.

### Future Consideration (V2 — App Store path)

Pre-store-submission must-haves on top of V1.1:

- [ ] **Seeded global exercise library** — onboarding deathblow without it. Schema already supports it.
- [ ] **Plan-aware "previous"** (last time on this specific plan) — cheap differentiator.
- [ ] **"Repeat last session" CTA** — cheap differentiator.
- [ ] **Visible sync-state badge** ("3 sets pending sync") — turns offline-first into a marketable feature.
- [ ] **Apple Health integration** — read body weight, write workout sessions. PROJECT marks V2.
- [ ] **Home-screen widgets** — last lift, today's plan. PROJECT marks V2.
- [ ] **CSV export** — App Store reviewers and power users expect it. PROJECT marks V2.
- [ ] **Bodyweight tracking** (single number, not full body measurements) — minimal scope; pairs well with Apple Health.

Defer beyond V2:
- Programming templates (5/3/1, PPL) — V2+ per PROJECT.
- Apple Watch app — V2+ per PROJECT, evaluate after iPhone proves out.
- Android — V2+ per PROJECT.
- Web app — V2+ per PROJECT (same Supabase backend, mostly free).
- Shared sessions — V2+ per PROJECT.

---

## Feature Prioritization Matrix

PRD F-IDs first, then proposed additions, sorted by recommended priority.

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| F7 Previous value at log time | HIGH (core value) | LOW | **P1** |
| F6 Log sets (weight+reps) | HIGH | LOW | **P1** |
| F13 Offline logging | HIGH (data integrity) | MEDIUM | **P1** |
| F2 Plans CRUD | HIGH | LOW | **P1** |
| F3 Custom exercises | HIGH | LOW | **P1** |
| F4 Reorder exercises | MEDIUM | LOW | **P1** |
| F5 Start session | HIGH | LOW | **P1** |
| F8 Finish & save session | HIGH | LOW | **P1** |
| F9 History list | HIGH | LOW | **P1** |
| F1 Email auth | HIGH (sync prerequisite) | LOW | **P1** |
| **[NEW] Unit preference (kg/lbs)** | MEDIUM (V1) → HIGH (V2) | LOW | **P1** (cheap to do now, expensive later) |
| F10 Progress chart | MEDIUM | MEDIUM | **P2** (V1.1) |
| F15 Dark mode | MEDIUM | LOW | **P2** (V1.1) |
| F14 Apple Sign-In | LOW (V1) → HIGH (V2) | LOW–MEDIUM | **P2** (V1.1, blocking V2) |
| **[NEW] Rest timer** | MEDIUM | LOW | **P2** (V1.1) |
| **[NEW] Set-type tag** | MEDIUM | LOW | **P2** (V1.1, schema ideally V1) |
| **[NEW] PR detection** | MEDIUM (V1) → HIGH (V2) | LOW–MEDIUM | **P2** (V1.1) |
| F12 Session notes | LOW (V1) → MEDIUM (V2) | LOW | **P3** (V1.1 / V2) |
| F11 RPE field | LOW (mass) → MEDIUM (power users) | LOW | **P3** (V1.1) |
| **[NEW] Plan-aware "previous"** | MEDIUM (differentiator) | LOW | **P3** (V2) |
| **[NEW] Repeat-last-session CTA** | MEDIUM (differentiator) | LOW | **P3** (V2) |
| **[NEW] Visible sync-state badge** | MEDIUM (differentiator) | LOW | **P3** (V2) |
| Seeded exercise library | HIGH for new users (V2) | MEDIUM (curation) | **P3** (V2 blocker) |

**Priority key:**
- **P1**: Must have for V1 (personal usable in 4–6 weeks).
- **P2**: Should ship in V1.1 (post-validation, pre-store).
- **P3**: V2 / App Store launch.

---

## Competitor Feature Analysis

| Feature | Hevy | Strong | FitNotes | Liftin' | FitnessMaxxing approach |
|---------|------|--------|----------|---------|-------------------------|
| Plans/routines CRUD | Yes (free) | Free gates after 3 routines | Yes (free) | Yes (free, capped at 5 workouts/mo) | F2 — yes, no caps |
| Custom exercise creation | Yes | Yes | Yes | Yes | F3 — yes (no seed in V1; seed in V2) |
| Pre-loaded exercise library | ~600 seeded | ~400 seeded | ~250 seeded | Yes (with programs) | **V1: none; V2: required.** Schema supports null `user_id`. |
| Previous value at log time | `PREVIOUS` column, tap-to-copy | Built-in | Last session shown | Built-in | F7 — primary feature; tap-to-copy in V1.1 |
| Rest timer | Auto, per-exercise default | Auto countdown | Yes | Yes | **GAP — add as new requirement, V1.1.** |
| Set-type tags (warmup/working/dropset) | Yes (warmup/working/drop/failure) | Yes (warmup tag) | Yes | Yes | **GAP — add new column on `exercise_sets`, V1 schema, V1.1 UI.** |
| PR detection | Yes (auto, per rep range) | Yes (advanced stats) | Yes | Yes | **GAP — add new requirement, V1.1.** Epley estimate. |
| RPE field | Pro only | Yes (free) | Yes (custom field) | Yes | F11 — V1 "Kan", correct |
| Per-exercise progress chart | Yes | Yes | Yes (volume) | Yes | F10 — V1 "Bör", correct |
| Body weight / measurements | Yes | Yes | Yes | Yes | **V1 out of scope; V2 add bodyweight only.** |
| Notes per session | Yes | Yes | Yes | Yes | F12 — V1 "Kan", correct |
| Session notes per exercise | Yes (Pro?) | Yes | Yes | Yes | Out of scope V1; reconsider V2. |
| Supersets (group exercises) | Yes | Yes | Limited | Yes | **Out of scope V1.** Consider V2 — schema can model via `plan_exercises.group_id`. |
| Plate calculator | Yes (Pro) | Yes (free) | No | Yes | **Out of scope V1.** Cheap V2 add. |
| Warm-up auto-calc | Yes (Pro) | No | No | No | **Out of scope V1.** Defer. |
| Apple Watch app | Yes (Pro) | Yes | No (Android-first) | Yes (their main differentiator) | Out of scope V1, evaluate V2. |
| Apple Health integration | Yes | Yes | No | Yes | Out of scope V1, V2 add. |
| Offline-first | **No** (online-required for many features) | Yes | Yes (no cloud at all on Android) | Yes | **F13 — yes, *and* cloud-sync. This is our edge over Hevy + over FitNotes Android.** |
| Cloud sync across devices | Yes | Yes (Pro on Android) | No (Android free) / Pro (iOS FitNotes 2) | Yes | F1+Supabase — yes, included, no paywall. |
| Social feed / followers | Yes (free) | No | No | No | **Hard no.** Anti-feature. Out of scope forever. |
| CSV export | Yes (Pro) | Yes (free) | Yes (free) | Yes | Out of scope V1, V2 add (trivial). |
| Free tier completeness | Excellent | Limited (3 routines) | Best in class (Android) | Capped (5 workouts/mo) | **Match FitNotes' generosity: free forever, no caps, no ads.** |
| Pricing model | $5.99/mo or $34.99/yr Pro | $29.99/yr or lifetime | Free forever (Android) / paid sync (iOS) | $24.99/yr | Free V1 (personal), free V2 (App Store, optional cosmetic IAP later). |
| Programming templates (5/3/1, PPL) | No (just routines) | No | No | **Yes (built-in)** | Out of scope. PROJECT correct. |
| AI / coach suggestions | No | No | No | Auto-progression rules only | **Anti-feature. No.** |
| Dark mode | Yes | Yes | Yes | Yes | F15 — yes |

**Read of the table:** PRD covers the core loop. Four near-table-stakes gaps (rest timer, set-type, PR detection, units) are all LOW complexity. Anti-features are correctly avoided. The differentiator opportunity is **offline-first + cloud-sync + no paywall** — none of the four competitors has all three simultaneously (Hevy lacks offline, FitNotes Android lacks sync, Strong/Liftin' lack the free tier).

---

## Recommendations to Roadmap Consumer

1. **Keep PRD F1–F15 exactly as scoped for V1.** The categorization holds: Måste/Bör/Kan is sound. Don't churn it.

2. **Add four new requirements (call them F16–F19) with the priorities below.** All are LOW complexity and either belong in V1 or V1.1:
   - **F16 — Unit preference (kg/lbs)**: V1 Måste (schema impact). Profile-level setting, store canonical kg.
   - **F17 — Rest timer between sets**: V1.1 Bör. Auto-trigger on set complete; per-exercise default seconds.
   - **F18 — Set-type tag (warmup/working/dropset/failure)**: V1 Måste for *schema* (column on `exercise_sets`); V1.1 Bör for *UI*. Cheap to migrate later but cheaper still to add now.
   - **F19 — Personal record detection (max weight, est. 1RM via Epley, max volume per session)**: V1.1 Bör. Compute on session save; surface a celebration in history.

3. **Three cheap V2 differentiators to plan for** (not V1, but call them out so V1 architecture doesn't block them):
   - Plan-scoped "previous" alongside global "previous".
   - "Repeat last session" home-screen CTA.
   - Visible offline sync-state badge.

4. **Hold the line on anti-features.** Specifically: no social, no AI coach, no videos, no nutrition, no gamification streaks. PROJECT.md's Out of Scope list is correct and should not be relitigated in any phase planning.

5. **Pre-V2-launch checklist** (when App Store path activates): seeded exercise library, Apple Sign-In (F14), Apple Health (read bodyweight + write workouts), CSV export, plate calculator, supersets. Each LOW–MEDIUM complexity.

---

## Sources

Competitor product pages and reviews:
- [Hevy — official features list](https://www.hevyapp.com/features/) — vendor docs, HIGH confidence on Hevy capabilities.
- [Hevy — Previous Workout Values feature](https://www.hevyapp.com/features/track-exercises/) — confirms `PREVIOUS` column UX pattern.
- [Hevy — Workout Rest Timer feature](https://www.hevyapp.com/features/workout-rest-timer/) — auto-trigger pattern.
- [Hevy — Warm-up Sets Calculator](https://www.hevyapp.com/features/warm-up-set-calculator/) — confirms warmup is table stakes among premium apps.
- [Strong — strong.app](https://www.strong.app/) — vendor.
- [FitNotes — fitnotesapp.com](http://www.fitnotesapp.com/) — vendor.
- [FitNotes — Workout Tracking](http://www.fitnotesapp.com/workout_tracking/) — confirms minimalist core loop.
- [Liftin' — App Store listing](https://apps.apple.com/us/app/liftin-gym-workout-tracker/id1445041669) — confirms 5-workout free cap, $24.99/yr, Watch-first DNA.
- [Liftin' — liftinapp.co](https://www.liftinapp.co/) — auto-progression rules and Watch integration.

Comparison reviews (2026):
- [Strong vs Hevy 2026 — pumpx.app](https://pumpx.app/blog/strong-vs-hevy/) — pricing and feature deltas.
- [Strong vs Hevy 2026 — gymgod.app](https://gymgod.app/blog/strong-vs-hevy) — confirms Strong's powerlifting/precision positioning vs Hevy's social positioning.
- [Strong vs Hevy 2026 — prpath.app](https://prpath.app/blog/strong-vs-hevy-2026.html)
- [Best Strength Training Apps 2026 — askvora.com](https://askvora.com/blog/best-strength-training-apps-2026) — multi-app comparison with feature matrix.
- [Best Strength Training Apps 2026 — findyouredge.app](https://www.findyouredge.app/news/best-strength-training-apps-2026)
- [Best Workout Tracker Apps 2026 — strongermobileapp.com](https://www.strongermobileapp.com/blog/best-workout-tracker-apps)
- [Best Workout Tracker Apps 2026 — Fitbod blog](https://fitbod.me/blog/best-workout-tracker-apps-for-2026/)
- [Hevy review 2026 — repreturn.com](https://repreturn.com/hevy-app-review/) — confirms Hevy's free tier is genuinely usable.
- [Hevy review 2026 — hotelgyms.com](https://www.hotelgyms.com/blog/hevy-workout-app-review-the-up-and-comer-taking-the-fitness-world-by-storm)

Reddit synthesis:
- [Setgraph — Reddit synthesis on workout trackers](https://setgraph.app/ai-blog/best-workout-tracker-app-reddit) — top 5 Reddit-cited features (fast logging, charts, custom routines, Watch, free tier).
- [Setgraph — Best App to Log Workout 2025](https://setgraph.app/ai-blog/best-app-to-log-workout-tested-by-lifters)
- [Setgraph — Best Strong Alternatives 2025](https://setgraph.app/articles/best-strong-app-alternatives-(2025))
- [Cora App — Best Workout Tracker Reddit 2026](https://www.corahealth.app/blog/best-workout-tracker-reddit)

Confidence assessment:
- **Competitor feature presence** (what Hevy/Strong/FitNotes/Liftin' ship): HIGH — confirmed via vendor docs.
- **Reddit user priorities** (fast logging, offline, free tier): MEDIUM-to-HIGH — synthesized from review blogs that reference Reddit threads; would be HIGH if I'd queried Reddit directly, but the convergence across 6+ independent 2026 review sites is strong.
- **Pricing details**: MEDIUM — pricing changes; verify before any go-to-market copy.
- **PR detection + Epley formula universality**: HIGH — well-established, multiple sources.

---

*Feature research for: personal strength-training tracker (FitnessMaxxing)*
*Researched: 2026-05-07*
