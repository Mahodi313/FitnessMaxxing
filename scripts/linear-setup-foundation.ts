#!/usr/bin/env -S tsx --env-file=app/.env.local
/**
 * linear-setup-foundation.ts — Steg 1 av 3
 *
 * Skapar Labels + Initiatives + Projects (idempotent via name-lookup).
 * Skriver ut alla ID:n så följande skript kan slå upp dem på namn.
 *
 * Körs en gång; körs igen utan biverkning (rapporterar "→ Found existing").
 */

const API = "https://api.linear.app/graphql";
const TEAM_KEY = "FIT";

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

// ─── DATA — Labels ────────────────────────────────────────────────────────────
const LABELS = [
  { name: "Bug", color: "#EB5757" },
  { name: "Feature", color: "#5E6AD2" },
  { name: "Tech Debt", color: "#F2C94C" },
  { name: "Deferred", color: "#828282" },
  { name: "UI", color: "#BB87FC" },
  { name: "Plan", color: "#26B5CE" },
  { name: "Requirement", color: "#26C281" },
  { name: "Gap-Closure", color: "#FF6F61" },
  { name: "Infrastructure", color: "#95A5A6" },
];

// ─── DATA — Initiatives ───────────────────────────────────────────────────────
const INITIATIVES = [
  {
    name: "V1.0 MVP — Personal Use",
    description:
      "Personlig gym-tracker körbar via Expo Go på iPhone. Mål: V1 körbar inom 4–6 veckors kvälls-/helgarbete + 4-veckors personlig soak. Core Value: logga ett set och omedelbart se senaste värdet — utan att tappa data, någonsin. Faser 1–7.",
  },
  {
    name: "V1.1 — Polish & TestFlight Prep",
    description:
      "Features som möjliggör App Store-launch men ännu körs personligt. Apple Sign-In, email-confirmation deep-link, vilo-timer (research-flag), PR-detection, set-typ-UI. Phase 8.",
  },
  {
    name: "V2.0 — App Store Launch",
    description:
      "Public App Store launch. Förladdat globalt övningsbibliotek, EAS Build + TestFlight, differentiators (plan-scoped F7, repeat-last, sync-badge), Apple Health, widgets, CSV, web, Android. Phase 9+.",
  },
];

// ─── DATA — Projects (per fas) ────────────────────────────────────────────────
type ProjectSpec = {
  name: string;
  description: string;
  initiative: string;
  state: "completed" | "started" | "planned";
  startDate?: string;
  targetDate?: string;
  completedAt?: string;
};

const PROJECTS: ProjectSpec[] = [
  {
    name: "Phase 1 — Bootstrap & Infra Hardening",
    description:
      "Lokad stack installerad med rätt pins, NativeWind smoke-test renderar på iPhone, dark-mode-konvention etablerad. **Requirements**: F15 (konvention).\n\nSe `.planning/phases/01-bootstrap-infra-hardening/`.",
    initiative: "V1.0 MVP — Personal Use",
    state: "completed",
    startDate: "2026-05-07",
    completedAt: "2026-05-08",
  },
  {
    name: "Phase 2 — Schema, RLS & Type Generation",
    description:
      "Korrigerat schema applicerat i Supabase med både `using` och `with check`, cross-user-fixturer passerar (22/22), TS-typer genererade, 27/27 SECURED. **Requirements**: F17 schema-only.",
    initiative: "V1.0 MVP — Personal Use",
    state: "completed",
    startDate: "2026-05-08",
    completedAt: "2026-05-09",
  },
  {
    name: "Phase 3 — Auth & Persistent Session",
    description:
      "Användare kan registrera, logga in, och sessioner överlever app-restart via LargeSecureStore. **Requirements**: F1.",
    initiative: "V1.0 MVP — Personal Use",
    state: "completed",
    startDate: "2026-05-08",
    completedAt: "2026-05-09",
  },
  {
    name: "Phase 4 — Plans, Exercises & Offline-Queue Plumbing",
    description:
      "Användare skapar planer och övningar offline; airplane-mode-test bekräftar att kön persisterar och replayas korrekt. Etablerar TanStack-offline-plumbing som Phase 5 ärver. **Requirements**: F2, F3, F4.",
    initiative: "V1.0 MVP — Personal Use",
    state: "completed",
    startDate: "2026-05-09",
    completedAt: "2026-05-10",
  },
  {
    name: "Phase 5 — Active Workout Hot Path (F13 lives or dies)",
    description:
      "Användare loggar set under pass; varje set överlever airplane mode + force-quit + battery-pull. F13-löftet 'får ALDRIG förlora ett set' lever eller dör här. **Requirements**: F5, F6, F7, F8, F13.",
    initiative: "V1.0 MVP — Personal Use",
    state: "completed",
    startDate: "2026-05-10",
    completedAt: "2026-05-14",
  },
  {
    name: "Phase 6 — History & Read-Side Polish",
    description:
      "Användare ser passhistorik och progressionsgraf per övning. Read-side surfaces för F9 + F10 med victory-native CartesianChart. Helt offline-tolerant via existerande TanStack-persister. **Requirements**: F9, F10.",
    initiative: "V1.0 MVP — Personal Use",
    state: "planned",
    startDate: "2026-05-15",
  },
  {
    name: "Phase 7 — V1 Polish Cut",
    description:
      "RPE, anteckningar och dark-mode-toggle färdiga; V1 redo för 4-veckors personlig validering. **Requirements**: F11, F12, F15-toggle.",
    initiative: "V1.0 MVP — Personal Use",
    state: "planned",
  },
  {
    name: "Phase 8 — V1.1 App Store Pre-Work",
    description:
      "Features som möjliggör App Store-launch men ännu körs personligt. Apple Sign-In, email-confirmation deep-link, vilo-timer (research-flag), PR-detection, set-typ-UI. **Requirements**: F14, F1.1, F17-UI, F18, F19.",
    initiative: "V1.1 — Polish & TestFlight Prep",
    state: "planned",
  },
  {
    name: "V2.0 — App Store Launch",
    description:
      "Public App Store launch. Förladdat övningsbibliotek, EAS Build + TestFlight, differentiators (plan-scoped F7, repeat-last, sync-badge), integrationer (Health, widgets, CSV, web, Android). **Reqs**: F20–F30.",
    initiative: "V2.0 — App Store Launch",
    state: "planned",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getTeamId(apiKey: string): Promise<string> {
  const data = await gql<{ teams: { nodes: Array<{ id: string; key: string }> } }>(
    apiKey,
    `query { teams { nodes { id key } } }`,
  );
  const team = data.teams.nodes.find((t) => t.key === TEAM_KEY);
  if (!team) throw new Error(`Team ${TEAM_KEY} hittades inte`);
  return team.id;
}

async function upsertLabel(apiKey: string, teamId: string, name: string, color: string) {
  // Linear forbids duplicate label names across workspace + team scope, so we
  // look at every label (no team filter) and reuse any existing match.
  const list = await gql<{ issueLabels: { nodes: Array<{ id: string; name: string }> } }>(
    apiKey,
    `query { issueLabels { nodes { id name } } }`,
  );
  const existing = list.issueLabels.nodes.find((l) => l.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    console.log(`   → ${name} (existing) — id=${existing.id}`);
    return existing.id;
  }
  const res = await gql<{ issueLabelCreate: { success: boolean; issueLabel: { id: string; name: string } } }>(
    apiKey,
    `mutation($input: IssueLabelCreateInput!) { issueLabelCreate(input: $input) { success issueLabel { id name } } }`,
    { input: { teamId, name, color } },
  );
  console.log(`   ✓ ${name} (created) — id=${res.issueLabelCreate.issueLabel.id}`);
  return res.issueLabelCreate.issueLabel.id;
}

async function upsertInitiative(apiKey: string, name: string, description: string) {
  const list = await gql<{ initiatives: { nodes: Array<{ id: string; name: string }> } }>(
    apiKey,
    `query { initiatives { nodes { id name } } }`,
  );
  const existing = list.initiatives.nodes.find((i) => i.name === name);
  if (existing) {
    console.log(`   → ${name} (existing) — id=${existing.id}`);
    return existing.id;
  }
  const res = await gql<{ initiativeCreate: { success: boolean; initiative: { id: string; name: string } } }>(
    apiKey,
    `mutation($input: InitiativeCreateInput!) { initiativeCreate(input: $input) { success initiative { id name } } }`,
    { input: { name, description } },
  );
  console.log(`   ✓ ${name} (created) — id=${res.initiativeCreate.initiative.id}`);
  return res.initiativeCreate.initiative.id;
}

async function upsertProject(
  apiKey: string,
  teamId: string,
  initiativeId: string,
  spec: ProjectSpec,
) {
  const list = await gql<{
    projects: { nodes: Array<{ id: string; name: string }> };
  }>(apiKey, `query { projects { nodes { id name } } }`);
  const existing = list.projects.nodes.find((p) => p.name === spec.name);
  if (existing) {
    console.log(`   → ${spec.name} (existing) — id=${existing.id}`);
    return existing.id;
  }

  const input: Record<string, unknown> = {
    name: spec.name,
    description: spec.description,
    teamIds: [teamId],
    state: spec.state,
  };
  if (spec.startDate) input.startDate = spec.startDate;
  if (spec.targetDate) input.targetDate = spec.targetDate;

  const res = await gql<{ projectCreate: { success: boolean; project: { id: string; name: string } } }>(
    apiKey,
    `mutation($input: ProjectCreateInput!) { projectCreate(input: $input) { success project { id name } } }`,
    { input },
  );
  const projectId = res.projectCreate.project.id;

  // Link project to initiative
  await gql<{ initiativeToProjectCreate: { success: boolean } }>(
    apiKey,
    `mutation($input: InitiativeToProjectCreateInput!) { initiativeToProjectCreate(input: $input) { success } }`,
    { input: { initiativeId, projectId } },
  );

  console.log(`   ✓ ${spec.name} (created, linked to initiative) — id=${projectId}`);
  return projectId;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    console.error("❌ LINEAR_API_KEY saknas i app/.env.local");
    process.exit(1);
  }

  console.log("\n🚀 Linear Foundation Setup — Steg 1 av 3\n");

  const teamId = await getTeamId(apiKey);
  console.log(`📋 Team FIT — id=${teamId}`);

  console.log("\n🏷️  Labels:");
  const labelIds: Record<string, string> = {};
  for (const l of LABELS) {
    labelIds[l.name] = await upsertLabel(apiKey, teamId, l.name, l.color);
  }

  console.log("\n🎯 Initiatives:");
  const initiativeIds: Record<string, string> = {};
  for (const i of INITIATIVES) {
    initiativeIds[i.name] = await upsertInitiative(apiKey, i.name, i.description);
  }

  console.log("\n📦 Projects (länkas till initiatives):");
  const projectIds: Record<string, string> = {};
  for (const p of PROJECTS) {
    const initId = initiativeIds[p.initiative];
    if (!initId) throw new Error(`Initiative '${p.initiative}' inte funnen för project '${p.name}'`);
    projectIds[p.name] = await upsertProject(apiKey, teamId, initId, p);
  }

  console.log("\n✅ Foundation klar. Spara ID:n för nästa skript:");
  console.log("\nexport const PROJECT_IDS = {");
  for (const [name, id] of Object.entries(projectIds)) {
    console.log(`  ${JSON.stringify(name)}: ${JSON.stringify(id)},`);
  }
  console.log("};");
  console.log("\nexport const LABEL_IDS = {");
  for (const [name, id] of Object.entries(labelIds)) {
    console.log(`  ${JSON.stringify(name)}: ${JSON.stringify(id)},`);
  }
  console.log("};\n");
}

main().catch((err) => {
  console.error("\n❌ Fel:", err);
  process.exit(1);
});
