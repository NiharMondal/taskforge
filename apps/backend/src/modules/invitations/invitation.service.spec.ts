import { accessAs } from "@/common/permissions/test-access";
import { PrismaService } from "@/prisma/prisma.service";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PlanLimitException } from "@/common/plans/plan-limits";
import { InvitationStatus, WorkspaceRole } from "generated/prisma/enums";
import { BillingService } from "../billing/billing.service";
import { MailService } from "../mail/mail.service";
import { InvitationService } from "./invitation.service";

const DAY = 24 * 60 * 60 * 1000;

/** The first argument of a mock's first call, typed (jest.Mock is `any`-typed). */
const firstCallArg = <T>(mock: jest.Mock): T =>
  (mock.mock.calls as unknown[][])[0][0] as T;

describe("InvitationService", () => {
  const workspaceId = "ws-1";
  const actorUserId = "user-admin";
  const adminAccess = accessAs(WorkspaceRole.ADMIN, {
    workspaceId,
    userId: actorUserId,
  });

  const invitee = { userId: "user-77" };

  let prisma: {
    membership: { findUnique: jest.Mock; create: jest.Mock; count: jest.Mock };
    invitation: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    workspace: { findUnique: jest.Mock };
    user: { findFirst: jest.Mock; findUnique: jest.Mock };
    role: { findFirst: jest.Mock; findUnique: jest.Mock };
    subscription: { findUnique: jest.Mock };
    auditLog: { create: jest.Mock };
    $executeRaw: jest.Mock;
    $transaction: jest.Mock;
  };
  let mail: { sendInBackground: jest.Mock };
  let billing: { syncSeats: jest.Mock };
  let service: InvitationService;

  beforeEach(() => {
    prisma = {
      membership: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: "m-1" }),
        count: jest.fn().mockResolvedValue(1),
      },
      invitation: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        upsert: jest.fn().mockResolvedValue({ id: "inv-1" }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      workspace: {
        findUnique: jest.fn().mockResolvedValue({ name: "Acme" }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue({ name: "Alice" }),
      },
      // No Role rows by default: the enum's default permissions apply.
      role: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve({ id: where.id, name: `Role ${where.id}` }),
        ),
      },
      // No Subscription row: the Free plan.
      subscription: { findUnique: jest.fn().mockResolvedValue(null) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn(),
    };
    // The actor is an ADMIN unless a test says otherwise; everyone else is not
    // a member by default.
    prisma.membership.findUnique.mockImplementation(
      ({ where }: { where: { userId_workspaceId: { userId: string } } }) =>
        Promise.resolve(
          where.userId_workspaceId.userId === actorUserId
            ? { role: WorkspaceRole.ADMIN }
            : null,
        ),
    );
    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb(prisma),
    );

    mail = { sendInBackground: jest.fn() };
    billing = { syncSeats: jest.fn().mockResolvedValue(undefined) };
    service = new InvitationService(
      prisma as unknown as PrismaService,
      mail as unknown as MailService,
      { get: () => "http://localhost:3000" } as unknown as ConfigService,
      billing as unknown as BillingService,
    );
  });

  describe("sendInvitation", () => {
    const send = (dto: {
      email: string;
      role?: WorkspaceRole;
      roleId?: string;
    }) => service.sendInvitation(workspaceId, adminAccess, dto);

    describe("the plan's member limit", () => {
      it("402s on Free when members and live invitations fill the 5 seats", async () => {
        prisma.membership.count.mockResolvedValue(3);
        prisma.invitation.count.mockResolvedValue(2);

        const error = await send({ email: "bob@example.com" }).catch(
          (e: unknown) => e,
        );

        expect(error).toBeInstanceOf(PlanLimitException);
        expect((error as PlanLimitException).getResponse()).toMatchObject({
          statusCode: 402,
          code: "PLAN_LIMIT",
          limit: "members",
        });
        expect(prisma.invitation.upsert).not.toHaveBeenCalled();
        // Only live invitations hold a seat, and only this workspace's.
        expect(prisma.invitation.count).toHaveBeenCalledWith({
          where: {
            workspaceId,
            status: InvitationStatus.PENDING,
            expiresAt: { gt: expect.any(Date) as Date },
          },
        });
      });

      it("counts the seats under the workspace's lock, in the transaction that writes the invitation", async () => {
        const order: string[] = [];
        const tx = {
          ...prisma,
          $executeRaw: jest.fn(
            (strings: TemplateStringsArray, lock: string) => {
              order.push(`lock ${strings.join("?")} ${lock}`);
              return Promise.resolve(1);
            },
          ),
          membership: {
            ...prisma.membership,
            count: jest.fn(() => {
              order.push("count");
              return Promise.resolve(1);
            }),
          },
          invitation: {
            ...prisma.invitation,
            upsert: jest.fn(() => {
              order.push("upsert");
              return Promise.resolve({ id: "inv-1" });
            }),
          },
        };
        prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
          cb(tx),
        );

        await send({ email: "bob@example.com" });

        expect(order[0]).toMatch(/pg_advisory_xact_lock/);
        expect(order[0]).toContain(`workspace-seats:${workspaceId}`);
        expect(order.slice(1)).toEqual(["count", "upsert"]);
        expect(prisma.invitation.upsert).not.toHaveBeenCalled();
      });

      it("invites the fifth seat on Free", async () => {
        prisma.membership.count.mockResolvedValue(3);
        prisma.invitation.count.mockResolvedValue(1);

        await send({ email: "bob@example.com" });

        expect(prisma.invitation.upsert).toHaveBeenCalled();
      });

      it("has no limit on Pro", async () => {
        prisma.subscription.findUnique.mockResolvedValue({
          plan: "PRO",
          status: "ACTIVE",
        });
        prisma.membership.count.mockResolvedValue(40);

        await send({ email: "bob@example.com" });

        expect(prisma.invitation.upsert).toHaveBeenCalled();
      });

      it("applies the Free limit once a Pro subscription has lapsed", async () => {
        prisma.subscription.findUnique.mockResolvedValue({
          plan: "PRO",
          status: "CANCELED",
        });
        prisma.membership.count.mockResolvedValue(5);

        await expect(send({ email: "bob@example.com" })).rejects.toBeInstanceOf(
          PlanLimitException,
        );
      });
    });

    it("checks membership for the user who owns that email", async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: invitee.userId,
        email: "bob@example.com",
      });

      await send({ email: "bob@example.com" });

      expect(prisma.membership.findUnique).toHaveBeenCalledWith({
        where: {
          userId_workspaceId: { userId: invitee.userId, workspaceId },
        },
      });
    });

    it("rejects an email that already belongs to a workspace member", async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: invitee.userId,
        email: "bob@example.com",
      });
      prisma.membership.findUnique.mockImplementation(
        ({ where }: { where: { userId_workspaceId: { userId: string } } }) =>
          Promise.resolve(
            where.userId_workspaceId.userId === actorUserId
              ? { role: WorkspaceRole.ADMIN }
              : where.userId_workspaceId.userId === invitee.userId
                ? { role: WorkspaceRole.MEMBER }
                : null,
          ),
      );

      await expect(send({ email: "bob@example.com" })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.invitation.upsert).not.toHaveBeenCalled();
    });

    it("refuses to invite to a role with more access than the actor's own", async () => {
      // A custom role that may invite, but holds nothing an ADMIN would get.
      const inviter = {
        ...adminAccess,
        systemKey: null,
        permissions: new Set(["invitation:manage"] as const),
      };

      await expect(
        service.sendInvitation(workspaceId, inviter, {
          email: "bob@example.com",
          role: WorkspaceRole.ADMIN,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.invitation.upsert).not.toHaveBeenCalled();
    });

    it("stores the id of this workspace's role for the invited role", async () => {
      prisma.role.findFirst.mockResolvedValue({
        id: "role-viewer",
        permissions: [],
      });

      await send({ email: "bob@example.com", role: WorkspaceRole.VIEWER });

      expect(prisma.role.findFirst).toHaveBeenCalledWith({
        where: { workspaceId, systemKey: WorkspaceRole.VIEWER },
        select: { id: true, name: true, permissions: true },
      });
      const create: unknown = expect.objectContaining({
        role: WorkspaceRole.VIEWER,
        roleId: "role-viewer",
      });
      expect(prisma.invitation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create }),
      );
    });

    it("invites to a custom role by roleId, scoped to this workspace", async () => {
      prisma.role.findFirst.mockResolvedValue({
        id: "role-triage",
        systemKey: null,
        permissions: ["issue:status"],
      });

      await send({ email: "bob@example.com", roleId: "role-triage" });

      expect(prisma.role.findFirst).toHaveBeenCalledWith({
        where: { id: "role-triage", workspaceId },
        select: { id: true, name: true, systemKey: true, permissions: true },
      });
      const create: unknown = expect.objectContaining({
        role: WorkspaceRole.MEMBER,
        roleId: "role-triage",
      });
      expect(prisma.invitation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create }),
      );
    });

    it("404s a roleId that isn't one of this workspace's roles", async () => {
      await expect(
        send({ email: "bob@example.com", roleId: "role-of-B" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.invitation.upsert).not.toHaveBeenCalled();
    });

    it("stores and emails the lowercase address", async () => {
      await send({ email: "  Bob@Example.COM " });

      const create: unknown = expect.objectContaining({
        email: "bob@example.com",
      });
      expect(prisma.invitation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create }),
      );
      expect(mail.sendInBackground).toHaveBeenCalledWith(
        expect.objectContaining({ to: "bob@example.com" }),
      );
    });

    it("looks up existing accounts and invitations case-insensitively", async () => {
      await send({ email: "Bob@Example.com" });

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: { equals: "bob@example.com", mode: "insensitive" } },
      });
      expect(prisma.invitation.findFirst).toHaveBeenCalledWith({
        where: {
          workspaceId,
          email: { equals: "bob@example.com", mode: "insensitive" },
        },
      });
    });

    it("updates a legacy mixed-case invitation in place instead of duplicating it", async () => {
      prisma.invitation.findFirst.mockResolvedValue({
        id: "inv-old",
        email: "Bob@Example.com",
        status: InvitationStatus.REVOKED,
        expiresAt: new Date(Date.now() + DAY),
      });

      await send({ email: "bob@example.com" });

      const update: unknown = expect.objectContaining({
        email: "bob@example.com",
      });
      expect(prisma.invitation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            email_workspaceId: { email: "Bob@Example.com", workspaceId },
          },
          update,
        }),
      );
    });

    describe("an existing PENDING invitation", () => {
      it("blocks a re-invite while it is still valid", async () => {
        prisma.invitation.findFirst.mockResolvedValue({
          id: "inv-old",
          email: "bob@example.com",
          status: InvitationStatus.PENDING,
          expiresAt: new Date(Date.now() + DAY),
        });

        await expect(send({ email: "bob@example.com" })).rejects.toBeInstanceOf(
          ConflictException,
        );
        expect(prisma.invitation.upsert).not.toHaveBeenCalled();
      });

      it("does not block a re-invite once it has expired", async () => {
        prisma.invitation.findFirst.mockResolvedValue({
          id: "inv-old",
          email: "bob@example.com",
          status: InvitationStatus.PENDING,
          expiresAt: new Date(Date.now() - DAY),
        });

        await expect(send({ email: "bob@example.com" })).resolves.toBeDefined();

        const update: unknown = expect.objectContaining({
          status: InvitationStatus.PENDING,
        });
        expect(prisma.invitation.upsert).toHaveBeenCalledWith(
          expect.objectContaining({ update }),
        );
      });
    });

    it("never returns the token to the caller, but still emails it", async () => {
      await send({ email: "bob@example.com" });

      const { select } = firstCallArg<{
        select: Record<string, boolean>;
      }>(prisma.invitation.upsert);
      expect(select).toBeDefined();
      expect(select.token).toBeUndefined();

      const { create } = firstCallArg<{
        create: { token: string };
      }>(prisma.invitation.upsert);
      expect(create.token).toMatch(/^[0-9a-f]{64}$/);
      const mailed = firstCallArg<{ text: string }>(mail.sendInBackground);
      expect(mailed.text).toContain(create.token);
    });

    it("HTML-escapes the inviter and workspace names in the email body", async () => {
      prisma.user.findUnique.mockResolvedValue({
        name: '"><script>alert(1)</script>',
      });
      prisma.workspace.findUnique.mockResolvedValue({
        name: "<img src=x onerror=alert(1)>",
      });

      await send({ email: "bob@example.com" });

      const mailed = firstCallArg<{
        html: string;
        text: string;
        subject: string;
      }>(mail.sendInBackground);
      expect(mailed.html).not.toContain("<script>");
      expect(mailed.html).not.toContain("<img");
      expect(mailed.html).toContain("&lt;script&gt;");
      expect(mailed.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
      // Plain-text parts must stay literal, not show "&lt;" to the reader.
      expect(mailed.text).toContain("<img src=x onerror=alert(1)>");
    });
  });

  describe("listInvitations", () => {
    it("does not select the token", async () => {
      await service.listInvitations(workspaceId, {});

      const args = firstCallArg<{
        where: unknown;
        select: Record<string, boolean>;
      }>(prisma.invitation.findMany);
      expect(args.where).toEqual({ workspaceId });
      expect(args.select.id).toBe(true);
      expect(args.select.token).toBeUndefined();
    });
  });

  describe("acceptInvitation", () => {
    const token = "tok";
    const pendingInvite = (overrides: object = {}) => ({
      id: "inv-1",
      email: "bob@example.com",
      workspaceId,
      role: WorkspaceRole.MEMBER,
      status: InvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + DAY),
      ...overrides,
    });

    beforeEach(() => {
      prisma.invitation.findUnique.mockResolvedValue(pendingInvite());
      prisma.user.findUnique.mockResolvedValue({
        id: invitee.userId,
        email: "bob@example.com",
      });
    });

    it("bills the new seat after the membership is committed", async () => {
      await service.acceptInvitation(token, invitee.userId);

      expect(billing.syncSeats).toHaveBeenCalledWith(workspaceId);
      expect(prisma.membership.create.mock.invocationCallOrder[0]).toBeLessThan(
        billing.syncSeats.mock.invocationCallOrder[0],
      );
    });

    it("finds the caller by User.id (the JWT subject)", async () => {
      await service.acceptInvitation(token, invitee.userId);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: invitee.userId },
      });
    });

    it("creates the membership for the User and marks the invite ACCEPTED", async () => {
      await expect(
        service.acceptInvitation(token, invitee.userId),
      ).resolves.toMatchObject({ workspaceId });

      expect(prisma.membership.create).toHaveBeenCalledWith({
        data: {
          userId: invitee.userId,
          workspaceId,
          role: WorkspaceRole.MEMBER,
          roleId: null,
        },
      });
      const where: unknown = expect.objectContaining({
        id: "inv-1",
        token,
        status: InvitationStatus.PENDING,
      });
      expect(prisma.invitation.updateMany).toHaveBeenCalledWith({
        where,
        data: { status: InvitationStatus.ACCEPTED },
      });
    });

    it("writes nothing if the invitation changed after it was checked", async () => {
      // Revoked, re-sent or accepted in parallel: the conditional claim
      // matches no row.
      prisma.invitation.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.acceptInvitation(token, invitee.userId),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.membership.create).not.toHaveBeenCalled();
    });

    it("claims the invitation before creating the membership", async () => {
      const order: string[] = [];
      prisma.invitation.updateMany.mockImplementation(() => {
        order.push("claim");
        return Promise.resolve({ count: 1 });
      });
      prisma.membership.create.mockImplementation(() => {
        order.push("membership");
        return Promise.resolve({ id: "m-1" });
      });

      await service.acceptInvitation(token, invitee.userId);

      expect(order).toEqual(["claim", "membership"]);
    });

    it("gives the new member the role the invitation points at", async () => {
      prisma.invitation.findUnique.mockResolvedValue(
        pendingInvite({ roleId: "role-member" }),
      );

      await service.acceptInvitation(token, invitee.userId);

      const data: unknown = expect.objectContaining({ roleId: "role-member" });
      expect(prisma.membership.create).toHaveBeenCalledWith({ data });
      expect(prisma.role.findFirst).not.toHaveBeenCalled();
    });

    it("maps an invitation sent before roles existed through its enum", async () => {
      prisma.role.findFirst.mockResolvedValue({
        id: "role-member",
        permissions: [],
      });

      await service.acceptInvitation(token, invitee.userId);

      expect(prisma.role.findFirst).toHaveBeenCalledWith({
        where: { workspaceId, systemKey: WorkspaceRole.MEMBER },
        select: { id: true, name: true, permissions: true },
      });
      const data: unknown = expect.objectContaining({ roleId: "role-member" });
      expect(prisma.membership.create).toHaveBeenCalledWith({ data });
    });

    it("matches the invited email case-insensitively", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: invitee.userId,
        email: "Bob@Example.COM",
      });

      await expect(
        service.acceptInvitation(token, invitee.userId),
      ).resolves.toBeDefined();
    });

    it("refuses a user whose email differs from the invitation", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: invitee.userId,
        email: "mallory@example.com",
      });

      await expect(
        service.acceptInvitation(token, invitee.userId),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.membership.create).not.toHaveBeenCalled();
    });

    it("404s when the caller's user no longer exists", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.acceptInvitation(token, invitee.userId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("refuses a user who is already a member", async () => {
      prisma.membership.findUnique.mockResolvedValue({ id: "m-existing" });

      await expect(
        service.acceptInvitation(token, invitee.userId),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.membership.create).not.toHaveBeenCalled();
    });

    it("expires and refuses an out-of-date invitation", async () => {
      prisma.invitation.findUnique.mockResolvedValue(
        pendingInvite({ expiresAt: new Date(Date.now() - DAY) }),
      );

      await expect(
        service.acceptInvitation(token, invitee.userId),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.invitation.update).toHaveBeenCalledWith({
        where: { id: "inv-1" },
        data: { status: InvitationStatus.EXPIRED },
      });
    });
  });

  describe("audit log", () => {
    const auditRows = () =>
      (
        prisma.auditLog.create.mock.calls as [
          { data: Record<string, unknown> },
        ][]
      ).map(([arg]) => arg.data);

    it("records invitation.sent once, in the invitation's transaction", async () => {
      await service.sendInvitation(workspaceId, adminAccess, {
        email: "Dan@Example.com",
        role: WorkspaceRole.VIEWER,
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(auditRows()).toEqual([
        {
          workspaceId,
          userId: actorUserId,
          action: "invitation.sent",
          entityType: "INVITATION",
          entityId: "inv-1",
          metadata: {
            email: "dan@example.com",
            role: { id: null, name: "Viewer" },
          },
        },
      ]);
    });

    it("records invitation.accepted once, by the new member", async () => {
      prisma.invitation.findUnique.mockResolvedValue({
        id: "inv-1",
        email: "bob@example.com",
        workspaceId,
        role: WorkspaceRole.MEMBER,
        roleId: "role-triage",
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + DAY),
      });
      prisma.user.findUnique.mockResolvedValue({
        id: invitee.userId,
        email: "bob@example.com",
      });

      await service.acceptInvitation("tok", invitee.userId);

      expect(auditRows()).toEqual([
        {
          workspaceId,
          userId: invitee.userId,
          action: "invitation.accepted",
          entityType: "INVITATION",
          entityId: "inv-1",
          metadata: {
            email: "bob@example.com",
            role: { id: "role-triage", name: "Role role-triage" },
          },
        },
      ]);
    });

    it("records invitation.revoked once, with the address", async () => {
      prisma.invitation.findFirst.mockResolvedValue({
        id: "inv-9",
        email: "eve@example.com",
        workspaceId,
        status: InvitationStatus.PENDING,
      });

      await service.revokeInvitation(workspaceId, "inv-9", actorUserId);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(auditRows()).toEqual([
        {
          workspaceId,
          userId: actorUserId,
          action: "invitation.revoked",
          entityType: "INVITATION",
          entityId: "inv-9",
          metadata: { email: "eve@example.com" },
        },
      ]);
    });

    it("records nothing for an invitation it refuses to revoke", async () => {
      prisma.invitation.findFirst.mockResolvedValue({
        id: "inv-9",
        email: "eve@example.com",
        workspaceId,
        status: InvitationStatus.ACCEPTED,
      });

      await expect(
        service.revokeInvitation(workspaceId, "inv-9", actorUserId),
      ).rejects.toThrow();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });
  });
});
