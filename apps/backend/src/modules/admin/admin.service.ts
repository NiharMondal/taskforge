import PrismaQueryBuilder from "@/lib/PrismQueryBuilder";
import { PrismaService } from "@/prisma/prisma.service";
import { Injectable, NotFoundException } from "@nestjs/common";
import {
  ADMIN_DETAIL_LIST_LIMIT,
  effectivePlan,
  LIVE_SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_PLAN_VALUES,
  SUBSCRIPTION_STATUS_VALUES,
  type SubscriptionPlan,
  type SubscriptionStatus,
} from "@taskforge/shared";
import type { Prisma } from "generated/prisma/client";
import { InvitationStatus, WorkspaceRole } from "generated/prisma/enums";
import { StripeService } from "../billing/stripe.service";
import {
  QueryAdminUsersDto,
  QueryAdminWorkspacesDto,
} from "./dto/admin-query.dto";

/**
 * Read-only views across every workspace and account, for platform staff
 * (`spec/admin-spec.md`). This is the one place that reads other tenants'
 * rows on purpose: nothing here is scoped to a workspace, so nothing here may
 * be reachable without `@RequirePlatformRole` (see AdminController).
 *
 * Every query lists the columns it returns (`select`, never `include` of a
 * whole row), so a password hash, refresh token or reset token can't reach a
 * response by a column being added later.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const LIVE_STATUSES = [...LIVE_SUBSCRIPTION_STATUSES];

/**
 * The workspaces whose plan in force (`effectivePlan`) is `plan`: a paid plan
 * needs a live subscription; Free is everything else — no subscription, a
 * stored FREE, no status yet, or a status that isn't live.
 */
export function effectivePlanWhere(
  plan: SubscriptionPlan,
): Prisma.WorkspaceWhereInput {
  if (plan !== "FREE") {
    return { subscription: { is: { plan, status: { in: LIVE_STATUSES } } } };
  }
  return {
    OR: [
      { subscription: { is: null } },
      { subscription: { is: { plan: "FREE" } } },
      // `notIn` doesn't match NULL in SQL, so a missing status is its own case.
      { subscription: { is: { status: null } } },
      { subscription: { is: { status: { notIn: LIVE_STATUSES } } } },
    ],
  };
}

/** The workspace's owner. `Membership.role` is kept OWNER for them. */
const OWNER_MEMBERSHIP = { role: WorkspaceRole.OWNER } as const;

const USER_SUMMARY_SELECT = {
  id: true,
  name: true,
  email: true,
} as const satisfies Prisma.UserSelect;

const ROLE_SUMMARY_SELECT = {
  id: true,
  name: true,
  systemKey: true,
} as const satisfies Prisma.RoleSelect;

const WORKSPACE_ROW_SELECT = {
  id: true,
  name: true,
  slug: true,
  createdAt: true,
  subscription: {
    select: {
      plan: true,
      status: true,
      seats: true,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: true,
    },
  },
  memberships: {
    where: OWNER_MEMBERSHIP,
    take: 1,
    select: { user: { select: USER_SUMMARY_SELECT } },
  },
  _count: { select: { memberships: true } },
} as const satisfies Prisma.WorkspaceSelect;

type WorkspaceRow = Prisma.WorkspaceGetPayload<{
  select: typeof WORKSPACE_ROW_SELECT;
}>;

const USER_ROW_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  emailVerifiedAt: true,
  platformRole: true,
  createdAt: true,
  // The provider only: never the password hash or the provider's account id.
  auths: { select: { provider: true }, orderBy: { createdAt: "asc" } },
  _count: { select: { memberships: true } },
} as const satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof USER_ROW_SELECT }>;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
  ) {}

  /**
   * Platform totals: users (and how many are new), workspaces by the plan in
   * force, and subscriptions by Stripe status.
   */
  async stats() {
    const now = Date.now();
    const since = (days: number) => ({
      createdAt: { gte: new Date(now - days * DAY_MS) },
    });

    const [
      users,
      newLast7Days,
      newLast30Days,
      platformStaff,
      workspaces,
      groups,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: since(7) }),
      this.prisma.user.count({ where: since(30) }),
      this.prisma.user.count({ where: { platformRole: { not: null } } }),
      this.prisma.workspace.count(),
      this.prisma.subscription.groupBy({
        by: ["plan", "status"],
        _count: { _all: true },
      }),
    ]);

    const byPlan = Object.fromEntries(
      SUBSCRIPTION_PLAN_VALUES.map((plan) => [plan, 0]),
    ) as Record<SubscriptionPlan, number>;
    const byStatus = Object.fromEntries(
      SUBSCRIPTION_STATUS_VALUES.map((status) => [status, 0]),
    ) as Record<SubscriptionStatus, number>;
    let withSubscription = 0;
    let noStatus = 0;

    for (const group of groups) {
      const count = group._count._all;
      withSubscription += count;
      byPlan[effectivePlan(group)] += count;
      if (group.status) byStatus[group.status] += count;
      else noStatus += count;
    }
    // A workspace that never started a checkout has no row, and is Free.
    byPlan.FREE += workspaces - withSubscription;

    return {
      users: { total: users, newLast7Days, newLast30Days, platformStaff },
      workspaces: { total: workspaces, byPlan },
      // `noStatus`: a checkout was started (a Stripe customer exists) but
      // nothing was subscribed.
      subscriptions: { total: withSubscription, byStatus, noStatus },
    };
  }

  /** Every workspace, newest first, with its owner, size and plan. */
  async findWorkspaces(query: QueryAdminWorkspacesDto) {
    const where: Prisma.WorkspaceWhereInput[] = [];
    if (query.search) {
      const contains = { contains: query.search, mode: "insensitive" } as const;
      where.push({
        OR: [
          { id: query.search },
          { name: contains },
          {
            memberships: {
              some: { ...OWNER_MEMBERSHIP, user: { email: contains } },
            },
          },
        ],
      });
    }
    if (query.plan) where.push(effectivePlanWhere(query.plan));

    const { data, metaData } =
      await new PrismaQueryBuilder<Prisma.WorkspaceWhereInput>(query, {
        defaultField: "createdAt",
        defaultOrder: "desc",
      })
        .withDefaultFilter({ AND: where })
        .paginate()
        .sort()
        .select(WORKSPACE_ROW_SELECT)
        .execute(this.prisma.workspace);

    return {
      data: (data as WorkspaceRow[]).map(
        ({ memberships, _count, subscription, ...workspace }) => ({
          ...workspace,
          owner: memberships[0]?.user ?? null,
          memberCount: _count.memberships,
          plan: effectivePlan(subscription),
          subscription,
        }),
      ),
      metaData,
    };
  }

  /**
   * One workspace: its owner, members, projects and counts, and the
   * subscription with its Stripe ids, and which Stripe mode those ids live in
   * (`stripeMode`, for a dashboard link). Members and projects are capped at
   * `ADMIN_DETAIL_LIST_LIMIT`; `counts` has the totals.
   */
  async findWorkspace(id: string) {
    const [workspace, owner] = await Promise.all([
      this.prisma.workspace.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          subscription: {
            select: {
              plan: true,
              status: true,
              stripeCustomerId: true,
              stripeSubscriptionId: true,
              seats: true,
              currentPeriodEnd: true,
              cancelAtPeriodEnd: true,
              trialEndsAt: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          memberships: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: ADMIN_DETAIL_LIST_LIMIT,
            select: {
              id: true,
              role: true,
              createdAt: true,
              assignedRole: { select: ROLE_SUMMARY_SELECT },
              user: {
                select: { ...USER_SUMMARY_SELECT, avatarUrl: true },
              },
            },
          },
          projects: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: ADMIN_DETAIL_LIST_LIMIT,
            select: {
              id: true,
              name: true,
              key: true,
              createdAt: true,
              _count: { select: { issues: true, sprints: true } },
            },
          },
          _count: {
            select: {
              memberships: true,
              projects: true,
              issues: true,
              sprints: true,
              labels: true,
              roles: { where: { systemKey: null } },
              invitations: {
                where: {
                  status: InvitationStatus.PENDING,
                  expiresAt: { gt: new Date() },
                },
              },
            },
          },
        },
      }),
      this.prisma.membership.findFirst({
        where: { workspaceId: id, ...OWNER_MEMBERSHIP },
        select: { user: { select: USER_SUMMARY_SELECT } },
      }),
    ]);

    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    const { memberships, projects, _count, subscription, ...rest } = workspace;
    return {
      ...rest,
      plan: effectivePlan(subscription),
      owner: owner?.user ?? null,
      subscription,
      stripeMode: this.stripe.mode(),
      counts: {
        members: _count.memberships,
        projects: _count.projects,
        issues: _count.issues,
        sprints: _count.sprints,
        labels: _count.labels,
        customRoles: _count.roles,
        pendingInvitations: _count.invitations,
      },
      members: memberships.map(({ createdAt, ...member }) => ({
        ...member,
        isOwner: member.role === WorkspaceRole.OWNER,
        joinedAt: createdAt,
      })),
      projects: projects.map(({ _count: counts, ...project }) => ({
        ...project,
        issueCount: counts.issues,
        sprintCount: counts.sprints,
      })),
    };
  }

  /** Every account, newest first. */
  async findUsers(query: QueryAdminUsersDto) {
    const where: Prisma.UserWhereInput = query.search
      ? {
          OR: [
            { id: query.search },
            { name: { contains: query.search, mode: "insensitive" } },
            { email: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {};

    const { data, metaData } =
      await new PrismaQueryBuilder<Prisma.UserWhereInput>(query, {
        defaultField: "createdAt",
        defaultOrder: "desc",
      })
        .withDefaultFilter(where)
        .paginate()
        .sort()
        .select(USER_ROW_SELECT)
        .execute(this.prisma.user);

    return {
      data: (data as UserRow[]).map(({ auths, _count, ...user }) => ({
        ...user,
        signInMethods: auths.map((auth) => auth.provider),
        workspaceCount: _count.memberships,
      })),
      metaData,
    };
  }

  /**
   * One account: sign-in methods, memberships (each workspace with its plan),
   * how much they've written, and how many sessions are live. Never a hash or
   * a token.
   */
  async findUser(id: string) {
    const [user, activeSessions] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
          emailVerifiedAt: true,
          platformRole: true,
          createdAt: true,
          updatedAt: true,
          auths: {
            select: { provider: true, createdAt: true },
            orderBy: { createdAt: "asc" },
          },
          memberships: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: ADMIN_DETAIL_LIST_LIMIT,
            select: {
              id: true,
              role: true,
              createdAt: true,
              assignedRole: { select: ROLE_SUMMARY_SELECT },
              workspace: {
                select: {
                  id: true,
                  name: true,
                  subscription: { select: { plan: true, status: true } },
                  _count: { select: { memberships: true } },
                },
              },
            },
          },
          _count: {
            select: {
              memberships: true,
              createdIssues: true,
              assignedIssues: true,
              comments: true,
            },
          },
        },
      }),
      // Refresh tokens still usable: one per signed-in device or browser.
      this.prisma.refreshToken.count({
        where: {
          userId: id,
          revokedAt: null,
          replacedAt: null,
          expiresAt: { gt: new Date() },
        },
      }),
    ]);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const { auths, memberships, _count, ...profile } = user;
    return {
      ...profile,
      signInMethods: auths.map(({ provider, createdAt }) => ({
        provider,
        addedAt: createdAt,
      })),
      counts: {
        workspaces: _count.memberships,
        reportedIssues: _count.createdIssues,
        assignedIssues: _count.assignedIssues,
        comments: _count.comments,
        activeSessions,
      },
      memberships: memberships.map(
        ({
          createdAt,
          workspace: { subscription, _count: counts, ...workspace },
          ...membership
        }) => ({
          ...membership,
          isOwner: membership.role === WorkspaceRole.OWNER,
          joinedAt: createdAt,
          workspace: {
            ...workspace,
            plan: effectivePlan(subscription),
            memberCount: counts.memberships,
          },
        }),
      ),
    };
  }
}
