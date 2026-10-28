/**
 * Workspace quota for the FREE plan (see `SubscriptionPlan` in
 * apps/backend/prisma/schema.prisma). Users at the limit must subscribe before
 * creating more — the backend has no subscriptions routes yet, so the gate is
 * enforced client-side for now.
 */
export const FREE_PLAN_WORKSPACE_LIMIT = 2;
