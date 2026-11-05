import {
  effectivePlan,
  FREE_OWNED_WORKSPACES,
  PLAN_LIMIT_ERROR_CODE,
  PLAN_LIMITS,
  type PlanLimitKind,
  type SubscriptionPlan,
} from "@taskforge/shared";
import { HttpException, HttpStatus } from "@nestjs/common";
import type { Prisma } from "generated/prisma/client";
import { InvitationStatus, WorkspaceRole } from "generated/prisma/enums";

type Db = Pick<
  Prisma.TransactionClient,
  "subscription" | "membership" | "invitation"
>;

/**
 * A write the workspace's plan doesn't allow: 402 with
 * `{ message, code: "PLAN_LIMIT", limit }`, so a client can tell "upgrade
 * needed" from "not allowed" (403).
 */
export class PlanLimitException extends HttpException {
  constructor(limit: PlanLimitKind, message: string) {
    super(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        message,
        code: PLAN_LIMIT_ERROR_CODE,
        limit,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}

/** The plan the workspace gets now (no row, or a lapsed subscription, is FREE). */
export async function getWorkspacePlan(
  db: Db,
  workspaceId: string,
): Promise<SubscriptionPlan> {
  const subscription = await db.subscription.findUnique({
    where: { workspaceId },
    select: { plan: true, status: true },
  });
  return effectivePlan(subscription);
}

/**
 * Members and live pending invitations — what the member limit counts. A
 * PENDING invitation past its expiry is dead (nothing flips it to EXPIRED
 * until its link is opened), so it holds no seat.
 */
export async function countSeatsTaken(db: Db, workspaceId: string) {
  const [members, pendingInvitations] = await Promise.all([
    db.membership.count({ where: { workspaceId } }),
    db.invitation.count({
      where: {
        workspaceId,
        status: InvitationStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
    }),
  ]);
  return { members, pendingInvitations };
}

/** Before an invitation: one more seat must fit the plan. */
export async function assertCanAddMember(db: Db, workspaceId: string) {
  const limit = PLAN_LIMITS[await getWorkspacePlan(db, workspaceId)].members;
  if (limit === null) return;

  const { members, pendingInvitations } = await countSeatsTaken(
    db,
    workspaceId,
  );
  if (members + pendingInvitations >= limit) {
    throw new PlanLimitException(
      "members",
      `The Free plan allows up to ${limit} members, including pending invitations. Upgrade to Pro to invite more.`,
    );
  }
}

export async function assertCanCreateCustomRole(db: Db, workspaceId: string) {
  const plan = await getWorkspacePlan(db, workspaceId);
  if (!PLAN_LIMITS[plan].customRoles) {
    throw new PlanLimitException(
      "customRoles",
      "Custom roles are part of the Pro plan. Upgrade to create one.",
    );
  }
}

/**
 * Before editing a project's workflow, or creating a project from another's:
 * Free projects keep the default. A workflow customized on Pro keeps working
 * after a downgrade; it just can't be changed.
 */
export async function assertCanCustomizeWorkflow(db: Db, workspaceId: string) {
  const plan = await getWorkspacePlan(db, workspaceId);
  if (!PLAN_LIMITS[plan].customWorkflows) {
    throw new PlanLimitException(
      "customWorkflows",
      "Custom workflows are part of the Pro plan. Upgrade to change a project's statuses.",
    );
  }
}

/**
 * Before creating a workspace: the caller may own at most
 * FREE_OWNED_WORKSPACES Free ones (the new one would be Free too). Paid
 * workspaces they own don't count.
 */
export async function assertCanOwnAnotherFreeWorkspace(db: Db, userId: string) {
  const owned = await db.membership.findMany({
    where: { userId, role: WorkspaceRole.OWNER },
    select: {
      workspace: {
        select: { subscription: { select: { plan: true, status: true } } },
      },
    },
  });
  const free = owned.filter(
    (m) => effectivePlan(m.workspace.subscription) === "FREE",
  ).length;

  if (free >= FREE_OWNED_WORKSPACES) {
    throw new PlanLimitException(
      "ownedWorkspaces",
      `You already own ${FREE_OWNED_WORKSPACES} workspaces on the Free plan. Upgrade one of them to Pro to create another.`,
    );
  }
}
