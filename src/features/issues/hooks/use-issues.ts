import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createIssue, getIssues, updateIssue } from "../api/issue-api";
import type { CreateIssueDto, Issue, UpdateIssueDto } from "../types/issue-types";

/**
 * Centralized query keys for the issues feature. Keyed by workspace AND project:
 * issues are scoped by the `x-workspace-id` header *and* the project route, so
 * switching either must land on a different cache entry (and refetch) rather
 * than show the previous scope's issues.
 */
export const issueKeys = {
  list: (workspaceId: string, projectId: string) =>
    ["issues", workspaceId, projectId] as const,
};

export function useIssues(workspaceId: string, projectId: string) {
  return useQuery({
    queryKey: issueKeys.list(workspaceId, projectId),
    queryFn: () => getIssues(projectId),
    enabled: !!workspaceId && !!projectId,
  });
}

export function useCreateIssue(workspaceId: string, projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateIssueDto) => createIssue(projectId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: issueKeys.list(workspaceId, projectId),
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
      updateIssue(projectId, issueId, dto),

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

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
