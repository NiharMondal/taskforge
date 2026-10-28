"use client";

import { ListBox, Select, toast } from "@heroui/react";

import type { Role } from "@/features/roles/types/role-types";
import { getApiErrorMessage } from "@/lib/api-error";

import { useUpdateMembershipRole } from "../hooks/use-memberships";
import type { Member } from "../types/membership-types";

type Props = {
	workspaceId: string;
	member: Member;
	/**
	 * The roles the viewer may hand out: never the owner's, and none holding a
	 * permission the viewer lacks (the backend refuses those).
	 */
	roles: Role[];
	/** Disable when the viewer may not edit this row (self / OWNER row). */
	isDisabled?: boolean;
};

/**
 * Inline role editor for a single member, built-in and custom roles alike.
 * Firing the dropdown PATCHes `{ roleId }` optimistically (see
 * {@link useUpdateMembershipRole}); on failure the cache rolls back and we
 * surface the backend message. This is a UX control, not a form — the backend
 * enforces who may actually change whom.
 */
export default function MemberRoleSelect({
	workspaceId,
	member,
	roles,
	isDisabled,
}: Props) {
	const { mutateAsync: updateRole, isPending } =
		useUpdateMembershipRole(workspaceId);

	const handleChange = async (roleId: string) => {
		const role = roles.find((r) => r.id === roleId);
		if (!role || roleId === member.assignedRole?.id) return;
		try {
			const res = await updateRole({
				userId: member.userId,
				role: { id: role.id, name: role.name, systemKey: role.systemKey },
			});
			if (res.success) {
				toast.success(res.message || "Role updated");
			}
		} catch (error) {
			toast.danger(getApiErrorMessage(error, "Failed to update role"));
		}
	};

	return (
		<Select
			className="w-40 shrink-0"
			aria-label={`Role for ${member.user?.name ?? "member"}`}
			value={member.assignedRole?.id ?? null}
			isDisabled={isDisabled || isPending}
			onChange={(key) => {
				if (key) handleChange(String(key));
			}}
		>
			<Select.Trigger>
				<Select.Value />
				<Select.Indicator />
			</Select.Trigger>
			<Select.Popover>
				<ListBox>
					{roles.map((role) => (
						<ListBox.Item key={role.id} id={role.id} textValue={role.name}>
							{role.name}
							<ListBox.ItemIndicator />
						</ListBox.Item>
					))}
				</ListBox>
			</Select.Popover>
		</Select>
	);
}
