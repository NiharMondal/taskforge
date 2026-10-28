import type { Issue } from "../types/issue-types";

/** Sentinel filter values (react-aria keys can't be empty). */
export const ALL = "__all__";
export const NO_SPRINT = "__backlog__";

export interface IssueFilters {
	/** Matches the title or the key (`WA-12`), case-insensitively. */
	search: string;
	/** Selected assignee user ids; empty means everyone. */
	assigneeIds: string[];
	/** An `IssueStatus`, or `ALL`. */
	status: string;
	/** A sprint id, `NO_SPRINT` (the backlog), or `ALL`. */
	sprint: string;
}

export const EMPTY_FILTERS: IssueFilters = {
	search: "",
	assigneeIds: [],
	status: ALL,
	sprint: ALL,
};

export const isFiltered = (f: IssueFilters) =>
	f.search.trim() !== "" ||
	f.assigneeIds.length > 0 ||
	f.status !== ALL ||
	f.sprint !== ALL;

/**
 * The issues matching every active filter. Client-side, over the cached
 * project list the List tab and the board share; `projectKey` lets a search
 * for `WA-12` find issue 12.
 */
export function filterIssues(
	issues: Issue[],
	f: IssueFilters,
	projectKey: string | undefined,
): Issue[] {
	if (!isFiltered(f)) return issues;
	const q = f.search.trim().toLowerCase();
	return issues.filter(
		(i) =>
			(!q ||
				i.title.toLowerCase().includes(q) ||
				`${projectKey ?? ""}-${i.number}`.toLowerCase().includes(q)) &&
			(f.assigneeIds.length === 0 ||
				(!!i.assigneeId && f.assigneeIds.includes(i.assigneeId))) &&
			(f.status === ALL || i.status === f.status) &&
			(f.sprint === ALL ||
				(f.sprint === NO_SPRINT ? !i.sprintId : i.sprintId === f.sprint)),
	);
}
