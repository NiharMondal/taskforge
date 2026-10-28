"use client";

import { useState } from "react";

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
import { Crown } from "lucide-react";

import ConfirmModal from "@/components/ui/confirm-modal";
import { TFSelect } from "@/components/ui/TFSelect";
import { getMemberName } from "@/features/memberships/lib/member";
import {
	useMemberships,
	useTransferOwnership,
} from "@/features/memberships/hooks/use-memberships";
import type { Workspace } from "@/features/workspace/types/workspace-types";
import { getApiErrorMessage } from "@/lib/api-error";

const NOBODY = "__nobody__";

/**
 * Settings → General: the OWNER hands the workspace to another member, who
 * becomes OWNER while the current owner becomes ADMIN. Rendered for the OWNER
 * only (`canTransferOwnership`); confirmed by typing the workspace's name.
 */
export default function TransferOwnershipCard({
	workspace,
	currentUserId,
}: {
	workspace: Workspace;
	currentUserId: string | undefined;
}) {
	const [isOpen, { setTrue: open, setFalse: close }] = useBoolean();
	const [newOwnerId, setNewOwnerId] = useState(NOBODY);
	const { data: members = [] } = useMemberships(workspace.id);
	const { mutateAsync: transfer, isPending } = useTransferOwnership(
		workspace.id,
	);

	const candidates = members.filter((m) => m.userId !== currentUserId);
	const newOwner = candidates.find((m) => m.userId === newOwnerId);

	const handleTransfer = async () => {
		if (!newOwner) return;
		try {
			const res = await transfer(newOwner.userId);
			toast.success(res.message || "Ownership transferred");
			close();
		} catch (error) {
			toast.danger(getApiErrorMessage(error, "Failed to transfer ownership"));
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Transfer ownership</CardTitle>
				<CardDescription>
					{candidates.length > 0
						? "Make another member the owner. You stay in the workspace as an admin."
						: "Invite someone first: ownership can only go to a member of this workspace."}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-wrap items-end gap-3">
				<TFSelect
					aria-label="New owner"
					label="New owner"
					value={newOwnerId}
					onChange={setNewOwnerId}
					isDisabled={candidates.length === 0}
					className="w-64"
					options={[
						{ value: NOBODY, label: "Choose a member" },
						...candidates.map((m) => ({
							value: m.userId,
							label: getMemberName(m),
						})),
					]}
				/>
				<Button variant="outline" isDisabled={!newOwner} onClick={open}>
					<Crown className="size-4" />
					Transfer ownership
				</Button>

				<ConfirmModal
					isOpen={isOpen}
					onClose={close}
					title="Transfer ownership"
					description={
						<>
							Make{" "}
							<span className="font-medium text-foreground">
								{newOwner ? getMemberName(newOwner) : "this member"}
							</span>{" "}
							the owner of{" "}
							<span className="font-medium text-foreground">
								{workspace.name}
							</span>
							? You become an admin, and only the new owner can delete the
							workspace or give it back.
						</>
					}
					confirmLabel="Transfer ownership"
					pendingLabel="Transferring…"
					isPending={isPending}
					onConfirm={handleTransfer}
					typeToConfirm={workspace.name}
				/>
			</CardContent>
		</Card>
	);
}
