"use client";

import { use } from "react";

import BacklogView from "@/features/sprint/components/backlog/BacklogView";

/**
 * Sprint planning: `/projects/[projectId]/backlog`. The view renders its own
 * project header (it owns the New Issue action), like the board and list.
 */
export default function ProjectBacklogPage({
	params,
}: PageProps<"/projects/[projectId]/backlog">) {
	const { projectId } = use(params);
	return <BacklogView projectId={projectId} />;
}
