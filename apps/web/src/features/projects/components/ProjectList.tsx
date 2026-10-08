import { Button } from "@heroui/react";
import { FolderPlus } from "lucide-react";

import type { Project } from "../types/project-types";
import ProjectCard from "./ProjectCard";

interface ProjectListProps {
	projects: Project[] | undefined;
	openModal: () => void;
	/** OWNER/ADMIN only: shows the create CTA and the per-card edit control. */
	canManage: boolean;
}

export default function ProjectList({
	projects,
	openModal,
	canManage,
}: ProjectListProps) {
	if (projects?.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
				<FolderPlus className="h-12 w-12 text-muted/40" />
				<div className="flex flex-col gap-1">
					<p className="font-medium">No projects yet</p>
					<p className="text-sm text-muted">
						{canManage
							? "Create a project to start tracking issues and sprints."
							: "Projects will appear here once an admin creates them."}
					</p>
				</div>
				{canManage && (
					<Button variant="outline" onClick={openModal}>
						Create your first project
					</Button>
				)}
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{projects?.map((project) => (
				<ProjectCard
					key={project.id}
					project={project}
					canManage={canManage}
				/>
			))}
		</div>
	);
}
