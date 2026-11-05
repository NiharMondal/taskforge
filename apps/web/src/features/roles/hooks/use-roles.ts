import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ApiResponse } from "@/types/api";

import { createRole, deleteRole, getRoles, updateRole } from "../api/role-api";
import type { CreateRoleDto, Role, UpdateRoleDto } from "../types/role-types";

/** Roles are workspace-wide, so the key is the workspace alone. */
export const roleKeys = {
	list: (workspaceId: string) => ["roles", workspaceId] as const,
};

export function useRoles(workspaceId: string) {
	return useQuery({
		queryKey: roleKeys.list(workspaceId),
		queryFn: async () => (await getRoles(workspaceId)).data,
		enabled: !!workspaceId,
		staleTime: 5 * 60 * 1000,
	});
}

/**
 * A role change can change what its holders — the viewer included — may do,
 * and the roster shows role names: refetch the roles and everything under
 * `["memberships", workspaceId]` (the roster and `membershipKeys.me`).
 */
function useRoleMutation<TVars>(
	workspaceId: string,
	mutationFn: (vars: TVars) => Promise<ApiResponse<Role>>,
) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: roleKeys.list(workspaceId) });
			queryClient.invalidateQueries({
				queryKey: ["memberships", workspaceId],
			});
		},
	});
}

export function useCreateRole(workspaceId: string) {
	return useRoleMutation(workspaceId, (dto: CreateRoleDto) =>
		createRole(workspaceId, dto),
	);
}

export function useUpdateRole(workspaceId: string) {
	return useRoleMutation(
		workspaceId,
		({ roleId, dto }: { roleId: string; dto: UpdateRoleDto }) =>
			updateRole(workspaceId, roleId, dto),
	);
}

export function useDeleteRole(workspaceId: string) {
	return useRoleMutation(workspaceId, (roleId: string) =>
		deleteRole(workspaceId, roleId),
	);
}
