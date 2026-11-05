/**
 * Issue estimates are story points, stored in the API's `timeEstimate` (the
 * column name predates the decision). Forms keep the value as the input's text
 * — "" means not estimated — and convert at the API boundary with these.
 */

/** Form text → API value. Expects text the issue schema already validated. */
export const parseEstimate = (value: string | undefined): number | null =>
	value?.trim() ? Number(value) : null;

/** API value → form text. */
export const formatEstimate = (value: number | null | undefined): string =>
	value == null ? "" : String(value);
