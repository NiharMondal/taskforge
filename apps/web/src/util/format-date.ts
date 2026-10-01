import { format, isValid, parse, parseISO } from "date-fns";
import { parseDate, type CalendarDate } from "@internationalized/date";

type DateInput = Date | string | number;

type DateFormat =
	| "dd-MM-yyyy"
	| "MM-dd"
	| "yyyy-MM-dd"
	| "dd/MM/yyyy"
	| "MMM dd, yyyy"
	| "MMMM dd, yyyy"
	| "dd MMM yyyy"
	| "dd MMM yyyy, hh:mm a"
	| "hh:mm a"
	| "EEEE"
	| "EEEE, MMMM dd"
	| (string & {});

export function formatDate(
	date: DateInput,
	outputFormat: DateFormat = "dd-MM-yyyy",
	fallback = "",
): string {
	if (!date) return fallback;

	let parsedDate: Date;

	if (date instanceof Date) {
		parsedDate = date;
	} else if (typeof date === "number") {
		parsedDate = new Date(date);
	} else {
		const value = date.trim();

		// ISO string or yyyy-MM-dd
		if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
			parsedDate = parseISO(value);
		}
		// d-M-yyyy or dd-MM-yyyy
		else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(value)) {
			parsedDate = parse(value, "d-M-yyyy", new Date());
		}
		// Fallback
		else {
			parsedDate = new Date(value);
		}
	}

	if (!isValid(parsedDate)) {
		return fallback;
	}

	return format(parsedDate, outputFormat);
}

/**
 * Convert a JS `Date` into an `@internationalized/date` `CalendarDate`,
 * the value type HeroUI's DatePicker / Calendar expects for `minValue`/`maxValue`.
 * Uses date-fns to normalize the date to a local `yyyy-MM-dd` string first,
 * so timezone offsets never shift the calendar day.
 */
export function toCalendarDate(date: DateInput): CalendarDate | undefined {
	const parsedDate = date instanceof Date ? date : new Date(date);
	if (!isValid(parsedDate)) return undefined;
	return parseDate(format(parsedDate, "yyyy-MM-dd"));
}
