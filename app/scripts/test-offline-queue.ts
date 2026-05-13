// File: app/scripts/test-offline-queue.ts
//
// Wave 0 — proves the persister contract: a paused mutation seeded into the
// AsyncStorage cache survives a simulated app cold-start with mutationKey +
// scope.id intact, and replays via resumePausedMutations().
//
// Run via: cd app && npm run test:offline-queue
//   (which expands to: tsx scripts/test-offline-queue.ts — pure Node, no env-file)
//
// This script is Node-only. It MUST NEVER be imported from app/lib/, app/app/,
// or any other Metro-bundled path (PITFALLS 2.3 — service-role-key isolation,
// even though this script does NOT use the service-role key, the convention
// applies to all scripts/*.ts).
//
// Why we instantiate a fresh QueryClient instead of importing app/lib/query/client:
// the production module imports expo-crypto + supabase which require RN runtime.
// The test mirrors the exact defaults shape (networkMode: 'offlineFirst' + retry: 1
// + the setMutationDefaults mutationKeys) so the contract under test is identical.
//
// scope.id correction (matches Phase 4 Plan 04-01 auto-fix Rule 1):
// TanStack v5's MutationScope.id is a STATIC string, not a function. Per-call
// dynamic scope is set at useMutation()/mutate-build time, not via
// setMutationDefaults. This test sets scope at mutation-build time inline.
//
// References:
//   - 04-RESEARCH.md §6 (resumePausedMutations contract), §8.2 + §8.12 (pitfalls)
//   - 04-VALIDATION.md "Wave 0 Requirements" — test-offline-queue.ts

import { QueryClient, onlineManager } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { LocalStorage } from "node-localstorage";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

// ---- Node AsyncStorage shim ------------------------------------------------
// node-localstorage exposes a sync API; wrap to match AsyncStorage's Promise API.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gsd-test-offline-queue-"));
const ls = new LocalStorage(tmpDir);
const asyncStorageShim = {
  getItem: async (k: string) => ls.getItem(k),
  setItem: async (k: string, v: string) => {
    ls.setItem(k, v);
  },
  removeItem: async (k: string) => {
    ls.removeItem(k);
  },
};

// ---- pass/fail harness -----------------------------------------------------
const failures: string[] = [];
function pass(name: string) {
  console.log(`  PASS: ${name}`);
}
function fail(name: string, detail?: unknown) {
  const line = detail !== undefined ? `${name} — ${JSON.stringify(detail)}` : name;
  failures.push(line);
  console.log(`  FAIL: ${line}`);
}

// ---- Helper: build a QueryClient mirroring production defaults shape -------
// We register a setMutationDefaults entry for ['plan-exercise','add'] so the
// hydrated paused mutation has its mutationFn rewired on app-restart.
type Counter = { count: number; lastVars?: unknown };

function buildClient(counter: Counter): QueryClient {
  // We use networkMode: 'online' here (NOT 'offlineFirst' as production uses)
  // because we need a DETERMINISTIC pause when offline for the test. With
  // 'offlineFirst' the runtime tries to fire immediately and only pauses on
  // failure — but our test mutationFn does not throw, so it would succeed
  // even offline (defeating the persistence test). In production, the
  // mutationFn invokes Supabase fetch which DOES throw on offline, so the
  // 'offlineFirst' code path naturally pauses. The persister contract under
  // test (key + scope preservation across persist/restart, replay via
  // resumePausedMutations) is identical between the two modes — only the
  // pause-trigger differs.
  const client = new QueryClient({
    defaultOptions: {
      queries: { networkMode: "online", staleTime: 30_000, gcTime: 86_400_000 },
      mutations: { networkMode: "online", retry: 1 },
    },
  });
  client.setMutationDefaults(["plan-exercise", "add"], {
    // mutationFn does not actually round-trip Supabase here — we are testing
    // persistence + hydration + replay-side scope/key preservation.
    mutationFn: async (vars: unknown) => {
      counter.count++;
      counter.lastVars = vars;
      return vars as { id: string };
    },
    networkMode: "online",
    retry: 1,
  });
  // Phase 5: also register ['set','add'] so the 25-set extension scenario
  // can persist + re-hydrate paused mutations with the new mutationKey.
  client.setMutationDefaults(["set", "add"], {
    mutationFn: async (vars: unknown) => {
      counter.count++;
      counter.lastVars = vars;
      return vars as { id: string };
    },
    networkMode: "online",
    retry: 1,
  });
  return client;
}

async function main() {
  console.log("[test-offline-queue] starting…");

  // ===========================================================================
  // PHASE 1 — seed a paused mutation into a fresh persisted client.
  // ===========================================================================
  const counterA: Counter = { count: 0 };
  const clientA = buildClient(counterA);
  const persisterA = createAsyncStoragePersister({ storage: asyncStorageShim });
  const [unsubA, restorePromiseA] = persistQueryClient({
    queryClient: clientA,
    persister: persisterA,
    maxAge: 86_400_000,
  });

  // Wait for the (initial) restore to finish — empty disk, so this resolves quickly.
  await restorePromiseA;

  // Pause replay by flipping the global onlineManager offline before firing.
  onlineManager.setOnline(false);

  const seedVars = {
    id: "test-pe-id-001",
    plan_id: "test-plan-id-001",
    exercise_id: "test-exercise-id-001",
    order_index: 0,
  };

  // Build a mutation with mutationKey + scope.id at mutation construction time.
  // This is the v5-correct shape: scope is static `{ id: '...' }` per mutation.
  const mutation = clientA.getMutationCache().build(clientA, {
    mutationKey: ["plan-exercise", "add"],
    scope: { id: `plan:${seedVars.plan_id}` },
  });

  // Execute (paused — does NOT call mutationFn while offline).
  void mutation.execute(seedVars).catch(() => {
    // The mutation will sit in 'paused' state; execute returns a promise that
    // resolves only when the mutation eventually finishes. We don't await.
  });

  // Allow microtasks + persister throttle to settle.
  await new Promise((r) => setTimeout(r, 100));

  // Confirm the production-shape baseline: mutationFn was NOT called (paused).
  if (counterA.count === 0) {
    pass("Phase 1: mutationFn NOT called while offline (queue paused)");
  } else {
    fail("Phase 1: mutationFn fired while offline — pause contract broken");
  }

  // Confirm the mutation is in the cache with intact key + scope.
  const mutationsA = clientA.getMutationCache().getAll();
  if (mutationsA.length === 1) {
    const m = mutationsA[0];
    const keyOk =
      JSON.stringify(m.options.mutationKey) ===
      JSON.stringify(["plan-exercise", "add"]);
    const scopeOk = m.options.scope?.id === "plan:test-plan-id-001";
    if (keyOk && scopeOk) {
      pass("Phase 1: cached mutation has intact mutationKey + scope.id");
    } else {
      fail("Phase 1: cached mutation key/scope drift", {
        keyOk,
        scopeOk,
        key: m.options.mutationKey,
        scope: m.options.scope,
      });
    }
  } else {
    fail("Phase 1: expected exactly 1 cached mutation", { count: mutationsA.length });
  }

  // Wait long enough for the persister auto-throttle to flush state to disk.
  // TanStack default throttle ~1000ms; 1500ms gives margin.
  await new Promise((r) => setTimeout(r, 1500));

  // Tear down clientA (simulates app force-quit).
  unsubA();
  await new Promise((r) => setTimeout(r, 100));

  // ===========================================================================
  // PHASE 2 — rebuild a fresh QueryClient + persister; hydrate from same disk.
  // ===========================================================================
  const counterB: Counter = { count: 0 };
  const clientB = buildClient(counterB);
  const persisterB = createAsyncStoragePersister({ storage: asyncStorageShim });
  const [unsubB, restorePromiseB] = persistQueryClient({
    queryClient: clientB,
    persister: persisterB,
    maxAge: 86_400_000,
  });

  // CRITICAL: wait for hydration before inspecting the cache.
  await restorePromiseB;
  await new Promise((r) => setTimeout(r, 100));

  const mutationsB = clientB.getMutationCache().getAll();
  if (mutationsB.length >= 1) {
    const m = mutationsB[0];
    const keyOk =
      JSON.stringify(m.options.mutationKey) ===
      JSON.stringify(["plan-exercise", "add"]);
    const scopeOk = m.options.scope?.id === "plan:test-plan-id-001";
    if (keyOk && scopeOk) {
      pass(
        "Phase 2: re-hydrated mutation has intact mutationKey + scope.id (Pitfall 8.2 closed)",
      );
    } else {
      fail("Phase 2: re-hydrated mutation key/scope drift — Pitfall 8.2 regression", {
        keyOk,
        scopeOk,
        key: m.options.mutationKey,
        scope: m.options.scope,
      });
    }
  } else {
    fail("Phase 2: expected at least 1 re-hydrated mutation", {
      count: mutationsB.length,
    });
  }

  // ===========================================================================
  // PHASE 3 — flip online + resumePausedMutations; verify mutationFn fires.
  // ===========================================================================
  onlineManager.setOnline(true);
  await clientB.resumePausedMutations();
  await new Promise((r) => setTimeout(r, 300));

  if (counterB.count >= 1) {
    pass(
      "Phase 3: resumePausedMutations() fired mutationFn after re-hydrate (Pitfall 8.12 closed)",
    );
  } else {
    fail("Phase 3: mutationFn did NOT fire on resume — Pitfall 8.12 regression");
  }

  unsubB();
  await new Promise((r) => setTimeout(r, 100));

  // ===========================================================================
  // PHASE 5 EXTENSION — 25× ['set','add'] paused-mutation persist/restart.
  //
  // F13 acceptance: airplane mode + 25 sets logged + force-quit + reopen
  // offline must show all 25 sets in cache. This block proves the persister
  // contract holds for the new mutationKey ['set','add'] at the same fidelity
  // as Phase 4 proved for ['plan-exercise','add'] above.
  //
  // Scenario: seed 25 paused ['set','add'] mutations under a shared scope.id
  // 'session:test-session-25', serialize via persister, restart persister in
  // a fresh QueryClient (simulating force-quit + cold-start), assert 25
  // paused mutations restore with intact mutationKey + scope.id.
  // ===========================================================================
  console.log("[test-offline-queue] Phase 5 extension — 25× ['set','add']…");

  const counterC: Counter = { count: 0 };
  const clientC = buildClient(counterC);
  const persisterC = createAsyncStoragePersister({ storage: asyncStorageShim });
  const [unsubC, restorePromiseC] = persistQueryClient({
    queryClient: clientC,
    persister: persisterC,
    maxAge: 86_400_000,
  });
  await restorePromiseC;

  // Drain anything left from previous phases first so the count is clean.
  // (Phase 1/2 mutation persists across the same asyncStorageShim.)
  clientC.getMutationCache().clear();
  await new Promise((r) => setTimeout(r, 100));

  onlineManager.setOnline(false);

  const TEST_SESSION_ID = "test-session-25";
  for (let i = 1; i <= 25; i++) {
    const setVars = {
      id: `test-set-id-${String(i).padStart(3, "0")}`,
      session_id: TEST_SESSION_ID,
      exercise_id: "test-exercise-id-001",
      set_number: i,
      reps: 8,
      weight_kg: 100,
      completed_at: new Date().toISOString(),
      set_type: "working",
    };
    const m = clientC.getMutationCache().build(clientC, {
      mutationKey: ["set", "add"],
      scope: { id: `session:${TEST_SESSION_ID}` },
    });
    void m.execute(setVars).catch(() => {
      // paused — execute resolves only when finished. Best-effort.
    });
  }
  await new Promise((r) => setTimeout(r, 200));

  if (counterC.count === 0) {
    pass("Phase 5 ext: 25 ['set','add'] mutationFns paused offline (no premature fire)");
  } else {
    fail("Phase 5 ext: ['set','add'] mutationFn fired offline", {
      count: counterC.count,
    });
  }

  const setsCachedC = clientC.getMutationCache().getAll();
  if (setsCachedC.length === 25) {
    const allKeysOk = setsCachedC.every(
      (m) =>
        JSON.stringify(m.options.mutationKey) ===
        JSON.stringify(["set", "add"]),
    );
    const allScopesOk = setsCachedC.every(
      (m) => m.options.scope?.id === `session:${TEST_SESSION_ID}`,
    );
    if (allKeysOk && allScopesOk) {
      pass(
        "Phase 5 ext: 25 cached ['set','add'] mutations have intact mutationKey + scope.id",
      );
    } else {
      fail("Phase 5 ext: cached ['set','add'] key/scope drift", {
        allKeysOk,
        allScopesOk,
      });
    }
  } else {
    fail("Phase 5 ext: expected 25 cached set-add mutations", {
      count: setsCachedC.length,
    });
  }

  // Let persister auto-throttle flush state to disk.
  await new Promise((r) => setTimeout(r, 1500));

  // Force-quit simulation: tear down clientC.
  unsubC();
  await new Promise((r) => setTimeout(r, 100));

  // Cold-start: rebuild fresh QueryClient + persister; hydrate from disk.
  const counterD: Counter = { count: 0 };
  const clientD = buildClient(counterD);
  const persisterD = createAsyncStoragePersister({ storage: asyncStorageShim });
  const [unsubD, restorePromiseD] = persistQueryClient({
    queryClient: clientD,
    persister: persisterD,
    maxAge: 86_400_000,
  });
  await restorePromiseD;
  await new Promise((r) => setTimeout(r, 100));

  const setsCachedD = clientD.getMutationCache().getAll();
  // Filter to the Phase 5 ['set','add'] mutations only — earlier Phase 4
  // ['plan-exercise','add'] could also be on disk depending on test ordering.
  const setAddMutations = setsCachedD.filter(
    (m) =>
      JSON.stringify(m.options.mutationKey) ===
      JSON.stringify(["set", "add"]),
  );
  if (setAddMutations.length === 25) {
    const allScopesOk = setAddMutations.every(
      (m) => m.options.scope?.id === `session:${TEST_SESSION_ID}`,
    );
    if (allScopesOk) {
      pass(
        "Phase 5 ext: 25 ['set','add'] mutations re-hydrated with intact scope.id (F13 paused-cache survival)",
      );
    } else {
      fail("Phase 5 ext: re-hydrated set-add scope.id drift", {
        scopes: setAddMutations.map((m) => m.options.scope?.id),
      });
    }
  } else {
    fail("Phase 5 ext: expected 25 re-hydrated set-add mutations", {
      count: setAddMutations.length,
    });
  }

  unsubD();
  await new Promise((r) => setTimeout(r, 100));

  // Cleanup tmp dir
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // best-effort
  }
}

(async () => {
  let exitCode = 0;
  let mainCompleted = false;
  try {
    await main();
    mainCompleted = true;
  } catch (e) {
    console.error("[test-offline-queue] FATAL:", e instanceof Error ? e.message : e);
    exitCode = 1;
  }
  console.log("");
  if (!mainCompleted) {
    console.log("[test-offline-queue] ABORTED before assertions completed");
    exitCode = 1;
  } else if (failures.length === 0) {
    console.log("[test-offline-queue] ALL ASSERTIONS PASSED");
  } else {
    console.log(`[test-offline-queue] ${failures.length} FAILURE(S)`);
    for (const f of failures) console.log(`  - ${f}`);
    exitCode = 1;
  }
  process.exit(exitCode);
})();
