import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createProject, getProjects } from "../api/project-api";

/** Centralized query keys for the projects feature. */
export const projectKeys = {
  list: (workspaceId: string) => ["projects", workspaceId] as const,
};

/**
 * Projects in a workspace. The request is scoped by the `x-workspace-id` header,
 * but we still key the cache by workspaceId so switching tenants refetches
 * (and never shows the previous workspace's projects from cache).
 */
export function useProjects(workspaceId: string) {
  return useQuery({
    queryKey: projectKeys.list(workspaceId),
    queryFn: getProjects,
    enabled: !!workspaceId,
  });
}

export function useCreateProject(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.list(workspaceId) });
    },
  });
}
