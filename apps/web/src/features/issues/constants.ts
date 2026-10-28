import type { Chip } from "@heroui/react";
import {
	Bookmark,
	Bug,
	ChevronDown,
	ChevronUp,
	ChevronsUp,
	CornerDownRight,
	Equal,
	SquareCheck,
	Zap,
	type LucideIcon,
} from "lucide-react";
import type { ComponentProps } from "react";

import { SELECTABLE_ISSUE_TYPES, STATUS_TRANSITIONS } from "@taskforge/shared";

import type { IssuePriority, IssueStatus, IssueType } from "./types/issue-types";

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
 * `STATUS_TRANSITIONS` (`@taskforge/shared`) instead, which only allows the
 * next step.
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
 * Options for a status Select on an issue currently in `status`: that status
 * first — a Select can only render a value that is one of its options — then
 * each legal next status (`STATUS_TRANSITIONS`, shared with the API, so an
 * issue can't skip stages). A single-entry result means the issue is terminal and
 * the caller should disable the control.
 */
export const statusOptionsFor = (status: IssueStatus): StatusMeta[] => [
	STATUS_META[status],
	...STATUS_TRANSITIONS[status].map((next) => STATUS_META[next]),
];

interface IconMeta {
	label: string;
	icon: LucideIcon;
	/** Semantic text-color token for the icon. */
	className: string;
}

/** Compact icon per issue type, for dense rows (backlog). */
export const ISSUE_TYPE_META: Record<IssueType, IconMeta> = {
	EPIC: { label: "Epic", icon: Zap, className: "text-warning" },
	STORY: { label: "Story", icon: Bookmark, className: "text-success" },
	TASK: { label: "Task", icon: SquareCheck, className: "text-accent" },
	BUG: { label: "Bug", icon: Bug, className: "text-danger" },
	SUBTASK: { label: "Subtask", icon: CornerDownRight, className: "text-muted" },
};

/** Options for an issue's type Select: just SUBTASK for a sub-issue. */
export const typeOptionsFor = (type: IssueType) =>
	(type === "SUBTASK" ? ["SUBTASK" as const] : SELECTABLE_ISSUE_TYPES).map(
		(value) => ({ value, label: ISSUE_TYPE_META[value].label }),
	);

/** Compact icon per priority — the dense-row alternative to `PriorityChip`. */
export const PRIORITY_ICON_META: Record<IssuePriority, IconMeta> = {
	URGENT: { label: "Urgent", icon: ChevronsUp, className: "text-danger" },
	HIGH: { label: "High", icon: ChevronUp, className: "text-danger" },
	MEDIUM: { label: "Medium", icon: Equal, className: "text-warning" },
	LOW: { label: "Low", icon: ChevronDown, className: "text-accent" },
};

/**
 * Coarse progress bucket for a status: not started, in flight, or done. Drives
 * the three counts on a backlog sprint header.
 */
export const statusCategory = (
	status: IssueStatus,
): "todo" | "inProgress" | "done" =>
	status === "DONE"
		? "done"
		: status === "BACKLOG" || status === "TODO"
			? "todo"
			: "inProgress";
