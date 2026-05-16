#!/usr/bin/env -S tsx --env-file=app/.env.local
/**
 * linear-introspect.ts
 *
 * Read-only audit av befintlig Linear-state innan vi börjar bygga
 * Initiatives + Projects + Milestones. Skriver ut allt vi behöver veta för
 * att undvika dubbletter i nästa steg (linear-bootstrap-roadmap.ts).
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

async function main() {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    console.error("❌ LINEAR_API_KEY saknas i app/.env.local");
    process.exit(1);
  }

  // 1. Teams
  const teams = await gql<{ teams: { nodes: Array<{ id: string; name: string; key: string }> } }>(
    apiKey,
    `query { teams { nodes { id name key } } }`,
  );
  const team = teams.teams.nodes.find((t) => t.key === "FIT");
  if (!team) {
    console.error("❌ FIT-team hittades inte");
    process.exit(1);
  }
  console.log(`\n📋 Team: ${team.name} (${team.key}) — id=${team.id}\n`);

  // 2. Initiatives (workspace-scoped)
  const initiatives = await gql<{
    initiatives: { nodes: Array<{ id: string; name: string; status: string }> };
  }>(apiKey, `query { initiatives { nodes { id name status } } }`);
  console.log(`🎯 Initiatives (${initiatives.initiatives.nodes.length}):`);
  for (const i of initiatives.initiatives.nodes) {
    console.log(`   - ${i.name} [${i.status}] — id=${i.id}`);
  }

  // 3. Projects (team-scoped)
  const projects = await gql<{
    projects: {
      nodes: Array<{
        id: string;
        name: string;
        state: string;
        progress: number;
        projectMilestones: { nodes: Array<{ id: string; name: string }> };
      }>;
    };
  }>(
    apiKey,
    `query { projects { nodes { id name state progress projectMilestones { nodes { id name } } } } }`,
  );
  console.log(`\n📦 Projects (${projects.projects.nodes.length}):`);
  for (const p of projects.projects.nodes) {
    console.log(`   - ${p.name} [${p.state}, ${Math.round(p.progress * 100)}%] — id=${p.id}`);
    for (const m of p.projectMilestones.nodes) {
      console.log(`       • ${m.name} — id=${m.id}`);
    }
  }

  // 4. Labels
  const labels = await gql<{
    issueLabels: { nodes: Array<{ id: string; name: string }> };
  }>(
    apiKey,
    `query($teamId: ID!) { issueLabels(filter: { team: { id: { eq: $teamId } } }) { nodes { id name } } }`,
    { teamId: team.id },
  );
  console.log(`\n🏷️  Labels (${labels.issueLabels.nodes.length}):`);
  for (const l of labels.issueLabels.nodes) {
    console.log(`   - ${l.name} — id=${l.id}`);
  }

  // 5. Workflow states (för status-mapping, t.ex. Closed/Done)
  const states = await gql<{
    workflowStates: { nodes: Array<{ id: string; name: string; type: string }> };
  }>(
    apiKey,
    `query($teamId: ID!) { workflowStates(filter: { team: { id: { eq: $teamId } } }) { nodes { id name type } } }`,
    { teamId: team.id },
  );
  console.log(`\n🔁 Workflow states (${states.workflowStates.nodes.length}):`);
  for (const s of states.workflowStates.nodes) {
    console.log(`   - ${s.name} (${s.type}) — id=${s.id}`);
  }

  // 6. All open + closed issues (för att inte dubbla)
  const issues = await gql<{
    issues: {
      nodes: Array<{ identifier: string; title: string; state: { name: string }; project: { name: string } | null }>;
    };
  }>(
    apiKey,
    `query { issues(first: 100) { nodes { identifier title state { name } project { name } } } }`,
  );
  console.log(`\n📝 Existing issues (${issues.issues.nodes.length}):`);
  for (const i of issues.issues.nodes) {
    const proj = i.project ? ` → ${i.project.name}` : "";
    console.log(`   - ${i.identifier}: ${i.title} [${i.state.name}]${proj}`);
  }

  console.log("\n✅ Introspect done.\n");
}

main().catch((err) => {
  console.error("❌ Fel:", err);
  process.exit(1);
});
