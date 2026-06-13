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

/** Ordered left-to-right as work flows (backlog → done). Drives list grouping. */
export const ISSUE_STATUSES: StatusMeta[] = [
  { value: "BACKLOG", label: "Backlog", color: "default" },
  { value: "TODO", label: "To Do", color: "default" },
  { value: "IN_PROGRESS", label: "In Progress", color: "accent" },
  { value: "IN_REVIEW", label: "In Review", color: "warning" },
  { value: "DONE", label: "Done", color: "success" },
];

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
