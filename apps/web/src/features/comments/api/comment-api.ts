import { api, inWorkspace } from "@/lib/axios";

import type { ApiResponse } from "@/types/api";

import type { CommentDto, IssueComment } from "../types/comment-types";

/**
 * Comment API layer: `/projects/:projectId/issues/:issueId/comments`. Every
 * call is pinned to the workspace its cache entry belongs to.
 */
const commentsPath = (projectId: string, issueId: string) =>
	`/projects/${projectId}/issues/${issueId}/comments`;

/** The issue's comments, oldest first. */
export async function getComments(
	workspaceId: string,
	projectId: string,
	issueId: string,
): Promise<ApiResponse<IssueComment[]>> {
	return api.get<IssueComment[]>(
		commentsPath(projectId, issueId),
		inWorkspace(workspaceId),
	);
}

export async function createComment(
	workspaceId: string,
	projectId: string,
	issueId: string,
	dto: CommentDto,
): Promise<ApiResponse<IssueComment>> {
	return api.post<IssueComment>(
		commentsPath(projectId, issueId),
		dto,
		inWorkspace(workspaceId),
	);
}

/** Author only; the backend answers 403 for anyone else. */
export async function updateComment(
	workspaceId: string,
	projectId: string,
	issueId: string,
	commentId: string,
	dto: CommentDto,
): Promise<ApiResponse<IssueComment>> {
	return api.patch<IssueComment>(
		`${commentsPath(projectId, issueId)}/${commentId}`,
		dto,
		inWorkspace(workspaceId),
	);
}

/** The author, or a role holding `comment:delete:any`. */
export async function deleteComment(
	workspaceId: string,
	projectId: string,
	issueId: string,
	commentId: string,
): Promise<ApiResponse<IssueComment>> {
	return api.delete<IssueComment>(
		`${commentsPath(projectId, issueId)}/${commentId}`,
		inWorkspace(workspaceId),
	);
}
