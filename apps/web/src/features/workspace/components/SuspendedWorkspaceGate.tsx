"use client";

import { Button, Card, CardContent } from "@heroui/react";
import { Ban } from "lucide-react";

import { useWorkspace } from "../context/workspace-context";

/**
 * The dashboard's pages, unless the active workspace is suspended by platform
 * staff (`GET /workspaces` says so): then every page of it would only fail
 * with a 403 `WORKSPACE_SUSPENDED`, so this explains instead and offers the
 * user's other workspaces. The sidebar stays, and with it the workspace menu.
 * The staff's reason is never shown; it is an internal note.
 */
export default function SuspendedWorkspaceGate({
	children,
}: {
	children: React.ReactNode;
}) {
	const { activeWorkspace, workspaces, setActiveWorkspaceId } = useWorkspace();

	if (!activeWorkspace?.suspended) return <>{children}</>;

	const others = workspaces.filter((w) => !w.suspended);

	return (
		<div className="mx-auto flex max-w-lg flex-col gap-4 pt-10">
			<Card>
				<CardContent className="flex flex-col items-center gap-3 py-8 text-center">
					<Ban className="size-8 text-danger" aria-hidden />
					<h1 className="text-lg font-semibold">
						{activeWorkspace.name} is suspended
					</h1>
					<p className="max-w-sm text-sm text-muted">
						Our team has suspended this workspace, so nobody can open its
						projects, members or settings for now. Contact support if you
						think this is a mistake.
					</p>
					{others.length > 0 ? (
						<div className="mt-2 flex w-full flex-col gap-2">
							<p className="text-xs text-muted">Switch to another workspace</p>
							{others.map((workspace) => (
								<Button
									key={workspace.id}
									variant="outline"
									className="w-full"
									onPress={() => setActiveWorkspaceId(workspace.id)}
								>
									{workspace.name}
								</Button>
							))}
						</div>
					) : (
						<p className="text-xs text-muted">
							You can create a new workspace from the workspace menu.
						</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
