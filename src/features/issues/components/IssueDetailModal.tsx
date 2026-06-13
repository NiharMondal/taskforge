"use client";

import { toast } from "@heroui/react";

import MyModal from "@/components/ui/my-modal";
import type { Member } from "@/features/memberships/types/membership-types";
import { getApiErrorMessage } from "@/lib/api-error";

import { useUpdateIssue } from "../hooks/use-issues";
import { TIssueFormValues } from "../schema/issue-schema";
import type { Issue, UpdateIssueDto } from "../types/issue-types";
import IssueForm, { UNASSIGNED } from "./IssueForm";
import { useMemo } from "react";

type TProps = {
	/** The issue to edit; null closes the modal. */
	issue: Issue | null;
	onClose: () => void;
	members: Member[];
	workspaceId: string;
	projectId: string;
};

/**
 * Issue detail + edit modal. Reuses IssueForm seeded from the issue and
 * re-mounted per issue (via `key`), so opening a different issue resets the
 * fields without a sync effect.
 */
export default function IssueDetailModal({
	issue,
	onClose,
	members,
	workspaceId,
	projectId,
}: TProps) {
	const { mutateAsync: updateIssue, isPending } = useUpdateIssue(
		workspaceId,
		projectId,
	);

	const handleUpdateIssue = async (values: TIssueFormValues) => {
		if (!issue) return false;

		const nextAssignee =
			values.assigneeId === UNASSIGNED
				? null
				: (values.assigneeId ?? null);

		// PATCH only what changed.
		const dto: UpdateIssueDto = {
			...(values.title !== issue.title && { title: values.title }),
			...((values.description ?? "") !== (issue.description ?? "") && {
				description: values.description || undefined,
			}),
			...(values.status !== issue.status && { status: values.status }),
			...(values.priority !== issue.priority && {
				priority: values.priority,
			}),
			...(nextAssignee !== (issue.assigneeId ?? null) && {
				assigneeId: nextAssignee,
			}),
		};

		// Nothing changed — just close.
		if (Object.keys(dto).length === 0) return true;

		try {
			const res = await updateIssue({ issueId: issue.id, dto });
			toast.success(res?.message || "Issue updated successfully");
			return true;
		} catch (error) {
			toast.danger(getApiErrorMessage(error));
			return false;
		}
	};

	return (
		<MyModal
			isOpen={!!issue}
			onOpenChange={(open) => !open && onClose()}
			size="cover"
			title="Issue details"
		>
			{issue && (
				<IssueForm
					key={issue.id}
					defaultValues={{
						title: issue.title,
						description: issue.description ?? "",
						status: issue.status,
						priority: issue.priority,
						assigneeId: issue.assigneeId ?? UNASSIGNED,
					}}
					isSubmitting={isPending}
					onSubmit={handleUpdateIssue}
					members={members}
					onCancel={onClose}
					onSuccess={onClose}
				/>
			)}
		</MyModal>
	);
}
