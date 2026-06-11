"use client";

import { useMemo, useState } from "react";

import { Alert, Button, Spinner } from "@heroui/react";
import { Plus } from "lucide-react";

import { useMemberships } from "@/features/memberships/hooks/use-memberships";
import ProjectHeader from "@/features/projects/components/ProjectHeader";
import { useProjects } from "@/features/projects/hooks/use-projects";
import { useWorkspace } from "@/features/workspace/context/workspace-context";

import { useIssues, useUpdateIssue } from "../hooks/use-issues";
import type { Issue, IssueStatus } from "../types/issue-types";
import CreateIssueModal from "./CreateIssueModal";
import IssueDetailModal from "./IssueDetailModal";
import IssueList from "./IssueList";
import { useBoolean } from "ahooks";

/**
 * Orchestrates the project-scoped issues page: resolves project + members,
 * loads issues, and wires create / inline-status mutations. Kept out of the
 * route file so the same view can back a future tab layout without change.
 */
export default function IssuesView({ projectId }: { projectId: string }) {
	const [isOpen, { setTrue: openModal, setFalse: closeModal }] = useBoolean();
	const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
	const { activeWorkspaceId } = useWorkspace();
	const workspaceId = activeWorkspaceId ?? "";

	// The project header reuses the cached workspace projects list — no extra
	// request, and it stays correct after a workspace switch invalidates caches.
	const { data: projects } = useProjects(workspaceId);
	const project = projects?.find((p) => p.id === projectId);

	const { data: members = [] } = useMemberships(workspaceId);
	const {
		data: issues = [],
		isLoading,
		isError,
	} = useIssues(workspaceId, projectId);

	const {
		mutate: updateIssue,
		variables: updatingVars,
		isPending: isUpdatingIssue,
	} = useUpdateIssue(workspaceId, projectId);

	// userId → display name, for resolving issue assignees in the list.
	const assigneeNames = useMemo(() => {
		const map = new Map<string, string>();
		for (const m of members) {
			if (m.user) map.set(m.userId, m.user.name || m.user.email);
		}
		return map;
	}, [members]);

	const handleStatusChange = (issueId: string, status: IssueStatus) => {
		updateIssue({ issueId, dto: { status } });
	};

	return (
		<div className="flex flex-col gap-6">
			<ProjectHeader
				projectId={projectId}
				project={project}
				active="issues"
				actions={
					<Button onPress={openModal}>
						<Plus className="h-4 w-4" />
						New Issue
					</Button>
				}
			/>

			{isError ? (
				<Alert status="danger">
					<Alert.Indicator />
					<Alert.Content>
						<Alert.Title>Couldn’t load issues</Alert.Title>
						<Alert.Description>
							Check your connection and try again.
						</Alert.Description>
					</Alert.Content>
				</Alert>
			) : isLoading ? (
				<div className="flex items-center gap-2 py-12 text-muted">
					<Spinner size="sm" />
					Loading issues…
				</div>
			) : (
				<IssueList
					issues={issues}
					assigneeNames={assigneeNames}
					onStatusChange={handleStatusChange}
					onOpenIssue={setSelectedIssue}
					onCreateClick={openModal}
					updatingIssueId={
						isUpdatingIssue ? updatingVars?.issueId : undefined
					}
				/>
			)}

			<CreateIssueModal
				isOpen={isOpen}
				onOpenChange={closeModal}
				members={members}
				projectId={projectId}
			/>

			<IssueDetailModal
				issue={selectedIssue}
				onClose={() => setSelectedIssue(null)}
				members={members}
				workspaceId={workspaceId}
				projectId={projectId}
			/>
		</div>
	);
}
