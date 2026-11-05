"use client";

import { use } from "react";

import WorkflowEditor from "@/features/workflow/components/WorkflowEditor";

/**
 * A project's workflow: `/projects/[projectId]/workflow`. Statuses and the
 * moves between them; editable with `project:manage` on Pro.
 */
export default function ProjectWorkflowPage({
	params,
}: PageProps<"/projects/[projectId]/workflow">) {
	const { projectId } = use(params);
	return <WorkflowEditor projectId={projectId} />;
}
