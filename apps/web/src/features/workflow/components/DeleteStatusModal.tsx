"use client";

import { useState } from "react";

import { Button } from "@heroui/react";

import MyModal from "@/components/ui/my-modal";
import { TFSelect } from "@/components/ui/TFSelect";
import StatusChip from "@/features/issues/components/StatusChip";

import type { WorkflowStatus } from "../types/workflow-types";

type Props = {
	/** The status to delete; `null` closes the dialog. */
	status: WorkflowStatus | null;
	/** Every status of the project, to pick where its issues go. */
	statuses: WorkflowStatus[];
	isPending: boolean;
	onClose: () => void;
	onConfirm: (moveTo: string | undefined) => void;
};

/**
 * Confirm deleting a status. One that still has issues needs somewhere to put
 * them: they move to the chosen status (to the end of its lane) and each gets
 * a history entry.
 */
export default function DeleteStatusModal({
	status,
	statuses,
	isPending,
	onClose,
	onConfirm,
}: Props) {
	const others = statuses.filter((s) => s.id !== status?.id);
	const issueCount = status?.issueCount ?? 0;
	const [moveTo, setMoveTo] = useState("");
	// The first other status of the same category is the likeliest home.
	const suggested =
		others.find((s) => s.category === status?.category)?.id ?? others[0]?.id;
	const target = moveTo || suggested || "";

	return (
		<MyModal
			isOpen={!!status}
			onOpenChange={(open) => {
				if (!open) {
					setMoveTo("");
					onClose();
				}
			}}
			title="Delete status"
			size="sm"
		>
			{status && (
				<div className="flex flex-col gap-4">
					<p className="flex flex-wrap items-center gap-1.5 text-sm">
						Delete <StatusChip status={status} /> from this project’s
						workflow?
					</p>
					{issueCount > 0 && (
						<div className="flex flex-col gap-2">
							<p className="text-sm text-muted">
								{issueCount === 1
									? "1 issue is"
									: `${issueCount} issues are`}{" "}
								in this status. Move them to:
							</p>
							<TFSelect
								aria-label="Move its issues to"
								value={target}
								onChange={setMoveTo}
								options={others.map((s) => ({ value: s.id, label: s.name }))}
							/>
						</div>
					)}
					<div className="flex justify-end gap-2">
						<Button variant="outline" onPress={onClose}>
							Cancel
						</Button>
						<Button
							variant="danger"
							isDisabled={isPending || (issueCount > 0 && !target)}
							onPress={() => onConfirm(issueCount > 0 ? target : undefined)}
						>
							{isPending ? "Deleting…" : "Delete"}
						</Button>
					</div>
				</div>
			)}
		</MyModal>
	);
}
