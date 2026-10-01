"use client";

import { use } from "react";

import ProjectHeader from "@/features/projects/components/ProjectHeader";
import SprintsView from "@/features/sprint/components/SprintsView";
import { useProjects } from "@/features/projects/hooks/use-projects";
import { useWorkspace } from "@/features/workspace/context/workspace-context";

export default function ProjectSprintsPage({
	params,
}: PageProps<"/projects/[projectId]/sprints">) {
	const { projectId } = use(params);
	const { activeWorkspaceId } = useWorkspace();
	const workspaceId = activeWorkspaceId ?? "";
	const { data: projects = [] } = useProjects(workspaceId);
	const project = projects.find((p) => p.id === projectId);

	return (
		<div className="flex flex-col gap-6">
			<ProjectHeader projectId={projectId} project={project} active="sprints" />
			<SprintsView projectId={projectId} />
		</div>
	);
}
