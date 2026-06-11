// app/lib/prefs.ts
//
// Phase 9 (Auth, Settings & Preferences), Plan 09-01. Typed, corrupt-tolerant
// read/write wrappers over the four new `fm:*` AsyncStorage keys this phase
// introduces: fm:units, fm:language, fm:haptics, fm:notifications.
//
// Idiom (the established repo standard — see fm:theme in
// app/app/(app)/(tabs)/settings.tsx lines 44-61 + LocaleBootstrap in
// app/_layout.tsx): every read is `z.<schema>.catch(<default>).parse(v)` so a
// tampered / null / garbage value falls back to the default and NEVER throws
// (T-09-01 / T-09-02 mitigation, T-08-03 lineage). Every write is
// `void AsyncStorage.setItem(...).catch(console.warn)` — fail-soft, never
// blocks the UI.
//
// BOOLEAN PREFS ARE STORED AS THE STRINGS "true"/"false" — NOT JSON.parse'd.
// JSON.parse throws on garbage BEFORE `.catch` can fire (RESEARCH Pattern 1
// note), defeating the corrupt-tolerance guarantee. An enum-catch over the two
// string literals + a `.transform` to boolean is the throw-free equivalent.
//
// Decisions:
//   - D-08: fm:haptics defaults ON.
//   - D-07: fm:notifications defaults OFF (stored pref only — no expo-notifications
//     install / OS permission this phase).
//   - D-10: fm:language is three-state "system" | "sv" | "en".
//   - D-03: fm:units defaults Metric.
//
// This is a thin wrapper, NOT a persisted-Zustand store (RESEARCH §Alternatives
// rejects that — zero precedent in this repo).
//
// References:
//   - .planning/phases/09-auth-settings-preferences/09-PATTERNS.md §lib/prefs.ts
//   - app/app/(app)/(tabs)/settings.tsx (fm:theme read/write idiom)
import AsyncStorage from "@react-native-async-storage/async-storage";
import { z } from "zod";

import type { LanguagePref } from "./resolve-language";

export type UnitPref = "metric" | "imperial";

// ---------------------------------------------------------------------------
// Per-key schemas. Each `.catch(default)` makes the read total over `unknown`
// (AsyncStorage returns string | null) — never throws on tampered/null input.
// ---------------------------------------------------------------------------
const unitsSchema = z.enum(["metric", "imperial"]).catch("metric");
const languageSchema = z.enum(["system", "sv", "en"]).catch("system");
const hapticsSchema = z
  .enum(["true", "false"])
  .catch("true") // D-08: default ON
  .transform((s) => s === "true");
const notificationsSchema = z
  .enum(["true", "false"])
  .catch("false") // D-07: default OFF
  .transform((s) => s === "true");

// Map each pref key to its (resolved) value type for a typed getPref/setPref.
type PrefMap = {
  "fm:units": UnitPref;
  "fm:language": LanguagePref;
  "fm:haptics": boolean;
  "fm:notifications": boolean;
};
type PrefKey = keyof PrefMap;

const SCHEMAS = {
  "fm:units": unitsSchema,
  "fm:language": languageSchema,
  "fm:haptics": hapticsSchema,
  "fm:notifications": notificationsSchema,
} as const;

/**
 * Read a typed fm:* pref. Returns the schema default on null / tampered / garbage
 * input — never throws (T-09-01 / T-09-02). Booleans come back as real booleans.
 */
export async function getPref<K extends PrefKey>(key: K): Promise<PrefMap[K]> {
  const raw = await AsyncStorage.getItem(key);
  return SCHEMAS[key].parse(raw) as PrefMap[K];
}

/**
 * Write a typed fm:* pref. Booleans are persisted as the strings "true"/"false"
 * (so the enum-catch read stays throw-free). Fail-soft — a write failure warns
 * and is swallowed, never blocking the UI.
 */
export function setPref<K extends PrefKey>(key: K, value: PrefMap[K]): void {
  // WR-05: total, explicit serializer. The else branch's residual type
  // (UnitPref | LanguagePref) happens to be string-assignable today, but
  // `String(value)` makes "everything serializes to string" the explicit
  // contract — future-proofs against a non-string non-boolean pref (e.g. a
  // numeric `fm:restSeconds`) silently coercing through a lying annotation.
  const stored: string =
    typeof value === "boolean" ? (value ? "true" : "false") : String(value);
  void AsyncStorage.setItem(key, stored).catch(() => {
    console.warn(`[prefs] AsyncStorage write failed — ${key} not persisted`);
  });
}
