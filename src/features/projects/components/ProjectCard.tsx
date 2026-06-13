import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Chip,
	toast,
} from "@heroui/react";
import { Pencil } from "lucide-react";
import Link from "next/link";

import type { Project } from "../types/project-types";
import { useBoolean } from "ahooks";
import MyModal from "@/components/ui/my-modal";
import ProjectForm from "./ProjectForm";
import { useUpdateProject } from "../hooks/use-projects";
import { TProjectFormValues } from "../schema/project-schema";
import { getApiErrorMessage } from "@/lib/api-error";

interface ProjectCardProps {
	project: Project;
}

export default function ProjectCard({ project }: ProjectCardProps) {
	const [isOpen, { setTrue: openModal, setFalse: closeModal }] = useBoolean();

	const { mutateAsync: updateProject, isPending: isUpdating } =
		useUpdateProject(project.workspaceId);

	const handleUpdateProject = async (values: TProjectFormValues) => {
		try {
			await updateProject({ id: project.id, data: values });
			toast.success("Project updated successfully");
			return true;
		} catch (error) {
			toast.danger(
				getApiErrorMessage(error || "Failed to update project"),
			);
			return false;
		}
	};
	return (
		<>
			<Card className="relative h-full transition-shadow hover:shadow-md">
				<Link
					href={`/projects/${project.id}/board`}
					aria-label={`Open ${project.name}`}
					className="absolute inset-0 z-0 rounded-[inherit]"
				/>

				<CardHeader className="flex-row items-start justify-between gap-2 pb-2">
					<CardTitle className="text-base">{project.name}</CardTitle>

					<Button
						isIconOnly
						size="sm"
						variant="ghost"
						aria-label={`Edit ${project.name}`}
						className="relative z-10 -mr-1 -mt-1"
						onClick={openModal}
					>
						<Pencil className="size-4" aria-hidden />
					</Button>
				</CardHeader>

				<CardContent className="flex flex-col gap-3">
					{project.description && (
						<CardDescription className="line-clamp-2">
							{project.description}
						</CardDescription>
					)}

					<div className="mt-auto flex gap-2">
						<Chip size="sm" variant="soft">
							{project._count?.issues ?? 0} issues
						</Chip>
						<Chip size="sm" variant="soft">
							{project._count?.sprints ?? 0} sprints
						</Chip>
					</div>
				</CardContent>
			</Card>

			<MyModal
				isOpen={isOpen}
				onOpenChange={closeModal}
				title="Create New Project"
				size="lg"
			>
				<ProjectForm
					onSubmit={handleUpdateProject}
					isSubmitting={isUpdating}
					onCancel={closeModal}
					defaultValues={project}
					onSuccess={closeModal}
				/>
			</MyModal>
		</>
	);
}
