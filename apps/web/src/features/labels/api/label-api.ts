import { api, inWorkspace } from "@/lib/axios";

import type { ApiResponse } from "@/types/api";

import type {
	CreateLabelDto,
	Label,
	UpdateLabelDto,
} from "../types/label-types";

/**
 * Label API layer: `/labels`, scoped to the workspace by header. Reading is
 * open to every member; writes need `label:manage`. Putting labels on an
 * issue goes through the issue routes (`labelIds`), not here.
 */

/** The workspace's labels, alphabetically, each with its issue count. */
export async function getLabels(
	workspaceId: string,
): Promise<ApiResponse<Label[]>> {
	return api.get<Label[]>("/labels", inWorkspace(workspaceId));
}

export async function createLabel(
	workspaceId: string,
	dto: CreateLabelDto,
): Promise<ApiResponse<Label>> {
	return api.post<Label>("/labels", dto, inWorkspace(workspaceId));
}

export async function updateLabel(
	workspaceId: string,
	labelId: string,
	dto: UpdateLabelDto,
): Promise<ApiResponse<Label>> {
	return api.patch<Label>(`/labels/${labelId}`, dto, inWorkspace(workspaceId));
}

/** Also takes the label off every issue that carries it. */
export async function deleteLabel(
	workspaceId: string,
	labelId: string,
): Promise<ApiResponse<Label>> {
	return api.delete<Label>(`/labels/${labelId}`, inWorkspace(workspaceId));
}
