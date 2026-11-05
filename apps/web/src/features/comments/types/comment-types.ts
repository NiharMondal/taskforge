import type { ICommonUserEntity } from "@/types/common";

/**
 * A comment on an issue, as the backend's comment routes return it
 * (apps/backend/src/modules/comments/). Named `IssueComment` because the DOM
 * already owns the global `Comment` type.
 */
export interface IssueComment {
	id: string;
	/** HTML from the rich-text editor, stored as sent — sanitize before rendering. */
	content: string;
	issueId: string;
	/** The author; `null` once their account is deleted (the comment stays). */
	userId: string | null;
	user: ICommonUserEntity | null;
	createdAt: string;
	updatedAt: string;
}

/** Body of both POST and PATCH: a comment's only field. */
export interface CommentDto {
	content: string;
}
