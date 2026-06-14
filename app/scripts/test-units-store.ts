// app/scripts/test-units-store.ts
//
// Phase 12 gap-closure (FIT-111). Node-only unit test for lib/units-store.ts.
// Run via `npm run test:units-store`. Verifies the reactive display-unit store
// contract that closes FIT-111 (kg↔lbs toggle must re-render every consumer):
//   - initial state is "metric" (matches getPref's corrupt-tolerant default —
//     no flash of the wrong unit before boot hydration settles)
//   - hydrate(u) sets state ONLY (boot path — the value came FROM storage, so
//     it must NOT re-persist)
//   - setUnit(u) sets state AND persists via setPref (the Settings write path)
//
// The store transitively imports prefs.ts → AsyncStorage (a native module that
// breaks under Node tsx — same boundary the 09-01 resolveLanguage extraction
// documents). We stub AsyncStorage in the require cache BEFORE importing the
// store so setPref's write lands in an in-memory map we can assert against.
//
// Mirrors scripts/test-units.ts pass/fail + exit-code skeleton.

import { createRequire } from "node:module";

const localRequire = createRequire(__filename);

// --- Stub AsyncStorage in the require cache before the store loads it. ---------
const asyncWrites: Record<string, string> = {};
const asyncStorageStub = {
  getItem: async (k: string) => asyncWrites[k] ?? null,
  setItem: async (k: string, v: string) => {
    asyncWrites[k] = v;
  },
  removeItem: async (k: string) => {
    delete asyncWrites[k];
  },
};

// Pre-seed the require cache for the native module so prefs.ts (loaded
// transitively by the store) resolves the in-memory stub instead of the real
// native module (which has no working setItem under Node tsx). Both `default`
// and the bare module shape are provided so esbuild's __toESM interop reads
// `.default` correctly regardless of how the import is compiled.
const asyncStoragePath = localRequire.resolve(
  "@react-native-async-storage/async-storage",
);
localRequire.cache[asyncStoragePath] = {
  id: asyncStoragePath,
  filename: asyncStoragePath,
  loaded: true,
  exports: { __esModule: true, default: asyncStorageStub },
} as unknown as NodeModule;

// Import AFTER the stub is installed (require, not static import, so the stub is
// guaranteed in place first).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useUnitStore } = require("../lib/units-store") as typeof import("../lib/units-store");

type Result = { name: string; pass: boolean; detail?: string };
const results: Result[] = [];
function check(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
}

async function main() {
// 1) Initial state is "metric".
check(
  'initial unit === "metric"',
  useUnitStore.getState().unit === "metric",
  `got "${useUnitStore.getState().unit}"`,
);

// 2) hydrate("imperial") sets state, does NOT persist.
delete asyncWrites["fm:units"];
useUnitStore.getState().hydrate("imperial");
check(
  'hydrate("imperial") → unit === "imperial"',
  useUnitStore.getState().unit === "imperial",
  `got "${useUnitStore.getState().unit}"`,
);
check(
  "hydrate does NOT persist (fm:units unwritten)",
  asyncWrites["fm:units"] === undefined,
  `fm:units = "${asyncWrites["fm:units"]}"`,
);

// 3) setUnit("metric") sets state AND persists.
useUnitStore.getState().setUnit("metric");
check(
  'setUnit("metric") → unit === "metric"',
  useUnitStore.getState().unit === "metric",
  `got "${useUnitStore.getState().unit}"`,
);
// setPref's AsyncStorage write is fire-and-forget (void .then); give the
// microtask a tick to flush before asserting.
await new Promise((r) => setTimeout(r, 10));
check(
  'setUnit("metric") persists fm:units = "metric"',
  asyncWrites["fm:units"] === "metric",
  `fm:units = "${asyncWrites["fm:units"]}"`,
);

// 4) setUnit("imperial") persists "imperial".
useUnitStore.getState().setUnit("imperial");
check(
  'setUnit("imperial") → unit === "imperial"',
  useUnitStore.getState().unit === "imperial",
  `got "${useUnitStore.getState().unit}"`,
);
await new Promise((r) => setTimeout(r, 10));
check(
  'setUnit("imperial") persists fm:units = "imperial"',
  asyncWrites["fm:units"] === "imperial",
  `fm:units = "${asyncWrites["fm:units"]}"`,
);

// --- Report ------------------------------------------------------------------
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
