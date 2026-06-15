// app/lib/notifications.ts
//
// Phase 14 (Rest Timer, F19), Plan 14-02. Thin, FAIL-SOFT wrapper over
// `expo-notifications` — the only file in the timer subsystem that touches the
// native notification module. Everything here is native-bound (callable only on
// device); the pure math + decision predicates live in rest-timer.ts (Plan
// 14-01) and the state ownership lives in rest-timer-store.ts (Task 2).
//
// FAIL-SOFT CONTRACT (D-12 graceful degradation): every native I/O call is
// wrapped so a failure NEVER rejects into the fire-and-forget hot-path block in
// the store (scheduleRestNotification returns null on failure; cancelNotification
// warns-and-swallows). The in-app countdown re-derives from the stored endTs and
// keeps running regardless — losing only the OS-delivered background ping. This
// mirrors prefs.ts's `void AsyncStorage.setItem(...).catch(console.warn)` idiom
// and network.ts's native-side warn-not-throw policy.
//
// SECURITY (D-15 / T-14-04 lock-screen privacy): the scheduled notification's
// `data` payload carries ONLY `{ sessionId }` — the in-app deep-link routing
// token. NO exercise name, weight, reps, or any PII is baked into the content or
// data, so nothing sensitive renders on the lock screen. The body is generic
// i18n text supplied by the caller.
//
// PERMISSION STATE MACHINE (RESEARCH §Pattern 4): iOS owns the permission state.
// `getPermissionsAsync().granted` is the authoritative "may we deliver?" signal;
// `canAskAgain === false` is the authoritative "blocked — must open Settings"
// signal. We never hand-roll a "have I asked before?" flag (the OS owns it).
//
// TRIGGER (RESEARCH §Pattern 1 + Pitfall 4): we use a DATE-typed trigger
// (`SchedulableTriggerInputTypes.DATE` + `date: new Date(endTs)`) — it maps 1:1
// to the stored absolute endTs (reschedule correctness) and sidesteps the
// sub-1-second TIME_INTERVAL throw (a +30s pressed near 0:00 computing seconds:0).
// NOT the deprecated bare/untyped trigger.
//
// References:
//   - .planning/phases/14-rest-timer-f19-research-flagged/14-RESEARCH.md §Pattern 1 + §Pattern 4 + §Pitfall 3/4
//   - .planning/phases/14-rest-timer-f19-research-flagged/14-PATTERNS.md §notifications.ts
//   - app/lib/prefs.ts (fail-soft `void … .catch(console.warn)` write idiom)
//   - app/lib/query/network.ts (native-side warn-not-throw policy)

import * as Notifications from "expo-notifications";

/**
 * The three permission states the rest of the app reasons about (RESEARCH
 * §Pattern 4):
 *   - "granted"  → notifications will be delivered.
 *   - "denied"   → not granted, but the OS will still let us prompt again
 *                  (iOS "undetermined"-like; canAskAgain === true).
 *   - "blocked"  → previously denied AND canAskAgain === false; the user must
 *                  open iOS Settings to re-enable (Settings surfaces this).
 */
export type PermissionState = "granted" | "denied" | "blocked";

/**
 * Content baked into a rest-over notification. `sessionId` is the ONLY data-
 * payload field (D-15 / T-14-04) — the in-app deep-link routing token. Title +
 * body are generic i18n text from the caller; no exercise/weight/PII.
 */
type RestNotificationContent = {
  title: string;
  body: string;
  sessionId: string;
};

/**
 * Schedule the "rest is over" local notification for the absolute `endTs`.
 * Returns the scheduled notification's identifier (the store records it so it
 * can cancel-before-reschedule), or `null` on any failure (FAIL-SOFT, D-12 —
 * the in-app countdown still runs; this never rejects into the caller).
 *
 * NOTE (RESEARCH §Pitfall 3): scheduling RESOLVES even without permission — only
 * *delivery* requires it. The D-14 gate (timer ON && master ON && permission
 * granted) is enforced by the CALLER at schedule time; this wrapper just does
 * the native I/O fail-soft.
 */
export async function scheduleRestNotification(
  endTs: number,
  content: RestNotificationContent,
): Promise<string | null> {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: content.title,
        body: content.body,
        sound: true, // D-15 sound; vibration policy is a fm:haptics caller concern
        // T-14-04 / D-15: ONLY the routing token — no exercise/weight/PII on the
        // lock screen.
        data: { sessionId: content.sessionId },
      },
      // DATE trigger maps 1:1 to the stored endTs (reschedule correctness) and
      // sidesteps the sub-1s TIME_INTERVAL throw (Pitfall 4).
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(endTs),
      },
    });
    return id;
  } catch {
    // FAIL-SOFT (D-12): never reject into the fire-and-forget caller. The
    // in-app countdown keeps running; we only lose the background ping.
    console.warn(
      "[notifications] scheduleRestNotification failed — background ping skipped, in-app countdown unaffected",
    );
    return null;
  }
}

/**
 * Cancel a scheduled notification by id. No-op when `id` is null (nothing
 * scheduled). Warn-and-swallow on failure (T-14-05 stale-ping prevention is
 * best-effort; a cancel failure must never crash the skip/reschedule path).
 */
export async function cancelNotification(id: string | null): Promise<void> {
  if (id === null) return; // nothing scheduled — no-op
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    console.warn(
      "[notifications] cancelNotification failed — a stale ping may still fire",
    );
  }
}

/**
 * Read-only current permission state (Settings reflects this). Never prompts.
 * Maps the OS permission object to our three-state machine (RESEARCH §Pattern 4):
 *   granted → "granted"; !canAskAgain → "blocked"; else → "denied".
 */
export async function getPermissionState(): Promise<PermissionState> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return "granted";
    if (!current.canAskAgain) return "blocked";
    return "denied";
  } catch {
    // FAIL-SOFT: an unreadable permission state is treated as "denied" (the
    // safe, non-blocking default — the in-app countdown is unaffected by this).
    console.warn(
      "[notifications] getPermissionState failed — defaulting to denied",
    );
    return "denied";
  }
}

/**
 * In-context permission request (D-13 — fired when the user enables the rest
 * timer in Settings). Reads the current state first; only prompts when the OS
 * still allows it (RESEARCH §Pattern 4):
 *   - already granted        → "granted" (no prompt)
 *   - blocked (!canAskAgain) → "blocked" (cannot prompt; Settings deep-link)
 *   - otherwise              → requestPermissionsAsync(), then map the result.
 */
export async function ensureNotificationPermission(): Promise<PermissionState> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return "granted";
    if (!current.canAskAgain) return "blocked";
    const req = await Notifications.requestPermissionsAsync();
    if (req.granted) return "granted";
    // Denied at the prompt: blocked if the OS will no longer let us ask.
    return req.canAskAgain ? "denied" : "blocked";
  } catch {
    // FAIL-SOFT: a failed request resolves as "denied" so the enable flow
    // degrades gracefully (in-app timer still works, D-12).
    console.warn(
      "[notifications] ensureNotificationPermission failed — treating as denied",
    );
    return "denied";
  }
}
