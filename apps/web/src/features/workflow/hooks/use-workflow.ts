import { useMemo } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ApiResponse } from "@/types/api";

import {
	createStatus,
	deleteStatus,
	getWorkflow,
	replaceTransitions,
	updateStatus,
} from "../api/workflow-api";
import { workflowView } from "../lib/workflow";
import type {
	CreateStatusDto,
	StatusTransition,
	UpdateStatusDto,
} from "../types/workflow-types";

/** A workflow belongs to one project, so the key names both scopes. */
export const workflowKeys = {
	detail: (workspaceId: string, projectId: string) =>
		["workflow", workspaceId, projectId] as const,
};

/**
 * The project's workflow, raw (`data`) and indexed (`view`, see
 * `workflowView`). Every status-aware view reads it; React Query shares the
 * one request between them.
 */
export function useWorkflow(workspaceId: string, projectId: string) {
	const query = useQuery({
		queryKey: workflowKeys.detail(workspaceId, projectId),
		queryFn: async () => (await getWorkflow(workspaceId, projectId)).data,
		enabled: !!workspaceId && !!projectId,
		staleTime: 60_000,
	});
	const view = useMemo(
		() => (query.data ? workflowView(query.data) : undefined),
		[query.data],
	);
	return { ...query, view };
}

/**
 * Issues embed their status's name and color, and deleting a status moves its
 * issues, so a workflow write refetches the project's issues (and their
 * history, which sits under each issue's key) along with the workflow.
 */
function useWorkflowMutation<TVars, TData>(
	workspaceId: string,
	projectId: string,
	mutationFn: (vars: TVars) => Promise<ApiResponse<TData>>,
) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn,
		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: workflowKeys.detail(workspaceId, projectId),
			});
			queryClient.invalidateQueries({
				queryKey: ["issues", workspaceId, projectId],
			});
		},
	});
}

export function useCreateStatus(workspaceId: string, projectId: string) {
	return useWorkflowMutation(workspaceId, projectId, (dto: CreateStatusDto) =>
		createStatus(workspaceId, projectId, dto),
	);
}

export function useUpdateStatus(workspaceId: string, projectId: string) {
	return useWorkflowMutation(
		workspaceId,
		projectId,
		({ statusId, dto }: { statusId: string; dto: UpdateStatusDto }) =>
			updateStatus(workspaceId, projectId, statusId, dto),
	);
}

export function useDeleteStatus(workspaceId: string, projectId: string) {
	return useWorkflowMutation(
		workspaceId,
		projectId,
		({ statusId, moveTo }: { statusId: string; moveTo?: string }) =>
			deleteStatus(workspaceId, projectId, statusId, moveTo),
	);
}

export function useReplaceTransitions(workspaceId: string, projectId: string) {
	return useWorkflowMutation(
		workspaceId,
		projectId,
		(transitions: StatusTransition[]) =>
			replaceTransitions(workspaceId, projectId, transitions),
	);
}
