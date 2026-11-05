import type { Metadata } from "next";

import BacklogView from "@/features/sprint/components/backlog/BacklogView";

export const metadata: Metadata = { title: "Backlog" };

/**
 * Sprint planning: `/projects/[projectId]/backlog`. The view renders its own
 * project header (it owns the New Issue action), like the board and list.
 * A server page so it can set the tab title.
 */
export default async function ProjectBacklogPage({
	params,
}: PageProps<"/projects/[projectId]/backlog">) {
	const { projectId } = await params;
	return <BacklogView projectId={projectId} />;
}
