"use client";

import { cn } from "@heroui/react";

import { useProjects } from "@/features/projects/hooks/use-projects";
import { useWorkspace } from "@/features/workspace/context/workspace-context";

import type { Issue } from "../types/issue-types";

/**
 * An issue's human-readable key, e.g. `WA-12`: the project key plus the
 * issue's per-project number. The key comes from the cached projects list
 * (every project page already loads it), so rows don't need it passed down.
 */
export default function IssueKey({
	issue,
	className,
}: {
	issue: Pick<Issue, "projectId" | "number">;
	className?: string;
}) {
	const { activeWorkspaceId } = useWorkspace();
	const { data: projects } = useProjects(activeWorkspaceId ?? "");
	const projectKey = projects?.find((p) => p.id === issue.projectId)?.key;

	return (
		<span
			className={cn(
				"shrink-0 font-mono text-xs text-muted tabular-nums",
				className,
			)}
		>
			{projectKey ? `${projectKey}-${issue.number}` : `#${issue.number}`}
		</span>
	);
}
