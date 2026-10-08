import { api } from "@/lib/axios";
import type { ApiResponse } from "@/types/api";
import type { Sprint, CreateSprintDto, UpdateSprintDto } from "../types/sprint-types";

/** List all sprints for a project (`GET /projects/:projectId/sprints`). */
export async function getSprints(
	projectId: string,
): Promise<ApiResponse<Sprint[]>> {
	return api.get<Sprint[]>(`/projects/${projectId}/sprints`);
}

/** Create a sprint in a project (`POST /projects/:projectId/sprints`). */
export async function createSprint(
	projectId: string,
	dto: CreateSprintDto,
): Promise<ApiResponse<Sprint>> {
	return api.post<Sprint>(`/projects/${projectId}/sprints`, dto);
}

/** Update a sprint (`PATCH /projects/:projectId/sprints/:sprintId`). */
export async function updateSprint(
	projectId: string,
	sprintId: string,
	dto: UpdateSprintDto,
): Promise<ApiResponse<Sprint>> {
	return api.patch<Sprint>(`/projects/${projectId}/sprints/${sprintId}`, dto);
}

/**
 * Start a sprint (`PATCH /projects/:projectId/sprints/:sprintId/start`). The
 * backend allows one active sprint per project and stamps `startDate` with now.
 */
export async function startSprint(
	projectId: string,
	sprintId: string,
): Promise<ApiResponse<Sprint>> {
	return api.patch<Sprint>(
		`/projects/${projectId}/sprints/${sprintId}/start`,
	);
}

/**
 * End the active sprint (`PATCH /projects/:projectId/sprints/:sprintId/end`).
 * The backend stamps `endDate` with now and takes the sprint's unfinished
 * issues out of it.
 */
export async function endSprint(
	projectId: string,
	sprintId: string,
): Promise<ApiResponse<Sprint>> {
	return api.patch<Sprint>(`/projects/${projectId}/sprints/${sprintId}/end`);
}
