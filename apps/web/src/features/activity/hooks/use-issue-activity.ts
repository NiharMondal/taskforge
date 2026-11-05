import { useQuery } from "@tanstack/react-query";

import { issueKeys } from "@/features/issues/hooks/use-issues";

import { getIssueActivity } from "../api/activity-api";

/**
 * The issue's history. Its key sits under the issue's detail key
 * (`issueKeys.activity`), so every issue mutation that refreshes the issue
 * refreshes its history too, with no extra invalidation.
 */
export function useIssueActivity(
	workspaceId: string,
	projectId: string,
	issueId: string,
) {
	return useQuery({
		queryKey: issueKeys.activity(workspaceId, projectId, issueId),
		queryFn: async () =>
			(await getIssueActivity(workspaceId, projectId, issueId)).data,
		enabled: !!workspaceId && !!projectId && !!issueId,
	});
}
