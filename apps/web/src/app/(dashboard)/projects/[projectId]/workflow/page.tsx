import type { Metadata } from "next";

import WorkflowEditor from "@/features/workflow/components/WorkflowEditor";

export const metadata: Metadata = { title: "Workflow" };

/**
 * A project's workflow: `/projects/[projectId]/workflow`. Statuses and the
 * moves between them; editable with `project:manage` on Pro.
 * A server page so it can set the tab title.
 */
export default async function ProjectWorkflowPage({
	params,
}: PageProps<"/projects/[projectId]/workflow">) {
	const { projectId } = await params;
	return <WorkflowEditor projectId={projectId} />;
}
