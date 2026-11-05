"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@heroui/react";

import { useWorkspacePermissions } from "@/features/memberships/hooks/use-workspace-permissions";
import { useWorkspace } from "@/features/workspace/context/workspace-context";

import { SETTINGS_TABS } from "../constants";

/**
 * Settings header + tab navigation. The tabs are real route links (not local
 * state) so each section is deep-linkable and the active tab survives reloads.
 * Active styling uses semantic tokens only (see globals.css). A tab with
 * `requires` shows only when the viewer holds that permission flag.
 */
export default function SettingsNav() {
	const pathname = usePathname();
	const { activeWorkspace } = useWorkspace();
	const permissions = useWorkspacePermissions();
	const tabs = SETTINGS_TABS.filter(
		(tab) => !tab.requires || permissions[tab.requires],
	);

	return (
		<div className="flex flex-col gap-6">
			<header>
				<h1 className="text-2xl font-semibold">Settings</h1>
				<p className="mt-1 text-sm text-muted">
					{activeWorkspace
						? `Manage ${activeWorkspace.name} and its members.`
						: "Pick a workspace from the sidebar to get started."}
				</p>
			</header>

			<nav className="flex gap-1 border-b border-border">
				{tabs.map((tab) => {
					const isActive =
						pathname === tab.href ||
						pathname.startsWith(`${tab.href}/`);

					return (
						<Link
							key={tab.href}
							href={tab.href}
							aria-current={isActive ? "page" : undefined}
							className={cn(
								"-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
								isActive
									? "border-accent text-foreground"
									: "border-transparent text-muted hover:text-foreground",
							)}
						>
							<tab.icon className="size-4 shrink-0" aria-hidden />
							{tab.label}
						</Link>
					);
				})}
			</nav>
		</div>
	);
}
