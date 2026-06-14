// app/lib/queries/best-e1rm.ts
//
// Phase 13 (13-03): F18 PR-celebration — the offline-first ALL-TIME-BEST
// working-set reference per exercise. This is the live-detection baseline:
// a candidate set is a PR (PR-01) when its e1RM beats this stored best
// (AND beats every earlier in-session working set — D-07, the caller's
// concern). Wraps `get_best_working_sets` (migration 0012, Plan 13-02).
//
// D-06 (offline-first all-time-best): mirrors `last-value.ts` EXACTLY —
// persister-hydrated, RLS-scoped, `userId` belt-and-braces, the SAME 15-min
// staleTime. The single PersistQueryClientProvider hydrates this slot for free
// so live PR detection works on a cold offline start (no network round-trip
// needed before the first set of a back-to-back session is judged).
//
// Record, NOT Map (last-value.ts:18-22 — load-bearing for the persister):
// TanStack persists the cache via JSON.stringify through the AsyncStorage
// persister. A JS Map serializes to "{}" and rehydrates as a plain object —
// calling `.get` on the rehydrated value throws at runtime. A
// `Record<exerciseId, {weight_kg, reps}>` survives the JSON round-trip
// losslessly and supports O(1) lookup via `record[exerciseId]`.
//
// D-08 (raw sets, JS owns the formula): the RPC returns the RAW best
// `weight_kg` + `reps` per exercise — NOT a precomputed e1RM. The internal SQL
// e1RM (migration 0012) is ordering-only and never crosses the boundary. The
// consumer computes the displayed/compared e1RM via `lib/e1rm.ts`
// (`epley1RM(weight_kg, reps)`), the single Epley source.
//
// Zod-parse boundary (T-13-06, PITFALLS §8.13): generated `database.ts` types
// are compile-time only. Every RPC row is parsed via BestWorkingSetRowSchema —
// never `as`-cast.

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { supabase } from "@/lib/supabase";
import { bestE1rmKeys } from "@/lib/query/keys";
import { useAuthStore } from "@/lib/auth-store";

// PostgREST returns numeric/bigint columns as strings — z.coerce.number()
// normalizes. reps is int NOT NULL on the wire → `.int()`. exercise_id is the
// RPC's grouping key (uuid).
const BestWorkingSetRowSchema = z.object({
  exercise_id: z.string().uuid(),
  weight_kg: z.coerce.number(),
  reps: z.coerce.number().int(),
});

export type BestWorkingSet = { weight_kg: number; reps: number };

export function useBestE1rmQuery() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery<Record<string, BestWorkingSet>>({
    queryKey: bestE1rmKeys.all,
    queryFn: async () => {
      // Belt-and-braces (T-13-07): the RPC is SECURITY INVOKER + RLS-scoped
      // (inherits 0001 own-row policies), but skip the network entirely with
      // no authed user — same guard as last-value.ts:63.
      if (!userId) return {};

      // get_best_working_sets has `Args: never` (no parameters) — call with no
      // second argument. Returns one row per exercise: the all-time-best
      // working set ordered by internal e1RM (D-06).
      const { data, error } = await supabase.rpc("get_best_working_sets");
      if (error) throw error;

      const record: Record<string, BestWorkingSet> = {};
      for (const row of data ?? []) {
        // Parse every row at the boundary — never `as`-cast (Pitfall 8.13).
        const parsed = BestWorkingSetRowSchema.parse(row);
        record[parsed.exercise_id] = {
          weight_kg: parsed.weight_kg,
          reps: parsed.reps,
        };
      }
      return record;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 15, // 15 min — mirrors last-value.ts (D-06)
  });
}
