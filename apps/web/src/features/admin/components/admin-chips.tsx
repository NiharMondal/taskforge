import { Chip } from "@heroui/react";
import type { SubscriptionPlan, SubscriptionStatus } from "@taskforge/shared";

import { PLAN_META, STATUS_LABELS } from "@/features/billing/constants";

import {
	PLATFORM_ROLE_DESCRIPTIONS,
	PLATFORM_ROLE_LABELS,
	SUBSCRIPTION_STATUS_COLOR,
} from "../constants";
import type { PlatformRole } from "../types/admin-types";

/** The plan in force, Free included (unlike the app's `ProBadge`). */
export function PlanChip({ plan }: { plan: SubscriptionPlan }) {
	return (
		<Chip size="sm" variant="soft" color={plan === "FREE" ? "default" : "accent"}>
			{PLAN_META[plan].name}
		</Chip>
	);
}

/** Stripe's subscription status; a dash when there is none. */
export function SubscriptionStatusChip({
	status,
}: {
	status: SubscriptionStatus | null | undefined;
}) {
	if (!status) return <span className="text-sm text-muted">—</span>;
	return (
		<Chip size="sm" variant="soft" color={SUBSCRIPTION_STATUS_COLOR[status]}>
			{STATUS_LABELS[status]}
		</Chip>
	);
}

export function PlatformRoleChip({ role }: { role: PlatformRole }) {
	return (
		<Chip
			size="sm"
			variant="soft"
			color={role === "ADMIN" ? "warning" : "default"}
		>
			<span title={PLATFORM_ROLE_DESCRIPTIONS[role]}>
				{PLATFORM_ROLE_LABELS[role]}
			</span>
		</Chip>
	);
}
