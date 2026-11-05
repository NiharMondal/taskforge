import z from "zod";

import { MAX_LABEL_NAME_LENGTH } from "../constants";

// Limits mirror the backend's CreateLabelDto (name trimmed, 1–30; hex color).
export const labelSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Name is required")
		.max(
			MAX_LABEL_NAME_LENGTH,
			`Name must be at most ${MAX_LABEL_NAME_LENGTH} characters`,
		),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a color"),
});

export type TLabelFormValues = z.infer<typeof labelSchema>;
