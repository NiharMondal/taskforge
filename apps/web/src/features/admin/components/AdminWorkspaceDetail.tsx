"use client";

import Link from "next/link";

import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Chip,
	Table,
} from "@heroui/react";
import { ADMIN_DETAIL_LIST_LIMIT } from "@taskforge/shared";
import { ExternalLink } from "lucide-react";

import Avatar from "@/components/ui/avatar";
import BackButton from "@/components/ui/back-button";
import { PLAN_META } from "@/features/billing/constants";
import { RoleChip } from "@/features/roles/components/RoleChip";
import { formatDate } from "@/util/format-date";
import { initialsOf } from "@/util/initials";

import { useAdminWorkspace } from "../hooks/use-admin";
import { AdminWorkspaceActions, SuspensionBanner } from "./admin-actions";
import { AdminHistory } from "./AdminAuditLog";
import { stripeDashboardUrl } from "../lib/stripe-dashboard";
import type { AdminWorkspaceDetail as Workspace } from "../types/admin-types";
import {
	PlanChip,
	SubscriptionStatusChip,
	SuspendedChip,
} from "./admin-chips";
import {
	AdminLoading,
	AdminQueryError,
	DetailItem,
	MonoId,
} from "./admin-states";

const DATE_TIME = "dd MMM yyyy, hh:mm a";

/** `/admin/workspaces/[workspaceId]`: one workspace, read-only. */
export default function AdminWorkspaceDetail({
	workspaceId,
}: {
	workspaceId: string;
}) {
	const { data: workspace, isLoading, isError, error, refetch } =
		useAdminWorkspace(workspaceId);

	if (isError) {
		return (
			<AdminQueryError
				error={error}
				onRetry={() => refetch()}
				what="workspace"
				backHref="/admin/workspaces"
				backLabel="Workspaces"
			/>
		);
	}
	if (isLoading || !workspace) return <AdminLoading />;

	return (
		<div className="flex flex-col gap-6">
			<BackButton href="/admin/workspaces" label="Workspaces" />

			<div className="flex flex-wrap items-center gap-3">
				<h1 className="text-lg font-semibold">{workspace.name}</h1>
				<PlanChip plan={workspace.plan} />
				{workspace.suspendedAt && <SuspendedChip />}
			</div>

			<SuspensionBanner suspension={workspace} what="workspace" />

			<Card>
				<CardContent>
					<dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						<DetailItem label="Owner">
							{workspace.owner ? (
								<Link
									href={`/admin/users/${workspace.owner.id}`}
									className="hover:underline"
								>
									{workspace.owner.name}{" "}
									<span className="text-muted">({workspace.owner.email})</span>
								</Link>
							) : (
								<span className="text-muted">No owner</span>
							)}
						</DetailItem>
						<DetailItem label="Created">
							{formatDate(workspace.createdAt, DATE_TIME)}
						</DetailItem>
						<DetailItem label="Workspace id">
							<MonoId id={workspace.id} />
						</DetailItem>
						{workspace.description && (
							<DetailItem label="Description">{workspace.description}</DetailItem>
						)}
					</dl>
				</CardContent>
			</Card>

			<Counts workspace={workspace} />
			<SubscriptionCard workspace={workspace} />
			<MembersCard workspace={workspace} />
			<ProjectsCard workspace={workspace} />
			<AdminWorkspaceActions workspace={workspace} />
			<AdminHistory targetType="WORKSPACE" targetId={workspace.id} />
		</div>
	);
}

function Counts({ workspace }: { workspace: Workspace }) {
	const { counts } = workspace;
	const items: [string, number][] = [
		["Members", counts.members],
		["Pending invitations", counts.pendingInvitations],
		["Projects", counts.projects],
		["Issues", counts.issues],
		["Sprints", counts.sprints],
		["Labels", counts.labels],
		["Custom roles", counts.customRoles],
	];
	return (
		<dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
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

function SubscriptionCard({ workspace }: { workspace: Workspace }) {
	const sub = workspace.subscription;
	return (
		<Card>
			<CardHeader>
				<CardTitle>Subscription</CardTitle>
			</CardHeader>
			<CardContent>
				{!sub ? (
					<p className="text-sm text-muted">
						Never started a checkout: on {PLAN_META.FREE.name}, with no Stripe
						customer.
					</p>
				) : (
					<dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						<DetailItem label="Stored plan">
							{PLAN_META[sub.plan].name}
							{sub.plan !== workspace.plan && (
								<span className="text-muted">
									{" "}
									(not in force: {PLAN_META[workspace.plan].name} now)
								</span>
							)}
						</DetailItem>
						<DetailItem label="Status">
							<SubscriptionStatusChip status={sub.status} />
						</DetailItem>
						<DetailItem label="Seats billed">{sub.seats ?? "—"}</DetailItem>
						<DetailItem label="Current period ends">
							{sub.currentPeriodEnd
								? formatDate(sub.currentPeriodEnd, DATE_TIME)
								: "—"}
							{sub.cancelAtPeriodEnd && (
								<Chip size="sm" variant="soft" color="warning" className="ml-2">
									Cancels then
								</Chip>
							)}
						</DetailItem>
						<DetailItem label="Trial ends">
							{sub.trialEndsAt ? formatDate(sub.trialEndsAt, DATE_TIME) : "—"}
						</DetailItem>
						<DetailItem label="Last updated by Stripe">
							{formatDate(sub.updatedAt, DATE_TIME)}
						</DetailItem>
						<DetailItem label="Stripe customer">
							<StripeLink
								kind="customers"
								id={sub.stripeCustomerId}
								mode={workspace.stripeMode}
							/>
						</DetailItem>
						<DetailItem label="Stripe subscription">
							<StripeLink
								kind="subscriptions"
								id={sub.stripeSubscriptionId}
								mode={workspace.stripeMode}
							/>
						</DetailItem>
					</dl>
				)}
			</CardContent>
		</Card>
	);
}

/** A Stripe id, linked to Stripe's dashboard when the mode is known. */
function StripeLink({
	kind,
	id,
	mode,
}: {
	kind: "customers" | "subscriptions";
	id: string | null;
	mode: Workspace["stripeMode"];
}) {
	if (!id) return <span className="text-muted">—</span>;
	const href = stripeDashboardUrl(kind, id, mode);
	if (!href) return <MonoId id={id} />;
	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className="inline-flex items-center gap-1 font-mono text-xs break-all hover:underline"
		>
			{id}
			{mode === "test" && <span className="font-sans text-muted">(test)</span>}
			<ExternalLink className="size-3 shrink-0" aria-hidden />
			<span className="sr-only">(opens Stripe in a new tab)</span>
		</a>
	);
}

/** "Showing the first 100 of 240", when a list was capped. */
function capNote(shown: number, total: number) {
	return total > shown ? (
		<p className="mt-2 text-xs text-muted">
			Showing the first {ADMIN_DETAIL_LIST_LIMIT} of {total}.
		</p>
	) : null;
}

function MembersCard({ workspace }: { workspace: Workspace }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Members</CardTitle>
			</CardHeader>
			<CardContent>
				<Table>
					<Table.ScrollContainer>
						<Table.Content aria-label="Members">
							<Table.Header>
								<Table.Column isRowHeader>Member</Table.Column>
								<Table.Column className="w-40">Role</Table.Column>
								<Table.Column className="w-32">Joined</Table.Column>
							</Table.Header>
							<Table.Body items={workspace.members}>
								{(member) => (
									<Table.Row id={member.id}>
										<Table.Cell>
											<Link
												href={`/admin/users/${member.user.id}`}
												className="flex min-w-0 items-center gap-2 hover:underline"
											>
												<Avatar
													size="sm"
													src={member.user.avatarUrl ?? undefined}
													alt={member.user.name}
													fallback={initialsOf(member.user.name)}
												/>
												<span className="flex min-w-0 flex-col">
													<span className="truncate text-sm">{member.user.name}</span>
													<span className="truncate text-xs text-muted">
														{member.user.email}
													</span>
												</span>
											</Link>
										</Table.Cell>
										<Table.Cell>
											<RoleChip role={member.assignedRole} fallback={member.role} />
										</Table.Cell>
										<Table.Cell className="text-xs whitespace-nowrap text-muted">
											{formatDate(member.joinedAt, "dd MMM yyyy")}
										</Table.Cell>
									</Table.Row>
								)}
							</Table.Body>
						</Table.Content>
					</Table.ScrollContainer>
				</Table>
				{capNote(workspace.members.length, workspace.counts.members)}
			</CardContent>
		</Card>
	);
}

function ProjectsCard({ workspace }: { workspace: Workspace }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Projects</CardTitle>
			</CardHeader>
			<CardContent>
				{workspace.projects.length === 0 ? (
					<p className="text-sm text-muted">No projects.</p>
				) : (
					<>
						<Table>
							<Table.ScrollContainer>
								<Table.Content aria-label="Projects">
									<Table.Header>
										<Table.Column isRowHeader>Project</Table.Column>
										<Table.Column className="w-24">Key</Table.Column>
										<Table.Column className="w-24">Issues</Table.Column>
										<Table.Column className="w-24">Sprints</Table.Column>
										<Table.Column className="w-32">Created</Table.Column>
									</Table.Header>
									<Table.Body items={workspace.projects}>
										{(project) => (
											<Table.Row id={project.id}>
												<Table.Cell className="text-sm">{project.name}</Table.Cell>
												<Table.Cell className="font-mono text-xs">{project.key}</Table.Cell>
												<Table.Cell className="tabular-nums">{project.issueCount}</Table.Cell>
												<Table.Cell className="tabular-nums">{project.sprintCount}</Table.Cell>
												<Table.Cell className="text-xs whitespace-nowrap text-muted">
													{formatDate(project.createdAt, "dd MMM yyyy")}
												</Table.Cell>
											</Table.Row>
										)}
									</Table.Body>
								</Table.Content>
							</Table.ScrollContainer>
						</Table>
						{capNote(workspace.projects.length, workspace.counts.projects)}
					</>
				)}
			</CardContent>
		</Card>
	);
}
