import { PRO_TRIAL_DAYS } from "@taskforge/shared";
import type { Metadata } from "next";
import Link from "next/link";

import { PLAN_ORDER } from "@/features/billing/constants";
import ContactSalesLink from "@/features/billing/components/ContactSalesLink";
import PlanCard from "@/features/billing/components/PlanCard";
import type { SubscriptionPlan } from "@/features/billing/types/billing-types";
import { PRIMARY_LINK, SECONDARY_LINK } from "@/features/marketing/constants";

export const metadata: Metadata = {
	title: "Pricing · TaskForge",
};

/**
 * The public plan cards: the same `PLAN_META` as Settings → Billing. Free and
 * Pro start with an account (Pro is bought from inside a workspace, where the
 * trial starts); Enterprise is by email.
 */
export default function PricingPage() {
	return (
		<div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16">
			<header className="mx-auto flex max-w-2xl flex-col gap-3 text-center">
				<h1 className="text-4xl font-semibold tracking-tight">Pricing</h1>
				<p className="text-muted">
					Start free. Upgrade a workspace to Pro when your team needs more
					seats, custom roles or custom workflows; the first upgrade comes
					with a {PRO_TRIAL_DAYS}-day free trial.
				</p>
			</header>
			<div className="grid gap-4 lg:grid-cols-3">
				{PLAN_ORDER.map((plan) => (
					<PlanCard key={plan} plan={plan} action={<PlanAction plan={plan} />} />
				))}
			</div>
		</div>
	);
}

function PlanAction({ plan }: { plan: SubscriptionPlan }) {
	switch (plan) {
		case "FREE":
			return (
				<Link href="/register" className={SECONDARY_LINK}>
					Get started free
				</Link>
			);
		case "PRO":
			return (
				<Link href="/register" className={PRIMARY_LINK}>
					Start your free trial
				</Link>
			);
		case "ENTERPRISE":
			return <ContactSalesLink />;
	}
}
