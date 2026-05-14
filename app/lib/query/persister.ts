// app/lib/query/persister.ts
//
// Phase 4 D-01 (LOAD-side hydration now owned by Provider — Plan 05-05 / FIT-8):
// This module owns the SHARED `asyncStoragePersister` instance consumed by:
//   (a) PersistQueryClientProvider in app/app/_layout.tsx — for LOAD-side cache
//       hydration from AsyncStorage. Its onSuccess callback fires after the
//       round-trip completes and flips usePersistenceStore.hydrated → true,
//       which the workout-screen render gate consumes to show "Återställer
//       pass…" until cache is ready (closes Gap #2 from F13 brutal-test UAT
//       2026-05-13).
//   (b) app/lib/query/network.ts — for the AppState background-flush SAVE path
//       (`persistQueryClientSave({ queryClient, persister: asyncStoragePersister })`
//       on every `background`/`inactive` event, paired with throttleTime as
//       the two-belt mitigation — PITFALLS §1.3 + RESEARCH §Pitfall 2).
//
// SUPERSEDED: the imperative `persistQueryClient({ queryClient, persister, maxAge })`
// call previously executed here at module load. It is removed because there
// was no React-side signal to subscribe to that said "hydration done" — the
// PersistQueryClientProvider in _layout.tsx now owns the LOAD-side work and
// exposes the onSuccess callback that drives the hydration gate.
//
// Phase 5 D-25 hot-path durability gates remain:
//   1. throttleTime: 500 — lowered from default 1000ms so the in-memory
//      mutation window is half as long; force-quit-within-the-window has half
//      the chance of dropping the most-recent set.
//   2. Named export `asyncStoragePersister` so network.ts + _layout.tsx share
//      the same persister instance (single source of truth for storage adapter
//      + throttle config).
//
// Module-load-order dependency (RESEARCH §"Module-load order" + Pitfall 8.2):
//   - This file MUST execute AFTER lib/query/client.ts so the queryClient
//     instance + all 13 setMutationDefaults (8 Phase 4 + 5 Phase 5) are live
//     BEFORE the Provider hydrates the cache from AsyncStorage. A paused
//     mutation hydrated without its setMutationDefaults entry has lost its
//     mutationFn reference.
//   - This file must still load BEFORE network.ts because network.ts imports
//     `asyncStoragePersister` as a named export.
//   - The Provider's React-side mount happens AFTER all module-load imports
//     complete, so setMutationDefaults are guaranteed live before the
//     onSuccess callback can possibly fire.
//
// API verification (05-01-PLAN.md Task 2 Assumption A1 + A2):
//   - A1 PASS: `@tanstack/query-async-storage-persister` `_tsup-dts-rollup.d.ts`
//     declares `throttleTime?: number` in CreateAsyncStoragePersisterOptions.
//   - A2 PASS: network.ts uses `persistQueryClientSave` (the high-level helper
//     that takes `{ queryClient, persister }` and dehydrates + persists) —
//     functionally equivalent to the literal `asyncStoragePersister
//     .persistClient(queryClient)` snippet but type-safe.
//
// Reference: 04-PATTERNS.md §persister; 05-05-PLAN.md / FIT-8.

import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Phase 5 D-25: throttleTime lowered from default 1000ms → 500ms (PITFALLS §1.3).
// Named export so _layout.tsx (Provider) + network.ts (AppState save) share it.
export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  throttleTime: 500,
});
