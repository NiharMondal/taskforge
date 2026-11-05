"use client";

import { useMemo, useState } from "react";

import { Button, Spinner, toast } from "@heroui/react";
import { useBoolean } from "ahooks";
import { ListTodo, Plus } from "lucide-react";

import ErrorAlert from "@/components/ui/error-alert";
import { useLabels } from "@/features/labels/hooks/use-labels";
import { useMemberships } from "@/features/memberships/hooks/use-memberships";
import { useWorkspacePermissions } from "@/features/memberships/hooks/use-workspace-permissions";
import { getMemberName } from "@/features/memberships/lib/member";
import ProjectHeader from "@/features/projects/components/ProjectHeader";
import { useProjects } from "@/features/projects/hooks/use-projects";
import { useSprints } from "@/features/sprint/hooks/use-sprints";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { getApiErrorMessage } from "@/lib/api-error";

import { useIssues, useUpdateIssue } from "../hooks/use-issues";
import type { IssueStatus } from "../types/issue-types";
import CreateIssueModal from "./CreateIssueModal";
import {
	EMPTY_FILTERS,
	filterIssues,
	type IssueFilters,
} from "../lib/issue-filters";
import IssueFilterBar from "./IssueFilterBar";
import IssueTable from "./list/IssueTable";

/**
 * The List tab: every issue in the project as a filterable table, whatever
 * its sprint — the board shows only the active sprint, the backlog plans.
 * Filtering is client-side over the cached project list the board and backlog
 * share.
 */
export default function IssuesView({ projectId }: { projectId: string }) {
	const [isOpen, { setTrue: openModal, setFalse: closeModal }] = useBoolean();
	const [filters, setFilters] = useState<IssueFilters>(EMPTY_FILTERS);
	const { activeWorkspaceId } = useWorkspace();
	const workspaceId = activeWorkspaceId ?? "";

	const { data: projects } = useProjects(workspaceId);
	const project = projects?.find((p) => p.id === projectId);
	const { data: members = [] } = useMemberships(workspaceId);
	const { data: labels = [] } = useLabels(workspaceId);
	const { data: sprints = [] } = useSprints(workspaceId, projectId);
	const permissions = useWorkspacePermissions();
	const {
		data: issues = [],
		isLoading,
		isError,
		refetch,
	} = useIssues(workspaceId, projectId);
	const {
		mutate: updateIssue,
		variables: updatingVars,
		isPending: isUpdatingIssue,
	} = useUpdateIssue(workspaceId, projectId);

	const memberNames = useMemo(() => {
		const map = new Map<string, string>();
		for (const m of members) {
			if (m.user) map.set(m.userId, getMemberName(m));
		}
		return map;
	}, [members]);

	const visible = useMemo(
		() => filterIssues(issues, filters, project?.key),
		[issues, filters, project?.key],
	);

	const handleStatusChange = (issueId: string, status: IssueStatus) => {
		// Toast on the outcome, not on the click: the PATCH can still be
		// rejected (and the optimistic write rolled back).
		updateIssue(
			{ issueId, dto: { status } },
			{
				onSuccess: ({ message }) =>
					toast.success(message || "Status updated successfully"),
				onError: (error) =>
					toast.danger(getApiErrorMessage(error, "Failed to update status")),
			},
		);
	};

	return (
		<div className="flex flex-col gap-6">
			<ProjectHeader
				projectId={projectId}
				project={project}
				active="list"
				actions={
					permissions.canCreateIssue && (
						<Button onPress={openModal}>
							<Plus className="h-4 w-4" />
							New Issue
						</Button>
					)
				}
			/>

			{isError ? (
				<ErrorAlert
					title="Couldn’t load issues"
					description="Check your connection and try again."
					onRetry={() => refetch()}
				/>
			) : isLoading ? (
				<div className="flex items-center gap-2 py-12 text-muted">
					<Spinner size="sm" />
					Loading issues…
				</div>
			) : issues.length === 0 ? (
				<div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
					<ListTodo className="h-12 w-12 text-muted/40" />
					<div className="flex flex-col gap-1">
						<p className="font-medium">No issues yet</p>
						<p className="text-sm text-muted">
							{permissions.canCreateIssue
								? "Create the first issue to start tracking work in this project."
								: "Issues will appear here once someone creates them."}
						</p>
					</div>
					{permissions.canCreateIssue && (
						<Button variant="outline" onPress={openModal}>
							Create your first issue
						</Button>
					)}
				</div>
			) : (
				<div className="flex flex-col gap-4">
					<IssueFilterBar
						filters={filters}
						onChange={setFilters}
						members={members}
						sprints={sprints}
						showStatus
						labels={labels}
					/>
					{visible.length === 0 ? (
						<p className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted">
							No issues match these filters.
						</p>
					) : (
						<IssueTable
							issues={visible}
							memberNames={memberNames}
							permissions={permissions}
							onStatusChange={handleStatusChange}
							updatingIssueId={
								isUpdatingIssue ? updatingVars?.issueId : undefined
							}
						/>
					)}
					<p className="text-xs text-muted">
						{visible.length} of {issues.length}{" "}
						{issues.length === 1 ? "issue" : "issues"}
					</p>
				</div>
			)}

			<CreateIssueModal
				isOpen={isOpen}
				onOpenChange={closeModal}
				members={members}
				projectId={projectId}
			/>
		</div>
	);
}
