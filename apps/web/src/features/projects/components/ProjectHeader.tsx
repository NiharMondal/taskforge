"use client";

import type { ReactNode } from "react";

import { cn } from "@heroui/react";
import { Settings, type LucideIcon } from "lucide-react";
import Link from "next/link";

import Breadcrumbs from "@/components/ui/breadcrumbs";

import type { Project } from "../types/project-types";

type ProjectTab = "issues" | "board" | "sprint" | "settings";

interface ProjectHeaderProps {
	projectId: string;
	project?: Project;
	active: ProjectTab;
	/** Right-aligned page action (e.g. the "New Issue" button). */
	actions?: ReactNode;
}

/**
 * Shared chrome for project-scoped pages: breadcrumbs, project identity, and
 * the Board/Issues/Current Sprint/Settings tab bar. Lives here (not in a route layout) so each page keeps
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
		icon?: LucideIcon;
	}[] = [
		{ key: "board", label: "Board", href: `/projects/${projectId}/board` },
		{
			key: "issues",
			label: "Issues",
			href: `/projects/${projectId}/issues`,
		},
		{
			key: "sprint",
			label: "Current Sprint",
			href: `/projects/${projectId}/sprint`,
		},
		// Pushed to the far right: configuration, not a working view.
		{
			key: "settings",
			label: "Settings",
			href: `/projects/${projectId}/settings`,
			icon: Settings,
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
						href: `/projects/${projectId}/board`,
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
							tab.key === "settings" && "ml-auto",
							tab.key === active
								? "border-accent text-foreground"
								: "border-transparent text-muted hover:text-foreground",
						)}
					>
						{tab.icon && (
							<tab.icon className="size-4 shrink-0" aria-hidden />
						)}
						{tab.label}
					</Link>
				))}
			</nav>
		</div>
	);
}
