import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { ApiError } from "@/lib/api-error";

import {
	getAdminStats,
	getAdminUser,
	getAdminUsers,
	getAdminWorkspace,
	getAdminWorkspaces,
} from "../api/admin-api";
import { ADMIN_PAGE_SIZE } from "../constants";
import type {
	AdminUsersQuery,
	AdminWorkspacesQuery,
} from "../types/admin-types";

/**
 * Query keys for the admin console. Unlike every other feature's keys these
 * carry no workspace id: the data is platform-wide, the same whichever
 * workspace is active. Every page, search and filter is its own entry.
 */
export const adminKeys = {
	all: ["admin"] as const,
	stats: () => [...adminKeys.all, "stats"] as const,
	workspaces: (query: AdminWorkspacesQuery) =>
		[
			...adminKeys.all,
			"workspaces",
			query.search ?? "",
			query.plan ?? "ALL",
			query.page ?? 1,
		] as const,
	workspace: (workspaceId: string) =>
		[...adminKeys.all, "workspace", workspaceId] as const,
	users: (query: AdminUsersQuery) =>
		[...adminKeys.all, "users", query.search ?? "", query.page ?? 1] as const,
	user: (userId: string) => [...adminKeys.all, "user", userId] as const,
};

/**
 * Shared by every admin query: always refetched on mount (staff want the
 * current state, and nothing here is invalidated by a mutation yet), and a
 * 403 or 404 isn't retried.
 */
const ADMIN_QUERY_OPTIONS = {
	staleTime: 0,
	retry: (failureCount: number, error: Error) =>
		!(
			error instanceof ApiError &&
			(error.status === 403 || error.status === 404)
		) && failureCount < 1,
};

export function useAdminStats() {
	return useQuery({
		queryKey: adminKeys.stats(),
		queryFn: async () => (await getAdminStats()).data,
		...ADMIN_QUERY_OPTIONS,
	});
}

/** One page of workspaces: `{ rows, meta }`. The previous page stays while the next loads. */
export function useAdminWorkspaces(query: AdminWorkspacesQuery) {
	const params = { ...query, limit: ADMIN_PAGE_SIZE };
	return useQuery({
		queryKey: adminKeys.workspaces(query),
		queryFn: async () => {
			const res = await getAdminWorkspaces(params);
			return { rows: res.data, meta: res.metaData };
		},
		placeholderData: keepPreviousData,
		...ADMIN_QUERY_OPTIONS,
	});
}

export function useAdminWorkspace(workspaceId: string) {
	return useQuery({
		queryKey: adminKeys.workspace(workspaceId),
		queryFn: async () => (await getAdminWorkspace(workspaceId)).data,
		...ADMIN_QUERY_OPTIONS,
	});
}

/** One page of users: `{ rows, meta }`. */
export function useAdminUsers(query: AdminUsersQuery) {
	const params = { ...query, limit: ADMIN_PAGE_SIZE };
	return useQuery({
		queryKey: adminKeys.users(query),
		queryFn: async () => {
			const res = await getAdminUsers(params);
			return { rows: res.data, meta: res.metaData };
		},
		placeholderData: keepPreviousData,
		...ADMIN_QUERY_OPTIONS,
	});
}

export function useAdminUser(userId: string) {
	return useQuery({
		queryKey: adminKeys.user(userId),
		queryFn: async () => (await getAdminUser(userId)).data,
		...ADMIN_QUERY_OPTIONS,
	});
}
