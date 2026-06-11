import { api } from "@/lib/axios";

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

/** List a project's issues (`GET /projects/:projectId/issues`). */
export async function getIssues(
	projectId: string,
): Promise<ApiResponse<Issue[]>> {
	return api.get<Issue[]>(`/projects/${projectId}/issues`);
}

/** Create an issue in a project (`POST /projects/:projectId/issues`). */
export async function createIssue(
	projectId: string,
	dto: CreateIssueDto,
): Promise<ApiResponse<Issue>> {
	return api.post<Issue>(`/projects/${projectId}/issues`, dto);
}

/**
 * Update an issue (`PATCH /projects/:projectId/issues/:issueId`). All updates
 * use PATCH per AI_GUIDE → "Update always implement PATCH Method".
 */
export async function updateIssue(
	projectId: string,
	issueId: string,
	dto: UpdateIssueDto,
): Promise<ApiResponse<Issue>> {
	return api.patch<Issue>(`/projects/${projectId}/issues/${issueId}`, dto);
}
