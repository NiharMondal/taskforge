"use client";

import { useMemo, useState } from "react";

import { Button, toast } from "@heroui/react";
import { useBoolean } from "ahooks";
import { formatDistanceToNow } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";

import Avatar from "@/components/ui/avatar";
import ConfirmModal from "@/components/ui/confirm-modal";
import { getApiErrorMessage } from "@/lib/api-error";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { formatDate } from "@/util/format-date";
import { DELETED_USER_NAME } from "@/types/common";
import { initialsOf } from "@/util/initials";

import { useDeleteComment, useUpdateComment } from "../hooks/use-comments";
import type { TCommentValues } from "../schema/comment-schema";
import type { IssueComment } from "../types/comment-types";
import CommentForm from "./CommentForm";

type Props = {
	comment: IssueComment;
	workspaceId: string;
	projectId: string;
	/** The author, while they may still comment. */
	canEdit: boolean;
	/** The author (same condition), or a moderator. */
	canDelete: boolean;
};

/**
 * Prisma stamps `createdAt` and `updatedAt` separately on insert, so they can
 * differ by a few milliseconds on a comment nobody touched.
 */
const EDIT_THRESHOLD_MS = 1000;

/** One comment: author, time, the sanitized content, and its actions. */
export default function CommentItem({
	comment,
	workspaceId,
	projectId,
	canEdit,
	canDelete,
}: Props) {
	const [isEditing, setIsEditing] = useState(false);
	const [isConfirmOpen, { setTrue: openConfirm, setFalse: closeConfirm }] =
		useBoolean();
	const { mutateAsync: updateComment, isPending: isSaving } =
		useUpdateComment(workspaceId, projectId, comment.issueId);
	const { mutateAsync: deleteComment, isPending: isDeleting } =
		useDeleteComment(workspaceId, projectId, comment.issueId);

	// User-authored HTML, stored as sent: never render it unsanitized.
	const safeContent = useMemo(
		() => sanitizeHtml(comment.content),
		[comment.content],
	);
	const isEdited =
		new Date(comment.updatedAt).getTime() -
			new Date(comment.createdAt).getTime() >
		EDIT_THRESHOLD_MS;

	const handleSave = async ({ content }: TCommentValues) => {
		try {
			await updateComment({ commentId: comment.id, dto: { content } });
			setIsEditing(false);
			return true;
		} catch (error) {
			toast.danger(getApiErrorMessage(error, "Failed to update comment"));
			return false;
		}
	};

	const handleDelete = async () => {
		try {
			const res = await deleteComment(comment);
			toast.success(res.message || "Comment deleted");
			closeConfirm();
		} catch (error) {
			toast.danger(getApiErrorMessage(error, "Failed to delete comment"));
		}
	};

	const authorName = comment.user?.name ?? DELETED_USER_NAME;

	return (
		<li className="flex gap-3 py-3 first:pt-0 last:pb-0">
			<Avatar
				size="sm"
				src={comment.user?.avatarUrl ?? undefined}
				alt={authorName}
				fallback={comment.user ? initialsOf(comment.user.name) : "?"}
			/>
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<div className="flex flex-wrap items-center gap-x-2 text-sm">
					<span
						className={comment.user ? "font-medium" : "font-medium text-muted"}
					>
						{authorName}
					</span>
					<time
						dateTime={comment.createdAt}
						title={formatDate(comment.createdAt, "dd MMM yyyy, hh:mm a")}
						className="text-xs text-muted"
					>
						{formatDistanceToNow(new Date(comment.createdAt), {
							addSuffix: true,
						})}
					</time>
					{isEdited && (
						<span
							className="text-xs text-muted"
							title={`Edited ${formatDate(comment.updatedAt, "dd MMM yyyy, hh:mm a")}`}
						>
							(edited)
						</span>
					)}

					{!isEditing && (canEdit || canDelete) && (
						<div className="ml-auto flex items-center">
							{canEdit && (
								<Button
									isIconOnly
									size="sm"
									variant="ghost"
									aria-label="Edit comment"
									onPress={() => setIsEditing(true)}
								>
									<Pencil className="size-3.5" />
								</Button>
							)}
							{canDelete && (
								<Button
									isIconOnly
									size="sm"
									variant="ghost"
									aria-label="Delete comment"
									onPress={openConfirm}
								>
									<Trash2 className="size-3.5" />
								</Button>
							)}
						</div>
					)}
				</div>

				{isEditing ? (
					<CommentForm
						defaultContent={comment.content}
						onSubmit={handleSave}
						isSubmitting={isSaving}
						onCancel={() => setIsEditing(false)}
					/>
				) : (
					<div
						// tiptap prose styling without the editor's fixed height.
						style={{ height: "auto", overflow: "visible" }}
						className="tiptap-content text-sm"
						dangerouslySetInnerHTML={{ __html: safeContent }}
					/>
				)}
			</div>

			<ConfirmModal
				isOpen={isConfirmOpen}
				onClose={closeConfirm}
				title="Delete comment"
				description="Delete this comment? This can’t be undone."
				confirmLabel="Delete"
				pendingLabel="Deleting…"
				isPending={isDeleting}
				onConfirm={handleDelete}
			/>
		</li>
	);
}
