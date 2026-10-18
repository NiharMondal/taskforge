"use client";

import { useState } from "react";
import { Button, Chip, toast } from "@heroui/react";
import { Pencil, Play, Plus, Square } from "lucide-react";

import ErrorAlert from "@/components/ui/error-alert";
import MyModal from "@/components/ui/my-modal";
import { useWorkspacePermissions } from "@/features/memberships/hooks/use-workspace-permissions";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { getApiErrorMessage } from "@/lib/api-error";

import {
	useSprints,
	useCreateSprint,
	useUpdateSprint,
	useStartSprint,
	useEndSprint,
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
	const { canManageSprints } = useWorkspacePermissions();

	const {
		data: sprints = [],
		isLoading,
		isError,
		refetch,
	} = useSprints(workspaceId, projectId);
	const { mutateAsync: createSprint, isPending: isCreating } =
		useCreateSprint(workspaceId, projectId);
	const { mutateAsync: updateSprint, isPending: isUpdating } =
		useUpdateSprint(workspaceId, projectId);
	const {
		mutateAsync: startSprint,
		isPending: isStarting,
		variables: startingId,
	} = useStartSprint(workspaceId, projectId);
	const { mutateAsync: endSprint, isPending: isEnding } = useEndSprint(
		workspaceId,
		projectId,
	);

	const [createOpen, setCreateOpen] = useState(false);
	const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
	const [endingSprint, setEndingSprint] = useState<Sprint | null>(null);

	// The backend allows one active sprint per project, so while one runs every
	// other sprint's Start would be answered with a 403.
	const hasActiveSprint = sprints.some((s) => s.isActive);

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

	const handleStart = async (sprint: Sprint) => {
		try {
			const res = await startSprint(sprint.id);
			toast.success(res.message || "Sprint started");
		} catch (error) {
			toast.danger(getApiErrorMessage(error, "Failed to start sprint"));
		}
	};

	const handleConfirmEnd = async () => {
		if (!endingSprint) return;
		try {
			const res = await endSprint(endingSprint.id);
			toast.success(res.message || "Sprint ended");
			setEndingSprint(null);
		} catch (error) {
			toast.danger(getApiErrorMessage(error, "Failed to end sprint"));
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
				{canManageSprints && (
					<Button size="sm" onPress={() => setCreateOpen(true)}>
						<Plus className="h-4 w-4" />
						New Sprint
					</Button>
				)}
			</div>

			{isError ? (
				<ErrorAlert
					title="Couldn’t load sprints"
					description="Check your connection and try again."
					onRetry={() => refetch()}
				/>
			) : isLoading ? (
				<p className="text-sm text-muted">Loading sprints…</p>
			) : sprints.length === 0 ? (
				<p className="text-sm text-muted">
					{canManageSprints
						? "No sprints yet. Create one to get started."
						: "No sprints yet."}
				</p>
			) : (
				<div className="flex flex-col gap-2">
					{sprints.map((sprint) => (
						<SprintRow
							key={sprint.id}
							sprint={sprint}
							canManage={canManageSprints}
							startDisabledReason={
								hasActiveSprint
									? "Another sprint is already active"
									: undefined
							}
							isStarting={isStarting && startingId === sprint.id}
							onEdit={() => setEditingSprint(sprint)}
							onStart={() => handleStart(sprint)}
							onEnd={() => setEndingSprint(sprint)}
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

			<MyModal
				isOpen={!!endingSprint}
				onOpenChange={(open) => !open && setEndingSprint(null)}
				size="md"
				title="End sprint?"
			>
				<div className="flex flex-col gap-4 pb-2">
					<p className="text-sm text-muted">
						Ending <strong>{endingSprint?.name}</strong> takes its
						unfinished issues out of the sprint (their status is
						left as is). Issues that are Done stay with it. This
						can’t be undone.
					</p>
					<div className="flex justify-end gap-2">
						<Button
							type="button"
							variant="outline"
							onPress={() => setEndingSprint(null)}
						>
							Cancel
						</Button>
						<Button
							type="button"
							variant="danger"
							isDisabled={isEnding}
							onPress={handleConfirmEnd}
						>
							{isEnding ? "Ending…" : "End sprint"}
						</Button>
					</div>
				</div>
			</MyModal>
		</div>
	);
}

interface SprintRowProps {
	sprint: Sprint;
	/** OWNER/ADMIN only: shows the edit / start / end controls. */
	canManage: boolean;
	/** Set when Start can't be used right now; shown as the button's title. */
	startDisabledReason?: string;
	isStarting: boolean;
	onEdit: () => void;
	onStart: () => void;
	onEnd: () => void;
}

function SprintRow({
	sprint,
	canManage,
	startDisabledReason,
	isStarting,
	onEdit,
	onStart,
	onEnd,
}: SprintRowProps) {
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
		<div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface p-3">
			<div className="flex min-w-0 flex-col gap-0.5">
				<div className="flex items-center gap-2">
					<span className="truncate font-medium">{sprint.name}</span>
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

			{canManage && (
				<div className="flex shrink-0 items-center gap-1">
					{sprint.isActive ? (
						<Button
							size="sm"
							variant="outline"
							onPress={onEnd}
						>
							<Square className="h-3.5 w-3.5" />
							End
						</Button>
					) : (
						// The span carries the "why is this greyed out" hint: the
						// Button doesn't forward `title`, and a disabled button
						// swallows hover anyway.
						<span title={startDisabledReason}>
							<Button
								size="sm"
								variant="outline"
								isDisabled={!!startDisabledReason || isStarting}
								aria-label={`Start ${sprint.name}`}
								onPress={onStart}
							>
								<Play className="h-3.5 w-3.5" />
								{isStarting ? "Starting…" : "Start"}
							</Button>
						</span>
					)}
					<Button
						isIconOnly
						size="sm"
						variant="ghost"
						aria-label={`Edit ${sprint.name}`}
						onPress={onEdit}
					>
						<Pencil className="h-4 w-4" />
					</Button>
				</div>
			)}
		</div>
	);
}
