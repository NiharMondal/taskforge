"use client";

import { use } from "react";

import BoardView from "@/features/issues/components/board/BoardView";

/**
 * Project-scoped Kanban board: `/projects/[projectId]/board`.
 *
 * Client component (drag state + queries live in the view), so the Next 16
 * `params` Promise is unwrapped with React's `use()` rather than `await`.
 */
export default function ProjectBoardPage({
  params,
}: PageProps<"/projects/[projectId]/board">) {
  const { projectId } = use(params);
  return <BoardView projectId={projectId} />;
}
