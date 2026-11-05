"use client";
import { Button } from "@heroui/react/button";
import { Plus } from "lucide-react";
import { useCreateProject, useProjects } from "../hooks/use-projects";
import ErrorAlert from "@/components/ui/error-alert";
import { useWorkspacePermissions } from "@/features/memberships/hooks/use-workspace-permissions";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import ProjectList from "./ProjectList";
import { useBoolean } from "ahooks";
import MyModal from "@/components/ui/my-modal";
import ProjectForm from "./ProjectForm";
import { DEFAULT_WORKFLOW, TProjectFormValues } from "../schema/project-schema";
import { toast } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useBilling } from "@/features/billing/hooks/use-billing";
import { useErrorToast } from "@/features/billing/lib/plan-limit";

export default function ProjectComponent() {
	const [isOpen, { setTrue: openModal, setFalse: closeModal }] = useBoolean();
	const { activeWorkspaceId } = useWorkspace();
	const workspaceId = activeWorkspaceId ?? "";
	const { canManageProjects } = useWorkspacePermissions();
	const {
		data: projects,
		isLoading,
		isError,
		refetch,
	} = useProjects(workspaceId);

	const { mutateAsync: createProject, isPending: isCreating } =
		useCreateProject(workspaceId);
	const { data: billing } = useBilling(workspaceId);
	const canCustomizeWorkflow = billing?.limits.customWorkflows ?? false;
	const showError = useErrorToast();
	const router = useRouter();

	const handleCreateProject = async ({
		workflowFrom,
		...values
	}: TProjectFormValues) => {
		try {
			const res = await createProject({
				...values,
				...(workflowFrom &&
					workflowFrom !== DEFAULT_WORKFLOW && {
						workflowFromProjectId: workflowFrom,
					}),
			});
			// On Pro, offer to shape the new project's statuses right away;
			// it can also be done later from its Workflow tab.
			toast.success(res.message || "Project created successfully", {
				...(canCustomizeWorkflow && {
					actionProps: {
						children: "Customize workflow",
						onPress: () =>
							router.push(`/projects/${res.data.id}/workflow`),
					},
				}),
			});
			return true;
		} catch (error) {
			showError(error, "Failed to create project");
			return false;
		}
	};
	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-center justify-between gap-4 pb-5 border-b border-border">
				<h1 className="text-2xl font-semibold">Projects</h1>
				{canManageProjects && (
					<Button onClick={openModal}>
						<Plus className="h-4 w-4" />
						New Project
					</Button>
				)}
			</div>

			{isError ? (
				<ErrorAlert
					title="Couldn’t load projects"
					description="Check your connection and try again."
					onRetry={() => refetch()}
				/>
			) : isLoading ? (
				<p className="text-muted">Loading projects…</p>
			) : (
				<ProjectList
					projects={projects}
					openModal={openModal}
					canManage={canManageProjects}
				/>
			)}
			<MyModal
				isOpen={isOpen}
				onOpenChange={closeModal}
				title="Create New Project"
				size="lg"
			>
				<ProjectForm
					workflowSources={projects ?? []}
					canCopyWorkflow={canCustomizeWorkflow}
					onSubmit={handleCreateProject}
					isSubmitting={isCreating}
					onCancel={closeModal}
					onSuccess={closeModal}
				/>
			</MyModal>
		</div>
	);
}
