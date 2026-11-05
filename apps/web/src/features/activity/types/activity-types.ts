import type { IssueLabelRef } from "@/features/labels/types/label-types";
import type { ICommonUserEntity } from "@/types/common";

/**
 * One row of an issue's history, as `GET .../issues/:issueId/activity`
 * returns it (apps/backend/src/modules/activity/). Names are as they were when
 * it happened, so a renamed sprint or a deleted label still reads.
 */
export type IssueActivity =
	| ActivityBase<"issue.created", null>
	| ActivityBase<"issue.updated", { changes: IssueChange[] }>
	/** `author` is `null` when their account was deleted before the comment was. */
	| ActivityBase<"comment.deleted", { author: Ref | null }>;

interface ActivityBase<A extends string, M> {
	id: string;
	action: A;
	metadata: M;
	createdAt: string;
	/** Who did it; `null` once their account is deleted. */
	user: ICommonUserEntity | null;
}

export interface Ref {
	id: string;
	name: string;
}

/** One field's change in an `issue.updated` row (mirrors the backend's `IssueChange`). */
export type IssueChange =
	| { field: "title"; from: string; to: string }
	| { field: "description" }
	| { field: "status" | "priority" | "type"; from: string; to: string }
	| { field: "timeEstimate"; from: number | null; to: number | null }
	| { field: "assignee" | "sprint"; from: Ref | null; to: Ref | null }
	| { field: "labels"; added: IssueLabelRef[]; removed: IssueLabelRef[] };
