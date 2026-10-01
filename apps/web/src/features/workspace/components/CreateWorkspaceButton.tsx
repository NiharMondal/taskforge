"use client";

import { Button, toast } from "@heroui/react";
import { useBoolean } from "ahooks";
import { Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import MyModal from "@/components/ui/my-modal";
import { getApiErrorMessage } from "@/lib/api-error";

import { FREE_PLAN_WORKSPACE_LIMIT } from "../constants";
import { useWorkspace } from "../context/workspace-context";
import { useCreateWorkspace } from "../hooks/use-workspaces";
import type { TWorkspaceFormValues } from "../schema/workspace-schema";
import WorkspaceForm from "./WorkspaceForm";

/**
 * "New workspace" entry point for the sidebar. Opens a modal with the create
 * form — unless the user is already at the FREE-plan quota, in which case the
 * modal upsells a subscription instead (the gate is client-side until the
 * Subscriptions endpoint ships, see ../constants).
 */
export default function CreateWorkspaceButton() {
	const router = useRouter();
	const [isOpen, { setTrue: openModal, setFalse: closeModal }] = useBoolean();
	const { workspaces, setActiveWorkspaceId, isLoading } = useWorkspace();

	const { mutateAsync: createWorkspace, isPending: isCreating } =
		useCreateWorkspace();

	const isAtLimit = workspaces.length >= FREE_PLAN_WORKSPACE_LIMIT;

	const handleCreateWorkspace = async (values: TWorkspaceFormValues) => {
		try {
			const res = await createWorkspace(values);
			if (res.success) {
				toast.success(res.message || "Workspace created successfully");
				// Drop the user straight into their new workspace.
				if (res.data?.id) setActiveWorkspaceId(res.data.id);
			}
			return true;
		} catch (error) {
			toast.danger(
				getApiErrorMessage(error || "Failed to create workspace"),
			);
			return false;
		}
	};

	return (
		<>
			<Button
				variant="ghost"
				size="sm"
				fullWidth
				onClick={openModal}
				isDisabled={isLoading}
			>
				<Plus className="h-4 w-4" />
				New Workspace
			</Button>

			<MyModal
				isOpen={isOpen}
				onOpenChange={closeModal}
				size="md"
				title={isAtLimit ? "Workspace Limit Reached" : "Create New Workspace"}
			>
				{isAtLimit ? (
					<div className="flex flex-col gap-4 pb-2">
						<p className="text-sm text-muted">
							The free plan includes up to{" "}
							{FREE_PLAN_WORKSPACE_LIMIT} workspaces, and you’re
							already using both. Subscribe to a paid plan to
							create more workspaces.
						</p>
						<div className="flex justify-end gap-2">
							<Button
								variant="outline"
								type="button"
								onClick={closeModal}
							>
								Not Now
							</Button>
							<Button
								type="button"
								onClick={() => {
									closeModal();
									router.push("/settings");
								}}
							>
								<Sparkles className="h-4 w-4" />
								Upgrade Plan
							</Button>
						</div>
					</div>
				) : (
					<WorkspaceForm
						onSubmit={handleCreateWorkspace}
						isSubmitting={isCreating}
						onCancel={closeModal}
						onSuccess={closeModal}
					/>
				)}
			</MyModal>
		</>
	);
}
