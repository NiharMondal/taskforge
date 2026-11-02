import { api } from "@/lib/axios";

import type { ApiResponse } from "@/types/api";

import type {
	AdminStats,
	AdminUserDetail,
	AdminUserRow,
	AdminUsersQuery,
	AdminWorkspaceDetail,
	AdminWorkspaceRow,
	AdminWorkspacesQuery,
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
