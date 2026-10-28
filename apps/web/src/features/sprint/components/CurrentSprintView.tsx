"use client";

import { useMemo, useState, type ReactNode } from "react";

import { Spinner, toast } from "@heroui/react";
import { ArrowRight, ListTodo, Rocket } from "lucide-react";
import Link from "next/link";

import ErrorAlert from "@/components/ui/error-alert";
import IssueList from "@/features/issues/components/IssueList";
import { useIssues, useUpdateIssue } from "@/features/issues/hooks/use-issues";
import type { IssueStatus } from "@/features/issues/types/issue-types";
import { useMemberships } from "@/features/memberships/hooks/use-memberships";
import { useWorkspacePermissions } from "@/features/memberships/hooks/use-workspace-permissions";
import { getMemberName } from "@/features/memberships/lib/member";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { getApiErrorMessage } from "@/lib/api-error";

import { useSprints } from "../hooks/use-sprints";
import type { Sprint } from "../types/sprint-types";
import EndSprintModal from "./EndSprintModal";
import SprintSummaryCard from "./SprintSummaryCard";

/**
 * The project's running sprint and its issues — what the team works from day
 * to day. Planning (create / edit / start) lives in project settings.
 *
 * No dedicated endpoint: the active sprint comes from the sprint list (the
 * backend allows one per project) and its issues are filtered out of the
 * project issue list the board and list views already cache.
 */
export default function CurrentSprintView({ projectId }: { projectId: string }) {
	const { activeWorkspaceId } = useWorkspace();
	const workspaceId = activeWorkspaceId ?? "";
	const permissions = useWorkspacePermissions();
	const { data: members = [] } = useMemberships(workspaceId);

	const sprintsQuery = useSprints(workspaceId, projectId);
	const issuesQuery = useIssues(workspaceId, projectId);
	const {
		mutate: updateIssue,
		variables: updatingVars,
		isPending: isUpdatingIssue,
	} = useUpdateIssue(workspaceId, projectId);

	const [endingSprint, setEndingSprint] = useState<Sprint | null>(null);

	const sprint = sprintsQuery.data?.find((s) => s.isActive) ?? null;
	const sprintIssues = useMemo(
		() =>
			sprint
				? (issuesQuery.data ?? []).filter((i) => i.sprintId === sprint.id)
				: [],
		[issuesQuery.data, sprint],
	);
	const doneCount = sprintIssues.filter((i) => i.status === "DONE").length;

	// userId → display name, for resolving issue assignees in the list.
	const assigneeNames = useMemo(() => {
		const map = new Map<string, string>();
		for (const m of members) {
			if (m.user) map.set(m.userId, getMemberName(m));
		}
		return map;
	}, [members]);

	const handleStatusChange = (issueId: string, status: IssueStatus) => {
		updateIssue(
			{ issueId, dto: { status } },
			{
				onSuccess: ({ message }) =>
					toast.success(message || "Status updated successfully"),
				onError: (error) =>
					toast.danger(
						getApiErrorMessage(error, "Failed to update status"),
					),
			},
		);
	};

	if (sprintsQuery.isError || issuesQuery.isError) {
		return (
			<ErrorAlert
				title="Couldn’t load the current sprint"
				description="Check your connection and try again."
				onRetry={() => {
					sprintsQuery.refetch();
					issuesQuery.refetch();
				}}
			/>
		);
	}

	if (sprintsQuery.isLoading || issuesQuery.isLoading) {
		return (
			<div className="flex items-center gap-2 py-12 text-muted">
				<Spinner size="sm" />
				Loading sprint…
			</div>
		);
	}

	if (!sprint) {
		return (
			<EmptyState
				icon={<Rocket className="h-12 w-12 text-muted/40" />}
				title="No active sprint"
				description={
					permissions.canManageSprints
						? "Plan a sprint and start it from project settings."
						: "Work shows up here once an admin starts a sprint."
				}
				action={
					permissions.canManageSprints && (
						<Link
							href={`/projects/${projectId}/settings`}
							className="flex items-center gap-1 text-sm text-accent hover:underline"
						>
							Go to sprint settings
							<ArrowRight className="h-4 w-4" />
						</Link>
					)
				}
			/>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<SprintSummaryCard
				sprint={sprint}
				doneCount={doneCount}
				totalCount={sprintIssues.length}
				canManage={permissions.canManageSprints}
				onEnd={() => setEndingSprint(sprint)}
			/>

			{sprintIssues.length === 0 ? (
				<EmptyState
					icon={<ListTodo className="h-12 w-12 text-muted/40" />}
					title="No issues in this sprint"
					description={`Pick “${sprint.name}” in an issue’s Sprint field to add it here.`}
				/>
			) : (
				// Never empty here, so IssueList's create CTA can't show; rows
				// open the issue page themselves.
				<IssueList
					issues={sprintIssues}
					assigneeNames={assigneeNames}
					permissions={permissions}
					onStatusChange={handleStatusChange}
					onOpenIssue={() => {}}
					onCreateClick={() => {}}
					updatingIssueId={
						isUpdatingIssue ? updatingVars?.issueId : undefined
					}
				/>
			)}

			<EndSprintModal
				workspaceId={workspaceId}
				projectId={projectId}
				sprint={endingSprint}
				onClose={() => setEndingSprint(null)}
			/>
		</div>
	);
}

function EmptyState({
	icon,
	title,
	description,
	action,
}: {
	icon: ReactNode;
	title: string;
	description: string;
	action?: ReactNode;
}) {
	return (
		<div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
			{icon}
			<div className="flex flex-col gap-1">
				<p className="font-medium">{title}</p>
				<p className="text-sm text-muted">{description}</p>
			</div>
			{action}
		</div>
	);
}
