"use client";

import { useState } from "react";

import { Button } from "@heroui/react";
import { Plus } from "lucide-react";

import { useWorkspace } from "@/features/workspace/context/workspace-context";
import CreateProjectModal from "@/features/projects/components/CreateProjectModal";
import ProjectList from "@/features/projects/components/ProjectList";
import {
	useCreateProject,
	useProjects,
} from "@/features/projects/hooks/use-projects";
import type { CreateProjectDto } from "@/features/projects/types/project-types";

export default function ProjectsPage() {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const { activeWorkspaceId } = useWorkspace();
	const workspaceId = activeWorkspaceId ?? "";

	const { data: projects = [], isLoading } = useProjects(workspaceId);
	const { mutateAsync: createProject, isPending } =
		useCreateProject(workspaceId);

	const handleSubmit = async (dto: CreateProjectDto) => {
		await createProject(dto);
	};

	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold">Projects</h1>
				<Button onClick={() => setIsModalOpen(true)}>
					<Plus className="h-4 w-4" />
					New Project
				</Button>
			</div>

			{isLoading ? (
				<p className="text-muted">Loading projects…</p>
			) : (
				<ProjectList
					projects={projects}
					onCreateClick={() => setIsModalOpen(true)}
				/>
			)}

			<CreateProjectModal
				isOpen={isModalOpen}
				onOpenChange={setIsModalOpen}
				onSubmit={handleSubmit}
				isLoading={isPending}
			/>
		</div>
	);
}
