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
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Alert, Button, Spinner } from "@heroui/react";
import { Plus } from "lucide-react";

import { useMemberships } from "@/features/memberships/hooks/use-memberships";
import ProjectHeader from "@/features/projects/components/ProjectHeader";
import { useProjects } from "@/features/projects/hooks/use-projects";
import { useWorkspace } from "@/features/workspace/context/workspace-context";

import { ISSUE_STATUSES } from "../../constants";
import {
  useCreateIssue,
  useIssues,
  useUpdateIssue,
} from "../../hooks/use-issues";
import { compareIssueRank, rankBetween } from "../../lib/rank";
import type { CreateIssueDto, Issue, IssueStatus } from "../../types/issue-types";
import CreateIssueModal from "../CreateIssueModal";
import IssueDetailModal from "../IssueDetailModal";
import BoardColumn from "./BoardColumn";
import IssueCardBody from "./IssueCardBody";

type Columns = Record<IssueStatus, Issue[]>;

/**
 * Bucket a flat issue list into one array per status (empty columns included),
 * each lane sorted by fractional rank so order matches what was persisted.
 */
function groupByStatus(issues: Issue[]): Columns {
  const columns = Object.fromEntries(
    ISSUE_STATUSES.map((s) => [s.value, [] as Issue[]]),
  ) as Columns;
  for (const issue of issues) {
    columns[issue.status]?.push(issue);
  }
  for (const status of Object.keys(columns) as IssueStatus[]) {
    columns[status].sort(compareIssueRank);
  }
  return columns;
}

/**
 * Kanban board. Columns are status lanes; dragging a card to another lane
 * persists the new status via an optimistic PATCH ({@link useUpdateIssue}).
 *
 * Within-lane ordering is local-only and resets on refetch: the `Issue` model
 * has no `rank`/order field, so there's nothing to persist position to. Add a
 * backend rank before promising durable ordering.
 */
export default function BoardView({ projectId }: { projectId: string }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { activeWorkspaceId } = useWorkspace();
  const workspaceId = activeWorkspaceId ?? "";

  const { data: projects = [] } = useProjects(workspaceId);
  const project = projects.find((p) => p.id === projectId);

  const { data: members = [] } = useMemberships(workspaceId);
  const {
    data: issues = [],
    isLoading,
    isError,
  } = useIssues(workspaceId, projectId);

  const { mutateAsync: createIssue, isPending } = useCreateIssue(
    workspaceId,
    projectId,
  );
  const { mutate: updateIssue } = useUpdateIssue(workspaceId, projectId);

  // Local mirror of the columns so cards can move live during a drag. Resynced
  // by comparing against the previous server list *during render* (React's
  // recommended alternative to a sync effect): when the query data changes
  // — including the optimistic write on drop — regroup. Drags don't trigger a
  // refetch, so an in-progress drag is never clobbered mid-move.
  const [columns, setColumns] = useState<Columns>(() => groupByStatus(issues));
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
      if (m.user) map.set(m.userId, m.user.name || m.user.email);
    }
    return map;
  }, [members]);

  const sensors = useSensors(
    // A small drag threshold so clicks (future: open issue) aren't swallowed.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeIssue = useMemo(() => {
    if (!activeId) return null;
    for (const { value } of ISSUE_STATUSES) {
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

    // Compute the final lane order, then derive the dragged card's new rank
    // from its neighbors in that order. We capture both out of the (otherwise
    // pure) updater so the persisted rank matches exactly what's rendered.
    let newRank: string | undefined;
    let positionChanged = false;

    setColumns((prev) => {
      const items = prev[container];
      const oldIndex = items.findIndex((i) => i.id === activeId);
      const overIndex = items.findIndex((i) => i.id === String(over.id));
      const newIndex = overIndex === -1 ? items.length - 1 : overIndex;
      const ordered =
        oldIndex !== -1 && oldIndex !== newIndex
          ? arrayMove(items, oldIndex, newIndex)
          : items;

      const idx = ordered.findIndex((i) => i.id === activeId);
      const prevRank = idx > 0 ? ordered[idx - 1].rank : null;
      const nextRank = idx < ordered.length - 1 ? ordered[idx + 1].rank : null;
      newRank = rankBetween(prevRank, nextRank);
      positionChanged = oldIndex !== newIndex;

      return { ...prev, [container]: ordered };
    });

    // Persist when the card changed lane and/or position. Always send the new
    // status; include rank when we could compute one.
    const laneChanged = !!from && from !== container;
    if (laneChanged || positionChanged) {
      updateIssue({
        issueId: activeId,
        dto: { status: container, ...(newRank && { rank: newRank }) },
      });
    }
  };

  const handleCreate = async (dto: CreateIssueDto) => {
    await createIssue(dto);
  };

  return (
    <div className="flex flex-col gap-6">
      <ProjectHeader
        projectId={projectId}
        project={project}
        active="board"
        actions={
          <Button onPress={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4" />
            New Issue
          </Button>
        }
      />

      {isError ? (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Couldn’t load the board</Alert.Title>
            <Alert.Description>
              Check your connection and try again.
            </Alert.Description>
          </Alert.Content>
        </Alert>
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
            {ISSUE_STATUSES.map(({ value, label }) => (
              <BoardColumn
                key={value}
                status={value}
                label={label}
                issues={columns[value]}
                assigneeNames={assigneeNames}
                onOpenIssue={setSelectedIssue}
              />
            ))}
          </div>

          <DragOverlay>
            {activeIssue ? (
              <IssueCardBody
                issue={activeIssue}
                assigneeName={
                  activeIssue.assigneeId
                    ? assigneeNames.get(activeIssue.assigneeId)
                    : undefined
                }
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <CreateIssueModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSubmit={handleCreate}
        members={members}
        isLoading={isPending}
      />

      <IssueDetailModal
        issue={selectedIssue}
        onClose={() => setSelectedIssue(null)}
        members={members}
        workspaceId={workspaceId}
        projectId={projectId}
      />
    </div>
  );
}
