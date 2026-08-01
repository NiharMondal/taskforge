/**
 * One-off backfill for `Issue.rank`.
 *
 * `rank` was added nullable so it could land on an existing table, which leaves
 * every pre-existing issue un-ranked. This assigns evenly spaced fractional
 * indexes per `(projectId, status)` lane, preserving the order those rows
 * already appeared in (`createdAt ASC` — what the board fell back to before
 * ranks existed).
 *
 *   pnpm run backfill:issue-rank
 *
 * Idempotent: only rows with `rank = NULL` are touched, so re-running is a
 * no-op. Ranked rows are read first so backfilled keys sort *after* whatever
 * the lane already has (created since the API started assigning ranks).
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { generateNKeysBetween } from "fractional-indexing";
import { PrismaClient } from "generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg(process.env.DATABASE_URL!),
});

/** Lane key — ranks are only ever compared within one `(project, status)` lane. */
const laneKey = (projectId: string, status: string) => `${projectId}:${status}`;

async function main() {
  const unranked = await prisma.issue.findMany({
    where: { rank: null },
    orderBy: [{ projectId: "asc" }, { status: "asc" }, { createdAt: "asc" }],
    select: { id: true, projectId: true, status: true },
  });

  if (unranked.length === 0) {
    console.log("Nothing to backfill — every issue already has a rank.");
    return;
  }

  const lanes = new Map<string, string[]>();
  for (const issue of unranked) {
    const key = laneKey(issue.projectId, issue.status);
    const lane = lanes.get(key) ?? [];
    lane.push(issue.id);
    lanes.set(key, lane);
  }

  // Highest existing rank per lane, so the keys we generate continue the
  // sequence instead of colliding with it. NULLs are excluded because Postgres
  // sorts them first on DESC.
  const ranked = await prisma.issue.findMany({
    where: { rank: { not: null } },
    orderBy: { rank: "asc" },
    select: { projectId: true, status: true, rank: true },
  });
  const maxRank = new Map<string, string>();
  for (const issue of ranked) {
    maxRank.set(laneKey(issue.projectId, issue.status), issue.rank!);
  }

  for (const [key, ids] of lanes) {
    const keys = generateNKeysBetween(
      maxRank.get(key) ?? null,
      null,
      ids.length,
    );
    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.issue.update({ where: { id }, data: { rank: keys[index] } }),
      ),
    );
    console.log(`  ${key}: ranked ${ids.length} issue(s)`);
  }

  console.log(
    `Backfilled ${unranked.length} issue(s) across ${lanes.size} lane(s).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
