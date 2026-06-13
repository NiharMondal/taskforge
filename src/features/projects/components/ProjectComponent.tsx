"use client";
import { Button } from "@heroui/react/button";
import { Plus } from "lucide-react";
import { useCreateProject, useProjects } from "../hooks/use-projects";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import ProjectList from "./ProjectList";
import { useBoolean } from "ahooks";
import MyModal from "@/components/ui/my-modal";
import ProjectForm from "./ProjectForm";
import { TProjectFormValues } from "../schema/project-schema";
import { toast } from "@heroui/react";
import { getApiErrorMessage } from "@/lib/api-error";

export default function ProjectComponent() {
	const [isOpen, { setTrue: openModal, setFalse: closeModal }] = useBoolean();
	const { activeWorkspaceId } = useWorkspace();
	const workspaceId = activeWorkspaceId ?? "";
	const { data: projects = [], isLoading } = useProjects(workspaceId);

	const { mutateAsync: createProject, isPending: isCreating } =
		useCreateProject(workspaceId);

	const handleCreateProject = async (values: TProjectFormValues) => {
		try {
			const res = await createProject(values);
			if (res.success) {
				toast.success(res.message || "Project created successfully");
			}
			return true;
		} catch (error) {
			toast.danger(
				getApiErrorMessage(error || "Failed to create project"),
			);
			return false;
		}
	};
	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-center justify-between gap-4">
				<h1 className="text-2xl font-semibold">Projects</h1>
				<Button onClick={openModal}>
					<Plus className="h-4 w-4" />
					New Project
				</Button>
			</div>

			{isLoading ? (
				<p className="text-muted">Loading projects…</p>
			) : (
				<ProjectList projects={projects} openModal={openModal} />
			)}
			<MyModal
				isOpen={isOpen}
				onOpenChange={closeModal}
				title="Create New Project"
				size="lg"
			>
				<ProjectForm
					onSubmit={handleCreateProject}
					isSubmitting={isCreating}
					onCancel={closeModal}
					onSuccess={closeModal}
				/>
			</MyModal>
		</div>
	);
}
