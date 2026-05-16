#!/usr/bin/env -S tsx --env-file=app/.env.local
/**
 * linear-setup-issues.ts — Steg 3 av 3
 *
 * Skapar 24 closed backfill-issues + 22 open forward-issues, och länkar 9
 * befintliga FIT-issues till rätt Projects. Idempotent via title-lookup.
 */

const API = "https://api.linear.app/graphql";
const TEAM_ID = "82f553bc-ff89-453f-ad09-9db711e8ea73";

async function gql<T>(apiKey: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: apiKey },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data as T;
}

// ─── Workflow states (introspected) ───────────────────────────────────────────
const STATE_IDS = {
  Backlog: "7860ce1b-61ed-4131-9160-030c705674b4",
  Todo: "028ac46b-7c63-4f84-98ea-6e4a3884926b",
  InProgress: "7b7a409c-4a0b-4269-a079-68b23c65c6c0",
  InReview: "24cad00e-7ac0-4b02-b355-768fefa5b2dc",
  Done: "d366df95-7848-4172-976f-d7af0a794ecd",
  Canceled: "916cfc8e-666a-44b8-bd07-ca0b0a305b1b",
  Duplicate: "a3f8cf0e-a600-4dc2-aae1-2bd6155ed3e1",
} as const;

const PROJECT_IDS = {
  P1: "800c89e1-15fb-47f9-8576-345074469b04",
  P2: "3090e625-d424-48f9-a90f-9e6bb93165b4",
  P3: "758f5c55-75b3-4f05-ae50-3f09158adeb0",
  P4: "73390d56-a521-4a4d-bf27-c010f32d4b0e",
  P5: "f1d53d22-220a-4c10-be22-a3ed68198c35",
  P6: "761c6e89-3134-41f0-9efe-58485d5b1fcf",
  P7: "9ebc0d6a-a56e-4e7b-8d50-fecc8e41a4f9",
  P8: "a149e14e-4c3c-498a-b0ca-f979cb4b45d0",
  V2: "39b3d779-6222-425b-9c67-7a2cf1c27fe6",
} as const;

const LABEL_IDS = {
  Bug: "7aefb631-2565-4e02-a4ed-c9e12f68f60b",
  Feature: "db96ea5d-6744-40bb-a45b-73e26f48c660",
  TechDebt: "d227847c-c7e0-4f75-8d64-46ecf738d397",
  Deferred: "bfa0b235-9c79-4425-94da-9134049b4fb2",
  UI: "560887d5-143d-42a1-937d-8efa309497f1",
  Plan: "8349ce1b-c092-45b4-bec3-06c31268f06f",
  Requirement: "fa7655e9-67e6-4db1-95c2-9473d96582dd",
  GapClosure: "d9115be6-778a-4de8-8c5c-f1295c45957b",
  Infrastructure: "d4efc7df-bf7c-41f9-80dc-320a2cbbb4f8",
} as const;

const MILESTONE_IDS: Record<string, string> = {
  // Phase 1
  "1.1": "3509a725-1590-4887-9b58-339ce9da20c0",
  "1.2": "633a8a9a-b718-46f9-99b6-9c5545d3496c",
  "1.3": "7221bc25-9fee-4bec-b2bc-dd502faa2efe",
  "1.4": "bcae71c5-d553-4848-a82d-40f787e236b7",
  "1.5": "d941e256-4360-491a-ab6d-c4546d897b75",
  // Phase 2
  "2.1": "b7346916-7921-4655-86dd-056ca239c043",
  "2.2": "5700baed-c4df-40e3-aadf-404551a3c156",
  "2.3": "30c8252c-eb6b-4293-ad77-2c49864be084",
  "2.4": "ff3e062f-9cf4-4ca6-a693-194c7dfbe3ef",
  "2.5": "0727b96f-5607-46f3-95fb-1254e6690377",
  // Phase 3
  "3.1": "44899ced-3d55-4e00-988f-63fd7151d09d",
  "3.2": "c8053846-313c-4422-b207-25190f3e3292",
  "3.3": "b8ff161a-0d90-4a3b-be8c-1226afc05481",
  "3.4": "53cc6ed2-164d-4a3e-a2bb-899307f59e6d",
  "3.5": "e83147d7-860d-4050-9695-f4f618543ea8",
  // Phase 4
  "4.1": "427df9a8-0dbd-4c39-a125-d4cbd784237d",
  "4.2": "c8397912-c50e-4f07-a873-28e594f0c412",
  "4.3": "6d36956a-8cf6-4618-a056-422df46b36e4",
  "4.4": "b467027d-5228-401d-8e6d-8c689d261e9d",
  "4.5": "9abcd237-7962-4980-9983-3660f5e9911a",
  // Phase 5
  "5.1": "0943e025-430b-4d86-9b78-26a9ce0556f5",
  "5.2": "ea4ef541-6981-42aa-a411-beda3640c4c2",
  "5.3": "c258db52-bea6-46bf-ac5e-4cc196793d91",
  "5.4": "ee1d82de-6279-49bd-b7cd-d811ed503717",
  "5.5": "212f8ebd-629c-4e21-a353-1a4a8c85b53c",
  "5.6": "cc82f8e7-b185-49e9-929e-6276cbc0d1ad",
  // Phase 6
  "6.1": "3ee95085-ad57-4f2a-a202-62ed890fe4f3",
  "6.2": "78813872-42d7-4334-8dca-5ab86481b1f4",
  "6.3": "f94b1266-41a4-4824-84f1-12a86c9d3e84",
  "6.4": "546129a8-5b5a-45e4-8a08-d63c8af780a8",
  // Phase 7
  "7.1": "aa10facc-d33c-46c2-9263-ba9493353c93",
  "7.2": "ebff9062-8595-45f6-ac08-ab0e9c3600c6",
  "7.3": "5f57c9bf-8c8f-4271-9113-61c5a5b0211c",
  "7.4": "313a542b-c610-4697-a44f-25c2ca57b5db",
  "7.5": "360aac29-0c5e-484c-9fab-d4d7116ceb17",
  // Phase 8
  "8.1": "a9fa1692-bee4-4d02-bc17-3bb961da5703",
  "8.2": "f9127358-fcd4-411a-b16e-1b5b5c9d04fc",
  "8.3": "c1ce3f53-dbe3-4e7b-bb82-c453134ddc2e",
  "8.4": "2dc927d1-6d5b-4a50-8dc7-6958b210cd96",
  "8.5": "53437be6-6099-4441-96af-f28efe1e44fd",
  // V2
  "V2.1": "363b2549-49fd-4e5c-8dc9-e6950a260b66",
  "V2.2": "b3c165c8-f9ef-453d-b5a5-205c84b74c2a",
  "V2.3": "e6c284a1-763d-47d9-bd20-af825c2a6229",
  "V2.4": "2e261a9f-08c3-4b2a-888b-c452595dce98",
};

// ─── DATA — Issues ────────────────────────────────────────────────────────────
type IssueSpec = {
  title: string;
  description: string;
  projectId: string;
  milestoneKey?: keyof typeof MILESTONE_IDS;
  stateId: string;
  priority: 0 | 1 | 2 | 3 | 4; // 0=none, 1=urgent, 2=high, 3=medium, 4=low
  labels: Array<keyof typeof LABEL_IDS>;
};

const BACKFILL_ISSUES: IssueSpec[] = [
  // ─── Phase 1 (3) ─────────────────────────────────────────────────────────────
  { title: "Plan 01-01: Reset Expo-scaffolden & installera locked stack", description: "Reset Expo-scaffolden och installera locked-stacken (CLAUDE.md TL;DR-pinnar) med rätt verktyg per pakettyp; expo-doctor 0 fel.\n\n**Källa:** `.planning/phases/01-bootstrap-infra-hardening/01-01-reset-and-install-stack-PLAN.md`\n**Closed:** 2026-05-08", projectId: PROJECT_IDS.P1, milestoneKey: "1.3", stateId: STATE_IDS.Done, priority: 0, labels: ["Plan", "Infrastructure"] },
  { title: "Plan 01-02: NativeWind 4 + Tailwind 3 + dark-mode smoke-test", description: "NativeWind 4 + Tailwind 3-trippel + `darkMode:'class'`; smoke-test-vy renderar på iPhone via Expo Go med `dark:`-konvention.\n\n**Källa:** `.planning/phases/01-bootstrap-infra-hardening/01-02-nativewind-darkmode-smoketest-PLAN.md`\n**Closed:** 2026-05-08", projectId: PROJECT_IDS.P1, milestoneKey: "1.1", stateId: STATE_IDS.Done, priority: 0, labels: ["Plan", "UI"] },
  { title: "Plan 01-03: .env.local + supabase.ts (LargeSecureStore) + provider-stack", description: ".env.local + lib/supabase.ts (LargeSecureStore) + lib/query-client.ts + provider-stack i _layout.tsx + connect-test bevisar Supabase-rundresan.\n\n**Källa:** `.planning/phases/01-bootstrap-infra-hardening/01-03-env-supabase-providers-PLAN.md`\n**Closed:** 2026-05-08", projectId: PROJECT_IDS.P1, milestoneKey: "1.4", stateId: STATE_IDS.Done, priority: 0, labels: ["Plan", "Infrastructure"] },

  // ─── Phase 2 (6) ─────────────────────────────────────────────────────────────
  { title: "Plan 02-01: CLI bootstrap & preflight", description: "supabase init/link, tsx, npm scripts, .env.example, .env.local.\n\n**Källa:** `.planning/phases/02-schema-rls-type-generation/02-01-PLAN.md`\n**Closed:** 2026-05-09", projectId: PROJECT_IDS.P2, milestoneKey: "2.1", stateId: STATE_IDS.Done, priority: 0, labels: ["Plan", "Infrastructure"] },
  { title: "Plan 02-02: Author 0001_initial_schema.sql", description: "Errata-fixed RLS (using + with check), set_type ENUM, handle_new_user trigger.\n\n**Källa:** `.planning/phases/02-schema-rls-type-generation/02-02-PLAN.md`\n**Closed:** 2026-05-09", projectId: PROJECT_IDS.P2, milestoneKey: "2.2", stateId: STATE_IDS.Done, priority: 0, labels: ["Plan"] },
  { title: "Plan 02-03: supabase db push + Studio sanity check", description: "[BLOCKING] Push migration till remote + db diff + Studio sanity.\n\n**Källa:** `.planning/phases/02-schema-rls-type-generation/02-03-PLAN.md`\n**Closed:** 2026-05-09", projectId: PROJECT_IDS.P2, milestoneKey: "2.1", stateId: STATE_IDS.Done, priority: 0, labels: ["Plan", "Infrastructure"] },
  { title: "Plan 02-04: Generate types/database.ts + typed Supabase client", description: "Generera types/database.ts; type the supabase client; remove phase1ConnectTest.\n\n**Källa:** `.planning/phases/02-schema-rls-type-generation/02-04-PLAN.md`\n**Closed:** 2026-05-09", projectId: PROJECT_IDS.P2, milestoneKey: "2.5", stateId: STATE_IDS.Done, priority: 0, labels: ["Plan"] },
  { title: "Plan 02-05: Author scripts/test-rls.ts (cross-user assertions)", description: "npm run test:rls passes (22/22) — bevisar errata closed.\n\n**Källa:** `.planning/phases/02-schema-rls-type-generation/02-05-PLAN.md`\n**Closed:** 2026-05-09", projectId: PROJECT_IDS.P2, milestoneKey: "2.3", stateId: STATE_IDS.Done, priority: 0, labels: ["Plan"] },
  { title: "Plan 02-06: Doc reconciliation (ARCHITECTURE + STATE + CLAUDE)", description: "ARCHITECTURE §4/§5 errata-amendment, STATE.md, CLAUDE.md Database conventions.\n\n**Källa:** `.planning/phases/02-schema-rls-type-generation/02-06-PLAN.md`\n**Closed:** 2026-05-09", projectId: PROJECT_IDS.P2, milestoneKey: "2.5", stateId: STATE_IDS.Done, priority: 0, labels: ["Plan"] },

  // ─── Phase 3 (4) ─────────────────────────────────────────────────────────────
  { title: "Plan 03-01: Zod 4 schemas + Zustand auth-store", description: "Zod 4 schemas + Zustand auth-store with module-scope onAuthStateChange listener + Node-only schema test.\n\n**Källa:** `.planning/phases/03-auth-persistent-session/03-01-schemas-store-PLAN.md`\n**Closed:** 2026-05-09", projectId: PROJECT_IDS.P3, milestoneKey: "3.3", stateId: STATE_IDS.Done, priority: 0, labels: ["Plan"] },
  { title: "Plan 03-02: Root layout + Stack.Protected + sign-in screen", description: "Root layout splash hold + Stack.Protected; (auth) group layout; sign-in screen (RHF + Zod + Supabase + error map).\n\n**Källa:** `.planning/phases/03-auth-persistent-session/03-02-root-auth-signin-PLAN.md`\n**Closed:** 2026-05-09", projectId: PROJECT_IDS.P3, milestoneKey: "3.2", stateId: STATE_IDS.Done, priority: 0, labels: ["Plan", "UI"] },
  { title: "Plan 03-03: Sign-up screen + (app) group layout", description: "Sign-up screen (RHF + Zod + 7-case error map); (app) group layout (Redirect defense-in-depth); (app)/index.tsx post-login placeholder; delete Phase 1 smoke-test.\n\n**Källa:** `.planning/phases/03-auth-persistent-session/03-03-signup-app-group-PLAN.md`\n**Closed:** 2026-05-09", projectId: PROJECT_IDS.P3, milestoneKey: "3.1", stateId: STATE_IDS.Done, priority: 0, labels: ["Plan", "UI"] },
  { title: "Plan 03-04: Manual iPhone verification", description: "Manual iPhone verification of all 5 ROADMAP success criteria + Studio toggle confirmation + 03-VERIFICATION.md sign-off (UAT 9/11 pass; 2 V1.1-deferred).\n\n**Källa:** `.planning/phases/03-auth-persistent-session/03-04-manual-verify-PLAN.md`\n**Closed:** 2026-05-09", projectId: PROJECT_IDS.P3, milestoneKey: "3.5", stateId: STATE_IDS.Done, priority: 0, labels: ["Plan"] },

  // ─── Phase 4 (4) ─────────────────────────────────────────────────────────────
  { title: "Plan 04-01: Offline-first queue infrastructure", description: "lib/query/* split (D-01), 8 setMutationDefaults (D-04), resumePausedMutations on reconnect (closes Pitfall 8.12), expo-crypto UUID util (D-06), Zod schemas, resource hooks, two-phase reorder algorithm (D-09), 7 Wave 0 test scripts (8/8 green incl. test-rls regression).\n\n**Källa:** `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-01-PLAN.md`\n**Closed:** 2026-05-10", projectId: PROJECT_IDS.P4, milestoneKey: "4.4", stateId: STATE_IDS.Done, priority: 0, labels: ["Plan", "Infrastructure"] },
  { title: "Plan 04-02: (tabs) skeleton + Planer-list + plans/new + OfflineBanner", description: "Svenska labels (D-15/D-17/D-18) + Planer-list med empty-state CTA (D-14) + plans/new + OfflineBanner med ✕ close (D-05); deletes Phase 3 (app)/index.tsx; sign-out moved to settings (D-16).\n\n**Källa:** `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-02-PLAN.md`\n**Closed:** 2026-05-10", projectId: PROJECT_IDS.P4, milestoneKey: "4.1", stateId: STATE_IDS.Done, priority: 0, labels: ["Plan", "UI"] },
  { title: "Plan 04-03: Plan-detail + exercise-picker + plan_exercise targets edit", description: "Plan-detail (read + meta-edit + archive via D-12) + exercise-picker modal with chained create-and-add (D-13 + scope.id chaining) + plan_exercise targets edit modal (D-11).\n\n**Källa:** `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-03-PLAN.md`\n**Closed:** 2026-05-10", projectId: PROJECT_IDS.P4, milestoneKey: "4.2", stateId: STATE_IDS.Done, priority: 0, labels: ["Plan", "UI"] },
  { title: "Plan 04-04: Drag-to-reorder + cross-user RLS extension + airplane-mode UAT", description: "react-native-draggable-flatlist + dense order_index; extends test-rls.ts to 29 PASS; ships manual airplane-mode test checklist; user signed off `approved` 2026-05-10. Established mutate-not-mutateAsync canonical pattern + inline-overlay convention.\n\n**Källa:** `.planning/phases/04-plans-exercises-offline-queue-plumbing/04-04-PLAN.md`\n**Closed:** 2026-05-10", projectId: PROJECT_IDS.P4, milestoneKey: "4.3", stateId: STATE_IDS.Done, priority: 0, labels: ["Plan", "UI"] },

  // ─── Phase 5 (7) ─────────────────────────────────────────────────────────────
  { title: "Plan 05-01: Schemas + plumbing + Wave 0 verification", description: "sessions.ts/sets.ts Zod, 5 new setMutationDefaults in client.ts, persister throttleTime:500 + AppState background-flush, 3 new tsx scripts + 2 extended for 25-set FIFO replay.\n\n**Källa:** `.planning/phases/05-active-workout-hot-path-f13-lives-or-dies/05-01-PLAN.md`\n**Closed:** 2026-05-13", projectId: PROJECT_IDS.P5, milestoneKey: "5.2", stateId: STATE_IDS.Done, priority: 0, labels: ["Plan", "Infrastructure"] },
  { title: "Plan 05-02: Workout vertical slice", description: "sessions/sets/last-value resource hooks + workout/[sessionId] screen + Starta pass CTA on plans/[id] + F7 chip + Avsluta-overlay; F5+F6+F7+F8 closed end-to-end.\n\n**Källa:** `.planning/phases/05-active-workout-hot-path-f13-lives-or-dies/05-02-PLAN.md`\n**Closed:** 2026-05-13", projectId: PROJECT_IDS.P5, milestoneKey: "5.2", stateId: STATE_IDS.Done, priority: 0, labels: ["Plan", "UI"] },
  { title: "Plan 05-03: ActiveSessionBanner + draft-recovery + F13 brutal-test recipe", description: "ActiveSessionBanner + draft-session-recovery overlay on (tabs)/index + Passet sparat toast + test-rls.ts cross-user extension + F13 manual brutal-test recipe + human-verify gate (closes ROADMAP Phase 5 success #5 + #6).\n\n**Källa:** `.planning/phases/05-active-workout-hot-path-f13-lives-or-dies/05-03-PLAN.md`\n**Closed:** 2026-05-13", projectId: PROJECT_IDS.P5, milestoneKey: "5.5", stateId: STATE_IDS.Done, priority: 0, labels: ["Plan", "UI"] },
  { title: "Plan 05-04: [GAP-CLOSURE P0] exercise_sets UNIQUE + BEFORE INSERT trigger", description: "Migrations 0002 (dedupe), 0003 (UNIQUE constraint), 0004 (BEFORE INSERT trigger för server-side set_number) + client useAddSet cutover. SUPERSEDES Phase 5 D-16 (client-side set_number race). Stänger FIT-7.\n\n**Källa:** `.planning/phases/05-active-workout-hot-path-f13-lives-or-dies/05-04-PLAN.md`\n**Closed:** 2026-05-14", projectId: PROJECT_IDS.P5, milestoneKey: "5.6", stateId: STATE_IDS.Done, priority: 0, labels: ["Plan", "GapClosure"] },
  { title: "Plan 05-05: [GAP-CLOSURE P1] PersistQueryClientProvider hydration gate", description: "Closes Phase 5 D-25 LOAD-side gap; workout/[sessionId].tsx renders 'Återställer pass…' affordance until cache rehydration completes; eliminates empty-card flicker on force-quit + Återuppta. Stänger FIT-8.\n\n**Källa:** `.planning/phases/05-active-workout-hot-path-f13-lives-or-dies/05-05-PLAN.md`\n**Closed:** 2026-05-14", projectId: PROJECT_IDS.P5, milestoneKey: "5.5", stateId: STATE_IDS.Done, priority: 0, labels: ["Plan", "GapClosure"] },
  { title: "Plan 05-06: [GAP-CLOSURE P1] z.preprocess weight comma → period", description: "z.preprocess wrapper on setFormSchema.weight_kg normalizes ',' → '.' before z.coerce.number (Swedish-locale decimal-pad keyboard); 3 new test-set-schemas cases. Stänger FIT-9.\n\n**Källa:** `.planning/phases/05-active-workout-hot-path-f13-lives-or-dies/05-06-PLAN.md`\n**Closed:** 2026-05-14", projectId: PROJECT_IDS.P5, milestoneKey: "5.2", stateId: STATE_IDS.Done, priority: 0, labels: ["Plan", "GapClosure"] },
  { title: "Plan 05-07: [GAP-CLOSURE P2] ActiveSessionBanner mount-scope investigation", description: "Investigation-first plan for intermittent missing ActiveSessionBanner on (tabs) back-nav; instrumented reproduction → 05-07-INVESTIGATION.md → targeted fix (UI-SPEC mount-scope clarification). Stänger FIT-10.\n\n**Källa:** `.planning/phases/05-active-workout-hot-path-f13-lives-or-dies/05-07-PLAN.md`\n**Closed:** 2026-05-14", projectId: PROJECT_IDS.P5, milestoneKey: "5.5", stateId: STATE_IDS.Done, priority: 0, labels: ["Plan", "GapClosure"] },
];

const FORWARD_ISSUES: IssueSpec[] = [
  // ─── Phase 6 — Open (2 per requirement F9 + F10) ────────────────────────────
  { title: "F9: Lista historiska pass (cursor-paginerad)", description: "Användare ser cursor-paginerad lista över historiska pass i `(tabs)/history.tsx`, sorterad på `started_at desc`. Tap → öppna pass → se alla loggade set per övning (read-only).\n\n**Acceptans:**\n- Cursor-paginering (inte page-offset)\n- Sort: `started_at desc`\n- Tap-into → session-detail visar set per övning\n- Funkar offline (TanStack persister-cache hydrerad från AsyncStorage)\n\n**Stack:** Read-side återanvänder Phase 5 query patterns (sessionsKeys, setsKeys); ny `useSessionHistoryQuery` med cursor.\n\n**Cross-cut:** milestone 6.1 (lista) + 6.2 (session-detail) + 6.4 (offline)\n\n**Källa:** PRD §F9, REQUIREMENTS.md, ROADMAP.md Phase 6 success #1+#2+#4.", projectId: PROJECT_IDS.P6, milestoneKey: "6.1", stateId: STATE_IDS.Todo, priority: 2, labels: ["Requirement", "Feature", "UI"] },
  { title: "F10: Progressionsgraf per övning (CartesianChart)", description: "Användare kan se en graf (max vikt eller total volym över tid) per övning via `<CartesianChart>` från victory-native; data är memoiserad så grafen inte re-mountar vid varje render.\n\n**Acceptans:**\n- Graf renderar med Skia (`@shopify/react-native-skia@2.2.12` + `victory-native@^41.20.2` — locked)\n- Memoiserad data (`useMemo` på aggregate-array)\n- `set_type='working'`-filter (Phase 2 D-13, Phase 5 D-18)\n- Default metric: TBD i Phase 6 discuss\n\n**Stack:** `<CartesianChart>` från victory-native XL; query aggregerar `exercise_sets` per `exercise_id, completed_at`.\n\n**Källa:** PRD §F10 (V1 Bör), REQUIREMENTS.md, ROADMAP.md Phase 6 success #3.", projectId: PROJECT_IDS.P6, milestoneKey: "6.3", stateId: STATE_IDS.Todo, priority: 3, labels: ["Requirement", "Feature", "UI"] },

  // ─── Phase 7 — Open (4 per requirement F11 + F12 + F15-toggle + V1-soak) ────
  { title: "F11: RPE-fält (1-10) per set", description: "Användare kan logga RPE (1-10) per set; värdet är optionellt (lämnas tomt → null).\n\n**Acceptans:**\n- Inline RPE-input på set-rad (synlig efter Klart eller toggle)\n- Range 1-10, integer\n- Optional (null = ej angiven)\n- Schema redo sedan Phase 2 (`exercise_sets.rpe`)\n\n**Källa:** PRD §F11 (V1 Kan), REQUIREMENTS.md, ROADMAP.md Phase 7 success #1.", projectId: PROJECT_IDS.P7, milestoneKey: "7.1", stateId: STATE_IDS.Backlog, priority: 4, labels: ["Requirement", "Feature", "UI"] },
  { title: "F12: Anteckningar per pass", description: "Användare kan lägga textanteckningar per pass (visas i historik-vyn).\n\n**Acceptans:**\n- Notes-fält på `workout_sessions` (schema redo)\n- Edit på Avsluta-flow eller post-finish\n- Visas i Phase 6 session-detail-vyn\n\n**Källa:** PRD §F12 (V1 Kan), REQUIREMENTS.md, ROADMAP.md Phase 7 success #2.", projectId: PROJECT_IDS.P7, milestoneKey: "7.2", stateId: STATE_IDS.Backlog, priority: 4, labels: ["Requirement", "Feature", "UI"] },
  { title: "F15-toggle: Dark-mode-toggle i Settings", description: "Användare kan toggla dark mode manuellt i Settings-fliken; valet persisterar via `expo-secure-store` eller AsyncStorage.\n\n**Acceptans:**\n- Toggle i `(tabs)/settings.tsx`\n- 3 lägen: System / Light / Dark\n- Persistens via secure-store / AsyncStorage\n- Konventionen finns sedan Phase 1 (`darkMode: 'class'` + `dark:` variants)\n\n**Källa:** PRD §F15 (V1 Bör, toggle-UI), REQUIREMENTS.md, ROADMAP.md Phase 7 success #3.", projectId: PROJECT_IDS.P7, milestoneKey: "7.3", stateId: STATE_IDS.Backlog, priority: 3, labels: ["Requirement", "Feature", "UI"] },
  { title: "V1 Soak Validation: 4-veckors personlig validering", description: "PRD §8-soak: V1 körs personligt i 4 veckor mot validation-kriterier.\n\n**Acceptans:**\n- ≤ 1 bug/vecka\n- Alla pass loggade i appen (inte på papper)\n- Kärnflöde reproducerbart ≤ 2 min\n- Inga F13 set-förluster\n\n**Källa:** ROADMAP.md Phase 7 success #4+#5; PRD §8 validation-kriterier.", projectId: PROJECT_IDS.P7, milestoneKey: "7.5", stateId: STATE_IDS.Backlog, priority: 3, labels: ["Requirement"] },

  // ─── Phase 8 V1.1 — Open (5 per requirement) ────────────────────────────────
  { title: "F14: Apple Sign-In", description: "App Store-blocker. Apple Identity provider via Supabase Auth.\n\n**Acceptans:**\n- 'Sign in with Apple'-knapp på sign-in/sign-up\n- Supabase Auth provider-integration\n- Profile-skapande via `handle_new_user` trigger fungerar med Apple-flow\n\n**Källa:** REQUIREMENTS.md V1.1 §Authentication, PRD §F14.", projectId: PROJECT_IDS.P8, milestoneKey: "8.1", stateId: STATE_IDS.Backlog, priority: 3, labels: ["Requirement", "Feature", "Deferred"] },
  { title: "F1.1: Email-confirmation deep-link handler", description: "Carry-over från Phase 3 UAT 2026-05-09. Bekräftelselänk öppnas i webbläsare i V1; ska öppna appen direkt i V1.1.\n\n**Tech:**\n- Expo `Linking` API\n- Supabase `verifyOtp` / `exchangeCodeForSession`\n- Universal Links vs custom scheme `fitnessmaxxing://`\n\n**Acceptans:**\n- Klick på email-länk öppnar appen (inte webbläsare)\n- Session etableras automatiskt efter verifiering\n- Stänger UAT.md gap-1 + gap-2\n\n**Källa:** `.planning/phases/03-auth-persistent-session/03-UAT.md` Gaps; ROADMAP.md Phase 8.", projectId: PROJECT_IDS.P8, milestoneKey: "8.2", stateId: STATE_IDS.Backlog, priority: 3, labels: ["Requirement", "Feature", "Deferred"] },
  { title: "F17-UI: Set-typ-toggling under aktivt pass", description: "Toggle warmup/working/dropset/failure per set under aktivt pass.\n\n**Acceptans:**\n- Schema redo sedan Phase 2 (`exercise_sets.set_type` ENUM)\n- UI: chip/toggle på set-rad eller long-press-meny\n- F7 last-value-query MÅSTE fortsatt filtrera `set_type = 'working'`\n- F10 graf MÅSTE fortsatt filtrera `set_type = 'working'`\n\n**Källa:** PRD §F17 (UI-del — schema deferred sedan PROJECT.md 2026-05-07), ROADMAP.md Phase 8.", projectId: PROJECT_IDS.P8, milestoneKey: "8.3", stateId: STATE_IDS.Backlog, priority: 4, labels: ["Requirement", "Feature", "UI", "Deferred"] },
  { title: "F18: PR-detection vid pass-avslut", description: "Vid Avsluta-pass: detektera PR per övning (Epley `w * (1 + r/30)`, max-vikt, max-volym) och visa highlight.\n\n**Acceptans:**\n- Epley-formel implementerad: estimated 1RM = `w * (1 + r/30)`\n- Detection per övning per pass\n- UI: toast/badge på Avsluta-flow + i historik\n\n**Källa:** REQUIREMENTS.md V1.1 §Differentiators, PRD §F18.", projectId: PROJECT_IDS.P8, milestoneKey: "8.4", stateId: STATE_IDS.Backlog, priority: 4, labels: ["Requirement", "Feature", "Deferred"] },
  { title: "F19: Vilo-timer (research-flag)", description: "Vilo-timer auto-triggas vid 'Klart'-tap.\n\n**Tech (research-flag):**\n- `expo-notifications`: trigger notif efter X sek\n- `expo-keep-awake`: håll skärm vaken under aktivt pass\n- JS-suspension-trap (Pitfall 6.5) — timer dör om JS suspendar\n\n**Acceptans:**\n- Default-tid configurable\n- Notifications-permission-flow (M5 — soft-prompt först)\n- Survives backgrounding (eller acceptera trade-off)\n\n**Källa:** REQUIREMENTS.md V1.1 §Polish, PRD §F19, ROADMAP.md research-flag.", projectId: PROJECT_IDS.P8, milestoneKey: "8.5", stateId: STATE_IDS.Backlog, priority: 4, labels: ["Requirement", "Feature", "Deferred"] },

  // ─── V2 — Open (11 per requirement, men 4 är bundlade i milestones) ────────
  { title: "F20: Förladdat globalt övningsbibliotek", description: "Curation-arbete: namn, muskelgrupper, utrustning, ev. i18n. Schema tillåter `null user_id` så global seed kan adderas i V2 utan migration.\n\n**Källa:** REQUIREMENTS.md V2 §App Store-blockers, PRD §F20.", projectId: PROJECT_IDS.V2, milestoneKey: "V2.1", stateId: STATE_IDS.Backlog, priority: 4, labels: ["Requirement", "Feature", "Deferred"] },
  { title: "F21: EAS Build + TestFlight pipeline (research-flag)", description: "Research-flag: credential-flow på Windows-only dev environment.\n\n**Källa:** REQUIREMENTS.md V2 §App Store-blockers, PRD §F21.", projectId: PROJECT_IDS.V2, milestoneKey: "V2.2", stateId: STATE_IDS.Backlog, priority: 4, labels: ["Requirement", "Infrastructure", "Deferred"] },
  { title: "F22: Plan-scoped 'förra värdet' (inte global per övning)", description: "F7 förbättring: 'förra värdet' specifikt per plan/pass-kombination istället för bara global per övning.\n\n**Källa:** REQUIREMENTS.md V2 §Differentiators, PRD §F22.", projectId: PROJECT_IDS.V2, milestoneKey: "V2.3", stateId: STATE_IDS.Backlog, priority: 4, labels: ["Requirement", "Feature", "Deferred"] },
  { title: "F23: 'Repeat last session' CTA på hemskärm", description: "Snabbgenväg från hemskärm: 'Repetera senaste passet' → starta pass från senaste plan med pre-fyllda förslag.\n\n**Källa:** REQUIREMENTS.md V2 §Differentiators, PRD §F23.", projectId: PROJECT_IDS.V2, milestoneKey: "V2.3", stateId: STATE_IDS.Backlog, priority: 4, labels: ["Requirement", "Feature", "Deferred"] },
  { title: "F24: Synlig sync-state-badge ('3 sets pending sync')", description: "Pending-count på OfflineBanner. V1 är binär (online/offline); V2 visar mer information.\n\n**Källa:** REQUIREMENTS.md V2 §Differentiators, PRD §F24.", projectId: PROJECT_IDS.V2, milestoneKey: "V2.3", stateId: STATE_IDS.Backlog, priority: 4, labels: ["Requirement", "UI", "Deferred"] },
  { title: "F25: Apple Health-integration (research-flag)", description: "Sync workouts till Apple Health. Research-flag på integration scope.\n\n**Källa:** REQUIREMENTS.md V2 §Integrationer, PRD §F25.", projectId: PROJECT_IDS.V2, milestoneKey: "V2.4", stateId: STATE_IDS.Backlog, priority: 4, labels: ["Requirement", "Feature", "Deferred"] },
  { title: "F26: Hemskärms-widgets", description: "iOS Home Screen widgets för 'Repeat last' eller PR-stats.\n\n**Källa:** REQUIREMENTS.md V2 §Integrationer, PRD §F26.", projectId: PROJECT_IDS.V2, milestoneKey: "V2.4", stateId: STATE_IDS.Backlog, priority: 4, labels: ["Requirement", "Feature", "Deferred"] },
  { title: "F27: CSV-export", description: "Export av träningshistorik till CSV.\n\n**Källa:** REQUIREMENTS.md V2 §Integrationer, PRD §F27.", projectId: PROJECT_IDS.V2, milestoneKey: "V2.4", stateId: STATE_IDS.Backlog, priority: 4, labels: ["Requirement", "Feature", "Deferred"] },
  { title: "F28: Web-app (samma backend)", description: "Web-frontend mot samma Supabase-backend.\n\n**Källa:** REQUIREMENTS.md V2 §Integrationer, PRD §F28.", projectId: PROJECT_IDS.V2, milestoneKey: "V2.4", stateId: STATE_IDS.Backlog, priority: 4, labels: ["Requirement", "Feature", "Deferred"] },
  { title: "F29: Android-version", description: "Expo-prebuild för Android. iPhone-fokus i V1/V1.1; V2 utvärderar Android.\n\n**Källa:** REQUIREMENTS.md V2 §Integrationer, PRD §F29.", projectId: PROJECT_IDS.V2, milestoneKey: "V2.4", stateId: STATE_IDS.Backlog, priority: 4, labels: ["Requirement", "Feature", "Deferred"] },
  { title: "F30: Programmeringsmallar (5/3/1, PPL, Upper/Lower)", description: "Curated workout programs som mallar.\n\n**Källa:** REQUIREMENTS.md V2 §Integrationer, PRD §F30.", projectId: PROJECT_IDS.V2, milestoneKey: "V2.4", stateId: STATE_IDS.Backlog, priority: 4, labels: ["Requirement", "Feature", "Deferred"] },
];

// ─── Befintliga FIT-issues att länka till rätt Project ────────────────────────
type LinkSpec = { identifier: string; projectId: string; milestoneKey?: keyof typeof MILESTONE_IDS; labels: Array<keyof typeof LABEL_IDS> };
const LINK_EXISTING: LinkSpec[] = [
  { identifier: "FIT-5", projectId: PROJECT_IDS.P3, milestoneKey: "3.1", labels: ["Bug"] }, // Sign up bug
  { identifier: "FIT-6", projectId: PROJECT_IDS.P4, milestoneKey: "4.1", labels: ["Bug", "UI"] }, // plan edit bug
  { identifier: "FIT-7", projectId: PROJECT_IDS.P5, milestoneKey: "5.6", labels: ["GapClosure"] },
  { identifier: "FIT-8", projectId: PROJECT_IDS.P5, milestoneKey: "5.5", labels: ["GapClosure"] },
  { identifier: "FIT-9", projectId: PROJECT_IDS.P5, milestoneKey: "5.2", labels: ["GapClosure"] },
  { identifier: "FIT-10", projectId: PROJECT_IDS.P5, milestoneKey: "5.5", labels: ["GapClosure"] },
  { identifier: "FIT-11", projectId: PROJECT_IDS.P1, milestoneKey: undefined, labels: ["Bug", "Infrastructure"] }, // CI title prefix
  { identifier: "FIT-12", projectId: PROJECT_IDS.P2, milestoneKey: "2.3", labels: ["Bug", "Infrastructure"] }, // test:rls race
  { identifier: "FIT-13", projectId: PROJECT_IDS.P5, milestoneKey: "5.3", labels: ["Bug", "GapClosure"] }, // last-value fixture
  { identifier: "FIT-14", projectId: PROJECT_IDS.P5, milestoneKey: "5.5", labels: ["Bug", "UI"] }, // banner reflash
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function findIssueByTitle(apiKey: string, title: string) {
  const data = await gql<{
    issues: { nodes: Array<{ id: string; identifier: string; title: string }> };
  }>(
    apiKey,
    `query($q: String!) { issues(filter: { title: { eq: $q } }, first: 10) { nodes { id identifier title } } }`,
    { q: title },
  );
  return data.issues.nodes[0] ?? null;
}

async function findIssueByIdentifier(apiKey: string, identifier: string) {
  const data = await gql<{
    issue: { id: string; identifier: string; title: string; labels: { nodes: Array<{ id: string }> } } | null;
  }>(
    apiKey,
    `query($id: String!) { issue(id: $id) { id identifier title labels { nodes { id } } } }`,
    { id: identifier },
  );
  return data.issue;
}

async function createIssue(apiKey: string, spec: IssueSpec) {
  const existing = await findIssueByTitle(apiKey, spec.title);
  if (existing) {
    console.log(`   → ${existing.identifier} — ${spec.title} (existing)`);
    return existing.id;
  }
  const input: Record<string, unknown> = {
    teamId: TEAM_ID,
    title: spec.title,
    description: spec.description,
    projectId: spec.projectId,
    stateId: spec.stateId,
    priority: spec.priority,
    labelIds: spec.labels.map((l) => LABEL_IDS[l]),
  };
  if (spec.milestoneKey) input.projectMilestoneId = MILESTONE_IDS[spec.milestoneKey];
  const res = await gql<{
    issueCreate: { success: boolean; issue: { id: string; identifier: string } };
  }>(
    apiKey,
    `mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier } } }`,
    { input },
  );
  console.log(`   ✓ ${res.issueCreate.issue.identifier} — ${spec.title} (created)`);
  return res.issueCreate.issue.id;
}

async function updateExistingIssue(apiKey: string, link: LinkSpec) {
  const issue = await findIssueByIdentifier(apiKey, link.identifier);
  if (!issue) {
    console.log(`   ⚠ ${link.identifier} — inte funnen, skippar`);
    return;
  }
  const existingLabelIds = issue.labels.nodes.map((l) => l.id);
  const newLabelIds = link.labels.map((l) => LABEL_IDS[l]);
  const mergedLabels = Array.from(new Set([...existingLabelIds, ...newLabelIds]));

  const input: Record<string, unknown> = {
    projectId: link.projectId,
    labelIds: mergedLabels,
  };
  if (link.milestoneKey) input.projectMilestoneId = MILESTONE_IDS[link.milestoneKey];

  await gql<{ issueUpdate: { success: boolean } }>(
    apiKey,
    `mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }`,
    { id: issue.id, input },
  );
  console.log(`   ✓ ${link.identifier} — länkad till project + milestone`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    console.error("❌ LINEAR_API_KEY saknas i app/.env.local");
    process.exit(1);
  }

  console.log("\n🚀 Linear Issues Setup — Steg 3 av 3\n");

  console.log(`📚 Backfill — ${BACKFILL_ISSUES.length} closed plan-issues:`);
  for (const spec of BACKFILL_ISSUES) await createIssue(apiKey, spec);

  console.log(`\n🆕 Forward — ${FORWARD_ISSUES.length} open requirement-issues:`);
  for (const spec of FORWARD_ISSUES) await createIssue(apiKey, spec);

  console.log(`\n🔗 Reorganisera befintliga issues — ${LINK_EXISTING.length} länkningar:`);
  for (const link of LINK_EXISTING) await updateExistingIssue(apiKey, link);

  console.log("\n✅ Issues klara.\n");
}

main().catch((err) => {
  console.error("\n❌ Fel:", err);
  process.exit(1);
});
