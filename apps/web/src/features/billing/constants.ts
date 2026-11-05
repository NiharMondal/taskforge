import {
	FREE_OWNED_WORKSPACES,
	PLAN_LIMITS,
	PRO_TRIAL_DAYS,
} from "@taskforge/shared";

import type { SubscriptionPlan, SubscriptionStatus } from "./types/billing-types";

interface PlanMeta {
	name: string;
	price: string;
	tagline: string;
	features: string[];
}

const seats = (plan: SubscriptionPlan) => {
	const limit = PLAN_LIMITS[plan].members;
	return limit === null
		? "Unlimited members"
		: `Up to ${limit} members, including pending invitations`;
};

/** The plan cards on Settings → Billing. Limits come from `@taskforge/shared`. */
export const PLAN_META: Record<SubscriptionPlan, PlanMeta> = {
	FREE: {
		name: "Free",
		price: "$0",
		tagline: "For trying TaskForge with a small team.",
		features: [
			seats("FREE"),
			"Unlimited projects, issues, sprints and labels",
			"Built-in roles",
			"The default workflow on every project",
			`Own up to ${FREE_OWNED_WORKSPACES} Free workspaces`,
		],
	},
	PRO: {
		name: "Pro",
		// The amount is set on the Stripe price, so it is shown at checkout.
		price: "Per member / month",
		tagline: `For growing teams. ${PRO_TRIAL_DAYS}-day free trial on your first upgrade.`,
		features: [
			seats("PRO"),
			"Everything in Free",
			"Custom roles",
			"Custom workflows: each project's own statuses and moves",
			"Doesn't count toward your Free workspaces",
		],
	},
	ENTERPRISE: {
		name: "Enterprise",
		price: "Custom",
		tagline: "For organizations that need a contract and invoicing.",
		features: [seats("ENTERPRISE"), "Everything in Pro", "Set up with our team"],
	},
};

export const PLAN_ORDER: SubscriptionPlan[] = ["FREE", "PRO", "ENTERPRISE"];

export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
	ACTIVE: "Active",
	TRIALING: "Trial",
	PAST_DUE: "Payment failed",
	UNPAID: "Unpaid",
	CANCELED: "Canceled",
	INCOMPLETE: "Incomplete",
	INCOMPLETE_EXPIRED: "Expired",
	PAUSED: "Paused",
};

/**
 * Where "Contact us" on the Enterprise card writes to. Unset hides the link;
 * Enterprise is set up by hand, never self-serve.
 */
export const SALES_EMAIL = process.env.NEXT_PUBLIC_SALES_EMAIL;

/** How long the page waits for Stripe's webhook after a checkout. */
export const ACTIVATION_POLL_MS = 2_000;
export const ACTIVATION_TIMEOUT_MS = 30_000;
