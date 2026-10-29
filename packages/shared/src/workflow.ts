import type { StatusCategory } from "./enums";

/**
 * A project's workflow is its own set of statuses (name, color, category,
 * order) plus the moves allowed between them (apps/backend/spec/workflow-spec.md).
 * A status's name is the project's to choose, so no rule may test a status by
 * name: rules read its category instead.
 *
 * - BACKLOG: not committed to. Hidden from the board; an issue in one that
 *   joins a sprint moves to the first UNSTARTED status.
 * - UNSTARTED: committed, not begun.
 * - STARTED: in flight.
 * - COMPLETED: finished. Moving an issue into one needs `issue:status:done`,
 *   and ending a sprint keeps these issues in it.
 */

export interface WorkflowStatusTemplate {
  name: string;
  /** Hex, like a label's color. */
  color: string;
  category: StatusCategory;
  /** Where an issue lands when created without a status. */
  isDefault?: boolean;
}

/**
 * What every new project starts with, and all a Free workspace gets. Every
 * move between them is allowed (`allTransitions`). Projects that existed
 * before workflows kept their eight statuses (the `custom_workflows`
 * migration), so changing this affects new projects only.
 */
export const DEFAULT_WORKFLOW_STATUSES: readonly WorkflowStatusTemplate[] = [
  { name: "Backlog", color: "#6b7280", category: "BACKLOG", isDefault: true },
  { name: "To Do", color: "#8b5cf6", category: "UNSTARTED" },
  { name: "In Progress", color: "#3b82f6", category: "STARTED" },
  { name: "In Review", color: "#eab308", category: "STARTED" },
  { name: "Done", color: "#22c55e", category: "COMPLETED" },
];

/**
 * Categories a workflow can't be without: sprint planning moves issues into
 * the first UNSTARTED status, and work has to be able to finish.
 */
export const REQUIRED_STATUS_CATEGORIES: readonly StatusCategory[] = [
  "UNSTARTED",
  "COMPLETED",
];

/** A move an issue may make. Staying in the same status is never stored. */
export interface StatusTransition {
  fromStatusId: string;
  toStatusId: string;
}

/** Every move between distinct statuses: the default workflow's transitions. */
export function allTransitions(
  statusIds: readonly string[],
): StatusTransition[] {
  return statusIds.flatMap((fromStatusId) =>
    statusIds
      .filter((toStatusId) => toStatusId !== fromStatusId)
      .map((toStatusId) => ({ fromStatusId, toStatusId })),
  );
}

/** Whether an issue may move from `from` to `to` (staying put always may). */
export function isAllowedTransition(
  transitions: readonly StatusTransition[],
  from: string,
  to: string,
): boolean {
  return (
    from === to ||
    transitions.some((t) => t.fromStatusId === from && t.toStatusId === to)
  );
}
