// app/scripts/test-rest-timer-store.ts
//
// Phase 14 (Rest Timer, F19), Plan 14-02. Node-only unit test for
// lib/rest-timer-store.ts — the Zustand single owner of endTs + notificationId.
// Run via `npm run test:rest-timer-store`. Verifies the cancel-before-reschedule
// invariant (Pitfall 6 / TIMER-05) + the start/extend/skip/finish state machine
// + the getState()-from-outside-React contract Plan 04's onKlart + the banner
// controls rely on.
//
// The store transitively imports notifications.ts → expo-notifications (a native
// module that breaks under Node tsx) AND rest-timer.ts (pure, fine). We stub
// expo-notifications in the require cache BEFORE the store loads it — same
// require-cache pre-seed pattern as scripts/test-units-store.ts — with the stub
// RECORDING every schedule/cancel call into an ordered call-log so we can assert
// cancel-before-reschedule ordering, the sessionId-only payload, and the stored
// id round-trip.
//
// Mirrors scripts/test-units.ts / test-units-store.ts pass/fail + exit-code
// skeleton.

import { createRequire } from "node:module";

const localRequire = createRequire(__filename);

// --- Record native notification I/O ------------------------------------------
// Ordered call-log: every schedule/cancel pushes an entry so the test can assert
// "cancel fired BEFORE the next schedule" (Pitfall 6). scheduleNotificationAsync
// returns a fresh monotonically-increasing id so the store records something
// distinguishable per call.
type Call =
  | { kind: "schedule"; endTs: number; sessionId: string; returnedId: string }
  | { kind: "cancel"; id: string };
const calls: Call[] = [];
let scheduleSeq = 0;

const notificationsStub = {
  // The store calls scheduleRestNotification(endTs, content) which internally
  // calls scheduleNotificationAsync — but we stub at the expo-notifications
  // boundary, so we re-implement just enough of that surface here.
  SchedulableTriggerInputTypes: { DATE: "date" },
  scheduleNotificationAsync: async (req: {
    content: { data: { sessionId: string } };
    trigger: { date: Date };
  }) => {
    const id = `notif-${++scheduleSeq}`;
    calls.push({
      kind: "schedule",
      endTs: req.trigger.date.getTime(),
      sessionId: req.content.data.sessionId,
      returnedId: id,
    });
    return id;
  },
  cancelScheduledNotificationAsync: async (id: string) => {
    calls.push({ kind: "cancel", id });
  },
  getPermissionsAsync: async () => ({ granted: true, canAskAgain: true }),
  requestPermissionsAsync: async () => ({ granted: true, canAskAgain: true }),
};

// Pre-seed the require cache for expo-notifications BEFORE the store (via
// notifications.ts) loads it. notifications.ts does `import * as Notifications
// from "expo-notifications"` so the namespace shape (not a default) must be the
// module exports. Provide __esModule + the named members so esbuild interop
// reads the namespace correctly.
const notifPath = localRequire.resolve("expo-notifications");
localRequire.cache[notifPath] = {
  id: notifPath,
  filename: notifPath,
  loaded: true,
  exports: { __esModule: true, ...notificationsStub },
} as unknown as NodeModule;

// Import AFTER the stub is installed (require, not static import).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useRestTimerStore } =
  require("../lib/rest-timer-store") as typeof import("../lib/rest-timer-store");

type Result = { name: string; pass: boolean; detail?: string };
const results: Result[] = [];
function check(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
}

// Let every fire-and-forget `void schedule(...).then(set)` microtask flush.
const tick = () => new Promise((r) => setTimeout(r, 15));

const CONTENT = { title: "Vilan är slut", body: "Dags för nästa set.", sessionId: "sess-123" };

async function main() {
  const store = useRestTimerStore;

  // 1) Initial state: nothing scheduled.
  check(
    "initial endTs === null && notificationId === null",
    store.getState().endTs === null && store.getState().notificationId === null,
    `endTs=${store.getState().endTs} notificationId=${store.getState().notificationId}`,
  );

  // 2) start(): sets endTs ~ now+dur, schedules, stores the returned id.
  const before = Date.now();
  store.getState().start(120_000, "ex-1", CONTENT);
  await tick();
  const endTs = store.getState().endTs;
  check(
    "start() sets endTs ≈ now + durationMs",
    endTs !== null && endTs >= before + 120_000 && endTs <= Date.now() + 120_000,
    `endTs=${endTs}`,
  );
  check(
    "start() stores the scheduled notificationId",
    store.getState().notificationId === "notif-1",
    `notificationId=${store.getState().notificationId}`,
  );
  check(
    "start() schedules with the sessionId-only payload",
    calls.some((c) => c.kind === "schedule" && c.sessionId === "sess-123"),
    JSON.stringify(calls),
  );

  // 3) start() again = cancel-before-reschedule (D-07 latest-set-wins / Pitfall 6).
  calls.length = 0;
  store.getState().start(120_000, "ex-1", CONTENT);
  await tick();
  const firstCancelIdx = calls.findIndex((c) => c.kind === "cancel");
  const firstScheduleIdx = calls.findIndex((c) => c.kind === "schedule");
  check(
    "start() cancels the prior id BEFORE scheduling a fresh one",
    firstCancelIdx === 0 && firstScheduleIdx === 1,
    `calls=${JSON.stringify(calls.map((c) => c.kind))}`,
  );
  check(
    "start() cancels exactly the previously-stored id (notif-1)",
    calls[0]?.kind === "cancel" && calls[0].id === "notif-1",
    JSON.stringify(calls[0]),
  );
  check(
    "start() stores the NEW id after reschedule (notif-2)",
    store.getState().notificationId === "notif-2",
    `notificationId=${store.getState().notificationId}`,
  );

  // 4) extend(): endTs += 30s, cancel old, reschedule, store new id (D-02).
  calls.length = 0;
  const preExtendEnd = store.getState().endTs!;
  store.getState().extend(CONTENT);
  await tick();
  check(
    "extend() adds exactly +30s to endTs (D-02)",
    store.getState().endTs === preExtendEnd + 30_000,
    `endTs=${store.getState().endTs} expected=${preExtendEnd + 30_000}`,
  );
  const exCancelIdx = calls.findIndex((c) => c.kind === "cancel");
  const exScheduleIdx = calls.findIndex((c) => c.kind === "schedule");
  check(
    "extend() cancels BEFORE rescheduling (cancel-before-reschedule)",
    exCancelIdx === 0 && exScheduleIdx === 1,
    `calls=${JSON.stringify(calls.map((c) => c.kind))}`,
  );
  check(
    "extend() reschedules to the NEW (extended) endTs",
    calls.some((c) => c.kind === "schedule" && c.endTs === preExtendEnd + 30_000),
    JSON.stringify(calls),
  );
  check(
    "extend() stores the new id (notif-3)",
    store.getState().notificationId === "notif-3",
    `notificationId=${store.getState().notificationId}`,
  );

  // 5) skip(): cancels + clears endTs and notificationId to null (TIMER-05/D-02).
  calls.length = 0;
  store.getState().skip();
  await tick();
  check(
    "skip() cancels the stored id",
    calls.some((c) => c.kind === "cancel" && c.id === "notif-3"),
    JSON.stringify(calls),
  );
  check(
    "skip() clears endTs + notificationId to null",
    store.getState().endTs === null && store.getState().notificationId === null,
    `endTs=${store.getState().endTs} notificationId=${store.getState().notificationId}`,
  );

  // 6) finish(): identical to skip — cancel + clear (session-end default).
  store.getState().start(120_000, "ex-2", CONTENT);
  await tick();
  const idBeforeFinish = store.getState().notificationId;
  calls.length = 0;
  store.getState().finish();
  await tick();
  check(
    "finish() cancels the stored id (same as skip)",
    idBeforeFinish !== null &&
      calls.some((c) => c.kind === "cancel" && c.id === idBeforeFinish),
    `idBeforeFinish=${idBeforeFinish} calls=${JSON.stringify(calls)}`,
  );
  check(
    "finish() clears endTs + notificationId to null",
    store.getState().endTs === null && store.getState().notificationId === null,
    `endTs=${store.getState().endTs} notificationId=${store.getState().notificationId}`,
  );

  // --- Report ----------------------------------------------------------------
  let failed = 0;
  for (const r of results) {
    if (r.pass) {
      console.log(`  PASS  ${r.name}`);
    } else {
      failed++;
      console.error(`  FAIL  ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
    }
  }
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed === 0 ? 0 : 1);
}

void main();
