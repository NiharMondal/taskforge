"use client";

import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	toast,
} from "@heroui/react";
import { useBoolean } from "ahooks";
import { Trash2 } from "lucide-react";

import ConfirmModal from "@/components/ui/confirm-modal";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { useDeleteWorkspace } from "@/features/workspace/hooks/use-workspaces";
import type { Workspace } from "@/features/workspace/types/workspace-types";
import { getApiErrorMessage } from "@/lib/api-error";

/**
 * Settings → General "Danger zone": deletes the active workspace. Rendered for
 * the OWNER only (`canDeleteWorkspace`). Deleting your last workspace is not
 * offered: the app has no state for "no workspace at all".
 */
export default function DeleteWorkspaceCard({
	workspace,
}: {
	workspace: Workspace;
}) {
	const [isOpen, { setTrue: open, setFalse: close }] = useBoolean();
	const { workspaces, setActiveWorkspaceId } = useWorkspace();
	const { mutateAsync: deleteWorkspace, isPending } = useDeleteWorkspace();

	const fallback = workspaces.find((w) => w.id !== workspace.id);

	const handleDelete = async () => {
		if (!fallback) return;
		try {
			const res = await deleteWorkspace(workspace.id);
			setActiveWorkspaceId(fallback.id);
			toast.success(res.message || "Workspace deleted");
			close();
		} catch (error) {
			toast.danger(getApiErrorMessage(error, "Failed to delete workspace"));
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-danger">Danger zone</CardTitle>
				<CardDescription>
					{fallback
						? "Deleting this workspace removes its projects, issues, sprints, members and invitations for everyone."
						: "This is your only workspace. Create another one before deleting it."}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Button
					variant="danger"
					className="self-start"
					isDisabled={!fallback}
					onClick={open}
				>
					<Trash2 className="size-4" />
					Delete workspace
				</Button>

				<ConfirmModal
					isOpen={isOpen}
					onClose={close}
					title="Delete workspace"
					description={
						<>
							Delete{" "}
							<span className="font-medium text-foreground">
								{workspace.name}
							</span>{" "}
							and everything in it? Every member loses access. This
							can’t be undone.
						</>
					}
					confirmLabel="Delete workspace"
					pendingLabel="Deleting…"
					isPending={isPending}
					onConfirm={handleDelete}
					typeToConfirm={workspace.name}
				/>
			</CardContent>
		</Card>
	);
}
