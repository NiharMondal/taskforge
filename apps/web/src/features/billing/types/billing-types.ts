import type {
	PlanLimits,
	SubscriptionPlan,
	SubscriptionStatus,
} from "@taskforge/shared";

/** The schema's plan and subscription enums (via `@taskforge/shared`). */
export type { SubscriptionPlan, SubscriptionStatus };

/** `GET /billing` — the active workspace's plan, readable by any member. */
export interface Billing {
	/** The plan in force now: a lapsed subscription is FREE. */
	plan: SubscriptionPlan;
	/** Stripe's status, or null when the workspace never subscribed. */
	status: SubscriptionStatus | null;
	/** Members Stripe bills for. */
	seats: number | null;
	currentPeriodEnd: string | null;
	cancelAtPeriodEnd: boolean;
	trialEndsAt: string | null;
	/** Whether a checkout now would start with the free trial. */
	trialAvailable: boolean;
	/** Whether there is a Stripe customer for "Manage billing" to open. */
	hasBillingAccount: boolean;
	/** Whether this deployment has Stripe keys; checkout answers 503 without. */
	billingEnabled: boolean;
	limits: PlanLimits;
	usage: { members: number; pendingInvitations: number };
}

/** `POST /billing/checkout` and `/billing/portal`: a Stripe-hosted page. */
export interface BillingRedirect {
	url: string;
}
