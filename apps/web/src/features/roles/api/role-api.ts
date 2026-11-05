import { api, inWorkspace } from "@/lib/axios";

import type { ApiResponse } from "@/types/api";

import type { CreateRoleDto, Role, UpdateRoleDto } from "../types/role-types";

/**
 * Role API layer: `/roles`, scoped to the workspace by header. Any member
 * reads them; writes need `role:manage` and only touch custom roles. Giving a
 * member a role goes through `PATCH /memberships/:userId` (`roleId`).
 */

/** Built-ins first (Owner, Admin, Member, Viewer), then custom by name. */
export async function getRoles(
	workspaceId: string,
): Promise<ApiResponse<Role[]>> {
	return api.get<Role[]>("/roles", inWorkspace(workspaceId));
}

export async function createRole(
	workspaceId: string,
	dto: CreateRoleDto,
): Promise<ApiResponse<Role>> {
	return api.post<Role>("/roles", dto, inWorkspace(workspaceId));
}

export async function updateRole(
	workspaceId: string,
	roleId: string,
	dto: UpdateRoleDto,
): Promise<ApiResponse<Role>> {
	return api.patch<Role>(`/roles/${roleId}`, dto, inWorkspace(workspaceId));
}

/** 409 while members hold it or a pending invitation uses it. */
export async function deleteRole(
	workspaceId: string,
	roleId: string,
): Promise<ApiResponse<Role>> {
	return api.delete<Role>(`/roles/${roleId}`, inWorkspace(workspaceId));
}
