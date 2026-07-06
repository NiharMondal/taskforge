"use client";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { useSingleIssue, useUpdateIssue } from "../hooks/use-issues";
import { useMemberships } from "@/features/memberships/hooks/use-memberships";
import { UpdateIssueDto } from "../types/issue-types";
import {
	TIssueContentValues,
	TIssueDetailsValues,
} from "../schema/issue-schema";
import { NO_SPRINT, UNASSIGNED } from "./IssueForm";
import IssueContentForm from "./IssueContentForm";
import IssueDetailsPanel from "./IssueDetailsPanel";
import { useSprints } from "@/features/sprint/hooks/use-sprints";
import { toast } from "@heroui/react";
import { getApiErrorMessage } from "@/lib/api-error";
import { useMemo } from "react";

type Props = {
	projectId: string;
	issueId: string;
};

export default function IssueDetailComponent({ projectId, issueId }: Props) {
	const { activeWorkspaceId } = useWorkspace();
	const workspaceId = activeWorkspaceId ?? "";
	const { data: issue } = useSingleIssue(workspaceId, projectId, issueId);
	const { data: members = [] } = useMemberships(workspaceId);
	const { data: sprints = [] } = useSprints(workspaceId, projectId);

	// Two independent mutation instances so each section has its own loading
	// state — saving the content doesn't spin the details Save button, and vice
	// versa. Both funnel through the same optimistic cache logic.
	const { mutateAsync: saveContent, isPending: isSavingContent } =
		useUpdateIssue(workspaceId, projectId);
	const { mutateAsync: saveDetails, isPending: isSavingDetails } =
		useUpdateIssue(workspaceId, projectId);

	const contentValues = useMemo<TIssueContentValues | undefined>(
		() =>
			issue && {
				title: issue.title,
				description: issue.description ?? "",
			},
		[issue],
	);

	const detailsValues = useMemo<TIssueDetailsValues | undefined>(
		() =>
			issue && {
				status: issue.status,
				priority: issue.priority,
				assigneeId: issue.assigneeId ?? UNASSIGNED,
				sprintId: issue.sprintId ?? NO_SPRINT,
			},
		[issue],
	);

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

	if (!issue || !contentValues || !detailsValues) return null;

	return (
		<div className="grid grid-cols-1 gap-5 xl:grid-cols-6">
			<div className="xl:col-span-4">
				<IssueContentForm
					defaultValues={contentValues}
					onSubmit={handleSaveContent}
					isSubmitting={isSavingContent}
				/>
			</div>
			<div className="xl:col-span-2 border-l border-border">
				<IssueDetailsPanel
					defaultValues={detailsValues}
					onSubmit={handleSaveDetails}
					isSubmitting={isSavingDetails}
					members={members}
					sprints={sprints}
					reporter={issue.reporter}
				/>
			</div>
		</div>
	);
}
