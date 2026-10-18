import { api } from "@/lib/axios";

import type { ApiResponse } from "@/types/api";

import type {
	CreateIssueDto,
	Issue,
	UpdateIssueDto,
} from "../types/issue-types";

/**
 * Issue API layer. All issue network calls belong here (AI_GUIDE: never call
 * axios/fetch directly from components).
 *
 * Every function returns the full `ApiResponse` envelope (via `api` in
 * `lib/axios`); hooks unwrap `.data` where only the payload matters.
 *
 * Issues are project-scoped, so the projectId lives in the route. The workspace
 * is still resolved from the `x-workspace-id` header that the axios interceptor
 * attaches automatically — switching workspaces transparently re-scopes the
 * tenant without touching these paths.
 */

/** Backend's `QueryIssuesDto` maximum for `limit`. */
const ISSUES_PAGE_SIZE = 100;

/**
 * List ALL of a project's issues (`GET /projects/:projectId/issues`).
 *
 * The endpoint is paginated (default 20 per page), but the board and list both
 * render the whole project, so this walks the pages until the backend reports
 * there are no more. The returned envelope is the last page's, with `data`
 * replaced by the concatenation of every page.
 *
 * Stop-gap: it makes one request per 100 issues, serially. The proper fix is
 * per-lane pagination on the board.
 */
export async function getIssues(
	projectId: string,
): Promise<ApiResponse<Issue[]>> {
	const seen = new Set<string>();
	const issues: Issue[] = [];

	let page = 1;
	for (;;) {
		const res = await api.get<Issue[]>(`/projects/${projectId}/issues`, {
			params: { page, limit: ISSUES_PAGE_SIZE },
		});

		// A write landing between page fetches shifts rows across the boundary,
		// so the same issue can show up twice — keep the first copy.
		for (const issue of res.data) {
			if (seen.has(issue.id)) continue;
			seen.add(issue.id);
			issues.push(issue);
		}

		// An empty page ends the walk even if `hasNextPage` lies, so a bad
		// response can't loop forever.
		if (!res.metaData?.hasNextPage || res.data.length === 0) {
			return { ...res, data: issues };
		}
		page += 1;
	}
}
export async function getSingleIssue(
	projectId: string,
	issueId: string,
): Promise<ApiResponse<Issue>> {
	return api.get<Issue>(`/projects/${projectId}/issues/${issueId}`);
}

/** Create an issue in a project (`POST /projects/:projectId/issues`). */
export async function createIssue(
	projectId: string,
	dto: CreateIssueDto,
): Promise<ApiResponse<Issue>> {
	return api.post<Issue>(`/projects/${projectId}/issues`, dto);
}

/**
 * Update an issue (`PATCH /projects/:projectId/issues/:issueId`). All updates
 * use PATCH per AI_GUIDE → "Update always implement PATCH Method".
 */
export async function updateIssue(
	projectId: string,
	issueId: string,
	dto: UpdateIssueDto,
): Promise<ApiResponse<Issue>> {
	return api.patch<Issue>(`/projects/${projectId}/issues/${issueId}`, dto);
}
