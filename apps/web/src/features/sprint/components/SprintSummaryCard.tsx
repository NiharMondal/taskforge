"use client";

import { Button, Chip } from "@heroui/react";
import { getLocalTimeZone, today } from "@internationalized/date";
import { CalendarDays, Square } from "lucide-react";

import { fromISO } from "@/util/iso";

import { formatSprintDay } from "../lib/sprint-dates";
import type { Sprint } from "../types/sprint-types";

interface Props {
	sprint: Sprint;
	doneCount: number;
	totalCount: number;
	/** OWNER/ADMIN only: shows the Complete sprint button. */
	canManage: boolean;
	onEnd: () => void;
}

/** "6 days left", "Ends today", "2 days overdue" — or nothing without an end date. */
function timeLeftLabel(endDate: string | null | undefined): string | null {
	const end = fromISO(endDate);
	if (!end) return null;
	const days = end.compare(today(getLocalTimeZone()));
	if (days === 0) return "Ends today";
	const n = Math.abs(days);
	const unit = n === 1 ? "day" : "days";
	return days > 0 ? `${n} ${unit} left` : `${n} ${unit} overdue`;
}

/** Strip above the board for the running sprint: identity, timeline, progress. */
export default function SprintSummaryCard({
	sprint,
	doneCount,
	totalCount,
	canManage,
	onEnd,
}: Props) {
	const start = formatSprintDay(sprint.startDate);
	const end = formatSprintDay(sprint.endDate);
	const timeLeft = timeLeftLabel(sprint.endDate);
	const percent =
		totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

	return (
		<div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-border bg-surface px-4 py-3">
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<div className="flex items-center gap-2">
					<h2 className="truncate font-semibold">{sprint.name}</h2>
					<Chip size="sm" color="success" variant="soft">
						Active
					</Chip>
				</div>
				<p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
					{(start || end || timeLeft) && (
						<CalendarDays className="h-3.5 w-3.5" />
					)}
					{(start || end) && `${start ?? "—"} → ${end ?? "—"}`}
					{(start || end) && timeLeft && " · "}
					{timeLeft}
					{sprint.goal && (start || end || timeLeft) && " · "}
					{sprint.goal && (
						<span className="truncate" title={sprint.goal}>
							{sprint.goal}
						</span>
					)}
				</p>
			</div>

			<div className="flex w-48 flex-col gap-1">
				<div
					className="h-1.5 overflow-hidden rounded-full bg-surface-tertiary"
					role="progressbar"
					aria-label="Sprint progress"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={percent}
				>
					<div
						className="h-full rounded-full bg-success transition-all"
						style={{ width: `${percent}%` }}
					/>
				</div>
				<p className="text-xs text-muted">
					{doneCount} of {totalCount}{" "}
					{totalCount === 1 ? "issue" : "issues"} done
				</p>
			</div>

			{canManage && (
				<Button size="sm" variant="outline" onPress={onEnd}>
					<Square className="h-3.5 w-3.5" />
					Complete sprint
				</Button>
			)}
		</div>
	);
}
