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

/**
 * Before an invitation: one more seat must fit the plan. Call it inside the
 * transaction that writes the invitation: it locks the workspace's seats
 * until that transaction ends, so two invitations sent at the same moment
 * can't both count the same free seat.
 */
export async function assertCanAddMember(
  db: Db & Pick<Prisma.TransactionClient, "$executeRaw">,
  workspaceId: string,
) {
  const lock = `workspace-seats:${workspaceId}`;
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock}::text, 0))`;

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
 * Before someone comes to own another Free workspace: the creator of a new
 * one (it starts Free), or the member a Free workspace is being transferred
 * to. Nobody owns more than FREE_OWNED_WORKSPACES Free ones; paid workspaces
 * they own don't count. For a transfer, pass `transferredWorkspaceId`: it is
 * left out of the count, so the check holds whether or not the new owner's
 * membership has been promoted yet.
 */
export async function assertCanOwnAnotherFreeWorkspace(
  db: Db,
  userId: string,
  transferredWorkspaceId?: string,
) {
  const owned = await db.membership.findMany({
    where: {
      userId,
      role: WorkspaceRole.OWNER,
      ...(transferredWorkspaceId && {
        workspaceId: { not: transferredWorkspaceId },
      }),
    },
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
      transferredWorkspaceId
        ? `This member already owns ${FREE_OWNED_WORKSPACES} workspaces on the Free plan, so they can't take over another Free one. Upgrade this workspace to Pro first, or ask them to upgrade one of theirs.`
        : `You already own ${FREE_OWNED_WORKSPACES} workspaces on the Free plan. Upgrade one of them to Pro to create another.`,
    );
  }
}
