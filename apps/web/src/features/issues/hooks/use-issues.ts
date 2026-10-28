import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
	createIssue,
	deleteIssue,
	getIssues,
	getSingleIssue,
	updateIssue,
} from "../api/issue-api";
import type {
	CreateIssueDto,
	Issue,
	UpdateIssueDto,
} from "../types/issue-types";
import { projectKeys } from "@/features/projects/hooks/use-projects";

/**
 * Centralized query keys for the issues feature. Keyed by workspace AND project:
 * issues are scoped by the `x-workspace-id` header *and* the project route, so
 * switching either must land on a different cache entry (and refetch) rather
 * than show the previous scope's issues.
 */
export const issueKeys = {
	list: (workspaceId: string, projectId: string) =>
		["issues", workspaceId, projectId] as const,
	detail: (workspaceId: string, projectId: string, issueId: string) =>
		["issues", workspaceId, projectId, issueId] as const,
};

export function useIssues(workspaceId: string, projectId: string) {
	return useQuery({
		queryKey: issueKeys.list(workspaceId, projectId),
		// Unwrap the ApiResponse envelope so the cache holds a plain Issue[] —
		// the optimistic update in useUpdateIssue depends on that.
		queryFn: async () => (await getIssues(workspaceId, projectId)).data,
		enabled: !!workspaceId && !!projectId,
		// The board and list views share this exact query key, so hopping between
		// them (or remounting) serves the cached list instead of refetching.
		// Mutations invalidate on settle, so the data can't go stale in a way the
		// user would notice.
		staleTime: 60_000,
	});
}
export function useSingleIssue(
	workspaceId: string,
	projectId: string,
	issueId: string,
) {
	return useQuery({
		// Distinct key from the list query — both used to share
		// ["issues", workspaceId, projectId], so loading a single issue
		// overwrote the list cache with one object and the list view then
		// tried to iterate a non-array. Keep the detail entry separate.
		queryKey: issueKeys.detail(workspaceId, projectId, issueId),
		// Unwrap the ApiResponse envelope so the cache holds a plain Issue.
		queryFn: async () =>
			(await getSingleIssue(workspaceId, projectId, issueId)).data,
		enabled: !!workspaceId && !!projectId && !!issueId,
	});
}

export function useCreateIssue(workspaceId: string, projectId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (dto: CreateIssueDto) =>
			createIssue(workspaceId, projectId, dto),
		// Invalidating the list key also refetches every detail entry under it
		// (prefix match), so a parent's sub-issue list picks up a new child.
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: issueKeys.list(workspaceId, projectId),
			});
			// Project cards show an issue count.
			queryClient.invalidateQueries({
				queryKey: projectKeys.list(workspaceId),
			});
		},
	});
}

interface UpdateIssueVars {
	issueId: string;
	dto: UpdateIssueDto;
}

/**
 * Update an issue with an optimistic cache write (AI_GUIDE → "Optimistic
 * Updates"). The list reflects the change instantly; if the PATCH fails we roll
 * back to the pre-mutation snapshot, then refetch on settle to reconcile with
 * the server (e.g. server-side `updatedAt`).
 */
export function useUpdateIssue(workspaceId: string, projectId: string) {
	const queryClient = useQueryClient();
	const key = issueKeys.list(workspaceId, projectId);

	return useMutation({
		mutationFn: ({ issueId, dto }: UpdateIssueVars) =>
			updateIssue(workspaceId, projectId, issueId, dto),

		onMutate: async ({ issueId, dto }) => {
			// Cancel in-flight refetches so they don't clobber the optimistic write.
			await queryClient.cancelQueries({ queryKey: key });
			const previous = queryClient.getQueryData<Issue[]>(key);

			queryClient.setQueryData<Issue[]>(key, (old) =>
				old?.map((issue) =>
					issue.id === issueId ? { ...issue, ...dto } : issue,
				),
			);

			return { previous };
		},

		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(key, context.previous);
			}
		},

		onSettled: (_data, _err, { issueId }) => {
			queryClient.invalidateQueries({ queryKey: key });
			// The detail page reads its own cache entry (useSingleIssue), which the
			// list-only optimistic write above never touches — refetch it so an edit
			// made from the detail view reconciles with the server.
			queryClient.invalidateQueries({
				queryKey: issueKeys.detail(workspaceId, projectId, issueId),
			});
		},
	});
}

/**
 * Delete an issue. On success it is dropped from the list cache at once (so an
 * open detail modal, which reads from the list, closes) and its detail entry is
 * removed rather than refetched into a 404.
 */
export function useDeleteIssue(workspaceId: string, projectId: string) {
	const queryClient = useQueryClient();
	const key = issueKeys.list(workspaceId, projectId);

	return useMutation({
		mutationFn: (issueId: string) =>
			deleteIssue(workspaceId, projectId, issueId),
		onSuccess: (_res, issueId) => {
			queryClient.setQueryData<Issue[]>(key, (old) =>
				old?.filter((issue) => issue.id !== issueId),
			);
			queryClient.removeQueries({
				queryKey: issueKeys.detail(workspaceId, projectId, issueId),
				exact: true,
			});
			queryClient.invalidateQueries({ queryKey: key });
			// Project cards show an issue count.
			queryClient.invalidateQueries({
				queryKey: projectKeys.list(workspaceId),
			});
		},
	});
}
