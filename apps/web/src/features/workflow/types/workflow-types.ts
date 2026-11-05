/**
 * Workflow domain types. Mirror `GET /projects/:projectId/workflow` and the
 * status routes (apps/backend/spec/workflow-spec.md): a project's statuses,
 * in column order, and the moves allowed between them.
 */

import type { StatusCategory, StatusTransition } from "@taskforge/shared";

export type { StatusCategory, StatusTransition };

/** A status as issues embed it (`issue.status`). */
export interface IssueStatusRef {
	id: string;
	name: string;
	/** Hex, like a label's color. */
	color: string;
	category: StatusCategory;
}

export interface WorkflowStatus extends IssueStatusRef {
	/** Column order: a fractional index, like an issue's rank. */
	position: string;
	/** Where an issue created without a status lands. One per project. */
	isDefault: boolean;
	/** `GET` only: how many issues are in it. */
	issueCount?: number;
}

export interface Workflow {
	/** In column order. */
	statuses: WorkflowStatus[];
	transitions: StatusTransition[];
}

export interface CreateStatusDto {
	name: string;
	color: string;
	category: StatusCategory;
	/** Left out, the status goes last. */
	position?: string;
}

/** `isDefault` only takes `true`: a project always has a default. */
export type UpdateStatusDto = Partial<CreateStatusDto> & { isDefault?: true };
