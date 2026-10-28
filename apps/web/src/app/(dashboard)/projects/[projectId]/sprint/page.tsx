"use client";

import { use } from "react";

import ProjectHeader from "@/features/projects/components/ProjectHeader";
import CurrentSprintView from "@/features/sprint/components/CurrentSprintView";
import { useProjects } from "@/features/projects/hooks/use-projects";
import { useWorkspace } from "@/features/workspace/context/workspace-context";

/** The project's active sprint and its issues: `/projects/[projectId]/sprint`. */
export default function ProjectCurrentSprintPage({
	params,
}: PageProps<"/projects/[projectId]/sprint">) {
	const { projectId } = use(params);
	const { activeWorkspaceId } = useWorkspace();
	const workspaceId = activeWorkspaceId ?? "";
	const { data: projects = [] } = useProjects(workspaceId);
	const project = projects.find((p) => p.id === projectId);

	return (
		<div className="flex flex-col gap-6">
			<ProjectHeader projectId={projectId} project={project} active="sprint" />
			<CurrentSprintView projectId={projectId} />
		</div>
	);
}
