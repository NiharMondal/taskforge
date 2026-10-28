import { api, inWorkspace } from "@/lib/axios";

import type { ApiResponse } from "@/types/api";

import type { IssueActivity } from "../types/activity-types";

/**
 * An issue's history, oldest first. Read-only: the backend writes it beside
 * each change, so there is nothing to post here.
 */
export async function getIssueActivity(
	workspaceId: string,
	projectId: string,
	issueId: string,
): Promise<ApiResponse<IssueActivity[]>> {
	return api.get<IssueActivity[]>(
		`/projects/${projectId}/issues/${issueId}/activity`,
		inWorkspace(workspaceId),
	);
}
