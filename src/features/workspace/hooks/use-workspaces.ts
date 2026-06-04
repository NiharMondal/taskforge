import { useQuery } from "@tanstack/react-query";

import { getWorkspaces } from "../api/workspace-api";

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
    queryFn: getWorkspaces,
    staleTime: 5 * 60 * 1000,
  });
}
