#!/usr/bin/env -S tsx --env-file=app/.env.local
/**
 * get-linear-issues.ts
 *
 * Hämtar öppna Linear issues och skriver ut dem i ett format
 * som GSD/Claude Code kan läsa och agera på.
 *
 * Användning (kör från repo-roten):
 *   npm run linear:issues
 *   npm run linear:issues -- --phase 5
 *   npm run linear:issues -- --type bug
 *   npm run linear:issues -- --priority urgent,high
 */

// ─── Parse args ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const get = (flag: string): string | undefined => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
};

const filterPhase = get("--phase");
const filterType = get("--type");
const filterPriority = get("--priority")?.split(",");

// ─── Linear Priority mapping ──────────────────────────────────────────────────
const PRIORITY_LABELS: Record<number, string> = {
  0: "No priority",
  1: "Urgent",
  2: "High",
  3: "Medium",
  4: "Low",
};

// ─── Fetch issues ─────────────────────────────────────────────────────────────
async function getIssues(): Promise<void> {
  const apiKey = process.env.LINEAR_API_KEY;

  if (!apiKey) {
    console.error("❌ LINEAR_API_KEY saknas i miljövariabler.");
    process.exit(1);
  }

  const query = `
    query {
      teams(first: 5) {
        nodes {
          id
          key
          name
          issues(
            filter: {
              state: { type: { nin: ["completed", "cancelled"] } }
            }
            orderBy: updatedAt
            first: 25
          ) {
            nodes {
              id
              identifier
              title
              description
              priority
              state {
                name
                type
              }
              labels(first: 10) {
                nodes {
                  name
                }
              }
              createdAt
              updatedAt
              url
            }
          }
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

  if (data.errors) {
    console.error("❌ Linear API fel:", JSON.stringify(data.errors));
    process.exit(1);
  }

  const teams = data.data?.teams?.nodes || [];

  for (const team of teams) {
    let issues = team.issues?.nodes || [];

    // Filtrera på fas om --phase är angivet
    if (filterPhase) {
      issues = issues.filter(
        (i: any) =>
          i.description?.includes(`Phase ${filterPhase}`) ||
          i.title?.toLowerCase().includes(`phase ${filterPhase}`) ||
          i.title?.toLowerCase().includes(`fas ${filterPhase}`),
      );
    }

    // Filtrera på typ (label) om --type är angivet
    if (filterType) {
      issues = issues.filter((i: any) =>
        i.labels?.nodes?.some(
          (l: any) => l.name.toLowerCase() === filterType.toLowerCase(),
        ),
      );
    }

    // Filtrera på prioritet om --priority är angivet
    if (filterPriority) {
      const priorityMap: Record<string, number> = {
        urgent: 1,
        high: 2,
        medium: 3,
        low: 4,
      };
      const priorityNums = filterPriority.map(
        (p) => priorityMap[p.toLowerCase()] ?? 0,
      );
      issues = issues.filter((i: any) => priorityNums.includes(i.priority));
    }

    if (issues.length === 0) {
      console.log(`\n✅ Inga öppna issues i team ${team.key}`);
      continue;
    }

    console.log(`\n📋 Öppna issues — ${team.name} (${team.key})`);
    console.log("─".repeat(60));

    // Gruppera per prioritet
    const grouped: Record<number, any[]> = {
      1: [],
      2: [],
      3: [],
      4: [],
      0: [],
    };
    for (const issue of issues) {
      grouped[issue.priority]?.push(issue);
    }

    for (const priority of [1, 2, 3, 4, 0]) {
      const group = grouped[priority];
      if (!group || group.length === 0) continue;

      console.log(`\n${PRIORITY_LABELS[priority].toUpperCase()}`);

      for (const issue of group) {
        const labels =
          issue.labels?.nodes?.map((l: any) => l.name).join(", ") || "";
        const state = issue.state?.name || "Unknown";
        const labelStr = labels ? ` [${labels}]` : "";

        console.log(`  ${issue.identifier} — ${issue.title}${labelStr}`);
        console.log(`    Status: ${state} | ${issue.url}`);
        if (issue.description) {
          // Visa bara första raden av beskrivningen
          const firstLine = issue.description.split("\n")[0].slice(0, 100);
          console.log(`    ${firstLine}`);
        }
      }
    }

    // Skriv ut maskinläsbar sammanfattning för GSD
    console.log("\n" + "─".repeat(60));
    console.log("\n📊 SAMMANFATTNING FÖR GSD:");
    console.log(`TOTAL_OPEN_ISSUES=${issues.length}`);

    const bugs = issues.filter((i: any) =>
      i.labels?.nodes?.some((l: any) => l.name === "Bug"),
    );
    const urgent = issues.filter(
      (i: any) => i.priority === 1 || i.priority === 2,
    );

    if (bugs.length > 0) {
      console.log(`\n⚠️  BUGGAR ATT ÅTGÄRDA (${bugs.length} st):`);
      for (const bug of bugs) {
        console.log(`  - ${bug.identifier}: ${bug.title}`);
      }
    }

    if (urgent.length > 0) {
      console.log(`\n🚨 URGENT/HIGH PRIORITET (${urgent.length} st):`);
      for (const issue of urgent) {
        console.log(`  - ${issue.identifier}: ${issue.title}`);
      }
    }
  }
}

getIssues().catch((err) => {
  console.error("❌ Fel:", err);
  process.exit(1);
});
