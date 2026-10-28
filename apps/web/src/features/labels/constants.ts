/**
 * The colors a label can be given. Stored as hex on the label (user data, so
 * rendered inline rather than through theme tokens); picked mid-range so the
 * dot reads on both the light and the dark theme.
 */
export const LABEL_COLORS = [
	{ value: "#ef4444", name: "Red" },
	{ value: "#f97316", name: "Orange" },
	{ value: "#eab308", name: "Yellow" },
	{ value: "#22c55e", name: "Green" },
	{ value: "#14b8a6", name: "Teal" },
	{ value: "#3b82f6", name: "Blue" },
	{ value: "#8b5cf6", name: "Violet" },
	{ value: "#ec4899", name: "Pink" },
	{ value: "#6b7280", name: "Gray" },
] as const;

export const DEFAULT_LABEL_COLOR = LABEL_COLORS[5].value;

/** Mirrors the backend's `MAX_LABEL_NAME_LENGTH` and `MAX_ISSUE_LABELS`. */
export const MAX_LABEL_NAME_LENGTH = 30;
export const MAX_ISSUE_LABELS = 10;
