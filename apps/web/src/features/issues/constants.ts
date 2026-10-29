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

import { SELECTABLE_ISSUE_TYPES } from "@taskforge/shared";

import type { IssuePriority, IssueType } from "./types/issue-types";

/**
 * Display metadata for issue enums. Centralized here so chips and selects all
 * agree on label, ordering, and color — change it once. Statuses aren't here:
 * each project has its own (`features/workflow`).
 *
 * Colors use HeroUI's semantic Chip palette (accent | danger | success |
 * warning | default), never raw Tailwind colors (see memory: HeroUI 3 tokens).
 */

type ChipColor = NonNullable<ComponentProps<typeof Chip>["color"]>;

interface PriorityMeta {
	value: IssuePriority;
	label: string;
	color: ChipColor;
}

/** Ordered most-urgent-first for the create form's default ordering. */
export const ISSUE_PRIORITIES: PriorityMeta[] = [
	{ value: "URGENT", label: "Urgent", color: "danger" },
	{ value: "HIGH", label: "High", color: "warning" },
	{ value: "MEDIUM", label: "Medium", color: "accent" },
	{ value: "LOW", label: "Low", color: "default" },
];

export const PRIORITY_META: Record<IssuePriority, PriorityMeta> =
	Object.fromEntries(ISSUE_PRIORITIES.map((p) => [p.value, p])) as Record<
		IssuePriority,
		PriorityMeta
	>;

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
