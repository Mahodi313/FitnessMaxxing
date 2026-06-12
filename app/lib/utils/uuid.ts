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

// Deterministic, namespaced UUID derived from `name` (UUIDv5-shaped: SHA-256
// digest with the version nibble forced to 5 and the RFC-4122 variant bits set).
//
// Phase 10 CR-01 fix: the starter-exercise seed must use a PER-USER id so two
// users on the same device never collide on the GLOBAL `exercises` primary key.
// The original seed hardcoded one id per seed_key, so the second user's upsert
// hit `ON CONFLICT (id) DO NOTHING` and silently received zero exercises. Keying
// the id on `${userId}:${seed_key}` makes the seed stable per user (idempotent
// re-runs) AND unique across users (no cross-user PK reuse).
//
// SHA-256 (not SHA-1) because expo-crypto exposes it directly; the result is not
// a spec-pure v5 UUID but it IS a valid, collision-resistant, deterministic
// UUID — all this id needs to be.
export async function deterministicUUID(name: string): Promise<string> {
  const hex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    name,
  );
  const c = hex.slice(0, 32).split("");
  c[12] = "5"; // version 5
  c[16] = ((parseInt(c[16], 16) & 0x3) | 0x8).toString(16); // variant 10xx
  const h = c.join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}
