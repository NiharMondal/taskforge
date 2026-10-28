"use client";

import { Button, toast } from "@heroui/react";
import { useBoolean } from "ahooks";
import { X } from "lucide-react";

import ConfirmModal from "@/components/ui/confirm-modal";
import { getApiErrorMessage } from "@/lib/api-error";

import { useRevokeInvitation } from "../hooks/use-invitations";
import type { Invitation } from "../types/invitation-types";

/**
 * Revokes a PENDING invitation behind a confirmation. The list it sits in is
 * already OWNER/ADMIN-only; the backend (`invitation:manage`) is the authority.
 */
export default function RevokeInvitationButton({
	workspaceId,
	invitation,
}: {
	workspaceId: string;
	invitation: Invitation;
}) {
	const [isOpen, { setTrue: open, setFalse: close }] = useBoolean();
	const { mutateAsync: revoke, isPending } = useRevokeInvitation(workspaceId);

	const handleRevoke = async () => {
		try {
			const res = await revoke(invitation.id);
			toast.success(res.message || "Invitation revoked");
			close();
		} catch (error) {
			toast.danger(getApiErrorMessage(error, "Failed to revoke invitation"));
		}
	};

	return (
		<>
			<Button
				size="sm"
				variant="danger-soft"
				isIconOnly
				aria-label={`Revoke invitation for ${invitation.email}`}
				onClick={open}
			>
				<X className="size-4" />
			</Button>

			<ConfirmModal
				isOpen={isOpen}
				onClose={close}
				title="Revoke invitation"
				description={
					<>
						Revoke the invitation for{" "}
						<span className="font-medium text-foreground">
							{invitation.email}
						</span>
						? The link in their email stops working. You can invite
						them again later.
					</>
				}
				confirmLabel="Revoke"
				pendingLabel="Revoking…"
				isPending={isPending}
				onConfirm={handleRevoke}
			/>
		</>
	);
}
