import { PrismaService } from "@/prisma/prisma.service";
import { NotFoundException } from "@nestjs/common";
import {
  effectivePlan,
  SUBSCRIPTION_PLAN_VALUES,
  SUBSCRIPTION_STATUS_VALUES,
  type SubscriptionPlan,
  type SubscriptionStatus,
} from "@taskforge/shared";
import type { Prisma } from "generated/prisma/client";
import { WorkspaceRole } from "generated/prisma/enums";
import { StripeService } from "../billing/stripe.service";
import { AdminService, effectivePlanWhere } from "./admin.service";

/** Columns and relations that hold credentials; no admin query may select one. */
const SECRET_KEYS = [
  "password",
  "passwordHash",
  "tokenHash",
  "token",
  "providerId",
  "refreshTokens",
  "passwordResets",
];

/** Every key anywhere in a (nested) Prisma argument object. */
function keysOf(value: unknown, into: string[] = []): string[] {
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      into.push(key);
      keysOf(nested, into);
    }
  }
  return into;
}

describe("AdminService", () => {
  let prisma: {
    user: { count: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock };
    workspace: { count: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock };
    subscription: { groupBy: jest.Mock };
    membership: { findFirst: jest.Mock };
    refreshToken: { count: jest.Mock };
  };
  let service: AdminService;

  beforeEach(() => {
    prisma = {
      user: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      workspace: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      subscription: { groupBy: jest.fn().mockResolvedValue([]) },
      membership: { findFirst: jest.fn().mockResolvedValue(null) },
      refreshToken: { count: jest.fn().mockResolvedValue(0) },
    };
    service = new AdminService(
      prisma as unknown as PrismaService,
      { mode: () => "test" } as unknown as StripeService,
    );
  });

  /** Every argument any query was called with. */
  const allQueryArgs = (): unknown[] =>
    Object.values(prisma).flatMap((model) =>
      Object.values(model as Record<string, jest.Mock>).flatMap(
        (fn) => fn.mock.calls as unknown[],
      ),
    );

  describe("stats", () => {
    it("counts users, workspaces by the plan in force, and subscriptions by status", async () => {
      jest.useFakeTimers({ now: new Date("2026-11-02T12:00:00Z") });
      prisma.user.count.mockImplementation(
        (args?: { where?: Record<string, unknown> }) => {
          const where = args?.where ?? {};
          if ("platformRole" in where) return Promise.resolve(2);
          if ("suspendedAt" in where) return Promise.resolve(1);
          const gte = (where.createdAt as { gte?: Date } | undefined)?.gte;
          if (!gte) return Promise.resolve(40);
          // 7 days back → 3 new, 30 days back → 9 new.
          return Promise.resolve(
            gte.toISOString() === "2026-10-26T12:00:00.000Z" ? 3 : 9,
          );
        },
      );
      prisma.workspace.count.mockImplementation((args?: { where?: object }) =>
        Promise.resolve(args?.where ? 2 : 10),
      );
      prisma.subscription.groupBy.mockResolvedValue([
        { plan: "PRO", status: "ACTIVE", _count: { _all: 3 } },
        { plan: "PRO", status: "PAST_DUE", _count: { _all: 1 } },
        { plan: "PRO", status: "CANCELED", _count: { _all: 2 } },
        { plan: "ENTERPRISE", status: "TRIALING", _count: { _all: 1 } },
        { plan: "FREE", status: null, _count: { _all: 1 } },
      ]);

      const stats = await service.stats();
      jest.useRealTimers();

      expect(stats.users).toEqual({
        total: 40,
        newLast7Days: 3,
        newLast30Days: 9,
        platformStaff: 2,
        suspended: 1,
      });
      // 8 rows with a subscription, 2 workspaces without one (Free).
      expect(stats.workspaces).toEqual({
        total: 10,
        byPlan: { FREE: 5, PRO: 4, ENTERPRISE: 1 },
        suspended: 2,
      });
      expect(stats.subscriptions).toMatchObject({
        total: 8,
        noStatus: 1,
        byStatus: {
          ACTIVE: 3,
          PAST_DUE: 1,
          CANCELED: 2,
          TRIALING: 1,
          UNPAID: 0,
        },
      });
    });
  });

  describe("effectivePlanWhere", () => {
    type Sub = { plan: SubscriptionPlan; status: SubscriptionStatus | null };

    /** Evaluates the shapes effectivePlanWhere builds against one workspace. */
    function matches(
      where: Prisma.WorkspaceWhereInput,
      sub: Sub | null,
    ): boolean {
      if (where.OR) return where.OR.some((w) => matches(w, sub));
      const filter = (where.subscription as { is: unknown }).is as null | {
        plan?: SubscriptionPlan;
        status?: null | { in?: string[]; notIn?: string[] };
      };
      if (filter === null) return sub === null;
      if (!sub) return false;
      if (filter.plan !== undefined && filter.plan !== sub.plan) return false;
      if (filter.status === null) return sub.status === null;
      if (filter.status?.in) {
        return sub.status !== null && filter.status.in.includes(sub.status);
      }
      if (filter.status?.notIn) {
        return sub.status !== null && !filter.status.notIn.includes(sub.status);
      }
      return true;
    }

    const subscriptions: (Sub | null)[] = [
      null,
      ...SUBSCRIPTION_PLAN_VALUES.flatMap((plan) =>
        [null, ...SUBSCRIPTION_STATUS_VALUES].map((status) => ({
          plan,
          status,
        })),
      ),
    ];

    it.each(SUBSCRIPTION_PLAN_VALUES)(
      "matches exactly the workspaces effectivePlan calls %s",
      (plan) => {
        for (const sub of subscriptions) {
          expect([sub, matches(effectivePlanWhere(plan), sub)]).toEqual([
            sub,
            effectivePlan(sub) === plan,
          ]);
        }
      },
    );
  });

  describe("findWorkspaces", () => {
    it("returns each workspace with its owner, member count and plan in force", async () => {
      const createdAt = new Date("2026-10-01");
      prisma.workspace.findMany.mockResolvedValue([
        {
          id: "ws-1",
          name: "Acme",
          slug: "acme",
          createdAt,
          subscription: {
            plan: "PRO",
            status: "CANCELED",
            seats: 3,
            cancelAtPeriodEnd: false,
            currentPeriodEnd: null,
          },
          memberships: [{ user: { id: "u-1", name: "Ann", email: "a@x.io" } }],
          _count: { memberships: 3 },
        },
        {
          id: "ws-2",
          name: "Solo",
          slug: "solo",
          createdAt,
          subscription: null,
          memberships: [],
          _count: { memberships: 1 },
        },
      ]);
      prisma.workspace.count.mockResolvedValue(2);

      const { data, metaData } = await service.findWorkspaces({
        page: 1,
        limit: 20,
      });

      expect(data).toEqual([
        {
          id: "ws-1",
          name: "Acme",
          slug: "acme",
          createdAt,
          owner: { id: "u-1", name: "Ann", email: "a@x.io" },
          memberCount: 3,
          plan: "FREE", // canceled: Pro no longer in force
          subscription: expect.objectContaining({
            plan: "PRO",
            seats: 3,
          }) as unknown,
        },
        expect.objectContaining({ id: "ws-2", owner: null, plan: "FREE" }),
      ]);
      expect(metaData).toMatchObject({ totalData: 2 });
    });

    it("searches the name, the owner's email or the exact id, and filters by plan", async () => {
      await service.findWorkspaces({
        search: "acme",
        plan: "PRO",
        page: 1,
        limit: 20,
      });

      const [{ where }] = prisma.workspace.findMany.mock.calls[0] as [
        { where: Prisma.WorkspaceWhereInput },
      ];
      const contains = { contains: "acme", mode: "insensitive" };
      expect(where).toEqual({
        AND: [
          {
            OR: [
              { id: "acme" },
              { name: contains },
              {
                memberships: {
                  some: {
                    role: WorkspaceRole.OWNER,
                    user: { email: contains },
                  },
                },
              },
            ],
          },
          effectivePlanWhere("PRO"),
        ],
      });
    });
  });

  describe("findWorkspace", () => {
    it("404s an unknown workspace", async () => {
      await expect(service.findWorkspace("nope")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("returns members, projects, counts and the subscription's Stripe ids", async () => {
      const at = new Date("2026-10-01");
      prisma.workspace.findUnique.mockResolvedValue({
        id: "ws-1",
        name: "Acme",
        slug: "acme",
        description: null,
        createdAt: at,
        updatedAt: at,
        subscription: {
          plan: "PRO",
          status: "ACTIVE",
          stripeCustomerId: "cus_1",
          stripeSubscriptionId: "sub_1",
          seats: 2,
          currentPeriodEnd: at,
          cancelAtPeriodEnd: false,
          trialEndsAt: null,
          createdAt: at,
          updatedAt: at,
        },
        memberships: [
          {
            id: "m-1",
            role: "OWNER",
            createdAt: at,
            assignedRole: { id: "r-1", name: "Owner", systemKey: "OWNER" },
            user: { id: "u-1", name: "Ann", email: "a@x.io", avatarUrl: null },
          },
        ],
        projects: [
          {
            id: "p-1",
            name: "Web",
            key: "WEB",
            createdAt: at,
            _count: { issues: 12, sprints: 2 },
          },
        ],
        _count: {
          memberships: 2,
          projects: 1,
          issues: 12,
          sprints: 2,
          labels: 4,
          roles: 1,
          invitations: 1,
        },
      });
      prisma.membership.findFirst.mockResolvedValue({
        user: { id: "u-1", name: "Ann", email: "a@x.io" },
      });

      const workspace = await service.findWorkspace("ws-1");

      expect(workspace).toMatchObject({
        id: "ws-1",
        plan: "PRO",
        owner: { id: "u-1" },
        subscription: {
          stripeCustomerId: "cus_1",
          stripeSubscriptionId: "sub_1",
        },
        stripeMode: "test",
        counts: {
          members: 2,
          projects: 1,
          issues: 12,
          sprints: 2,
          labels: 4,
          customRoles: 1,
          pendingInvitations: 1,
        },
        members: [{ id: "m-1", isOwner: true, joinedAt: at }],
        projects: [{ id: "p-1", issueCount: 12, sprintCount: 2 }],
      });
      // The owner lookup is the workspace's own.
      expect(prisma.membership.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: "ws-1", role: WorkspaceRole.OWNER },
        }),
      );
    });
  });

  describe("findUsers", () => {
    it("lists sign-in methods by provider only, and how many workspaces", async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          id: "u-1",
          name: "Ann",
          email: "a@x.io",
          avatarUrl: null,
          emailVerifiedAt: null,
          platformRole: null,
          createdAt: new Date(),
          auths: [{ provider: "EMAIL" }, { provider: "GOOGLE" }],
          _count: { memberships: 2 },
        },
      ]);

      const { data } = await service.findUsers({
        search: "ann",
        page: 1,
        limit: 20,
      });

      expect(data[0]).toMatchObject({
        id: "u-1",
        signInMethods: ["EMAIL", "GOOGLE"],
        workspaceCount: 2,
      });
      expect(data[0]).not.toHaveProperty("auths");
      const [{ where }] = prisma.user.findMany.mock.calls[0] as [
        { where: unknown },
      ];
      expect(where).toEqual({
        OR: [
          { id: "ann" },
          { name: { contains: "ann", mode: "insensitive" } },
          { email: { contains: "ann", mode: "insensitive" } },
        ],
      });
    });
  });

  describe("findUser", () => {
    it("404s an unknown user", async () => {
      await expect(service.findUser("nope")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("returns memberships with each workspace's plan, counts and live sessions", async () => {
      const at = new Date("2026-10-01");
      prisma.user.findUnique.mockResolvedValue({
        id: "u-1",
        name: "Ann",
        email: "a@x.io",
        avatarUrl: null,
        emailVerifiedAt: at,
        platformRole: "SUPPORT",
        createdAt: at,
        updatedAt: at,
        auths: [{ provider: "EMAIL", createdAt: at }],
        memberships: [
          {
            id: "m-1",
            role: "MEMBER",
            createdAt: at,
            assignedRole: null,
            workspace: {
              id: "ws-1",
              name: "Acme",
              subscription: { plan: "PRO", status: "TRIALING" },
              _count: { memberships: 4 },
            },
          },
        ],
        _count: {
          memberships: 1,
          createdIssues: 5,
          assignedIssues: 2,
          comments: 7,
        },
      });
      prisma.refreshToken.count.mockResolvedValue(2);

      const user = await service.findUser("u-1");

      expect(user).toMatchObject({
        id: "u-1",
        platformRole: "SUPPORT",
        signInMethods: [{ provider: "EMAIL", addedAt: at }],
        counts: {
          workspaces: 1,
          reportedIssues: 5,
          assignedIssues: 2,
          comments: 7,
          activeSessions: 2,
        },
        memberships: [
          {
            id: "m-1",
            isOwner: false,
            joinedAt: at,
            workspace: {
              id: "ws-1",
              name: "Acme",
              plan: "PRO",
              memberCount: 4,
            },
          },
        ],
      });
      // Only tokens still usable count as sessions.
      expect(prisma.refreshToken.count).toHaveBeenCalledWith({
        where: {
          userId: "u-1",
          revokedAt: null,
          replacedAt: null,
          expiresAt: { gt: expect.any(Date) as Date },
        },
      });
    });
  });

  it("never selects a password hash, token or provider account id", async () => {
    await service.stats();
    await service.findWorkspaces({
      search: "x",
      plan: "FREE",
      page: 1,
      limit: 20,
    });
    await service.findWorkspace("ws-1").catch(() => undefined);
    await service.findUsers({ search: "x", page: 1, limit: 20 });
    await service.findUser("u-1").catch(() => undefined);

    const keys = keysOf(allQueryArgs());
    for (const secret of SECRET_KEYS) {
      expect(keys).not.toContain(secret);
    }
    // And every row query lists its columns rather than returning whole rows.
    for (const fn of [
      prisma.workspace.findMany,
      prisma.workspace.findUnique,
      prisma.user.findMany,
      prisma.user.findUnique,
    ]) {
      const [args] = fn.mock.calls[0] as [Record<string, unknown>];
      expect(args).toHaveProperty("select");
      expect(args).not.toHaveProperty("include");
    }
  });
});
