import { api, inWorkspace } from "@/lib/axios";

import type { ApiResponse } from "@/types/api";

import type {
	CreateStatusDto,
	StatusTransition,
	UpdateStatusDto,
	Workflow,
	WorkflowStatus,
} from "../types/workflow-types";

/**
 * Workflow API layer: `/projects/:projectId/workflow`. Any member reads it;
 * writes need `project:manage` and the Pro plan (a Free workspace gets a 402
 * `PLAN_LIMIT` with `limit: "customWorkflows"`).
 */

export async function getWorkflow(
	workspaceId: string,
	projectId: string,
): Promise<ApiResponse<Workflow>> {
	return api.get<Workflow>(
		`/projects/${projectId}/workflow`,
		inWorkspace(workspaceId),
	);
}

export async function createStatus(
	workspaceId: string,
	projectId: string,
	dto: CreateStatusDto,
): Promise<ApiResponse<WorkflowStatus>> {
	return api.post<WorkflowStatus>(
		`/projects/${projectId}/workflow/statuses`,
		dto,
		inWorkspace(workspaceId),
	);
}

export async function updateStatus(
	workspaceId: string,
	projectId: string,
	statusId: string,
	dto: UpdateStatusDto,
): Promise<ApiResponse<WorkflowStatus>> {
	return api.patch<WorkflowStatus>(
		`/projects/${projectId}/workflow/statuses/${statusId}`,
		dto,
		inWorkspace(workspaceId),
	);
}

/** A status with issues needs `moveTo`: where they go (appended to its lane). */
export async function deleteStatus(
	workspaceId: string,
	projectId: string,
	statusId: string,
	moveTo?: string,
): Promise<ApiResponse<WorkflowStatus>> {
	return api.delete<WorkflowStatus>(
		`/projects/${projectId}/workflow/statuses/${statusId}`,
		inWorkspace(workspaceId, moveTo ? { params: { moveTo } } : {}),
	);
}

/** Replaces every move the project allows. */
export async function replaceTransitions(
	workspaceId: string,
	projectId: string,
	transitions: StatusTransition[],
): Promise<ApiResponse<StatusTransition[]>> {
	return api.patch<StatusTransition[]>(
		`/projects/${projectId}/workflow/transitions`,
		{ transitions },
		inWorkspace(workspaceId),
	);
}
