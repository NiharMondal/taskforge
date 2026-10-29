import { Chip } from "@heroui/react";

import { PLAN_META } from "../constants";
import type { SubscriptionPlan } from "../types/billing-types";

/** A small plan badge for paid workspaces; renders nothing for Free. */
export function ProBadge({ plan }: { plan: SubscriptionPlan | undefined }) {
	if (!plan || plan === "FREE") return null;
	return (
		<Chip size="sm" variant="soft" color="accent">
			{PLAN_META[plan].name}
		</Chip>
	);
}
