"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	cn,
	Table,
} from "@heroui/react";
import { Lock, Terminal } from "lucide-react";

import { formatDate } from "@/util/format-date";

import { useAdminViewer } from "../context/admin-viewer";
import { useAdminAuditLog } from "../hooks/use-admin";
import {
	describePlatformEvent,
	platformActorName,
	platformEventReason,
	platformTargetHref,
} from "../lib/describe-platform-event";
import type {
	PlatformAuditEntry,
	PlatformAuditTargetType,
} from "../types/admin-types";
import { AdminLoading, AdminPager, AdminQueryError } from "./admin-states";

/** The audit log's URL state: `?targetType=&targetId=&page=`. */
export interface AuditLogParams {
	targetType?: PlatformAuditTargetType;
	targetId?: string;
	page: number;
}

const FILTERS: { type: PlatformAuditTargetType | undefined; label: string }[] =
	[
		{ type: undefined, label: "Everything" },
		{ type: "USER", label: "Users" },
		{ type: "WORKSPACE", label: "Workspaces" },
	];

const auditHref = ({ targetType, targetId, page }: AuditLogParams) => {
	const query = new URLSearchParams();
	if (targetType) query.set("targetType", targetType);
	if (targetId) query.set("targetId", targetId);
	if (page > 1) query.set("page", String(page));
	const qs = query.toString();
	return `/admin/audit-log${qs ? `?${qs}` : ""}`;
};

/**
 * `/admin/audit-log`: what platform staff (and the `set-platform-role`
 * script) did, newest first, a page at a time. ADMIN only — the backend
 * refuses SUPPORT, and so does this page.
 */
export default function AdminAuditLog({ params }: { params: AuditLogParams }) {
	const { canAct } = useAdminViewer();
	const router = useRouter();
	const { data, isLoading, isError, error, refetch, isPlaceholderData } =
		useAdminAuditLog(params, { enabled: canAct });

	if (!canAct) {
		return (
			<div className="flex flex-col items-center gap-2 py-12 text-center">
				<Lock className="size-5 text-muted" aria-hidden />
				<p className="text-sm font-medium">Only platform admins read the audit log</p>
			</div>
		);
	}

	const navigate = (next: AuditLogParams) =>
		router.push(auditHref(next), { scroll: false });
	const entries = data?.entries ?? [];

	return (
		<div className="flex flex-col gap-4">
			<h1 className="text-lg font-semibold">Platform audit log</h1>

			<div className="flex flex-wrap items-center gap-3">
				<div
					role="group"
					aria-label="Show"
					className="flex w-fit flex-wrap rounded-md border border-border p-0.5 text-xs"
				>
					{FILTERS.map((filter) => (
						<button
							key={filter.type ?? "ALL"}
							type="button"
							aria-pressed={params.targetType === filter.type}
							onClick={() =>
								navigate({ ...params, targetType: filter.type, page: 1 })
							}
							className={cn(
								"rounded px-2 py-1 transition-colors",
								params.targetType === filter.type
									? "bg-surface-tertiary font-medium text-foreground"
									: "text-muted hover:text-foreground",
							)}
						>
							{filter.label}
						</button>
					))}
				</div>
				{params.targetId && (
					<p className="text-xs text-muted">
						One target only ·{" "}
						<Link
							href={auditHref({ targetType: params.targetType, page: 1 })}
							className="underline"
						>
							show all
						</Link>
					</p>
				)}
			</div>

			{isError ? (
				<AdminQueryError error={error} onRetry={() => refetch()} what="audit log" />
			) : isLoading ? (
				<AdminLoading />
			) : entries.length === 0 ? (
				<p className="py-12 text-center text-sm text-muted">
					Nothing has been recorded yet.
				</p>
			) : (
				<AuditTable
					entries={entries}
					className={cn(isPlaceholderData && "opacity-60")}
				/>
			)}

			{!isError && (
				<AdminPager
					meta={data?.meta}
					page={params.page}
					onPage={(page) => navigate({ ...params, page })}
					isFetching={isPlaceholderData}
					noun={["event", "events"]}
				/>
			)}
		</div>
	);
}

function AuditTable({
	entries,
	className,
	showTarget = true,
}: {
	entries: PlatformAuditEntry[];
	className?: string;
	showTarget?: boolean;
}) {
	return (
		<Table className={className}>
			<Table.ScrollContainer>
				<Table.Content aria-label="Platform audit log">
					<Table.Header>
						<Table.Column className="w-44">Time</Table.Column>
						<Table.Column className="w-44">Who</Table.Column>
						<Table.Column isRowHeader>What</Table.Column>
					</Table.Header>
					<Table.Body items={entries}>
						{(entry) => {
							const href = showTarget ? platformTargetHref(entry) : null;
							const reason = platformEventReason(entry);
							return (
								<Table.Row id={entry.id}>
									<Table.Cell className="text-xs whitespace-nowrap text-muted">
										<time dateTime={entry.createdAt}>
											{formatDate(entry.createdAt, "dd MMM yyyy, hh:mm a")}
										</time>
									</Table.Cell>
									<Table.Cell>
										<span
											className={cn(
												"flex items-center gap-1.5 text-sm",
												!entry.actor && "text-muted",
											)}
										>
											{!entry.actor && (
												<Terminal className="size-3.5 shrink-0" aria-hidden />
											)}
											<span className="truncate">{platformActorName(entry)}</span>
										</span>
									</Table.Cell>
									<Table.Cell>
										<p className="text-sm">
											{href ? (
												<Link href={href} className="hover:underline">
													{describePlatformEvent(entry)}
												</Link>
											) : (
												describePlatformEvent(entry)
											)}
										</p>
										{reason && (
											<p className="mt-0.5 text-xs text-muted">Reason: {reason}</p>
										)}
									</Table.Cell>
								</Table.Row>
							);
						}}
					</Table.Body>
				</Table.Content>
			</Table.ScrollContainer>
		</Table>
	);
}

/**
 * The last few audit rows about one user or workspace, on its detail page.
 * ADMIN only (SUPPORT can't read the log, so it isn't shown to them).
 */
export function AdminHistory({
	targetType,
	targetId,
}: {
	targetType: PlatformAuditTargetType;
	targetId: string;
}) {
	const { canAct } = useAdminViewer();
	const { data, isLoading, isError, error, refetch } = useAdminAuditLog(
		{ targetType, targetId, page: 1, limit: 10 },
		{ enabled: canAct },
	);
	if (!canAct) return null;

	const entries = data?.entries ?? [];
	const total = data?.meta?.totalData ?? 0;

	return (
		<Card>
			<CardHeader className="flex flex-col gap-1">
				<CardTitle>History</CardTitle>
				<CardDescription>What platform staff did here.</CardDescription>
			</CardHeader>
			<CardContent>
				{isError ? (
					<AdminQueryError error={error} onRetry={() => refetch()} what="history" />
				) : isLoading ? (
					<AdminLoading />
				) : entries.length === 0 ? (
					<p className="text-sm text-muted">Nothing yet.</p>
				) : (
					<>
						<AuditTable entries={entries} showTarget={false} />
						{total > entries.length && (
							<Link
								href={auditHref({ targetType, targetId, page: 1 })}
								className="mt-2 inline-block text-xs text-muted underline"
							>
								All {total} events
							</Link>
						)}
					</>
				)}
			</CardContent>
		</Card>
	);
}
