import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ApiResponse } from "@/types/api";

import {
	createLabel,
	deleteLabel,
	getLabels,
	updateLabel,
} from "../api/label-api";
import type {
	CreateLabelDto,
	Label,
	UpdateLabelDto,
} from "../types/label-types";

/** Labels are workspace-wide, so the key is the workspace alone. */
export const labelKeys = {
	list: (workspaceId: string) => ["labels", workspaceId] as const,
};

export function useLabels(workspaceId: string) {
	return useQuery({
		queryKey: labelKeys.list(workspaceId),
		queryFn: async () => (await getLabels(workspaceId)).data,
		enabled: !!workspaceId,
	});
}

/**
 * Issues embed their labels, so renaming, recoloring or deleting one changes
 * every project's issue list: refetch them all. `["issues", workspaceId]` is
 * the prefix of each project's `issueKeys.list` and `.detail`.
 */
function useLabelMutation<TVars>(
	workspaceId: string,
	mutationFn: (vars: TVars) => Promise<ApiResponse<Label>>,
	{ touchesIssues }: { touchesIssues: boolean },
) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: labelKeys.list(workspaceId) });
			if (touchesIssues) {
				queryClient.invalidateQueries({ queryKey: ["issues", workspaceId] });
			}
		},
	});
}

export function useCreateLabel(workspaceId: string) {
	return useLabelMutation(
		workspaceId,
		(dto: CreateLabelDto) => createLabel(workspaceId, dto),
		// A new label isn't on any issue yet.
		{ touchesIssues: false },
	);
}

export function useUpdateLabel(workspaceId: string) {
	return useLabelMutation(
		workspaceId,
		({ labelId, dto }: { labelId: string; dto: UpdateLabelDto }) =>
			updateLabel(workspaceId, labelId, dto),
		{ touchesIssues: true },
	);
}

export function useDeleteLabel(workspaceId: string) {
	return useLabelMutation(
		workspaceId,
		(labelId: string) => deleteLabel(workspaceId, labelId),
		{ touchesIssues: true },
	);
}
