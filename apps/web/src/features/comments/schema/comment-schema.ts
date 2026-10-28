import z from "zod";

/** Mirrors the backend's `MAX_COMMENT_LENGTH`; it counts the editor's HTML. */
export const MAX_COMMENT_LENGTH = 2000;

/**
 * True when the editor's HTML has some text once tags and whitespace are
 * gone — the same check the backend makes (`hasText` in create-comment.dto).
 */
const hasText = (html: string) =>
	html
		.replace(/<[^>]*>/g, "")
		.replace(/&nbsp;|\s/g, "")
		.trim().length > 0;

export const commentSchema = z.object({
	content: z
		.string()
		.max(
			MAX_COMMENT_LENGTH,
			"Comment is too long (formatting counts toward the limit)",
		)
		.refine(hasText, "Write something first"),
});

export type TCommentValues = z.infer<typeof commentSchema>;
