"use client";

import { Button, cn, Input, TextField } from "@heroui/react";
import { Search, X } from "lucide-react";

import Avatar from "@/components/ui/avatar";
import { TFSelect } from "@/components/ui/TFSelect";
import type { Member } from "@/features/memberships/types/membership-types";
import { getMemberName } from "@/features/memberships/lib/member";
import type { Sprint } from "@/features/sprint/types/sprint-types";
import { initialsOf } from "@/util/initials";

import { ISSUE_STATUSES } from "../../constants";

/** Sentinel filter values (react-aria keys can't be empty). */
export const ALL = "__all__";
export const NO_SPRINT = "__backlog__";

export interface IssueFilters {
	search: string;
	/** Selected assignee user ids; empty means everyone. */
	assigneeIds: string[];
	status: string;
	sprint: string;
}

export const EMPTY_FILTERS: IssueFilters = {
	search: "",
	assigneeIds: [],
	status: ALL,
	sprint: ALL,
};

interface Props {
	filters: IssueFilters;
	onChange: (filters: IssueFilters) => void;
	members: Member[];
	sprints: Sprint[];
}

/** Search, assignee avatars, and status / sprint pickers above the list. */
export default function IssueListToolbar({
	filters,
	onChange,
	members,
	sprints,
}: Props) {
	const set = (patch: Partial<IssueFilters>) =>
		onChange({ ...filters, ...patch });
	const toggleAssignee = (userId: string) =>
		set({
			assigneeIds: filters.assigneeIds.includes(userId)
				? filters.assigneeIds.filter((id) => id !== userId)
				: [...filters.assigneeIds, userId],
		});
	const isFiltered =
		filters.search !== "" ||
		filters.assigneeIds.length > 0 ||
		filters.status !== ALL ||
		filters.sprint !== ALL;

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

			<TFSelect
				aria-label="Filter by status"
				value={filters.status}
				onChange={(status) => set({ status })}
				className="w-40"
				options={[
					{ value: ALL, label: "All statuses" },
					...ISSUE_STATUSES.map((s) => ({ value: s.value, label: s.label })),
				]}
			/>
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

			{isFiltered && (
				<Button size="sm" variant="ghost" onPress={() => onChange(EMPTY_FILTERS)}>
					<X className="size-4" />
					Clear
				</Button>
			)}
		</div>
	);
}
