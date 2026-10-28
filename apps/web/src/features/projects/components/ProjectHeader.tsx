"use client";

import type { ReactNode } from "react";

import { cn } from "@heroui/react";
import Link from "next/link";

import Breadcrumbs from "@/components/ui/breadcrumbs";

import type { Project } from "../types/project-types";

type ProjectTab = "list" | "backlog" | "activeSprint";

interface ProjectHeaderProps {
	projectId: string;
	project?: Project;
	active: ProjectTab;
	/** Right-aligned page action (e.g. the "New Issue" button). */
	actions?: ReactNode;
}

/**
 * Shared chrome for project-scoped pages: breadcrumbs, project identity, and
 * the Board/Backlog/List tab bar (Jira's Scrum layout: the board is the active
 * sprint, the backlog plans sprints, the list is every issue). Lives here (not in a route layout) so each page keeps
 * ownership of its own action button while sharing identical navigation.
 */
export default function ProjectHeader({
	projectId,
	project,
	active,
	actions,
}: ProjectHeaderProps) {
	const tabs: { key: ProjectTab; label: string; href: string }[] = [
		{ key: "activeSprint", label: "Active Sprint", href: `/projects/${projectId}/active-sprint` },
		{
			key: "backlog",
			label: "Backlog",
			href: `/projects/${projectId}/backlog`,
		},
		{ key: "list", label: "List", href: `/projects/${projectId}/list` },
	];
	const activeTab = tabs.find((tab) => tab.key === active);

	return (
		<div className="flex flex-col gap-4">
			<Breadcrumbs
				items={[
					{ label: "Projects", href: "/projects" },
					{
						label: project?.name ?? "Project",
						href: `/projects/${projectId}/active-sprint`,
					},
					{ label: activeTab?.label ?? "" },
				]}
			/>

			<div className="flex items-center justify-between gap-4">
				<h1 className="text-2xl font-semibold">
					{project?.name ?? "Project"}
				</h1>
				{actions}
			</div>

			<nav className="flex gap-1 border-b border-border">
				{tabs.map((tab) => (
					<Link
						key={tab.key}
						href={tab.href}
						aria-current={tab.key === active ? "page" : undefined}
						className={cn(
							"-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
							tab.key === active
								? "border-accent text-foreground"
								: "border-transparent text-muted hover:text-foreground",
						)}
					>
						{tab.label}
					</Link>
				))}
			</nav>
		</div>
	);
}
