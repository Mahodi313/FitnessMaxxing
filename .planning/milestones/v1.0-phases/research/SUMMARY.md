# Project Research Summary — FitnessMaxxing

**Project:** FitnessMaxxing (personal iPhone gym tracker)
**Domain:** Offline-first strength-training tracker on Expo SDK 54 + Supabase, single-user V1, App Store-eligible V2
**Researched:** 2026-05-07
**Audience:** A developer experienced in other languages but **new to React Native + TypeScript**.
**Confidence:** HIGH overall (Context7-verified stack and patterns; competitor feature set converges across 6+ 2026 reviews; pitfalls grounded in official Supabase / Reanimated / TanStack docs).

---

## Executive Summary

FitnessMaxxing is a saturated-category app — strength trackers in 2026 (Hevy, Strong, FitNotes, Liftin') have converged on an identical core loop: **plan → start session → see "previous" set → log weight × reps → finish → review history**. The PRD's F1–F15 covers this loop correctly, and the locked stack (Expo SDK 54, NativeWind 4 + Tailwind 3, TanStack Query v5, Zustand, react-hook-form + Zod 4, Supabase, expo-secure-store) is the right toolset for the job — every library was Context7-verified against current 2026 versions and they compose without conflict.

The build itself is **not** open-ended exploration — it is execution against a locked architecture with three load-bearing, non-obvious patterns the developer must internalize before writing any feature: (1) `setMutationDefaults` registered at module scope (not inline `useMutation`) so the offline mutation queue survives serialization; (2) **client-generated UUIDs** on every insert so paused mutations are idempotent on replay; (3) **per-set persistence** (one mutation per "Klart" tap) — never accumulate sets in React state and "save on finish." Skipping any of these three is how V1 ships and silently drops sets — the one outcome PRD §7 forbids ("får ALDRIG förlora ett set").

The biggest risks are not technological — the stack is mature. They are: **schema decisions that are hard to retrofit** (kg/lb canonical unit, set-type tagging, client-UUID convention) which need to land in Phase 1, and **a bootstrap discipline cluster** (NativeWind v4 ↔ Tailwind 3 pin, `npx expo install` vs `npm install` for native modules, RLS-enabled-with-policies on every table, Reanimated 4 babel config) which all need to be right *before* the first feature screen is built. After the bootstrap and schema phases are clean, V1 is ~3 weeks of straightforward feature work.

---

## Key Findings

### Recommended Stack

The locked stack in `ARCHITECTURE.md` was validated against current 2026 versions and is correct as scoped. Detailed pin table is in `STACK.md`; the must-not-be-ignored constraints are below.

**Core technologies (all already validated for SDK 54):**
- **Expo SDK 54** + **Expo Router 6** (file-based routing) — already scaffolded in `app/`.
- **NativeWind 4.2.x** + **Tailwind CSS 3.4.17** — styling.
- **TanStack Query v5.100+** + **Zustand 5** + **react-hook-form 7 + @hookform/resolvers 5 + Zod 4** — server-state, UI-state, forms+validation.
- **@supabase/supabase-js 2.105+** + **expo-secure-store 14.x** + **AsyncStorage 2.2 + aes-js + react-native-get-random-values** — backend client and the `LargeSecureStore` session-storage wrapper.
- **@shopify/react-native-skia 2.6** + **victory-native 41.x** — charts (F10).
- **date-fns 4** — dates.

### Stack Version Pins That Will Break If Ignored

These are not preferences; they are correctness constraints. Get any wrong and the symptoms are silent (styles don't apply, sessions don't persist, animations no-op, queued mutations evaporate).

1. **NativeWind 4 hard-requires Tailwind 3, NOT 4.** The transitive `react-native-css-interop@0.2.3` declares `tailwindcss: "~3"` as a peer dep. Pin `tailwindcss@^3.4.17` in `devDependencies`. A naive `npm install tailwindcss` grabs v4 and styles silently fail to apply.
2. **`expo-secure-store` must be installed via `npx expo install`, not `npm install`.** `npm view expo-secure-store@latest` resolves to `55.0.13` (the SDK 55 line). SDK 54 expects the `14.0.x` line. Same rule applies to every native module: AsyncStorage, get-random-values, Skia, Reanimated, gesture-handler, screens, safe-area-context, victory-native. Use `npm install` only for pure-JS libs (Zustand, TanStack, RHF, Zod, date-fns, aes-js, NativeWind).
3. **Supabase sessions exceed SecureStore's 2 KB limit.** **Use the `LargeSecureStore` wrapper** (encryption key in SecureStore, AES-256-CTR-encrypted session blob in AsyncStorage via `aes-js`) — copy verbatim from Supabase's official Expo tutorial. Pointing Supabase directly at SecureStore *or* directly at AsyncStorage are both wrong (one throws, the other leaks plaintext tokens).
4. **Do NOT add `react-native-worklets/plugin` to `babel.config.js`.** Reanimated 4.1's `react-native-reanimated/plugin` already includes worklets. Adding both produces "Duplicate plugin/preset detected"; adding only worklets produces "ReferenceError: _WORKLET". The babel config gets `react-native-reanimated/plugin` only, last in the plugin list.
5. **`@hookform/resolvers` must be v5 with Zod v4.** Resolver v4 expects Zod v3 — type mismatch errors ensue.

### Expected Features (Synthesis from FEATURES.md vs. PRD)

The PRD's F1–F15 covers the **table-stakes core loop**. Research surfaces 4 features that are competitor-universal (Hevy, Strong, FitNotes, Liftin' all ship them) and that are missing or under-specified in PRD. All are LOW complexity.

**Must have — V1 Måste (PRD F1–F9, F13 already correct):** auth, plans CRUD, custom exercises, plan-exercise ordering, start session, log set (weight + reps), **show previous value at log time** (the category-defining feature), finish session, history list, **offline-first** (correctly bumped to Måste).

**Should have — gaps surfaced by research (see Requirements Gaps section below):** unit preference (kg/lb), rest timer, set-type tag (warmup/working), PR detection.

**Differentiators (cheap V2 wins, not V1):** plan-scoped "previous" alongside global "previous"; "Repeat last session" home-screen CTA; visible offline sync-state badge ("3 sets pending sync"). All <1 day each.

**Defer to V2+ (PRD/PROJECT correctly excludes):** seeded global exercise library (V2 store-launch blocker), Apple Sign-In (V1.1, App Store blocker), Apple Health, widgets, CSV export, supersets, plate calculator, programming templates (5/3/1, PPL).

**Hard "no" anti-features:** social feed / followers / leaderboards (out of scope forever), AI coach, exercise videos, gamification streaks, nutrition tracking, full body-measurement tracking. PROJECT.md's Out of Scope list is correct and should not be relitigated.

### Requirements Gaps Surfaced by Research

These are **changes the roadmap should propose** to the locked PRD.

| ID | Change | Why now (not later) |
|----|--------|---------------------|
| **F16 (NEW) — Unit preference (kg/lb) → V1 Måste** | Schema impact. Profile-level `preferred_unit` already exists in ARCHITECTURE §4; V1 must (a) honor it on display, (b) **store all weights canonically as kg in `weight_kg` regardless of UI unit**, and (c) optionally lock unit at session start. | Trivial cost now (one column already exists). Expensive cost to retrofit later (every chart/export/PR calc breaks if mixed units leak in). |
| **F17 (NEW) — Set-type tag → V1 Måste for *schema*, V1.1 Bör for *UI*** | Schema column `is_warmup boolean` exists but is too narrow — competitor convention is `working / warmup / dropset / failure`. Land the enum schema in V1, ship UI in V1.1. | Column-level migration is cheap before data exists, expensive after. |
| **F18 (NEW) — PR detection → V1.1 Bör** | Compute on session save (Epley `w * (1 + r/30)`, max-weight, max-volume per exercise). LOW complexity. | Dopamine loop competitors ship; V2 App Store cannot ship without it. |
| **F19 (NEW) — Rest timer → V1.1 Bör** | Auto-trigger on "Klart" tap. **Implementation has a JS-suspension trap** — `setInterval` freezes when phone is pocketed. Right path is `started_at` stamp + render-time computation + `expo-notifications` scheduled local notification. **Research flag for V1.1.** | Defer to V1.1, but planning needs heads-up that it's not just `setInterval`. |
| **F15 — Dark mode: arguably V1 Måste, not V1 Bör** | Gym lighting is dim; users dim brightness; white backgrounds become unreadable + battery drain. Setting up `dark:` variants in NativeWind from day one costs ~nothing; retrofitting touches every screen. Treat as a **convention** to establish in Phase 1 even if manual toggle waits until V1.1. | Cost asymmetry: free now, 3× retrofit cost. |

**Roadmap action:** propose adding F16/F17 to V1 Måste, F18/F19 to V1.1 Bör, and treating F15 dark mode as a Phase-1 styling **convention**.

### Errata Against the Locked `ARCHITECTURE.md`

These are **bugs in the user's locked ARCHITECTURE.md** that the roadmap should silently correct.

1. **Section 4 — `plan_exercises` RLS policy is missing `with check`.** As written, it is `for all using (exists ...)` only. Without `with check`, a malicious client can insert `plan_exercises` rows referencing someone else's plan. Same audit needed on `exercise_sets`. Correction:
   ```sql
   create policy "Users can manage own plan exercises" on plan_exercises
     for all
     using (exists (select 1 from workout_plans where id = plan_id and user_id = auth.uid()))
     with check (exists (select 1 from workout_plans where id = plan_id and user_id = auth.uid()));
   ```
   Apply same pattern to `exercise_sets`. Also wrap `auth.uid()` as `(select auth.uid())` in every policy for query-plan caching.

2. **Section 7 — "V1: kräver internet. V1.5: queue + persist + replay" no longer holds.** F13 was bumped from V1.5 Bör to V1 Måste in PROJECT.md. ARCHITECTURE.md §7 is now contradictory with the requirement set. `ARCHITECTURE.md` (research) §7 contains a drop-in replacement that the roadmap should treat as authoritative. Summary: offline-first ships in V1 using `PersistQueryClientProvider` + `createAsyncStoragePersister` + `setMutationDefaults` + NetInfo-driven `onlineManager` — no custom queue is built.

### Architecture — Load-Bearing Patterns (NOT Optional)

Every one of these is a "do this exactly or the offline-first promise breaks."

1. **`setMutationDefaults` at module scope, never inline `useMutation({ mutationFn })`.** Paused mutations carry only their `variables` through serialization to AsyncStorage. The `mutationFn` reference is rebuilt at hydrate-time *from the registered defaults*. Inline `mutationFn` = lost on app close = mutation hangs forever. **All mutations must use `mutationKey: ['resource', 'op']` and have their `mutationFn`/`onMutate`/`onError`/`onSettled` registered at module top-level in `lib/query/client.ts`, before `PersistQueryClientProvider` mounts.** This is the #1 correctness rule of the entire app.

2. **Client-generated UUIDs on every insert, NOT `gen_random_uuid()` server-side.** Use `expo-crypto.randomUUID()` and pass `id` in the insert payload. Two reasons: (a) optimistic-update cache entries need stable keys *before* the server responds; (b) mutation replay after a network drop must be idempotent — `.upsert(..., { onConflict: 'id', ignoreDuplicates: true })` makes "did the server already commit before the network died?" a safe no-op. The schema's `default gen_random_uuid()` stays as a fallback, never the primary path.

3. **Per-set persistence on every "Klart" tap, NOT "save on finish."** This is the single biggest data-loss vector. The active session is a `workout_sessions` row created at "Starta pass" and updated with `finished_at` at "Avsluta pass." Every set is its own `exercise_sets` insert mutation. The session screen state should hold only `sessionId` + `currentExerciseId` selectors — never an in-memory `sets: Set[]` array.

4. **`LargeSecureStore` for the Supabase auth session — not SecureStore directly, not AsyncStorage directly.** Encryption key (256-bit) in SecureStore, AES-256-CTR-encrypted session blob in AsyncStorage. `react-native-get-random-values` polyfill must be the **first import** in `lib/supabase.ts`.

5. **Expo Router auth guard via `Stack.Protected` + `(auth)`/`(app)` route-group split, NOT `useEffect` redirects.** The locked architecture's flat `app/app/` layout (per ARCHITECTURE §3) needs to be **restructured into `(auth)/` and `(app)/` sibling groups** with the guard living in `(app)/_layout.tsx` plus `Stack.Protected guard={!!session}` in the root.

6. **NetInfo wired to `onlineManager.setEventListener` at module scope** (not in a `useEffect` of a child component). And `setMutationDefaults` registered before `PersistQueryClientProvider` mounts. Wrong order = `resumePausedMutations()` flushes against unregistered keys = mutations error and disappear.

7. **`scope.id = "session:<id>"` on set mutations** — TanStack Query v5 mutation `scope` ensures all mutations sharing the same `scope.id` run sequentially. Without it, set 5 can hit Supabase before set 4 (FK race during replay).

### Top 5 Pitfalls Ranked by Impact-on-Data-Loss

Extracted from the 36 in `PITFALLS.md` and ordered by "could this drop, corrupt, or block a logged set?"

1. **Pitfall 1.1 — "Save on finish" as the only persistence point.** Single highest-impact pitfall. Holds the entire active workout in React state until "Avsluta pass." Phone call, OS kill, battery — every set evaporates. **Prevention is structural:** persist per-set with TanStack mutations from the very first feature implementation. Cannot be retrofitted without rewriting the workout screen.

2. **Pitfall 5.4 — TanStack Query `retry: 0` (default for mutations) drops queued offline mutations.** Mutations default to `retry: 0` (queries default to 3). If a mutation fires while online and the network drops mid-flight, the mutation enters error state immediately and is NOT paused for resume. **Prevention:** in `QueryClient` defaults, `mutations: { retry: 1, networkMode: 'offlineFirst' }`.

3. **Pitfall 1.2 — Optimistic update with no rollback path → silent data loss.** `onError` rolls back the cache; user thinks the set saved (UI showed it briefly), looks away, set is gone. **Prevention:** persist the *intent* before optimistic cache update; distinguish pending vs. confirmed sets visually (clock icon / 70% opacity); make 4xx (RLS) errors a *blocking* sheet — never silent.

4. **Pitfall 1.6 — No "draft session recovery" on cold launch.** Phone reboots mid-workout. App opens to home with no indication an active session exists. User starts again. Original session orphaned with `finished_at IS NULL` forever. **Prevention:** root layout queries `workout_sessions WHERE finished_at IS NULL ORDER BY started_at DESC LIMIT 1` on launch and routes to "Återuppta passet" if found. Must ship simultaneously with F5/F6/F8.

5. **Pitfall 5.3 — Mutation queue replays in wrong order.** User offline: creates Plan A, adds 3 exercises, goes online. Queue replays in parallel — "add exercise to Plan A" runs before "create Plan A" finishes — FK violation cascade. **Prevention:** TanStack Query mutation `scope: { id: 'plan:<id>' }` for child mutations + `scope: { id: 'session:<id>' }` for sets within a session.

**Honorable mentions:** Pitfall 2.1 (RLS forgotten on table — leaks via anon key), 2.4 (AsyncStorage for session — leaks JWT), 1.3 (persister throttle loses unwritten buffers on force-quit), 1.5 (numeric input loses focus on keyboard dismiss).

---

## Implications for Roadmap

The pitfalls cluster naturally into a build order: **bootstrap discipline before features; schema decisions before data; offline-queue mechanics proven on a forgiving resource (plans) before stressed on the hot path (sets).** This drives a 7-phase V1 roadmap with V1.1 and V2 sketched.

### Phase 1 — Bootstrap & Infra Hardening
**Rationale:** "Looks done but isn't" failures (NativeWind misconfig, Reanimated double-plugin, env-var hardcoding, `npm install` instead of `npx expo install` for natives) all happen here. Get this wrong and every later phase debugs symptoms instead of building features.
**Delivers:** Locked stack installed with correct version pins; `lib/supabase.ts` with `LargeSecureStore`; env vars from `EXPO_PUBLIC_*` only; `.env.local` gitignored; NativeWind smoke test renders red on iPhone; `tailwind.config.js` `darkMode: 'class'` + project convention to use `dark:` variants from start; `expo-doctor` clean.
**Avoids:** 2.1, 2.2, 2.3, 2.6, 3.1, 3.2, 3.4, 6.4.

### Phase 2 — Schema, RLS, and Type Generation
**Rationale:** Schema decisions are expensive to retrofit. Errata against ARCHITECTURE.md §4 corrected here.
**Delivers:** Migration files reflecting ARCHITECTURE §4 **with corrections**: `with check` on `plan_exercises` and `exercise_sets`; `(select auth.uid())` wrapping; `updated_at timestamptz default now()` on mutable tables for LWW. Schema decision on **set-type column** (F17) — recommendation: land enum now. **Client-UUID convention** documented. `npm run gen:types` script. Cross-user write fixture tests.
**Addresses:** Schema for F1–F12, F16 (canonical kg), F17 (set-type column).
**Avoids:** 1.5, 2.1, 2.2, 2.5, 4.1, 4.2, 4.4, 5.1, 5.2, 3.5.

### Phase 3 — Auth + Persistent Session
**Rationale:** `LargeSecureStore` must work end-to-end *before* first sign-up — migrating stored sessions later is its own pitfall.
**Delivers:** `lib/auth/ctx.tsx` with `AuthProvider` + `useSession()`; `(auth)/sign-in.tsx`, `(auth)/sign-up.tsx` (RHF + Zod); `(app)/_layout.tsx` with `<Redirect>` second-line guard; root `Stack.Protected guard={!!session}`; AppState listener wired to `startAutoRefresh`/`stopAutoRefresh`. Acceptance: sign in → kill app → reopen → session restored. Sign in → background ≥61 min → return → first action succeeds.
**Addresses:** F1.
**Avoids:** 2.4, 3.3, 4.3.

### Phase 4 — Offline-Queue Plumbing (proven on plans, not on sets)
**Rationale:** Prove the offline-first machinery on a forgiving resource (plans CRUD) before composing features on top of it. **Resist the urge to add features during this phase.**
**Delivers:** `lib/query/client.ts` with `QueryClient` configured (`gcTime: 24h`, `networkMode: 'offlineFirst'`, `retry: 1` mutations) and **all** `setMutationDefaults` registered at module top-level; `lib/query/persister.ts` (throttleTime 500–1000ms); `lib/query/network.ts` (`onlineManager` ↔ NetInfo, `focusManager` ↔ AppState); `PersistQueryClientProvider` with `onSuccess: () => queryClient.resumePausedMutations()`; F2/F3/F4 shipped with full offline-queue flow. **Acceptance:** airplane mode → create plan → add 3 exercises → force-quit → reopen offline (data still there) → reconnect → all rows in Supabase, no FK errors.
**Addresses:** F2, F3, F4.
**Avoids:** 1.3, 5.3, 5.4.

### Phase 5 — Active Workout Hot Path (THE phase F13 promise lives or dies in)
**Rationale:** What V1 exists for. Per-set persistence, draft recovery, scoped serial mutations, idempotent client UUIDs, optimistic UI with non-silent errors — all load-bearing patterns compose here.
**Delivers:** `(app)/workout/start.tsx` (create session); `(app)/workout/[sessionId].tsx` (hot path, one mutation per "Klart"); `useAddSet` with `mutationKey: ['set', 'add']` + `scope.id = "session:<id>"`; F7 "previous value" with **per-set-position alignment** ("Last session, set 1: 82.5kg × 8") not just one number; F8 "Avsluta pass" — **no "Discard workout" button** (Pitfall 6.6); draft-session recovery in `app/_layout.tsx`; ≤3-second log SLA (no modal-per-set), 64pt tap targets, `keyboardType="decimal-pad"`, soft-warn on weight > previous + 30%, Zod `.multipleOf(0.25).max(500)`. **Acceptance:** airplane mode + force-quit + battery-pull during 25-set workout — every set survives.
**Addresses:** F5, F6, F7, F8, F13.
**Avoids:** 1.1, 1.2, 1.4, 1.6, 5.1, 5.4, 6.1, 6.2, 6.3, 6.6.

### Phase 6 — History, Read-Side Polish
**Rationale:** Pure read-side; depends on data existing.
**Delivers:** F9 history list (cursor pagination on `started_at desc`); F10 chart (`<CartesianChart>` from victory-native, memoized data); F12 session notes if time permits.
**Addresses:** F9, F10, F12.

### Phase 7 — V1 Polish Cut
**Rationale:** Wraps F11 (RPE) and F15 (dark mode toggle UI; convention already from Phase 1). 4-week soak validates V1.
**Addresses:** F11, F15.

### Phase 8 (V1.1) — App Store Pre-Work
**Delivers:** F14 Apple Sign-In; F18 PR detection; F19 Rest timer (**research flag** — needs `expo-keep-awake` + `expo-notifications`); F17 set-type tag UI; tap-to-copy from previous → current.
**Research flag:** YES — F19 rest timer.

### Phase 9 (V2) — App Store Launch Path
**Delivers:** Seeded exercise library; EAS Build + TestFlight (deferred per Pitfall 3.6); plan-scoped "previous"; "Repeat last session" CTA; offline sync-state badge; Apple Health, widgets, CSV export, bodyweight tracking.
**Research flags:** YES on EAS Build credential flow, Apple Health integration, widgets.

### Phase Ordering Rationale

- **Phase 1 → 2 → 3 → 4 must be sequential.** Each phase depends on the previous being right.
- **Phase 5 must follow Phase 4 sequentially.** The hot path needs proven infra. Compressing them is exactly the path that violates F13.
- **Phase 6 and 7 can parallelize partially.**
- **Phase 2 (schema) can partially parallelize with Phase 1 (bootstrap).** Schema work is in Supabase Studio / SQL editor, independent of the Expo codebase.
- **F16 (unit preference) lands in Phase 2 (schema) and Phase 5 (display).** Not its own phase.

### Research Flags

Phases needing `/gsd-research-phase` during planning:
- **Phase 8 — F19 Rest timer.** `expo-notifications` + `expo-keep-awake`; clock-drift correction; iOS notification permission UX.
- **Phase 9 — EAS Build credential flow** on Windows-only dev environment.
- **Phase 9 — Apple Health integration.**

Phases with standard patterns (skip research):
- **Phases 1, 2, 3, 4, 5, 6, 7.** All patterns documented in `STACK.md`, `ARCHITECTURE.md` (research), `PITFALLS.md`.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | Every library Context7-verified against current 2026 versions. Victory Native v41 ↔ Skia 2.x peer-dep loose declaration is the one MEDIUM — works in practice per community reports May 2026. |
| Features | **HIGH** | 6+ independent 2026 review sites converge on the same table-stakes set. PRD F1–F15 covers the loop; the 4 surfaced gaps (F16–F19) are unanimous across competitors. Pricing details MEDIUM (changes monthly). |
| Architecture | **HIGH** | All offline-first patterns Context7-verified directly from TanStack Query v5 docs. Expo Router 6 auth pattern verified from `expo/expo` repo. `LargeSecureStore` retrieved verbatim from official Supabase Expo tutorial. MEDIUM is conflict resolution at LWW being adequate — fine for V1 single-device, flagged for V2 multi-device. |
| Pitfalls | **HIGH** | Supabase RLS, SecureStore, Reanimated 4 babel, NativeWind v4 setup, TanStack offline patterns all well-documented in official sources. Gym UX MEDIUM but corroborated across 6+ sites. |

**Overall confidence:** HIGH.

### Gaps to Address

- **F19 rest timer implementation pattern** is not in the locked stack. Research before V1.1 planning.
- **EAS Build credential flow on Windows-only dev environment.** Defer to V2 phase planning; let EAS Cloud Build manage credentials end-to-end.
- **Apple Health integration scope.** V2 only.
- **Conflict resolution beyond LWW.** Adequate for V1 single-device; revisit if V2 introduces real multi-device parallel editing.
- **Seeded exercise library curation.** Out of V1; V2 blocker. Curation effort (names, muscle groups, equipment, i18n) non-trivial.

---

## Sources

### Primary (HIGH confidence)
- **Stack:** Context7 `/expo/expo` `__branch__sdk-54`, `/nativewind/nativewind` `nativewind_4.2.0`, `/tanstack/query` `v5_*`, `/pmndrs/zustand` `v5.0.12`, `/colinhacks/zod` `v4.0.1`, `/react-hook-form/react-hook-form` `v7.66.0`, `/supabase/supabase-js` `v2.58.0`, `/shopify/react-native-skia`, `/formidablelabs/victory-native-xl`. Cross-checked with `npm view <pkg>` (2026-05-07).
- **Architecture:** TanStack Query v5 docs (createAsyncStoragePersister, setMutationDefaults, scope, onlineManager). Expo Router 6 docs (Stack.Protected, authentication-rewrites). Supabase Expo tutorial (LargeSecureStore class) — fetched verbatim 2026-05-07.
- **Pitfalls:** Supabase Database Advisors (RLS lint rule 0013), Supabase RLS Performance and Best Practices, Supabase Sessions docs, Supabase Generating TS Types. Reanimated SDK 54 worklets discussion (software-mansion/react-native-reanimated#8778). NativeWind installation docs. Expo blog protected routes. TanStack Query offline issues #4170 + #5244. PRD.md §7, ARCHITECTURE.md §4–§8, PROJECT.md.

### Secondary (MEDIUM confidence)
- **Features:** Multi-source 2026 review aggregation — pumpx.app, gymgod.app, prpath.app, askvora.com, findyouredge.app, strongermobileapp.com, fitbod.me, repreturn.com, hotelgyms.com. Reddit synthesis via setgraph.app + corahealth.app.
- **Pitfalls UX:** Stormotion fitness UI principles, MadAppGang fitness app design mistakes, MapMyFitness soft-delete precedent. Whitespectre + Benoit Paul TanStack offline guides.
- **Stack:** NativeWind discussion #1604, Victory Native XL issue #616, Supabase issue #14523 (SecureStore size).

### Detailed research files
- `.planning/research/STACK.md` — version pins, install commands, critical recipes, per-library gotchas.
- `.planning/research/FEATURES.md` — competitor analysis, feature dependencies, V1/V1.1/V2 prioritization matrix.
- `.planning/research/ARCHITECTURE.md` — offline-first patterns, Expo Router auth, build order for newcomers, replacement for ARCHITECTURE.md §7.
- `.planning/research/PITFALLS.md` — 36 pitfalls grouped by data-loss / security / RN newcomer / Supabase / offline / gym UX, with phase mapping.

---

*Research synthesis completed: 2026-05-07*
*Ready for roadmap: yes*
