"use client";

import Link from "next/link";

import { cn, Table } from "@heroui/react";
import type { SubscriptionPlan } from "@taskforge/shared";

import { PLAN_META } from "@/features/billing/constants";
import { formatDate } from "@/util/format-date";

import { useAdminWorkspaces } from "../hooks/use-admin";
import { useAdminListNavigation } from "../hooks/use-admin-list-navigation";
import type { AdminListParams } from "../lib/list-params";
import { PlanChip, SubscriptionStatusChip } from "./admin-chips";
import { AdminLoading, AdminPager, AdminQueryError } from "./admin-states";
import AdminSearchField from "./AdminSearchField";

const PLAN_FILTERS: { plan: SubscriptionPlan | undefined; label: string }[] = [
	{ plan: undefined, label: "All plans" },
	{ plan: "FREE", label: PLAN_META.FREE.name },
	{ plan: "PRO", label: PLAN_META.PRO.name },
	{ plan: "ENTERPRISE", label: PLAN_META.ENTERPRISE.name },
];

/**
 * `/admin/workspaces`: every workspace, newest first, searchable by name, the
 * owner's email or the exact id, and filterable by the plan in force. The
 * state lives in the URL (`params`, read by the server page).
 */
export default function AdminWorkspaceList({ params }: { params: AdminListParams }) {
	const navigate = useAdminListNavigation("/admin/workspaces");
	const { data, isLoading, isError, error, refetch, isPlaceholderData } =
		useAdminWorkspaces(params);

	const rows = data?.rows ?? [];

	let body;
	if (isError) {
		body = (
			<AdminQueryError error={error} onRetry={() => refetch()} what="workspaces" />
		);
	} else if (isLoading) {
		body = <AdminLoading />;
	} else if (rows.length === 0) {
		body = (
			<p className="py-12 text-center text-sm text-muted">
				{params.search || params.plan
					? "No workspace matches."
					: "There are no workspaces yet."}
			</p>
		);
	} else {
		body = (
			<Table className={cn(isPlaceholderData && "opacity-60")}>
				<Table.ScrollContainer>
					<Table.Content aria-label="Workspaces">
						<Table.Header>
							<Table.Column isRowHeader>Workspace</Table.Column>
							<Table.Column>Owner</Table.Column>
							<Table.Column className="w-24">Members</Table.Column>
							<Table.Column className="w-24">Plan</Table.Column>
							<Table.Column className="w-36">Status</Table.Column>
							<Table.Column className="w-20">Seats</Table.Column>
							<Table.Column className="w-32">Created</Table.Column>
						</Table.Header>
						<Table.Body items={rows}>
							{(row) => (
								<Table.Row id={row.id}>
									<Table.Cell>
										<Link
											href={`/admin/workspaces/${row.id}`}
											className="font-medium hover:underline"
										>
											{row.name}
										</Link>
									</Table.Cell>
									<Table.Cell>
										{row.owner ? (
											<Link
												href={`/admin/users/${row.owner.id}`}
												className="flex min-w-0 flex-col hover:underline"
											>
												<span className="truncate text-sm">{row.owner.name}</span>
												<span className="truncate text-xs text-muted">
													{row.owner.email}
												</span>
											</Link>
										) : (
											<span className="text-sm text-muted">No owner</span>
										)}
									</Table.Cell>
									<Table.Cell className="tabular-nums">{row.memberCount}</Table.Cell>
									<Table.Cell>
										<PlanChip plan={row.plan} />
									</Table.Cell>
									<Table.Cell>
										<SubscriptionStatusChip status={row.subscription?.status} />
									</Table.Cell>
									<Table.Cell className="tabular-nums">
										{row.subscription?.seats ?? "—"}
									</Table.Cell>
									<Table.Cell className="text-xs whitespace-nowrap text-muted">
										{formatDate(row.createdAt, "dd MMM yyyy")}
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
			<h1 className="text-lg font-semibold">Workspaces</h1>

			<div className="flex flex-wrap items-center gap-3">
				<AdminSearchField
					label="Search workspaces"
					placeholder="Name, owner’s email or id"
					value={params.search ?? ""}
					onSearch={(search) =>
						navigate({ ...params, search: search || undefined, page: 1 }, { replace: true })
					}
				/>
				<div
					role="group"
					aria-label="Plan"
					className="flex w-fit flex-wrap rounded-md border border-border p-0.5 text-xs"
				>
					{PLAN_FILTERS.map((filter) => (
						<button
							key={filter.plan ?? "ALL"}
							type="button"
							aria-pressed={params.plan === filter.plan}
							onClick={() => navigate({ ...params, plan: filter.plan, page: 1 })}
							className={cn(
								"rounded px-2 py-1 transition-colors",
								params.plan === filter.plan
									? "bg-surface-tertiary font-medium text-foreground"
									: "text-muted hover:text-foreground",
							)}
						>
							{filter.label}
						</button>
					))}
				</div>
			</div>

			{body}

			{!isError && (
				<AdminPager
					meta={data?.meta}
					page={params.page}
					onPage={(page) => navigate({ ...params, page })}
					isFetching={isPlaceholderData}
					noun={["workspace", "workspaces"]}
				/>
			)}
		</div>
	);
}
