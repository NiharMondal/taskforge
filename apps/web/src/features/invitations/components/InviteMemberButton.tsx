"use client";

import { Button, Spinner, toast } from "@heroui/react";
import Link from "next/link";
import { useBoolean } from "ahooks";
import { UserPlus } from "lucide-react";

import MyModal from "@/components/ui/my-modal";
import { useBilling } from "@/features/billing/hooks/use-billing";
import {
	BILLING_PATH,
	seatUsage,
	useErrorToast,
} from "@/features/billing/lib/plan-limit";
import { useWorkspacePermissions } from "@/features/memberships/hooks/use-workspace-permissions";
import { holdsAll } from "@/features/memberships/lib/permissions";
import { useRoles } from "@/features/roles/hooks/use-roles";

import { useCreateInvitation } from "../hooks/use-invitations";
import type { TInviteFormValues } from "../schema/invitation-schema";
import InviteForm from "./InviteForm";

/**
 * "Invite member" entry point for the settings page. Opens a modal with the
 * email and role form; the backend resolves the workspace from the
 * `x-workspace-id` header and refuses a role with more access than the
 * inviter's — so only roles within the inviter's own access are offered.
 * Rendering is gated to `invitation:manage` by the parent (backend enforces
 * for real). On a plan whose seats are taken (members plus pending
 * invitations) the button is disabled with an upgrade hint; the backend's 402
 * still covers a race.
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
	const { data: billing } = useBilling(workspaceId);
	const seats = billing ? seatUsage(billing) : null;
	const showError = useErrorToast();
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
			// Covers duplicate invites, already-a-member rejections and a full
			// plan — the backend message is surfaced and the modal stays open.
			showError(error, "Failed to send invitation");
			return false;
		}
	};

	return (
		<>
			<div className="flex flex-col items-end gap-1">
				<Button size="sm" onClick={openModal} isDisabled={seats?.isFull}>
					<UserPlus className="h-4 w-4" />
					Invite Member
				</Button>
				{seats?.isFull && (
					<p className="text-xs text-muted">
						All {seats.limit} seats are used.{" "}
						<Link href={BILLING_PATH} className="text-accent hover:underline">
							Upgrade
						</Link>
					</p>
				)}
			</div>

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
