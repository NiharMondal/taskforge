"use client";

import { Button, toast } from "@heroui/react";
import { useBoolean } from "ahooks";
import { Trash2 } from "lucide-react";

import ConfirmModal from "@/components/ui/confirm-modal";
import { getApiErrorMessage } from "@/lib/api-error";

import { useDeleteIssue } from "../hooks/use-issues";
import type { Issue } from "../types/issue-types";

type Props = {
	workspaceId: string;
	projectId: string;
	issue: Issue;
	/** Runs after a successful delete (e.g. leave the detail page). */
	onDeleted?: () => void;
};

/**
 * Deletes an issue behind a confirmation. Rendering is gated by the parent on
 * `canDeleteIssue`; the backend (`issue:delete`) is the real authority.
 */
export default function DeleteIssueButton({
	workspaceId,
	projectId,
	issue,
	onDeleted,
}: Props) {
	const [isOpen, { setTrue: open, setFalse: close }] = useBoolean();
	const { mutateAsync: deleteIssue, isPending } = useDeleteIssue(
		workspaceId,
		projectId,
	);

	const handleDelete = async () => {
		try {
			const res = await deleteIssue(issue.id);
			toast.success(res.message || "Issue deleted");
			close();
			onDeleted?.();
		} catch (error) {
			toast.danger(getApiErrorMessage(error, "Failed to delete issue"));
		}
	};

	return (
		<>
			<Button
				variant="danger-soft"
				size="sm"
				className="self-start"
				onClick={open}
			>
				<Trash2 className="size-4" />
				Delete issue
			</Button>

			<ConfirmModal
				isOpen={isOpen}
				onClose={close}
				title="Delete issue"
				description={
					<>
						Delete{" "}
						<span className="font-medium text-foreground">
							{issue.title}
						</span>
						? Its sub-issues and comments are deleted too. This
						can’t be undone.
					</>
				}
				confirmLabel="Delete"
				pendingLabel="Deleting…"
				isPending={isPending}
				onConfirm={handleDelete}
			/>
		</>
	);
}
