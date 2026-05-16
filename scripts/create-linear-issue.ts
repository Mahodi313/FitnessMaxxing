#!/usr/bin/env -S tsx --env-file=app/.env.local
/**
 * create-linear-issue.ts
 *
 * Skript som GSD/Claude Code anropar automatiskt för att skapa Linear-issues.
 * Används vid: buggar, deferred tasks, technical debt, UI-findings.
 *
 * Användning (kör från repo-roten):
 *   npm run linear:create -- \
 *     --title "Bug: signup redirectar fel" \
 *     --description "Detaljer om buggen" \
 *     --type bug \
 *     --priority high \
 *     --phase 3
 */

import { execSync } from "child_process";

// ─── Typer ───────────────────────────────────────────────────────────────────

type IssueType = "bug" | "feature" | "debt" | "deferred" | "ui";
type Priority = "urgent" | "high" | "medium" | "low";

interface IssueInput {
  title: string;
  description: string;
  type: IssueType;
  priority: Priority;
  phase?: number;
  label?: string;
}

// ─── Linear Priority mapping ──────────────────────────────────────────────────
// Linear API: 0=No priority, 1=Urgent, 2=High, 3=Medium, 4=Low
const PRIORITY_MAP: Record<Priority, number> = {
  urgent: 1,
  high: 2,
  medium: 3,
  low: 4,
};

// ─── Label colors ─────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<IssueType, string> = {
  bug: "Bug",
  feature: "Feature",
  debt: "Tech Debt",
  deferred: "Deferred",
  ui: "UI",
};

// ─── Parse args ───────────────────────────────────────────────────────────────
function parseArgs(): IssueInput {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const title = get("--title");
  const description = get("--description") || "";
  const type = (get("--type") || "feature") as IssueType;
  const priority = (get("--priority") || "medium") as Priority;
  const phase = get("--phase") ? parseInt(get("--phase")!) : undefined;

  if (!title) {
    console.error("❌ --title krävs");
    process.exit(1);
  }

  return { title, description, type, priority, phase };
}

// ─── Hämta Linear team ID ─────────────────────────────────────────────────────
async function getTeamId(apiKey: string): Promise<string> {
  const query = `
    query {
      teams {
        nodes {
          id
          name
          key
        }
      }
    }
  `;

  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query }),
  });

  const data = (await response.json()) as any;
  const teams = data.data?.teams?.nodes;

  if (!teams || teams.length === 0) {
    throw new Error("Inga teams hittades i Linear");
  }

  // Välj FIT-teamet (eller första teamet)
  const fitTeam = teams.find((t: any) => t.key === "FIT") || teams[0];
  console.log(`📋 Team: ${fitTeam.name} (${fitTeam.key})`);
  return fitTeam.id;
}

// ─── Hitta eller skapa label ──────────────────────────────────────────────────
async function getLabelId(
  apiKey: string,
  teamId: string,
  labelName: string,
): Promise<string | undefined> {
  const query = `
    query($teamId: String!) {
      issueLabels(filter: { team: { id: { eq: $teamId } } }) {
        nodes {
          id
          name
        }
      }
    }
  `;

  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables: { teamId } }),
  });

  const data = (await response.json()) as any;
  const labels = data.data?.issueLabels?.nodes || [];
  const label = labels.find(
    (l: any) => l.name.toLowerCase() === labelName.toLowerCase(),
  );

  return label?.id;
}

// ─── Skapa issue ─────────────────────────────────────────────────────────────
async function createIssue(apiKey: string, input: IssueInput): Promise<void> {
  const teamId = await getTeamId(apiKey);
  const labelId = await getLabelId(apiKey, teamId, TYPE_LABELS[input.type]);

  // Bygg beskrivning med fas-kontext
  const fullDescription = [
    input.description,
    input.phase ? `\n\n**GSD Fas:** Phase ${input.phase}` : "",
    `\n**Typ:** ${TYPE_LABELS[input.type]}`,
    `\n**Automatiskt skapad av:** GSD/Claude Code`,
    `\n**Projekt:** FitnessMaxxing`,
  ]
    .filter(Boolean)
    .join("");

  const mutation = `
    mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          title
          url
          priority
        }
      }
    }
  `;

  const variables = {
    input: {
      teamId,
      title: input.title,
      description: fullDescription,
      priority: PRIORITY_MAP[input.priority],
      ...(labelId ? { labelIds: [labelId] } : {}),
    },
  };

  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query: mutation, variables }),
  });

  const data = (await response.json()) as any;

  if (data.errors) {
    throw new Error(`Linear API fel: ${JSON.stringify(data.errors)}`);
  }

  const issue = data.data?.issueCreate?.issue;
  if (issue) {
    console.log(`✅ Issue skapad: ${issue.identifier} — ${issue.title}`);
    console.log(`🔗 ${issue.url}`);
    // Skriv ut identifier så GSD kan inkludera den i nästa commit
    process.stdout.write(`\nLINEAR_ISSUE_ID=${issue.identifier}\n`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const apiKey = process.env.LINEAR_API_KEY;

  if (!apiKey) {
    console.error(
      "❌ LINEAR_API_KEY saknas i miljövariabler. Lägg till i .env.local",
    );
    process.exit(1);
  }

  const input = parseArgs();

  console.log(`\n🚀 Skapar Linear issue...`);
  console.log(`   Titel: ${input.title}`);
  console.log(`   Typ: ${input.type}`);
  console.log(`   Prioritet: ${input.priority}`);
  if (input.phase) console.log(`   Fas: Phase ${input.phase}`);

  try {
    await createIssue(apiKey, input);
  } catch (err) {
    console.error("❌ Fel:", err);
    process.exit(1);
  }
}

main();
