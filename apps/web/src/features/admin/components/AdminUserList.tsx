"use client";

import Link from "next/link";

import { cn, Table } from "@heroui/react";

import Avatar from "@/components/ui/avatar";
import { formatDate } from "@/util/format-date";
import { initialsOf } from "@/util/initials";

import { SIGN_IN_PROVIDER_LABELS } from "../constants";
import { useAdminUsers } from "../hooks/use-admin";
import { useAdminListNavigation } from "../hooks/use-admin-list-navigation";
import type { AdminListParams } from "../lib/list-params";
import { PlatformRoleChip, SuspendedChip } from "./admin-chips";
import { AdminLoading, AdminPager, AdminQueryError } from "./admin-states";
import AdminSearchField from "./AdminSearchField";

/**
 * `/admin/users`: every account, newest first, searchable by name, email or
 * the exact id. The state lives in the URL (`params`, read by the server page).
 */
export default function AdminUserList({ params }: { params: AdminListParams }) {
	const navigate = useAdminListNavigation("/admin/users");
	const { data, isLoading, isError, error, refetch, isPlaceholderData } =
		useAdminUsers(params);

	const rows = data?.rows ?? [];

	let body;
	if (isError) {
		body = <AdminQueryError error={error} onRetry={() => refetch()} what="users" />;
	} else if (isLoading) {
		body = <AdminLoading />;
	} else if (rows.length === 0) {
		body = (
			<p className="py-12 text-center text-sm text-muted">
				{params.search ? "No user matches." : "There are no users yet."}
			</p>
		);
	} else {
		body = (
			<Table className={cn(isPlaceholderData && "opacity-60")}>
				<Table.ScrollContainer>
					<Table.Content aria-label="Users">
						<Table.Header>
							<Table.Column isRowHeader>User</Table.Column>
							<Table.Column className="w-40">Sign-in</Table.Column>
							<Table.Column className="w-28">Verified</Table.Column>
							<Table.Column className="w-28">Workspaces</Table.Column>
							<Table.Column className="w-32">Joined</Table.Column>
						</Table.Header>
						<Table.Body items={rows}>
							{(user) => (
								<Table.Row id={user.id}>
									<Table.Cell>
										<Link
											href={`/admin/users/${user.id}`}
											className="flex min-w-0 items-center gap-2 hover:underline"
										>
											<Avatar
												size="sm"
												src={user.avatarUrl ?? undefined}
												alt={user.name}
												fallback={initialsOf(user.name)}
											/>
											<span className="flex min-w-0 flex-col">
												<span className="flex items-center gap-2">
													<span className="truncate text-sm font-medium">
														{user.name}
													</span>
													{user.platformRole && (
														<PlatformRoleChip role={user.platformRole} />
													)}
													{user.suspendedAt && <SuspendedChip />}
												</span>
												<span className="truncate text-xs text-muted">
													{user.email}
												</span>
											</span>
										</Link>
									</Table.Cell>
									<Table.Cell className="text-sm">
										{user.signInMethods.length > 0
											? user.signInMethods
													.map((p) => SIGN_IN_PROVIDER_LABELS[p])
													.join(", ")
											: "—"}
									</Table.Cell>
									<Table.Cell className="text-sm">
										{user.emailVerifiedAt ? "Yes" : <span className="text-warning">No</span>}
									</Table.Cell>
									<Table.Cell className="tabular-nums">{user.workspaceCount}</Table.Cell>
									<Table.Cell className="text-xs whitespace-nowrap text-muted">
										{formatDate(user.createdAt, "dd MMM yyyy")}
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
			<h1 className="text-lg font-semibold">Users</h1>

			<AdminSearchField
				label="Search users"
				placeholder="Name, email or id"
				value={params.search ?? ""}
				onSearch={(search) =>
					navigate({ search: search || undefined, page: 1 }, { replace: true })
				}
			/>

			{body}

			{!isError && (
				<AdminPager
					meta={data?.meta}
					page={params.page}
					onPage={(page) => navigate({ ...params, page })}
					isFetching={isPlaceholderData}
					noun={["user", "users"]}
				/>
			)}
		</div>
	);
}
