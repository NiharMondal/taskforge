"use client";

import { Button, Chip } from "@heroui/react";
import { getLocalTimeZone, today } from "@internationalized/date";
import { CalendarDays, Square } from "lucide-react";

import { fromISO } from "@/util/iso";
import { formatDate } from "@/util/format-date";

import type { Sprint } from "../types/sprint-types";

interface Props {
	sprint: Sprint;
	doneCount: number;
	totalCount: number;
	/** OWNER/ADMIN only: shows the End sprint button. */
	canManage: boolean;
	onEnd: () => void;
}

/**
 * Display a sprint date by its calendar day. Planned dates are stored as UTC
 * midnight, so the `yyyy-MM-dd` prefix is the day the user picked; parsing the
 * full ISO string would shift it a day back west of UTC.
 */
const formatDay = (iso: string | null | undefined) =>
	iso ? formatDate(iso.slice(0, 10), "MMM dd, yyyy") : null;

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

/** Header card for the running sprint: identity, timeline, and progress. */
export default function SprintSummaryCard({
	sprint,
	doneCount,
	totalCount,
	canManage,
	onEnd,
}: Props) {
	const start = formatDay(sprint.startDate);
	const end = formatDay(sprint.endDate);
	const timeLeft = timeLeftLabel(sprint.endDate);
	const percent =
		totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

	return (
		<div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
			<div className="flex items-start justify-between gap-4">
				<div className="flex min-w-0 flex-col gap-1">
					<div className="flex items-center gap-2">
						<h2 className="truncate text-lg font-semibold">
							{sprint.name}
						</h2>
						<Chip size="sm" color="success" variant="soft">
							Active
						</Chip>
					</div>
					{sprint.goal && (
						<p className="text-sm text-muted">{sprint.goal}</p>
					)}
					{(start || end || timeLeft) && (
						<p className="flex items-center gap-1.5 text-xs text-muted">
							<CalendarDays className="h-3.5 w-3.5" />
							{(start || end) && `${start ?? "—"} → ${end ?? "—"}`}
							{(start || end) && timeLeft && " · "}
							{timeLeft}
						</p>
					)}
				</div>

				{canManage && (
					<Button size="sm" variant="outline" onPress={onEnd}>
						<Square className="h-3.5 w-3.5" />
						End sprint
					</Button>
				)}
			</div>

			<div className="flex flex-col gap-1.5">
				<div
					className="h-2 overflow-hidden rounded-full bg-surface-tertiary"
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
		</div>
	);
}
