import type { Chip } from "@heroui/react";
import type { ComponentProps } from "react";

import type { IssuePriority, IssueStatus } from "./types/issue-types";

/**
 * Display metadata for issue enums. Centralized here so chips, selects, and the
 * status-grouped list all agree on label, ordering, and color — change it once.
 *
 * Colors use HeroUI's semantic Chip palette (accent | danger | success |
 * warning | default), never raw Tailwind colors (see memory: HeroUI 3 tokens).
 */

type ChipColor = NonNullable<ComponentProps<typeof Chip>["color"]>;

interface StatusMeta {
	value: IssueStatus;
	label: string;
	color: ChipColor;
}

interface PriorityMeta {
	value: IssuePriority;
	label: string;
	color: ChipColor;
}

/**
 * Every issue status, ordered left-to-right as work flows (backlog → done).
 * This is the full set — the issue list groups by it so *all* data is visible,
 * and it drives the create form. Status *changes* go through
 * {@link STATUS_TRANSITIONS} instead, which only allows the next step.
 */
export const ISSUE_STATUSES: StatusMeta[] = [
	{ value: "BACKLOG", label: "Backlog", color: "default" },
	{ value: "TODO", label: "To Do", color: "default" },
	{ value: "IN_PROGRESS", label: "In Progress", color: "accent" },
	{ value: "IN_REVIEW", label: "In Review", color: "warning" },
	{ value: "QA_REQUESTED", label: "QA Requested", color: "warning" },
	{ value: "QA_FAILED", label: "QA Failed", color: "danger" },
	{ value: "DEPLOYED", label: "Deployed", color: "accent" },
	{ value: "DONE", label: "Done", color: "success" },
];

/**
 * Lanes shown on the Kanban board. Backlog is a triage queue, not active work,
 * so the board starts at "To Do" — backlog issues live on the list view only.
 */
export const BOARD_STATUSES: StatusMeta[] = ISSUE_STATUSES.filter(
	(s) => s.value !== "BACKLOG",
);

/** Ordered most-urgent-first for the create form's default ordering. */
export const ISSUE_PRIORITIES: PriorityMeta[] = [
	{ value: "URGENT", label: "Urgent", color: "danger" },
	{ value: "HIGH", label: "High", color: "warning" },
	{ value: "MEDIUM", label: "Medium", color: "accent" },
	{ value: "LOW", label: "Low", color: "default" },
];

export const STATUS_META: Record<IssueStatus, StatusMeta> = Object.fromEntries(
	ISSUE_STATUSES.map((s) => [s.value, s]),
) as Record<IssueStatus, StatusMeta>;

export const PRIORITY_META: Record<IssuePriority, PriorityMeta> =
	Object.fromEntries(ISSUE_PRIORITIES.map((p) => [p.value, p])) as Record<
		IssuePriority,
		PriorityMeta
	>;

/**
 * Legal forward transitions out of each status. The workflow is a single line —
 * backlog → todo → in progress → in review → qa requested → deployed → done —
 * so each status offers exactly one next step, with two deliberate exceptions:
 *
 * - `QA_REQUESTED` is the only fork: QA either passes it (`DEPLOYED`) or fails
 *   it (`QA_FAILED`).
 * - `QA_FAILED` goes *back* to `IN_PROGRESS`. A failed issue belongs to its
 *   assignee again, so picking the work back up is the only move available.
 *
 * `DONE` is terminal. Status Selects read this instead of {@link ISSUE_STATUSES}
 * so an issue can't skip stages; the full list is still what the issue list
 * groups by, since every status has to be *displayable* even when unreachable
 * from the issue in hand.
 */
export const STATUS_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
	BACKLOG: ["TODO"],
	TODO: ["IN_PROGRESS"],
	IN_PROGRESS: ["IN_REVIEW"],
	IN_REVIEW: ["QA_REQUESTED"],
	QA_REQUESTED: ["QA_FAILED", "DEPLOYED"],
	QA_FAILED: ["IN_PROGRESS"],
	DEPLOYED: ["DONE"],
	DONE: [],
};

/**
 * Options for a status Select on an issue currently in `status`: that status
 * first — a Select can only render a value that is one of its options — then
 * each legal next status. A single-entry result means the issue is terminal and
 * the caller should disable the control.
 */
export const statusOptionsFor = (status: IssueStatus): StatusMeta[] => [
	STATUS_META[status],
	...STATUS_TRANSITIONS[status].map((next) => STATUS_META[next]),
];
