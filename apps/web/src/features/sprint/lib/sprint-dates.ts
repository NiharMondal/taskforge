import { formatDate } from "@/util/format-date";

/**
 * Display a sprint date by its calendar day. Planned dates are stored as UTC
 * midnight, so the `yyyy-MM-dd` prefix is the day the user picked; parsing the
 * full ISO string would shift it a day back west of UTC.
 */
export const formatSprintDay = (
	iso: string | null | undefined,
	pattern = "MMM dd, yyyy",
) => (iso ? formatDate(iso.slice(0, 10), pattern) : null);
