"use client";

import type { ReactNode } from "react";

import { cn } from "@heroui/react";
import { Settings } from "lucide-react";
import Link from "next/link";

import Breadcrumbs from "@/components/ui/breadcrumbs";

import type { Project } from "../types/project-types";

type ProjectTab = "list" | "backlog" | "activeSprint" | "workflow";

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
 * sprint, the backlog plans sprints, the list is every issue) plus the
 * project's workflow (its statuses and moves). Lives here (not in a route layout) so each page keeps
 * ownership of its own action button while sharing identical navigation.
 */
export default function ProjectHeader({
	projectId,
	project,
	active,
	actions,
}: ProjectHeaderProps) {
	const tabs: {
		key: ProjectTab;
		label: string;
		href: string;
		icon?: ReactNode;
		/** Pushed to the right edge of the tab bar (project configuration, not a view). */
		trailing?: boolean;
	}[] = [
		{ key: "activeSprint", label: "Active Sprint", href: `/projects/${projectId}/active-sprint` },
		{
			key: "backlog",
			label: "Backlog",
			href: `/projects/${projectId}/backlog`,
		},
		{ key: "list", label: "List", href: `/projects/${projectId}/list` },
		{
			key: "workflow",
			label: "Workflow",
			href: `/projects/${projectId}/workflow`,
			icon: <Settings className="size-4" />,
			trailing: true,
		},
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
							"-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
							tab.trailing && "ml-auto",
							tab.key === active
								? "border-accent text-foreground"
								: "border-transparent text-muted hover:text-foreground",
						)}
					>
						{tab.icon}
						{tab.label}
					</Link>
				))}
			</nav>
		</div>
	);
}
