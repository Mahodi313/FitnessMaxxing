// app/lib/query/persister.ts
//
// Phase 4 D-01: TanStack Query persister via @tanstack/query-async-storage-persister
// + persistQueryClient. Default maxAge: 24h (Phase 1 D-08). Phase 5 (active workout)
// + Phase 6 (history offline-cache) inherit this without revisions.
//
// Phase 5 D-25 hot-path durability gates (closes Phase 4 D-02 deferral):
//   1. throttleTime: 500 — lowered from default 1000ms so the in-memory mutation
//      window is half as long; force-quit-within-the-window has half the chance
//      of dropping the most-recent set.
//   2. Named export `asyncStoragePersister` so app/lib/query/network.ts can call
//      `persistQueryClientSave({ queryClient, persister: asyncStoragePersister })`
//      on every AppState `background`/`inactive` event — the two-belt mitigation
//      paired with throttle (PITFALLS §1.3 + RESEARCH §Pitfall 2).
//
// Module-load-order dependency (RESEARCH §"Module-load order" + Pitfall 8.2):
//   - This file MUST execute AFTER lib/query/client.ts so the queryClient
//     instance + all 13 setMutationDefaults (8 Phase 4 + 5 Phase 5) are live
//     BEFORE the persister hydrates the cache from AsyncStorage. A paused
//     mutation hydrated without its setMutationDefaults entry has lost its
//     mutationFn reference.
//   - app/app/_layout.tsx imports client.ts → persister.ts → network.ts in
//     that exact order; the inline comment in _layout.tsx documents the rule.
//
// API verification (05-01-PLAN.md Task 2 Assumption A1 + A2):
//   - A1 PASS: `@tanstack/query-async-storage-persister` `_tsup-dts-rollup.d.ts`
//     line 22 declares `throttleTime?: number` in CreateAsyncStoragePersisterOptions.
//   - A2 PASS: The Persister interface (query-persist-client-core
//     `_tsup-dts-rollup.d.ts` line 86–90) exposes `persistClient: (persistClient:
//     PersistedClient) => Promisable<void>` — but it takes a `PersistedClient`,
//     NOT a `QueryClient`. The high-level helper that takes `{ queryClient,
//     persister }` and dehydrates + persists is `persistQueryClientSave` from
//     `@tanstack/react-query-persist-client`. network.ts uses that helper for
//     the AppState background-flush (deviation from PLAN's literal
//     `asyncStoragePersister.persistClient(queryClient)` snippet, but
//     functionally equivalent and type-safe).
//
// Reference: 04-PATTERNS.md §persister (1:1 inheritance from Phase 1).

import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { queryClient } from "@/lib/query/client";

// Phase 5 D-25: throttleTime lowered from default 1000ms → 500ms (PITFALLS §1.3).
// Named export so network.ts can flush on AppState background/inactive.
export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  throttleTime: 500,
});

persistQueryClient({
  queryClient,
  persister: asyncStoragePersister,
  maxAge: 1000 * 60 * 60 * 24, // 24h per Phase 1 D-08
});
