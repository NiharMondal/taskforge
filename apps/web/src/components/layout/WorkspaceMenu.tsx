"use client";

import {
	cn,
	DropdownItem,
	DropdownMenu,
	DropdownPopover,
	DropdownRoot,
	DropdownSection,
	DropdownTrigger,
	Header,
	Separator,
	Spinner,
} from "@heroui/react";
import { useBoolean } from "ahooks";
import { Check, ChevronsUpDown, LogOut, Plus } from "lucide-react";
import { signOut } from "next-auth/react";

import { ProBadge } from "@/features/billing/components/ProBadge";
import { PLAN_META } from "@/features/billing/constants";
import CreateWorkspaceModal from "@/features/workspace/components/CreateWorkspaceModal";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import type { Workspace } from "@/features/workspace/types/workspace-types";

const NEW_WORKSPACE = "action:new-workspace";
const SIGN_OUT = "action:sign-out";

/** The workspace's first letter on a tinted square, like an org logo. */
function WorkspaceTile({
	name,
	className,
}: {
	name: string;
	className?: string;
}) {
	return (
		<span
			aria-hidden
			className={cn(
				"flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-sm font-semibold text-accent",
				className,
			)}
		>
			{name.trim().charAt(0).toUpperCase() || "?"}
		</span>
	);
}

const planLabel = (workspace: Workspace | undefined) =>
	`${PLAN_META[workspace?.plan ?? "FREE"].name} plan`;

/**
 * The sidebar footer: the active workspace as a card (tile, name, plan) that
 * opens a menu upward — switch workspace, create one, sign out. Logic lives in
 * `useWorkspace()`; switching is just `setActiveWorkspaceId`.
 */
export default function WorkspaceMenu() {
	const {
		workspaces,
		activeWorkspace,
		activeWorkspaceId,
		setActiveWorkspaceId,
		isLoading,
		isError,
	} = useWorkspace();
	const [isCreating, { setTrue: openCreate, setFalse: closeCreate }] =
		useBoolean();

	const onAction = (key: React.Key) => {
		if (key === NEW_WORKSPACE) openCreate();
		// To the public site; a session that expires instead goes to /login
		// (auth-provider), since that user wants to sign back in.
		else if (key === SIGN_OUT) void signOut({ callbackUrl: "/" });
		else setActiveWorkspaceId(String(key));
	};

	return (
		<>
			<DropdownRoot>
				<DropdownTrigger
					aria-label="Workspace menu"
					isDisabled={isLoading}
					className={cn(
						"flex w-full items-center gap-3 rounded-xl p-2 text-start transition-colors",
						"hover:bg-surface-secondary data-[pressed=true]:bg-surface-secondary",
						"focus-visible:ring-2 focus-visible:ring-accent",
					)}
				>
					{isLoading ? (
						<span className="flex size-8 items-center justify-center">
							<Spinner size="sm" />
						</span>
					) : (
						<WorkspaceTile name={activeWorkspace?.name ?? "?"} />
					)}
					<span className="flex min-w-0 flex-1 flex-col">
						<span className="truncate text-sm font-medium text-foreground">
							{isLoading
								? "Loading workspaces…"
								: isError
									? "Couldn’t load workspaces"
									: (activeWorkspace?.name ?? "No workspace")}
						</span>
						{activeWorkspace && (
							<span className="truncate text-xs text-muted">
								{planLabel(activeWorkspace)}
							</span>
						)}
					</span>
					<ChevronsUpDown className="size-4 shrink-0 text-muted" aria-hidden />
				</DropdownTrigger>

				<DropdownPopover
					placement="top start"
					className="w-(--trigger-width) min-w-60"
				>
					<DropdownMenu aria-label="Workspace menu" onAction={onAction}>
						<DropdownSection>
							<Header className="px-2 pt-1 pb-1.5 text-xs font-medium text-muted">
								Workspaces
							</Header>
							{workspaces.map((workspace) => (
								<DropdownItem
									key={workspace.id}
									id={workspace.id}
									textValue={workspace.name}
								>
									<span className="flex w-full min-w-0 items-center gap-2.5">
										<WorkspaceTile name={workspace.name} className="size-6 rounded-md text-xs" />
										<span className="min-w-0 flex-1 truncate">
											{workspace.name}
										</span>
										<ProBadge plan={workspace.plan} />
										<Check
											aria-hidden
											className={cn(
												"size-4 shrink-0 text-accent",
												workspace.id !== activeWorkspaceId && "invisible",
											)}
										/>
									</span>
								</DropdownItem>
							))}
						</DropdownSection>
						<Separator className="my-1" />
						<DropdownItem id={NEW_WORKSPACE} textValue="New workspace">
							<span className="flex items-center gap-2.5">
								<Plus className="size-4 text-muted" aria-hidden />
								New workspace
							</span>
						</DropdownItem>
						<DropdownItem id={SIGN_OUT} textValue="Sign out" variant="danger">
							<span className="flex items-center gap-2.5">
								<LogOut className="size-4" aria-hidden />
								Sign out
							</span>
						</DropdownItem>
					</DropdownMenu>
				</DropdownPopover>
			</DropdownRoot>

			<CreateWorkspaceModal isOpen={isCreating} onClose={closeCreate} />
		</>
	);
}
