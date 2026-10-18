"use client";

import { useRef } from "react";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { Issue } from "../../types/issue-types";
import IssueCardBody from "./IssueCardBody";

/** Max pointer travel (px) still counted as a click rather than a drag. */
const CLICK_SLOP = 5;

/**
 * A draggable/sortable board card. The original is dimmed while dragging — the
 * full-opacity copy that follows the cursor is rendered by the DragOverlay in
 * {@link BoardView}.
 *
 * dnd-kit doesn't suppress the native click that follows a drag, so we record
 * the pointer-down position and only treat a release as a "click" (→ open the
 * issue) when the pointer barely moved.
 */
export default function BoardIssueCard({
  issue,
  assigneeName,
  onOpen,
  canDrag,
}: {
  issue: Issue;
  assigneeName?: string;
  onOpen: (issue: Issue) => void;
  /** False leaves the card clickable but not draggable (VIEWER). */
  canDrag: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: issue.id,
    data: { status: issue.status },
    disabled: !canDrag,
  });

  const downAt = useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      // `touch-none` is only needed while draggable; without it a read-only
      // board still scrolls under a finger.
      className={
        canDrag
          ? "cursor-grab touch-none active:cursor-grabbing"
          : "cursor-pointer"
      }
      {...attributes}
      {...listeners}
      onPointerDown={(e) => {
        downAt.current = { x: e.clientX, y: e.clientY };
        listeners?.onPointerDown?.(e);
      }}
      onClick={(e) => {
        const start = downAt.current;
        if (
          start &&
          Math.hypot(e.clientX - start.x, e.clientY - start.y) < CLICK_SLOP
        ) {
          onOpen(issue);
        }
      }}
    >
      <IssueCardBody issue={issue} assigneeName={assigneeName} />
    </div>
  );
}
