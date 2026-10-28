import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getMemberships,
  leaveWorkspace,
  removeMembership,
  transferOwnership,
  updateMembership,
} from "../api/membership-api";
import type { Member } from "../types/membership-types";
import { workspaceKeys } from "@/features/workspace/hooks/use-workspaces";
import type {
  Workspace,
  WorkspaceRole,
} from "@/features/workspace/types/workspace-types";

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
    queryFn: async () => (await getMemberships(workspaceId)).data,
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
      updateMembership(workspaceId, userId, { role }),

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
    mutationFn: (userId: string) => removeMembership(workspaceId, userId),

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

/**
 * Hand the workspace to another member. Two roles change at once (theirs and
 * the caller's), so the roster refetches rather than being patched in place;
 * the permission flags follow it.
 */
export function useTransferOwnership(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => transferOwnership(workspaceId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: membershipKeys.list(workspaceId),
      });
    },
  });
}

/**
 * Leave a workspace. Like deleting one (`useDeleteWorkspace`), it is dropped
 * from the cached list so `WorkspaceProvider` falls back to another, and every
 * query keyed by its id is removed — their requests would now 403.
 */
export function useLeaveWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workspaceId: string) => leaveWorkspace(workspaceId),
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
