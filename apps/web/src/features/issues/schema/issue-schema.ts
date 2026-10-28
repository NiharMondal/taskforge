import {
	ISSUE_PRIORITY_VALUES,
	ISSUE_STATUS_VALUES,
	ISSUE_TYPE_VALUES,
	MAX_ISSUE_DESCRIPTION_LENGTH,
	MAX_ISSUE_LABELS,
	MAX_ISSUE_TITLE_LENGTH,
	MAX_STORY_POINTS,
	MIN_ISSUE_TITLE_LENGTH,
} from "@taskforge/shared";
import z from "zod";

// Limits are the backend DTOs' own (`@taskforge/shared`), so a form never
// submits something the API answers with a 400.
export const issueSchema = z.object({
	title: z
		.string()
		.trim()
		.min(1, "Title is required")
		.min(
			MIN_ISSUE_TITLE_LENGTH,
			`Title must be at least ${MIN_ISSUE_TITLE_LENGTH} characters`,
		)
		.max(
			MAX_ISSUE_TITLE_LENGTH,
			`Title must be at most ${MAX_ISSUE_TITLE_LENGTH} characters`,
		),
	// Stored as the editor's HTML, which is what the limit counts —
	// formatting markup included.
	description: z
		.string()
		.max(
			MAX_ISSUE_DESCRIPTION_LENGTH,
			"Description is too long (formatting counts toward the limit)",
		)
		.optional(),
	status: z.enum(ISSUE_STATUS_VALUES),
	priority: z.enum(ISSUE_PRIORITY_VALUES),
	// SUBTASK is here so a sub-issue's details form can hold its type; the
	// selects never offer it and the backend refuses it.
	type: z.enum(ISSUE_TYPE_VALUES),
	// Story points as the input's text ("" = not estimated); converted with
	// `parseEstimate` before it is sent.
	timeEstimate: z
		.string()
		.trim()
		.regex(/^\d*$/, "Enter a whole number of points")
		.refine(
			(v) => v === "" || Number(v) <= MAX_STORY_POINTS,
			`At most ${MAX_STORY_POINTS} points`,
		),
	assigneeId: z.string().nullable().optional(),
	sprintId: z.string().nullable().optional(),
	labelIds: z
		.array(z.string())
		.max(MAX_ISSUE_LABELS, `At most ${MAX_ISSUE_LABELS} labels`),
});

export type TIssueFormValues = z.infer<typeof issueSchema>;

/**
 * The detail page splits the single form into two independently-saved sections:
 * the left column edits the issue's content (title + description), the right
 * "Details" panel edits its metadata (status, priority, type, estimate,
 * assignee, sprint, labels).
 */
export const issueContentSchema = issueSchema.pick({
	title: true,
	description: true,
});
export type TIssueContentValues = z.infer<typeof issueContentSchema>;

export const issueDetailsSchema = issueSchema.pick({
	status: true,
	priority: true,
	type: true,
	timeEstimate: true,
	assigneeId: true,
	sprintId: true,
	labelIds: true,
});
export type TIssueDetailsValues = z.infer<typeof issueDetailsSchema>;

/** The inline "Add sub-issue" field on the issue page: a title, nothing else. */
export const subIssueSchema = issueSchema.pick({ title: true });

export type TSubIssueValues = z.infer<typeof subIssueSchema>;
