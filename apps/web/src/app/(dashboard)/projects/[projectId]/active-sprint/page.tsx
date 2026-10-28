"use client";

import { use } from "react";

import BoardView from "@/features/issues/components/board/BoardView";

/**
 * The active sprint's board: `/projects/[projectId]/active-sprint`.
 *
 * Client component (drag state + queries live in the view), so the Next 16
 * `params` Promise is unwrapped with React's `use()` rather than `await`.
 */
export default function ProjectActiveSprintPage({
  params,
}: PageProps<"/projects/[projectId]/active-sprint">) {
  const { projectId } = use(params);
  return <BoardView projectId={projectId} />;
}
