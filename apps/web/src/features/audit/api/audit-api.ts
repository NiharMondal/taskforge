import { api, inWorkspace } from "@/lib/axios";

import type { ApiResponse } from "@/types/api";

import type { AuditLogEntry, AuditLogQuery } from "../types/audit-types";

/**
 * One page of the workspace's audit log, newest first (`audit:read`, else
 * 403). Unlike the other lists this does not walk every page: the log only
 * grows, and the page shows it a page at a time from `metaData`, so the whole
 * envelope is returned.
 */
export async function getAuditLog(
	workspaceId: string,
	{ page, limit, entityType }: AuditLogQuery = {},
): Promise<ApiResponse<AuditLogEntry[]>> {
	return api.get<AuditLogEntry[]>(
		"/audit-log",
		// axios leaves out undefined params, so "all types" sends no filter.
		inWorkspace(workspaceId, { params: { page, limit, entityType } }),
	);
}
