// app/lib/queries/last-value.ts
//
// Phase 5: F7 set-position-aligned "previous value" query.
//
// Two-step SQL pattern per RESEARCH.md §Set-Position-Aligned "Last Value"
// Query:
//   STEP 1: find the most-recent finished session
//           (workout_sessions.finished_at IS NOT NULL) that contains a
//           working-set for this exercise_id, excluding the current session.
//   STEP 2: fetch all working-sets from that session for this exercise_id,
//           ordered by set_number.
//
// Returns Record<setNumber, { weight_kg, reps, completed_at }>. UI consumer:
//   const lastValueMap = useLastValueQuery(exerciseId, currentSessionId).data;
//   const prev = lastValueMap?.[currentSetNumber];
//   if (prev) render <LastValueChip ... />
//
// Why Record and not Map: TanStack Query persists cache via JSON.stringify
// through the AsyncStorage persister. JS Map serializes to "{}" through
// JSON and rehydrates as a plain object — calling `.get` on the rehydrated
// value would throw at runtime. Record<number, V> survives JSON round-trip
// losslessly and supports the same O(1) lookup via `obj[key]`.
//
// staleTime: 15 min per CONTEXT.md D-20 — pre-fetched on workout-screen
// mount.
//
// RLS: workout_sessions!inner join is RLS-scoped (Plan 01
// test-last-value-query Assertion 4 verified Assumption A3 — User B cannot
// see User A's history). Belt-and-braces:
// `.eq("workout_sessions.user_id", userId)` explicit filter
// (T-05-04 + T-05-07).
//
// Cache key is per-exercise only (NOT per-session). `currentSessionId` is a
// queryFn arg used to exclude the active session from the "most recent
// finished session" lookup, but it is intentionally NOT in the queryKey so
// two consecutive sessions for the same exercise share cache within
// `staleTime` (15 min). The Open Q#2 invalidation in
// setMutationDefaults[['session','finish']].onSettled (Plan 01) is the
// mechanism that refreshes this cache when a session completes; without
// that invalidation, F7 chips would lag for up to 15 min when starting a
// second session back-to-back.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { lastValueKeys } from "@/lib/query/keys";
import { SetRowSchema } from "@/lib/schemas/sets";
import { useAuthStore } from "@/lib/auth-store";

export type LastValueEntry = {
  weight_kg: number;
  reps: number;
  completed_at: string;
};

export function useLastValueQuery(
  exerciseId: string,
  currentSessionId: string,
) {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery<Record<number, LastValueEntry>>({
    queryKey: lastValueKeys.byExercise(exerciseId),
    queryFn: async () => {
      if (!userId) return {};

      // STEP 1: find the most-recent finished session for this exercise,
      // excluding the active session. The `workout_sessions!inner` join is
      // RLS-scoped server-side; `.eq("workout_sessions.user_id", userId)` is
      // belt-and-braces (Assumption A3 closed by Plan 01).
      const { data: sessionRow, error: sessionErr } = await supabase
        .from("exercise_sets")
        .select(
          "session_id, completed_at, workout_sessions!inner(id, user_id, finished_at, started_at)",
        )
        .eq("exercise_id", exerciseId)
        .eq("set_type", "working")
        .not("workout_sessions.finished_at", "is", null)
        .neq("session_id", currentSessionId)
        .eq("workout_sessions.user_id", userId)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sessionErr) throw sessionErr;
      if (!sessionRow) return {};
      const targetSessionId = sessionRow.session_id;

      // STEP 2: fetch every working set from that session for this exercise.
      // Narrowed select (4 columns) per T-05-07 — over-fetch surface
      // minimized; rpe + notes excluded (V1.1 / Phase 7 — not needed for F7
      // chip).
      const { data: sets, error: setsErr } = await supabase
        .from("exercise_sets")
        .select("set_number, weight_kg, reps, completed_at")
        .eq("session_id", targetSessionId)
        .eq("exercise_id", exerciseId)
        .eq("set_type", "working")
        .order("set_number", { ascending: true });
      if (setsErr) throw setsErr;

      const record: Record<number, LastValueEntry> = {};
      for (const s of sets ?? []) {
        // Parse the partial row via SetRowSchema.partial() (Pitfall 8.13 —
        // boundary parse, not cast). Only push entries with complete data.
        const parsed = SetRowSchema.partial().parse(s);
        if (
          parsed.set_number != null &&
          parsed.weight_kg != null &&
          parsed.reps != null &&
          parsed.completed_at != null
        ) {
          record[parsed.set_number] = {
            weight_kg: parsed.weight_kg,
            reps: parsed.reps,
            completed_at: parsed.completed_at,
          };
        }
      }
      return record;
    },
    enabled: !!exerciseId && !!userId,
    staleTime: 1000 * 60 * 15, // 15 min per CONTEXT.md D-20
  });
}
