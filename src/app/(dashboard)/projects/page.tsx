// "use client";

// import { useState } from "react";

// import { Button, toast } from "@heroui/react";
// import { Plus } from "lucide-react";

// import { getApiErrorMessage } from "@/lib/api-error";
// import { useWorkspace } from "@/features/workspace/context/workspace-context";
// import ProjectFormModal from "@/features/projects/components/ProjectFormModal";
// import ProjectList from "@/features/projects/components/ProjectList";
// import {
// 	useCreateProject,
// 	useProjects,
// 	useUpdateProject,
// } from "@/features/projects/hooks/use-projects";
// import type { TProjectFormValues } from "@/features/projects/schema/project-schema";
// import type { Project } from "@/features/projects/types/project-types";

// type ModalState =
// 	| { mode: "create" }
// 	| { mode: "edit"; project: Project }
// 	| null;

// export default function ProjectsPage() {
// 	const [modal, setModal] = useState<ModalState>(null);
// 	const { activeWorkspaceId } = useWorkspace();
// 	const workspaceId = activeWorkspaceId ?? "";

// 	const { data: projects = [], isLoading } = useProjects(workspaceId);
// 	const { mutateAsync: createProject, isPending: isCreating } =
// 		useCreateProject(workspaceId);
// 	const { mutateAsync: updateProject, isPending: isUpdating } =
// 		useUpdateProject(workspaceId);

// 	const handleSubmit = async (
// 		values: TProjectFormValues,
// 	): Promise<boolean> => {
// 		try {
// 			if (modal?.mode === "edit") {
// 				await updateProject({ id: modal.project.id, data: values });
// 				toast.success("Project updated successfully");
// 			} else {
// 				await createProject(values);
// 				toast.success("Project created successfully");
// 			}
// 			return true;
// 		} catch (err) {
// 			toast.danger(getApiErrorMessage(err) || "Failed to save project");
// 			return false;
// 		}
// 	};

// 	return (
// 		<div className="flex flex-col gap-6">
// 			<div className="flex items-center justify-between">
// 				<h1 className="text-2xl font-semibold">Projects</h1>
// 				<Button onClick={() => setModal({ mode: "create" })}>
// 					<Plus className="h-4 w-4" />
// 					New Project
// 				</Button>
// 			</div>

// 			{isLoading ? (
// 				<p className="text-muted">Loading projects…</p>
// 			) : (
// 				<ProjectList
// 					projects={projects}
// 					onCreateClick={() => setModal({ mode: "create" })}
// 					onEdit={(project) => setModal({ mode: "edit", project })}
// 				/>
// 			)}

// 			<ProjectFormModal
// 				isOpen={modal !== null}
// 				onOpenChange={(open) => {
// 					if (!open) setModal(null);
// 				}}
// 				isSubmitting={isCreating || isUpdating}
// 				defaultValues={
// 					modal?.mode === "edit"
// 						? {
// 								name: modal.project.name,
// 								description: modal.project.description ?? "",
// 							}
// 						: null
// 				}
// 				onSubmit={handleSubmit}
// 			/>
// 		</div>
// 	);
// }

import ProjectComponent from "@/features/projects/components/ProjectComponent";

export default function ProjectPage() {
	return <ProjectComponent />;
}
