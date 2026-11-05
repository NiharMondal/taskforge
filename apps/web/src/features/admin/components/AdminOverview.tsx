"use client";

import Link from "next/link";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@heroui/react";
import {
	SUBSCRIPTION_PLAN_VALUES,
	SUBSCRIPTION_STATUS_VALUES,
} from "@taskforge/shared";

import { PLAN_META, STATUS_LABELS } from "@/features/billing/constants";

import { useAdminStats } from "../hooks/use-admin";
import { AdminLoading, AdminQueryError } from "./admin-states";
import { SubscriptionStatusChip } from "./admin-chips";

const number = new Intl.NumberFormat();

/** `/admin`: platform totals — users, workspaces by plan, subscriptions by status. */
export default function AdminOverview() {
	const { data: stats, isLoading, isError, error, refetch } = useAdminStats();

	if (isError) {
		return (
			<AdminQueryError error={error} onRetry={() => refetch()} what="stats" />
		);
	}
	if (isLoading || !stats) return <AdminLoading />;

	const statuses = SUBSCRIPTION_STATUS_VALUES.filter(
		(status) => stats.subscriptions.byStatus[status] > 0,
	);

	return (
		<div className="flex flex-col gap-6">
			<h1 className="text-lg font-semibold">Overview</h1>

			<section aria-label="Users" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<Stat label="Users" value={stats.users.total} href="/admin/users" />
				<Stat label="New in the last 7 days" value={stats.users.newLast7Days} />
				<Stat label="New in the last 30 days" value={stats.users.newLast30Days} />
				<Stat label="Platform staff" value={stats.users.platformStaff} />
			</section>

			<div className="grid gap-4 lg:grid-cols-2">
				<Card>
					<CardHeader className="flex flex-col gap-1">
						<CardTitle>
							<Link href="/admin/workspaces" className="hover:underline">
								Workspaces
							</Link>
						</CardTitle>
						<CardDescription>
							{number.format(stats.workspaces.total)} in all, by the plan in
							force now. A lapsed subscription counts as Free.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<ul className="flex flex-col divide-y divide-border">
							{SUBSCRIPTION_PLAN_VALUES.map((plan) => (
								<li key={plan} className="flex items-center justify-between py-2">
									<Link
										href={`/admin/workspaces?plan=${plan}`}
										className="text-sm hover:underline"
									>
										{PLAN_META[plan].name}
									</Link>
									<span className="text-sm font-medium tabular-nums">
										{number.format(stats.workspaces.byPlan[plan])}
									</span>
								</li>
							))}
						</ul>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-col gap-1">
						<CardTitle>Subscriptions</CardTitle>
						<CardDescription>
							{number.format(stats.subscriptions.total)} workspaces have
							started a checkout, by Stripe’s status.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{statuses.length === 0 && stats.subscriptions.noStatus === 0 ? (
							<p className="py-2 text-sm text-muted">No subscriptions yet.</p>
						) : (
							<ul className="flex flex-col divide-y divide-border">
								{statuses.map((status) => (
									<li
										key={status}
										className="flex items-center justify-between py-2"
									>
										<span className="sr-only">{STATUS_LABELS[status]}</span>
										<SubscriptionStatusChip status={status} />
										<span className="text-sm font-medium tabular-nums">
											{number.format(stats.subscriptions.byStatus[status])}
										</span>
									</li>
								))}
								{stats.subscriptions.noStatus > 0 && (
									<li className="flex items-center justify-between py-2">
										<span className="text-sm text-muted">
											Checkout started, not subscribed
										</span>
										<span className="text-sm font-medium tabular-nums">
											{number.format(stats.subscriptions.noStatus)}
										</span>
									</li>
								)}
							</ul>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

function Stat({
	label,
	value,
	href,
}: {
	label: string;
	value: number;
	href?: string;
}) {
	const body = (
		<>
			<p className="text-xs text-muted">{label}</p>
			<p className="mt-1 text-2xl font-semibold tabular-nums">
				{number.format(value)}
			</p>
		</>
	);
	return (
		<Card>
			<CardContent>
				{href ? (
					<Link href={href} className="block hover:underline">
						{body}
					</Link>
				) : (
					body
				)}
			</CardContent>
		</Card>
	);
}
