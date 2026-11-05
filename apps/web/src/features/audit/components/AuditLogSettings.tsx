"use client";

import { useState } from "react";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	cn,
	Pagination,
	Spinner,
	Table,
} from "@heroui/react";
import { CircleUserRound, Cog, Lock } from "lucide-react";

import Avatar from "@/components/ui/avatar";
import ErrorAlert from "@/components/ui/error-alert";
import { useWorkspacePermissions } from "@/features/memberships/hooks/use-workspace-permissions";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { ApiError, getApiErrorMessage } from "@/lib/api-error";
import { formatDate } from "@/util/format-date";
import { initialsOf } from "@/util/initials";

import { AUDIT_ENTITY_FILTERS } from "../constants";
import { useAuditLog } from "../hooks/use-audit-log";
import {
	auditActorName,
	auditEventDetail,
	describeAuditEvent,
	isSystemEvent,
} from "../lib/describe-audit-event";
import type { AuditEntityType, AuditLogEntry } from "../types/audit-types";

/**
 * `/settings/audit-log`: who changed the workspace's members, invitations,
 * roles, details and billing, newest first, a page at a time. Needs
 * `audit:read` (the tab is hidden without it); a 403 anyway — the permission
 * was just taken away, or the role couldn't be read — shows the same
 * no-access card instead of an error.
 */
export default function AuditLogSettings() {
	const { activeWorkspaceId } = useWorkspace();
	const { canReadAuditLog, isLoading } = useWorkspacePermissions();

	return (
		<Card>
			<CardHeader className="flex flex-col gap-1">
				<CardTitle>Audit log</CardTitle>
				<CardDescription>
					Changes to members, invitations, roles, workspace details and
					billing, newest first.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<Loading />
				) : !canReadAuditLog ? (
					<NoAccess />
				) : activeWorkspaceId ? (
					// Remount per workspace so the page and filter start over.
					<AuditLogTable
						key={activeWorkspaceId}
						workspaceId={activeWorkspaceId}
					/>
				) : null}
			</CardContent>
		</Card>
	);
}

function AuditLogTable({ workspaceId }: { workspaceId: string }) {
	const [entityType, setEntityType] = useState<AuditEntityType | null>(null);
	const [page, setPage] = useState(1);
	const { data, isLoading, isError, error, refetch, isPlaceholderData } =
		useAuditLog(workspaceId, { page, entityType });

	const filters: { type: AuditEntityType | null; label: string }[] = [
		{ type: null, label: "All" },
		...AUDIT_ENTITY_FILTERS,
	];

	const selectFilter = (type: AuditEntityType | null) => {
		setEntityType(type);
		setPage(1);
	};

	const meta = data?.meta;
	const entries = data?.entries ?? [];

	let body;
	if (isError) {
		body =
			error instanceof ApiError && error.status === 403 ? (
				<NoAccess />
			) : (
				<ErrorAlert
					title="Couldn’t load the audit log"
					description={getApiErrorMessage(error, "Please try again.")}
					onRetry={() => refetch()}
				/>
			);
	} else if (isLoading) {
		body = <Loading />;
	} else if (entries.length === 0) {
		body = (
			<p className="py-8 text-center text-sm text-muted">
				{page > 1
					? "Nothing on this page."
					: entityType
						? "Nothing of this kind has been recorded yet."
						: "Nothing has been recorded yet."}
			</p>
		);
	} else {
		body = (
			<Table className={cn(isPlaceholderData && "opacity-60")}>
				<Table.ScrollContainer>
					<Table.Content aria-label="Audit log">
						<Table.Header>
							<Table.Column className="w-44">Time</Table.Column>
							<Table.Column className="w-48">Actor</Table.Column>
							<Table.Column isRowHeader>Action</Table.Column>
						</Table.Header>
						<Table.Body items={entries}>
							{(entry) => (
								<Table.Row id={entry.id}>
									<Table.Cell className="whitespace-nowrap text-xs text-muted">
										<time dateTime={entry.createdAt}>
											{formatDate(entry.createdAt, "dd MMM yyyy, hh:mm a")}
										</time>
									</Table.Cell>
									<Table.Cell>
										<Actor entry={entry} />
									</Table.Cell>
									<Table.Cell>
										<p className="text-sm">{describeAuditEvent(entry)}</p>
										{auditEventDetail(entry) && (
											<p className="mt-0.5 text-xs text-muted">
												{auditEventDetail(entry)}
											</p>
										)}
									</Table.Cell>
								</Table.Row>
							)}
						</Table.Body>
					</Table.Content>
				</Table.ScrollContainer>
			</Table>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<div
				role="group"
				aria-label="Show"
				className="flex w-fit flex-wrap rounded-md border border-border p-0.5 text-xs"
			>
				{filters.map((f) => (
					<button
						key={f.type ?? "ALL"}
						type="button"
						aria-pressed={entityType === f.type}
						onClick={() => selectFilter(f.type)}
						className={cn(
							"rounded px-2 py-1 transition-colors",
							entityType === f.type
								? "bg-surface-tertiary font-medium text-foreground"
								: "text-muted hover:text-foreground",
						)}
					>
						{f.label}
					</button>
				))}
			</div>

			{body}

			{!isError && meta && (meta.totalPages > 1 || page > 1) && (
				<Pagination size="sm" aria-label="Audit log pages">
					<Pagination.Summary>
						Page {meta.currentPage} of {Math.max(meta.totalPages, 1)} ·{" "}
						{meta.totalData} {meta.totalData === 1 ? "event" : "events"}
					</Pagination.Summary>
					<Pagination.Content>
						<Pagination.Item>
							<Pagination.Previous
								isDisabled={page <= 1 || isPlaceholderData}
								onPress={() => setPage((p) => Math.max(1, p - 1))}
							>
								<Pagination.PreviousIcon />
								Previous
							</Pagination.Previous>
						</Pagination.Item>
						<Pagination.Item>
							<Pagination.Next
								isDisabled={!meta.hasNextPage || isPlaceholderData}
								onPress={() => setPage((p) => p + 1)}
							>
								Next
								<Pagination.NextIcon />
							</Pagination.Next>
						</Pagination.Item>
					</Pagination.Content>
				</Pagination>
			)}
		</div>
	);
}

/** The actor's avatar and name; a cog for the system, a placeholder for a deleted account. */
function Actor({ entry }: { entry: AuditLogEntry }) {
	const name = auditActorName(entry);
	return (
		<div className="flex min-w-0 items-center gap-2">
			{entry.user ? (
				<Avatar
					size="sm"
					customSize
					src={entry.user.avatarUrl ?? undefined}
					alt={name}
					fallback={initialsOf(name)}
				/>
			) : isSystemEvent(entry) ? (
				<Cog className="size-5 shrink-0 text-muted" aria-hidden />
			) : (
				<CircleUserRound className="size-5 shrink-0 text-muted" aria-hidden />
			)}
			<span
				className={cn("truncate text-sm", !entry.user && "text-muted")}
			>
				{name}
			</span>
		</div>
	);
}

function Loading() {
	return (
		<div className="flex items-center justify-center py-8">
			<Spinner />
		</div>
	);
}

function NoAccess() {
	return (
		<div className="flex flex-col items-center gap-2 py-8 text-center">
			<Lock className="size-5 text-muted" aria-hidden />
			<p className="text-sm font-medium">You can’t view the audit log</p>
			<p className="max-w-sm text-xs text-muted">
				It needs the “View the audit log” permission. Ask the workspace
				owner or an admin to give you a role that has it.
			</p>
		</div>
	);
}
