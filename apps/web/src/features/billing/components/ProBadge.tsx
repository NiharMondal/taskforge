import { Chip, cn } from "@heroui/react";

import { PLAN_META } from "../constants";
import type { SubscriptionPlan } from "../types/billing-types";

/** A small plan badge for paid workspaces; renders nothing for Free. */
export function ProBadge({
	plan,
	className,
}: {
	plan: SubscriptionPlan | undefined;
	className?: string;
}) {
	if (!plan || plan === "FREE") return null;
	return (
		<Chip
			size="sm"
			variant="soft"
			color="accent"
			className={cn("shrink-0", className)}
		>
			{PLAN_META[plan].name}
		</Chip>
	);
}
