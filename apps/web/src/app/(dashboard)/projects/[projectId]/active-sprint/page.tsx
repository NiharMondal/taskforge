import type { Metadata } from "next";

import BoardView from "@/features/issues/components/board/BoardView";

export const metadata: Metadata = { title: "Active sprint" };

/**
 * The active sprint's board: `/projects/[projectId]/active-sprint`. The view is a
 * client component (drag state and queries live there).
 * A server page so it can set the tab title.
 */
export default async function ProjectActiveSprintPage({
	params,
}: PageProps<"/projects/[projectId]/active-sprint">) {
	const { projectId } = await params;
	return <BoardView projectId={projectId} />;
}
