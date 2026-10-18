import { toast } from "@heroui/react";

import { getApiErrorMessage } from "@/lib/api-error";

import { NO_SPRINT, UNASSIGNED } from "../components/IssueForm";
import type {
	TIssueContentValues,
	TIssueDetailsValues,
} from "../schema/issue-schema";
import type { Issue, UpdateIssueDto } from "../types/issue-types";
import { useUpdateIssue } from "./use-issues";

/**
 * Save handlers for the two independently-saved sections of an issue (content:
 * title + description, details: status/priority/assignee/sprint), shared by the
 * detail page and the detail modal.
 *
 * Each handler PATCHes only the fields that actually changed and resolves
 * `false` on failure so the form keeps the user's edits.
 */
export function useIssueEditor(
	workspaceId: string,
	projectId: string,
	issue: Issue | null | undefined,
) {
	// Two independent mutation instances so each section has its own loading
	// state — saving the content doesn't spin the details Save button, and vice
	// versa. Both funnel through the same optimistic cache logic.
	const { mutateAsync: saveContent, isPending: isSavingContent } =
		useUpdateIssue(workspaceId, projectId);
	const { mutateAsync: saveDetails, isPending: isSavingDetails } =
		useUpdateIssue(workspaceId, projectId);

	const patch = async (dto: UpdateIssueDto, save: typeof saveContent) => {
		if (!issue) return false;
		// Nothing changed — treat as a no-op success.
		if (Object.keys(dto).length === 0) return true;
		try {
			const res = await save({ issueId: issue.id, dto });
			toast.success(res?.message || "Issue updated successfully");
			return true;
		} catch (error) {
			toast.danger(getApiErrorMessage(error));
			return false;
		}
	};

	const handleSaveContent = async (values: TIssueContentValues) => {
		if (!issue) return false;
		const description = values.description ?? "";
		const dto: UpdateIssueDto = {
			...(values.title !== issue.title && { title: values.title }),
			// A cleared description is "" and must still be sent: JSON drops
			// `undefined`, which used to turn "clear it" into an empty `{}` PATCH
			// that "succeeded" without changing anything.
			...(description !== (issue.description ?? "") && { description }),
		};
		return patch(dto, saveContent);
	};

	const handleSaveDetails = async (values: TIssueDetailsValues) => {
		if (!issue) return false;
		const nextAssignee =
			values.assigneeId === UNASSIGNED
				? null
				: (values.assigneeId ?? null);
		const nextSprint =
			values.sprintId === NO_SPRINT ? null : (values.sprintId ?? null);

		const dto: UpdateIssueDto = {
			...(values.status !== issue.status && { status: values.status }),
			...(values.priority !== issue.priority && {
				priority: values.priority,
			}),
			...(nextAssignee !== (issue.assigneeId ?? null) && {
				assigneeId: nextAssignee,
			}),
			...(nextSprint !== (issue.sprintId ?? null) && {
				sprintId: nextSprint,
			}),
		};
		return patch(dto, saveDetails);
	};

	return {
		handleSaveContent,
		handleSaveDetails,
		isSavingContent,
		isSavingDetails,
	};
}
