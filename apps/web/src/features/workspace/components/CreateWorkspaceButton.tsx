"use client";

import { Button, toast } from "@heroui/react";
import { useBoolean } from "ahooks";
import { Plus } from "lucide-react";

import MyModal from "@/components/ui/my-modal";
import { useErrorToast } from "@/features/billing/lib/plan-limit";

import { useWorkspace } from "../context/workspace-context";
import { useCreateWorkspace } from "../hooks/use-workspaces";
import type { TWorkspaceFormValues } from "../schema/workspace-schema";
import WorkspaceForm from "./WorkspaceForm";

/**
 * "New workspace" entry point for the sidebar. Opens a modal with the create
 * form. The backend caps the Free workspaces a person owns
 * (`FREE_OWNED_WORKSPACES`; paid ones don't count) and answers a 402 past it,
 * which shows an upgrade prompt — the browser doesn't count, since it can't
 * see which workspaces are paid or owned.
 */
export default function CreateWorkspaceButton() {
	const [isOpen, { setTrue: openModal, setFalse: closeModal }] = useBoolean();
	const { setActiveWorkspaceId, isLoading } = useWorkspace();
	const showError = useErrorToast();

	const { mutateAsync: createWorkspace, isPending: isCreating } =
		useCreateWorkspace();

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
			showError(error, "Failed to create workspace");
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
				title="Create New Workspace"
			>
				<WorkspaceForm
					onSubmit={handleCreateWorkspace}
					isSubmitting={isCreating}
					onCancel={closeModal}
					onSuccess={closeModal}
				/>
			</MyModal>
		</>
	);
}
