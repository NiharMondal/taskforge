import { type DateValue, parseDate } from "@internationalized/date";

/** Convert a DateValue (calendar date) to an ISO 8601 string for the API. */
export const toISO = (v: DateValue | null | undefined): string | null =>
	v ? `${v.toString()}T00:00:00.000Z` : null;

/** Convert an ISO string returned by the API back to a DateValue for the date picker. */
export const fromISO = (iso: string | null | undefined): DateValue | null =>
	iso ? parseDate(iso.slice(0, 10)) : null;
