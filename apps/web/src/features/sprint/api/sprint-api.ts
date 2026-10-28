import { api, inWorkspace } from "@/lib/axios";
import type { ApiResponse } from "@/types/api";
import type { Sprint, CreateSprintDto, UpdateSprintDto } from "../types/sprint-types";

/** List all sprints for a project (`GET /projects/:projectId/sprints`). */
export async function getSprints(
	workspaceId: string,
	projectId: string,
): Promise<ApiResponse<Sprint[]>> {
	return api.get<Sprint[]>(
		`/projects/${projectId}/sprints`,
		inWorkspace(workspaceId),
	);
}

/** Create a sprint in a project (`POST /projects/:projectId/sprints`). */
export async function createSprint(
	workspaceId: string,
	projectId: string,
	dto: CreateSprintDto,
): Promise<ApiResponse<Sprint>> {
	return api.post<Sprint>(
		`/projects/${projectId}/sprints`,
		dto,
		inWorkspace(workspaceId),
	);
}

/** Update a sprint (`PATCH /projects/:projectId/sprints/:sprintId`). */
export async function updateSprint(
	workspaceId: string,
	projectId: string,
	sprintId: string,
	dto: UpdateSprintDto,
): Promise<ApiResponse<Sprint>> {
	return api.patch<Sprint>(
		`/projects/${projectId}/sprints/${sprintId}`,
		dto,
		inWorkspace(workspaceId),
	);
}

/**
 * Start a sprint (`PATCH /projects/:projectId/sprints/:sprintId/start`). The
 * backend allows one active sprint per project and stamps `startDate` with now.
 */
export async function startSprint(
	workspaceId: string,
	projectId: string,
	sprintId: string,
): Promise<ApiResponse<Sprint>> {
	return api.patch<Sprint>(
		`/projects/${projectId}/sprints/${sprintId}/start`,
		undefined,
		inWorkspace(workspaceId),
	);
}

/**
 * End the active sprint (`PATCH /projects/:projectId/sprints/:sprintId/end`).
 * The backend stamps `endDate` with now and takes the sprint's unfinished
 * issues out of it.
 */
export async function endSprint(
	workspaceId: string,
	projectId: string,
	sprintId: string,
): Promise<ApiResponse<Sprint>> {
	return api.patch<Sprint>(
		`/projects/${projectId}/sprints/${sprintId}/end`,
		undefined,
		inWorkspace(workspaceId),
	);
}
