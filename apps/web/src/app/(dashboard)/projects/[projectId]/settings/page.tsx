"use client";

import { use } from "react";

import ProjectHeader from "@/features/projects/components/ProjectHeader";
import SprintsView from "@/features/sprint/components/SprintsView";
import { useProjects } from "@/features/projects/hooks/use-projects";
import { useWorkspace } from "@/features/workspace/context/workspace-context";

/**
 * Project settings: `/projects/[projectId]/settings`. For now just sprint
 * planning (create / edit / start / end); the running sprint is shown on the
 * Current Sprint tab.
 */
export default function ProjectSettingsPage({
	params,
}: PageProps<"/projects/[projectId]/settings">) {
	const { projectId } = use(params);
	const { activeWorkspaceId } = useWorkspace();
	const workspaceId = activeWorkspaceId ?? "";
	const { data: projects = [] } = useProjects(workspaceId);
	const project = projects.find((p) => p.id === projectId);

	return (
		<div className="flex flex-col gap-6">
			<ProjectHeader
				projectId={projectId}
				project={project}
				active="settings"
			/>
			<SprintsView projectId={projectId} />
		</div>
	);
}
