#!/usr/bin/env -S tsx --env-file=app/.env.local
/**
 * linear-setup-milestones.ts — Steg 2 av 3
 *
 * Skapar 44 milestones (success criteria från ROADMAP.md) per Project.
 * Idempotent via name-lookup inom samma Project.
 */

const API = "https://api.linear.app/graphql";

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

// ─── Project IDs från linear-setup-foundation.ts output ───────────────────────
const PROJECT_IDS: Record<string, string> = {
  "Phase 1 — Bootstrap & Infra Hardening": "800c89e1-15fb-47f9-8576-345074469b04",
  "Phase 2 — Schema, RLS & Type Generation": "3090e625-d424-48f9-a90f-9e6bb93165b4",
  "Phase 3 — Auth & Persistent Session": "758f5c55-75b3-4f05-ae50-3f09158adeb0",
  "Phase 4 — Plans, Exercises & Offline-Queue Plumbing": "73390d56-a521-4a4d-bf27-c010f32d4b0e",
  "Phase 5 — Active Workout Hot Path (F13 lives or dies)": "f1d53d22-220a-4c10-be22-a3ed68198c35",
  "Phase 6 — History & Read-Side Polish": "761c6e89-3134-41f0-9efe-58485d5b1fcf",
  "Phase 7 — V1 Polish Cut": "9ebc0d6a-a56e-4e7b-8d50-fecc8e41a4f9",
  "Phase 8 — V1.1 App Store Pre-Work": "a149e14e-4c3c-498a-b0ca-f979cb4b45d0",
  "V2.0 — App Store Launch": "39b3d779-6222-425b-9c67-7a2cf1c27fe6",
};

// ─── DATA — Milestones per Project ────────────────────────────────────────────
type Milestone = { name: string; description: string };

const MILESTONES: Record<string, Milestone[]> = {
  "Phase 1 — Bootstrap & Infra Hardening": [
    { name: "1.1 — NativeWind smoke-test renderar på iPhone", description: "App startar utan röd skärm; 'Hello FitnessMaxxing' med Tailwind-klasser (`text-2xl text-blue-500`)." },
    { name: "1.2 — Dark-mode konvention etablerad", description: "`tailwind.config.js` har `darkMode: 'class'`; `dark:`-varianter används från start (F15-konvention)." },
    { name: "1.3 — expo-doctor 0 fel + npx expo install discipline", description: "Alla native-paket installerade via `npx expo install` (inte `npm install`)." },
    { name: "1.4 — .env.local + EXPO_PUBLIC_SUPABASE_* prefix", description: "`.env.local` gitignored; `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` läses korrekt i appen." },
    { name: "1.5 — Reanimated 4.1 babel-plugin utan dubbletter", description: "Ingen 'Duplicate plugin/preset detected'-varning i Metro." },
  ],
  "Phase 2 — Schema, RLS & Type Generation": [
    { name: "2.1 — 6 tabeller med RLS aktiverat", description: "`profiles`, `exercises`, `workout_plans`, `plan_exercises`, `workout_sessions`, `exercise_sets` finns i Supabase med RLS påslagen." },
    { name: "2.2 — RLS using + with check + wrapped auth.uid()", description: "ARCHITECTURE.md §4 errata fixad: båda klausuler på alla skrivbara tabeller; `(select auth.uid())`-wrap för query-plan-caching." },
    { name: "2.3 — Cross-user isolation bevisad (22/22)", description: "`app/scripts/test-rls.ts`: User B kan inte läsa/skriva User A:s planer, övningar, pass eller set." },
    { name: "2.4 — exercise_sets.set_type ENUM (F17 schema-only)", description: "Postgres ENUM working/warmup/dropset/failure med default 'working'. UI deferred till V1.1." },
    { name: "2.5 — gen:types rent + 27/27 SECURED", description: "`types/database.ts` matchar applicerat schema; TS-kompileringen ren. SECURITY threats_open: 0." },
  ],
  "Phase 3 — Auth & Persistent Session": [
    { name: "3.1 — Email/lösen-registrering + bekräftelse", description: "Sign-up från `(auth)/sign-up.tsx`. Email-bekräftelse krävs (Studio toggle ON); deep-link defererad till V1.1." },
    { name: "3.2 — Sign-in med Zod-validation + svenska felmeddelanden", description: "RHF + Zod 4 inline-fel vid submit. Mode ändrad från `onBlur` till submit-only under verification." },
    { name: "3.3 — Session persistens via LargeSecureStore", description: "Sign-in → kill app → reopen → session återställd; LargeSecureStore round-trip funkar." },
    { name: "3.4 — Sign-out + queryClient.clear()", description: "Sign-out tar till `(auth)/sign-in.tsx` och rensar per-user cache." },
    { name: "3.5 — Stack.Protected + (app) Redirect-guard", description: "`Stack.Protected guard={!!session}` + `<Redirect>` i `(app)/_layout.tsx` hindrar protected screens från att flicker-rendera." },
  ],
  "Phase 4 — Plans, Exercises & Offline-Queue Plumbing": [
    { name: "4.1 — F2 plan-CRUD med optimistic updates", description: "Skapa/redigera/arkivera planer från `(tabs)/index.tsx`; ändringar visas omedelbart." },
    { name: "4.2 — F3 egna övningar (chained create-and-add)", description: "Övningar med namn, muscle group, equipment, notes via exercise-picker chained scope.id." },
    { name: "4.3 — F4 drag-att-ordna via DraggableFlatList", description: "Two-phase negative-bridge reorder; ny ordning persisterar offline." },
    { name: "4.4 — Airplane-mode-test passerar", description: "Airplane → skapa plan + 3 övningar + reorder → force-quit → reconnect → alla rader landar i Supabase utan FK-fel eller dubbletter." },
    { name: "4.5 — OfflineBanner triggar på NetInfo", description: "Banner visas när `isConnected: false`; försvinner online; ✕ close-affordance." },
  ],
  "Phase 5 — Active Workout Hot Path (F13 lives or dies)": [
    { name: "5.1 — F5 Starta pass skapar workout_sessions omedelbart", description: "Tap 'Starta pass' → `workout_sessions`-rad direkt (inte vid Avsluta)." },
    { name: "5.2 — F6 ≤3s set-log + per-set persistens", description: "`useAddSet` med `scope.id='session:<id>'`; ingen 'save on finish'." },
    { name: "5.3 — F7 set-position-aligned senaste värde", description: "'Förra: set 1: 82.5kg × 8' inte bara global senaste-värde." },
    { name: "5.4 — F8 Avsluta utan Discard-knapp", description: "`finished_at` sätts; tillbaka till hem; data-loss-vector eliminerad." },
    { name: "5.5 — Draft-session-recovery vid kall-start", description: "'Återuppta passet?' overlay om `workout_sessions WHERE finished_at IS NULL` finns." },
    { name: "5.6 — F13 25-set brutal-test acceptance", description: "Airplane + force-quit + battery-pull under 25-set-pass = alla 25 set överlever och synkar i rätt ordning vid återanslutning." },
  ],
  "Phase 6 — History & Read-Side Polish": [
    { name: "6.1 — F9 Cursor-paginerad historik-lista", description: "`(tabs)/history.tsx` sorterad på `started_at desc`. Read-side surface för F9." },
    { name: "6.2 — Öppna pass → alla set per övning", description: "Read-only render av ett avslutat pass. Återanvänder Phase 5 card-layout." },
    { name: "6.3 — F10 graf via CartesianChart (memoiserad)", description: "Max vikt eller total volym över tid per övning via victory-native; data memoiserad så grafen inte re-mountar." },
    { name: "6.4 — Historik-listan funkar offline", description: "TanStack Query-cache hydrerad från AsyncStorage (Phase 4/5 persister)." },
  ],
  "Phase 7 — V1 Polish Cut": [
    { name: "7.1 — F11 RPE-fält per set (optional)", description: "RPE 1-10 per set; tomt → null. Schema redo sedan Phase 2." },
    { name: "7.2 — F12 Anteckningar per pass", description: "Textanteckningar per pass; visas i historik-vyn (Phase 6 integration)." },
    { name: "7.3 — F15-toggle dark-mode i Settings", description: "Manuell toggle persisterad via expo-secure-store eller AsyncStorage. Konvention finns sedan Phase 1." },
    { name: "7.4 — Kärnflöde ≤2 min utan fel", description: "Skapa plan → starta pass → logga set → avsluta → se historik = ≤2 min reproducerbart." },
    { name: "7.5 — V1 redo för 4-veckors soak", description: "PRD §8-kriterier: 1 bug/vecka eller färre; alla pass loggade utan papper." },
  ],
  "Phase 8 — V1.1 App Store Pre-Work": [
    { name: "8.1 — F14 Apple Sign-In", description: "App Store-blocker. Apple Identity provider via Supabase Auth." },
    { name: "8.2 — F1.1 Email-confirmation deep-link", description: "Carry-over från Phase 3. Expo Linking API + Supabase `verifyOtp`/`exchangeCodeForSession`. Universal Links vs custom scheme `fitnessmaxxing://`." },
    { name: "8.3 — F17-UI Set-typ-toggling", description: "Toggle warmup/working/dropset/failure under aktivt pass. Schema redo sedan Phase 2." },
    { name: "8.4 — F18 PR-detection vid pass-avslut", description: "Epley `w * (1 + r/30)`, max-vikt, max-volym per övning." },
    { name: "8.5 — F19 Vilo-timer auto-trigger", description: "`expo-notifications` + `expo-keep-awake` (research-flag, JS-suspension-trap)." },
  ],
  "V2.0 — App Store Launch": [
    { name: "V2.1 — F20 Förladdat globalt övningsbibliotek", description: "Curation: namn, muskelgrupper, utrustning, ev. i18n. Schema tillåter `null user_id`." },
    { name: "V2.2 — F21 EAS Build + TestFlight pipeline", description: "Research-flag: credential-flow på Windows-only dev." },
    { name: "V2.3 — F22-F24 Differentiators", description: "Plan-scoped F7, 'Repeat last session' CTA, synlig sync-state-badge med pending-count." },
    { name: "V2.4 — F25-F30 Integrationer", description: "Apple Health, hemskärms-widgets, CSV-export, web-app, Android, programmeringsmallar (5/3/1, PPL, Upper/Lower)." },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function listMilestonesForProject(apiKey: string, projectId: string) {
  const data = await gql<{
    project: { projectMilestones: { nodes: Array<{ id: string; name: string }> } } | null;
  }>(
    apiKey,
    `query($id: String!) { project(id: $id) { projectMilestones { nodes { id name } } } }`,
    { id: projectId },
  );
  return data.project?.projectMilestones.nodes ?? [];
}

async function upsertMilestone(apiKey: string, projectId: string, m: Milestone) {
  const existing = (await listMilestonesForProject(apiKey, projectId)).find((x) => x.name === m.name);
  if (existing) {
    console.log(`     → ${m.name} (existing) — id=${existing.id}`);
    return existing.id;
  }
  const res = await gql<{
    projectMilestoneCreate: { success: boolean; projectMilestone: { id: string; name: string } };
  }>(
    apiKey,
    `mutation($input: ProjectMilestoneCreateInput!) { projectMilestoneCreate(input: $input) { success projectMilestone { id name } } }`,
    { input: { projectId, name: m.name, description: m.description } },
  );
  console.log(`     ✓ ${m.name} (created) — id=${res.projectMilestoneCreate.projectMilestone.id}`);
  return res.projectMilestoneCreate.projectMilestone.id;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    console.error("❌ LINEAR_API_KEY saknas i app/.env.local");
    process.exit(1);
  }

  console.log("\n🚀 Linear Milestone Setup — Steg 2 av 3\n");

  const milestoneIds: Record<string, Record<string, string>> = {};
  for (const [projectName, projectId] of Object.entries(PROJECT_IDS)) {
    const ms = MILESTONES[projectName] ?? [];
    if (ms.length === 0) {
      console.log(`\n📦 ${projectName}: (inga milestones)`);
      continue;
    }
    console.log(`\n📦 ${projectName}:`);
    milestoneIds[projectName] = {};
    for (const m of ms) {
      milestoneIds[projectName][m.name] = await upsertMilestone(apiKey, projectId, m);
    }
  }

  console.log("\n✅ Milestones klara.\n");

  // Skriv ut alla ID:n så nästa skript kan slå upp dem på Project+Milestone-namn.
  console.log("export const MILESTONE_IDS: Record<string, Record<string, string>> = {");
  for (const [projectName, ms] of Object.entries(milestoneIds)) {
    console.log(`  ${JSON.stringify(projectName)}: {`);
    for (const [mName, id] of Object.entries(ms)) {
      console.log(`    ${JSON.stringify(mName)}: ${JSON.stringify(id)},`);
    }
    console.log(`  },`);
  }
  console.log("};");
}

main().catch((err) => {
  console.error("\n❌ Fel:", err);
  process.exit(1);
});
