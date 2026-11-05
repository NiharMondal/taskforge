import { isAllowedTransition } from "@taskforge/shared";

import type {
	StatusCategory,
	Workflow,
	WorkflowStatus,
} from "../types/workflow-types";

/**
 * A project's workflow, indexed for the views that render statuses. Every rule
 * reads a status's `category`, never its name: the project names its statuses.
 */
export interface WorkflowView {
	/** In column order. */
	statuses: WorkflowStatus[];
	byId: Map<string, WorkflowStatus>;
	/**
	 * The board's lanes: every status but the BACKLOG-category ones (backlog
	 * work is triage, planned from the backlog and listed on the List tab).
	 */
	boardStatuses: WorkflowStatus[];
	/** Where an issue created without a status lands. */
	defaultStatus: WorkflowStatus | undefined;
	/**
	 * Where work joining a sprint starts: the first UNSTARTED status. The board
	 * creates issues here (it has no backlog lane).
	 */
	firstUnstarted: WorkflowStatus | undefined;
	/** Whether an issue may move `from` → `to` (staying put always may). */
	canMove: (from: string, to: string) => boolean;
	/**
	 * Options for a status picker on an issue in `current`: that status first
	 * — a Select can only show a value that is one of its options — then each
	 * status the workflow lets it move to, in column order.
	 */
	optionsFrom: (current: string) => WorkflowStatus[];
}

export function workflowView(workflow: Workflow): WorkflowView {
	const { statuses, transitions } = workflow;
	const byId = new Map(statuses.map((s) => [s.id, s]));
	const canMove = (from: string, to: string) =>
		isAllowedTransition(transitions, from, to);

	return {
		statuses,
		byId,
		boardStatuses: statuses.filter((s) => s.category !== "BACKLOG"),
		defaultStatus: statuses.find((s) => s.isDefault) ?? statuses[0],
		firstUnstarted: statuses.find((s) => s.category === "UNSTARTED"),
		canMove,
		optionsFrom: (current) => {
			const own = byId.get(current);
			return [
				...(own ? [own] : []),
				...statuses.filter((s) => s.id !== current && canMove(current, s.id)),
			];
		},
	};
}

/** Labels and help text for the categories, in workflow order. */
export const STATUS_CATEGORIES: {
	value: StatusCategory;
	label: string;
	description: string;
}[] = [
	{
		value: "BACKLOG",
		label: "Backlog",
		description:
			"Not committed to yet. Hidden from the board; joining a sprint moves the issue to the first unstarted status.",
	},
	{
		value: "UNSTARTED",
		label: "Unstarted",
		description: "Planned, not begun. Issues created on the board start here.",
	},
	{
		value: "STARTED",
		label: "Started",
		description: "Work in flight.",
	},
	{
		value: "COMPLETED",
		label: "Completed",
		description:
			"Finished. Moving an issue here needs the permission to complete issues, and it stays in its sprint when the sprint ends.",
	},
];

export const CATEGORY_LABELS = Object.fromEntries(
	STATUS_CATEGORIES.map((c) => [c.value, c.label]),
) as Record<StatusCategory, string>;

/**
 * Coarse progress bucket for a status: not started, in flight, or done.
 * Drives the three counts on a backlog sprint header.
 */
export const progressBucket = (
	category: StatusCategory,
): "todo" | "inProgress" | "done" =>
	category === "COMPLETED"
		? "done"
		: category === "STARTED"
			? "inProgress"
			: "todo";
