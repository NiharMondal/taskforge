import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getMemberships,
  removeMembership,
  updateMembership,
} from "../api/membership-api";
import type { Member } from "../types/membership-types";
import type { WorkspaceRole } from "@/features/workspace/types/workspace-types";

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

interface UpdateRoleVars {
  userId: string;
  role: WorkspaceRole;
}

/**
 * Change a member's role with an optimistic cache write (AI_GUIDE → "Optimistic
 * Updates"): the roster reflects the new role instantly, rolls back to the
 * snapshot if the PATCH fails, and refetches on settle to reconcile with the
 * server. Mirrors `useUpdateIssue` in the issues feature.
 */
export function useUpdateMembershipRole(workspaceId: string) {
  const queryClient = useQueryClient();
  const key = membershipKeys.list(workspaceId);

  return useMutation({
    mutationFn: ({ userId, role }: UpdateRoleVars) =>
      updateMembership(userId, { role }),

    onMutate: async ({ userId, role }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Member[]>(key);

      queryClient.setQueryData<Member[]>(key, (old) =>
        old?.map((m) => (m.userId === userId ? { ...m, role } : m)),
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
 * Remove a member from the active workspace with an optimistic cache write: the
 * row disappears immediately, is restored if the DELETE fails, and the roster
 * refetches on settle.
 */
export function useRemoveMembership(workspaceId: string) {
  const queryClient = useQueryClient();
  const key = membershipKeys.list(workspaceId);

  return useMutation({
    mutationFn: (userId: string) => removeMembership(userId),

    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Member[]>(key);

      queryClient.setQueryData<Member[]>(key, (old) =>
        old?.filter((m) => m.userId !== userId),
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
