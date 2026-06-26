import z from "zod";

export const issueSchema = z.object({
	title: z.string().min(1, "Title is required"),
	description: z.string().optional(),
	status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]),
	priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
	assigneeId: z.string().nullable().optional(),
	sprintId: z.string().nullable().optional(),
});

export type TIssueFormValues = z.infer<typeof issueSchema>;
