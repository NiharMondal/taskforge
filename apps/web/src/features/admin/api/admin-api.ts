import { api } from "@/lib/axios";

import type { ApiResponse } from "@/types/api";

import type {
	AdminReasonDto,
	AdminStats,
	AdminUserDetail,
	AdminUserRow,
	AdminUsersQuery,
	AdminWorkspaceDetail,
	AdminWorkspaceRow,
	AdminWorkspacesQuery,
	PlatformAuditEntry,
	PlatformAuditQuery,
	SetSuspendedDto,
} from "../types/admin-types";

/**
 * The platform admin console's reads (`GET /admin/*`, platform staff only,
 * else 403). Platform-wide, so none of these is pinned to a workspace: the
 * backend ignores `x-workspace-id` here. The lists return one page and its
 * `metaData` — they are never walked like the workspace lists.
 */

export async function getAdminStats(): Promise<ApiResponse<AdminStats>> {
	return api.get<AdminStats>("/admin/stats");
}

export async function getAdminWorkspaces(
	query: AdminWorkspacesQuery,
): Promise<ApiResponse<AdminWorkspaceRow[]>> {
	// axios leaves out undefined params, so no search or plan sends none.
	return api.get<AdminWorkspaceRow[]>("/admin/workspaces", { params: query });
}

export async function getAdminWorkspace(
	workspaceId: string,
): Promise<ApiResponse<AdminWorkspaceDetail>> {
	return api.get<AdminWorkspaceDetail>(
		`/admin/workspaces/${encodeURIComponent(workspaceId)}`,
	);
}

export async function getAdminUsers(
	query: AdminUsersQuery,
): Promise<ApiResponse<AdminUserRow[]>> {
	return api.get<AdminUserRow[]>("/admin/users", { params: query });
}

export async function getAdminUser(
	userId: string,
): Promise<ApiResponse<AdminUserDetail>> {
	return api.get<AdminUserDetail>(
		`/admin/users/${encodeURIComponent(userId)}`,
	);
}

// ---- ADMIN only (SUPPORT gets a 403) ----

const userPath = (userId: string) =>
	`/admin/users/${encodeURIComponent(userId)}`;
const workspacePath = (workspaceId: string) =>
	`/admin/workspaces/${encodeURIComponent(workspaceId)}`;

/** Suspend the account, or lift it. Answers with the updated user. */
export async function setUserSuspended(
	userId: string,
	dto: SetSuspendedDto,
): Promise<ApiResponse<AdminUserDetail>> {
	return api.patch<AdminUserDetail>(userPath(userId), dto);
}

/** End every session the user has; answers how many were still usable. */
export async function revokeUserSessions(
	userId: string,
	dto: AdminReasonDto,
): Promise<ApiResponse<{ revoked: number }>> {
	return api.post<{ revoked: number }>(
		`${userPath(userId)}/revoke-sessions`,
		dto,
	);
}

/** Delete the account. A 409 names workspaces it owns that others use. */
export async function deleteUser(
	userId: string,
	dto: AdminReasonDto,
): Promise<ApiResponse<null>> {
	// axios sends a DELETE body only through `data`.
	return api.delete<null>(userPath(userId), { data: dto });
}

/** Suspend the workspace, or lift it. Answers with the updated workspace. */
export async function setWorkspaceSuspended(
	workspaceId: string,
	dto: SetSuspendedDto,
): Promise<ApiResponse<AdminWorkspaceDetail>> {
	return api.patch<AdminWorkspaceDetail>(workspacePath(workspaceId), dto);
}

/** Delete the workspace; its subscription is canceled with Stripe first. */
export async function deleteWorkspace(
	workspaceId: string,
	dto: AdminReasonDto,
): Promise<ApiResponse<null>> {
	return api.delete<null>(workspacePath(workspaceId), { data: dto });
}

/** One page of the platform audit log, newest first. */
export async function getPlatformAuditLog(
	query: PlatformAuditQuery,
): Promise<ApiResponse<PlatformAuditEntry[]>> {
	return api.get<PlatformAuditEntry[]>("/admin/audit-log", { params: query });
}
