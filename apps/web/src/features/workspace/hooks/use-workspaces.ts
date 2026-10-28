import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createWorkspace,
  deleteWorkspace,
  getWorkspaces,
  updateWorkspace,
} from "../api/workspace-api";
import type { TWorkspaceFormValues } from "../schema/workspace-schema";
import type { Workspace } from "../types/workspace-types";

/** Centralized query keys for the workspace feature. */
export const workspaceKeys = {
  all: ["workspaces"] as const,
};

/**
 * Server-state hook for the current user's workspaces (AI_GUIDE: React Query
 * owns server state). The list rarely changes, so it stays fresh for 5 minutes.
 */
export function useWorkspaces() {
  return useQuery({
    queryKey: workspaceKeys.all,
    // Unwrap the ApiResponse envelope so the cache holds a plain Workspace[].
    queryFn: async () => (await getWorkspaces()).data,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Create a workspace. Callers receive the full `ApiResponse` envelope (for the
 * toast message and the new workspace's id); the workspace list is refetched so
 * the switcher and the context's quota check pick it up.
 */
export function useCreateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createWorkspace,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
}

interface UpdateWorkspaceVars {
  workspaceId: string;
  dto: TWorkspaceFormValues;
}

/**
 * Rename / re-describe a workspace. Callers receive the full `ApiResponse`
 * envelope (for the toast message); the workspace list is refetched so the
 * switcher and `useWorkspace` context pick up the new name immediately.
 */
export function useUpdateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workspaceId, dto }: UpdateWorkspaceVars) =>
      updateWorkspace(workspaceId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
}

/**
 * Delete a workspace. It is dropped from the cached list on success, so
 * `WorkspaceProvider` falls back to another workspace on the same render, and
 * every query keyed by its id is removed (their requests would now 403).
 */
export function useDeleteWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workspaceId: string) => deleteWorkspace(workspaceId),
    onSuccess: (_res, workspaceId) => {
      queryClient.setQueryData<Workspace[]>(workspaceKeys.all, (old) =>
        old?.filter((workspace) => workspace.id !== workspaceId),
      );
      queryClient.removeQueries({
        predicate: (query) => query.queryKey.includes(workspaceId),
      });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
}
