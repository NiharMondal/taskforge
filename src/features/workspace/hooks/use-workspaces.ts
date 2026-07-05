import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createWorkspace,
  getWorkspaces,
  updateWorkspace,
} from "../api/workspace-api";
import type { TWorkspaceFormValues } from "../schema/workspace-schema";

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
