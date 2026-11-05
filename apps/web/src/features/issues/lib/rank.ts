import type { Issue } from "../types/issue-types";

/**
 * Board ordering. `rankBetween` (from `@taskforge/shared`, the same helper the
 * API appends with) computes the key a dropped card gets from its neighbours;
 * the move is a single-row PATCH — see `Issue.rank` in
 * apps/backend/prisma/schema.prisma.
 */
export { rankBetween } from "@taskforge/shared";

/** Sort comparator: by rank ascending, un-ranked rows last, then by createdAt. */
export function compareIssueRank(a: Issue, b: Issue): number {
  if (a.rank && b.rank) {
    if (a.rank === b.rank) return a.createdAt < b.createdAt ? -1 : 1;
    return a.rank < b.rank ? -1 : 1;
  }
  if (a.rank) return -1;
  if (b.rank) return 1;
  return a.createdAt < b.createdAt ? -1 : 1;
}
