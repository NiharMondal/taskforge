import {
	MAX_DESCRIPTION_LENGTH,
	MAX_NAME_LENGTH,
	MIN_PROJECT_NAME_LENGTH,
} from "@taskforge/shared";
import { z } from "zod";

// Limits are the backend's CreateProjectDto / UpdateProjectDto ones.
export const projectSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Name is required")
		.min(MIN_PROJECT_NAME_LENGTH, `Name must be at least ${MIN_PROJECT_NAME_LENGTH} characters`)
		.max(MAX_NAME_LENGTH, `Name must be at most ${MAX_NAME_LENGTH} characters`),
	description: z
		.string()
		.max(
			MAX_DESCRIPTION_LENGTH,
			`Description must be at most ${MAX_DESCRIPTION_LENGTH} characters`,
		)
		.nullable()
		.optional(),
	/**
	 * Create only: start from a copy of this project's workflow (Pro), or
	 * `DEFAULT_WORKFLOW` for the default. Sent as `workflowFromProjectId`.
	 */
	workflowFrom: z.string().optional(),
});

/** The workflow picker's "start with the default workflow" option. */
export const DEFAULT_WORKFLOW = "__default__";

export type TProjectFormValues = z.infer<typeof projectSchema>;
