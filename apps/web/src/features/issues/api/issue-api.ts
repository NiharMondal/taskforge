import { api, inWorkspace } from "@/lib/axios";
import { getAllPages } from "@/lib/get-all-pages";

import type { ApiResponse } from "@/types/api";

import type {
	CreateIssueDto,
	Issue,
	UpdateIssueDto,
} from "../types/issue-types";

/**
 * Issue API layer. All issue network calls belong here (AI_GUIDE: never call
 * axios/fetch directly from components).
 *
 * Every function returns the full `ApiResponse` envelope (via `api` in
 * `lib/axios`); hooks unwrap `.data` where only the payload matters.
 *
 * Issues are project-scoped, so the projectId lives in the route. The workspace
 * is still resolved from the `x-workspace-id` header that the axios interceptor
 * attaches automatically — switching workspaces transparently re-scopes the
 * tenant without touching these paths.
 */

/**
 * List ALL of a project's issues (`GET /projects/:projectId/issues`).
 *
 * The endpoint is paginated (default 20 per page), but the board and list both
 * render the whole project, so this walks every page (`getAllPages`).
 *
 * Stop-gap: it makes one request per 100 issues, serially. The proper fix is
 * per-lane pagination on the board.
 */
export async function getIssues(
	workspaceId: string,
	projectId: string,
): Promise<ApiResponse<Issue[]>> {
	return getAllPages<Issue>(
		`/projects/${projectId}/issues`,
		inWorkspace(workspaceId),
	);
}
export async function getSingleIssue(
	workspaceId: string,
	projectId: string,
	issueId: string,
): Promise<ApiResponse<Issue>> {
	return api.get<Issue>(
		`/projects/${projectId}/issues/${issueId}`,
		inWorkspace(workspaceId),
	);
}

/** Create an issue in a project (`POST /projects/:projectId/issues`). */
export async function createIssue(
	workspaceId: string,
	projectId: string,
	dto: CreateIssueDto,
): Promise<ApiResponse<Issue>> {
	return api.post<Issue>(
		`/projects/${projectId}/issues`,
		dto,
		inWorkspace(workspaceId),
	);
}

/**
 * Update an issue (`PATCH /projects/:projectId/issues/:issueId`). All updates
 * use PATCH per AI_GUIDE → "Update always implement PATCH Method".
 */
export async function updateIssue(
	workspaceId: string,
	projectId: string,
	issueId: string,
	dto: UpdateIssueDto,
): Promise<ApiResponse<Issue>> {
	return api.patch<Issue>(
		`/projects/${projectId}/issues/${issueId}`,
		dto,
		inWorkspace(workspaceId),
	);
}

/** Delete an issue (`DELETE /projects/:projectId/issues/:issueId`). */
export async function deleteIssue(
	workspaceId: string,
	projectId: string,
	issueId: string,
): Promise<ApiResponse<Issue>> {
	return api.delete<Issue>(
		`/projects/${projectId}/issues/${issueId}`,
		inWorkspace(workspaceId),
	);
}
