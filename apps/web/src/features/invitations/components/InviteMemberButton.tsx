"use client";

import { Button, Spinner, toast } from "@heroui/react";
import { useBoolean } from "ahooks";
import { UserPlus } from "lucide-react";

import MyModal from "@/components/ui/my-modal";
import { useWorkspacePermissions } from "@/features/memberships/hooks/use-workspace-permissions";
import { holdsAll } from "@/features/memberships/lib/permissions";
import { useRoles } from "@/features/roles/hooks/use-roles";
import { getApiErrorMessage } from "@/lib/api-error";

import { useCreateInvitation } from "../hooks/use-invitations";
import type { TInviteFormValues } from "../schema/invitation-schema";
import InviteForm from "./InviteForm";

/**
 * "Invite member" entry point for the settings page. Opens a modal with the
 * email and role form; the backend resolves the workspace from the
 * `x-workspace-id` header and refuses a role with more access than the
 * inviter's — so only roles within the inviter's own access are offered.
 * Rendering is gated to `invitation:manage` by the parent (backend enforces
 * for real).
 */
export default function InviteMemberButton({
	workspaceId,
}: {
	workspaceId: string;
}) {
	const [isOpen, { setTrue: openModal, setFalse: closeModal }] = useBoolean();

	const { mutateAsync: createInvitation, isPending: isSending } =
		useCreateInvitation(workspaceId);
	const permissions = useWorkspacePermissions();
	const { data: roles, isLoading: isRolesLoading } = useRoles(workspaceId);
	const invitableRoles = (roles ?? []).filter(
		(role) =>
			role.systemKey !== "OWNER" && holdsAll(permissions, role.permissions),
	);

	const handleInvite = async (values: TInviteFormValues) => {
		try {
			const res = await createInvitation(values);
			if (res.success) {
				toast.success(res.message || "Invitation sent");
			}
			return true;
		} catch (error) {
			// Covers duplicate invites and already-a-member rejections — the
			// backend message is surfaced and the modal stays open.
			toast.danger(getApiErrorMessage(error, "Failed to send invitation"));
			return false;
		}
	};

	return (
		<>
			<Button size="sm" onClick={openModal}>
				<UserPlus className="h-4 w-4" />
				Invite Member
			</Button>

			<MyModal
				isOpen={isOpen}
				onOpenChange={closeModal}
				size="lg"
				title="Invite Member"
			>
				{isRolesLoading ? (
					<div className="flex justify-center py-8">
						<Spinner />
					</div>
				) : (
					// Mounted once the roles are in, so the default role is set.
					<InviteForm
						roles={invitableRoles}
						onSubmit={handleInvite}
						isSubmitting={isSending}
						onCancel={closeModal}
						onSuccess={closeModal}
					/>
				)}
			</MyModal>
		</>
	);
}
