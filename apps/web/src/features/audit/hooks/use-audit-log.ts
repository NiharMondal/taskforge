import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { ApiError } from "@/lib/api-error";

import { getAuditLog } from "../api/audit-api";
import type { AuditEntityType } from "../types/audit-types";

/** Rows per page of the audit log. */
export const AUDIT_PAGE_SIZE = 20;

/**
 * Query keys for the audit log. Every page and filter is its own entry under
 * the workspace, so `all` invalidates them together.
 */
export const auditKeys = {
	all: (workspaceId: string) => ["audit-log", workspaceId] as const,
	list: (
		workspaceId: string,
		{
			page,
			limit,
			entityType,
		}: { page: number; limit: number; entityType: AuditEntityType | null },
	) =>
		["audit-log", workspaceId, entityType ?? "ALL", page, limit] as const,
};

/**
 * One page of the workspace's audit log: `{ entries, meta }`, so the page can
 * render its own paging. The previous page stays on screen while the next one
 * loads. It is always refetched on mount (`staleTime: 0`) rather than
 * invalidated by every mutation that writes a row. A 403 isn't retried — the
 * viewer simply lacks `audit:read`.
 */
export function useAuditLog(
	workspaceId: string,
	{
		page,
		entityType,
		enabled = true,
	}: { page: number; entityType: AuditEntityType | null; enabled?: boolean },
) {
	const limit = AUDIT_PAGE_SIZE;
	return useQuery({
		queryKey: auditKeys.list(workspaceId, { page, limit, entityType }),
		queryFn: async () => {
			const res = await getAuditLog(workspaceId, {
				page,
				limit,
				entityType: entityType ?? undefined,
			});
			return { entries: res.data, meta: res.metaData };
		},
		enabled: enabled && !!workspaceId,
		placeholderData: keepPreviousData,
		staleTime: 0,
		retry: (failureCount, error) =>
			!(error instanceof ApiError && error.status === 403) &&
			failureCount < 1,
	});
}
