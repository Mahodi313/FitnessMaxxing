// app/lib/rest-timer.ts
//
// Phase 14 (Rest Timer, F19), Plan 14-01. Pure rest-timer math + decision
// predicates — no React, no Expo, no expo-notifications, no AsyncStorage, no
// side effects. Importable from both screens and Node `tsx` test scripts
// (mirrors lib/e1rm.ts's pure-module structure).
//
// THIS IS THE UNIT-TESTABLE HEART OF THE TIMER (TIMER-01/02/05 + the D-14 gate).
// Every later plan (Settings toggle, the live banner, the notification
// scheduler) imports these predicates instead of re-deriving the rules, so the
// countdown math, the +30s extend, and the "may we fire a notification?" gate
// can never drift.
//
// Decisions:
//   - TIMER-02: remaining time is ALWAYS re-derived from the absolute endTs
//     against `now` — never a decrementing counter that drifts while the JS
//     thread is suspended (the backgrounded-suspension trap, RESEARCH §Runtime
//     State). On resume, `remainingMs(endTs, Date.now())` reconciles instantly.
//   - D-02: "+30 s" extend adds exactly 30_000 ms to the existing endTs.
//   - D-14: a notification may fire ONLY when the per-exercise timer is on AND
//     the master notifications pref is on AND OS permission is granted — all
//     three. Any one false suppresses the OS notification (the in-app countdown
//     still runs regardless; that is a caller concern, not this gate).
//   - TIMER-05 / D-03 / D-07: skipping rest CANCELS the scheduled notification;
//     extending or advancing to the next set RESCHEDULES it (the old one is
//     superseded, never left to fire stale).
//
// Pitfall 5 (units.ts / e1rm.ts precedent): non-finite input (NaN / ±Infinity)
// is clamped — remainingMs returns 0, formatMSS returns "0:00" — so a garbage
// timestamp can never propagate into a rendered countdown.
//
// References:
//   - .planning/phases/14-rest-timer-f19-research-flagged/14-PATTERNS.md §rest-timer.ts
//   - .planning/phases/14-rest-timer-f19-research-flagged/14-RESEARCH.md §Pattern 2
//   - app/lib/e1rm.ts (structural template + Pitfall-5 guard precedent)

/**
 * Milliseconds remaining until `endTs`, measured from `now`. Clamped to ≥ 0 so
 * an elapsed timer reads 0 (never negative), and 0 for any non-finite input
 * (TIMER-02 re-derive-from-endTs; Pitfall-5 guard).
 */
export function remainingMs(endTs: number, now: number): number {
  if (!Number.isFinite(endTs) || !Number.isFinite(now)) return 0; // Pitfall-5 guard
  return Math.max(0, endTs - now); // TIMER-02 — derive from absolute endTs, never negative
}

/**
 * Format a millisecond duration as "M:SS". Uses `Math.ceil` so any positive
 * sub-second remainder still shows at least "0:01" (a timer never visually
 * hits 0:00 while time is genuinely left). Returns "0:00" for non-finite input.
 */
export function formatMSS(ms: number): string {
  if (!Number.isFinite(ms)) return "0:00"; // Pitfall-5 guard
  const totalSeconds = Math.ceil(ms / 1000); // ceil — 1ms still shows 0:01
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Extend a timer by exactly +30 s (D-02). Pure arithmetic on the absolute endTs.
 */
export function extendEndTs(endTs: number): number {
  return endTs + 30_000; // D-02 — +30s
}

/**
 * The D-14 all-three gate: a rest-over notification may fire ONLY when the
 * per-exercise timer is on, the master notifications pref is on, AND OS
 * permission is granted. Any one false suppresses it.
 */
export function shouldFireNotification(
  timerOn: boolean,
  masterOn: boolean,
  permissionGranted: boolean,
): boolean {
  return timerOn && masterOn && permissionGranted; // D-14
}

/** Rest-timer lifecycle events that bear on the scheduled notification. */
export type RestEvent = "skip" | "extend" | "nextSet";

/**
 * What to do with the scheduled notification for a given event (TIMER-05 /
 * D-03 / D-07): skipping rest CANCELS it; extending or advancing to the next
 * set RESCHEDULES it (so the old, now-stale schedule never fires).
 */
export function decideNotificationAction(event: RestEvent): "cancel" | "reschedule" {
  return event === "skip" ? "cancel" : "reschedule"; // TIMER-05 / D-03 / D-07
}
