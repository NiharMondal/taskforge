"use client";

import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle, Table } from "@heroui/react";
import { ADMIN_DETAIL_LIST_LIMIT } from "@taskforge/shared";

import Avatar from "@/components/ui/avatar";
import BackButton from "@/components/ui/back-button";
import { RoleChip } from "@/features/roles/components/RoleChip";
import { formatDate } from "@/util/format-date";
import { initialsOf } from "@/util/initials";

import { SIGN_IN_PROVIDER_LABELS } from "../constants";
import { useAdminUser } from "../hooks/use-admin";
import type { AdminUserDetail as User } from "../types/admin-types";
import { PlanChip, PlatformRoleChip } from "./admin-chips";
import {
	AdminLoading,
	AdminQueryError,
	DetailItem,
	MonoId,
} from "./admin-states";

const DATE_TIME = "dd MMM yyyy, hh:mm a";

/** `/admin/users/[userId]`: one account, read-only. Never a password or token. */
export default function AdminUserDetail({ userId }: { userId: string }) {
	const { data: user, isLoading, isError, error, refetch } =
		useAdminUser(userId);

	if (isError) {
		return (
			<AdminQueryError
				error={error}
				onRetry={() => refetch()}
				what="user"
				backHref="/admin/users"
				backLabel="Users"
			/>
		);
	}
	if (isLoading || !user) return <AdminLoading />;

	return (
		<div className="flex flex-col gap-6">
			<BackButton href="/admin/users" label="Users" />

			<div className="flex flex-wrap items-center gap-3">
				<Avatar
					src={user.avatarUrl ?? undefined}
					alt={user.name}
					fallback={initialsOf(user.name)}
				/>
				<div className="flex min-w-0 flex-col">
					<div className="flex items-center gap-2">
						<h1 className="truncate text-lg font-semibold">{user.name}</h1>
						{user.platformRole && <PlatformRoleChip role={user.platformRole} />}
					</div>
					<p className="truncate text-sm text-muted">{user.email}</p>
				</div>
			</div>

			<Card>
				<CardContent>
					<dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						<DetailItem label="Email verified">
							{user.emailVerifiedAt ? (
								formatDate(user.emailVerifiedAt, DATE_TIME)
							) : (
								<span className="text-warning">Not verified</span>
							)}
						</DetailItem>
						<DetailItem label="Signed up">
							{formatDate(user.createdAt, DATE_TIME)}
						</DetailItem>
						<DetailItem label="User id">
							<MonoId id={user.id} />
						</DetailItem>
						<DetailItem label="Sign-in methods">
							{user.signInMethods.length === 0 ? (
								<span className="text-muted">None</span>
							) : (
								<ul>
									{user.signInMethods.map((method) => (
										<li key={method.provider}>
											{SIGN_IN_PROVIDER_LABELS[method.provider]}{" "}
											<span className="text-xs text-muted">
												since {formatDate(method.addedAt, "dd MMM yyyy")}
											</span>
										</li>
									))}
								</ul>
							)}
						</DetailItem>
						<DetailItem label="Signed-in sessions">
							{user.counts.activeSessions}
						</DetailItem>
					</dl>
				</CardContent>
			</Card>

			<Counts user={user} />
			<MembershipsCard user={user} />
		</div>
	);
}

function Counts({ user }: { user: User }) {
	const items: [string, number][] = [
		["Workspaces", user.counts.workspaces],
		["Issues reported", user.counts.reportedIssues],
		["Issues assigned", user.counts.assignedIssues],
		["Comments", user.counts.comments],
	];
	return (
		<dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
			{items.map(([label, value]) => (
				<div
					key={label}
					className="rounded-lg border border-border bg-surface px-3 py-2"
				>
					<dt className="text-xs text-muted">{label}</dt>
					<dd className="text-lg font-semibold tabular-nums">{value}</dd>
				</div>
			))}
		</dl>
	);
}

function MembershipsCard({ user }: { user: User }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Workspaces</CardTitle>
			</CardHeader>
			<CardContent>
				{user.memberships.length === 0 ? (
					<p className="text-sm text-muted">Not a member of any workspace.</p>
				) : (
					<>
						<Table>
							<Table.ScrollContainer>
								<Table.Content aria-label="Workspaces">
									<Table.Header>
										<Table.Column isRowHeader>Workspace</Table.Column>
										<Table.Column className="w-40">Role</Table.Column>
										<Table.Column className="w-24">Plan</Table.Column>
										<Table.Column className="w-24">Members</Table.Column>
										<Table.Column className="w-32">Joined</Table.Column>
									</Table.Header>
									<Table.Body items={user.memberships}>
										{(membership) => (
											<Table.Row id={membership.id}>
												<Table.Cell>
													<Link
														href={`/admin/workspaces/${membership.workspace.id}`}
														className="text-sm font-medium hover:underline"
													>
														{membership.workspace.name}
													</Link>
												</Table.Cell>
												<Table.Cell>
													<RoleChip
														role={membership.assignedRole}
														fallback={membership.role}
													/>
												</Table.Cell>
												<Table.Cell>
													<PlanChip plan={membership.workspace.plan} />
												</Table.Cell>
												<Table.Cell className="tabular-nums">
													{membership.workspace.memberCount}
												</Table.Cell>
												<Table.Cell className="text-xs whitespace-nowrap text-muted">
													{formatDate(membership.joinedAt, "dd MMM yyyy")}
												</Table.Cell>
											</Table.Row>
										)}
									</Table.Body>
								</Table.Content>
							</Table.ScrollContainer>
						</Table>
						{user.counts.workspaces > user.memberships.length && (
							<p className="mt-2 text-xs text-muted">
								Showing the first {ADMIN_DETAIL_LIST_LIMIT} of{" "}
								{user.counts.workspaces}.
							</p>
						)}
					</>
				)}
			</CardContent>
		</Card>
	);
}
