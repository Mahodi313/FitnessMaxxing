// app/lib/queries/sessions.ts
//
// Phase 5: Resource hooks for workout_sessions.
//
// Conventions (verbatim from plans.ts inheritance):
//   - Pitfall 8.1: every useMutation specifies ONLY mutationKey + scope. The
//     mutationFn + onMutate/onError/onSettled live in lib/query/client.ts
//     setMutationDefaults (Plan 01) so paused mutations re-hydrate against
//     the same logic the developer wrote (Pitfall 8.2).
//   - Pitfall 3 + Phase 4 D-04: scope.id is a STATIC string at useMutation()
//     time. useStartSession(sessionId) accepts the new session's UUID at
//     construction so scope = `session:${sessionId}`. NEVER a function-shape
//     scope.
//
// Query-side: Pitfall 8.13 — every Supabase response is fed through
// SessionRowSchema.parse() (NOT cast as Database type).
//
// References:
//   - 05-CONTEXT.md D-02, D-21, D-22
//   - 05-RESEARCH.md §useActiveSessionQuery + §useSessionQuery + scope binding
//   - PITFALLS §8.1, §8.13, §3

import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/query/client";
import { sessionsKeys } from "@/lib/query/keys";
import { SessionRowSchema, type SessionRow } from "@/lib/schemas/sessions";
import { useAuthStore } from "@/lib/auth-store";

// ---- Query / mutation variable shapes --------------------------------------

type SessionInsertVars = {
  id: string;
  user_id: string;
  plan_id?: string | null;
  started_at?: string;
};
type SessionFinishVars = { id: string; finished_at: string };

// ---- Queries ---------------------------------------------------------------

// useActiveSessionQuery — LIMIT 1 WHERE finished_at IS NULL ORDER BY started_at DESC.
// Returns null when there is no in-progress session for the current user.
//
// Belt-and-braces: client-side `.eq("user_id", userId)` PLUS RLS server-side
// scope = double-gate (T-05-15). `.maybeSingle()` rather than `.single()`
// avoids leaking row-count via an error shape when there is no active row.
export function useActiveSessionQuery() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useQuery<SessionRow | null>({
    queryKey: sessionsKeys.active(),
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("workout_sessions")
        .select("*")
        .eq("user_id", userId)
        .is("finished_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? SessionRowSchema.parse(data) : null;
    },
    enabled: !!userId,
  });
}

// useSessionQuery — single workout_session by id.
//
// initialData seeds from sessionsKeys.active() on first read. Phase 4 UAT
// 2026-05-10 precedent: an offline-created plan rendered "Laddar…" forever
// the first time the user navigated into it because:
//   1. mutate()'s onMutate ran async — by the time router.replace ran, the
//      dual-write to plansKeys.detail might not have landed.
//   2. The detail query was mid-flight and paused under offlineFirst —
//      status stayed 'pending' so the loading branch kept rendering.
// initialData closes both: TanStack v5 starts the query at status='success'
// when initialData returns a value, regardless of any background fetch.
// Paired with `if (!session)` (NOT isPending) loading gate in the screen.
export function useSessionQuery(id: string) {
  return useQuery<SessionRow>({
    queryKey: sessionsKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_sessions")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return SessionRowSchema.parse(data);
    },
    enabled: !!id,
    initialData: () => {
      const active = queryClient.getQueryData<SessionRow | null>(
        sessionsKeys.active(),
      );
      return active && active.id === id ? active : undefined;
    },
  });
}

// ---- Mutations -------------------------------------------------------------
// Variables-typed wrappers. mutationFn + lifecycle hooks live in
// lib/query/client.ts setMutationDefaults. scope.id is set at useMutation()
// time per the STATIC-string contract — pass `sessionId` to bind the hook
// to a specific session-scope so START → 25 SETs → FINISH replay FIFO under
// the same scope on reconnect.

// useStartSession — pass the to-be-created session's UUID at construction so
// scope = `session:${sessionId}` is a STATIC string at useMutation() time
// (Pitfall 3). Call-site pattern:
//   const [newSessionId] = useState(() => randomUUID());
//   const startSession = useStartSession(newSessionId);
//   startSession.mutate({ id: newSessionId, user_id, plan_id, started_at });
export function useStartSession(sessionId?: string) {
  return useMutation<SessionRow, Error, SessionInsertVars>({
    mutationKey: ["session", "start"] as const,
    scope: sessionId ? { id: `session:${sessionId}` } : undefined,
  });
}

// useFinishSession — UPDATE finished_at. Plan 01's setMutationDefaults for
// ['session','finish'] invalidates lastValueKeys.all on onSettled so a
// back-to-back session's F7 chips surface within milliseconds (Open Q#2).
export function useFinishSession(sessionId?: string) {
  return useMutation<SessionRow, Error, SessionFinishVars>({
    mutationKey: ["session", "finish"] as const,
    scope: sessionId ? { id: `session:${sessionId}` } : undefined,
  });
}
