import { useQuery } from "@tanstack/react-query";

import { getMemberships } from "../api/membership-api";

/** Centralized query keys for the memberships feature. */
export const membershipKeys = {
  list: (workspaceId: string) => ["memberships", workspaceId] as const,
};

/**
 * Members of a workspace. Keyed by workspaceId so a workspace switch refetches.
 * The roster changes rarely, so it stays fresh for 5 minutes.
 */
export function useMemberships(workspaceId: string) {
  return useQuery({
    queryKey: membershipKeys.list(workspaceId),
    // Unwrap the ApiResponse envelope so the cache holds a plain Member[].
    queryFn: async () => (await getMemberships()).data,
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
  });
}
