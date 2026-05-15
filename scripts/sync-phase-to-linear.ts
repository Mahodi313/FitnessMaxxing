#!/usr/bin/env -S tsx --env-file=app/.env.local
/**
 * sync-phase-to-linear.ts
 *
 * Skapar/uppdaterar Linear-issues för en fas planerad via GSD.
 * - Parent-epic per fas (en Linear-issue)
 * - Sub-issue per plan (Linear-issue med parentId)
 * - Idempotent via .linear-sync.json manifest i phase-dir
 *
 * Användning:
 *   npm run linear:sync-phase -- --phase 6
 *   npm run linear:sync-phase -- --phase 6 --dry-run
 *
 * Re-körning uppdaterar existerande issues istället för att skapa dubbletter.
 * I commits, referera ALLTID till sub-issue ID:t (FIT-XX), inte epic-ID:t.
 * PR:n stänger sub-issues via "Fixes FIT-XX" i bodyn — Linear stänger
 * parent-epic automatiskt när alla sub-issues stängs.
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "fs";
import path from "path";

// ─── Konstanter ──────────────────────────────────────────────────────────────

const API = "https://api.linear.app/graphql";
const TEAM_KEY = "FIT";
const PLANNING_DIR = ".planning";

// ─── GraphQL helper ──────────────────────────────────────────────────────────

async function gql<T>(
  apiKey: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: apiKey },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data as T;
}

// ─── Args ────────────────────────────────────────────────────────────────────

interface Args {
  phase: string;
  dryRun: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = argv.indexOf(flag);
    return idx !== -1 ? argv[idx + 1] : undefined;
  };
  const has = (flag: string): boolean => argv.includes(flag);

  const phase = get("--phase");
  if (!phase) {
    console.error("❌ --phase krävs (t.ex. --phase 6)");
    process.exit(1);
  }

  return { phase, dryRun: has("--dry-run") };
}

// ─── Filsystem: hitta phase-dir ──────────────────────────────────────────────

function findPhaseDir(phase: string): string {
  const padded = String(parseInt(phase, 10)).padStart(2, "0");
  const phasesRoot = path.join(PLANNING_DIR, "phases");
  if (!existsSync(phasesRoot)) {
    throw new Error(`Hittar inte ${phasesRoot}`);
  }
  const dirs = readdirSync(phasesRoot).filter((d) => {
    const full = path.join(phasesRoot, d);
    return statSync(full).isDirectory() && d.startsWith(`${padded}-`);
  });
  if (dirs.length === 0) {
    throw new Error(`Hittar ingen phase-dir för Phase ${phase} (sökte ${padded}-*)`);
  }
  if (dirs.length > 1) {
    throw new Error(
      `Flera phase-dirs matchar Phase ${phase}: ${dirs.join(", ")}`,
    );
  }
  return path.join(phasesRoot, dirs[0]);
}

// ─── ROADMAP.md parsing ──────────────────────────────────────────────────────

interface RoadmapPhase {
  number: string;
  name: string;
  goal: string;
  requirements: string[];
  successCriteria: string[];
}

function parseRoadmap(phase: string): RoadmapPhase {
  const roadmapPath = path.join(PLANNING_DIR, "ROADMAP.md");
  if (!existsSync(roadmapPath)) {
    throw new Error(`Hittar inte ${roadmapPath}`);
  }
  const content = readFileSync(roadmapPath, "utf8");

  // Hitta sektionen: "### Phase N: <Name>" och allt fram till nästa "### " eller "## "
  const re = new RegExp(
    `### Phase ${phase}:\\s*(.+?)\\r?\\n([\\s\\S]*?)(?=\\r?\\n###\\s|\\r?\\n##\\s|$)`,
  );
  const m = content.match(re);
  if (!m) {
    throw new Error(`Hittar inte "### Phase ${phase}: ..." i ROADMAP.md`);
  }
  const name = m[1].trim();
  const body = m[2];

  const goal = (body.match(/\*\*Goal\*\*:\s*(.+)/) || [, ""])[1].trim();
  const reqLine = (body.match(/\*\*Requirements\*\*:\s*(.+)/) || [, ""])[1].trim();
  const requirements = reqLine
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Success Criteria — list-items efter "**Success Criteria**" header
  const scStart = body.indexOf("**Success Criteria**");
  const successCriteria: string[] = [];
  if (scStart !== -1) {
    const after = body.slice(scStart);
    // Plocka rader som börjar med "  N. " (1-spec eller numrerad)
    const lines = after.split(/\r?\n/);
    for (const ln of lines) {
      const lm = ln.match(/^\s*\d+\.\s+(.+)$/);
      if (lm) successCriteria.push(lm[1].trim());
    }
  }

  return { number: phase, name, goal, requirements, successCriteria };
}

// ─── PLAN.md parsing ─────────────────────────────────────────────────────────

interface Plan {
  file: string;
  planId: string; // t.ex. "01a", "01b", "02", "03"
  phase: string;
  wave: number;
  dependsOn: string[];
  requirements: string[];
  filesModified: string[];
  objective: string; // första stycket av <objective>
  tasks: string[]; // task-namn från <task><name>...</name>
}

function parsePlan(filePath: string): Plan {
  const content = readFileSync(filePath, "utf8");
  const file = path.basename(filePath);

  // Frontmatter mellan ---
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) {
    throw new Error(`${file}: saknar frontmatter`);
  }
  const fm = fmMatch[1];

  const planId = (fm.match(/^plan:\s*"?(.+?)"?\s*$/m) || [, ""])[1].trim();
  const phase = (fm.match(/^phase:\s*"?(.+?)"?\s*$/m) || [, ""])[1]
    .trim()
    .replace(/^0?(\d+).*$/, "$1"); // "06-history-..." → "6"
  const wave = parseInt(
    (fm.match(/^wave:\s*(\d+)/m) || [, "0"])[1],
    10,
  );
  const dependsOn = parseYamlList(fm, "depends_on");
  const requirements = parseYamlList(fm, "requirements");
  const filesModified = parseYamlList(fm, "files_modified");

  // Objective — första stycket från <objective>...</objective>
  const objMatch = content.match(/<objective>\s*\r?\n?([\s\S]*?)<\/objective>/);
  let objective = "";
  if (objMatch) {
    const firstPara = objMatch[1].trim().split(/\r?\n\r?\n/)[0];
    objective = firstPara.replace(/\s+/g, " ").trim();
  }

  // Tasks — alla <task ...>...<name>...</name>
  const tasks: string[] = [];
  const taskRe = /<task\b[^>]*>[\s\S]*?<name>([\s\S]*?)<\/name>/g;
  let tm: RegExpExecArray | null;
  while ((tm = taskRe.exec(content)) !== null) {
    tasks.push(tm[1].trim().replace(/\s+/g, " "));
  }

  return {
    file,
    planId,
    phase,
    wave,
    dependsOn,
    requirements,
    filesModified,
    objective,
    tasks,
  };
}

function parseYamlList(fm: string, key: string): string[] {
  // Antingen "key: [a, b, c]" eller "key:\n  - a\n  - b"
  const inlineRe = new RegExp(`^${key}:\\s*\\[(.+?)\\]`, "m");
  const inline = fm.match(inlineRe);
  if (inline) {
    return inline[1]
      .split(",")
      .map((s) => s.replace(/^["']|["']$/g, "").trim())
      .filter(Boolean);
  }
  const blockRe = new RegExp(`^${key}:\\s*\\r?\\n((?:\\s+-\\s+.+\\r?\\n?)+)`, "m");
  const block = fm.match(blockRe);
  if (block) {
    return block[1]
      .split(/\r?\n/)
      .map((ln) => ln.match(/^\s+-\s+(.+)$/)?.[1] ?? "")
      .map((s) => s.replace(/^["']|["']$/g, "").trim())
      .filter(Boolean);
  }
  // Single-value fallback
  const singleRe = new RegExp(`^${key}:\\s*(.+)$`, "m");
  const single = fm.match(singleRe);
  if (single && single[1].trim()) {
    return [single[1].replace(/^["']|["']$/g, "").trim()];
  }
  return [];
}

// ─── Manifest ────────────────────────────────────────────────────────────────

interface Manifest {
  phase: string;
  epic_issue_id?: string;
  epic_linear_id?: string;
  plans: Record<string, { issue_id: string; linear_id: string }>;
  last_synced?: string;
}

function loadManifest(phaseDir: string, phase: string): Manifest {
  const p = path.join(phaseDir, ".linear-sync.json");
  if (!existsSync(p)) {
    return { phase, plans: {} };
  }
  return JSON.parse(readFileSync(p, "utf8"));
}

function saveManifest(phaseDir: string, manifest: Manifest): void {
  const p = path.join(phaseDir, ".linear-sync.json");
  manifest.last_synced = new Date().toISOString();
  writeFileSync(p, JSON.stringify(manifest, null, 2) + "\n");
}

// ─── Linear: lookups ─────────────────────────────────────────────────────────

async function getTeamId(apiKey: string): Promise<string> {
  const data = await gql<{
    teams: { nodes: Array<{ id: string; key: string }> };
  }>(apiKey, `query { teams { nodes { id key } } }`);
  const team = data.teams.nodes.find((t) => t.key === TEAM_KEY);
  if (!team) throw new Error(`Team ${TEAM_KEY} hittades inte`);
  return team.id;
}

async function findProjectByName(
  apiKey: string,
  name: string,
): Promise<string | undefined> {
  const data = await gql<{
    projects: { nodes: Array<{ id: string; name: string }> };
  }>(apiKey, `query { projects { nodes { id name } } }`);
  const exact = data.projects.nodes.find((p) => p.name === name);
  return exact?.id;
}

async function findLabelByName(
  apiKey: string,
  name: string,
): Promise<string | undefined> {
  const data = await gql<{
    issueLabels: { nodes: Array<{ id: string; name: string }> };
  }>(apiKey, `query { issueLabels { nodes { id name } } }`);
  const label = data.issueLabels.nodes.find(
    (l) => l.name.toLowerCase() === name.toLowerCase(),
  );
  return label?.id;
}

// ─── Linear: issue CRUD ──────────────────────────────────────────────────────

interface IssueCore {
  id: string;
  identifier: string;
  title: string;
}

async function createIssue(
  apiKey: string,
  input: Record<string, unknown>,
): Promise<IssueCore> {
  const res = await gql<{
    issueCreate: { success: boolean; issue: IssueCore };
  }>(
    apiKey,
    `mutation($input: IssueCreateInput!) {
       issueCreate(input: $input) {
         success
         issue { id identifier title }
       }
     }`,
    { input },
  );
  return res.issueCreate.issue;
}

async function updateIssue(
  apiKey: string,
  id: string,
  input: Record<string, unknown>,
): Promise<IssueCore> {
  const res = await gql<{
    issueUpdate: { success: boolean; issue: IssueCore };
  }>(
    apiKey,
    `mutation($id: String!, $input: IssueUpdateInput!) {
       issueUpdate(id: $id, input: $input) {
         success
         issue { id identifier title }
       }
     }`,
    { id, input },
  );
  return res.issueUpdate.issue;
}

// ─── Description builders ────────────────────────────────────────────────────

function buildEpicDescription(
  roadmap: RoadmapPhase,
  plans: Plan[],
  planLinks: Record<string, string>,
  phaseDirName: string,
): string {
  const lines: string[] = [];
  lines.push(`**Phase ${roadmap.number}: ${roadmap.name}**`);
  lines.push("");
  if (roadmap.goal) {
    lines.push(`**Goal:** ${roadmap.goal}`);
    lines.push("");
  }
  if (roadmap.requirements.length) {
    lines.push(`**Requirements:** ${roadmap.requirements.join(", ")}`);
    lines.push("");
  }
  if (roadmap.successCriteria.length) {
    lines.push("**Success Criteria:**");
    for (const sc of roadmap.successCriteria) {
      lines.push(`1. ${sc}`);
    }
    lines.push("");
  }

  lines.push(`## Plans in this phase (${plans.length})`);
  lines.push("");
  for (const p of plans) {
    const link = planLinks[p.planId];
    const ref = link ? `**${link}**` : `*pending*`;
    const reqs = p.requirements.length ? ` _(${p.requirements.join(", ")})_` : "";
    lines.push(
      `- [ ] ${ref} — Phase ${roadmap.number}.${p.planId} — ${shortObjective(p.objective)}${reqs}`,
    );
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(
    `*Auto-synced from \`.planning/phases/${phaseDirName}/\` by \`npm run linear:sync-phase -- --phase ${roadmap.number}\`. Re-körning uppdaterar denna issue idempotent.*`,
  );
  return lines.join("\n");
}

function buildPlanDescription(
  roadmap: RoadmapPhase,
  plan: Plan,
  epicRef: string,
): string {
  const lines: string[] = [];
  lines.push(`**Phase ${roadmap.number}.${plan.planId}**`);
  lines.push("");
  if (plan.objective) {
    lines.push(`**Objective:** ${plan.objective}`);
    lines.push("");
  }
  if (plan.requirements.length) {
    lines.push(`**Requirements:** ${plan.requirements.join(", ")}`);
  }
  lines.push(`**Wave:** ${plan.wave}`);
  if (plan.dependsOn.length) {
    lines.push(`**Depends on:** ${plan.dependsOn.join(", ")}`);
  }
  lines.push("");

  if (plan.filesModified.length) {
    lines.push("**Files modified:**");
    for (const f of plan.filesModified) {
      lines.push(`- \`${f}\``);
    }
    lines.push("");
  }

  if (plan.tasks.length) {
    lines.push(`## Tasks (${plan.tasks.length})`);
    lines.push("");
    for (const t of plan.tasks) {
      lines.push(`- [ ] ${t}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push(`**Parent epic:** ${epicRef}`);
  lines.push("");
  lines.push(
    `**Commit-konvention:** \`[<issue-id>]\` i commit-meddelandet. PR-body: \`Fixes <issue-id>\`.`,
  );
  lines.push("");
  lines.push(
    `*Auto-synced from \`${plan.file}\` by \`npm run linear:sync-phase -- --phase ${roadmap.number}\`. Re-körning uppdaterar denna issue idempotent.*`,
  );
  return lines.join("\n");
}

function shortObjective(obj: string): string {
  if (!obj) return "(ingen objective)";
  // Första meningen ELLER första 100 tecken
  const firstSentence = obj.split(/(?<=[.!?])\s/)[0];
  if (firstSentence.length <= 140) return firstSentence;
  return obj.slice(0, 137).trim() + "...";
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    console.error("❌ LINEAR_API_KEY saknas — kontrollera app/.env.local");
    process.exit(1);
  }

  const args = parseArgs();
  const phase = args.phase;

  console.log(`\n🔄 Synkar Phase ${phase} till Linear${args.dryRun ? " [DRY-RUN]" : ""}\n`);

  // 1. Hitta phase-dir + parsea roadmap + plans
  const phaseDir = findPhaseDir(phase);
  console.log(`📁 Phase dir: ${phaseDir}`);

  const roadmap = parseRoadmap(phase);
  console.log(`📋 Phase: ${roadmap.name}`);
  console.log(`   Goal: ${roadmap.goal}`);
  console.log(`   Requirements: ${roadmap.requirements.join(", ") || "(none)"}`);

  const planFiles = readdirSync(phaseDir)
    .filter((f) => /-PLAN\.md$/.test(f))
    .map((f) => path.join(phaseDir, f))
    .sort();

  if (planFiles.length === 0) {
    console.error(`❌ Inga *-PLAN.md filer hittades i ${phaseDir}`);
    process.exit(1);
  }

  const plans = planFiles.map(parsePlan);
  console.log(`📝 Plans: ${plans.length}`);
  for (const p of plans) {
    console.log(
      `   ${p.planId} — wave ${p.wave}, ${p.tasks.length} tasks, ${p.requirements.join(",") || "?"}`,
    );
  }

  // 2. Manifest
  const manifest = loadManifest(phaseDir, phase);
  const isResync = !!manifest.epic_linear_id;
  console.log(`📦 Manifest: ${isResync ? "befintlig (uppdaterar)" : "ny (skapar)"}`);

  if (args.dryRun) {
    console.log("\n🟡 DRY-RUN — inga Linear-anrop görs.");
    console.log("\nFöljande skulle skapas/uppdateras:");
    console.log(
      `  Parent epic: "Phase ${phase}: ${roadmap.name}"` +
        (manifest.epic_issue_id ? ` (uppdaterar ${manifest.epic_issue_id})` : " (skapar ny)"),
    );
    for (const p of plans) {
      const existing = manifest.plans[p.planId];
      console.log(
        `  Sub-issue:  "Phase ${phase}.${p.planId} — ${shortObjective(p.objective)}"` +
          (existing ? ` (uppdaterar ${existing.issue_id})` : " (skapar ny)"),
      );
    }
    return;
  }

  // 3. Linear setup
  const teamId = await getTeamId(apiKey);
  console.log(`\n👥 Team ${TEAM_KEY}: ${teamId}`);

  const projectName = `Phase ${phase} — ${roadmap.name}`;
  const projectId = await findProjectByName(apiKey, projectName);
  if (projectId) {
    console.log(`📂 Project "${projectName}": ${projectId}`);
  } else {
    console.log(
      `⚠  Project "${projectName}" hittades inte — issues skapas utan projekt-länk. ` +
        `Kör \`npm run linear:setup-foundation\` för att skapa projekt först (rekommenderas).`,
    );
  }

  const planLabelId = await findLabelByName(apiKey, "Plan");
  if (!planLabelId) {
    console.log(`⚠  Label "Plan" saknas — issues skapas utan label.`);
  }

  // 4. Parent epic
  console.log(`\n📌 Parent epic ...`);
  const epicTitle = `Phase ${phase}: ${roadmap.name}`;
  const phaseDirName = path.basename(phaseDir);
  // Bygg en tom planLinks först; uppdatera epicen igen efter sub-issues skapats
  const epicDescStub = buildEpicDescription(roadmap, plans, {}, phaseDirName);

  let epic: IssueCore;
  if (manifest.epic_linear_id) {
    epic = await updateIssue(apiKey, manifest.epic_linear_id, {
      title: epicTitle,
      description: epicDescStub,
      ...(projectId ? { projectId } : {}),
    });
    console.log(`   ✓ Uppdaterade ${epic.identifier} — ${epic.title}`);
  } else {
    const input: Record<string, unknown> = {
      teamId,
      title: epicTitle,
      description: epicDescStub,
      ...(projectId ? { projectId } : {}),
      ...(planLabelId ? { labelIds: [planLabelId] } : {}),
    };
    epic = await createIssue(apiKey, input);
    manifest.epic_issue_id = epic.identifier;
    manifest.epic_linear_id = epic.id;
    console.log(`   ✓ Skapade ${epic.identifier} — ${epic.title}`);
  }

  // 5. Sub-issues per plan
  console.log(`\n📌 Sub-issues (${plans.length}) ...`);
  const planLinks: Record<string, string> = {};
  for (const p of plans) {
    const subTitle = `Phase ${phase}.${p.planId} — ${shortObjective(p.objective)}`;
    const subDesc = buildPlanDescription(roadmap, p, epic.identifier);

    const existing = manifest.plans[p.planId];
    let sub: IssueCore;
    if (existing) {
      sub = await updateIssue(apiKey, existing.linear_id, {
        title: subTitle,
        description: subDesc,
        ...(projectId ? { projectId } : {}),
      });
      console.log(`   ✓ Uppdaterade ${sub.identifier} (${p.planId})`);
    } else {
      const input: Record<string, unknown> = {
        teamId,
        title: subTitle,
        description: subDesc,
        parentId: epic.id,
        ...(projectId ? { projectId } : {}),
        ...(planLabelId ? { labelIds: [planLabelId] } : {}),
      };
      sub = await createIssue(apiKey, input);
      manifest.plans[p.planId] = {
        issue_id: sub.identifier,
        linear_id: sub.id,
      };
      console.log(`   ✓ Skapade ${sub.identifier} (${p.planId})`);
    }
    planLinks[p.planId] = sub.identifier;
  }

  // 6. Uppdatera epic-descriptionen med riktiga sub-issue-links
  console.log(`\n🔁 Uppdaterar epic-description med sub-issue-länkar ...`);
  const epicDescFinal = buildEpicDescription(roadmap, plans, planLinks, phaseDirName);
  await updateIssue(apiKey, epic.id, { description: epicDescFinal });
  console.log(`   ✓ ${epic.identifier} description synkad`);

  // 7. Spara manifest
  saveManifest(phaseDir, manifest);
  console.log(`\n💾 Manifest sparad: ${path.join(phaseDir, ".linear-sync.json")}`);

  // 8. Summary
  console.log(`\n✅ Phase ${phase} synkad till Linear:\n`);
  console.log(`   ${manifest.epic_issue_id}  Phase ${phase}: ${roadmap.name}    [Epic]`);
  const ids = Object.keys(manifest.plans);
  for (let i = 0; i < ids.length; i++) {
    const isLast = i === ids.length - 1;
    const planId = ids[i];
    const p = plans.find((pl) => pl.planId === planId);
    console.log(
      `     ${isLast ? "└─" : "├─"} ${manifest.plans[planId].issue_id}  ${phase}.${planId} — ${shortObjective(p?.objective ?? "")}`,
    );
  }
  console.log(`\n💬 Commit-konvention: \`[FIT-XX]\` i commit-meddelandet (sub-issue ID).`);
  console.log(`   PR-body: \`Fixes FIT-XX\` — Linear stänger parent-epic när alla subs är stängda.\n`);
}

main().catch((err) => {
  console.error("\n❌ Sync misslyckades:");
  console.error(err);
  process.exit(1);
});
