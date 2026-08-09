"use client";

import { Button, toast } from "@heroui/react";
import { useBoolean } from "ahooks";
import { Trash2 } from "lucide-react";

import MyModal from "@/components/ui/my-modal";
import { getApiErrorMessage } from "@/lib/api-error";

import { useRemoveMembership } from "../hooks/use-memberships";
import type { Member } from "../types/membership-types";

type Props = {
	workspaceId: string;
	member: Member;
};

/**
 * Removes a member from the active workspace behind a confirmation modal.
 * Rendering is gated by the parent to OWNER/ADMIN (and never for the OWNER row
 * or the viewer's own row); the backend remains the real authority.
 */
export default function RemoveMemberButton({ workspaceId, member }: Props) {
	const [isOpen, { setTrue: open, setFalse: close }] = useBoolean();
	const { mutateAsync: removeMember, isPending } =
		useRemoveMembership(workspaceId);

	const memberName = member.user?.name ?? member.user?.email ?? "this member";

	const handleRemove = async () => {
		try {
			const res = await removeMember(member.userId);
			if (res.success) {
				toast.success(res.message || "Member removed");
			}
			close();
		} catch (error) {
			toast.danger(getApiErrorMessage(error, "Failed to remove member"));
		}
	};

	return (
		<>
			<Button
				size="sm"
				variant="danger-soft"
				isIconOnly
				aria-label={`Remove ${memberName}`}
				onClick={open}
			>
				<Trash2 className="size-4" />
			</Button>

			<MyModal
				isOpen={isOpen}
				onOpenChange={(next) => (next ? open() : close())}
				size="sm"
				title="Remove member"
			>
				<div className="flex flex-col gap-4">
					<p className="text-sm text-muted">
						Remove <span className="font-medium text-foreground">
							{memberName}
						</span>{" "}
						from this workspace? They’ll lose access to its projects
						and issues until invited again.
					</p>
					<div className="flex justify-end gap-2">
						<Button variant="outline" type="button" onClick={close}>
							Cancel
						</Button>
						<Button
							variant="danger"
							type="button"
							isDisabled={isPending}
							onClick={handleRemove}
						>
							{isPending ? "Removing…" : "Remove"}
						</Button>
					</div>
				</div>
			</MyModal>
		</>
	);
}
