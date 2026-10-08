"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Spinner,
	toast,
} from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import ErrorAlert from "@/components/ui/error-alert";
import { useMemberships } from "@/features/memberships/hooks/use-memberships";
import WorkspaceForm from "@/features/workspace/components/WorkspaceForm";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import {
	useUpdateWorkspace,
	workspaceKeys,
} from "@/features/workspace/hooks/use-workspaces";
import type { TWorkspaceFormValues } from "@/features/workspace/schema/workspace-schema";
import { getApiErrorMessage } from "@/lib/api-error";

/**
 * Settings → General. Lets OWNER/ADMIN rename / re-describe the active
 * workspace (`PATCH /workspaces/:id`). Editing is gated by the viewer's role
 * derived from the roster; the backend enforces the real boundary.
 */
export default function GeneralSettings() {
	const {
		activeWorkspace,
		activeWorkspaceId,
		isError: isWorkspaceError,
	} = useWorkspace();
	const { data: session } = useSession();
	const queryClient = useQueryClient();

	const workspaceId = activeWorkspaceId ?? "";
	const {
		data: members = [],
		isLoading,
		isError: isMembersError,
		refetch: refetchMembers,
	} = useMemberships(workspaceId);
	// Either failure leaves this page unable to tell what to show — and a failed
	// roster would wrongly read as "you are not an admin".
	const isError = isWorkspaceError || isMembersError;

	const currentRole = members.find(
		(m) => m.userId === session?.user?.id,
	)?.role;
	const canManage = currentRole === "OWNER" || currentRole === "ADMIN";

	const { mutateAsync: updateWorkspace, isPending } = useUpdateWorkspace();

	const handleSubmit = async (values: TWorkspaceFormValues) => {
		if (!activeWorkspaceId) return false;
		try {
			const res = await updateWorkspace({
				workspaceId: activeWorkspaceId,
				dto: values,
			});
			if (res.success) {
				toast.success(res.message || "Workspace updated");
			}
			return true;
		} catch (error) {
			toast.danger(getApiErrorMessage(error, "Failed to update workspace"));
			return false;
		}
	};

	if (isError) {
		return (
			<ErrorAlert
				title="Couldn’t load workspace settings"
				description="Check your connection and try again."
				onRetry={() => {
					refetchMembers();
					queryClient.invalidateQueries({
						queryKey: workspaceKeys.all,
					});
				}}
			/>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Workspace details</CardTitle>
				<CardDescription>
					{canManage
						? "Update your workspace name and description."
						: "Only workspace admins can change these settings."}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{isLoading || !activeWorkspace ? (
					<div className="flex items-center justify-center py-8">
						<Spinner />
					</div>
				) : canManage ? (
					<WorkspaceForm
						// Remount when the active workspace changes so the form
						// re-seeds its defaults after a switch.
						key={activeWorkspace.id}
						defaultValues={{
							name: activeWorkspace.name,
							description: activeWorkspace.description ?? "",
						}}
						onSubmit={handleSubmit}
						isSubmitting={isPending}
					/>
				) : (
					<dl className="flex flex-col gap-4">
						<div>
							<dt className="text-xs text-muted">Name</dt>
							<dd className="text-sm font-medium">
								{activeWorkspace.name}
							</dd>
						</div>
						{activeWorkspace.description && (
							<div>
								<dt className="text-xs text-muted">
									Description
								</dt>
								<dd className="text-sm">
									{activeWorkspace.description}
								</dd>
							</div>
						)}
					</dl>
				)}
			</CardContent>
		</Card>
	);
}
