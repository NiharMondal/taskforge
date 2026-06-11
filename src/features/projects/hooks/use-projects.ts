import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createProject, getProjects, updateProject } from "../api/project-api";
import type { Project } from "../types/project-types";
import type { TProjectFormValues } from "../schema/project-schema";

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

interface UpdateProjectVars {
  id: string;
  data: TProjectFormValues;
}

/**
 * Update a project with an optimistic cache write (AI_GUIDE → "Optimistic
 * Updates"). The list reflects the rename instantly; if the PATCH fails we roll
 * back to the pre-mutation snapshot, then refetch on settle to reconcile with
 * the server (e.g. server-side `updatedAt`).
 */
export function useUpdateProject(workspaceId: string) {
  const queryClient = useQueryClient();
  const key = projectKeys.list(workspaceId);

  return useMutation({
    mutationFn: ({ id, data }: UpdateProjectVars) => updateProject(id, data),

    onMutate: async ({ id, data }) => {
      // Cancel in-flight refetches so they don't clobber the optimistic write.
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Project[]>(key);

      queryClient.setQueryData<Project[]>(key, (old) =>
        old?.map((project) =>
          project.id === id ? { ...project, ...data } : project,
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
