// app/lib/query/persister.ts
//
// Phase 4 D-01: TanStack Query persister via @tanstack/query-async-storage-persister
// + persistQueryClient. Default maxAge: 24h (Phase 1 D-08). Phase 5 (active workout)
// + Phase 6 (history offline-cache) inherit this without revisions.
//
// Module-load-order dependency (RESEARCH §"Module-load order" + Pitfall 8.2):
//   - This file MUST execute AFTER lib/query/client.ts so the queryClient
//     instance + all 8 setMutationDefaults are live BEFORE the persister
//     hydrates the cache from AsyncStorage. A paused mutation hydrated without
//     its setMutationDefaults entry has lost its mutationFn reference.
//   - app/app/_layout.tsx imports client.ts → persister.ts → network.ts in
//     that exact order; the inline comment in _layout.tsx documents the rule.
//
// Reference: 04-PATTERNS.md §persister (1:1 inheritance from Phase 1).

import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { queryClient } from "@/lib/query/client";

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
});

persistQueryClient({
  queryClient,
  persister: asyncStoragePersister,
  maxAge: 1000 * 60 * 60 * 24, // 24h per Phase 1 D-08
});
