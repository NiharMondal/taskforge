"use client";

import { ListBox, Select, Spinner } from "@heroui/react";

import { useWorkspace } from "@/features/workspace/context/workspace-context";

/**
 * Workspace switcher. Renders the user's workspaces in a HeroUI `Select`
 * (HeroUI 3.x compound API, react-aria based) and writes the selection back to
 * the workspace context. Dumb component — all logic lives in `useWorkspace()`.
 */
export default function WorkspaceSwitcher() {
	const {
		workspaces,
		activeWorkspaceId,
		setActiveWorkspaceId,
		isLoading,
		isError,
	} = useWorkspace();

	if (isLoading) {
		return (
			<div className="flex h-10 items-center gap-2 px-1 text-sm text-muted">
				<Spinner size="sm" />
				Loading workspaces…
			</div>
		);
	}

	if (isError || workspaces.length === 0) {
		return (
			<p className="px-1 text-sm text-muted">
				{isError ? "Couldn’t load workspaces" : "No workspaces yet"}
			</p>
		);
	}

	return (
		<Select
			aria-label="Switch workspace"
			value={activeWorkspaceId}
			onChange={(key) => {
				if (key != null) setActiveWorkspaceId(String(key));
			}}
			fullWidth
		>
			<Select.Trigger>
				<Select.Value />
				<Select.Indicator />
			</Select.Trigger>
			<Select.Popover>
				<ListBox>
					{workspaces.map((ws) => (
						<ListBox.Item
							key={ws.id}
							id={ws.id}
							textValue={ws.name}
						>
							{ws.name}
							<ListBox.ItemIndicator />
						</ListBox.Item>
					))}
				</ListBox>
			</Select.Popover>
		</Select>
	);
}
