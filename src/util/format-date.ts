import { format, isValid, parse, parseISO } from "date-fns";

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
