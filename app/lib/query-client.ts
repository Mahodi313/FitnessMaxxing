// app/lib/query-client.ts
//
// Per D-08: TanStack Query persister via @tanstack/query-async-storage-persister + persistQueryClient.
// Default maxAge: 24h. Phase 4 (offline-kö) och Phase 6 (history offline-cache) ärver detta utan revidering.

import { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 30s staleTime: rimligt för en personlig app med modesta data-uppdaterings-frekvenser.
      // Phase 4-faser kan finjustera per query om hot path kräver lägre.
      staleTime: 1000 * 30,
      // gcTime ≥ staleTime per CLAUDE.md First-Time-User Gotchas (TanStack Query v5).
      // 24h matchar persister maxAge så cache-poster inte gc:as innan persister läser dem.
      gcTime: 1000 * 60 * 60 * 24,
      // Defaults för retry är OK (3 försök för queries; 0 för mutations) — Phase 4 sätter mutation retry per behov per PITFALLS §5.4.
    },
  },
});

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
});

persistQueryClient({
  queryClient,
  persister: asyncStoragePersister,
  maxAge: 1000 * 60 * 60 * 24, // 24h per D-08
});
