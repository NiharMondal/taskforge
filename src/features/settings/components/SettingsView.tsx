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

import type { ComponentProps } from "react";

import InvitationsList from "@/features/invitations/components/InvitationsList";
import InviteMemberButton from "@/features/invitations/components/InviteMemberButton";
import { useMemberships } from "@/features/memberships/hooks/use-memberships";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import type { WorkspaceRole } from "@/features/workspace/types/workspace-types";

type ChipColor = NonNullable<ComponentProps<typeof Chip>["color"]>;

const ROLE_COLOR: Record<WorkspaceRole, ChipColor> = {
	OWNER: "accent",
	ADMIN: "warning",
	MEMBER: "default",
	VIEWER: "default",
};

/**
 * Workspace settings: member roster + invitations. Scoped to the active
 * workspace from context (every request carries `x-workspace-id`).
 *
 * The invite UI is gated to OWNER/ADMIN by deriving the viewer's role from the
 * memberships roster + session user id — an optimistic, UX-only guard; the
 * backend remains the source of truth (it also keeps `useInvitations` from
 * firing the admin-only endpoint for members).
 */
export default function SettingsView() {
	const { activeWorkspace, activeWorkspaceId } = useWorkspace();
	const { data: session } = useSession();

	const workspaceId = activeWorkspaceId ?? "";
	const {
		data: members = [],
		isLoading,
		isError,
	} = useMemberships(workspaceId);

	const currentRole = members.find(
		(m) => m.userId === session?.user?.id,
	)?.role;
	const canInvite = currentRole === "OWNER" || currentRole === "ADMIN";

	return (
		<div className="flex flex-col gap-8">
			<header>
				<h1 className="text-2xl font-semibold">Settings</h1>
				<p className="mt-1 text-sm text-muted">
					{activeWorkspace
						? `Manage members of ${activeWorkspace.name}.`
						: "Pick a workspace from the sidebar to get started."}
				</p>
			</header>

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
					{canInvite && <InviteMemberButton workspaceId={workspaceId} />}
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
							{members.map((member) => (
								<li
									key={member.id}
									className="flex items-center justify-between gap-3 py-3"
								>
									<div className="min-w-0">
										<p className="truncate text-sm font-medium">
											{member.user?.name ?? "Unknown user"}
										</p>
										{member.user?.email && (
											<p className="truncate text-xs text-muted">
												{member.user.email}
											</p>
										)}
									</div>
									<Chip
										size="sm"
										variant="soft"
										color={ROLE_COLOR[member.role]}
									>
										{member.role}
									</Chip>
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>

			{canInvite && workspaceId && (
				<Card>
					<CardHeader>
						<CardTitle>Invitations</CardTitle>
						<CardDescription>
							People you’ve invited and the status of each invitation
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
