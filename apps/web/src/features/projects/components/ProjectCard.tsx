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
import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

import type { Project } from "../types/project-types";
import { useBoolean } from "ahooks";
import ConfirmModal from "@/components/ui/confirm-modal";
import MyModal from "@/components/ui/my-modal";
import ProjectForm from "./ProjectForm";
import { useDeleteProject, useUpdateProject } from "../hooks/use-projects";
import { TProjectFormValues } from "../schema/project-schema";
import { getApiErrorMessage } from "@/lib/api-error";

interface ProjectCardProps {
	project: Project;
	/** OWNER/ADMIN only: shows the edit and delete controls. */
	canManage: boolean;
}

export default function ProjectCard({ project, canManage }: ProjectCardProps) {
	const [isOpen, { setTrue: openModal, setFalse: closeModal }] = useBoolean();
	const [isDeleteOpen, { setTrue: openDelete, setFalse: closeDelete }] =
		useBoolean();

	const { mutateAsync: updateProject, isPending: isUpdating } =
		useUpdateProject(project.workspaceId);
	const { mutateAsync: deleteProject, isPending: isDeleting } =
		useDeleteProject(project.workspaceId);

	const handleDeleteProject = async () => {
		try {
			const res = await deleteProject(project.id);
			toast.success(res.message || "Project deleted");
			closeDelete();
		} catch (error) {
			toast.danger(getApiErrorMessage(error, "Failed to delete project"));
		}
	};

	const handleUpdateProject = async (values: TProjectFormValues) => {
		try {
			await updateProject({ id: project.id, data: values });
			toast.success("Project updated successfully");
			return true;
		} catch (error) {
			toast.danger(getApiErrorMessage(error, "Failed to update project"));
			return false;
		}
	};
	return (
		<>
			<Card className="relative h-full transition-shadow hover:shadow-md">
				<Link
					href={`/projects/${project.id}/active-sprint`}
					aria-label={`Open ${project.name}`}
					className="absolute inset-0 z-0 rounded-[inherit]"
				/>

				<CardHeader className="flex-row items-start justify-between gap-2 pb-2">
					<CardTitle className="text-base">{project.name}</CardTitle>

					{canManage && (
						<div className="relative z-10 -mr-1 -mt-1 flex gap-1">
							<Button
								isIconOnly
								size="sm"
								variant="ghost"
								aria-label={`Edit ${project.name}`}
								onClick={openModal}
							>
								<Pencil className="size-4" aria-hidden />
							</Button>
							<Button
								isIconOnly
								size="sm"
								variant="ghost"
								aria-label={`Delete ${project.name}`}
								className="text-danger"
								onClick={openDelete}
							>
								<Trash2 className="size-4" aria-hidden />
							</Button>
						</div>
					)}
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
				title="Edit Project"
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

			<ConfirmModal
				isOpen={isDeleteOpen}
				onClose={closeDelete}
				title="Delete project"
				description={
					<>
						Delete{" "}
						<span className="font-medium text-foreground">
							{project.name}
						</span>{" "}
						with all of its {project._count?.issues ?? 0} issues and{" "}
						{project._count?.sprints ?? 0} sprints? This can’t be
						undone.
					</>
				}
				confirmLabel="Delete project"
				pendingLabel="Deleting…"
				isPending={isDeleting}
				onConfirm={handleDeleteProject}
				typeToConfirm={project.name}
			/>
		</>
	);
}
