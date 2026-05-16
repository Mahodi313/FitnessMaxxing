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

import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
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
type SessionFinishVars = { id: string; finished_at: string; notes?: string | null };

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

// ---------------------------------------------------------------------------
// Phase 6 — F9 cursor-paginated history list (06-CONTEXT.md D-01/D-03/D-08,
// 06-RESEARCH.md §Pattern 1).
//
// Consumes the get_session_summaries RPC deployed in Plan 06-01a (migration
// 0006). The RPC returns 8 columns per row aggregated server-side
// (working-set canonical filter — Pitfall 5). Cursor on started_at DESC with
// page-size 20; getNextPageParam returns undefined when a page has fewer
// than 20 rows so hasNextPage flips to false at the end of the list
// (Pitfall 3).
//
// SessionSummary is declared inline here (NOT in lib/schemas/sessions.ts —
// 06-CONTEXT.md notes lib/schemas/sessions.ts is unchanged in Phase 6;
// SessionSummary is a SUPERSET of SessionRow with the joined plan_name +
// per-session aggregates). Zod-parse every row at the wire boundary per
// Pitfall 8.13 — generated types are compile-time only; the wire is
// untrusted. Postgres numeric/bigint serialize as string through PostgREST,
// hence z.coerce.number() on set_count + total_volume_kg.
//
// RLS scopes the RPC via SECURITY INVOKER (Plan 06-01a) — no client-side
// user_id filter needed. enabled: !!userId gates the query for anonymous
// users so the queryFn never fires when sign-out clears the auth store
// (T-06-08 — Phase 3 sign-out's queryClient.clear() additionally wipes the
// cache slot).
//
// Inherits networkMode: 'offlineFirst' from QueryClient defaults
// (Phase 4 D-07); the TanStack persister (Phase 4) hydrates this cache slot
// from AsyncStorage at cold-start so the list is visible offline
// (ROADMAP success #4).
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

export type SessionSummary = {
  id: string;
  user_id: string;
  plan_id: string | null;
  started_at: string;
  finished_at: string | null;
  plan_name: string | null;
  set_count: number;
  total_volume_kg: number;
};

const SessionSummarySchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  plan_id: z.string().uuid().nullable(),
  started_at: z.string(),
  finished_at: z.string().nullable(),
  plan_name: z.string().nullable(),
  set_count: z.coerce.number(),
  total_volume_kg: z.coerce.number(),
});

export function useSessionsListInfiniteQuery() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return useInfiniteQuery({
    queryKey: sessionsKeys.listInfinite(),
    queryFn: async ({
      pageParam,
    }: {
      pageParam: string | null;
    }): Promise<SessionSummary[]> => {
      // Supabase type-gen treats RPC timestamptz parameters as required
      // non-nullable strings; runtime accepts NULL correctly because the SQL
      // body in migration 0006 has `(p_cursor is null or ...)` guards. Cast
      // at the call boundary per the documented type-gen limitation (see
      // 06-01a-SUMMARY.md Deviations §1 — same pattern as test-rls.ts).
      const { data, error } = await supabase.rpc("get_session_summaries", {
        p_cursor: pageParam as unknown as string,
        p_page_size: PAGE_SIZE,
      });
      if (error) throw error;
      return (data ?? []).map((row: unknown) =>
        SessionSummarySchema.parse(row),
      );
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: SessionSummary[]): string | undefined => {
      // A page with fewer rows than PAGE_SIZE means we've reached the end.
      // Return undefined → hasNextPage = false (Pitfall 3).
      if (!lastPage || lastPage.length < PAGE_SIZE) return undefined;
      // Otherwise the OLDEST started_at on this page (DESC order → last row)
      // is the cursor for the next page.
      return lastPage[lastPage.length - 1]?.started_at ?? undefined;
    },
    enabled: !!userId,
  });
}

// ---------------------------------------------------------------------------
// Phase 6 — F9 delete-pass mutation hook (06-CONTEXT.md D-07,
// 06-RESEARCH.md §Pattern 6).
//
// Pitfall 8.1 — hook owns ONLY mutationKey + scope.id. The mutationFn +
// onMutate/onError/onSettled live in lib/query/client.ts setMutationDefaults
// block 14 so paused mutations re-hydrate with the same logic on cold-start
// (Pitfall 8.2 + 8.12). scope.id = `session:${sessionId}` matches the Phase 5
// session-scope so any in-flight ['set','add']/['set','update']/['set','remove']
// mutations for this session replay FIFO with the trailing delete on
// reconnect.
//
// V1: Delete cascades to exercise_sets via FK on delete cascade (migration
// 0001 line 74; verified in Plan 06-01a Wave 0 cascade assertion) — no
// client-side set-cleanup needed. RLS scopes server-side (Plan 06-01a
// test-rls.ts cross-user assertion).
// ---------------------------------------------------------------------------

type SessionDeleteVars = { id: string };

export function useDeleteSession(sessionId?: string) {
  return useMutation<void, Error, SessionDeleteVars>({
    mutationKey: ["session", "delete"] as const,
    scope: sessionId ? { id: `session:${sessionId}` } : undefined,
  });
}
