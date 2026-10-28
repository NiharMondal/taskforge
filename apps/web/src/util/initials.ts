/** Initials for an avatar fallback, e.g. "Ada Lovelace" -> "AL"; "?" when empty. */
export function initialsOf(value?: string | null): string {
	if (!value) return "?";
	return (
		value
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((p) => p[0]?.toUpperCase() ?? "")
			.join("") || "?"
	);
}
