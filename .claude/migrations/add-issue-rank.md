# Migration: add `Issue.rank` for board ordering

Adds a fractional-index `rank` to `Issue` so Kanban card order persists. Run
against the **backend** repo (this is just the reference copy of the schema).

## 1. Schema change

Add to `model Issue` (already reflected in `.claude/schema.prisma`):

```prisma
rank String?            // fractional index (base-62), nullable for safe backfill
@@index([projectId, status, rank])
```

Generate the migration:

```bash
pnpm prisma migrate dev --name add_issue_rank
```

Prisma emits roughly:

```sql
ALTER TABLE "Issue" ADD COLUMN "rank" TEXT;
CREATE INDEX "Issue_projectId_status_rank_idx"
  ON "Issue" ("projectId", "status", "rank");
```

## 2. Backfill existing rows (one-off script)

Existing rows have `rank = NULL`. Assign ordered keys per `(projectId, status)`
lane, preserving current `createdAt` order. Needs `fractional-indexing`.

```ts
// scripts/backfill-issue-rank.ts  —  run once with: pnpm tsx scripts/backfill-issue-rank.ts
import { PrismaClient } from "@prisma/client";
import { generateNKeysBetween } from "fractional-indexing";

const prisma = new PrismaClient();

async function main() {
  const issues = await prisma.issue.findMany({
    where: { rank: null },
    orderBy: [{ projectId: "asc" }, { status: "asc" }, { createdAt: "asc" }],
    select: { id: true, projectId: true, status: true },
  });

  const lanes = new Map<string, string[]>(); // "projectId:status" -> ordered ids
  for (const i of issues) {
    const key = `${i.projectId}:${i.status}`;
    const lane = lanes.get(key) ?? [];
    lane.push(i.id);
    lanes.set(key, lane);
  }

  for (const ids of lanes.values()) {
    const keys = generateNKeysBetween(null, null, ids.length); // n spaced keys
    await prisma.$transaction(
      ids.map((id, idx) =>
        prisma.issue.update({ where: { id }, data: { rank: keys[idx] } }),
      ),
    );
  }
  console.log(`Backfilled ${issues.length} issues across ${lanes.size} lanes.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

## 3. API handlers

- **POST /projects/:projectId/issues** — append to the lane: read the current
  max `rank` for `(projectId, status)` and set
  `rank = generateKeyBetween(maxRank ?? null, null)`.
- **PATCH /projects/:projectId/issues/:issueId** — accept `rank` (and `status`)
  in the update body. The frontend computes the new `rank` on drop and sends
  both; persist them verbatim.

## 4. (Optional) tighten to non-null

Once backfilled **and** POST assigns a rank to every new issue, change to
`rank String` and migrate again. Keep it nullable until then — the frontend
already sorts un-ranked rows last (`lib/rank.ts → compareIssueRank`).
