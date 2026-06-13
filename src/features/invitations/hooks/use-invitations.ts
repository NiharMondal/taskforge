import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { workspaceKeys } from "@/features/workspace/hooks/use-workspaces";

import {
  acceptInvitation,
  createInvitation,
  getInvitations,
} from "../api/invitation-api";

/** Centralized query keys for the invitations feature. */
export const invitationKeys = {
  list: (workspaceId: string) => ["invitations", workspaceId] as const,
};

/**
 * Invitations of a workspace. Keyed by workspaceId so a workspace switch
 * refetches. The `enabled` flag lets callers gate the request on the viewer's
 * role — the endpoint is admin-only, so non-admins should never fire it.
 */
export function useInvitations(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: invitationKeys.list(workspaceId),
    // Unwrap the ApiResponse envelope so the cache holds a plain Invitation[].
    queryFn: async () => (await getInvitations()).data,
    enabled: !!workspaceId && enabled,
    staleTime: 60 * 1000,
  });
}

/**
 * Invite an email into the active workspace. Callers receive the full
 * `ApiResponse` envelope (for the toast message); the invitation list is
 * refetched so the new PENDING row appears.
 */
export function useCreateInvitation(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: invitationKeys.list(workspaceId),
      });
    },
  });
}

/**
 * Accept an invitation by token. Refetches the workspace list so the newly
 * joined workspace shows up in the switcher even if the caller doesn't switch
 * to it explicitly.
 */
export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: acceptInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
}
