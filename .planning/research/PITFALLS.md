# Pitfalls Research

**Domain:** Personal gym tracker (Expo SDK 54 + Supabase + offline-first) built by a developer new to React Native/TypeScript
**Researched:** 2026-05-07
**Confidence:** HIGH (Supabase RLS, SecureStore, NativeWind v4, Reanimated 4, TanStack Query offline patterns are all well-documented; gym UX comes from product common sense + multiple fitness UX articles)

The non-negotiable line is "får aldrig förlora ett set." Every pitfall below is filtered through "could this drop, corrupt, or block a logged set?" first, then "could this leak data?" second, then everything else.

Pitfalls are grouped per the brief:
1. Data loss
2. Security (RLS, secrets, sessions)
3. RN/Expo newcomer
4. Supabase
5. Offline-sync
6. Gym-specific UX

---

## 1. Data-Loss Pitfalls — "Får aldrig förlora ett set"

### Pitfall 1.1: "Save on finish" as the only persistence point

**What goes wrong:**
The active workout (`workout_sessions` row + its `exercise_sets`) is held in React state until the user taps "Avsluta pass," at which point it is bulk-inserted to Supabase. If the user tabs away, gets a phone call that kills the JS engine, runs out of battery, or force-quits Expo Go to swap apps, every set logged in that session is gone.

**Why it happens:**
It is the simplest mental model — "session" = "the in-memory thing being built." Beginners reach for `useState` because TanStack Query mutations look heavier. It also feels correct in a "transaction" sense ("don't save half a workout").

**How to avoid:**
- **Persist per-set, not per-session.** As soon as the user taps "Klart" on a set, fire a mutation to insert one `exercise_sets` row. The session row is created at "Starta pass" and updated with `finished_at` on finish — never built up in memory.
- Use TanStack Query `mutationFn` with `@tanstack/query-async-storage-persister` so the queue survives JS reloads.
- Keep an `is_active` / "open session" concept — a session with `finished_at IS NULL`. On app launch, check if one exists and offer "Återuppta passet."
- Set `set_number` on the client by counting existing rows for that `(session_id, exercise_id)` so retries are idempotent against a unique index.

**Warning signs:**
- The session screen state holds `sets: Set[]` arrays instead of just `sessionId` + `exerciseId` selectors.
- "Avsluta pass" calls a function named `saveWorkout()` that does multiple inserts at once.
- No mutation runs between tapping "Klart" on a set and tapping "Avsluta pass."

**Phase to address:**
Phase covering F5/F6/F8 (start session, log sets, finish). This pattern needs to be the *first* thing built — retrofitting per-set persistence after building the in-memory version means rewriting the workout screen.

---

### Pitfall 1.2: Optimistic update with no rollback path → silent data loss

**What goes wrong:**
TanStack Query's `onMutate` adds the set to the cache, the UI shows it, the network request fails (RLS denial, schema drift, validation error), `onError` fires but the rollback restores the old cache and the user thinks the set saved. They move on. The set is gone.

**Why it happens:**
Optimistic updates feel mandatory for a sub-3-second log SLA. Errors during mutation are easy to log to console and forget. Toast notifications get dismissed before the user reads them in a noisy gym.

**How to avoid:**
- Persist the *intent* (the queued mutation) to AsyncStorage via the persister BEFORE optimistically updating the cache. If the request fails, the mutation stays paused and is retried on next online cycle — it does not vanish.
- Distinguish "pending" sets visually (e.g., a small clock icon or 70% opacity) until confirmed. If a set is pending for >30s show a subtle banner "Sparar 3 set …" — non-blocking but visible.
- For RLS / 4xx errors specifically (non-retryable), surface a *blocking* error sheet that does not auto-dismiss: "Detta set kunde inte sparas. Tryck för att försöka igen." Never silently drop.
- Mutation `retry` must be ≥1 and `retryDelay` exponential, not 0 (default), or "online during call → offline mid-flight" enters error state immediately per the TanStack docs.

**Warning signs:**
- `onError` only does `console.error` or a toast.
- Optimistic state and persisted state are never reconciled visually.
- `retry: 0` in mutation defaults.

**Phase to address:**
Same phase as 1.1 (active workout). Build the visible-pending-state component before wiring up any mutation.

---

### Pitfall 1.3: Force-quit / OS kill loses unwritten AsyncStorage buffers

**What goes wrong:**
TanStack Query's persister throttles writes (default 1000ms, recommended 3000ms). If the app is killed within the throttle window, the most recent mutation never made it to disk. User logs a PR set, phone is jostled, app force-closes, set evaporates.

**Why it happens:**
Throttling exists for performance — writing on every keystroke would thrash storage. But "throttle" and "guaranteed durability" are mutually exclusive.

**How to avoid:**
- Lower the persister `throttleTime` for mutation persistence specifically. 500–1000ms is acceptable for set logging — sets are not high-frequency.
- On `AppState` change to `background` or `inactive`, flush the persister manually (`persister.persistClient` or equivalent immediate write).
- For the "Klart" tap specifically, do a synchronous AsyncStorage write of a "pending sets" list *in addition to* TanStack Query's persister. Belt and braces. The redundant store is the recovery source if the queue is corrupted.
- On app launch, log telemetry (just to console/Sentry-later) of how many pending mutations were resumed — gives you a pulse on whether the system is working.

**Warning signs:**
- No `AppState` listener anywhere in the codebase.
- The persister uses default config.
- No "pending mutations on launch" debug log.

**Phase to address:**
Same phase as offline queue setup (after Phase 1 bootstrap, before active-workout feature is shipped).

---

### Pitfall 1.4: Numeric input loses input-in-progress when the field unmounts

**What goes wrong:**
User types `82.5` into a weight field. Phone vibrates from a notification. The keyboard dismiss / re-render unmounts the row before `onBlur` fires, because the form state was scoped to a component that conditionally rendered. The input is empty when they come back. They re-type — distracted, they type `82` and tap save.

**Why it happens:**
Beginners scope form state inside the component being rendered. Conditional rendering (`{isEditing && <SetRow/>}`) drops state when the component unmounts.

**How to avoid:**
- Lift form state to a parent that persists across renders, or use `react-hook-form`'s controller pattern with the form context at the screen level.
- Use `defaultValues` from the most recent persisted value (last-completed set for that exercise) so empty state is rare.
- Never conditionally render the active-row component; always render it and toggle visibility / editability via props.

**Warning signs:**
- `useState` for weight/reps inside a row component that has `{condition && <Row/>}` above it.
- Bug reports of "the number disappeared."

**Phase to address:**
Active-workout phase, during F6 implementation.

---

### Pitfall 1.5: `exercise_sets.weight_kg numeric(6,2)` — silently truncating user input

**What goes wrong:**
Schema is `numeric(6,2)` (max 9999.99). User accidentally types `1255.5` (typo for `125.5`). Postgres accepts it. Or they enter weight in lbs because UI defaulted wrong. App now stores junk that ruins "max weight" graphs forever.

**Why it happens:**
DB constraint catches overflow but not "implausible." UX never validates "is this a realistic gym weight?"

**How to avoid:**
- Zod schema for set input: `weight_kg: z.number().min(0).max(500).multipleOf(0.25)`. 500 kg covers world-record squats. `0.25` aligns with smallest plate increments (also catches "I typed 12.55" typos).
- Soft-warn (don't block) on weights > previous max + 30% — "Är du säker? Förra var 80kg."
- Store `unit` at the *set* level or at minimum lock unit at session start; do not let `profiles.preferred_unit` change retroactively reinterpret stored kg as lb.
- `weight_kg` should be canonical kg in the DB regardless of UI unit. Convert at the boundary, never in the query layer.

**Warning signs:**
- Validation lives only in DB constraints.
- Code reads `profiles.preferred_unit` then multiplies stored weight without per-set unit metadata.
- No "implausible value" warning UI.

**Phase to address:**
Schema migration phase (Supabase setup) for canonical-kg invariant; F6 phase for Zod validation + soft warnings.

---

### Pitfall 1.6: No "draft session recovery" on cold launch

**What goes wrong:**
Beginner JS dev assumes app reload = clean slate. User logs 5 sets, phone restarts, opens app, sees the home screen with no indication of the in-progress workout. They start again, logging the same exercises — original session is orphaned with `finished_at IS NULL` forever.

**Why it happens:**
"Active session" is held in Zustand without persistence; nobody wires up the rehydration step.

**How to avoid:**
- On app launch (in root layout / providers), query Supabase for `workout_sessions WHERE user_id = me AND finished_at IS NULL ORDER BY started_at DESC LIMIT 1`. If found, route the user to "Vill du fortsätta passet från [time]?" prompt.
- Same Zustand store that holds `activeSessionId` should be persisted via `zustand/middleware/persist` with AsyncStorage adapter — but Supabase remains the source of truth.
- If the offline queue still has pending writes for that session, rehydrate them too.

**Warning signs:**
- `app/_layout.tsx` doesn't query for unfinished sessions.
- Zustand stores have no `persist` middleware.
- No code path handles "open session exists when user opens app."

**Phase to address:**
Active-workout phase. This must ship simultaneously with F5/F6/F8, not deferred.

---

## 2. Security Pitfalls — RLS, Secrets, Sessions

### Pitfall 2.1: Forgetting `ENABLE ROW LEVEL SECURITY` on a new table

**What goes wrong:**
Per Supabase docs, RLS is **disabled by default** when you `CREATE TABLE`. Add a table without `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, and the table is **publicly readable through the anon-key REST API by anyone on the internet**. The anon key is in the client bundle; it is harvestable in seconds.

This is the #1 Supabase data leak. ARCHITECTURE.md has the correct `enable row level security` for all 6 tables — but every *future* table (V2 features, debug tables, "let me try something" tables) is at risk.

**Why it happens:**
RLS-disabled is the default. The Supabase dashboard surfaces a warning, but CLI migrations do not. Beginners create a table with `supabase migration new` → `create table ...` → it works → they ship.

**How to avoid:**
- **Migration template.** Every migration that creates a table must have an `enable row level security` line and at least one policy. Make a snippet/macro.
- **CI / pre-deploy check.** The "Database Advisors" lint rule `0013_rls_disabled_in_public` flags any public-schema table without RLS. Run it before every migration deploy: `supabase db lint`.
- **Database query (manual sanity check):**
  ```sql
  SELECT tablename FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename NOT IN (
      SELECT tablename FROM pg_policies WHERE schemaname='public'
    );
  ```
  Should return zero rows. Run this after every new migration.
- For each new table, write the test "anon-key client tries to SELECT — should return 0 rows even when rows exist." Automate as a script.

**Warning signs:**
- A table exists in `public` with no entries in `pg_policies`.
- The Supabase Studio table view shows "RLS disabled" tag.
- "Database Advisors" panel has unread warnings.

**Phase to address:**
Phase 1 / Bootstrap — establish the migration template and lint check before the first table is created. Re-verify in *every* phase that touches schema.

---

### Pitfall 2.2: RLS enabled but **no policies** = "deny everything," then disabled again to fix

**What goes wrong:**
Beginner enables RLS, runs the app, every query returns `[]`. Panics. Disables RLS to "make it work." Forgets to re-enable. App ships with RLS off.

**Why it happens:**
RLS deny-by-default is not visually obvious — there is no error, just empty arrays. Disabling RLS "fixes" the symptom instantly.

**How to avoid:**
- Always pair `enable row level security` with at least one policy in the same migration commit.
- The schema in ARCHITECTURE.md §4 already does this — keep that pattern. New tables must follow it.
- During development, when "no rows returned" happens, the diagnostic ladder is: (1) am I authenticated? `supabase.auth.getSession()`, (2) does a policy match my role and `auth.uid()`?, (3) does the row actually exist? Use SQL editor *as service-role* to confirm before assuming RLS is wrong. Never just "turn off RLS to debug."
- Add a tiny helper: `supabase.auth.getUser().then(u => console.log('uid', u?.data?.user?.id))` so you can compare against `user_id` columns in queries.

**Warning signs:**
- A migration enables RLS without adding any `create policy`.
- Git history contains a "disable rls temporarily" commit.

**Phase to address:**
Same as 2.1.

---

### Pitfall 2.3: Service-role key sneaking into the client

**What goes wrong:**
Service role bypasses RLS. If it's ever embedded in the Expo bundle (even via a misnamed env var, or pasted in for "testing"), the entire database is publicly read/write.

**Why it happens:**
Beginners hit RLS errors, find StackOverflow advice "use the service role key," paste it into `EXPO_PUBLIC_SUPABASE_KEY`, problem disappears, code ships.

**How to avoid:**
- **Never** import or reference `SUPABASE_SERVICE_ROLE_KEY` in any file inside `app/`. There is no legitimate reason to.
- Only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` belong in `.env.local` for the client. Anything else with `SERVICE_ROLE` in the name should not exist in this project at all in V1.
- Add a pre-commit check / grep: `git grep -n "service_role\|SERVICE_ROLE"` should return only docs/comments.
- Rotate keys immediately if a service role key is ever pasted anywhere git-tracked (even later removed).

**Warning signs:**
- `.env.local` contains a key labeled service role.
- Code uses a Supabase client constructed with a different key for "admin" operations.

**Phase to address:**
Phase 1 / Bootstrap, alongside `.env.local` setup. Establish the rule before keys are loaded.

---

### Pitfall 2.4: Using AsyncStorage for the Supabase auth session

**What goes wrong:**
AsyncStorage is unencrypted. JWT and refresh token are sitting in plain text on the device. On a jailbroken/rooted device, in a backup, or via a malicious app with shared storage access, the tokens are extractable. PROJECT.md and ARCHITECTURE.md both already mandate `expo-secure-store` — but the *Supabase JS client docs example* uses AsyncStorage, which is the trap.

**Why it happens:**
Copy-pasting Supabase quickstart code. SecureStore has a 2048-byte size limit and the Supabase session can exceed it, so naive SecureStore wiring throws → developer "fixes" it by switching to AsyncStorage.

**How to avoid:**
- Use the **hybrid pattern**: encryption key in SecureStore, encrypted blob in AsyncStorage. The Supabase community has documented this exact pattern. Reference: [Supabase Expo tutorial](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native?auth-store=secure-store).
- Or: implement a custom `Storage` adapter that chunks the session across multiple SecureStore keys.
- Acceptance test: sign in, kill the app, reopen — session restored. Sign in, view SecureStore contents — token present, AsyncStorage either empty or holds only opaque ciphertext.

**Warning signs:**
- `createClient(..., { auth: { storage: AsyncStorage } })` with no encryption layer.
- Token visible as JSON in AsyncStorage during dev.

**Phase to address:**
Phase covering F1 (auth). Wire SecureStore correctly *before* first sign-up, otherwise migration of stored sessions becomes another pitfall.

---

### Pitfall 2.5: RLS policy uses `using` but not `with check` (or vice versa)

**What goes wrong:**
A policy with only `using (user_id = auth.uid())` allows reading own rows but doesn't restrict inserts/updates — depending on the operation, a malicious client can insert rows with someone else's `user_id`. Conversely, `with check` only doesn't restrict reads.

ARCHITECTURE.md uses `for all using (...) with check (...)` for some policies but not all. The `plan_exercises` policy uses `for all using (exists ...)` *without* `with check` — meaning a user could potentially insert a `plan_exercises` row referencing someone else's plan.

**Why it happens:**
RLS clause semantics are non-obvious. `using` filters reads + which rows can be modified; `with check` validates the post-state of inserts/updates.

**How to avoid:**
- Every `for all` and `for insert`/`for update` policy needs `with check`, even if it duplicates `using`. For `plan_exercises`:
  ```sql
  create policy "Users can manage own plan exercises" on plan_exercises
    for all
    using (exists (select 1 from workout_plans where id = plan_id and user_id = auth.uid()))
    with check (exists (select 1 from workout_plans where id = plan_id and user_id = auth.uid()));
  ```
- Same audit needed on `exercise_sets` policy.
- Write integration tests: as user A, attempt to insert a row referencing user B's parent — must be rejected with 401/403, not silently inserted.

**Warning signs:**
- `for all using (...)` with no `with check`.
- No test that asserts "user A cannot write into user B's namespace."

**Phase to address:**
Schema migration phase. Audit all 6 policies in ARCHITECTURE.md before applying schema; correct the gap, then write the cross-user negative tests as a fixture.

---

### Pitfall 2.6: Hardcoded Supabase URL/key in source files instead of env

**What goes wrong:**
Beginner pastes URL and anon key directly into `lib/supabase.ts` to get past initial setup. Pushes to GitHub (even private repo, but: bots scrape, account compromise, contractor access later).

The anon key alone is not catastrophic (RLS is still enforced) — but it allows targeted attacks against your specific project, exhausts free-tier rate limits, and signals operational sloppiness.

**Why it happens:**
Env vars in Expo require `EXPO_PUBLIC_` prefix and a Metro restart; that friction encourages shortcuts.

**How to avoid:**
- `lib/supabase.ts` reads ONLY from `process.env.EXPO_PUBLIC_SUPABASE_URL` and `process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Add a runtime guard: throw on app start if either is missing.
- `.env.local` is in `.gitignore` (verify before first commit with secrets).
- Add a `.env.example` with placeholder values to document what is needed.

**Warning signs:**
- `git grep -E "https://[a-z0-9]+\.supabase\.co"` finds matches in source.
- `git grep "eyJhbGciOi"` (JWT prefix) finds any matches outside docs.

**Phase to address:**
Phase 1 / Bootstrap, the very first time the Supabase client is imported.

---

## 3. RN/Expo Newcomer Pitfalls

### Pitfall 3.1: Reanimated 4 / Worklets plugin double-registration

**What goes wrong:**
Per Reanimated docs and multiple Expo SDK 54 issue threads: Reanimated 4.1 already includes `react-native-worklets/plugin` *inside* `react-native-reanimated/plugin`. Adding both to `babel.config.js` produces "Duplicate plugin/preset detected." Adding only worklets and not reanimated produces missing-binding errors. Adding only the *old* reanimated plugin from copy-pasted SDK 50 tutorials produces silent worklet failures.

**Why it happens:**
Expo SDK 54 ships Reanimated 4 (was 3 in SDK 53). Most tutorials online predate this change. The `expo-router` boilerplate included Reanimated already — adding NativeWind compounds the babel config confusion.

**How to avoid:**
- `babel.config.js` includes `react-native-reanimated/plugin` only — last in the plugin list. Do **not** add `react-native-worklets/plugin` separately.
- After any change to `babel.config.js` or `metro.config.js`: `npx expo start --clear` to bust cache. "It still doesn't work" almost always = stale Metro cache.
- After installing/upgrading Reanimated/Worklets/NativeWind: `npx expo install --fix` to reconcile peer-dep versions, then restart Metro.
- Do not attempt to downgrade Reanimated to 3.x on SDK 54 — there is a known bug (expo/expo#39862) where the downgrade fails to install correctly.

**Warning signs:**
- "Duplicate plugin/preset detected" on Metro start.
- "ReferenceError: _WORKLET" or "worklet is not defined" at runtime.
- Animations silently no-op.

**Phase to address:**
Phase 1 / Bootstrap, during stack install. Get this right before adding any animation, otherwise all later screens are unreliable.

---

### Pitfall 3.2: NativeWind v4 setup — global.css missing or jsxImportSource wrong

**What goes wrong:**
NativeWind v4 with Expo SDK 54 has multiple required pieces: `babel-preset-expo` with `jsxImportSource: "nativewind"`, `nativewind/babel` preset, `withNativeWind(config, { input: './global.css' })` in `metro.config.js`, and a `global.css` with the three Tailwind directives. Miss any one and `className=` does nothing — silently. No error, no styles applied. Beginners conclude "Tailwind doesn't work in RN."

**Why it happens:**
Three config files (babel, metro, global.css) must all align. Tutorials covering NativeWind v2/v3 use a different setup entirely, so Google answers are wrong-version.

**How to avoid:**
- Follow [the official NativeWind installation guide](https://www.nativewind.dev/docs/getting-started/installation) for **v4 + Expo**, not StackOverflow.
- Required: NativeWind ≥ 4.2.0, Tailwind CSS 3.4.17 (NOT 4.x — that's for NativeWind v5). Lock these versions in `package.json`.
- Smoke test: a `<View className="bg-red-500 h-20" />` should be a red box. Test this immediately after install, before building any feature.
- After babel/metro changes: `npx expo start --clear` — same cache rule as 3.1.
- Don't add a `postcss.config.js` — not needed for Expo projects with NativeWind v4 and causes its own issues.

**Warning signs:**
- `className` props compile but do nothing visually.
- No `global.css` import in `app/_layout.tsx`.
- `tailwind.config.js` is at version 4.x.

**Phase to address:**
Phase 1 / Bootstrap. Smoke-test the styling pipeline as part of bootstrap acceptance; do not advance to feature phases otherwise.

---

### Pitfall 3.3: Expo Router auth guard via `useEffect` redirect (race + flicker)

**What goes wrong:**
Naive auth pattern: render the home screen, `useEffect` checks if user is signed in, navigates to `/sign-in` if not. The user briefly sees the protected screen, sees a flicker, and during that frame any TanStack Query inside that screen has already fired requests with no auth (they 401). Race conditions galore.

**Why it happens:**
React effects run after render. Beginners reach for `useEffect` because that's the React way.

**How to avoid:**
- Use Expo Router's first-class **`Stack.Protected`** (Expo Router 5+, included in SDK 54) with a `guard={isSignedIn}` prop, OR the `(auth)` / `(app)` group pattern with a layout-level redirect.
- Better: have the root layout return `null` (or a splash) until session-rehydration completes from SecureStore, *then* render the navigator. Single source of "auth known" state.
- Reference: [Expo's protected routes blog](https://expo.dev/blog/simplifying-auth-flows-with-protected-routes).

**Warning signs:**
- `if (!user) router.replace('/sign-in')` inside a `useEffect` of a protected screen.
- Brief flicker of protected UI during sign-out.
- 401 errors in the network tab right after launch.

**Phase to address:**
Phase covering F1 (auth) before any protected screen ships.

---

### Pitfall 3.4: Mismatched native module versions after `npm install` instead of `npx expo install`

**What goes wrong:**
Beginner runs `npm install victory-native` — gets the latest version. Latest version requires Reanimated 4.5; SDK 54 is on 4.1. App crashes on launch with native errors that look unrelated.

**Why it happens:**
`npm install` always grabs latest semver-compatible. `npx expo install` consults the Expo SDK compatibility table and pins versions known to work with the current SDK.

**How to avoid:**
- **Always** install native-affected libraries with `npx expo install <pkg>`, not `npm install`. This includes Supabase, AsyncStorage, SecureStore, Reanimated, Skia, victory-native, NativeWind, gesture-handler, screens, safe-area-context.
- For pure JS libs (zod, date-fns, zustand, TanStack Query): `npm install` is fine.
- After dependency changes, run `npx expo-doctor` — it flags version mismatches against the current SDK.

**Warning signs:**
- `expo-doctor` reports "Some dependencies are incompatible with the installed expo version."
- Mysterious native crashes after adding a library.

**Phase to address:**
Phase 1 / Bootstrap; reinforce in every phase that adds a dependency.

---

### Pitfall 3.5: TypeScript `any` everywhere because Supabase types aren't generated

**What goes wrong:**
The dev clones the Supabase JS quickstart, never runs `supabase gen types typescript`, types every query as `any` to silence errors, and loses every benefit of TS. A schema change later (e.g., renaming `weight_kg` to `weight`) compiles fine and crashes at runtime.

**Why it happens:**
Type generation requires CLI setup + project ID + a manual rerun whenever the schema changes. Easy to skip.

**How to avoid:**
- `supabase gen types typescript --project-id <id> > types/database.types.ts` after every migration. Add it as an `npm run gen:types` script.
- `createClient<Database>(...)` typed with the generated types — then every query is typed end-to-end.
- Pair with Zod schemas for all *external boundaries* (forms + Supabase responses): even with generated types, the network is still untrusted; Zod validates that what came over the wire matches the type. Mandate from PROJECT.md is "Zod for all extern data."
- Make "regenerate types" part of the migration checklist.

**Warning signs:**
- `types/database.types.ts` doesn't exist.
- `from('exercise_sets').select()` returns `any[]`.
- Zod schemas don't exist in `lib/schemas/` for query responses.

**Phase to address:**
Phase covering schema migration / Supabase setup. The first migration must be followed by the first type generation in the same commit.

---

### Pitfall 3.6: EAS Build certificate chaos on first iOS build

**What goes wrong:**
First time running `eas build -p ios`: provisioning profile / certificate errors cascade. "Distribution certificate hasn't been imported." "Provisioning profile doesn't include signing certificate." "No registered devices." The dev burns hours trying to fix it on a Windows machine without a Mac to inspect Keychain.

**Why it happens:**
iOS code signing was designed for Macs and Xcode. EAS Cloud Build does most of it for you — but only if you let it manage credentials end-to-end. Mixing manual cert management with EAS-managed produces the worst of both.

**How to avoid:**
- Choose **EAS-managed credentials**. Run `eas credentials` and let EAS create the cert + profile for you. Don't import anything from elsewhere.
- For first build, use the `development` profile (internal distribution) to validate the pipeline works before fighting App Store distribution.
- Bundle identifier (`ios.bundleIdentifier` in `app.json`) must be stable from day one — changing it later invalidates everything.
- Defer EAS Build entirely until the app actually needs it. V1 ships in Expo Go. EAS only matters when TestFlight/App Store is on the table — which PROJECT.md correctly defers.
- Provisioning profiles expire after 12 months → expect to redo this annually.

**Warning signs:**
- Mixing manually-uploaded certs with `eas credentials` runs.
- Bundle identifier changed after first build.
- "Trying to manage certs on Apple Developer portal in parallel with EAS."

**Phase to address:**
Defer to a TestFlight phase (V1.1 territory). Do **not** wrestle with EAS Build during the V1 build — Expo Go on personal device is the V1 distribution.

---

## 4. Supabase-Specific Pitfalls

### Pitfall 4.1: RLS policies querying parent table with N+1 perf collapse

**What goes wrong:**
The `plan_exercises` and `exercise_sets` policies use `exists (select 1 from parent_table where ...)` for every row. Postgres is good at this when indexed and when `auth.uid()` is wrapped, but naive policies cause a subquery per row and tank performance once data grows. With 1000+ sets per session (unrealistic) or 1000+ users (V2 territory), this matters.

**Why it happens:**
Standard RLS pattern from Supabase docs is fine for small-scale; doesn't surface the perf cost early.

**How to avoid:**
- Wrap `auth.uid()` in `(select auth.uid())` inside policies — Supabase's [RLS performance guide](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) shows this is dramatically faster because PG can cache the result per query rather than per row.
- Index foreign keys used in policy `exists` clauses (already done for `exercise_sets.session_id`, `plan_exercises.plan_id` in ARCHITECTURE.md — keep this discipline for new tables).
- For V1 personal use this is theoretical, but the wrapped-uid pattern costs nothing and pays off forever.
- Tracking: the Supabase dashboard's "Performance" tab and the `0013_*` advisors flag policy perf issues.

**Warning signs:**
- Policies use raw `auth.uid()` instead of `(select auth.uid())`.
- Set listing in a workout with 30+ entries takes >300ms over LTE.

**Phase to address:**
Schema migration phase. Apply the wrapped-uid pattern from day one.

---

### Pitfall 4.2: Migrations done in Supabase Studio without committing SQL

**What goes wrong:**
Beginner uses Studio's table editor to add a column, drop a constraint, etc. The change exists in the prod database but not in any migration file. Local environments and any future re-creation of the project cannot reproduce the schema. Type generation drifts. Disaster recovery is impossible.

**Why it happens:**
Studio is faster than CLI for one-offs. Beginners don't yet have the migration-as-truth instinct.

**How to avoid:**
- Treat Studio as **read-only** for schema. Every schema change goes through `supabase migration new <name>` → SQL file → `supabase db push`.
- Reference: keep ARCHITECTURE.md §4 schema as the canonical reference, materialized as one or more migration files in `supabase/migrations/`.
- Periodic check: `supabase db diff` against your prod project should be empty. If it isn't, someone made a Studio change.

**Warning signs:**
- Schema in `supabase/migrations/` doesn't match the live DB.
- `supabase db diff` shows pending unrecorded changes.

**Phase to address:**
Phase 1 / Bootstrap. Establish migration workflow before applying the initial schema.

---

### Pitfall 4.3: JWT auto-refresh fails when app is backgrounded for hours

**What goes wrong:**
Supabase access tokens default to 1-hour expiry. The client refreshes them automatically — but only while the JS engine is running. If the app is backgrounded for 2+ hours, the refresh never fires, the access token expires, and the next query fails with "JWT expired" or invalid-refresh-token.

**Why it happens:**
The auto-refresh background process is a JS interval — it stops when the OS suspends the JS thread.

**How to avoid:**
- Listen for `AppState` change to `active` and call `supabase.auth.startAutoRefresh()` (and `stopAutoRefresh` on `background`). This is in the Supabase Expo tutorial but easy to skip.
- On 401 from any query, attempt `supabase.auth.refreshSession()` once before surfacing the error to the user.
- Test deliberately: sign in, background app, wait ≥61 minutes, return — first action should succeed transparently.

**Warning signs:**
- No `AppState` listener wired to the Supabase client.
- Reports of "had to log in again after lunch."
- 401 errors on first action after long background.

**Phase to address:**
Auth phase (F1). Wire `AppState` ↔ `auth.startAutoRefresh` in the same place the Supabase client is configured.

---

### Pitfall 4.4: `ON DELETE CASCADE` chains accidentally erasing history

**What goes wrong:**
ARCHITECTURE.md correctly uses `on delete cascade` for `workout_sessions → exercise_sets` and `auth.users → workout_sessions`. But: `plan_exercises` has `on delete restrict` to `exercises`, and `workout_sessions.plan_id` has `on delete set null`. Inconsistency means an "innocent" delete of a workout plan via UI cascades to delete its `plan_exercises` (good) but `workout_sessions.plan_id` becomes null (loses the plan reference but keeps history — also good). However, if a beginner later changes a FK to `cascade` for "cleanliness," historical sets vanish.

**Why it happens:**
Cascade rules are written once and forgotten. Beginners don't realize the consequences until production data is gone.

**How to avoid:**
- Document the rule in a comment in the migration: "exercise FKs are RESTRICT — exercises are immutable history; deletion requires explicit archival."
- Add `archived_at` columns rather than DELETE for entities the user might want gone but you want to retain history for.
- Soft-delete plans (already in schema via `archived_at`) — don't hard-delete.
- Never change a FK rule without writing down what historical impact the change has.

**Warning signs:**
- A migration changes `on delete restrict` → `on delete cascade` without a comment explaining why.
- UI offers "Delete plan" without a "this will not delete past workouts" reassurance.

**Phase to address:**
Schema phase. The schema in ARCHITECTURE.md is sound; the discipline is to *not change it casually* later.

---

## 5. Offline-Sync Pitfalls

### Pitfall 5.1: UUID conflicts when two devices create rows offline

**What goes wrong:**
Default schema uses `gen_random_uuid()` server-side. If clients create rows offline and only generate IDs at sync time, you cannot reference them locally (foreign keys) until they're synced. Worse: optimistic UI uses temporary IDs, then has to rewrite all references when the server returns the real UUIDs — painful and bug-prone.

**Why it happens:**
Server-side ID generation is the default and works fine for online-only apps. Offline-first needs client-side IDs.

**How to avoid:**
- Generate UUIDs **on the client** using `crypto.randomUUID()` (or `react-native-uuid`). Pass the UUID in INSERT mutations. UUIDv4 collision probability is negligible.
- Server still has `default gen_random_uuid()` — it's only the fallback when client doesn't provide one.
- Foreign keys can reference the client-generated UUID immediately, so a session and its sets can be created entirely offline with consistent IDs throughout.

**Warning signs:**
- Mutations don't include `id` in the insert payload.
- Optimistic cache uses temp-ids that need rewriting after server response.

**Phase to address:**
Active-workout phase (before offline-queue is added). Establish client-UUID convention from day one — retrofitting later is painful.

---

### Pitfall 5.2: "Last-write-wins" applied to set logging causes silent overwrites

**What goes wrong:**
LWW is the classic offline-sync conflict resolution and ARCHITECTURE.md §7 names it explicitly ("senaste klient-tidsstämpeln vinner"). For exercise sets it's actually fine — sets are append-only, conflicts are extremely rare (same user, two devices, same exercise, same minute). But: if LWW is applied to the *session* row, and one device is logging sets while another finishes the session, the "finished" state can get unfinished by a stale write.

**Why it happens:**
"Apply LWW everywhere" is the default mental shortcut.

**How to avoid:**
- For `exercise_sets`: append-only, no LWW conflict possible. Insert with client UUID — duplicates fail on PK.
- For `workout_sessions`: `finished_at` is monotonic — once set, never cleared by sync. Make sync logic explicitly: "only update `finished_at` if the new value is non-null and the existing is null." Either client-side enforced or via a DB trigger.
- For `workout_plans` and `exercises` (user mutable): LWW with `updated_at` column is fine. Add `updated_at timestamptz default now()` to mutable tables.
- Document the resolution policy per table in a comment in the schema.

**Warning signs:**
- A workout that was finished on Phone A reappears as "in progress" after Phone B syncs.
- No `updated_at` columns on user-editable tables.

**Phase to address:**
Offline-sync phase (F13). Per-table resolution rules must be explicit.

---

### Pitfall 5.3: Mutation queue replays in wrong order

**What goes wrong:**
User offline: creates Plan A, adds 3 exercises to it, goes online. Queue replays in parallel — the "add exercise to Plan A" mutation runs before "create Plan A" finishes; FK violation; mutations fail; user sees errors and the data is in limbo.

**Why it happens:**
TanStack Query and most queue libraries don't enforce sequential ordering by default.

**How to avoid:**
- Use TanStack Query's mutation **scopes** (`scope: { id: 'plan-A' }`) — same scope = sequential, different scopes = parallel. Set scope to a parent ID for child mutations.
- Or maintain a single global "sync queue" Zustand store that drains sequentially. Per the [Whitespectre offline-first guide](https://www.whitespectre.com/ideas/how-to-build-offline-first-react-native-apps-with-react-query-and-typescript/), this is well-trodden.
- Idempotent mutations (client UUIDs help) so retries are safe.

**Warning signs:**
- FK violations in logs after going online.
- Queue replays in random order.
- Bug reports of "added exercise but it disappeared."

**Phase to address:**
Offline-sync phase (F13).

---

### Pitfall 5.4: TanStack Query `retry: 0` (default for mutations) drops queued offline mutations

**What goes wrong:**
Per TanStack Query docs and issue #4170: if a mutation fires while online, the network drops mid-flight, `retry` defaults to 0, the mutation enters error state immediately and is *not* paused for resume. The set is lost.

**Why it happens:**
Mutations default to `retry: 0` (queries default to 3). Easy to miss.

**How to avoid:**
- In `QueryClient` defaults, set `mutations: { retry: 1, retryDelay: ... , networkMode: 'offlineFirst' }`. Without `retry ≥ 1`, the offline pause mechanic doesn't engage.
- Use `@tanstack/query-async-storage-persister` with explicit `dehydrateOptions: { shouldDehydrateMutation: ... }` so mutations are persisted across reloads.
- On app launch, after rehydrating the cache, call `queryClient.resumePausedMutations()` then `queryClient.invalidateQueries()` to refresh.
- Reference: [TanStack offline guide](https://tanstack.com/query/v5/docs/framework/react/react-native).

**Warning signs:**
- `QueryClient` defaults are unspecified.
- App launch doesn't call `resumePausedMutations()`.
- "Mutation errored" in logs immediately on connection drop.

**Phase to address:**
Offline-queue setup phase (between bootstrap and active-workout). Verify with airplane-mode test.

---

### Pitfall 5.5: No way to see what's still pending to sync

**What goes wrong:**
User has been logging offline for an hour, has 40 sets in the queue. Closes the app. Forgets. Three days later wonders "did my last workout save?" There's no UI for "you have 40 unsynced sets" so they're never sure their data is safe.

**Why it happens:**
Queue is invisible by default. Beginners build the queue without exposing it to the UI.

**How to avoid:**
- A small badge or banner: "🔄 12 unsynced changes" with a tap-to-retry. Updates from queue length.
- After successful sync: brief "All changes saved ✓" toast.
- In Settings: "View pending sync" with the queue contents (count by table) — debuggable without reaching for logs.
- For paranoia: confirmation dialog before sign-out if queue is non-empty ("You have unsynced sets. Sync now?").

**Warning signs:**
- No UI element references queue length.
- Sign-out flow doesn't check queue.

**Phase to address:**
Offline-sync phase (F13). Visibility ships at the same time as the queue.

---

## 6. UX Pitfalls Specific to Gym Usage

### Pitfall 6.1: Tap targets too small for sweaty / large fingers

**What goes wrong:**
Standard mobile UI minimum tap target (44pt iOS HIG / 48dp Android) is fine in clean conditions. In a gym: sweaty hands slip, gym gloves reduce dexterity, heart-rate-elevated trembling. Set buttons that feel fine on a couch are missable mid-set.

**Why it happens:**
Designers test on couches, not after a heavy squat set.

**How to avoid:**
- "Klart"/"Save set" button minimum 64×64pt with 16pt padding to neighbors.
- Plus/minus increment buttons for reps and weight ≥ 56pt and well-separated (avoid accidental wrong-button taps).
- Numeric keypad: use `keyboardType="decimal-pad"` (iOS large numpad) — never the QWERTY keyboard with numbers. The decimal-pad gives 6+ pt-tall keys.
- Test the set logging flow with damp fingers (wet your fingertip before each tap). If you miss-tap >5%, redesign.

**Warning signs:**
- Tap targets <50pt.
- Default `keyboardType="default"` on weight inputs.
- No physical-condition usability test.

**Phase to address:**
F6 (logging set) phase. UX acceptance criteria include the wet-finger test.

---

### Pitfall 6.2: Modal-dense flows that interrupt the set rhythm

**What goes wrong:**
Each set logged opens a modal: "Confirm set? Yes/No." → close → "Add another? Yes/No." → close → next set. Cognitive overhead per set goes from 1 second to 8 seconds. The 3-second SLA from PROJECT.md is blown.

**Why it happens:**
Confirmation modals feel safe ("don't let users mistakenly save the wrong number"). They are: a) annoying, b) actually less safe because users tap-through without reading.

**How to avoid:**
- "Klart" tap commits the set instantly. No confirmation. Display in the set list with a subtle "undo" affordance for ~5s (snackbar).
- Pre-fill next set's reps/weight with the just-logged values. User's next action is "Klart" again, not re-entry.
- Use inline editing — tap a logged set's number to edit in place; no navigation.

**Warning signs:**
- The path "tap Klart → next set" requires more than 1 tap.
- Confirmation modals on every set.
- No undo on saved sets.

**Phase to address:**
F6 phase, with the 3-second SLA as a measurable acceptance criterion.

---

### Pitfall 6.3: "Last value" shown but not contextual to current set number

**What goes wrong:**
F7 says "show last value." A naive implementation shows "Last: 80kg × 8" — but that was the last *set* of the last session. For set #1, the user wants the comparable set #1 from last time (which might have been a heavier 6 reps). Without per-set context, "last value" is misleading and the user trains incorrectly.

**Why it happens:**
"Last value" is ambiguous in the requirement.

**How to avoid:**
- Show "Last session, set 1: 82.5kg × 8 RPE 7" aligned to current set position when available.
- Fall back to "Last session: peak 82.5kg" when no per-position match exists.
- Show top-3 historical sets as small chips below the input — user picks the relevant comparison.
- Query: order by `completed_at desc`, group by `(session, set_number)`, return last completed session's per-position.

**Warning signs:**
- The "last value" UI shows one number with no context.
- Users ask "but is that the last set of last time, or set 1 of last time?"

**Phase to address:**
F7 phase. Define "last value" precisely in design before implementation.

---

### Pitfall 6.4: Display in dim gym lighting without dark-mode-friendly contrast

**What goes wrong:**
F15 (dark mode) is "Bör" not "Måste" — but many gyms have low light. White-background app at 100% brightness blinds neighbors and burns through battery. Users dim the screen → contrast drops → numbers become unreadable. Logging takes longer, errors increase.

**Why it happens:**
Dark mode treated as a vanity feature instead of a usability requirement for this domain.

**How to avoid:**
- Ship dark mode in V1 even though it's "Bör." Use NativeWind's dark-mode `className`s from the start (`className="bg-white dark:bg-gray-900"`) — costs almost nothing during initial build, costs 3x to retrofit.
- Use `useColorScheme()` from React Native to follow system. No manual toggle in V1 — that's V1.x.
- Ensure text contrast ratio ≥ 7:1 for set numbers (AAA), since they're glanced at quickly.

**Warning signs:**
- Screens hardcoded with white/light backgrounds (`bg-white`) without `dark:` variants.
- Body text contrast ratio < 7:1.

**Phase to address:**
Phase 1 / Bootstrap. Set up dark-mode classNames as a project convention before any screen is built. Cheaper to do early.

---

### Pitfall 6.5: Rest timer that requires the screen to stay on / not background

**What goes wrong:**
User logs a set, starts rest timer (a future feature, not in V1 — but worth flagging), pockets phone, screen locks, JS engine suspends, timer freezes. They come back to "00:42" not "02:30" — and the haptic/sound that should have signaled rest-end never fired.

**Why it happens:**
RN timers are JS timers, suspended with the JS engine. Beginners assume `setInterval` "just works."

**How to avoid:**
- This is V2-territory but document it now: a real rest timer needs `expo-keep-awake`, a native scheduled notification (`expo-notifications` with `scheduleNotificationAsync`), and clock drift correction (compute remaining from `started_at` not by decrementing).
- Until then: simple "rest start time" stamp + show "elapsed since last set" computed on-render. Less feature, more reliable.

**Warning signs:**
- Plans for a V2 rest timer with `setInterval` only.
- No `expo-notifications` or `expo-keep-awake` planned.

**Phase to address:**
Mark as "V2 research flag." Do not attempt rest timer in V1.

---

### Pitfall 6.6: "Discard workout" too easy / no recovery

**What goes wrong:**
A button "Avbryt pass" or "Rensa" exists next to "Avsluta pass." User mis-taps. "Are you sure? Yes/No" → reflex Yes → 30 minutes of lifting gone. This is the Garmin/Apple Watch pattern that fitness app reviews are full of horror stories about.

**Why it happens:**
Symmetry pressure: "save" needs a "discard" partner. Confirmation dialogs feel safe (they aren't — see 6.2).

**How to avoid:**
- **No "discard" button mid-session.** A session is finished or abandoned (timeout to auto-finish after 6 hours, with all sets retained). Never destructive.
- Empty session (no sets logged): "Avsluta utan att spara" is acceptable since there's nothing to lose.
- A discarded/finished session can always be opened from history and edited — no destructive action is irreversible.
- "Recently deleted" pattern (per MapMyFitness): even hard-delete from history goes to a 30-day soft-delete bucket.

**Warning signs:**
- A red "Discard workout" button exists.
- Confirmation dialogs are the only safety net.
- Hard delete with no undo.

**Phase to address:**
F5/F8 phase. Make "no destructive in-session actions" a design principle.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip `gen types typescript`, type as `any` | 10 min saved | Schema drift breaks at runtime, no IDE help | Never — generation is one command |
| Use AsyncStorage for Supabase session "for now" | Skip SecureStore size hassle | Token leak risk; migration later loses sessions | Never — hybrid pattern is the same effort |
| Hardcode anon key during dev "to test quickly" | No env var setup | Bot harvests, rate-limit DoS, embarrassment | Never — `EXPO_PUBLIC_*` is one line |
| `npm install` instead of `npx expo install` | Familiar workflow | Native version mismatches, mystery crashes | For pure-JS libs only |
| Build session in-memory, save on finish | Easier mental model for week 1 | Drops sets on any crash → violates "får aldrig förlora ett set" | Never — this is the core invariant |
| Disable RLS to debug "empty queries" | Restores visible data | Ships with RLS off → public DB | Never — diagnose with SQL editor as service-role |
| No `updated_at` columns on mutable tables | Slightly simpler schema | LWW sync is impossible later → forced rewrite | Never — column is free |
| Dark mode "later" | Slightly faster initial styling | Retrofitting `dark:` classes touches every screen | Only if a/b validating need (we know we need it) |
| Modal confirmation on every set | "Feels safe" | Blows 3-second SLA, users tap through anyway | Never — undo > confirm |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase + Expo Auth | AsyncStorage for session | SecureStore + AsyncStorage hybrid (key in SecureStore, encrypted blob in AsyncStorage) |
| Supabase + RLS | Enable RLS without policies → "deny everything" → disable RLS to fix | Enable + write policy in same migration; debug with service-role SQL editor |
| Reanimated 4 + NativeWind v4 | Add both reanimated and worklets babel plugins | Only `react-native-reanimated/plugin` — worklets is bundled |
| Expo Router + Supabase auth | `useEffect` redirect → flicker + race | `Stack.Protected` or `(auth)`/`(app)` group with layout-level redirect; root layout returns null until rehydration done |
| TanStack Query + offline | Default `retry: 0` on mutations + no persister | `retry: 1`, `networkMode: 'offlineFirst'`, AsyncStorage persister with low throttleTime, `resumePausedMutations()` on launch |
| Supabase + TS types | Hand-rolled types or `any` | `supabase gen types typescript` after every migration; `npm run gen:types` script |
| Zod + Supabase | Trust generated types as runtime guarantee | Generated types = compile-time; Zod = runtime — both required (PROJECT.md mandate) |
| Expo Go + EAS Build | Conflate "runs in Expo Go" with "builds in EAS" | Stay in Expo Go for V1; EAS only when TestFlight is on the table |
| Foreign keys + RLS | Policies use raw `auth.uid()` | Wrap with `(select auth.uid())` for query-plan caching |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| RLS subquery without indexed FK | Set list slow on 3G/LTE | Index FK columns referenced in `exists` clauses | 100+ rows per parent (any active user, V2) |
| Unwrapped `auth.uid()` in policy | Linear-in-rows perf | `(select auth.uid())` pattern | 1000+ rows queried (V2) |
| Optimistic update without keyed cache | Cache invalidation triggers full screen rerender | TanStack `queryKey` granularity per session/exercise | 30+ sets visible at once |
| Re-rendering set list on every keystroke | Frame drops while typing | `react-hook-form` Controller + `useMemo` on list | Any phone, any time |
| AsyncStorage write per keystroke | Storage thrash, battery drain | Throttle persister to ≥500ms; debounce input writes | Any phone, any time |
| Loading entire history for graph | App freeze on F10 | Aggregate query with `date_trunc`/`max`; LIMIT recent N | After 6 months of data |
| Large bundle from un-tree-shaken libs (lodash, moment) | Slow JS startup | `date-fns` (already chosen), avoid lodash | Always — prevent before it grows |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Service role key in client | Full DB compromise | Never use service role in `app/`; grep before commit |
| Anon key + RLS-off table | Public read/write of that table | `db lint` rule 0013; pg_policies SQL check before deploy |
| Policy with `using` only, no `with check` | Cross-user writes possible | Audit every policy; pair tests "user A cannot write to user B" |
| Token in AsyncStorage plaintext | Token theft via backup/jailbreak/malicious app | Hybrid SecureStore + encrypted AsyncStorage |
| URL/key hardcoded in source | Bot harvest, rate-limit DoS | `EXPO_PUBLIC_*` env vars; runtime guard; `.gitignore` for `.env.local` |
| Email enumeration via auth errors | Attacker maps user base | Generic "invalid credentials" message; rate-limit Supabase auth |
| No password requirements | Weak passwords | Zod schema enforces min 8 chars; Supabase has built-in min length config |
| Client trusts Supabase response shape | Schema drift = runtime crash with bad data persisted | Zod-validate every query response (PROJECT.md mandate) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Set logging > 3 sec from tap to saved | User reverts to paper | Per-set persistence + optimistic UI + visible pending state |
| QWERTY keyboard for weight | Slow, error-prone | `keyboardType="decimal-pad"` always |
| Tap targets <56pt | Mistaps mid-set, frustration | 64pt minimum for primary actions |
| White-on-dark only or vice versa | Unreadable in some lighting | Dark + light mode from V1; AAA contrast for numbers |
| "Discard workout" mid-session | Catastrophic data loss on mis-tap | No destructive in-session actions; soft-delete only |
| Modal-per-set confirmations | Blows the 3-sec SLA | Optimistic save + undo affordance |
| "Last value" shown without set-number context | User trains wrong | Show comparable set-position, not just last entry |
| No pending-sync indicator | User unsure if offline data is safe | Persistent badge with queue length |
| Numeric input loses focus on keyboard dismiss | Re-typing, errors | Lift form state above the row; never conditionally render the active row |
| Confusing kg/lb with stored values | Bad data in graphs forever | Canonical kg in DB; convert at boundary; per-set unit metadata |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Schema migration:** Often missing `enable row level security` and policies — verify `pg_policies` covers every public table; verify each policy has both `using` and `with check`.
- [ ] **Auth flow:** Often missing SecureStore session persistence and `AppState`-driven `startAutoRefresh` — verify session survives 70+ minutes background.
- [ ] **Active workout:** Often missing per-set persistence — verify "force-quit mid-workout, reopen" recovers all logged sets.
- [ ] **Active workout:** Often missing draft-session recovery — verify cold launch routes to "Continue session?" prompt when one is open.
- [ ] **Mutation:** Often missing `retry: 1` and persister — verify airplane mode → log set → close app → re-open online → set syncs.
- [ ] **Set input:** Often missing `keyboardType="decimal-pad"` — verify the iOS numeric pad with decimal appears, not QWERTY.
- [ ] **Set input:** Often missing Zod `multipleOf(0.25)` and max-bound — verify "1255" gets a soft warning.
- [ ] **History/graph:** Often missing index on `(exercise_id, completed_at desc)` — verify graph for an exercise with 500 sets loads in <500ms.
- [ ] **Sign-out:** Often missing pending-queue check — verify sign-out warns if unsynced changes exist.
- [ ] **Bundle config:** Often missing `npx expo-doctor` cleanup — verify it reports no issues before each phase milestone.
- [ ] **TypeScript:** Often missing regenerated `database.types.ts` after schema change — verify `gen:types` script runs as part of migration workflow.
- [ ] **Dark mode:** Often missing `dark:` variants on all screens — verify every screen toggles cleanly with system dark mode.
- [ ] **NativeWind:** Often missing global.css import in root layout — verify a smoke-test `<View className="bg-red-500 h-20" />` renders red.
- [ ] **Reanimated:** Often missing cache clear after babel change — verify `npx expo start --clear` is the recovery move whenever animations misbehave.
- [ ] **`.gitignore`:** Often missing `.env.local` — verify before first commit; rotate keys if it slipped.

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| RLS missing on a table (security) | LOW (if caught fast) — HIGH (if data accessed) | 1. `enable row level security` immediately. 2. Add policy. 3. Audit Supabase logs for any anon-key reads of that table. 4. If sensitive data exposed, notify and rotate. |
| Service role key committed to git | HIGH | 1. Rotate keys in Supabase dashboard immediately. 2. `git filter-repo` to scrub history. 3. Force push (with backup). 4. Audit access logs. |
| Set lost due to in-memory persistence | Cannot recover the lost data; HIGH for the user's trust | 1. Apologize, log workout manually. 2. Refactor to per-set persistence. 3. Add the "draft session recovery" so it can't happen again. |
| RLS policy too permissive | LOW–MEDIUM | 1. Tighten policy. 2. Run an audit query: any cross-user references in data? 3. Delete or reassign offending rows. |
| Schema drift (Studio changes vs migrations) | MEDIUM | 1. `supabase db diff` against prod. 2. Generate migration from diff. 3. Commit. 4. Establish "Studio is read-only" rule. |
| Reanimated/babel misconfig blocking dev | LOW | 1. `npx expo install --fix`. 2. Delete `node_modules` and `.expo`. 3. `npx expo start --clear`. 4. Verify babel config has only `react-native-reanimated/plugin`. |
| AsyncStorage session corruption | LOW (just sign in again) | 1. Try-catch around session deserialization. 2. On parse error, clear session and route to sign-in. 3. Add a "Sign out everywhere / clear local data" debug action. |
| Mutation queue jammed (FK violations) | MEDIUM | 1. Add scoped/sequential mutations (TanStack scopes). 2. For existing jammed queue: open a "queue inspector" debug screen, manually inspect, replay in order. |
| "Discard workout" hit by accident | HIGH (no recovery in V1 if hard-deleted) | Prevention is the only fix — implement soft-delete with 30-day retention. |
| Cert/provisioning chaos before TestFlight | MEDIUM (time only) | 1. `eas credentials` → "Set up new credentials" → let EAS manage end-to-end. 2. Don't import existing certs. 3. Use `development` profile to validate first. |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1.1 Save-on-finish only | Active-workout phase (F5/F6/F8) | Force-quit mid-workout test recovers all sets |
| 1.2 Optimistic without rollback | Same | Network-failure test surfaces blocking error, doesn't drop |
| 1.3 Throttled persister loses on kill | Offline-queue phase | App-backgrounded-mid-write test |
| 1.4 Form state lost on unmount | Active-workout phase | Notification-mid-input test |
| 1.5 Implausible weight values | Schema phase + F6 phase | Zod test fixtures with bad inputs |
| 1.6 No draft recovery | Active-workout phase | Cold-launch test with open session |
| 2.1 RLS forgotten on table | Phase 1 + every schema migration | `pg_policies` SQL check before each migration deploy |
| 2.2 RLS off "for debugging" | Phase 1 (establish rule) | git history grep for "disable rls" |
| 2.3 Service-role key in client | Phase 1 (`.env.local` setup) | git grep for `service_role` |
| 2.4 AsyncStorage session | Auth phase (F1) | Inspect SecureStore + AsyncStorage during dev |
| 2.5 RLS missing `with check` | Schema phase | Cross-user write fixture tests |
| 2.6 Hardcoded URL/keys | Phase 1 | Pre-commit grep + `.gitignore` audit |
| 3.1 Reanimated/Worklets plugin | Phase 1 (stack install) | Animation smoke test renders |
| 3.2 NativeWind misconfig | Phase 1 (stack install) | `bg-red-500` smoke test renders red |
| 3.3 useEffect auth guard | Auth phase (F1) | No flicker on sign-out test |
| 3.4 npm vs npx expo install | Phase 1 + every dep add | `npx expo-doctor` clean |
| 3.5 No generated types / `any` | Schema phase | `gen:types` exists in package.json; `database.types.ts` committed |
| 3.6 EAS cert chaos | DEFER to TestFlight phase (V1.1+) | Don't fight in V1 |
| 4.1 RLS perf | Schema phase | Wrapped `(select auth.uid())` in all policies |
| 4.2 Studio changes off-migration | Phase 1 (establish rule) | `supabase db diff` empty before each phase complete |
| 4.3 JWT refresh after background | Auth phase | 70-min background test |
| 4.4 Cascade rule mistakes | Schema phase | Documented FK comments in migration |
| 5.1 UUID server-only | Active-workout phase | Mutations include `id` field |
| 5.2 LWW on session row | Offline-sync phase (F13) | Multi-device test (or simulated) |
| 5.3 Out-of-order replay | Offline-sync phase (F13) | Airplane → create plan + add exercise → online → no FK errors |
| 5.4 retry: 0 default | Offline-queue phase | Mid-flight network drop test |
| 5.5 Invisible queue | Offline-sync phase (F13) | Queue badge visible in UI |
| 6.1 Small tap targets | F6 phase | Wet-finger usability pass |
| 6.2 Modal-dense flow | F6 phase | 3-sec SLA timing test |
| 6.3 Last-value ambiguous | F7 phase | Design spec defines "last value" precisely |
| 6.4 No dark mode in V1 | Phase 1 (convention) | Every screen has `dark:` variants |
| 6.5 Rest timer naive | DEFER to V2 | Don't attempt in V1 |
| 6.6 Discard workout button | F5/F8 phase | No destructive actions in active session |

## Sources

- [Supabase Database Advisors — RLS Disabled in Public](https://supabase.com/docs/guides/database/database-advisors?lint=0013_rls_disabled_in_public) — HIGH
- [Supabase RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — HIGH
- [Supabase Troubleshooting — RLS Simplified](https://supabase.com/docs/guides/troubleshooting/rls-simplified-BJTcS8) — HIGH
- [Supabase Expo React Native Tutorial (SecureStore tab)](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native?auth-store=secure-store) — HIGH (official; hybrid SecureStore + AsyncStorage pattern)
- [Inconsistent SecureStore vs AsyncStorage recommendations issue](https://github.com/supabase/supabase/issues/14523) — MEDIUM (community discussion of the SecureStore size problem)
- [Supabase User Sessions](https://supabase.com/docs/guides/auth/sessions) — HIGH
- [Supabase Generating TypeScript Types](https://supabase.com/docs/guides/api/rest/generating-types) — HIGH
- [Reanimated SDK 54 worklets version mismatch discussion](https://github.com/software-mansion/react-native-reanimated/discussions/8778) — HIGH (recent, official mainainer thread)
- [Reanimated Troubleshooting](https://docs.swmansion.com/react-native-reanimated/docs/guides/troubleshooting/) — HIGH
- [NativeWind Installation](https://www.nativewind.dev/docs/getting-started/installation) — HIGH
- [NativeWind Styling Not Working with Expo SDK 54](https://medium.com/@matthitachi/nativewind-styling-not-working-with-expo-sdk-54-54488c07c20d) — MEDIUM
- [Expo Router — Authentication](https://docs.expo.dev/router/advanced/authentication/) — HIGH
- [Expo Router — Protected Routes](https://docs.expo.dev/router/advanced/protected/) — HIGH
- [Expo blog — Simplifying auth flows with protected routes](https://expo.dev/blog/simplifying-auth-flows-with-protected-routes) — HIGH
- [Expo App Credentials](https://docs.expo.dev/app-signing/app-credentials/) — HIGH
- [TanStack Query React Native docs](https://tanstack.com/query/v5/docs/framework/react/react-native) — HIGH
- [TanStack Query offline mutations issue (#5244)](https://github.com/TanStack/query/issues/5244) — HIGH
- [TanStack Query offline mutations not paused (#4170)](https://github.com/TanStack/query/issues/4170) — HIGH
- [Whitespectre — Building Offline-First React Native Apps with React Query](https://www.whitespectre.com/ideas/how-to-build-offline-first-react-native-apps-with-react-query-and-typescript/) — MEDIUM
- [Benoit Paul — Adding Offline Capabilities with TanStack Query](https://www.benoitpaul.com/blog/react-native/offline-first-tanstack-query/) — MEDIUM
- [Offline-First Mobile App Architecture (DEV)](https://dev.to/odunayo_dada/offline-first-mobile-app-architecture-syncing-caching-and-conflict-resolution-518n) — MEDIUM
- [Android Developers — Build an offline-first app](https://developer.android.com/topic/architecture/data-layer/offline-first) — HIGH (transferable architecture principles)
- [Stormotion — Fitness App UI Design Principles](https://stormotion.io/blog/fitness-app-ux/) — MEDIUM
- [MadAppGang — Best Fitness App Design and Typical Mistakes](https://madappgang.com/blog/the-best-fitness-app-design-examples-and-typical-mistakes/) — MEDIUM
- [Visual guide to React Native TextInput keyboardType](https://www.lefkowitz.me/visual-guide-to-react-native-textinput-keyboardtype-options/) — HIGH
- [MapMyFitness — Restore a deleted workout](https://support.mapmyfitness.com/hc/en-us/articles/1500009117042-Restore-A-Deleted-Workout) — MEDIUM (precedent for soft-delete pattern)
- ARCHITECTURE.md §4 (RLS policies, schema), §6 (auth), §7 (offline), §8 (security) — local source, HIGH
- PROJECT.md (constraints, key decisions) — local source, HIGH
- PRD.md §7 (non-functional: ≤3-sec set logging, never lose a set) — local source, HIGH

---
*Pitfalls research for: personal gym tracker (Expo SDK 54 + Supabase + offline-first, RN/TS newcomer)*
*Researched: 2026-05-07*
