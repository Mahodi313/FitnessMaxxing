// app/lib/rest-timer-store.ts
//
// Phase 14 (Rest Timer, F19), Plan 14-02. The single Zustand owner of the live
// rest-timer state — `{ endTs, notificationId }` — plus the start/extend/skip/
// finish transitions that drive schedule/cancel/reschedule through
// notifications.ts.
//
// WHY A STORE (RESEARCH §Pattern 2): the timer's authoritative state must
// survive the countdown banner unmounting AND be reachable from outside React —
// Plan 04's onKlart fires `useRestTimerStore.getState().start(...)` fire-and-
// forget after addSet.mutate, and the banner controls call `.skip()` / `.extend()`.
// A colocated useState/useRef hook would lose state on banner unmount and could
// not be reached from _layout.tsx. A single store is the clean owner — the exact
// units-store.ts / persistence-store.ts precedent (plain `create`, NO persist
// middleware: timer state is transient OS-clock-backed, not a durable pref; the
// durable pieces — fm:restSeconds / fm:restTimerEnabled — live in prefs.ts).
//
// CANCEL-BEFORE-RESCHEDULE (Pitfall 6 / TIMER-05 / D-07): every transition that
// replaces the scheduled notification FIRST cancels the currently-stored id, THEN
// schedules a fresh one and stores the returned id. Skipping this leaves the old
// schedule to fire stale ("two Rest is over pings", or a ping after the user
// already started the next set). skip()/finish() cancel-and-clear.
//
// FAIL-SOFT (D-12): the schedule/cancel calls are fail-soft at the notifications.ts
// boundary (schedule returns null, cancel warns-and-swallows). The `.then(set)`
// here therefore never rejects; a failed schedule simply stores `notificationId:
// null` and the in-app countdown (re-derived from endTs by the banner) keeps
// running regardless.
//
// D-24 / F13: this store touches NO mutation / queryKey / persister /
// exercise_sets behavior. The hot path is untouched.
//
// References:
//   - app/lib/units-store.ts (exact plain-create shape cloned — no persist)
//   - app/lib/rest-timer.ts (extendEndTs / decideNotificationAction — consumed, not reimplemented)
//   - app/lib/notifications.ts (scheduleRestNotification / cancelNotification)
//   - .planning/phases/14-rest-timer-f19-research-flagged/14-RESEARCH.md §Pattern 2 + §Pitfall 6
//   - .planning/phases/14-rest-timer-f19-research-flagged/14-PATTERNS.md §rest-timer-store.ts

import { create } from "zustand";

import {
  cancelNotification,
  scheduleRestNotification,
} from "./notifications";
import { decideNotificationAction, extendEndTs } from "./rest-timer";

/**
 * Content passed through to the scheduled notification (sessionId-only data
 * payload, D-15). Supplied by the caller (Plan 04 / the banner controls) so the
 * i18n title/body resolve at call time.
 */
type RestNotificationContent = {
  title: string;
  body: string;
  sessionId: string;
};

export type RestTimerState = {
  /** Absolute ms-epoch the rest ends at; null when no rest is running (TIMER-02). */
  endTs: number | null;
  /** The live scheduled notification id (cancel target); null when none. */
  notificationId: string | null;
  /**
   * Start a fresh rest (D-05/D-07 latest-set-wins). Cancels any prior
   * notification FIRST (cancel-before-reschedule, Pitfall 6), sets endTs =
   * now + durationMs, then schedules a fresh notification and stores its id.
   * `exerciseId` is accepted for caller symmetry / future per-exercise work
   * (D-09 deferred); the v1 single-global-default store does not branch on it.
   */
  start: (
    durationMs: number,
    exerciseId: string,
    content: RestNotificationContent,
  ) => void;
  /** Extend the running rest by +30s (D-02): cancel old id, reschedule, store new. */
  extend: (content: RestNotificationContent) => void;
  /** Skip the rest (D-02 / TIMER-05): cancel the notification, clear state. */
  skip: () => void;
  /** Session-end discretion default: identical to skip — cancel + clear. */
  finish: () => void;
};

export const useRestTimerStore = create<RestTimerState>((set, get) => ({
  endTs: null,
  notificationId: null,

  start: (durationMs, _exerciseId, content) => {
    // Cancel-before-reschedule (Pitfall 6 / D-07): supersede any prior schedule
    // before this fresh one. decideNotificationAction("nextSet") === "reschedule"
    // documents the intent (a new working set reschedules, never leaves stale).
    void decideNotificationAction("nextSet");
    void cancelNotification(get().notificationId);
    const endTs = Date.now() + durationMs;
    // Fire-and-forget schedule; store the returned id (or null on fail-soft).
    void scheduleRestNotification(endTs, content).then((id) =>
      set({ notificationId: id }),
    );
    set({ endTs });
  },

  extend: (content) => {
    // decideNotificationAction("extend") === "reschedule" — extend cancels old +
    // reschedules to the new endTs (D-02 / TIMER-05).
    void decideNotificationAction("extend");
    const next = extendEndTs(get().endTs ?? Date.now());
    void cancelNotification(get().notificationId);
    void scheduleRestNotification(next, content).then((id) =>
      set({ notificationId: id }),
    );
    set({ endTs: next });
  },

  skip: () => {
    // decideNotificationAction("skip") === "cancel" — skip cancels, never
    // reschedules (TIMER-05 / D-02).
    void decideNotificationAction("skip");
    void cancelNotification(get().notificationId);
    set({ endTs: null, notificationId: null });
  },

  finish: () => {
    // Session-end discretion default: cancel any pending rest + clear (same as
    // skip). RESEARCH §Open Question 3.
    void cancelNotification(get().notificationId);
    set({ endTs: null, notificationId: null });
  },
}));
