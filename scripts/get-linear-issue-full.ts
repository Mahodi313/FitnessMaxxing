#!/usr/bin/env -S tsx --env-file=app/.env.local
/**
 * get-linear-issue-full.ts <FIT-id>
 *
 * Hämtar en enskild Linear issue med full description.
 */

const id = process.argv[2];
if (!id) {
  console.error("Usage: tsx scripts/get-linear-issue-full.ts FIT-5");
  process.exit(1);
}

async function main(): Promise<void> {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    console.error("LINEAR_API_KEY saknas");
    process.exit(1);
  }

  const query = `query Q($id: String!) {
    issue(id: $id) {
      identifier
      title
      description
      priority
      state { name type }
      labels { nodes { name } }
      url
      createdAt
      updatedAt
    }
  }`;

  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: apiKey },
    body: JSON.stringify({ query, variables: { id } }),
  });

  const data = (await res.json()) as any;
  if (data.errors) {
    console.error(JSON.stringify(data.errors, null, 2));
    process.exit(1);
  }

  const issue = data.data?.issue;
  if (!issue) {
    console.error(`Issue not found: ${id}`);
    process.exit(1);
  }

  console.log(`${issue.identifier} — ${issue.title}`);
  console.log(`Status: ${issue.state?.name}`);
  console.log(`Priority: ${issue.priority}`);
  console.log(`Labels: ${issue.labels?.nodes?.map((l: any) => l.name).join(", ") || "(none)"}`);
  console.log(`URL: ${issue.url}`);
  console.log(`Created: ${issue.createdAt}`);
  console.log(`Updated: ${issue.updatedAt}`);
  console.log("\n--- DESCRIPTION ---\n");
  console.log(issue.description || "(empty)");
  console.log("\n--- END ---");
}

main().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
