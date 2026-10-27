import { z } from "zod";

// Limits mirror the backend's CreateWorkspaceDto / UpdateWorkspaceDto.
export const workspaceSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Name is required")
		.min(3, "Name must be at least 3 characters"),
	description: z
		.string()
		.max(500, "Description must be at most 500 characters")
		.nullable()
		.optional(),
});

export type TWorkspaceFormValues = z.infer<typeof workspaceSchema>;
