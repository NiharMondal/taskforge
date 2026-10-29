import z from "zod";

import { MAX_STATUS_NAME_LENGTH, STATUS_CATEGORY_VALUES } from "@taskforge/shared";

// Limits mirror the backend's CreateWorkflowStatusDto (name trimmed, 1–30;
// hex color; one of the four categories).
export const statusSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Name is required")
		.max(
			MAX_STATUS_NAME_LENGTH,
			`Name must be at most ${MAX_STATUS_NAME_LENGTH} characters`,
		),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a color"),
	category: z.enum(STATUS_CATEGORY_VALUES),
});

export type TStatusFormValues = z.infer<typeof statusSchema>;
