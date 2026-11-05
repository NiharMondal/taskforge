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
import { Pencil, Plus, Trash2 } from "lucide-react";

import ConfirmModal from "@/components/ui/confirm-modal";
import ErrorAlert from "@/components/ui/error-alert";
import MyModal from "@/components/ui/my-modal";
import LabelForm from "@/features/labels/components/LabelForm";
import { LabelChip } from "@/features/labels/components/LabelChip";
import {
	useCreateLabel,
	useDeleteLabel,
	useLabels,
	useUpdateLabel,
} from "@/features/labels/hooks/use-labels";
import type { TLabelFormValues } from "@/features/labels/schema/label-schema";
import type { Label } from "@/features/labels/types/label-types";
import { useWorkspacePermissions } from "@/features/memberships/hooks/use-workspace-permissions";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { getApiErrorMessage } from "@/lib/api-error";

/** Which dialog is open: the editor (new, or a label), or a delete confirm. */
type Dialog =
	| { kind: "edit"; label: Label | null }
	| { kind: "delete"; label: Label }
	| null;

const issueCount = (label: Label) => {
	const n = label._count?.issues ?? 0;
	return `${n} ${n === 1 ? "issue" : "issues"}`;
};

/**
 * `/settings/labels`: the workspace's labels. Everyone sees them; managing
 * them takes `label:manage` (`canManageLabels`). Putting labels on issues is
 * done from the issue itself.
 */
export default function LabelsSettings() {
	const { activeWorkspaceId } = useWorkspace();
	const workspaceId = activeWorkspaceId ?? "";
	const {
		data: labels = [],
		isLoading,
		isError,
		error,
		refetch,
	} = useLabels(workspaceId);
	const { canManageLabels } = useWorkspacePermissions();

	const [dialog, setDialog] = useState<Dialog>(null);
	const close = () => setDialog(null);
	const { mutateAsync: createLabel, isPending: isCreating } =
		useCreateLabel(workspaceId);
	const { mutateAsync: updateLabel, isPending: isUpdating } =
		useUpdateLabel(workspaceId);
	const { mutateAsync: deleteLabel, isPending: isDeleting } =
		useDeleteLabel(workspaceId);

	const editing = dialog?.kind === "edit" ? dialog.label : null;

	const handleSave = async (values: TLabelFormValues) => {
		try {
			const res = editing
				? await updateLabel({ labelId: editing.id, dto: values })
				: await createLabel(values);
			toast.success(res.message || "Label saved");
			close();
			return true;
		} catch (err) {
			toast.danger(getApiErrorMessage(err, "Failed to save label"));
			return false;
		}
	};

	const handleDelete = async () => {
		if (dialog?.kind !== "delete") return;
		try {
			const res = await deleteLabel(dialog.label.id);
			toast.success(res.message || "Label deleted");
			close();
		} catch (err) {
			toast.danger(getApiErrorMessage(err, "Failed to delete label"));
		}
	};

	if (isError) {
		return (
			<ErrorAlert
				title="Couldn’t load labels"
				description={getApiErrorMessage(error, "Please try again.")}
				onRetry={() => refetch()}
			/>
		);
	}

	return (
		<Card>
			<CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
				<div className="flex flex-col gap-1">
					<CardTitle>Labels</CardTitle>
					<CardDescription>
						{canManageLabels
							? "Labels group issues across every project in this workspace."
							: "Only workspace admins can create, edit or delete labels."}
					</CardDescription>
				</div>
				{canManageLabels && (
					<Button
						size="sm"
						onPress={() => setDialog({ kind: "edit", label: null })}
					>
						<Plus className="size-4" />
						New label
					</Button>
				)}
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<div className="flex items-center justify-center py-8">
						<Spinner />
					</div>
				) : labels.length === 0 ? (
					<p className="py-6 text-center text-sm text-muted">
						No labels yet.
					</p>
				) : (
					<ul className="flex flex-col divide-y divide-border rounded-md border border-border">
						{labels.map((label) => (
							<li
								key={label.id}
								className="flex items-center gap-3 px-3 py-2"
							>
								<LabelChip label={label} className="max-w-60" />
								<span className="text-xs text-muted">{issueCount(label)}</span>
								{canManageLabels && (
									<div className="ml-auto flex items-center">
										<Button
											isIconOnly
											size="sm"
											variant="ghost"
											aria-label={`Edit ${label.name}`}
											onPress={() => setDialog({ kind: "edit", label })}
										>
											<Pencil className="size-3.5" />
										</Button>
										<Button
											isIconOnly
											size="sm"
											variant="ghost"
											aria-label={`Delete ${label.name}`}
											onPress={() => setDialog({ kind: "delete", label })}
										>
											<Trash2 className="size-3.5" />
										</Button>
									</div>
								)}
							</li>
						))}
					</ul>
				)}
			</CardContent>

			<MyModal
				isOpen={dialog?.kind === "edit"}
				onOpenChange={(open) => !open && close()}
				width="md:min-w-[460px]"
				title={editing ? "Edit label" : "New label"}
			>
				{dialog?.kind === "edit" && (
					<LabelForm
						// Remount per label so the defaults re-seed.
						key={editing?.id ?? "new"}
						defaultValues={
							editing ? { name: editing.name, color: editing.color } : undefined
						}
						onSubmit={handleSave}
						isSubmitting={isCreating || isUpdating}
						onCancel={close}
					/>
				)}
			</MyModal>

			<ConfirmModal
				isOpen={dialog?.kind === "delete"}
				onClose={close}
				title="Delete label"
				description={
					dialog?.kind === "delete" && (
						<>
							Delete{" "}
							<span className="font-medium text-foreground">
								{dialog.label.name}
							</span>
							? It’s removed from {issueCount(dialog.label)}. This can’t be
							undone.
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
