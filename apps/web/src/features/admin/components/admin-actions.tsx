"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import {
	Alert,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	toast,
} from "@heroui/react";
import { Ban, LogOut, RotateCcw, Trash } from "lucide-react";

import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate } from "@/util/format-date";

import { useAdminViewer } from "../context/admin-viewer";
import {
	useDeleteUser,
	useDeleteWorkspace,
	useRevokeUserSessions,
	useSetUserSuspended,
	useSetWorkspaceSuspended,
} from "../hooks/use-admin";
import type {
	AdminSuspension,
	AdminUserDetail,
	AdminWorkspaceDetail,
} from "../types/admin-types";
import AdminActionDialog from "./AdminActionDialog";

/** Shows the suspension, with the staff's reason (this page is staff-only). */
export function SuspensionBanner({
	suspension,
	what,
}: {
	suspension: AdminSuspension;
	what: "account" | "workspace";
}) {
	if (!suspension.suspendedAt) return null;
	return (
		<Alert status="danger">
			<Alert.Indicator />
			<Alert.Content>
				<Alert.Title>
					This {what} was suspended on{" "}
					{formatDate(suspension.suspendedAt, "dd MMM yyyy, hh:mm a")}
				</Alert.Title>
				{suspension.suspendedReason && (
					<Alert.Description>
						Reason: {suspension.suspendedReason}
					</Alert.Description>
				)}
			</Alert.Content>
		</Alert>
	);
}

type UserAction = "suspend" | "unsuspend" | "revoke" | "delete";

/**
 * Suspend or lift, sign out everywhere, delete — for ADMIN only. Not offered
 * on your own account or another admin's: the backend refuses both.
 */
export function AdminUserActions({ user }: { user: AdminUserDetail }) {
	const viewer = useAdminViewer();
	const router = useRouter();
	const [open, setOpen] = useState<UserAction | null>(null);
	const suspend = useSetUserSuspended(user.id);
	const revoke = useRevokeUserSessions(user.id);
	const remove = useDeleteUser(user.id);

	if (!viewer.canAct) return null;

	const blockedBecause =
		user.id === viewer.id
			? "This is your own account: admins can’t act on themselves."
			: user.platformRole === "ADMIN"
				? "Admins can’t act on other admins. Remove their role with the set-platform-role script first."
				: null;

	const close = () => setOpen(null);
	const failed = (error: unknown) =>
		toast.danger(getApiErrorMessage(error, "That didn’t work. Try again."));

	const isSuspended = !!user.suspendedAt;

	return (
		<Card>
			<CardHeader className="flex flex-col gap-1">
				<CardTitle>Actions</CardTitle>
				<CardDescription>
					Each one asks for a reason and is recorded in the platform audit log.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{blockedBecause ? (
					<p className="text-sm text-muted">{blockedBecause}</p>
				) : (
					<div className="flex flex-wrap gap-2">
						<Button
							variant={isSuspended ? "outline" : "danger-soft"}
							onPress={() => setOpen(isSuspended ? "unsuspend" : "suspend")}
						>
							{isSuspended ? (
								<RotateCcw className="size-4" aria-hidden />
							) : (
								<Ban className="size-4" aria-hidden />
							)}
							{isSuspended ? "Lift suspension" : "Suspend account"}
						</Button>
						<Button variant="outline" onPress={() => setOpen("revoke")}>
							<LogOut className="size-4" aria-hidden />
							Sign out everywhere
						</Button>
						<Button variant="danger" onPress={() => setOpen("delete")}>
							<Trash className="size-4" aria-hidden />
							Delete account
						</Button>
					</div>
				)}
			</CardContent>

			<AdminActionDialog
				isOpen={open === "suspend" || open === "unsuspend"}
				onClose={close}
				title={isSuspended ? "Lift the suspension?" : "Suspend this account?"}
				description={
					isSuspended
						? `${user.email} will be able to sign in again.`
						: `${user.email} is signed out everywhere and can’t sign in until the suspension is lifted. An open tab keeps working for up to 15 minutes.`
				}
				confirmLabel={isSuspended ? "Lift suspension" : "Suspend"}
				pendingLabel="Saving…"
				isPending={suspend.isPending}
				onConfirm={(reason) =>
					suspend.mutate(
						{ suspended: !isSuspended, reason },
						{
							onSuccess: () => {
								toast.success(
									isSuspended ? "Suspension lifted" : "Account suspended",
								);
								close();
							},
							onError: failed,
						},
					)
				}
			/>

			<AdminActionDialog
				isOpen={open === "revoke"}
				onClose={close}
				title="Sign out everywhere?"
				description={`Every session of ${user.email} ends. They can sign in again; an open tab keeps working for up to 15 minutes.`}
				confirmLabel="Sign out everywhere"
				pendingLabel="Signing out…"
				isPending={revoke.isPending}
				onConfirm={(reason) =>
					revoke.mutate(
						{ reason },
						{
							onSuccess: ({ data: { revoked } }) => {
								toast.success(
									`Ended ${revoked} ${revoked === 1 ? "session" : "sessions"}`,
								);
								close();
							},
							onError: failed,
						},
					)
				}
			/>

			<AdminActionDialog
				isOpen={open === "delete"}
				onClose={close}
				title="Delete this account?"
				description={
					<>
						This can’t be undone. The workspaces only {user.name} belongs to
						are deleted too, their subscriptions canceled. Their issues and
						comments in shared workspaces stay, as “Deleted user”. If they own
						a workspace other people use, delete it first. They get an email.
					</>
				}
				confirmLabel="Delete account"
				pendingLabel="Deleting…"
				isPending={remove.isPending}
				typeToConfirm={user.email}
				onConfirm={(reason) =>
					remove.mutate(
						{ reason },
						{
							onSuccess: () => {
								toast.success(`Deleted ${user.email}`);
								router.push("/admin/users");
							},
							onError: failed,
						},
					)
				}
			/>
		</Card>
	);
}

type WorkspaceAction = "suspend" | "unsuspend" | "delete";

/** Suspend or lift, delete — for ADMIN only. */
export function AdminWorkspaceActions({
	workspace,
}: {
	workspace: AdminWorkspaceDetail;
}) {
	const viewer = useAdminViewer();
	const router = useRouter();
	const [open, setOpen] = useState<WorkspaceAction | null>(null);
	const suspend = useSetWorkspaceSuspended(workspace.id);
	const remove = useDeleteWorkspace(workspace.id);

	if (!viewer.canAct) return null;

	const close = () => setOpen(null);
	const failed = (error: unknown) =>
		toast.danger(getApiErrorMessage(error, "That didn’t work. Try again."));
	const isSuspended = !!workspace.suspendedAt;

	return (
		<Card>
			<CardHeader className="flex flex-col gap-1">
				<CardTitle>Actions</CardTitle>
				<CardDescription>
					Each one asks for a reason and is recorded in the platform audit log.
					Plans are changed in Stripe, never here.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="flex flex-wrap gap-2">
					<Button
						variant={isSuspended ? "outline" : "danger-soft"}
						onPress={() => setOpen(isSuspended ? "unsuspend" : "suspend")}
					>
						{isSuspended ? (
							<RotateCcw className="size-4" aria-hidden />
						) : (
							<Ban className="size-4" aria-hidden />
						)}
						{isSuspended ? "Lift suspension" : "Suspend workspace"}
					</Button>
					<Button variant="danger" onPress={() => setOpen("delete")}>
						<Trash className="size-4" aria-hidden />
						Delete workspace
					</Button>
				</div>
			</CardContent>

			<AdminActionDialog
				isOpen={open === "suspend" || open === "unsuspend"}
				onClose={close}
				title={isSuspended ? "Lift the suspension?" : "Suspend this workspace?"}
				description={
					isSuspended
						? `Its ${workspace.counts.members} members can open ${workspace.name} again.`
						: `None of its ${workspace.counts.members} members can open ${workspace.name} until the suspension is lifted. Billing isn’t touched: stop it in Stripe if it should stop.`
				}
				confirmLabel={isSuspended ? "Lift suspension" : "Suspend"}
				pendingLabel="Saving…"
				isPending={suspend.isPending}
				onConfirm={(reason) =>
					suspend.mutate(
						{ suspended: !isSuspended, reason },
						{
							onSuccess: () => {
								toast.success(
									isSuspended ? "Suspension lifted" : "Workspace suspended",
								);
								close();
							},
							onError: failed,
						},
					)
				}
			/>

			<AdminActionDialog
				isOpen={open === "delete"}
				onClose={close}
				title="Delete this workspace?"
				description={
					<>
						This can’t be undone: its {workspace.counts.projects} projects,{" "}
						{workspace.counts.issues} issues and {workspace.counts.members}{" "}
						memberships go with it. A paid subscription is canceled with Stripe
						first; if that fails, nothing is deleted.
					</>
				}
				confirmLabel="Delete workspace"
				pendingLabel="Deleting…"
				isPending={remove.isPending}
				typeToConfirm={workspace.name}
				onConfirm={(reason) =>
					remove.mutate(
						{ reason },
						{
							onSuccess: () => {
								toast.success(`Deleted ${workspace.name}`);
								router.push("/admin/workspaces");
							},
							onError: failed,
						},
					)
				}
			/>
		</Card>
	);
}
