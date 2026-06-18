# Architecture Research

**Domain:** Offline-first personal gym tracker (iOS, Expo + Supabase, single-user V1)
**Researched:** 2026-05-07
**Confidence:** HIGH (Context7-verified TanStack Query v5 + Expo Router patterns; official Supabase Expo tutorial verified)

---

## 0. Why this document exists

The locked stack is `ARCHITECTURE.md` in the repo root. This research file does **not** redesign the stack — it answers four implementation-shape questions that became urgent when **F13 offline-stöd was bumped from V1.5 "Bör" to V1 "Måste"**:

1. Section 7 of the root `ARCHITECTURE.md` says *"V1: kräver internet. V1.5: queue + persist + replay"*. With F13 promoted, this is wrong — offline-first must ship **in V1**. This file specifies the replacement Section 7.
2. What does the offline mutation queue actually look like in code, given the locked stack (TanStack Query v5 + Supabase + AsyncStorage)?
3. How does Expo Router 6's file-based routing interact with Supabase auth state — what's the concrete protected-route pattern?
4. In what order should a React Native newcomer build this so each step's "thing on screen" verifies the previous step?

Stack is locked. No alternatives are proposed.

---

## 1. System Overview (offline-first V1)

```
┌──────────────────────────────────────────────────────────────────────┐
│                       iPhone (Expo Go / EAS build)                    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Expo Router 6 (file-based)        app/_layout.tsx (root)      │  │
│  │                                                                 │  │
│  │  ┌──────────────┐  ┌────────────────────────────────────────┐  │  │
│  │  │ (auth) group │  │ (app) group  — Stack.Protected guard   │  │  │
│  │  │ sign-in      │  │   (tabs)/  index, history, settings    │  │  │
│  │  │ sign-up      │  │   plan/[id], workout/[sessionId], ...  │  │  │
│  │  └──────────────┘  └────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│           │                                  │                        │
│           ▼                                  ▼                        │
│  ┌──────────────────┐         ┌──────────────────────────────────┐    │
│  │ AuthSession ctx  │         │ TanStack Query v5 (server state) │    │
│  │ (React Context)  │         │ + setMutationDefaults per key    │    │
│  │ from supabase    │         │ + onMutate optimistic updates    │    │
│  │ onAuthStateChange│         │ + scope.id for serial ordering   │    │
│  └────────┬─────────┘         └──────────────────┬───────────────┘    │
│           │                                       │                    │
│           │                                       ▼                    │
│           │                    ┌──────────────────────────────────┐    │
│           │                    │ PersistQueryClientProvider       │    │
│           │                    │ + createAsyncStoragePersister    │    │
│           │                    │   (cache + paused mutations)     │    │
│           │                    └──────────────────┬───────────────┘    │
│           │                                       │                    │
│           │                    ┌──────────────────▼───────────────┐    │
│           │                    │ AsyncStorage  ← cache + queue    │    │
│           │                    └──────────────────────────────────┘    │
│           │                                                            │
│           ▼                                                            │
│  ┌──────────────────┐  ┌──────────────────────────────────────────┐    │
│  │ LargeSecureStore │  │ onlineManager (NetInfo) +                │    │
│  │ (encrypted blob  │  │ focusManager (AppState)                  │    │
│  │ in AsyncStorage; │  │   → triggers resumePausedMutations()     │    │
│  │ key in           │  └──────────────────────────────────────────┘    │
│  │ SecureStore)     │                                                  │
│  └────────┬─────────┘                                                  │
│           │                                                            │
└───────────┼────────────────────────────────────────────────────────────┘
            │ HTTPS  (when online — auto-refresh JWT)
            ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Supabase                                                             │
│  ┌─────────┐  ┌────────────┐  ┌──────────────────────────────────┐    │
│  │ Auth    │  │ Postgres   │  │ Auto REST (PostgREST) + RLS      │    │
│  │ (JWT)   │  │ 6 tables   │  │   policies on all 6 tables       │    │
│  └─────────┘  └────────────┘  └──────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

**Key insight for V1:** the offline queue is not a custom AsyncStorage queue we write ourselves. TanStack Query v5 already implements a paused-mutation queue. We use `PersistQueryClientProvider` + `createAsyncStoragePersister` to dehydrate paused mutations to AsyncStorage on app close, hydrate on app open, and call `resumePausedMutations()` when `onlineManager` reports the device is back online. This is a few hundred lines of setup, not a few thousand.

---

## 2. Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `app/_layout.tsx` | Wire global providers in order: `PersistQueryClientProvider` → `AuthProvider` → `Stack`. Configure `onlineManager`, `focusManager`. | One file, ~80 LOC. |
| `(auth)/` route group | Public routes (sign-in, sign-up). Visible only when `session === null`. | Two screens, react-hook-form + zod. |
| `(app)/` route group | All authenticated routes nested inside one `_layout.tsx` that gates on `session`. Pattern from official Expo docs. | Layout file + nested tabs/screens. |
| `lib/supabase.ts` | Singleton Supabase client, configured with `LargeSecureStore` adapter (SecureStore key + AsyncStorage encrypted blob), `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: false`. | ~50 LOC, copied from official Supabase Expo tutorial. |
| `lib/auth/ctx.tsx` | React Context exposing `{ session, isLoading, signIn, signUp, signOut }`. Subscribes to `supabase.auth.onAuthStateChange` once. | Use the official `useSession`/`SessionProvider` pattern from Expo Router docs. |
| `lib/query/client.ts` | Create `QueryClient` with `gcTime: 24h`, `networkMode: 'offlineFirst'` for queries. Define `setMutationDefaults` for each mutation key (`['set', 'add']`, `['session', 'finish']`, etc.) — required for paused-mutation hydration. | ~120 LOC. Critical: defaults must be set **before** `PersistQueryClientProvider` mounts. |
| `lib/query/persister.ts` | `createAsyncStoragePersister({ storage: AsyncStorage })`. | 5 LOC. |
| `lib/query/network.ts` | Wire `onlineManager.setEventListener` to NetInfo and `focusManager` to `AppState`. Trigger `queryClient.resumePausedMutations()` on `onSuccess` of `PersistQueryClientProvider` and on transitions from offline→online. | ~30 LOC. |
| `lib/queries/*.ts` | One file per resource: `plans.ts`, `exercises.ts`, `sessions.ts`, `sets.ts`. Each exports `useXQuery` and `useXMutation` hooks. Mutations call the matching `mutationKey` whose defaults are registered globally. | Pure hooks, no UI. |
| `lib/schemas/*.ts` | Zod schemas mirroring the Supabase tables. Used by react-hook-form and to validate Supabase responses. | One per table. |
| `lib/stores/*.ts` | Zustand stores for **UI-only** state (e.g. `useActiveSessionStore` to track which session is currently open in the workout flow). **Never** put server data here — that's TanStack's job. | Tiny. |
| `components/*` | Pure presentational. Take props, emit events. No data fetching. | Standard. |

**Architectural rule: server state lives in TanStack, UI state lives in Zustand, auth state lives in React Context.** Mixing these is the #1 way to corrupt the offline queue.

---

## 3. Recommended Project Structure

This is identical to the locked structure in the repo `ARCHITECTURE.md` Section 3, with three additions to support offline-first:

```
app/
├── app/                              # Expo Router routes
│   ├── _layout.tsx                   # Root: providers in correct order
│   ├── (auth)/
│   │   ├── _layout.tsx               # Stack with no header back button
│   │   ├── sign-in.tsx
│   │   └── sign-up.tsx
│   ├── (app)/                        # NEW (split from flat layout)
│   │   ├── _layout.tsx               # Auth guard lives here
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx             # Plans list
│   │   │   ├── history.tsx
│   │   │   └── settings.tsx
│   │   ├── plan/
│   │   │   ├── [id].tsx
│   │   │   └── new.tsx
│   │   ├── workout/
│   │   │   ├── [sessionId].tsx       # The hot path — must work offline
│   │   │   └── start.tsx
│   │   └── exercise/
│   │       └── [id].tsx
│   └── +not-found.tsx
├── components/
│   ├── ui/                           # Button, Card, TextInput primitives
│   ├── ExerciseCard.tsx
│   ├── SetRow.tsx
│   ├── PlanList.tsx
│   └── OfflineBanner.tsx             # NEW — visible queue indicator
├── lib/
│   ├── supabase.ts                   # createClient + LargeSecureStore
│   ├── auth/
│   │   └── ctx.tsx                   # SessionProvider + useSession
│   ├── query/                        # NEW (split from flat queries/)
│   │   ├── client.ts                 # QueryClient + setMutationDefaults
│   │   ├── persister.ts              # createAsyncStoragePersister
│   │   ├── network.ts                # onlineManager + focusManager wiring
│   │   └── keys.ts                   # Centralized query key factory
│   ├── queries/                      # Resource-scoped hooks
│   │   ├── plans.ts
│   │   ├── exercises.ts
│   │   ├── sessions.ts
│   │   └── sets.ts
│   ├── stores/
│   │   └── useActiveSessionStore.ts  # UI state only
│   ├── schemas/                      # Zod
│   └── utils/
│       └── uuid.ts                   # Client-generated UUIDs (critical)
├── types/
│   └── database.ts                   # supabase gen types typescript output
└── assets/
```

**Structure rationale (additions only):**

- **`app/(app)/_layout.tsx`** — The official Expo authentication-rewrites pattern places the guard inside the `(app)` group's layout, not in the root. This lets `(auth)/sign-in` remain reachable even when no session exists. Without this split you get redirect loops.
- **`lib/query/`** sub-folder — Offline-first requires four distinct concerns (client config, persister, network listeners, key factory) that benefit from being separate files. Cramming them into one file makes the inevitable `setMutationDefaults` debugging session miserable.
- **`lib/utils/uuid.ts`** — Sets logged offline must have client-generated UUIDs **before** they hit the queue, so optimistic-update lists have stable keys and so the eventual server insert is idempotent (server uses the same id). Use `expo-crypto`'s `randomUUID()`.

---

## 4. Architectural Patterns

### Pattern 1 — Offline-first mutation with optimistic update + paused-mutation persistence

**What:** Every write (log set, finish session, create plan) is structured as a TanStack `useMutation` whose `mutationFn` is registered globally via `setMutationDefaults`. The mutation runs immediately against the cache (`onMutate`), is sent to Supabase if online, and is paused/queued if offline. On reconnect, `resumePausedMutations()` flushes the queue in order.

**When to use:** All writes in V1. There is no "online-only" path — this pattern is the path.

**Trade-offs:**
- (+) Survives airplane mode, gym basement, app kill, phone reboot — the queue is in AsyncStorage.
- (+) UI feels instant: the set appears the moment the user taps "Save".
- (−) Forces every mutation to have a registered `mutationKey` with `setMutationDefaults`. A naïve inline `useMutation({ mutationFn: ... })` will **not** survive serialization — its function reference is lost on app close. This is the #1 footgun.
- (−) Conflict resolution is the developer's job. For V1 (single user, single device) we adopt **last-write-wins with client `completed_at` timestamp**, which is what the locked architecture already specifies.

**Example — log a set while offline:**

```typescript
// lib/query/client.ts — registered ONCE at app boot, BEFORE PersistQueryClientProvider
import { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { randomUUID } from 'expo-crypto';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24h — must be >= persister TTL
      staleTime: 1000 * 30,
      networkMode: 'offlineFirst', // serve cache when offline; don't error
      retry: 2,
    },
    mutations: {
      networkMode: 'offlineFirst', // pause when offline instead of failing
      retry: 3,
    },
  },
});

// Required: paused mutations carry only their `variables` through serialization.
// Their function reference is rebuilt from this default at hydrate-time.
queryClient.setMutationDefaults(['set', 'add'], {
  mutationFn: async (variables: NewSet) => {
    const { data, error } = await supabase
      .from('exercise_sets')
      .insert(variables)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  // Serial ordering within the same session — sets in order they were tapped.
  scope: { id: (vars: NewSet) => `session:${vars.session_id}` },
  onMutate: async (newSet) => {
    await queryClient.cancelQueries({ queryKey: ['sets', newSet.session_id] });
    const previous = queryClient.getQueryData<Set[]>(['sets', newSet.session_id]);
    queryClient.setQueryData<Set[]>(['sets', newSet.session_id], (old = []) => [
      ...old,
      newSet,
    ]);
    return { previous };
  },
  onError: (_err, newSet, context) => {
    if (context?.previous) {
      queryClient.setQueryData(['sets', newSet.session_id], context.previous);
    }
  },
  onSettled: (_data, _err, vars) => {
    queryClient.invalidateQueries({ queryKey: ['sets', vars.session_id] });
  },
});
```

```typescript
// lib/queries/sets.ts — what components actually call
import { useMutation } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';

export function useAddSet() {
  return useMutation({
    mutationKey: ['set', 'add'], // matches defaults registered above
  });
}

// In a component:
const addSet = useAddSet();

function onSavePressed(form: { reps: number; weight_kg: number }) {
  addSet.mutate({
    id: randomUUID(),                  // client-generated → idempotent insert
    session_id: activeSessionId,
    exercise_id: currentExerciseId,
    set_number: nextSetNumber,
    reps: form.reps,
    weight_kg: form.weight_kg,
    completed_at: new Date().toISOString(),
    is_warmup: false,
  });
  // ↑ returns immediately. Cache updated. UI shows new set.
  // If offline, mutation is paused and persisted; resumes on reconnect.
}
```

```typescript
// app/_layout.tsx — wire it all up
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager, focusManager } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';
import { useEffect } from 'react';
import { queryClient } from '@/lib/query/client';

const persister = createAsyncStoragePersister({ storage: AsyncStorage });

// Wire NetInfo → TanStack onlineManager (one-time, module scope)
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((s) => setOnline(!!s.isConnected)),
);

export default function RootLayout() {
  // Wire AppState → focusManager (refetch when app foregrounds)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (status) => {
      if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
    });
    return () => sub.remove();
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 }}
      onSuccess={() => {
        // Cache restored from AsyncStorage — flush any paused mutations now.
        queryClient.resumePausedMutations();
      }}
    >
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
```

### Pattern 2 — Expo Router auth guard via `Stack.Protected` + `(auth)` / `(app)` route groups

**What:** Two parallel route groups. `(auth)/` is reachable when there is no session. `(app)/` is reachable when there is a session. The root `_layout.tsx` uses `Stack.Protected` (Expo Router 6+) to mount one or the other based on `useSession()`. `(app)/_layout.tsx` adds a second-line defense with `<Redirect>` so a stale render can't leak protected content.

**When to use:** This is the only auth pattern endorsed by Expo's official docs for Router 6. Don't roll your own.

**Trade-offs:**
- (+) Declarative, no `useEffect`-driven `router.replace` races.
- (+) `Stack.Protected` is built into Expo Router 6 — no extra dependency.
- (−) Requires the `(app)` and `(auth)` groups to be siblings, which means restructuring the locked folder layout slightly (call out under "Structure rationale" above).

**Example:**

```typescript
// lib/auth/ctx.tsx — the SessionProvider pattern from Expo Router docs
import { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type AuthCtx = {
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthCtx>(null!);
export const useSession = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) =>
      setSession(s),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };
  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
```

```typescript
// app/_layout.tsx — root navigator with Stack.Protected
import { Stack } from 'expo-router';
import { useSession } from '@/lib/auth/ctx';

function RootNavigator() {
  const { session, isLoading } = useSession();
  if (isLoading) return null; // splash stays up

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
```

```typescript
// app/(app)/_layout.tsx — second-line defense
import { Redirect, Stack } from 'expo-router';
import { useSession } from '@/lib/auth/ctx';

export default function AppLayout() {
  const { session, isLoading } = useSession();
  if (isLoading) return null;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

### Pattern 3 — Serial ordering with `scope.id`

**What:** TanStack v5 mutation `scope` ensures all mutations sharing the same `scope.id` run sequentially, never in parallel. Critical for sets within one session: set 5 must reach Supabase after set 4, even if set 4 is mid-retry.

**When to use:** Any time write order within a logical group matters. For the gym tracker: scope by `session:${session_id}` for sets, and globally for plan/exercise mutations.

**Trade-offs:**
- (+) Solves the "out-of-order writes" problem without a custom queue.
- (−) Adds latency between writes within a scope when online — usually invisible (10s of ms).

### Pattern 4 — Idempotent inserts via client-generated UUIDs

**What:** Generate the row's `id` on the client (`expo-crypto.randomUUID()`) and include it in the insert payload. Combined with a Supabase `unique` constraint or `upsert`, this makes "did my queued mutation actually run?" a non-question.

**When to use:** Every insert that goes through the offline queue. The schema in the locked architecture already uses `gen_random_uuid()` as the default — switching to client-supplied UUIDs requires changing the insert call to include `id`, nothing schema-side.

**Trade-offs:**
- (+) Replaying the queue is safe even if a mutation actually succeeded but the response was lost (network drop after server commit). Use `.upsert(..., { onConflict: 'id', ignoreDuplicates: true })` to make replays no-ops.
- (−) Slightly more code at every call site. Encapsulate via the `useAddSet` hook so callers never have to think about it.

---

## 5. Data Flow

### 5.1 Online write path

```
[Tap "Save set"]
    ↓
useAddSet().mutate({ id: uuid, ...payload })   (component)
    ↓
onMutate: cache update (instant UI feedback)   (TanStack)
    ↓
mutationFn: supabase.from('exercise_sets').insert(...)
    ↓
HTTPS → Supabase (RLS verifies user owns session)
    ↓
INSERT → Postgres
    ↓
{ data, error: null } → onSettled → invalidateQueries(['sets', session_id])
    ↓
Background refetch reconciles cache with server truth
```

### 5.2 Offline write path (THE critical path for V1)

```
[Tap "Save set" — phone in airplane mode]
    ↓
useAddSet().mutate({ id: uuid, ...payload })
    ↓
onMutate: cache update                          (TanStack — UI shows the set instantly)
    ↓
mutationFn called, fetch fails OR
networkMode: 'offlineFirst' detects offline via onlineManager
    ↓
Mutation transitions to isPaused: true          (TanStack queue)
    ↓
User logs more sets → all paused, all in cache, all in scope queue
    ↓
[App backgrounded / killed]
    ↓
PersistQueryClientProvider dehydrates queryClient → AsyncStorage
    ├── successful queries (cache: plans, history, etc.)
    └── paused mutations (the queue)
    ↓
[App reopened — still offline]
    ↓
PersistQueryClientProvider hydrates from AsyncStorage
    ↓
setMutationDefaults rebinds mutationFn to each paused mutation by mutationKey
    ↓
UI renders cached data; queued sets still visible
    ↓
[User walks out of gym, NetInfo reports isConnected: true]
    ↓
onlineManager.setOnline(true)                   (our event listener)
    ↓
TanStack auto-resumes paused mutations in scope order
    ↓
mutationFn fires for each → INSERT to Supabase (idempotent via client UUID)
    ↓
onSettled → invalidateQueries → background refetch reconciles
```

### 5.3 Conflict resolution (V1 scope)

Single user, primary device = iPhone. Within V1 we ship **last-write-wins by `completed_at`**:

- Sets are **append-only** in V1 (no edit-set UI in F6) — there is nothing to conflict on. Two replays of the same `id` are deduped via `upsert ignoreDuplicates`.
- Workout sessions: `finished_at` is set once on "Avsluta pass". If two devices set it, server keeps the latest by trigger or by client `updated_at` ordering.
- Plans/exercises (rare, low-frequency edits): last write wins by `completed_at` / row-level `updated_at`.

**This is sufficient for V1 because the success criterion in PRD §8 is "synk fungerar mellan iPhone och en andra enhet"** — not "concurrent multi-device editing". Anything stronger (CRDTs, vector clocks) is V2+ and explicitly out of scope.

### 5.4 Auth state flow

```
[App boot]
    ↓
supabase.auth.getSession()    (reads LargeSecureStore — encrypted blob)
    ↓                              ├── encryption key: SecureStore
    ↓                              └── ciphertext:    AsyncStorage
session restored OR null
    ↓
AuthProvider sets state → triggers Stack.Protected re-render
    ↓
[Token expiring]
    ↓
supabase auto-refresh (autoRefreshToken: true) silently rotates JWT
    ↓
onAuthStateChange fires 'TOKEN_REFRESHED' → no-op for UI
    ↓
[Sign out tapped]
    ↓
supabase.auth.signOut() → onAuthStateChange fires 'SIGNED_OUT'
    ↓
Stack.Protected re-renders → unmounts (app), mounts (auth)
    ↓
queryClient.clear() in signOut() — flush per-user cache
```

---

## 6. Suggested Build Order (for a React Native newcomer)

This is the safe scaffolding sequence. Each step ends with **a thing visible on the iPhone in Expo Go** that proves the previous step works. Skipping ahead is the fast way to spend a Saturday debugging why the offline queue silently drops mutations.

| Step | What you build | Why this position | What you see at the end |
|------|----------------|-------------------|-------------------------|
| **1. Install + run blank Expo** | `npm install` the locked deps from the stack list. Verify `npx expo start` shows the default screen on iPhone via Expo Go. | Validates Windows + Expo CLI + iPhone QR-code path before you've added anything that can break it. | Default Expo welcome screen on phone. |
| **2. NativeWind smoke test** | Configure NativeWind, write one `<Text className="text-2xl text-blue-500">Hello</Text>`. | Styling broken later is hard to diagnose mid-feature. Get it working first, alone. | Blue text on phone. |
| **3. Apply Supabase schema** | Run the SQL from locked `ARCHITECTURE.md` §4 in the Supabase SQL editor. Enable RLS, apply policies. | RLS-broken inserts fail confusingly. Validate with SQL editor that you can `select` your own row before trusting the client. | All 6 tables visible in Supabase dashboard with RLS enabled. |
| **4. Generate types** | `npx supabase gen types typescript --project-id ... > types/database.ts`. | Type-safe Supabase calls from day one. New TS users skip this and pay later. | `Database` type imported and visible in IDE. |
| **5. Supabase client + LargeSecureStore** | Create `lib/supabase.ts` using the official Expo tutorial code. Add a `__DEV__` log in root layout that prints `await supabase.auth.getSession()`. | Storage adapter wrong = sessions don't survive app restart. Verify *before* writing auth UI. | Console log shows `null` session on first boot. |
| **6. Manual sign-up + getSession persistence test** | In Supabase dashboard, manually create a test user. In a temporary screen, call `supabase.auth.signInWithPassword(...)` with hardcoded creds, then call `getSession()` after a hot reload. | Validates `LargeSecureStore` round-trip end-to-end. This is the moment the gym-basement-Wi-Fi guarantees become real. | Session persists across reload. |
| **7. AuthProvider + onAuthStateChange** | Build `lib/auth/ctx.tsx`. Wrap a *temporary* root `<Stack>` in `<AuthProvider>`. Render session JSON in a debug screen. | Get the auth state machine right before any routing depends on it. | Session JSON updates in real time on sign-in/out. |
| **8. Expo Router groups + Stack.Protected** | Create `app/(auth)/sign-in.tsx` (placeholder), `app/(app)/_layout.tsx` (with `<Redirect>`), wire `Stack.Protected` in root `_layout.tsx`. Build minimal sign-in form (email/password TextInputs, no styling). | Auth UI without the guard wired = leaks. Guard without auth UI = unreachable. Build them together. | Sign-in form shows when signed out; tabs show when signed in; sign-out returns to form. |
| **9. QueryClient + setMutationDefaults skeleton** | Create `lib/query/client.ts` with `QueryClient`, register one `setMutationDefaults(['plan', 'add'])` for plans (simpler than sets). Wrap in `PersistQueryClientProvider`. **No optimistic updates yet** — just verify a plain online insert works through the default. | Get the mutation-defaults pattern working with the simplest possible resource before adding optimistic complexity. | Tap a button → row appears in Supabase. |
| **10. NetInfo + onlineManager wiring** | Install `@react-native-community/netinfo`, add the `onlineManager.setEventListener` block. Add an `<OfflineBanner>` that subscribes to `useIsOnline()` (hook over NetInfo). | Visible offline indicator turns subsequent debugging from "is it offline?" to "I know it's offline; what's the queue doing?" | Banner appears on airplane mode toggle. |
| **11. Optimistic update on the simple resource** | Add `onMutate`/`onError`/`onSettled` to the plan-add mutation. Toggle airplane mode, tap "create plan", watch UI update. Toggle airplane back on. Watch the row appear in Supabase. | Validate the full offline → optimistic → resume cycle on a forgiving resource (plans) before doing it on the hot path (sets). | Plan creation works fully offline; syncs on reconnect. |
| **12. Persistence across app kill** | Force-quit Expo Go while offline mutation is paused. Reopen offline. Verify mutation is still in the queue and re-pauses. Reconnect. Verify it flushes. | This is the actual V1 reliability requirement. Without testing this you have not validated F13. | Mutation survives app kill. |
| **13. Plans CRUD UI + exercises** | Now build real screens: plans list (`(tabs)/index`), new plan, exercise library, plan-exercise ordering. Reuse the offline pattern. | At this point the dangerous infra is proven; everything from here is product code. | F2, F3, F4 done. |
| **14. Workout flow — start + log set (THE hot path)** | Build `workout/start.tsx` and `workout/[sessionId].tsx`. Implement `useAddSet` mutation with `scope.id`. Force airplane mode. Log 20 sets across 4 exercises. Force-quit. Reopen offline. Reconnect. | This is what V1 exists for. By now you have every primitive needed; this step is composition. | F5, F6, F7, F8 done; queued sets survive app kill and replay in order. |
| **15. History list + last-value query** | `(tabs)/history.tsx` and the "last 5 sets for this exercise" query for F7's display. Cache stays warm offline. | Read-side feature, depends on data existing — must come after step 14. | F9 done; opening the app offline shows past workouts. |
| **16. Polish: dark mode, exercise detail screen** | F10 graph (victory-native), F15 dark mode (NativeWind class strategy). | These are V1 "Bör" — non-blocking for the core promise. | Optional V1 features done. |

**Newcomer-specific notes:**

- Step 5–7 is the highest-risk cluster for someone new to RN. Budget two evenings; the goal is "session survives reload" — nothing else.
- Steps 9–12 introduce TanStack's mutation defaults. This is the conceptually densest part of V1. Resist the urge to add features during this stretch.
- Resist `useEffect` for navigation. Expo Router 6's `Stack.Protected` + `<Redirect>` is the idiomatic path; `useEffect(() => router.replace(...))` causes flicker and double-navigation bugs that newcomers blame on Expo when it's actually their effect.
- Use `__DEV__` console logs liberally in steps 9–14. The offline queue is invisible without instrumentation.

---

## 7. Replacement for Section 7 of the locked `ARCHITECTURE.md`

The current Section 7 begins with *"V1: kräver internet."* — this contradicts the F13 → V1 Måste promotion. Replace with:

> **7. Offline-strategi (V1, krävs av F13)**
>
> Offline-first från första release. Implementeras med befintliga primitiver i den låsta stacken — ingen egen kö-implementation:
>
> - **Persistens:** `PersistQueryClientProvider` + `createAsyncStoragePersister` (officiell TanStack v5-plugin) dehydrerar queryClient (cache + paused mutations) till AsyncStorage på app-bakgrund/kill, hydrerar vid app-start.
> - **Kö:** Pausade mutations i TanStack v5 är kön. När enheten är offline (detekterat via NetInfo → `onlineManager`) sätts mutations till `isPaused: true` och persisteras. `setMutationDefaults` per `mutationKey` är obligatoriskt — utan det förlorar pausade mutations sin `mutationFn` vid serialisering.
> - **Optimistic UI:** Varje mutation har `onMutate` som uppdaterar cachen direkt; `onError` återställer; `onSettled` invaliderar för bakgrunds-refetch.
> - **Ordning:** `scope.id = "session:<id>"` på set-mutations garanterar serial replay inom ett pass.
> - **Idempotens:** Klient-genererade UUID via `expo-crypto.randomUUID()` på alla insert-rader; Supabase `upsert` med `ignoreDuplicates` gör replay säker även om servern redan tog emot raden.
> - **Konflikthantering V1:** Senaste klient-tidsstämpel vinner (`completed_at` / `updated_at`). Tillräckligt för enskild användare på primär-enhet (iPhone). Multi-device parallel-edit är V2+.
> - **Auth offline:** `LargeSecureStore` (krypterad blob i AsyncStorage med nyckel i SecureStore — Supabase officiella Expo-mönster) gör att session överlever offline-restart; JWT auto-refresh sker när nät återkommer.

This drop-in replacement is what the roadmap should treat as authoritative for Section 7 once F13 is officially V1.

---

## 8. Scaling Considerations

V1 is a single-user personal tool. Scaling here means "what survives the user using it heavily as a single user," not "what handles 100k users."

| Scale | Adjustments |
|-------|-------------|
| 1 user (V1) | Stack as locked. Free tier sufficient. |
| 1 user, 2 years of data | Add pagination on `history` list (cursor on `started_at desc`). Currently fine to fetch all sessions because volume is ~150/year. |
| Multiple users (V2 App Store) | RLS already correct (each query is `user_id = auth.uid()`). Add `created_at` indexes if missing. Consider Supabase Realtime for cross-device sync. |
| 100+ active users | First bottleneck is Supabase free tier RPS, not architecture. Move to Pro tier; add Edge Functions for any aggregate queries (max-volume PRs, etc.). |

### First bottlenecks (in order of likelihood for V1)

1. **AsyncStorage cache size** — `gcTime: 24h` on every query means a busy week of training can balloon the persisted cache. Mitigation: `dehydrateOptions.shouldDehydrateQuery` to exclude large list queries; rely on refetch-on-mount for those.
2. **Session listener leaks** — `onAuthStateChange` is easy to subscribe twice. Always unsubscribe in the same `useEffect` cleanup. Check React DevTools for duplicate AuthProviders.
3. **Persister hydration race** — `resumePausedMutations()` must be called from `PersistQueryClientProvider`'s `onSuccess`, not from a `useEffect` in a child component. Else the queue can flush before defaults are registered.

---

## 9. Anti-Patterns

### Anti-Pattern 1 — Inline `useMutation({ mutationFn: ... })` for mutations that need to survive offline

**What people do:** Write `useMutation({ mutationFn: async (vars) => supabase.from(...).insert(vars) })` directly in components.
**Why it's wrong:** When the mutation is paused offline and the app is killed, the `mutationFn` reference is lost during serialization. On hydrate, TanStack has variables but no function to call. The mutation hangs forever.
**Do this instead:** Register every mutation key in `setMutationDefaults` at app boot. Components only specify `mutationKey`, never `mutationFn`. Everything that touches Supabase goes through this gate.

### Anti-Pattern 2 — Storing server data in Zustand

**What people do:** `useWorkoutsStore` with `workouts: Workout[]` populated by a `fetchWorkouts()` action.
**Why it's wrong:** Now you have two sources of truth. TanStack's cache is the persisted offline source; Zustand isn't. Sets logged offline never sync. Bugs become "sometimes the data is wrong, sometimes it isn't."
**Do this instead:** Server data in TanStack only. Zustand for transient UI state — e.g. "which exercise tab is active in the workout screen", "is the unit toggle showing kg or lb in this session", "rest-timer countdown". Anything that survives a refetch belongs in TanStack.

### Anti-Pattern 3 — `useEffect`-based navigation guards

**What people do:** `useEffect(() => { if (!session) router.replace('/sign-in'); }, [session]);`
**Why it's wrong:** Renders the protected screen for one frame before redirecting (visible flicker / data leak). Effect ordering with route mounting causes double-navigation glitches.
**Do this instead:** `Stack.Protected guard={!!session}` in the root layout, plus `<Redirect href="/sign-in" />` in `(app)/_layout.tsx` for double safety. Both are render-time, not effect-time.

### Anti-Pattern 4 — Letting Supabase generate the row id for offline-queued inserts

**What people do:** Insert without `id`, let Postgres `gen_random_uuid()` produce it.
**Why it's wrong:** When the queued mutation eventually runs, the optimistic cache entry (which had no id, or a temp id) cannot be reconciled with the real row by id. Worse, if the network drops *after* server commit but *before* response, replay creates a duplicate.
**Do this instead:** Generate the UUID on the client before calling `mutate()`. Supabase insert includes the `id`. Server is configured to upsert on conflict.

### Anti-Pattern 5 — Putting `setMutationDefaults` calls inside React components

**What people do:** Inside a hook or component, call `queryClient.setMutationDefaults(...)`.
**Why it's wrong:** Defaults must exist *before* `PersistQueryClientProvider` hydrates and calls `resumePausedMutations()`. If they're set inside a component, hydration can race ahead of registration.
**Do this instead:** All `setMutationDefaults` live in `lib/query/client.ts` at module top-level, run once when the module is first imported.

### Anti-Pattern 6 — Skipping NetInfo and relying on fetch-failure detection

**What people do:** `networkMode: 'always'` and let mutations fail naturally on offline.
**Why it's wrong:** TanStack can't distinguish "offline" from "server returned 500" without `onlineManager` knowing the truth. Retries fire on every connection blip and waste battery.
**Do this instead:** Wire `onlineManager.setEventListener` to NetInfo at module scope. `networkMode: 'offlineFirst'` on the QueryClient. This is mandatory for the F13 promise.

---

## 10. Integration Points

### External services

| Service | Integration pattern | Notes |
|---------|---------------------|-------|
| Supabase Auth | `LargeSecureStore` adapter (encrypted blob in AsyncStorage + key in SecureStore) per official Expo tutorial. `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: false`. | SecureStore alone fails because session payload exceeds its 2KB limit. |
| Supabase REST | `@supabase/supabase-js` via TanStack mutation/query hooks only. Never call `supabase.from(...)` directly from a component. | RLS is enforced server-side; we never trust client filtering. |
| Supabase Realtime | **Not in V1.** Polling on app focus (via `focusManager`) is enough for single-user. | V2 if multi-device sync becomes a real requirement. |
| NetInfo (`@react-native-community/netinfo`) | Wired once to `onlineManager.setEventListener` at app boot. | Required for offline-first to work correctly. |
| AppState (RN core) | Wired to `focusManager.setFocused` on `change`. | Triggers background refetch on app foreground. |

### Internal boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Components ↔ Server data | Through TanStack hooks (`useXQuery`, `useXMutation`). Never direct supabase calls. | Single rule, hugely simplifies offline-first. |
| Components ↔ UI state | Through Zustand selectors. | Keep selectors narrow to avoid re-render storms. |
| Components ↔ Auth | Through `useSession()` only. | The provider hides the supabase coupling. |
| Mutations ↔ Server | Through `setMutationDefaults`-registered `mutationFn`. Never inline. | This is the ONE rule that makes offline-first work. |
| Forms ↔ Schemas | Through `react-hook-form` `resolver: zodResolver(schema)`. | Same zod schema validates Supabase responses where appropriate. |

---

## 11. Confidence Notes

- **HIGH confidence** on TanStack v5 patterns: Context7-verified directly against `@tanstack/react-query-persist-client`, `@tanstack/query-async-storage-persister`, `setMutationDefaults`, `scope`, `dehydrate`/`hydrate`, `onlineManager`, `focusManager`, `resumePausedMutations`. All cited from current v5 docs.
- **HIGH confidence** on Expo Router 6 auth guard: Context7-verified directly from `expo/expo` repo, multiple corroborating examples (`Stack.Protected`, `(app)`/`(auth)` group split, `<Redirect>` in nested layout).
- **HIGH confidence** on Supabase Expo client: Official tutorial code retrieved verbatim (LargeSecureStore class, createClient options).
- **MEDIUM confidence** on AppState-driven `startAutoRefresh()`/`stopAutoRefresh()`: searches confirm it exists as a pattern but the canonical Supabase Expo tutorial relies solely on `autoRefreshToken: true`. For V1 this is sufficient; if token refresh issues appear in the field, add the AppState listener as a follow-up.
- **MEDIUM confidence** on conflict resolution being adequate at last-write-wins: justified by V1 single-user/single-device scope (PRD §8) but flagged for re-evaluation if multi-device sync becomes a V2 user story.

## Sources

- [TanStack Query v5 — createAsyncStoragePersister](https://tanstack.com/query/v5/docs/framework/react/plugins/createAsyncStoragePersister) (Context7-verified)
- [TanStack Query v5 — Persisting Offline Mutations / setMutationDefaults](https://tanstack.com/query/v5/docs/framework/react/guides/mutations) (Context7-verified)
- [TanStack Query v5 — Optimistic Updates](https://tanstack.com/query/v5/docs/framework/react/guides/optimistic-updates) (Context7-verified)
- [TanStack Query v5 — onlineManager](https://tanstack.com/query/v5/docs/reference/onlineManager) (Context7-verified)
- [TanStack Query v5 — React Native guide (focusManager + AppState)](https://tanstack.com/query/v5/docs/framework/react/react-native) (Context7-verified)
- [TanStack Query v5 — Mutation Scopes](https://tanstack.com/query/v5/docs/framework/react/guides/mutations#mutation-scopes) (Context7-verified)
- [TanStack Query v5 — dehydrate/hydrate](https://tanstack.com/query/v5/docs/framework/react/reference/hydration) (Context7-verified)
- [Expo Router — Stack.Protected](https://github.com/expo/expo/blob/main/docs/pages/router/advanced/protected.mdx) (Context7-verified)
- [Expo Router — Authentication rewrites with (app)/(auth) groups](https://github.com/expo/expo/blob/main/docs/pages/router/advanced/authentication-rewrites.mdx) (Context7-verified)
- [Expo Router — Common navigation patterns (Stack.Protected with auth)](https://github.com/expo/expo/blob/main/docs/pages/router/basics/common-navigation-patterns.mdx) (Context7-verified)
- [Supabase JS — onAuthStateChange API](https://context7.com/supabase/supabase-js/llms.txt) (Context7-verified)
- [Supabase Expo Tutorial — LargeSecureStore adapter (canonical createClient code)](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native?auth-store=secure-store) (official docs, fetched 2026-05-07)
- [Supabase Discussion #14523 — store recommendations for React Native auth](https://github.com/supabase/supabase/issues/14523) (community confirmation of the 2KB SecureStore limit)

---
*Architecture research for: offline-first personal gym tracker on Expo + Supabase*
*Researched: 2026-05-07*
