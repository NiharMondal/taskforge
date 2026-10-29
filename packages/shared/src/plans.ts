import type { SubscriptionPlan, SubscriptionStatus } from "./enums";

/**
 * What each plan allows. The backend enforces these (a limit hit is a 402
 * carrying {@link PLAN_LIMIT_ERROR_CODE}); the web's plan cards show them.
 * Everything not listed here (projects, issues, sprints, labels, comments) is
 * unlimited on every plan.
 */
export interface PlanLimits {
  /** Members plus live pending invitations; `null` is unlimited. */
  members: number | null;
  /** Whether custom roles can be created (built-ins exist on every plan). */
  customRoles: boolean;
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  FREE: { members: 5, customRoles: false },
  PRO: { members: null, customRoles: true },
  ENTERPRISE: { members: null, customRoles: true },
};

/**
 * How many Free workspaces one person may own, counting the one created with
 * their account. Paid workspaces don't count.
 */
export const FREE_OWNED_WORKSPACES = 2;

/**
 * Days of Pro free at a workspace's first checkout. A workspace that has had a
 * subscription before checks out without one.
 */
export const PRO_TRIAL_DAYS = 14;

/** `code` on the 402 body when a plan limit refuses a write. */
export const PLAN_LIMIT_ERROR_CODE = "PLAN_LIMIT";

/** Which limit a 402 `PLAN_LIMIT` refers to (`limit` on its body). */
export type PlanLimitKind = "members" | "customRoles" | "ownedWorkspaces";

/**
 * Statuses that keep a paid plan in force. `PAST_DUE` is included: Stripe
 * retries the card for about two weeks, and the workspace keeps its plan
 * meanwhile.
 */
export const LIVE_SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  "ACTIVE",
  "TRIALING",
  "PAST_DUE",
];

export function isLiveSubscriptionStatus(
  status: SubscriptionStatus | null | undefined,
): boolean {
  return !!status && LIVE_SUBSCRIPTION_STATUSES.includes(status);
}

/**
 * The plan a workspace actually gets: its stored plan while the subscription
 * is live, else FREE. No row (never subscribed) is FREE.
 */
export function effectivePlan(
  subscription:
    | { plan: SubscriptionPlan; status: SubscriptionStatus | null }
    | null
    | undefined,
): SubscriptionPlan {
  if (!subscription || !isLiveSubscriptionStatus(subscription.status)) {
    return "FREE";
  }
  return subscription.plan;
}
