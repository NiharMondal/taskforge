"use client";

import { Button, cn, Input, ListBox, Select, TextField } from "@heroui/react";
import { Search, X } from "lucide-react";

import Avatar from "@/components/ui/avatar";
import { TFSelect } from "@/components/ui/TFSelect";
import type { Label } from "@/features/labels/types/label-types";
import type { Member } from "@/features/memberships/types/membership-types";
import { getMemberName } from "@/features/memberships/lib/member";
import type { Sprint } from "@/features/sprint/types/sprint-types";
import { initialsOf } from "@/util/initials";

import { ISSUE_STATUSES } from "../constants";
import {
	ALL,
	EMPTY_FILTERS,
	isFiltered,
	NO_SPRINT,
	type IssueFilters,
} from "../lib/issue-filters";

interface Props {
	filters: IssueFilters;
	onChange: (filters: IssueFilters) => void;
	members: Member[];
	/** Shows the sprint picker (the List tab); the board is one sprint. */
	sprints?: Sprint[];
	/** Shows the status picker (the List tab); the board's lanes are statuses. */
	showStatus?: boolean;
	/** The workspace's labels; the label picker shows once there are any. */
	labels?: Label[];
}

/**
 * Search, assignee avatars, a label picker, and optional status / sprint
 * pickers — the filter row of the List tab and the active sprint board (see
 * `filterIssues`).
 */
export default function IssueFilterBar({
	filters,
	onChange,
	members,
	sprints,
	showStatus = false,
	labels = [],
}: Props) {
	const set = (patch: Partial<IssueFilters>) =>
		onChange({ ...filters, ...patch });
	const toggleAssignee = (userId: string) =>
		set({
			assigneeIds: filters.assigneeIds.includes(userId)
				? filters.assigneeIds.filter((id) => id !== userId)
				: [...filters.assigneeIds, userId],
		});

	return (
		<div className="flex flex-wrap items-center gap-3">
			<TextField
				aria-label="Search issues"
				value={filters.search}
				onChange={(search) => set({ search })}
				className="w-full sm:w-60"
			>
				<div className="relative">
					<Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" />
					<Input placeholder="Search by title or key" className="w-full pl-8" />
				</div>
			</TextField>

			<div className="flex items-center -space-x-1.5" role="group" aria-label="Filter by assignee">
				{members
					.filter((m) => m.user)
					.map((m) => {
						const name = getMemberName(m);
						const isOn = filters.assigneeIds.includes(m.userId);
						return (
							<button
								key={m.userId}
								type="button"
								title={name}
								aria-label={`Assigned to ${name}`}
								aria-pressed={isOn}
								onClick={() => toggleAssignee(m.userId)}
								className={cn(
									"rounded-full ring-2 transition-transform hover:z-10 hover:-translate-y-0.5",
									isOn ? "z-10 ring-accent" : "ring-background",
								)}
							>
								<Avatar
									size="sm"
									src={m.user?.avatarUrl ?? undefined}
									alt={name}
									fallback={initialsOf(name)}
								/>
							</button>
						);
					})}
			</div>

			{labels.length > 0 && (
				<Select
					aria-label="Filter by label"
					selectionMode="multiple"
					value={filters.labelIds}
					onChange={(keys) => set({ labelIds: keys.map(String) })}
					placeholder="All labels"
					className="w-40"
				>
					<Select.Trigger>
						<Select.Value>
							{({ isPlaceholder }) =>
								isPlaceholder
									? "All labels"
									: filters.labelIds.length === 1
										? labels.find((l) => l.id === filters.labelIds[0])?.name
										: `${filters.labelIds.length} labels`
							}
						</Select.Value>
						<Select.Indicator />
					</Select.Trigger>
					<Select.Popover>
						<ListBox>
							{labels.map((l) => (
								<ListBox.Item key={l.id} id={l.id} textValue={l.name}>
									<span className="flex items-center gap-2">
										<span
											aria-hidden
											className="size-2.5 shrink-0 rounded-full"
											style={{ backgroundColor: l.color }}
										/>
										{l.name}
									</span>
									<ListBox.ItemIndicator />
								</ListBox.Item>
							))}
						</ListBox>
					</Select.Popover>
				</Select>
			)}

			{showStatus && (
				<TFSelect
					aria-label="Filter by status"
					value={filters.status}
					onChange={(status) => set({ status })}
					className="w-40"
					options={[
						{ value: ALL, label: "All statuses" },
						...ISSUE_STATUSES.map((s) => ({
							value: s.value,
							label: s.label,
						})),
					]}
				/>
			)}
			{sprints && (
				<TFSelect
					aria-label="Filter by sprint"
					value={filters.sprint}
					onChange={(sprint) => set({ sprint })}
					className="w-40"
					options={[
						{ value: ALL, label: "All sprints" },
						{ value: NO_SPRINT, label: "Backlog (no sprint)" },
						...sprints.map((s) => ({
							value: s.id,
							label: s.isActive ? `${s.name} (active)` : s.name,
						})),
					]}
				/>
			)}

			{isFiltered(filters) && (
				<Button size="sm" variant="ghost" onPress={() => onChange(EMPTY_FILTERS)}>
					<X className="size-4" />
					Clear
				</Button>
			)}
		</div>
	);
}
