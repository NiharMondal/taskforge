import { api, inWorkspace } from "@/lib/axios";
import { getAllPages } from "@/lib/get-all-pages";

import type { ApiResponse } from "@/types/api";

import type { Project } from "../types/project-types";
import { TProjectFormValues } from "../schema/project-schema";

/**
 * Project API layer. All project network calls belong here (AI_GUIDE: never
 * call axios/fetch directly from components).
 *
 * Every function returns the full `ApiResponse` envelope (via `api` in
 * `lib/axios`); hooks unwrap `.data` where only the payload matters.
 *
 * These endpoints are workspace-scoped via the `x-workspace-id` header that the
 * axios interceptor attaches automatically (see `lib/active-workspace`), so the
 * routes themselves carry no workspace id — switching workspaces transparently
 * changes which tenant's projects come back.
 */

/** List all of the workspace's projects (`GET /projects`, every page). */
export async function getProjects(
	workspaceId: string,
): Promise<ApiResponse<Project[]>> {
	return getAllPages<Project>("/projects", inWorkspace(workspaceId));
}

/** Create a project in the active workspace (`POST /projects`). */
export async function createProject(
	workspaceId: string,
	dto: TProjectFormValues,
): Promise<ApiResponse<Project>> {
	return api.post<Project>("/projects", dto, inWorkspace(workspaceId));
}

/**
 * Update a project (`PATCH /projects/:projectId`). All updates use PATCH per
 * AI_GUIDE → "Update always implement PATCH Method"; the project id rides in the
 * route, so only the changed body fields are sent.
 */
export async function updateProject(
	workspaceId: string,
	projectId: string,
	dto: TProjectFormValues,
): Promise<ApiResponse<Project>> {
	return api.patch<Project>(
		`/projects/${projectId}`,
		dto,
		inWorkspace(workspaceId),
	);
}

/** Delete a project with its issues and sprints (`DELETE /projects/:projectId`). */
export async function deleteProject(
	workspaceId: string,
	projectId: string,
): Promise<ApiResponse<Project>> {
	return api.delete<Project>(`/projects/${projectId}`, inWorkspace(workspaceId));
}
