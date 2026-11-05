"use client";
import { useMemo } from "react";

import { Spinner } from "@heroui/react";
import { CornerDownRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import ErrorAlert from "@/components/ui/error-alert";
import IssueActivityPanel from "@/features/activity/components/IssueActivityPanel";
import { useLabels } from "@/features/labels/hooks/use-labels";
import { useMemberships } from "@/features/memberships/hooks/use-memberships";
import { useWorkspacePermissions } from "@/features/memberships/hooks/use-workspace-permissions";
import { canEditIssue } from "@/features/memberships/lib/permissions";
import { useSprints } from "@/features/sprint/hooks/use-sprints";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { getApiErrorMessage } from "@/lib/api-error";

import { useIssueEditor } from "../hooks/use-issue-editor";
import { useSingleIssue } from "../hooks/use-issues";
import { formatEstimate } from "../lib/estimate";
import {
	TIssueContentValues,
	TIssueDetailsValues,
} from "../schema/issue-schema";
import DeleteIssueButton from "./DeleteIssueButton";
import IssueContentForm from "./IssueContentForm";
import IssueKey from "./IssueKey";
import IssueDetailsPanel from "./IssueDetailsPanel";
import SubIssuesPanel from "./SubIssuesPanel";
import { NO_SPRINT, UNASSIGNED } from "./IssueForm";

type Props = {
	projectId: string;
	issueId: string;
};

export default function IssueDetailComponent({ projectId, issueId }: Props) {
	const router = useRouter();
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
	const { data: labels = [] } = useLabels(workspaceId);
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
				type: issue.type,
				timeEstimate: formatEstimate(issue.timeEstimate),
				assigneeId: issue.assigneeId ?? UNASSIGNED,
				sprintId: issue.sprintId ?? NO_SPRINT,
				labelIds: issue.labels?.map((l) => l.id) ?? [],
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
			<div className="flex flex-col gap-2 xl:col-span-4">
				<div className="flex flex-wrap items-center gap-2 text-sm">
					{issue.parentIssue && (
						<>
							<Link
								href={`/projects/${projectId}/list/${issue.parentIssue.id}`}
								className="flex min-w-0 items-center gap-1 text-muted hover:text-foreground hover:underline"
							>
								<CornerDownRight className="size-3.5 shrink-0" />
								<IssueKey
									issue={{
										projectId,
										number: issue.parentIssue.number,
									}}
									className="text-sm"
								/>
								<span className="truncate">{issue.parentIssue.title}</span>
							</Link>
							<span className="text-muted">/</span>
						</>
					)}
					<IssueKey issue={issue} className="text-sm" />
				</div>
				<IssueContentForm
					defaultValues={contentValues}
					onSubmit={handleSaveContent}
					isSubmitting={isSavingContent}
					canEdit={canEditIssue(permissions, issue)}
				/>
				<SubIssuesPanel
					issue={issue}
					workspaceId={workspaceId}
					canCreate={permissions.canCreateIssue}
				/>
				<IssueActivityPanel
					workspaceId={workspaceId}
					projectId={projectId}
					issueId={issue.id}
				/>
			</div>
			<div className="xl:col-span-2 flex flex-col gap-3">
				<IssueDetailsPanel
					defaultValues={detailsValues}
					onSubmit={handleSaveDetails}
					isSubmitting={isSavingDetails}
					members={members}
					sprints={sprints}
					labels={labels}
					reporter={issue.reporter}
					permissions={permissions}
					canEditFields={canEditIssue(permissions, issue)}
				/>
				{permissions.canDeleteIssue && (
					<DeleteIssueButton
						workspaceId={workspaceId}
						projectId={projectId}
						issue={issue}
						onDeleted={() =>
							router.replace(`/projects/${projectId}/list`)
						}
					/>
				)}
			</div>
		</div>
	);
}
