"use client";

import { toast } from "@heroui/react";

import MyModal from "@/components/ui/my-modal";
import { useErrorToast } from "@/features/billing/lib/plan-limit";

import { useWorkspace } from "../context/workspace-context";
import { useCreateWorkspace } from "../hooks/use-workspaces";
import type { TWorkspaceFormValues } from "../schema/workspace-schema";
import WorkspaceForm from "./WorkspaceForm";

/**
 * The create-workspace form in a modal, opened from the sidebar's workspace
 * menu. The backend caps the Free workspaces a person owns
 * (`FREE_OWNED_WORKSPACES`; paid ones don't count) and answers a 402 past it,
 * which shows an upgrade prompt — the browser doesn't count, since it can't
 * see which workspaces are paid or owned.
 */
export default function CreateWorkspaceModal({
	isOpen,
	onClose,
}: {
	isOpen: boolean;
	onClose: () => void;
}) {
	const { setActiveWorkspaceId } = useWorkspace();
	const showError = useErrorToast();
	const { mutateAsync: createWorkspace, isPending } = useCreateWorkspace();

	const handleCreate = async (values: TWorkspaceFormValues) => {
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
		<MyModal
			isOpen={isOpen}
			onOpenChange={onClose}
			size="md"
			title="Create New Workspace"
		>
			<WorkspaceForm
				onSubmit={handleCreate}
				isSubmitting={isPending}
				onCancel={onClose}
				onSuccess={onClose}
			/>
		</MyModal>
	);
}
