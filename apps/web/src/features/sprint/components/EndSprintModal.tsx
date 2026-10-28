"use client";

import { toast } from "@heroui/react";

import ConfirmModal from "@/components/ui/confirm-modal";
import { getApiErrorMessage } from "@/lib/api-error";

import { useEndSprint } from "../hooks/use-sprints";
import type { Sprint } from "../types/sprint-types";

interface Props {
	workspaceId: string;
	projectId: string;
	/** The sprint to end; `null` keeps the dialog closed. */
	sprint: Sprint | null;
	onClose: () => void;
}

/**
 * "End sprint?" confirmation, shared by the current-sprint view and the
 * sprint list in project settings. Owns the end mutation, so callers only
 * decide which sprint it is for.
 */
export default function EndSprintModal({
	workspaceId,
	projectId,
	sprint,
	onClose,
}: Props) {
	const { mutateAsync: endSprint, isPending } = useEndSprint(
		workspaceId,
		projectId,
	);

	const handleConfirm = async () => {
		if (!sprint) return;
		try {
			const res = await endSprint(sprint.id);
			toast.success(res.message || "Sprint ended");
			onClose();
		} catch (error) {
			toast.danger(getApiErrorMessage(error, "Failed to end sprint"));
		}
	};

	return (
		<ConfirmModal
			isOpen={!!sprint}
			onClose={onClose}
			title="End sprint?"
			description={
				<>
					Ending <strong>{sprint?.name}</strong> takes its unfinished
					issues out of the sprint (their status is left as is).
					Issues that are Done stay with it. This can’t be undone.
				</>
			}
			confirmLabel="End sprint"
			pendingLabel="Ending…"
			isPending={isPending}
			onConfirm={handleConfirm}
		/>
	);
}
