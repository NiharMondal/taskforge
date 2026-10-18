"use client";
import { useMemo } from "react";

import { Spinner } from "@heroui/react";

import ErrorAlert from "@/components/ui/error-alert";
import { useMemberships } from "@/features/memberships/hooks/use-memberships";
import { useWorkspacePermissions } from "@/features/memberships/hooks/use-workspace-permissions";
import { useSprints } from "@/features/sprint/hooks/use-sprints";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { getApiErrorMessage } from "@/lib/api-error";

import { useIssueEditor } from "../hooks/use-issue-editor";
import { useSingleIssue } from "../hooks/use-issues";
import {
	TIssueContentValues,
	TIssueDetailsValues,
} from "../schema/issue-schema";
import IssueContentForm from "./IssueContentForm";
import IssueDetailsPanel from "./IssueDetailsPanel";
import { NO_SPRINT, UNASSIGNED } from "./IssueForm";

type Props = {
	projectId: string;
	issueId: string;
};

export default function IssueDetailComponent({ projectId, issueId }: Props) {
	const { activeWorkspaceId } = useWorkspace();
	const workspaceId = activeWorkspaceId ?? "";
	const {
		data: issue,
		isError,
		error,
		refetch,
	} = useSingleIssue(workspaceId, projectId, issueId);
	const { data: members = [] } = useMemberships(workspaceId);
	const { data: sprints = [] } = useSprints(workspaceId, projectId);
	const permissions = useWorkspacePermissions();

	const {
		handleSaveContent,
		handleSaveDetails,
		isSavingContent,
		isSavingDetails,
	} = useIssueEditor(workspaceId, projectId, issue);

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

	if (isError) {
		return (
			<ErrorAlert
				title="Couldn’t load this issue"
				description={getApiErrorMessage(
					error,
					"It may have been deleted, or you may not have access.",
				)}
				onRetry={() => refetch()}
			/>
		);
	}

	if (!issue || !contentValues || !detailsValues) {
		return (
			<div className="flex items-center gap-2 py-12 text-muted">
				<Spinner size="sm" />
				Loading issue…
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 gap-5 xl:grid-cols-6">
			<div className="xl:col-span-4">
				<IssueContentForm
					defaultValues={contentValues}
					onSubmit={handleSaveContent}
					isSubmitting={isSavingContent}
					canEdit={permissions.canEditIssueFields}
				/>
			</div>
			<div className="xl:col-span-2">
				<IssueDetailsPanel
					defaultValues={detailsValues}
					onSubmit={handleSaveDetails}
					isSubmitting={isSavingDetails}
					members={members}
					sprints={sprints}
					reporter={issue.reporter}
					permissions={permissions}
				/>
			</div>
		</div>
	);
}
