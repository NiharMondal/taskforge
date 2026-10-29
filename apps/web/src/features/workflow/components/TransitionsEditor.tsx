"use client";

import { useState } from "react";

import { Button, Checkbox } from "@heroui/react";

import StatusChip from "@/features/issues/components/StatusChip";
import { allTransitions, type StatusTransition } from "@taskforge/shared";

import type { WorkflowStatus } from "../types/workflow-types";

type Props = {
	statuses: WorkflowStatus[];
	transitions: StatusTransition[];
	isReadOnly: boolean;
	isSaving: boolean;
	onSave: (transitions: StatusTransition[]) => Promise<boolean>;
};

const pairKey = (from: string, to: string) => `${from}>${to}`;

/**
 * The moves an issue may make, as a from × to grid of checkboxes. Edits are
 * local until saved, since the API replaces the whole set at once. Staying in
 * the same status is always allowed, so the diagonal has no box.
 */
export default function TransitionsEditor({
	statuses,
	transitions,
	isReadOnly,
	isSaving,
	onSave,
}: Props) {
	const saved = new Set(
		transitions.map((t) => pairKey(t.fromStatusId, t.toStatusId)),
	);
	// `null` until the first edit, so a refetch shows through until then.
	const [draft, setDraft] = useState<Set<string> | null>(null);
	const allowed = draft ?? saved;
	const isDirty =
		!!draft &&
		(draft.size !== saved.size || [...draft].some((k) => !saved.has(k)));

	const set = (keys: string[], on: boolean) => {
		const next = new Set(allowed);
		for (const key of keys) {
			if (on) next.add(key);
			else next.delete(key);
		}
		setDraft(next);
	};
	const everything = allTransitions(statuses.map((s) => s.id)).map((t) =>
		pairKey(t.fromStatusId, t.toStatusId),
	);
	const rowKeys = (from: string) =>
		statuses.filter((s) => s.id !== from).map((s) => pairKey(from, s.id));

	const save = async () => {
		const list = [...allowed].map((key) => {
			const [fromStatusId, toStatusId] = key.split(">");
			return { fromStatusId, toStatusId };
		});
		if (await onSave(list)) setDraft(null);
	};

	return (
		<div className="flex flex-col gap-3">
			{!isReadOnly && (
				<div className="flex flex-wrap items-center gap-2">
					<Button size="sm" variant="outline" onPress={() => set(everything, true)}>
						Allow every move
					</Button>
					<Button size="sm" variant="outline" onPress={() => setDraft(new Set())}>
						Clear all
					</Button>
					<div className="ml-auto flex gap-2">
						{isDirty && (
							<Button size="sm" variant="ghost" onPress={() => setDraft(null)}>
								Discard
							</Button>
						)}
						<Button size="sm" isDisabled={!isDirty || isSaving} onPress={save}>
							{isSaving ? "Saving…" : "Save moves"}
						</Button>
					</div>
				</div>
			)}

			<div className="overflow-x-auto rounded-md border border-border">
				<table className="w-max min-w-full text-sm">
					<thead>
						<tr className="border-b border-border bg-surface-secondary">
							<th className="px-3 py-2 text-left text-xs font-medium text-muted">
								From ↓ / To →
							</th>
							{statuses.map((to) => (
								<th key={to.id} className="px-2 py-2 text-left font-normal">
									<StatusChip status={to} />
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{statuses.map((from) => (
							<tr key={from.id} className="border-b border-border last:border-0">
								<th className="px-3 py-2 text-left font-normal">
									<div className="flex items-center gap-2">
										<StatusChip status={from} />
										{!isReadOnly && (
											<button
												type="button"
												className="text-xs text-accent hover:underline"
												onClick={() => {
													const keys = rowKeys(from.id);
													set(keys, !keys.every((k) => allowed.has(k)));
												}}
											>
												toggle row
											</button>
										)}
									</div>
								</th>
								{statuses.map((to) => {
									if (to.id === from.id) {
										return (
											<td
												key={to.id}
												className="px-2 py-2 text-center text-muted"
												title="Staying put is always allowed"
											>
												—
											</td>
										);
									}
									const key = pairKey(from.id, to.id);
									return (
										<td key={to.id} className="px-2 py-2">
											<Checkbox
												aria-label={`${from.name} to ${to.name}`}
												isSelected={allowed.has(key)}
												isReadOnly={isReadOnly}
												onChange={(on) => set([key], on)}
											>
												<Checkbox.Control>
													<Checkbox.Indicator />
												</Checkbox.Control>
											</Checkbox>
										</td>
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
