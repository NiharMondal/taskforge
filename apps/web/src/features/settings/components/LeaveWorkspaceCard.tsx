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
import { LogOut } from "lucide-react";

import ConfirmModal from "@/components/ui/confirm-modal";
import { useLeaveWorkspace } from "@/features/memberships/hooks/use-memberships";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import type { Workspace } from "@/features/workspace/types/workspace-types";
import { getApiErrorMessage } from "@/lib/api-error";

/**
 * Settings → General: leave the active workspace. Rendered for everyone but
 * the OWNER (`canLeaveWorkspace`), who must transfer ownership or delete the
 * workspace instead. Like deleting, it isn't offered for your only workspace.
 */
export default function LeaveWorkspaceCard({
	workspace,
}: {
	workspace: Workspace;
}) {
	const [isOpen, { setTrue: open, setFalse: close }] = useBoolean();
	const { workspaces, setActiveWorkspaceId } = useWorkspace();
	const { mutateAsync: leave, isPending } = useLeaveWorkspace();

	const fallback = workspaces.find((w) => w.id !== workspace.id);

	const handleLeave = async () => {
		if (!fallback) return;
		try {
			const res = await leave(workspace.id);
			setActiveWorkspaceId(fallback.id);
			toast.success(res.message || "You left the workspace");
			close();
		} catch (error) {
			toast.danger(getApiErrorMessage(error, "Failed to leave the workspace"));
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-danger">Leave workspace</CardTitle>
				<CardDescription>
					{fallback
						? "You lose access to its projects and issues. Issues assigned to you keep you as their assignee until someone changes it."
						: "This is your only workspace, so you can't leave it."}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Button
					variant="danger-soft"
					className="self-start"
					isDisabled={!fallback}
					onClick={open}
				>
					<LogOut className="size-4" />
					Leave workspace
				</Button>

				<ConfirmModal
					isOpen={isOpen}
					onClose={close}
					title="Leave workspace"
					description={
						<>
							Leave{" "}
							<span className="font-medium text-foreground">
								{workspace.name}
							</span>
							? To come back you’ll need a new invitation.
						</>
					}
					confirmLabel="Leave"
					pendingLabel="Leaving…"
					isPending={isPending}
					onConfirm={handleLeave}
				/>
			</CardContent>
		</Card>
	);
}
