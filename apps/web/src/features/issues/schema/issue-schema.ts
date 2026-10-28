import z from "zod";

// Limits mirror the backend's CreateIssueDto / UpdateIssueDto, so a form never
// submits something the API answers with a 400.
export const issueSchema = z.object({
	title: z
		.string()
		.trim()
		.min(1, "Title is required")
		.min(2, "Title must be at least 2 characters")
		.max(255, "Title must be at most 255 characters"),
	// Stored as the editor's HTML, which is what the 2000 limit counts —
	// formatting markup included.
	description: z
		.string()
		.max(2000, "Description is too long (formatting counts toward the limit)")
		.optional(),
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

/** The inline "Add sub-issue" field on the issue page: a title, nothing else. */
export const subIssueSchema = issueSchema.pick({ title: true });

export type TSubIssueValues = z.infer<typeof subIssueSchema>;
