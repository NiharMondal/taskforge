"use client";

import { useMemo, useState } from "react";

import {
	DndContext,
	DragOverlay,
	KeyboardSensor,
	PointerSensor,
	pointerWithin,
	useSensor,
	useSensors,
	type DragEndEvent,
	type DragStartEvent,
} from "@dnd-kit/core";
import { Button, Chip, Spinner, toast } from "@heroui/react";
import { useBoolean } from "ahooks";
import { Pencil, Play, Plus, Square } from "lucide-react";

import ErrorAlert from "@/components/ui/error-alert";
import CreateIssueModal from "@/features/issues/components/CreateIssueModal";
import { ISSUE_PRIORITIES } from "@/features/issues/constants";
import { useIssues, useUpdateIssue } from "@/features/issues/hooks/use-issues";
import type { Issue } from "@/features/issues/types/issue-types";
import { useMemberships } from "@/features/memberships/hooks/use-memberships";
import { useWorkspacePermissions } from "@/features/memberships/hooks/use-workspace-permissions";
import { canEditIssue } from "@/features/memberships/lib/permissions";
import { getMemberName } from "@/features/memberships/lib/member";
import ProjectHeader from "@/features/projects/components/ProjectHeader";
import { useProjects } from "@/features/projects/hooks/use-projects";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { getApiErrorMessage } from "@/lib/api-error";
import { fromISO } from "@/util/iso";

import { useSprintActions } from "../../hooks/use-sprint-actions";
import { useSprints } from "../../hooks/use-sprints";
import { formatSprintDay } from "../../lib/sprint-dates";
import type { Sprint } from "../../types/sprint-types";
import EndSprintModal from "../EndSprintModal";
import SprintFormModal from "../SprintFormModal";
import BacklogIssueRow, {
	BacklogIssueRowBody,
	type MoveTarget,
} from "./BacklogIssueRow";
import BacklogSection from "./BacklogSection";

/** Droppable id of the unscheduled section (sprint ids are UUIDs). */
const BACKLOG_SECTION_ID = "backlog";

const PRIORITY_ORDER = Object.fromEntries(
	ISSUE_PRIORITIES.map((p, i) => [p.value, i]),
);

/**
 * Most urgent first, then lowest number first. Sprint membership is all a move
 * changes: `rank` orders board lanes, not backlog sections, so there's no
 * stored manual order to show here.
 */
const byPriorityThenNumber = (a: Issue, b: Issue) =>
	PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
	a.number - b.number;

/**
 * A section's rows in display order: {@link byPriorityThenNumber}, except that
 * a sub-issue sits right under its parent when both are in the section.
 */
function orderSection(issues: Issue[]): Issue[] {
	const sorted = [...issues].sort(byPriorityThenNumber);
	const ids = new Set(sorted.map((i) => i.id));
	const childrenOf = new Map<string, Issue[]>();
	for (const issue of sorted) {
		if (issue.parentIssueId && ids.has(issue.parentIssueId)) {
			const siblings = childrenOf.get(issue.parentIssueId) ?? [];
			siblings.push(issue);
			childrenOf.set(issue.parentIssueId, siblings);
		}
	}
	return sorted
		.filter((i) => !(i.parentIssueId && ids.has(i.parentIssueId)))
		.flatMap((i) => [i, ...(childrenOf.get(i.id) ?? [])]);
}

interface Section {
	id: string;
	title: string;
	sprint?: Sprint;
	issues: Issue[];
}

/**
 * Sprint planning, Jira-style: the active sprint, then planned sprints, then
 * the unscheduled backlog. Issues move between them by drag or the row's ⋯
 * menu (a `sprintId` PATCH); sprints are created, edited, started and
 * completed from the section headers. Completed sprints aren't shown.
 */
export default function BacklogView({ projectId }: { projectId: string }) {
	const { activeWorkspaceId } = useWorkspace();
	const workspaceId = activeWorkspaceId ?? "";
	const permissions = useWorkspacePermissions();
	const { canManageSprints } = permissions;
	// Moving an issue between sprints writes its `sprintId`, a content field:
	// whether the viewer may is decided per issue (`canEditIssue`).
	const canPlanAnyIssue =
		permissions.canEditAnyIssue || permissions.canEditOwnIssues;

	const { data: projects } = useProjects(workspaceId);
	const project = projects?.find((p) => p.id === projectId);
	const { data: members = [] } = useMemberships(workspaceId);
	const sprintsQuery = useSprints(workspaceId, projectId);
	const issuesQuery = useIssues(workspaceId, projectId);
	const { mutate: updateIssue } = useUpdateIssue(workspaceId, projectId);
	const sprintActions = useSprintActions(workspaceId, projectId);

	const [isCreateIssueOpen, createIssueModal] = useBoolean();
	const [isCreateSprintOpen, createSprintModal] = useBoolean();
	const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
	const [endingSprint, setEndingSprint] = useState<Sprint | null>(null);
	const [draggedId, setDraggedId] = useState<string | null>(null);

	const sections = useMemo<Section[]>(() => {
		const open = (sprintsQuery.data ?? [])
			.filter((s) => !s.completedAt)
			// Active first, then planned in creation order.
			.sort(
				(a, b) =>
					Number(b.isActive) - Number(a.isActive) ||
					a.createdAt.localeCompare(b.createdAt),
			);
		const openIds = new Set(open.map((s) => s.id));
		const issues = issuesQuery.data ?? [];

		return [
			...open.map((sprint) => ({
				id: sprint.id,
				title: sprint.name,
				sprint,
				issues: orderSection(
					issues.filter((i) => i.sprintId === sprint.id),
				),
			})),
			{
				id: BACKLOG_SECTION_ID,
				title: "Backlog",
				// Unscheduled work; finished issues stay out of the way. (Done
				// issues of a completed sprint keep that sprint's id.)
				issues: orderSection(
					issues.filter(
						(i) =>
							i.status.category !== "COMPLETED" &&
							!(i.sprintId && openIds.has(i.sprintId)),
					),
				),
			},
		];
	}, [sprintsQuery.data, issuesQuery.data]);

	const hasActiveSprint = sections.some((s) => s.sprint?.isActive);

	const assigneeNames = useMemo(() => {
		const map = new Map<string, string>();
		for (const m of members) {
			if (m.user) map.set(m.userId, getMemberName(m));
		}
		return map;
	}, [members]);
	const assigneeOf = (issue: Issue) =>
		issue.assigneeId ? assigneeNames.get(issue.assigneeId) : undefined;

	const sensors = useSensors(
		// A small threshold so clicking the title link or ⋯ isn't a drag.
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
		useSensor(KeyboardSensor),
	);

	const handleMove = (issue: Issue, targetId: string) => {
		const target = sections.find((s) => s.id === targetId);
		if (!target) return;
		const sprintId = target.sprint?.id ?? null;
		if ((issue.sprintId ?? null) === sprintId) return;

		updateIssue(
			{ issueId: issue.id, dto: { sprintId } },
			{
				onSuccess: () => toast.success(`Moved to ${target.title}`),
				onError: (error) =>
					toast.danger(getApiErrorMessage(error, "Failed to move issue")),
			},
		);
	};

	const handleDragStart = ({ active }: DragStartEvent) =>
		setDraggedId(String(active.id));

	const handleDragEnd = ({ active, over }: DragEndEvent) => {
		setDraggedId(null);
		const issue = issuesQuery.data?.find((i) => i.id === active.id);
		if (issue && over) handleMove(issue, String(over.id));
	};

	const draggedIssue = draggedId
		? issuesQuery.data?.find((i) => i.id === draggedId)
		: undefined;

	const sprintHeader = (sprint: Sprint) => {
		const start = formatSprintDay(sprint.startDate, "dd MMM");
		const end = formatSprintDay(sprint.endDate, "dd MMM");
		return {
			meta: (
				<>
					{sprint.isActive && (
						<Chip size="sm" color="success" variant="soft">
							Active
						</Chip>
					)}
					{(start || end) && (
						<span>
							{start ?? "—"} – {end ?? "—"}
						</span>
					)}
				</>
			),
			actions: canManageSprints && (
				<>
					{sprint.isActive ? (
						<Button
							size="sm"
							variant="outline"
							onPress={() => setEndingSprint(sprint)}
						>
							<Square className="h-3.5 w-3.5" />
							Complete sprint
						</Button>
					) : (
						// The span carries the "why is this greyed out" hint: the
						// Button doesn't forward `title`, and a disabled button
						// swallows hover anyway.
						<span
							title={
								hasActiveSprint
									? "Complete the active sprint first"
									: undefined
							}
						>
							<Button
								size="sm"
								variant="outline"
								isDisabled={
									hasActiveSprint ||
									sprintActions.startingSprintId === sprint.id
								}
								onPress={() => sprintActions.startSprint(sprint)}
							>
								<Play className="h-3.5 w-3.5" />
								{sprintActions.startingSprintId === sprint.id
									? "Starting…"
									: "Start sprint"}
							</Button>
						</span>
					)}
					<Button
						isIconOnly
						size="sm"
						variant="ghost"
						aria-label={`Edit ${sprint.name}`}
						onPress={() => setEditingSprint(sprint)}
					>
						<Pencil className="h-4 w-4" />
					</Button>
				</>
			),
		};
	};

	const body = () => {
		if (sprintsQuery.isError || issuesQuery.isError) {
			return (
				<ErrorAlert
					title="Couldn’t load the backlog"
					description="Check your connection and try again."
					onRetry={() => {
						sprintsQuery.refetch();
						issuesQuery.refetch();
					}}
				/>
			);
		}
		if (sprintsQuery.isLoading || issuesQuery.isLoading) {
			return (
				<div className="flex items-center gap-2 py-12 text-muted">
					<Spinner size="sm" />
					Loading backlog…
				</div>
			);
		}

		return (
			<DndContext
				sensors={sensors}
				collisionDetection={pointerWithin}
				onDragStart={handleDragStart}
				onDragEnd={handleDragEnd}
				onDragCancel={() => setDraggedId(null)}
			>
				<div className="flex flex-col gap-4">
					{sections.map((section) => {
						const header = section.sprint
							? sprintHeader(section.sprint)
							: {
									meta: null,
									actions: canManageSprints && (
										<Button
											size="sm"
											variant="outline"
											onPress={createSprintModal.setTrue}
										>
											<Plus className="h-3.5 w-3.5" />
											Create sprint
										</Button>
									),
								};
						const moveTargets: MoveTarget[] = canPlanAnyIssue
							? sections
									.filter((s) => s.id !== section.id)
									.map((s) => ({ id: s.id, label: s.title }))
							: [];

						return (
							<BacklogSection
								key={section.id}
								id={section.id}
								title={section.title}
								meta={header.meta}
								actions={header.actions}
								issues={section.issues}
								emptyText={
									section.sprint
										? canPlanAnyIssue
											? "Drag issues here from the backlog, or use an issue’s ⋯ menu."
											: "No issues in this sprint yet."
										: "Nothing unscheduled. New issues without a sprint land here."
								}
							>
								{section.issues.map((issue) => (
									<BacklogIssueRow
										key={issue.id}
										issue={issue}
										sectionId={section.id}
										assigneeName={assigneeOf(issue)}
										moveTargets={
											canEditIssue(permissions, issue) ? moveTargets : []
										}
										onMove={handleMove}
									/>
								))}
							</BacklogSection>
						);
					})}
				</div>

				<DragOverlay>
					{draggedIssue && (
						<div className="overflow-hidden rounded-md border border-accent shadow-lg">
							<BacklogIssueRowBody
								issue={draggedIssue}
								assigneeName={assigneeOf(draggedIssue)}
							/>
						</div>
					)}
				</DragOverlay>
			</DndContext>
		);
	};

	return (
		<div className="flex flex-col gap-6">
			<ProjectHeader
				projectId={projectId}
				project={project}
				active="backlog"
				actions={
					permissions.canCreateIssue && (
						<Button onPress={createIssueModal.setTrue}>
							<Plus className="h-4 w-4" />
							New Issue
						</Button>
					)
				}
			/>

			{body()}

			<CreateIssueModal
				isOpen={isCreateIssueOpen}
				onOpenChange={createIssueModal.setFalse}
				members={members}
				projectId={projectId}
			/>
			<SprintFormModal
				isOpen={isCreateSprintOpen}
				closeModal={createSprintModal.setFalse}
				onSubmit={sprintActions.createSprint}
				isSubmitting={sprintActions.isCreating}
			/>
			<SprintFormModal
				isOpen={!!editingSprint}
				closeModal={() => setEditingSprint(null)}
				onSubmit={(values) =>
					editingSprint
						? sprintActions.updateSprint(editingSprint, values)
						: false
				}
				isSubmitting={sprintActions.isUpdating}
				defaultValues={
					editingSprint && {
						name: editingSprint.name,
						goal: editingSprint.goal ?? "",
						startDate: fromISO(editingSprint.startDate),
						endDate: fromISO(editingSprint.endDate),
					}
				}
			/>
			<EndSprintModal
				workspaceId={workspaceId}
				projectId={projectId}
				sprint={endingSprint}
				onClose={() => setEndingSprint(null)}
			/>
		</div>
	);
}
