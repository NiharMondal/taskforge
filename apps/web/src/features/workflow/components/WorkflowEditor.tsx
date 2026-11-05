"use client";

import { useState } from "react";

import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Chip,
	Spinner,
	toast,
} from "@heroui/react";
import {
	ArrowDown,
	ArrowUp,
	Lock,
	Pencil,
	Plus,
	Star,
	Trash2,
} from "lucide-react";
import Link from "next/link";

import ErrorAlert from "@/components/ui/error-alert";
import MyModal from "@/components/ui/my-modal";
import { useBilling } from "@/features/billing/hooks/use-billing";
import { BILLING_PATH, useErrorToast } from "@/features/billing/lib/plan-limit";
import StatusChip from "@/features/issues/components/StatusChip";
import { useWorkspacePermissions } from "@/features/memberships/hooks/use-workspace-permissions";
import ProjectHeader from "@/features/projects/components/ProjectHeader";
import { useProjects } from "@/features/projects/hooks/use-projects";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { getApiErrorMessage } from "@/lib/api-error";
import { MAX_WORKFLOW_STATUSES, rankBetween } from "@taskforge/shared";

import {
	useCreateStatus,
	useDeleteStatus,
	useReplaceTransitions,
	useUpdateStatus,
	useWorkflow,
} from "../hooks/use-workflow";
import { CATEGORY_LABELS } from "../lib/workflow";
import type { TStatusFormValues } from "../schema/status-schema";
import type { StatusTransition, WorkflowStatus } from "../types/workflow-types";
import DeleteStatusModal from "./DeleteStatusModal";
import StatusForm from "./StatusForm";
import TransitionsEditor from "./TransitionsEditor";

/** The status editor dialog: a new status, or one being edited. */
type Editing = { status: WorkflowStatus | null } | null;

/**
 * `/projects/[projectId]/workflow`: the project's board columns and the moves
 * between them (apps/backend/spec/workflow-spec.md). Everyone can read it;
 * editing needs `project:manage` and the Pro plan. A workspace back on Free
 * keeps a workflow customized on Pro, read-only.
 */
export default function WorkflowEditor({ projectId }: { projectId: string }) {
	const { activeWorkspaceId } = useWorkspace();
	const workspaceId = activeWorkspaceId ?? "";
	const { data: projects } = useProjects(workspaceId);
	const project = projects?.find((p) => p.id === projectId);

	const { data, isLoading, isError, error, refetch } = useWorkflow(
		workspaceId,
		projectId,
	);
	const { canManageProjects } = useWorkspacePermissions();
	const { data: billing } = useBilling(workspaceId);
	// Unknown until billing loads; the backend's 402 covers that moment.
	const isPro = billing?.limits.customWorkflows ?? true;
	const canEdit = canManageProjects && isPro;
	const showError = useErrorToast();

	const [editing, setEditing] = useState<Editing>(null);
	const [deleting, setDeleting] = useState<WorkflowStatus | null>(null);

	const { mutateAsync: createStatus, isPending: isCreating } =
		useCreateStatus(workspaceId, projectId);
	const { mutateAsync: updateStatus, isPending: isUpdating } =
		useUpdateStatus(workspaceId, projectId);
	const { mutateAsync: deleteStatus, isPending: isDeleting } =
		useDeleteStatus(workspaceId, projectId);
	const { mutateAsync: replaceTransitions, isPending: isSavingMoves } =
		useReplaceTransitions(workspaceId, projectId);

	const statuses = data?.statuses ?? [];

	const handleSave = async (values: TStatusFormValues) => {
		try {
			const res = editing?.status
				? await updateStatus({ statusId: editing.status.id, dto: values })
				: await createStatus(values);
			toast.success(res.message || "Status saved");
			setEditing(null);
			return true;
		} catch (err) {
			showError(err, "Failed to save status");
			return false;
		}
	};

	/** Swap a status with its neighbour: a key between the next two over. */
	const move = async (index: number, by: -1 | 1) => {
		const target = index + by;
		const before = by < 0 ? statuses[target - 1] : statuses[target];
		const after = by < 0 ? statuses[target] : statuses[target + 1];
		const position = rankBetween(before?.position, after?.position);
		if (!position) {
			toast.danger("Couldn’t reorder this status. Refresh and try again.");
			return;
		}
		try {
			await updateStatus({ statusId: statuses[index].id, dto: { position } });
		} catch (err) {
			showError(err, "Failed to reorder status");
		}
	};

	const makeDefault = async (status: WorkflowStatus) => {
		try {
			const res = await updateStatus({
				statusId: status.id,
				dto: { isDefault: true },
			});
			toast.success(res.message || "Default status changed");
		} catch (err) {
			showError(err, "Failed to change the default status");
		}
	};

	const handleDelete = async (moveTo: string | undefined) => {
		if (!deleting) return;
		try {
			const res = await deleteStatus({ statusId: deleting.id, moveTo });
			toast.success(res.message || "Status deleted");
			setDeleting(null);
		} catch (err) {
			showError(err, "Failed to delete status");
		}
	};

	const saveTransitions = async (transitions: StatusTransition[]) => {
		try {
			const res = await replaceTransitions(transitions);
			toast.success(res.message || "Moves saved");
			return true;
		} catch (err) {
			showError(err, "Failed to save moves");
			return false;
		}
	};

	return (
		<div className="flex flex-col gap-6">
			<ProjectHeader projectId={projectId} project={project} active="workflow" />

			{isError ? (
				<ErrorAlert
					title="Couldn’t load the workflow"
					description={getApiErrorMessage(error, "Please try again.")}
					onRetry={() => refetch()}
				/>
			) : isLoading || !data ? (
				<div className="flex items-center gap-2 py-12 text-muted">
					<Spinner size="sm" />
					Loading workflow…
				</div>
			) : (
				<>
					{!canEdit && (
						<div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-secondary px-4 py-3 text-sm">
							<Lock className="size-4 shrink-0 text-muted" />
							<span className="flex-1">
								{!canManageProjects
									? "Only members who can manage projects can change this workflow."
									: "Custom workflows are part of the Pro plan. On Free, every project uses the default workflow."}
							</span>
							{canManageProjects && !isPro && (
								<Link
									href={BILLING_PATH}
									className="text-sm font-medium text-accent hover:underline"
								>
									Upgrade to Pro
								</Link>
							)}
						</div>
					)}

					<Card>
						<CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
							<div className="flex flex-col gap-1">
								<CardTitle>Statuses</CardTitle>
								<CardDescription>
									The board’s columns, left to right. Backlog statuses
									stay off the board; the category decides how each
									status behaves.
								</CardDescription>
							</div>
							{canEdit && (
								<Button
									size="sm"
									isDisabled={statuses.length >= MAX_WORKFLOW_STATUSES}
									onPress={() => setEditing({ status: null })}
								>
									<Plus className="size-4" />
									Add status
								</Button>
							)}
						</CardHeader>
						<CardContent>
							<ul className="flex flex-col divide-y divide-border rounded-md border border-border">
								{statuses.map((status, i) => (
									<li
										key={status.id}
										className="flex flex-wrap items-center gap-3 px-3 py-2"
									>
										{canEdit && (
											<div className="flex flex-col">
												<Button
													isIconOnly
													size="sm"
													variant="ghost"
													aria-label={`Move ${status.name} left`}
													isDisabled={i === 0 || isUpdating}
													onPress={() => move(i, -1)}
												>
													<ArrowUp className="size-3.5" />
												</Button>
												<Button
													isIconOnly
													size="sm"
													variant="ghost"
													aria-label={`Move ${status.name} right`}
													isDisabled={i === statuses.length - 1 || isUpdating}
													onPress={() => move(i, 1)}
												>
													<ArrowDown className="size-3.5" />
												</Button>
											</div>
										)}
										<StatusChip status={status} className="max-w-60" />
										<Chip size="sm" variant="soft">
											{CATEGORY_LABELS[status.category]}
										</Chip>
										{status.isDefault && (
											<Chip size="sm" variant="soft" color="accent">
												Default for new issues
											</Chip>
										)}
										<span className="text-xs text-muted">
											{status.issueCount ?? 0}{" "}
											{status.issueCount === 1 ? "issue" : "issues"}
										</span>
										{canEdit && (
											<div className="ml-auto flex items-center">
												{!status.isDefault && (
													<Button
														isIconOnly
														size="sm"
														variant="ghost"
														aria-label={`Make ${status.name} the default`}
														onPress={() => makeDefault(status)}
													>
														<Star className="size-4" />
													</Button>
												)}
												<Button
													isIconOnly
													size="sm"
													variant="ghost"
													aria-label={`Edit ${status.name}`}
													onPress={() => setEditing({ status })}
												>
													<Pencil className="size-4" />
												</Button>
												{!status.isDefault && (
													<Button
														isIconOnly
														size="sm"
														variant="ghost"
														aria-label={`Delete ${status.name}`}
														onPress={() => setDeleting(status)}
													>
														<Trash2 className="size-4 text-danger" />
													</Button>
												)}
											</div>
										)}
									</li>
								))}
							</ul>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-col gap-1">
							<CardTitle>Allowed moves</CardTitle>
							<CardDescription>
								Which statuses an issue can move to from each one, on
								the board and in every status picker. A status with no
								moves out is final.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<TransitionsEditor
								statuses={statuses}
								transitions={data.transitions}
								isReadOnly={!canEdit}
								isSaving={isSavingMoves}
								onSave={saveTransitions}
							/>
						</CardContent>
					</Card>
				</>
			)}

			<MyModal
				isOpen={!!editing}
				onOpenChange={(open) => !open && setEditing(null)}
				title={editing?.status ? "Edit status" : "Add status"}
				size="md"
			>
				{editing && (
					<StatusForm
						defaultValues={
							editing.status
								? {
										name: editing.status.name,
										color: editing.status.color,
										category: editing.status.category,
									}
								: undefined
						}
						onSubmit={handleSave}
						isSubmitting={isCreating || isUpdating}
						onCancel={() => setEditing(null)}
					/>
				)}
			</MyModal>

			<DeleteStatusModal
				status={deleting}
				statuses={statuses}
				isPending={isDeleting}
				onClose={() => setDeleting(null)}
				onConfirm={handleDelete}
			/>
		</div>
	);
}
