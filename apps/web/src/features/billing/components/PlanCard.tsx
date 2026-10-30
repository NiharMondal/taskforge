import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Chip,
} from "@heroui/react";
import { Check } from "lucide-react";

import { PLAN_META } from "../constants";
import type { SubscriptionPlan } from "../types/billing-types";

/**
 * One plan's card, from `PLAN_META`: name, tagline, price, features, and
 * whatever `action` the page offers. Used by Settings → Billing (which marks
 * the workspace's plan with `isCurrent`) and the public pricing page.
 */
export default function PlanCard({
	plan,
	isCurrent = false,
	action,
}: {
	plan: SubscriptionPlan;
	isCurrent?: boolean;
	action?: React.ReactNode;
}) {
	const meta = PLAN_META[plan];

	return (
		<Card className={isCurrent ? "ring-2 ring-accent" : undefined}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					{meta.name}
					{isCurrent && (
						<Chip size="sm" variant="soft" color="accent">
							Current
						</Chip>
					)}
				</CardTitle>
				<CardDescription>{meta.tagline}</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col gap-4">
				<p className="text-lg font-semibold">{meta.price}</p>
				<ul className="flex flex-1 flex-col gap-2">
					{meta.features.map((feature) => (
						<li key={feature} className="flex gap-2 text-sm">
							<Check className="mt-0.5 size-4 shrink-0 text-success" />
							{feature}
						</li>
					))}
				</ul>
				{action}
			</CardContent>
		</Card>
	);
}
