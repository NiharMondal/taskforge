"use client";

import { useState } from "react";
import { Button, Chip, toast } from "@heroui/react";
import { Pencil, Plus } from "lucide-react";

import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { getApiErrorMessage } from "@/lib/api-error";

import {
	useSprints,
	useCreateSprint,
	useUpdateSprint,
} from "../hooks/use-sprints";
import type { Sprint } from "../types/sprint-types";
import type { TSprintFormValues } from "../schema/sprint-schema";
import SprintFormModal from "./SprintFormModal";
import { fromISO, toISO } from "@/util/iso";

interface Props {
	projectId: string;
}

export default function SprintsView({ projectId }: Props) {
	const { activeWorkspaceId } = useWorkspace();
	const workspaceId = activeWorkspaceId ?? "";

	const { data: sprints = [], isLoading } = useSprints(
		workspaceId,
		projectId,
	);
	const { mutateAsync: createSprint, isPending: isCreating } =
		useCreateSprint(workspaceId, projectId);
	const { mutateAsync: updateSprint, isPending: isUpdating } =
		useUpdateSprint(workspaceId, projectId);

	const [createOpen, setCreateOpen] = useState(false);
	const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);

	const handleCreate = async (values: TSprintFormValues) => {
		try {
			const res = await createSprint({
				...values,
				goal: values.goal || null,
				startDate: toISO(values.startDate),
				endDate: toISO(values.endDate),
			});
			toast.success(res.message || "Sprint created");
			return true;
		} catch (error) {
			toast.danger(getApiErrorMessage(error));
			return false;
		}
	};

	const handleUpdate = async (values: TSprintFormValues) => {
		if (!editingSprint) return false;
		try {
			const res = await updateSprint({
				sprintId: editingSprint.id,
				dto: {
					...values,
					goal: values.goal || null,
					startDate: toISO(values.startDate),
					endDate: toISO(values.endDate),
				},
			});
			toast.success(res.message || "Sprint updated");
			return true;
		} catch (error) {
			toast.danger(getApiErrorMessage(error));
			return false;
		}
	};

	const editDefaultValues = editingSprint
		? {
				name: editingSprint.name,
				goal: editingSprint.goal ?? "",
				startDate: fromISO(editingSprint.startDate),
				endDate: fromISO(editingSprint.endDate),
			}
		: null;

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<h2 className="text-lg font-semibold">Sprints</h2>
				<Button size="sm" onPress={() => setCreateOpen(true)}>
					<Plus className="h-4 w-4" />
					New Sprint
				</Button>
			</div>

			{isLoading ? (
				<p className="text-sm text-muted">Loading sprints…</p>
			) : sprints.length === 0 ? (
				<p className="text-sm text-muted">
					No sprints yet. Create one to get started.
				</p>
			) : (
				<div className="flex flex-col gap-2">
					{sprints.map((sprint) => (
						<SprintRow
							key={sprint.id}
							sprint={sprint}
							onEdit={() => setEditingSprint(sprint)}
						/>
					))}
				</div>
			)}

			<SprintFormModal
				isOpen={createOpen}
				closeModal={() => setCreateOpen(false)}
				onSubmit={handleCreate}
				isSubmitting={isCreating}
			/>

			<SprintFormModal
				isOpen={!!editingSprint}
				closeModal={() => setEditingSprint(null)}
				onSubmit={handleUpdate}
				isSubmitting={isUpdating}
				defaultValues={editDefaultValues}
			/>
		</div>
	);
}

function SprintRow({ sprint, onEdit }: { sprint: Sprint; onEdit: () => void }) {
	const formatDate = (iso: string | null | undefined) => {
		if (!iso) return null;
		return new Date(iso).toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	};

	const start = formatDate(sprint.startDate);
	const end = formatDate(sprint.endDate);

	return (
		<div className="flex items-center justify-between rounded-md border border-border bg-content1 p-3">
			<div className="flex flex-col gap-0.5">
				<div className="flex items-center gap-2">
					<span className="font-medium">{sprint.name}</span>
					{sprint.isActive && (
						<Chip size="sm" color="success" variant="soft">
							Active
						</Chip>
					)}
				</div>
				{sprint.goal && (
					<p className="text-sm text-muted">{sprint.goal}</p>
				)}
				{(start || end) && (
					<p className="text-xs text-muted">
						{start ?? "—"} → {end ?? "—"}
					</p>
				)}
			</div>
			<Button
				isIconOnly
				size="sm"
				variant="ghost"
				aria-label="Edit sprint"
				onPress={onEdit}
			>
				<Pencil className="h-4 w-4" />
			</Button>
		</div>
	);
}
