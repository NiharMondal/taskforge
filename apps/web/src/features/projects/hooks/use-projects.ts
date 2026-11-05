import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { issueKeys } from "@/features/issues/hooks/use-issues";
import { sprintKeys } from "@/features/sprint/hooks/use-sprints";

import {
  createProject,
  deleteProject,
  getProjects,
  updateProject,
} from "../api/project-api";
import type { CreateProjectDto, Project } from "../types/project-types";
import type { TProjectFormValues } from "../schema/project-schema";

/** Centralized query keys for the projects feature. */
export const projectKeys = {
  list: (workspaceId: string) => ["projects", workspaceId] as const,
};

/**
 * Projects in a workspace. The request is pinned to the same `workspaceId` the
 * cache is keyed by, so a response can't be stored under another tenant's key
 * even if the active workspace changes while it is in flight.
 *
 * The queryFn unwraps the `ApiResponse` envelope so the cache holds a plain
 * `Project[]` — the optimistic update in `useUpdateProject` depends on that.
 */
export function useProjects(workspaceId: string) {
  return useQuery({
    queryKey: projectKeys.list(workspaceId),
    queryFn: async () => (await getProjects(workspaceId)).data,
    enabled: !!workspaceId,
  });
}

export function useCreateProject(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateProjectDto) => createProject(workspaceId, dto),
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
    mutationFn: ({ id, data }: UpdateProjectVars) =>
      updateProject(workspaceId, id, data),

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

/**
 * Delete a project. The backend cascades its issues and sprints, so their
 * cache entries are dropped too instead of lingering under a dead project id.
 */
export function useDeleteProject(workspaceId: string) {
  const queryClient = useQueryClient();
  const key = projectKeys.list(workspaceId);

  return useMutation({
    mutationFn: (projectId: string) => deleteProject(workspaceId, projectId),
    onSuccess: (_res, projectId) => {
      queryClient.setQueryData<Project[]>(key, (old) =>
        old?.filter((project) => project.id !== projectId),
      );
      queryClient.removeQueries({
        queryKey: issueKeys.list(workspaceId, projectId),
      });
      queryClient.removeQueries({
        queryKey: sprintKeys.list(workspaceId, projectId),
      });
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
