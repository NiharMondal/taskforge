import z from "zod";

export const issueSchema = z.object({
	title: z.string().min(1, "Title is required"),
	description: z.string().optional(),
	status: z.enum([
		"BACKLOG",
		"TODO",
		"IN_PROGRESS",
		"IN_REVIEW",
		"QA_REQUESTED",
		"QA_FAILED",
		"DEPLOYED",
		"DONE",
	]),
	priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
	assigneeId: z.string().nullable().optional(),
	sprintId: z.string().nullable().optional(),
});

export type TIssueFormValues = z.infer<typeof issueSchema>;

/**
 * The detail page splits the single form into two independently-saved sections:
 * the left column edits the issue's content (title + description), the right
 * "Details" panel edits its metadata (status, priority, assignee, sprint).
 */
export const issueContentSchema = issueSchema.pick({
	title: true,
	description: true,
});
export type TIssueContentValues = z.infer<typeof issueContentSchema>;

export const issueDetailsSchema = issueSchema.pick({
	status: true,
	priority: true,
	assigneeId: true,
	sprintId: true,
});
export type TIssueDetailsValues = z.infer<typeof issueDetailsSchema>;
