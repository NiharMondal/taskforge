import { isValidRank } from "@taskforge/shared";
import type { Prisma } from "generated/prisma/client";

/**
 * A board lane: the issues of one project in one workflow status, ordered by
 * `Issue.rank`. Shared by `IssueService` (create, drop, status change) and
 * `WorkflowService` (deleting a status moves its issues into another lane).
 */
export interface IssueLane {
  workspaceId: string;
  projectId: string;
  statusId: string;
}

/**
 * Lock one lane until the transaction ends. Every rank write takes it:
 * appending reads the lane's last rank and writes the next one, and a drop
 * checks its key isn't taken; without the lock, two writes at the same moment
 * see the same lane and give both cards the same key, which the board can't
 * place anything between.
 */
export async function lockIssueLane(
  tx: Pick<Prisma.TransactionClient, "$executeRaw">,
  projectId: string,
  statusId: string,
) {
  const lane = `issue-lane:${projectId}:${statusId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lane}::text, 0))`;
}

/**
 * The highest valid rank in a lane, or `null` when it has none — what a new
 * card is appended after. Call it holding the lane's lock.
 *
 * Un-ranked rows are filtered out: Postgres sorts NULLs first on `DESC`, so a
 * single un-backfilled row would otherwise shadow the real maximum. The column
 * sorts in byte order (COLLATE "C"), matching the keys. A stored key that isn't
 * a valid fractional index (hand-edited row, botched backfill) is skipped in
 * favour of the highest one that is, rather than restarting at "a0", which
 * would likely collide.
 */
export async function lastRankInLane(
  db: Pick<Prisma.TransactionClient, "issue">,
  lane: IssueLane,
): Promise<string | null> {
  const where = { ...lane, rank: { not: null } };
  const last = await db.issue.findFirst({
    where,
    orderBy: { rank: "desc" },
    select: { rank: true },
  });
  if (!last?.rank || isValidRank(last.rank)) return last?.rank ?? null;

  const ranks = await db.issue.findMany({ where, select: { rank: true } });
  return ranks
    .map((r) => r.rank as string)
    .filter(isValidRank)
    .reduce<string | null>(
      (max, r) => (max === null || r > max ? r : max),
      null,
    );
}
