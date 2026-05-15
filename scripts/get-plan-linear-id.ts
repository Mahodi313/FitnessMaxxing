#!/usr/bin/env -S tsx --env-file=app/.env.local
/**
 * get-plan-linear-id.ts
 *
 * Slå upp Linear-issue IDs från en fas .linear-sync.json manifest.
 * Används av gsd-executor (för commit-tagging) och CI (för PR-body).
 *
 * Användning:
 *   npm run linear:plan-id -- --phase 6 --plan 01a       # → FIT-62
 *   npm run linear:plan-id -- --phase 6 --epic           # → FIT-61
 *   npm run linear:plan-id -- --phase 6 --format pr-body # → "Fixes FIT-62\nFixes FIT-63\n..."
 *
 * Exit codes:
 *   0 — hittad, ID printad på stdout
 *   1 — manifest saknas eller plan/epic inte i manifestet
 *
 * Tyst på stdout vid missar (echar bara ID:t) — stderr får diagnostik.
 * Gör det säkert att använda i shell-pipelines: `LINEAR_ID=$(npm run -s ... --silent)`.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import path from "path";

const PLANNING_DIR = ".planning";

interface Manifest {
  phase: string;
  epic_issue_id?: string;
  epic_linear_id?: string;
  plans: Record<string, { issue_id: string; linear_id: string }>;
}

function get(flag: string): string | undefined {
  const argv = process.argv.slice(2);
  const idx = argv.indexOf(flag);
  return idx !== -1 ? argv[idx + 1] : undefined;
}

function has(flag: string): boolean {
  return process.argv.slice(2).includes(flag);
}

function err(msg: string): never {
  process.stderr.write(`get-plan-linear-id: ${msg}\n`);
  process.exit(1);
}

function findPhaseDir(phase: string): string | undefined {
  const padded = String(parseInt(phase, 10)).padStart(2, "0");
  const phasesRoot = path.join(PLANNING_DIR, "phases");
  if (!existsSync(phasesRoot)) return undefined;
  const dirs = readdirSync(phasesRoot).filter((d) => {
    const full = path.join(phasesRoot, d);
    return statSync(full).isDirectory() && d.startsWith(`${padded}-`);
  });
  if (dirs.length === 0) return undefined;
  return path.join(phasesRoot, dirs[0]);
}

function loadManifest(phase: string): Manifest | undefined {
  const phaseDir = findPhaseDir(phase);
  if (!phaseDir) return undefined;
  const manifestPath = path.join(phaseDir, ".linear-sync.json");
  if (!existsSync(manifestPath)) return undefined;
  return JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
}

function main() {
  const phase = get("--phase");
  if (!phase) err("--phase krävs");

  const wantEpic = has("--epic");
  const wantPlan = get("--plan");
  const format = get("--format");

  const manifest = loadManifest(phase!);
  if (!manifest) {
    err(
      `ingen .linear-sync.json hittad för Phase ${phase}. Kör 'npm run linear:sync-phase -- --phase ${phase}' först.`,
    );
  }

  // --format pr-body → en rad per sub-issue: "Fixes FIT-XX"
  if (format === "pr-body") {
    const lines: string[] = [];
    if (manifest!.epic_issue_id) {
      lines.push(`Parent epic: ${manifest!.epic_issue_id}`);
      lines.push("");
    }
    for (const planId of Object.keys(manifest!.plans).sort()) {
      lines.push(`Fixes ${manifest!.plans[planId].issue_id}`);
    }
    process.stdout.write(lines.join("\n") + "\n");
    return;
  }

  // --format epic-id → bara epic-ID:t
  if (format === "epic-id" || (wantEpic && !format)) {
    if (!manifest!.epic_issue_id) {
      err(`Phase ${phase} manifest saknar epic_issue_id`);
    }
    process.stdout.write(manifest!.epic_issue_id + "\n");
    return;
  }

  // Default: --plan PLAN_ID → sub-issue ID
  if (!wantPlan) {
    err("--plan PLAN_ID krävs (om inte --epic eller --format pr-body används)");
  }
  const entry = manifest!.plans[wantPlan!];
  if (!entry) {
    err(
      `plan ${wantPlan} saknas i Phase ${phase} manifest. Tillgängliga: ${Object.keys(manifest!.plans).join(", ")}`,
    );
  }
  process.stdout.write(entry.issue_id + "\n");
}

main();
