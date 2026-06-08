import { generateKeyBetween } from "fractional-indexing";

import type { Issue } from "../types/issue-types";

/**
 * Board ordering helpers built on fractional indexing (base-62 string keys).
 * A card's `rank` lets it sit between any two neighbors without renumbering the
 * rest of the lane — the move is a single-row PATCH (see `Issue.rank` in
 * schema.prisma).
 */

/**
 * A new rank that sorts strictly between `prev` and `next` (either may be null
 * for the lane's start/end). Returns undefined if the bounds are invalid (e.g.
 * not-yet-backfilled neighbors), so the caller can fall back to a status-only
 * update rather than throw.
 */
export function rankBetween(
  prev: string | null | undefined,
  next: string | null | undefined,
): string | undefined {
  try {
    return generateKeyBetween(prev ?? null, next ?? null);
  } catch {
    return undefined;
  }
}

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
