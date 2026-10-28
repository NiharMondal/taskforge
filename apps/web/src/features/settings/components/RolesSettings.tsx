"use client";

import { useState } from "react";

import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Spinner,
	toast,
} from "@heroui/react";
import { Copy, Eye, Pencil, Plus, Trash2 } from "lucide-react";

import ConfirmModal from "@/components/ui/confirm-modal";
import ErrorAlert from "@/components/ui/error-alert";
import MyModal from "@/components/ui/my-modal";
import { useWorkspacePermissions } from "@/features/memberships/hooks/use-workspace-permissions";
import { holdsAll } from "@/features/memberships/lib/permissions";
import RoleForm from "@/features/roles/components/RoleForm";
import { RoleChip } from "@/features/roles/components/RoleChip";
import {
	GRANTABLE_PERMISSIONS,
	MAX_ROLE_NAME_LENGTH,
} from "@/features/roles/constants";
import {
	useCreateRole,
	useDeleteRole,
	useRoles,
	useUpdateRole,
} from "@/features/roles/hooks/use-roles";
import type { TRoleFormValues } from "@/features/roles/schema/role-schema";
import type { Role } from "@/features/roles/types/role-types";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { getApiErrorMessage } from "@/lib/api-error";

/**
 * Which dialog is open: the editor (new — maybe copied from a role — or an
 * existing custom role), a read-only view, or a delete confirm.
 */
type Dialog =
	| { kind: "create"; from: Role | null }
	| { kind: "edit"; role: Role }
	| { kind: "view"; role: Role }
	| { kind: "delete"; role: Role }
	| null;

const memberCount = (role: Role) =>
	`${role.memberCount} ${role.memberCount === 1 ? "member" : "members"}`;

const permissionCount = (role: Role) =>
	role.systemKey === "OWNER"
		? "Everything"
		: `${role.permissions.length} of ${GRANTABLE_PERMISSIONS.length} permissions`;

/** "Copy of Admin", trimmed to fit the name limit. */
const copyName = (role: Role) =>
	`Copy of ${role.name}`.slice(0, MAX_ROLE_NAME_LENGTH);

/**
 * `/settings/roles`: the workspace's roles. Everyone sees what each grants.
 * With `role:manage` the viewer creates custom roles (from scratch, or copied
 * from any role) and edits or deletes them; the four built-ins are read-only.
 * Roles holding a permission the viewer lacks can be viewed, not changed — the
 * backend's no-escalation rule. Members are given roles on the Members tab.
 */
export default function RolesSettings() {
	const { activeWorkspaceId } = useWorkspace();
	const workspaceId = activeWorkspaceId ?? "";
	const {
		data: roles = [],
		isLoading,
		isError,
		error,
		refetch,
	} = useRoles(workspaceId);
	const permissions = useWorkspacePermissions();
	const { canManageRoles } = permissions;

	const [dialog, setDialog] = useState<Dialog>(null);
	const close = () => setDialog(null);
	const { mutateAsync: createRole, isPending: isCreating } =
		useCreateRole(workspaceId);
	const { mutateAsync: updateRole, isPending: isUpdating } =
		useUpdateRole(workspaceId);
	const { mutateAsync: deleteRole, isPending: isDeleting } =
		useDeleteRole(workspaceId);

	/** A custom role the viewer may change: none of its keys beyond their own. */
	const canChange = (role: Role) =>
		canManageRoles && !role.systemKey && holdsAll(permissions, role.permissions);

	const handleSave = async (values: TRoleFormValues) => {
		try {
			const res =
				dialog?.kind === "edit"
					? await updateRole({ roleId: dialog.role.id, dto: values })
					: await createRole(values);
			toast.success(res.message || "Role saved");
			close();
			return true;
		} catch (err) {
			toast.danger(getApiErrorMessage(err, "Failed to save role"));
			return false;
		}
	};

	const handleDelete = async () => {
		if (dialog?.kind !== "delete") return;
		try {
			const res = await deleteRole(dialog.role.id);
			toast.success(res.message || "Role deleted");
			close();
		} catch (err) {
			// e.g. a pending invitation still uses it
			toast.danger(getApiErrorMessage(err, "Failed to delete role"));
		}
	};

	if (isError) {
		return (
			<ErrorAlert
				title="Couldn’t load roles"
				description={getApiErrorMessage(error, "Please try again.")}
				onRetry={() => refetch()}
			/>
		);
	}

	const editorRole =
		dialog?.kind === "edit" || dialog?.kind === "view" ? dialog.role : null;
	const editorDefaults: TRoleFormValues | undefined =
		dialog?.kind === "create"
			? dialog.from
				? {
						name: copyName(dialog.from),
						// Only what the viewer may grant comes along.
						permissions: dialog.from.permissions.filter((p) =>
							permissions.granted.has(p),
						),
					}
				: undefined
			: editorRole
				? { name: editorRole.name, permissions: editorRole.permissions }
				: undefined;

	return (
		<Card>
			<CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
				<div className="flex flex-col gap-1">
					<CardTitle>Roles</CardTitle>
					<CardDescription>
						{canManageRoles
							? "A role is a set of permissions. Built-in roles can’t be changed; create a custom role, or copy one, to fit how your team works."
							: "What each role in this workspace can do."}
					</CardDescription>
				</div>
				{canManageRoles && (
					<Button
						size="sm"
						onPress={() => setDialog({ kind: "create", from: null })}
					>
						<Plus className="size-4" />
						New role
					</Button>
				)}
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<div className="flex items-center justify-center py-8">
						<Spinner />
					</div>
				) : (
					<ul className="flex flex-col divide-y divide-border rounded-md border border-border">
						{roles.map((role) => (
							<li
								key={role.id}
								className="flex flex-wrap items-center gap-3 px-3 py-2"
							>
								<RoleChip role={role} />
								{role.systemKey && (
									<span className="text-xs text-muted">Built-in</span>
								)}
								<span className="text-xs text-muted">
									{memberCount(role)} · {permissionCount(role)}
								</span>
								<div className="ml-auto flex items-center">
									{canChange(role) ? (
										<Button
											isIconOnly
											size="sm"
											variant="ghost"
											aria-label={`Edit ${role.name}`}
											onPress={() => setDialog({ kind: "edit", role })}
										>
											<Pencil className="size-3.5" />
										</Button>
									) : (
										<Button
											isIconOnly
											size="sm"
											variant="ghost"
											aria-label={`View ${role.name}`}
											onPress={() => setDialog({ kind: "view", role })}
										>
											<Eye className="size-3.5" />
										</Button>
									)}
									{canManageRoles && role.systemKey !== "OWNER" && (
										<Button
											isIconOnly
											size="sm"
											variant="ghost"
											aria-label={`Copy ${role.name} into a new role`}
											onPress={() =>
												setDialog({ kind: "create", from: role })
											}
										>
											<Copy className="size-3.5" />
										</Button>
									)}
									{canChange(role) && (
										<Button
											isIconOnly
											size="sm"
											variant="ghost"
											aria-label={
												role.memberCount > 0
													? `${role.name} can't be deleted while members have it`
													: `Delete ${role.name}`
											}
											// Members must be moved first; the backend refuses too.
											isDisabled={role.memberCount > 0}
											onPress={() => setDialog({ kind: "delete", role })}
										>
											<Trash2 className="size-3.5" />
										</Button>
									)}
								</div>
							</li>
						))}
					</ul>
				)}
			</CardContent>

			<MyModal
				isOpen={
					dialog?.kind === "create" ||
					dialog?.kind === "edit" ||
					dialog?.kind === "view"
				}
				onOpenChange={(open) => !open && close()}
				width="md:min-w-[560px]"
				title={
					dialog?.kind === "edit"
						? "Edit role"
						: dialog?.kind === "view"
							? dialog.role.name
							: "New role"
				}
			>
				{(dialog?.kind === "create" ||
					dialog?.kind === "edit" ||
					dialog?.kind === "view") && (
					<RoleForm
						// Remount per dialog so the defaults re-seed.
						key={
							dialog.kind === "create"
								? `new-${dialog.from?.id ?? ""}`
								: `${dialog.kind}-${dialog.role.id}`
						}
						defaultValues={editorDefaults}
						permissions={permissions}
						isReadOnly={dialog.kind === "view"}
						submitLabel={dialog.kind === "edit" ? "Save changes" : "Create role"}
						onSubmit={handleSave}
						isSubmitting={isCreating || isUpdating}
						onCancel={close}
					/>
				)}
			</MyModal>

			<ConfirmModal
				isOpen={dialog?.kind === "delete"}
				onClose={close}
				title="Delete role"
				description={
					dialog?.kind === "delete" && (
						<>
							Delete{" "}
							<span className="font-medium text-foreground">
								{dialog.role.name}
							</span>
							? This can’t be undone.
						</>
					)
				}
				confirmLabel="Delete"
				pendingLabel="Deleting…"
				isPending={isDeleting}
				onConfirm={handleDelete}
			/>
		</Card>
	);
}
