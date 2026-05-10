// app/lib/utils/uuid.ts
//
// Phase 4 D-06: client-generated UUID v4 wrapper around expo-crypto.
//
// Why we wrap rather than calling Crypto.randomUUID() inline:
//   - Single import-site is easier to mock in tests (Plan 04 reorder tests).
//   - Future-proofs against expo-crypto API changes — if randomUUID ever moves
//     namespaces, only this file changes.
//
// All Phase 4 mutations (plan create / exercise create / plan_exercise add) call
// randomUUID() at the call-site BEFORE invoking the mutation, so the optimistic
// update has a stable id from the first millisecond and replay is idempotent
// against the unique pkey constraint via .upsert(..., { ignoreDuplicates: true }).
//
// References:
//   - 04-CONTEXT.md D-06
//   - 04-RESEARCH.md §5 (UUID + .upsert + scope.id semantics)
//   - PITFALLS §5.1

import * as Crypto from "expo-crypto";

export const randomUUID = (): string => Crypto.randomUUID();
