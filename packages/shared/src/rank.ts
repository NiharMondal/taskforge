import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";

/**
 * Board order. `Issue.rank` is a base-62 fractional-indexing key ordering cards
 * within a `(project, status)` lane: a card can sit between any two neighbours
 * without renumbering the lane. The web computes a key on drop and the backend
 * computes one when it appends; both go through these helpers, so the keys
 * stay compatible and `fractional-indexing` is pinned in one place.
 *
 * Keys compare as plain strings in byte order (the column is `COLLATE "C"`).
 */

/**
 * A rank that sorts strictly between `prev` and `next` (either may be null for
 * the lane's start or end), or `undefined` when the bounds can't be built on
 * — not a valid key, or not in order — so the caller can fall back instead of
 * throwing.
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

/** `count` evenly spread ranks between `prev` and `next`; throws on bad bounds. */
export function ranksBetween(
  prev: string | null,
  next: string | null,
  count: number,
): string[] {
  return generateNKeysBetween(prev, next, count);
}

/** Whether a rank is a key the library can build on (a card can follow it). */
export function isValidRank(rank: string): boolean {
  return rankBetween(rank, null) !== undefined;
}
