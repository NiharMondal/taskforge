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
