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
// Idempotency (T-10-07) + CR-01 fix: the row `id` is NOT stored here — it is
// derived PER USER at seed time as deterministicUUID(`fm-exercise-seed:${userId}:${seed_key}`)
// (see ExerciseSeedBootstrap). That id is stable across re-runs for one user
// (the ['exercise','create'] upsert `{ onConflict:'id', ignoreDuplicates:true }`
// makes a re-run a no-op) AND unique across users — fixing the original bug
// where a single GLOBAL hardcoded id per seed_key let the FIRST user claim the
// id and silently starved every later user of starter exercises.

import type { MuscleGroupKey } from "@/lib/muscle-group";

export type SeedExercise = {
  /** Canonical English fallback name (i18n display via seed_key). */
  name: string;
  /** D-01 muscle-group key (resolveMuscleGroupKey is idempotent on these). */
  muscle_group: MuscleGroupKey;
  /** equip.* locale key (rendered via t('equip.'+equipment) for seed rows). */
  equipment: string;
  /** snake_case language-neutral seed identifier → exercise.<seed_key>.name.
   *  Also the per-user id key: deterministicUUID(`…:${userId}:${seed_key}`). */
  seed_key: string;
};

// 18 curated compound-first starter exercises (D-08). The per-user row id is
// derived from `seed_key` at seed time (CR-01) — not hardcoded here.
export const SEED_EXERCISES: readonly SeedExercise[] = [
  // ---- Chest ----
  { name: "Bench press", muscle_group: "chest", equipment: "barbell", seed_key: "bench_press" },
  { name: "Incline DB press", muscle_group: "chest", equipment: "dumbbell", seed_key: "incline_db_press" },
  { name: "Dips", muscle_group: "chest", equipment: "bodyweight", seed_key: "dips" },
  // ---- Back ----
  { name: "Deadlift", muscle_group: "back", equipment: "barbell", seed_key: "deadlift" },
  { name: "Pull-ups", muscle_group: "back", equipment: "bodyweight", seed_key: "pull_ups" },
  { name: "Barbell row", muscle_group: "back", equipment: "barbell", seed_key: "barbell_row" },
  { name: "Lat pulldown", muscle_group: "back", equipment: "cable", seed_key: "lat_pulldown" },
  // ---- Legs ----
  { name: "Squat", muscle_group: "legs", equipment: "barbell", seed_key: "squat" },
  { name: "Leg press", muscle_group: "legs", equipment: "machine", seed_key: "leg_press" },
  { name: "Romanian deadlift", muscle_group: "legs", equipment: "barbell", seed_key: "romanian_deadlift" },
  { name: "Lunges", muscle_group: "legs", equipment: "dumbbell", seed_key: "lunges" },
  // ---- Shoulders ----
  { name: "Overhead press", muscle_group: "shoulders", equipment: "barbell", seed_key: "overhead_press" },
  { name: "Lateral raise", muscle_group: "shoulders", equipment: "dumbbell", seed_key: "lateral_raise" },
  { name: "Face pull", muscle_group: "shoulders", equipment: "cable", seed_key: "face_pull" },
  // ---- Arms ----
  { name: "DB curl", muscle_group: "arms", equipment: "dumbbell", seed_key: "db_curl" },
  { name: "Hammer curl", muscle_group: "arms", equipment: "dumbbell", seed_key: "hammer_curl" },
  { name: "Triceps pushdown", muscle_group: "arms", equipment: "cable", seed_key: "triceps_pushdown" },
  { name: "Skullcrusher", muscle_group: "arms", equipment: "barbell", seed_key: "skullcrusher" },
] as const;
