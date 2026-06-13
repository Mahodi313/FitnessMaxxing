// app/lib/queries/dashboard.ts
//
// Phase 12 (12-04): Home dashboard data layer — ONE offline-first hook
// consuming the get_dashboard_summary RPC deployed in Plan 12-01
// (migration 0011). The single combined 8-field aggregate feeds three
// surfaces: the Home hero (sessions-this-week ring + weekly-goal + streak +
// this-week volume sparkline), the History lifetime-volume card, and the
// lifetime eyebrow (sessions + hours). (D-03, DASH-01..05.)
//
// Offline-first (D-03): this hook DOES NOT override networkMode — it inherits
// `offlineFirst` from the QueryClient defaults (Phase 4 D-07) so the single
// PersistQueryClientProvider hydrates dashboardKeys.summary() from
// AsyncStorage at cold-start. The cache slot is visible offline for free; no
// per-hook persister wiring (D-24 — persister scope untouched).
//
// Zod-parse boundary (PITFALLS §8.13, T-12-08): the RPC wire row is parsed via
// DashboardSummarySchema before reaching the UI. Generated `database.ts` types
// are compile-time only; the wire is untrusted. PostgREST serializes
// numeric/bigint as strings, so every numeric field uses z.coerce.number().
// weekly_volume_series arrives as jsonb — parsed as an array of {week,
// volume_kg}.
//
// New-user contract (D-04): get_dashboard_summary always returns exactly one
// row (all-zero for a brand-new account). The consuming screen treats the
// all-zero row as the new-user state and the skeleton gate as
// `isPending && data === undefined` (empty cache, first load) — NOT a
// row-absence check.
//
// RLS: the RPC is SECURITY INVOKER (migration 0011) — the user only ever sees
// their own aggregates; the client never aggregates across users (API3,
// T-12-09).
//
// F13 isolation (T-12-10, D-24): a brand-new read-only query slot only. No
// mutation defaults, no existing query keys, no persister scope, no
// exercise_sets behavior is touched by this file.
//
// References:
//   - 12-RESEARCH.md §Mandate 1 (8-field return shape) + §Mandate 4 (hook shape)
//   - 12-PATTERNS.md "app/lib/queries/dashboard.ts" (useQuery, take data[0],
//     pass p_tz, don't override networkMode)
//   - 12-01-SUMMARY.md (deployed RPC column names/types)

import { useQuery } from "@tanstack/react-query";
import * as Localization from "expo-localization";
import { z } from "zod";

import { supabase } from "@/lib/supabase";
import { dashboardKeys } from "@/lib/query/keys";
import { useAuthStore } from "@/lib/auth-store";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

// weekly_volume_series arrives as jsonb: [{ week, volume_kg }, ...]. Parse the
// inner shape so the sparkline consumer gets a typed array, not raw Json.
const WeeklyVolumePointSchema = z.object({
  week: z.string(),
  volume_kg: z.coerce.number(),
});

export const DashboardSummarySchema = z.object({
  sessions_this_week: z.coerce.number(),
  weekly_goal: z.coerce.number(),
  streak_weeks: z.coerce.number(),
  volume_this_week_kg: z.coerce.number(),
  volume_prior_week_kg: z.coerce.number(),
  weekly_volume_series: z.array(WeeklyVolumePointSchema),
  lifetime_sessions: z.coerce.number(),
  lifetime_hours: z.coerce.number(),
});

export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;
export type WeeklyVolumePoint = z.infer<typeof WeeklyVolumePointSchema>;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDashboardSummaryQuery() {
  const userId = useAuthStore((s) => s.session?.user.id);
  // Local Mon-Sun bucketing depends on the device IANA timezone (D-06). The
  // RPC's date_trunc('week', started_at at time zone p_tz) needs the user's
  // zone so "this week" lines up with the user's calendar, not UTC.
  const tz = Localization.getCalendars()[0]?.timeZone ?? "Europe/Stockholm";

  return useQuery<DashboardSummary>({
    queryKey: dashboardKeys.summary(),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dashboard_summary", {
        p_tz: tz,
      });
      if (error) throw error;
      // The RPC always returns exactly one row (all-zero for new users — D-04).
      // `?? null` defends against an unexpected empty result so Zod surfaces a
      // parse error rather than the UI silently rendering undefined.
      return DashboardSummarySchema.parse(data?.[0] ?? null);
    },
    enabled: !!userId,
    // networkMode intentionally NOT overridden — inherit offlineFirst from the
    // QueryClient defaults so the persister hydrates this slot for free (D-03).
  });
}
