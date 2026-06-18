// app/lib/queries/session-pr-flags.ts
//
// Phase 13 (13-03): F18 PR-celebration — the history-LIST has_pr aggregator
// (D-14/PR-04). Wraps `get_session_pr_flags` (migration 0012, Plan 13-02).
//
// D-14 (PR-at-log-time, chronological, never migrating): the RPC runs the SAME
// strictly-prior window engine as get_exercise_pr_history, partitioned by
// exercise, then `bool_or`s each session down to a single has_pr boolean. The
// flag reflects whether ANY set in the session was a PR at the moment it was
// logged — it never migrates retroactively.
//
// D-08 (boolean flag only, no e1RM): the RPC returns ONLY session_id + the
// has_pr boolean — never a weight, reps, or e1RM figure. The list trophy is a
// pure status glyph; no client math.
//
// Hooks-legal single-call rationale (RESEARCH Open Q1): the history list cannot
// fold usePrHistoryQuery across every session's exercises — calling a hook in a
// loop violates the rules of hooks. Instead, this ONE hook takes the visible
// session-id array and makes ONE rpc call over it, returning a
// Record<session_id, has_pr> the list indexes by row. Absent key = no PR.
//
// Record, NOT Map (last-value.ts:18-22): JSON-persist safe — a Map rehydrates
// as {} through the AsyncStorage persister and .get throws. A Record survives
// the round-trip and supports O(1) lookup via `record[sessionId]`.
//
// Zod-parse boundary (T-13-06, PITFALLS §8.13): generated types are
// compile-time only; every row is parsed via SessionPrFlagRowSchema, never
// `as`-cast.

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { supabase } from "@/lib/supabase";
import { sessionPrFlagsKeys } from "@/lib/query/keys";

const SessionPrFlagRowSchema = z.object({
  session_id: z.string().uuid(),
  has_pr: z.boolean(),
});

export function useSessionPrFlags(sessionIds: string[]) {
  return useQuery<Record<string, boolean>>({
    queryKey: sessionPrFlagsKeys.byIds(sessionIds),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_session_pr_flags", {
        p_session_ids: sessionIds,
      });
      if (error) throw error;
      const rows = (data ?? []).map((row: unknown) =>
        SessionPrFlagRowSchema.parse(row),
      );
      return Object.fromEntries(rows.map((r) => [r.session_id, r.has_pr]));
    },
    enabled: sessionIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });
}
