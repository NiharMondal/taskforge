/**
 * Workspace quota for the FREE plan (see `SubscriptionPlan` in
 * .claude/schema.prisma). Users at the limit must subscribe before creating
 * more — the Subscriptions endpoint is still "Upcoming" in BACK_END_API.md, so
 * the gate is enforced client-side for now.
 */
export const FREE_PLAN_WORKSPACE_LIMIT = 2;
