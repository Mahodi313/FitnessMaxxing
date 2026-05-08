---
phase: 01-bootstrap-infra-hardening
plan: 03
subsystem: infra
tags: [supabase, tanstack-query, securestore, asyncstorage, persister, providers, env-vars]

# Dependency graph
requires:
  - phase: 01-bootstrap-infra-hardening
    plan: 01
    provides: [full dependency stack installed — expo-secure-store, async-storage, aes-js, react-native-get-random-values, supabase-js, tanstack-query, netinfo]
  - phase: 01-bootstrap-infra-hardening
    plan: 02
    provides: [NativeWind pipeline active, global.css import in _layout.tsx, Stack screenOptions headerShown:false + StatusBar style:auto conventions]
provides:
  - Supabase client with LargeSecureStore (AES-256 session encryption, SecureStore key + AsyncStorage blob)
  - Runtime env-var guard (throws on missing EXPO_PUBLIC_SUPABASE_URL / KEY at module load)
  - phase1ConnectTest() — dev-only named export that proves network + auth-headers round-trip
  - QueryClient with staleTime:30s + gcTime:24h defaults and AsyncStorage persister (maxAge:24h)
  - Root layout with QueryClientProvider + AppState focusManager bridge + NetInfo onlineManager bridge + connect-test useEffect
affects:
  - 02-* (schema, migrations — Supabase project ref established here)
  - 03-* (auth UI — supabase client + LargeSecureStore are the auth storage foundation)
  - all subsequent phases that import @/lib/supabase or @/lib/query-client

# Tech tracking
tech-stack:
  added:
    - "@tanstack/react-query-persist-client (persist-client, pure-JS)"
    - "@types/aes-js@3.1.4 (devDep — aes-js ships no .d.ts)"
  patterns:
    - "LargeSecureStore: AES-256 blob in AsyncStorage, 256-bit key in SecureStore — mitigates 2048-byte SecureStore cap"
    - "EXPO_PUBLIC_* env-vars loaded via process.env; runtime guard throws if missing"
    - "Module-level focusManager + onlineManager event listeners (set once at import time, not inside component)"
    - "persistQueryClient called at module level in query-client.ts (not inside component)"
    - "phase1ConnectTest() gated with __DEV__ in useEffect"

key-files:
  created:
    - app/.env.example
    - app/lib/supabase.ts
    - app/lib/query-client.ts
  modified:
    - app/app/_layout.tsx
    - app/package.json
    - app/package-lock.json
  gitignored-not-tracked:
    - app/.env.local

key-decisions:
  - "phase1ConnectTest() queries non-existent table _phase1_smoke with .limit(0) — proves network + auth without touching real data; PGRST205/404 is the expected success signal"
  - "staleTime:30s + gcTime:24h — gcTime >= staleTime required (TanStack v5 gotcha); 24h matches persister maxAge so entries aren't gc'd before persister reads them"
  - "onlineManager (NetInfo bridge) wired in Phase 1, not deferred — D-06: avoids touching root layout in later phases"
  - "phase1ConnectTest() gated on __DEV__ — never fires in any future production build"
  - "Preserved Plan 01-02 _layout.tsx conventions: Stack screenOptions={{ headerShown: false }} + StatusBar style=auto — plan 03 PLAN.md example omitted these but 01-02-SUMMARY.md and CLAUDE.md Conventions make them load-bearing"
  - "@types/aes-js installed as devDep — aes-js 3.x ships no TypeScript declarations; required for tsc --noEmit to pass (TS7016)"

patterns-established:
  - "Supabase client: import only from @/lib/supabase — single source of truth for the client instance"
  - "Query cache persistence: AsyncStorage persister with 24h maxAge, configured at module level in query-client.ts"
  - "Root layout provider order: QueryClientProvider wraps Stack + StatusBar; module-level bridges run before any component mount"

requirements-completed: [F15]

# Metrics
duration: ~90min (user-setup checkpoint + iPhone verify included)
completed: 2026-05-08
---

# Phase 01, Plan 03: Env vars + Supabase-klient + provider-wired _layout + connect-test Summary

**Walking-skeleton round-trip closed: Supabase client with LargeSecureStore wired through TanStack Query provider stack with AsyncStorage persister, AppState/NetInfo bridges, and dev-only connect-test verified live on iPhone (status 404 PGRST205 = network + auth headers + client config all confirmed good)**

## Performance

- **Duration:** ~90 min (includes user-setup checkpoint for Supabase project + iPhone Expo Go verification)
- **Started:** 2026-05-08 (session)
- **Completed:** 2026-05-08
- **Tasks:** 5 (Task 1: user setup checkpoint; Tasks 2-4: auto; Task 5: human-verify checkpoint)
- **Files modified:** 6 tracked (+ 1 gitignored)

## Accomplishments

- Supabase client with LargeSecureStore (AES-256 encrypted sessions, mitigating SecureStore 2048-byte cap) live on iPhone
- TanStack Query provider stack complete: QueryClient + AsyncStorage persister (24h) + AppState focusManager + NetInfo onlineManager — all wired in root layout, nothing deferred
- Walking skeleton confirmed functional: Metro log proves network round-trip + auth-header acceptance against live Supabase project

## Task Commits

Each task was committed atomically:

1. **Task 1: User setup — Supabase project + env vars** — pre-resolved by user before Task 2 (URL + anon-key provided; JWT decoded confirmed `role:anon`, not `service_role`)
2. **Task 2: Install persist-client + create env files** — `fa4063f` (feat)
3. **Task 3: lib/supabase.ts with LargeSecureStore + connect-test** — `b2e2c99` (feat)
4. **Task 4: lib/query-client.ts + provider-stack _layout.tsx** — `8a90e1c` (feat)
5. **Task 5: iPhone Expo Go verification** — (checkpoint only — user approved with Metro log evidence)

**Plan metadata:** (this commit — docs: plan summary)

## Files Created/Modified

- `app/.env.example` — Committed placeholder documenting EXPO_PUBLIC_* env-var shape; includes comment that anon-key is public-by-design and service-role must never appear here
- `app/lib/supabase.ts` — Supabase client with LargeSecureStore wrapper (AES-256 + SecureStore key), AppState auto-refresh listener, runtime env-var guard, and `phase1ConnectTest()` named export
- `app/lib/query-client.ts` — QueryClient (staleTime:30s, gcTime:24h) + AsyncStorage persister (maxAge:24h) configured at module level
- `app/app/_layout.tsx` — Root layout: module-level focusManager + onlineManager bridges, QueryClientProvider wrapping Stack + StatusBar, __DEV__-gated connect-test useEffect
- `app/package.json` — Added `@tanstack/react-query-persist-client` (Task 2) and `@types/aes-js@3.1.4` devDep (Task 3 auto-fix)
- `app/package-lock.json` — Updated by above installs
- `app/.env.local` — Created with live Supabase URL + anon-key; gitignored, NOT tracked in repo (verified via `git ls-files`)

## Decisions Made

- **phase1ConnectTest() target table `_phase1_smoke`:** underscore-prefix by convention marks it as private/non-public, minimising collision risk. `.limit(0)` means even if the table existed, no data would be returned. Status 200-499 = "network + headers work" regardless of PostgREST error code.
- **staleTime:30s / gcTime:24h:** gcTime must be >= staleTime (TanStack v5 invariant). 24h for gcTime matches persister maxAge so cached entries are never garbage-collected before the persister has a chance to read them on next app launch.
- **onlineManager wired in Phase 1 (D-06):** wiring NetInfo bridge now avoids having a later phase touch the root layout solely for this infrastructure concern. The root layout is stable after this plan.
- **__DEV__ guard on connect-test:** ensures the diagnostic call never fires in any production build, eliminating T10 threat (unnecessary Supabase requests in prod).
- **Preserved Plan 01-02 _layout.tsx conventions:** Plan 03's PLAN.md example `_layout.tsx` snippet did not forward `<Stack screenOptions={{ headerShown: false }} />` or `<StatusBar style="auto" />`. These were preserved when composing the provider stack on top — they are load-bearing per 01-02-SUMMARY.md and codified in CLAUDE.md `## Conventions`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing @types/aes-js devDep**
- **Found during:** Task 3 (lib/supabase.ts creation)
- **Issue:** `aes-js` 3.x ships no TypeScript declarations. `npx tsc --noEmit` failed with TS7016 ("Could not find a declaration file for module 'aes-js'"). Plan did not anticipate this.
- **Fix:** Ran `npm install --save-dev @types/aes-js@3.1.4` (community type package matching aes-js 3.x API).
- **Files modified:** `app/package.json`, `app/package-lock.json`
- **Verification:** `npx tsc --noEmit` exits 0 after install.
- **Committed in:** `b2e2c99` (Task 3 commit)

**2. [Rule 2 - Missing Critical] Preserved Plan 01-02 _layout.tsx conventions in rewritten file**
- **Found during:** Task 4 (_layout.tsx replacement)
- **Issue:** Plan 03's PLAN.md example `_layout.tsx` used a bare `<Stack />` without `screenOptions={{ headerShown: false }}` and did not include `<StatusBar style="auto" />`. These conventions were established in Plan 02 and codified in CLAUDE.md `## Conventions`. Omitting them would have silently regressed the UI (visible header bar, broken status bar styling).
- **Fix:** Applied provider-stack on top of the full Plan 02 conventions. Final `_layout.tsx` has `<Stack screenOptions={{ headerShown: false }} />` and `<StatusBar style="auto" />` inside `<QueryClientProvider>`.
- **Files modified:** `app/app/_layout.tsx`
- **Verification:** Visual check on iPhone (Task 5) — no header bar visible, status bar renders correctly.
- **Committed in:** `8a90e1c` (Task 4 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both fixes necessary for correctness. No scope creep. @types/aes-js is a standard companion package for aes-js 3.x in TypeScript projects. Convention preservation is required by CLAUDE.md.

## Issues Encountered

None beyond the deviations documented above. The connect-test produced the expected PGRST205/404 on the first iPhone test with no additional debugging required.

## Verification Evidence

### Metro Connect-Test Log (iPhone, Expo Go — Task 5 user approval)

Verbatim log line from Metro terminal during iPhone verification:

```
LOG  [phase1-connect-test] {"dataLength": null, "errorCode": "PGRST205", "errorMessage": "Could not find the table 'public._phase1_smoke' in the schema cache", "ok": true, "status": 404}
```

**What this proves:**
- `status: 404` — HTTP response received from the live Supabase endpoint (not a network failure; a network failure would produce `status: 0` or a caught exception with "FAILED" prefix)
- `ok: true` — status is in the 200-499 range (client evaluates `status >= 200 && status < 500`)
- `errorCode: "PGRST205"` — PostgREST structured error; table `public._phase1_smoke` not found in schema cache (expected — this table was never created)
- `errorMessage` — confirms PostgREST received and processed the request with valid apikey + Authorization headers (an auth rejection would produce a 401/403 with a different error shape, not PGRST205)
- `dataLength: null` — no data returned (correct — `.limit(0)` plus table not existing)

**Conclusion:** network round-trip, auth-header acceptance, and client configuration are all confirmed good against the live Supabase project. Phase 2 can apply migrations against this project reference.

### Security Checks (Task 5)

- `git status` confirmed `app/.env.local` NOT in unstaged/staged file list — gitignore active
- `git grep -n "service_role|SERVICE_ROLE" app/` — no code matches (only doc comments warning against service_role use)
- No red screen on iPhone app start — runtime env-var guard did not fire (env-vars loaded correctly)

## Next Phase Readiness

Walking skeleton is complete. All five Phase 1 ROADMAP success criteria met:

1. Expo Go renders on iPhone — established in Plan 01-02
2. NativeWind class applies (bg-color change visible) — established in Plan 01-02
3. Dark mode system preference respected — established in Plan 01-02 (conventions preserved here)
4. `.env.local` gitignored + env-vars load at runtime — this plan (Task 2 + Task 5 security check)
5. Supabase round-trip confirmed in Metro log — this plan (Task 5 Metro log above)

**For Phase 2 (Schema + RLS + type generation):**
- Apply SQL migrations against the live Supabase project ref (`mokmiuifpdzwnceufduu.supabase.co`)
- After real schema lands and Phase 2 is complete: remove `phase1ConnectTest()` import and `useEffect` from `app/app/_layout.tsx` (the useEffect is the only caller; the export in `supabase.ts` can be deleted at the same time)
- `@/lib/supabase` is the single import path for the Supabase client — all Phase 2+ files must use this alias, never re-create a client
- F15 dark-mode + StatusBar conventions are intact and codified in CLAUDE.md `## Conventions`

---
*Phase: 01-bootstrap-infra-hardening*
*Plan: 03*
*Completed: 2026-05-08*
