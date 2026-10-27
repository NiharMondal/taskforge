import { z } from "zod";

// Limits mirror the backend's CreateProjectDto / UpdateProjectDto.
export const projectSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Name is required")
		.min(2, "Name must be at least 2 characters")
		.max(100, "Name must be at most 100 characters"),
	description: z
		.string()
		.max(500, "Description must be at most 500 characters")
		.nullable()
		.optional(),
});

export type TProjectFormValues = z.infer<typeof projectSchema>;
