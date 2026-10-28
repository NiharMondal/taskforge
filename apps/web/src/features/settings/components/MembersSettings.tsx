"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Spinner,
} from "@heroui/react";
import ErrorAlert from "@/components/ui/error-alert";
import InvitationsList from "@/features/invitations/components/InvitationsList";
import InviteMemberButton from "@/features/invitations/components/InviteMemberButton";
import MemberRoleSelect from "@/features/memberships/components/MemberRoleSelect";
import RemoveMemberButton from "@/features/memberships/components/RemoveMemberButton";
import { useMemberships } from "@/features/memberships/hooks/use-memberships";
import { useWorkspacePermissions } from "@/features/memberships/hooks/use-workspace-permissions";
import { getMemberEmail } from "@/features/memberships/lib/member";
import { holdsAll } from "@/features/memberships/lib/permissions";
import { RoleChip } from "@/features/roles/components/RoleChip";
import { useRoles } from "@/features/roles/hooks/use-roles";
import { useWorkspace } from "@/features/workspace/context/workspace-context";

/**
 * Settings → Members. Lists the roster and, with `member:manage`, lets the
 * viewer change a member's role (built-in or custom) or remove them. Locked:
 * the OWNER row, the viewer's own row, and anyone whose role holds a
 * permission the viewer lacks; the role list offers only roles the viewer
 * could hand out. These are UX-only guards mirroring the backend's
 * no-escalation rule; it remains the source of truth. Invitations need
 * `invitation:manage`, which also keeps `useInvitations` from firing for
 * everyone else.
 */
export default function MembersSettings() {
	const { activeWorkspaceId } = useWorkspace();

	const workspaceId = activeWorkspaceId ?? "";
	const {
		data: members = [],
		isLoading,
		isError,
		refetch,
	} = useMemberships(workspaceId);

	const permissions = useWorkspacePermissions();
	const {
		canManageMembers,
		canManageInvitations,
		userId: currentUserId,
	} = permissions;
	const { data: roles = [] } = useRoles(workspaceId);
	const roleById = new Map(roles.map((role) => [role.id, role]));
	const assignableRoles = roles.filter(
		(role) =>
			role.systemKey !== "OWNER" && holdsAll(permissions, role.permissions),
	);

	return (
		<div className="flex flex-col gap-8">
			<Card>
				<CardHeader className="flex flex-row items-start justify-between gap-3">
					<div>
						<CardTitle>Members</CardTitle>
						<CardDescription>
							{members.length}{" "}
							{members.length === 1 ? "member" : "members"} in this
							workspace
						</CardDescription>
					</div>
					{canManageInvitations && (
						<InviteMemberButton workspaceId={workspaceId} />
					)}
				</CardHeader>
				<CardContent>
					{isError ? (
						<ErrorAlert
							title="Couldn’t load members"
							description="Check your connection and try again."
							onRetry={() => refetch()}
						/>
					) : isLoading ? (
						<div className="flex items-center justify-center py-8">
							<Spinner />
						</div>
					) : (
						<ul className="flex flex-col divide-y divide-border">
							{members.map((member) => {
								// Locked rows: the OWNER (ownership transfer is a
								// separate flow), the viewer themselves, and
								// anyone with access the viewer lacks.
								const role = member.assignedRole
									? roleById.get(member.assignedRole.id)
									: undefined;
								const isLocked =
									(member.assignedRole?.systemKey ??
										member.role) === "OWNER" ||
									member.userId === currentUserId ||
									(!!role && !holdsAll(permissions, role.permissions));
								const canEditRow = canManageMembers && !isLocked;

								return (
									<li
										key={member.id}
										className="flex items-center justify-between gap-3 py-3"
									>
										<div className="min-w-0">
											<p className="truncate text-sm font-medium">
												{member.user?.name ??
													"Unknown user"}
												{member.userId ===
													currentUserId && (
													<span className="ml-2 text-xs text-muted">
														(you)
													</span>
												)}
											</p>
											{getMemberEmail(member) && (
												<p className="truncate text-xs text-muted">
													{getMemberEmail(member)}
												</p>
											)}
										</div>

										<div className="flex shrink-0 items-center gap-2">
											{canEditRow ? (
												<MemberRoleSelect
													workspaceId={workspaceId}
													member={member}
													roles={assignableRoles}
												/>
											) : (
												<RoleChip
													role={member.assignedRole}
													fallback={member.role}
												/>
											)}
											{canEditRow && (
												<RemoveMemberButton
													workspaceId={workspaceId}
													member={member}
												/>
											)}
										</div>
									</li>
								);
							})}
						</ul>
					)}
				</CardContent>
			</Card>

			{canManageInvitations && workspaceId && (
				<Card>
					<CardHeader>
						<CardTitle>Invitations</CardTitle>
						<CardDescription>
							People you’ve invited and the status of each
							invitation
						</CardDescription>
					</CardHeader>
					<CardContent>
						<InvitationsList workspaceId={workspaceId} />
					</CardContent>
				</Card>
			)}
		</div>
	);
}
