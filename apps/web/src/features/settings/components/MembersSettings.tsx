"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Chip,
	Spinner,
} from "@heroui/react";
import { useSession } from "next-auth/react";

import InvitationsList from "@/features/invitations/components/InvitationsList";
import InviteMemberButton from "@/features/invitations/components/InviteMemberButton";
import { ROLE_COLOR, ROLE_LABELS } from "@/features/memberships/constants";
import MemberRoleSelect from "@/features/memberships/components/MemberRoleSelect";
import RemoveMemberButton from "@/features/memberships/components/RemoveMemberButton";
import { useMemberships } from "@/features/memberships/hooks/use-memberships";
import { useWorkspace } from "@/features/workspace/context/workspace-context";

/**
 * Settings → Members. Lists the roster and, for OWNER/ADMIN, lets them change a
 * member's role or remove them. The OWNER row and the viewer's own row are
 * locked (no self-demotion / ownership transfer via this UI). These are
 * optimistic, UX-only guards — the backend remains the source of truth and also
 * keeps `useInvitations` from firing the admin-only endpoint for members.
 */
export default function MembersSettings() {
	const { activeWorkspaceId } = useWorkspace();
	const { data: session } = useSession();

	const workspaceId = activeWorkspaceId ?? "";
	const {
		data: members = [],
		isLoading,
		isError,
	} = useMemberships(workspaceId);

	const currentUserId = session?.user?.id;
	const currentRole = members.find((m) => m.userId === currentUserId)?.role;
	const canManage = currentRole === "OWNER" || currentRole === "ADMIN";

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
					{canManage && (
						<InviteMemberButton workspaceId={workspaceId} />
					)}
				</CardHeader>
				<CardContent>
					{isError ? (
						<p className="text-sm text-danger">
							Couldn’t load members. Please try again.
						</p>
					) : isLoading ? (
						<div className="flex items-center justify-center py-8">
							<Spinner />
						</div>
					) : (
						<ul className="flex flex-col divide-y divide-border">
							{members.map((member) => {
								// Locked rows: the OWNER (ownership transfer is a
								// separate flow) and the viewer themselves.
								const isLocked =
									member.role === "OWNER" ||
									member.userId === currentUserId;
								const canEditRow = canManage && !isLocked;

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
											{member.user?.email && (
												<p className="truncate text-xs text-muted">
													{member.user.email}
												</p>
											)}
										</div>

										<div className="flex shrink-0 items-center gap-2">
											{canEditRow ? (
												<MemberRoleSelect
													workspaceId={workspaceId}
													member={member}
												/>
											) : (
												<Chip
													size="sm"
													variant="soft"
													color={
														ROLE_COLOR[member.role]
													}
												>
													{ROLE_LABELS[member.role]}
												</Chip>
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

			{canManage && workspaceId && (
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
