import { apiClient } from "@/lib/axios";

import type { ApiResponse } from "@/types/api";

import type { Project } from "../types/project-types";
import { TProjectFormValues } from "../schema/project-schema";

/**
 * Project API layer. All project network calls belong here (AI_GUIDE: never
 * call axios/fetch directly from components).
 *
 * These endpoints are workspace-scoped via the `x-workspace-id` header that the
 * axios interceptor attaches automatically (see `lib/active-workspace`), so the
 * routes themselves carry no workspace id — switching workspaces transparently
 * changes which tenant's projects come back.
 */

/** List the active workspace's projects (`GET /projects`). */
export async function getProjects(): Promise<Project[]> {
	const { data } = await apiClient.get<ApiResponse<Project[]>>("/projects");
	return data.data;
}

/** Create a project in the active workspace (`POST /projects`). */
export async function createProject(
	dto: TProjectFormValues,
): Promise<ApiResponse<Project>> {
	const data = await apiClient.post("/projects", dto);
	return data.data;
}

/**
 * Update a project (`PATCH /projects/:projectId`). All updates use PATCH per
 * AI_GUIDE → "Update always implement PATCH Method"; the project id rides in the
 * route, so only the changed body fields are sent.
 */
export async function updateProject(
	projectId: string,
	dto: TProjectFormValues,
): Promise<ApiResponse<Project>> {
	const { data } = await apiClient.patch(`/projects/${projectId}`, dto);
	return data.data;
}
