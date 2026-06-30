"use client";

import { ListBox, Select, toast } from "@heroui/react";

import { getApiErrorMessage } from "@/lib/api-error";
import type { WorkspaceRole } from "@/features/workspace/types/workspace-types";

import { ASSIGNABLE_ROLES, ROLE_LABELS } from "../constants";
import { useUpdateMembershipRole } from "../hooks/use-memberships";
import type { Member } from "../types/membership-types";

type Props = {
	workspaceId: string;
	member: Member;
	/** Disable when the viewer may not edit this row (self / OWNER row). */
	isDisabled?: boolean;
};

/**
 * Inline role editor for a single member. Firing the dropdown PATCHes the role
 * optimistically (see {@link useUpdateMembershipRole}); on failure the cache
 * rolls back and we surface the backend message. This is a UX control, not a
 * form — the backend enforces who may actually change whom.
 */
export default function MemberRoleSelect({
	workspaceId,
	member,
	isDisabled,
}: Props) {
	const { mutateAsync: updateRole, isPending } =
		useUpdateMembershipRole(workspaceId);

	const handleChange = async (role: WorkspaceRole) => {
		if (role === member.role) return;
		try {
			const res = await updateRole({ userId: member.userId, role });
			if (res.success) {
				toast.success(res.message || "Role updated");
			}
		} catch (error) {
			toast.danger(getApiErrorMessage(error, "Failed to update role"));
		}
	};

	return (
		<Select
			className="w-32 shrink-0"
			aria-label={`Role for ${member.user?.name ?? "member"}`}
			value={member.role}
			isDisabled={isDisabled || isPending}
			onChange={(key) => {
				if (key) handleChange(key as WorkspaceRole);
			}}
		>
			<Select.Trigger>
				<Select.Value />
				<Select.Indicator />
			</Select.Trigger>
			<Select.Popover>
				<ListBox>
					{ASSIGNABLE_ROLES.map((role) => (
						<ListBox.Item
							key={role}
							id={role}
							textValue={ROLE_LABELS[role]}
						>
							{ROLE_LABELS[role]}
							<ListBox.ItemIndicator />
						</ListBox.Item>
					))}
				</ListBox>
			</Select.Popover>
		</Select>
	);
}
