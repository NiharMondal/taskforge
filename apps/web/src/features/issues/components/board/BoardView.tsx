"use client";

import { useMemo, useRef, useState } from "react";

import {
	DndContext,
	DragOverlay,
	KeyboardSensor,
	PointerSensor,
	closestCorners,
	useSensor,
	useSensors,
	type DragEndEvent,
	type DragOverEvent,
	type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Button, Spinner, toast } from "@heroui/react";
import { Plus } from "lucide-react";

import ErrorAlert from "@/components/ui/error-alert";
import { getApiErrorMessage } from "@/lib/api-error";

import { useMemberships } from "@/features/memberships/hooks/use-memberships";
import { useWorkspacePermissions } from "@/features/memberships/hooks/use-workspace-permissions";
import { getMemberName } from "@/features/memberships/lib/member";
import { canSetIssueStatus } from "@/features/memberships/lib/permissions";
import ProjectHeader from "@/features/projects/components/ProjectHeader";
import { useProjects } from "@/features/projects/hooks/use-projects";
import { useWorkspace } from "@/features/workspace/context/workspace-context";

import { BOARD_STATUSES } from "../../constants";
import { useIssues, useUpdateIssue } from "../../hooks/use-issues";
import { compareIssueRank, rankBetween } from "../../lib/rank";
import type { Issue, IssueStatus } from "../../types/issue-types";
import CreateIssueModal from "../CreateIssueModal";
import IssueDetailModal from "../IssueDetailModal";
import BoardColumn from "./BoardColumn";
import IssueCardBody from "./IssueCardBody";
import { useBoolean } from "ahooks";

type Columns = Record<IssueStatus, Issue[]>;

/** Position of a status in the board's todo→done lane flow. */
const statusOrder = (status: IssueStatus): number =>
	BOARD_STATUSES.findIndex((s) => s.value === status);

/**
 * A card may only move one lane at a time — to the immediately preceding or
 * following status. Measured against the lane the drag *started* in (not the
 * card's live mid-drag lane) so it can't be walked across multiple lanes in a
 * single drag.
 */
const isAdjacentStatus = (from: IssueStatus, to: IssueStatus): boolean =>
	Math.abs(statusOrder(from) - statusOrder(to)) === 1;

// Stable empty reference for the loading/disabled window. A fresh `[]` literal
// each render would make the render-time resync below fire every render (it
// compares by reference), looping until React throws "Too many re-renders".
const EMPTY_ISSUES: Issue[] = [];

/**
 * Bucket a flat issue list into one array per status (empty columns included),
 * each lane sorted by fractional rank so order matches what was persisted.
 */
function groupByStatus(issues: Issue[]): Columns {
	const columns = Object.fromEntries(
		BOARD_STATUSES.map((s) => [s.value, [] as Issue[]]),
	) as Columns;
	// Backlog issues have no board lane (the board starts at To Do), so the
	// optional chaining below quietly skips them — they surface on the list view.
	for (const issue of issues) {
		columns[issue.status]?.push(issue);
	}
	for (const status of Object.keys(columns) as IssueStatus[]) {
		columns[status].sort(compareIssueRank);
	}
	return columns;
}

/**
 * The rank for the card at `idx` in a lane's final order, from its neighbors.
 * Undefined when it can't be computed — including when a neighbor exists but
 * has no rank yet: treating that neighbor as "no bound" would send the card to
 * the top or bottom of the lane instead of where it was dropped.
 */
function rankForPosition(ordered: Issue[], idx: number): string | undefined {
	const prev = idx > 0 ? ordered[idx - 1] : null;
	const next = idx < ordered.length - 1 ? ordered[idx + 1] : null;
	if ((prev && !prev.rank) || (next && !next.rank)) return undefined;
	return rankBetween(prev?.rank, next?.rank);
}

/**
 * Kanban board. Columns are status lanes; dragging a card persists its new
 * status *and* position via an optimistic PATCH ({@link useUpdateIssue}).
 *
 * Position is durable: the drop computes a fractional `rank` from the card's
 * neighbors (see `lib/rank.ts`) and the backend stores it verbatim. When a rank
 * can't be computed the PATCH carries status only, and the backend appends the
 * card to the end of the target lane.
 */
export default function BoardView({ projectId }: { projectId: string }) {
	const [isOpen, { setTrue: openModal, setFalse: closeModal }] = useBoolean();
	const { activeWorkspaceId } = useWorkspace();
	const workspaceId = activeWorkspaceId ?? "";

	const { data: projects } = useProjects(workspaceId);
	const project = projects?.find((p) => p.id === projectId);

	const { data: members = [] } = useMemberships(workspaceId);
	const permissions = useWorkspacePermissions();

	const { data, isLoading, isError, refetch } = useIssues(
		workspaceId,
		projectId,
	);
	const issues = data ?? EMPTY_ISSUES;
	const { mutate: updateIssue } = useUpdateIssue(workspaceId, projectId);

	// Local mirror of the columns so cards can move live during a drag. Resynced
	// by comparing against the previous server list *during render* (React's
	// recommended alternative to a sync effect): when the query data changes
	// — including the optimistic write on drop — regroup. Drags don't trigger a
	// refetch, so an in-progress drag is never clobbered mid-move.
	const [columns, setColumns] = useState<Columns>(() =>
		groupByStatus(issues),
	);
	const [syncedIssues, setSyncedIssues] = useState(issues);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
	const draggedFrom = useRef<IssueStatus | null>(null);

	if (issues !== syncedIssues) {
		setSyncedIssues(issues);
		setColumns(groupByStatus(issues));
	}

	const assigneeNames = useMemo(() => {
		const map = new Map<string, string>();
		for (const m of members) {
			if (m.user) map.set(m.userId, getMemberName(m));
		}
		return map;
	}, [members]);

	const sensors = useSensors(
		// A small drag threshold so clicks (future: open issue) aren't swallowed.
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const activeIssue = useMemo(() => {
		if (!activeId) return null;
		for (const { value } of BOARD_STATUSES) {
			const found = columns[value].find((i) => i.id === activeId);
			if (found) return found;
		}
		return null;
	}, [activeId, columns]);

	/** Which status lane an id lives in — id may be a card id or a column id. */
	const findContainer = (id: string): IssueStatus | undefined => {
		if (id in columns) return id as IssueStatus;
		return (Object.keys(columns) as IssueStatus[]).find((status) =>
			columns[status].some((issue) => issue.id === id),
		);
	};

	const handleDragStart = (event: DragStartEvent) => {
		const id = String(event.active.id);
		setActiveId(id);
		draggedFrom.current = findContainer(id) ?? null;
	};

	// Move the card across lanes mid-drag so the UI reflects the target lane.
	const handleDragOver = (event: DragOverEvent) => {
		const { active, over } = event;
		if (!over) return;

		const activeId = String(active.id);
		const overId = String(over.id);
		const from = findContainer(activeId);
		const to = findContainer(overId);
		if (!from || !to || from === to) return;

		// Refuse lanes the viewer's role can't move a card into (MEMBER → DONE),
		// so the card never visibly lands somewhere the PATCH would 403.
		if (!canSetIssueStatus(permissions, to)) return;

		// Allow the origin lane itself (so a card can be dropped back where it
		// started) plus the immediately adjacent lanes — block any jump two or
		// more lanes away from where the drag began.
		const origin = draggedFrom.current ?? from;
		if (to !== origin && !isAdjacentStatus(origin, to)) return;

		setColumns((prev) => {
			const fromItems = prev[from];
			const toItems = prev[to];
			const moved = fromItems.find((i) => i.id === activeId);
			if (!moved) return prev;

			const overIndex = toItems.findIndex((i) => i.id === overId);
			const insertAt = overIndex >= 0 ? overIndex : toItems.length;

			return {
				...prev,
				[from]: fromItems.filter((i) => i.id !== activeId),
				[to]: [
					...toItems.slice(0, insertAt),
					{ ...moved, status: to },
					...toItems.slice(insertAt),
				],
			};
		});
	};

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		setActiveId(null);
		const from = draggedFrom.current;
		draggedFrom.current = null;
		if (!over) return;

		const activeId = String(active.id);
		const container = findContainer(activeId);
		if (!container) return;

		// Work out the final lane order and the dragged card's rank from the
		// current columns *before* updating state. (Reading values captured inside
		// a `setColumns` updater doesn't work: after `setActiveId` above, React
		// defers that updater to the next render, so they were still unset when
		// the PATCH below was built — reorders were never saved and lane moves
		// lost their position.)
		const items = columns[container];
		const oldIndex = items.findIndex((i) => i.id === activeId);
		const overIndex = items.findIndex((i) => i.id === String(over.id));
		const newIndex = overIndex === -1 ? items.length - 1 : overIndex;
		const positionChanged = oldIndex !== -1 && oldIndex !== newIndex;
		const ordered = positionChanged
			? arrayMove(items, oldIndex, newIndex)
			: items;

		const idx = ordered.findIndex((i) => i.id === activeId);
		const newRank = rankForPosition(ordered, idx);

		if (positionChanged) {
			setColumns((prev) => ({ ...prev, [container]: ordered }));
		}

		// Persist when the card changed lane and/or position. Always send the new
		// status; include rank when we could compute one.
		const laneChanged = !!from && from !== container;

		// Without a rank a same-lane move can't be saved (a status-only PATCH
		// changes nothing), so put the lane back rather than show an order that
		// will vanish on the next refetch.
		if (!laneChanged && positionChanged && !newRank) {
			setColumns(groupByStatus(issues));
			toast.danger(
				"Couldn’t save this card’s position. Try dropping it somewhere else.",
			);
			return;
		}

		if (laneChanged || positionChanged) {
			updateIssue(
				{
					issueId: activeId,
					dto: {
						status: container,
						...(newRank && { rank: newRank }),
					},
				},
				{
					onSuccess: ({ message }) =>
						toast.success(message || "Issue updated"),
					onError: (error) =>
						toast.danger(
							getApiErrorMessage(
								error,
								"Failed to update issue position",
							),
						),
				},
			);
		}
	};

	const handleClose = () => {
		setSelectedIssue(null);
		closeModal();
	};
	return (
		<div className="flex flex-col gap-6">
			<ProjectHeader
				projectId={projectId}
				project={project}
				active="board"
				actions={
					permissions.canCreateIssue && (
						<Button onPress={openModal}>
							<Plus className="h-4 w-4" />
							New Issue
						</Button>
					)
				}
			/>

			{isError ? (
				<ErrorAlert
					title="Couldn’t load the board"
					description="Check your connection and try again."
					onRetry={() => refetch()}
				/>
			) : isLoading ? (
				<div className="flex items-center gap-2 py-12 text-muted">
					<Spinner size="sm" />
					Loading board…
				</div>
			) : (
				<DndContext
					sensors={sensors}
					collisionDetection={closestCorners}
					onDragStart={handleDragStart}
					onDragOver={handleDragOver}
					onDragEnd={handleDragEnd}
				>
					<div className="flex gap-4 overflow-x-auto pb-4">
						{BOARD_STATUSES.map(({ value, label }) => (
							<BoardColumn
								key={value}
								status={value}
								label={label}
								issues={columns[value]}
								assigneeNames={assigneeNames}
								onOpenIssue={setSelectedIssue}
								canDrag={permissions.canChangeIssueStatus}
							/>
						))}
					</div>

					<DragOverlay>
						{activeIssue ? (
							<IssueCardBody
								issue={activeIssue}
								assigneeName={
									activeIssue.assigneeId
										? assigneeNames.get(
												activeIssue.assigneeId,
											)
										: undefined
								}
							/>
						) : null}
					</DragOverlay>
				</DndContext>
			)}

			<CreateIssueModal
				isOpen={isOpen}
				onOpenChange={closeModal}
				members={members}
				projectId={projectId}
				// The board has no BACKLOG lane, so a new issue would vanish from it.
				defaultStatus="TODO"
			/>

			<IssueDetailModal
				issue={selectedIssue}
				onClose={handleClose}
				members={members}
				workspaceId={workspaceId}
				projectId={projectId}
				permissions={permissions}
			/>
		</div>
	);
}
