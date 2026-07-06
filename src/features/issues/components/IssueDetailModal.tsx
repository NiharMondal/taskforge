"use client";

import { toast } from "@heroui/react";

import MyModal from "@/components/ui/my-modal";
import type { Member } from "@/features/memberships/types/membership-types";
import { getApiErrorMessage } from "@/lib/api-error";

import { useUpdateIssue } from "../hooks/use-issues";
import {
	TIssueContentValues,
	TIssueDetailsValues,
} from "../schema/issue-schema";
import type { Issue, UpdateIssueDto } from "../types/issue-types";
import IssueContentForm from "./IssueContentForm";
import IssueDetailsPanel from "./IssueDetailsPanel";
import { NO_SPRINT, UNASSIGNED } from "./IssueForm";
import { useSprints } from "@/features/sprint/hooks/use-sprints";

type TProps = {
	/** The issue to edit; null closes the modal. */
	issue: Issue | null;
	onClose: () => void;
	members: Member[];
	workspaceId: string;
	projectId: string;
};

/**
 * Issue detail + edit modal. Same two-section layout as the detail page: the
 * content (title + description) on the left and the "Details" metadata panel on
 * the right, each saved independently. Keyed per issue so opening a different
 * one resets the fields without a sync effect.
 */
export default function IssueDetailModal({
	issue,
	onClose,
	members,
	workspaceId,
	projectId,
}: TProps) {
	// Two independent mutation instances so each section has its own loading
	// state — saving the content doesn't spin the details Save button, and vice
	// versa. Both funnel through the same optimistic cache logic.
	const { mutateAsync: saveContent, isPending: isSavingContent } =
		useUpdateIssue(workspaceId, projectId);
	const { mutateAsync: saveDetails, isPending: isSavingDetails } =
		useUpdateIssue(workspaceId, projectId);
	const { data: sprints = [] } = useSprints(workspaceId, projectId);

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
		const dto: UpdateIssueDto = {
			...(values.title !== issue.title && { title: values.title }),
			...((values.description ?? "") !== (issue.description ?? "") && {
				description: values.description || undefined,
			}),
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

	return (
		<MyModal
			isOpen={!!issue}
			onOpenChange={(open) => !open && onClose()}
			size="cover"
			title="Issue details"
		>
			{issue && (
				<div
					key={issue.id}
					className="grid grid-cols-1 gap-5 xl:grid-cols-6"
				>
					<div className="xl:col-span-4">
						<IssueContentForm
							defaultValues={{
								title: issue.title,
								description: issue.description ?? "",
							}}
							onSubmit={handleSaveContent}
							isSubmitting={isSavingContent}
						/>
					</div>
					<div className="xl:col-span-2 border-l border-border">
						<IssueDetailsPanel
							defaultValues={{
								status: issue.status,
								priority: issue.priority,
								assigneeId: issue.assigneeId ?? UNASSIGNED,
								sprintId: issue.sprintId ?? NO_SPRINT,
							}}
							onSubmit={handleSaveDetails}
							isSubmitting={isSavingDetails}
							members={members}
							sprints={sprints}
							reporter={issue.reporter}
						/>
					</div>
				</div>
			)}
		</MyModal>
	);
}
