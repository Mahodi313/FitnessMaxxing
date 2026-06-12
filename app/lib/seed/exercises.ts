// app/lib/seed/exercises.ts
//
// Phase 10 (Plan 10-02), D-06 / D-08. The curated ~18-row bilingual starter
// exercise seed. Delivered client-side on first run per signed-in user by
// ExerciseSeedBootstrap (app/app/(app)/_layout.tsx, D-07).
//
// Storage contract (D-06, RESEARCH §"Translation-key namespace"):
//   - `muscle_group` stores the D-01 key string (e.g. "chest") — NOT a label.
//     The picker resolves it via resolveMuscleGroupKey (idempotent for keys)
//     and renders t('mg<Key>').
//   - `equipment` stores the equip.* key (e.g. "barbell"). The picker renders
//     t('equip.' + equipment) ONLY when seed_key is non-null; user rows render
//     equipment raw.
//   - `seed_key` is the snake_case language-neutral identifier (e.g.
//     "bench_press"). The display name is rendered via
//     t('exercise.' + seed_key + '.name') — NOT stored translated.
//   - `name` carries a stable canonical English fallback so any non-i18n code
//     path (or a row whose seed_key key is missing from a locale) still shows
//     a readable value.
//
// Idempotency (T-10-07): every `id` is a DETERMINISTIC, hardcoded UUID. The
// ['exercise','create'] mutation default upserts with
// `{ onConflict: 'id', ignoreDuplicates: true }`, so a re-run before the
// fm:exercises_seeded:<userId> flag persists upserts the SAME 18 IDs and
// produces zero duplicates. Hardcoded UUIDs (vs uuidv5) avoid adding any
// package dependency (T-10-SC — no install surface).

import type { MuscleGroupKey } from "@/lib/muscle-group";

export type SeedExercise = {
  /** Deterministic UUID — stable across re-runs for idempotent upsert. */
  id: string;
  /** Canonical English fallback name (i18n display via seed_key). */
  name: string;
  /** D-01 muscle-group key (resolveMuscleGroupKey is idempotent on these). */
  muscle_group: MuscleGroupKey;
  /** equip.* locale key (rendered via t('equip.'+equipment) for seed rows). */
  equipment: string;
  /** snake_case language-neutral seed identifier → exercise.<seed_key>.name. */
  seed_key: string;
};

// 18 curated compound-first starter exercises (D-08). UUIDs are fixed v4-shaped
// constants — deterministic by being hardcoded, never regenerated.
export const SEED_EXERCISES: readonly SeedExercise[] = [
  // ---- Chest ----
  { id: "5e0d0001-0000-4000-8000-000000000001", name: "Bench press", muscle_group: "chest", equipment: "barbell", seed_key: "bench_press" },
  { id: "5e0d0002-0000-4000-8000-000000000002", name: "Incline DB press", muscle_group: "chest", equipment: "dumbbell", seed_key: "incline_db_press" },
  { id: "5e0d0003-0000-4000-8000-000000000003", name: "Dips", muscle_group: "chest", equipment: "bodyweight", seed_key: "dips" },
  // ---- Back ----
  { id: "5e0d0004-0000-4000-8000-000000000004", name: "Deadlift", muscle_group: "back", equipment: "barbell", seed_key: "deadlift" },
  { id: "5e0d0005-0000-4000-8000-000000000005", name: "Pull-ups", muscle_group: "back", equipment: "bodyweight", seed_key: "pull_ups" },
  { id: "5e0d0006-0000-4000-8000-000000000006", name: "Barbell row", muscle_group: "back", equipment: "barbell", seed_key: "barbell_row" },
  { id: "5e0d0007-0000-4000-8000-000000000007", name: "Lat pulldown", muscle_group: "back", equipment: "cable", seed_key: "lat_pulldown" },
  // ---- Legs ----
  { id: "5e0d0008-0000-4000-8000-000000000008", name: "Squat", muscle_group: "legs", equipment: "barbell", seed_key: "squat" },
  { id: "5e0d0009-0000-4000-8000-000000000009", name: "Leg press", muscle_group: "legs", equipment: "machine", seed_key: "leg_press" },
  { id: "5e0d000a-0000-4000-8000-00000000000a", name: "Romanian deadlift", muscle_group: "legs", equipment: "barbell", seed_key: "romanian_deadlift" },
  { id: "5e0d000b-0000-4000-8000-00000000000b", name: "Lunges", muscle_group: "legs", equipment: "dumbbell", seed_key: "lunges" },
  // ---- Shoulders ----
  { id: "5e0d000c-0000-4000-8000-00000000000c", name: "Overhead press", muscle_group: "shoulders", equipment: "barbell", seed_key: "overhead_press" },
  { id: "5e0d000d-0000-4000-8000-00000000000d", name: "Lateral raise", muscle_group: "shoulders", equipment: "dumbbell", seed_key: "lateral_raise" },
  { id: "5e0d000e-0000-4000-8000-00000000000e", name: "Face pull", muscle_group: "shoulders", equipment: "cable", seed_key: "face_pull" },
  // ---- Arms ----
  { id: "5e0d000f-0000-4000-8000-00000000000f", name: "DB curl", muscle_group: "arms", equipment: "dumbbell", seed_key: "db_curl" },
  { id: "5e0d0010-0000-4000-8000-000000000010", name: "Hammer curl", muscle_group: "arms", equipment: "dumbbell", seed_key: "hammer_curl" },
  { id: "5e0d0011-0000-4000-8000-000000000011", name: "Triceps pushdown", muscle_group: "arms", equipment: "cable", seed_key: "triceps_pushdown" },
  { id: "5e0d0012-0000-4000-8000-000000000012", name: "Skullcrusher", muscle_group: "arms", equipment: "barbell", seed_key: "skullcrusher" },
] as const;
