#!/usr/bin/env node
/**
 * PreToolUse / Bash guard: prevent creating a `gsd/phase-*` branch off a STALE
 * local `dev`.
 *
 * Why: phase branches are cut from `dev` (per CLAUDE.md branching strategy), but
 * `git checkout -b gsd/phase-XX dev` uses the LOCAL dev ref. If local dev hasn't
 * pulled the latest merged phase, the new branch is missing prior-phase code and
 * inherits a stale STATE.md (rebase-conflict footgun seen on Phase 9).
 *
 * Behavior:
 *   - Fast-exits (allow) for any Bash command that is NOT creating a
 *     `gsd/phase-*` branch from `dev` (or from the current branch when that is dev).
 *   - When a guarded creation is detected: `git fetch origin` then check whether
 *     local `dev` is behind `origin/dev`. If behind -> BLOCK (exit 2) with a
 *     message telling Claude to fast-forward dev first. Otherwise allow.
 *   - Any git error / offline / no-origin -> allow (never wedge the user).
 *
 * Exit codes: 0 = allow, 2 = block (stderr is surfaced back to Claude).
 */

"use strict";

const { execSync } = require("node:child_process");

function readStdin() {
  try {
    return require("node:fs").readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function git(args, opts = {}) {
  return execSync(`git ${args}`, {
    stdio: ["ignore", "pipe", "ignore"],
    encoding: "utf8",
    timeout: opts.timeout ?? 12000,
  }).trim();
}

function allow() {
  process.exit(0);
}

function block(message) {
  process.stderr.write(message + "\n");
  process.exit(2);
}

function main() {
  let payload;
  try {
    payload = JSON.parse(readStdin() || "{}");
  } catch {
    allow();
  }

  const command = payload?.tool_input?.command;
  if (typeof command !== "string" || !command.includes("git")) allow();

  // Match: git checkout -b <branch> [startpoint]  |  git switch -c <branch> [startpoint]
  const m = command.match(
    /\bgit\s+(?:checkout\s+-b|switch\s+-c)\s+(\S+)(?:\s+(\S+))?/,
  );
  if (!m) allow();

  const strip = (s) => (s ? s.replace(/^["']|["']$/g, "") : s);
  const branch = strip(m[1]);
  let startpoint = strip(m[2]);
  if (startpoint && startpoint.startsWith("-")) startpoint = undefined; // a flag, not a ref

  if (!branch || !/^gsd\/phase-/.test(branch)) allow();

  // Decide whether this creation is rooted on local `dev`.
  let rootedOnDev = false;
  if (startpoint === undefined) {
    // Created from current HEAD — only a concern if HEAD is `dev`.
    try {
      rootedOnDev = git("symbolic-ref --short HEAD") === "dev";
    } catch {
      allow();
    }
  } else if (startpoint === "dev" || startpoint === "refs/heads/dev") {
    rootedOnDev = true;
  } else {
    // Explicit non-local-dev startpoint (e.g. origin/dev) — fine.
    allow();
  }

  if (!rootedOnDev) allow();

  // Local dev IS the base. Verify it's current with origin/dev.
  try {
    git("fetch origin --quiet", { timeout: 15000 });
  } catch {
    allow(); // offline / no origin — don't block work
  }

  let behind = 0;
  try {
    behind = parseInt(git("rev-list --count dev..origin/dev"), 10) || 0;
  } catch {
    allow(); // no origin/dev ref, etc.
  }

  if (behind > 0) {
    block(
      `Blocked: local 'dev' is ${behind} commit(s) behind 'origin/dev'. ` +
        `Creating '${branch}' from it would miss merged prior-phase work.\n` +
        `Fast-forward first, then re-run the branch command:\n` +
        `  git fetch origin && git branch -f dev origin/dev`,
    );
  }

  allow();
}

main();
