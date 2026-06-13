"use client";

import { Spinner } from "@heroui/react";
import { Mail } from "lucide-react";

import { useInvitations } from "../hooks/use-invitations";
import InvitationStatusChip from "./InvitationStatusChip";

/**
 * Workspace invitations with their status. Rendered only for OWNER/ADMIN —
 * the parent gates it so the admin-only endpoint is never hit by members.
 */
export default function InvitationsList({
	workspaceId,
}: {
	workspaceId: string;
}) {
	const { data: invitations = [], isLoading, isError } =
		useInvitations(workspaceId);

	if (isError) {
		return (
			<p className="text-sm text-danger">
				Couldn’t load invitations. Please try again.
			</p>
		);
	}

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-8">
				<Spinner />
			</div>
		);
	}

	if (invitations.length === 0) {
		return (
			<div className="flex flex-col items-center gap-2 py-8 text-center">
				<Mail className="h-8 w-8 text-muted" />
				<p className="text-sm text-muted">
					No invitations yet. Invite a teammate to get started.
				</p>
			</div>
		);
	}

	return (
		<ul className="flex flex-col divide-y divide-border">
			{invitations.map((invitation) => (
				<li
					key={invitation.id}
					className="flex items-center justify-between gap-3 py-3"
				>
					<div className="min-w-0">
						<p className="truncate text-sm font-medium">
							{invitation.email}
						</p>
						<p className="text-xs text-muted">
							Invited{" "}
							{new Date(invitation.createdAt).toLocaleDateString()}
						</p>
					</div>
					<InvitationStatusChip status={invitation.status} />
				</li>
			))}
		</ul>
	);
}
