import { CloudinaryService } from "@/cloudinary/cloudinary.service";
import { MailService } from "@/modules/mail/mail.service";
import { PrismaService } from "@/prisma/prisma.service";
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import bcryptjs from "bcryptjs";
import { WorkspaceRole } from "generated/prisma/enums";
import { BillingService } from "../billing/billing.service";
import { AccountService } from "./account.service";

type Membership = {
  workspaceId: string;
  role: WorkspaceRole;
  assignedRole: { id: string; name: string } | null;
  workspace: { name: string; _count: { memberships: number } };
};

const membership = (
  workspaceId: string,
  role: WorkspaceRole,
  members: number,
): Membership => ({
  workspaceId,
  role,
  assignedRole: { id: `role-${workspaceId}-${role}`, name: role },
  workspace: {
    name: `Workspace ${workspaceId}`,
    _count: { memberships: members },
  },
});

describe("AccountService", () => {
  const me = "user-1";
  let passwordHash: string;

  let prisma: {
    user: { findUnique: jest.Mock; delete: jest.Mock };
    membership: { findMany: jest.Mock };
    workspace: { deleteMany: jest.Mock };
    issue: { findMany: jest.Mock };
    comment: { findMany: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let billing: { cancelForDeletion: jest.Mock; syncSeats: jest.Mock };
  let cloudinary: { delete: jest.Mock };
  let mail: { sendInBackground: jest.Mock };
  let service: AccountService;

  /** The stored account: a password, and the given memberships. */
  const account = (
    memberships: Membership[],
    auths: { password: string | null }[] = [{ password: passwordHash }],
  ) => ({
    id: me,
    name: "Ann",
    email: "ann@example.com",
    avatarPublicId: "taskforge/user-avatar/user-1/a",
    auths,
    memberships,
  });

  beforeAll(async () => {
    // Cost 4: comparing works at any cost, and the app's 12 is slow under load.
    passwordHash = await bcryptjs.hash("right-password", 4);
  });

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(account([])),
        delete: jest.fn().mockResolvedValue({ id: me }),
      },
      // Inside the transaction: nobody joined a solo workspace meanwhile.
      membership: { findMany: jest.fn().mockResolvedValue([]) },
      workspace: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      issue: { findMany: jest.fn().mockResolvedValue([]) },
      comment: { findMany: jest.fn().mockResolvedValue([]) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb(prisma),
    );
    billing = {
      cancelForDeletion: jest.fn().mockResolvedValue(undefined),
      syncSeats: jest.fn().mockResolvedValue(undefined),
    };
    cloudinary = { delete: jest.fn().mockResolvedValue(undefined) };
    mail = { sendInBackground: jest.fn() };
    service = new AccountService(
      prisma as unknown as PrismaService,
      billing as unknown as BillingService,
      cloudinary as unknown as CloudinaryService,
      mail as unknown as MailService,
      { get: () => undefined } as unknown as ConfigService,
    );
  });

  describe("deleteAccount", () => {
    describe("confirmation", () => {
      it("refuses a wrong password with 400 and deletes nothing", async () => {
        await expect(
          service.deleteAccount(me, { password: "wrong-password" }),
        ).rejects.toThrow(BadRequestException);

        expect(prisma.user.delete).not.toHaveBeenCalled();
        expect(billing.cancelForDeletion).not.toHaveBeenCalled();
      });

      it("asks a password account for its password, not its email", async () => {
        await expect(
          service.deleteAccount(me, { confirmEmail: "ann@example.com" }),
        ).rejects.toThrow(BadRequestException);

        expect(prisma.user.delete).not.toHaveBeenCalled();
      });

      it("lets a Google-only account confirm with its email, ignoring case", async () => {
        prisma.user.findUnique.mockResolvedValue(account([], []));

        await service.deleteAccount(me, { confirmEmail: " Ann@Example.com " });

        expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: me } });
      });

      it("refuses a Google-only account the wrong email", async () => {
        prisma.user.findUnique.mockResolvedValue(account([], []));

        await expect(
          service.deleteAccount(me, { confirmEmail: "someone@example.com" }),
        ).rejects.toThrow(BadRequestException);
        expect(prisma.user.delete).not.toHaveBeenCalled();
      });
    });

    it("refuses (409) while the caller owns a workspace other people use, naming it", async () => {
      prisma.user.findUnique.mockResolvedValue(
        account([
          membership("ws-shared", WorkspaceRole.OWNER, 3),
          membership("ws-solo", WorkspaceRole.OWNER, 1),
        ]),
      );

      const error = (await service
        .deleteAccount(me, { password: "right-password" })
        .catch((e: unknown) => e)) as ConflictException;

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toMatchObject({
        workspaces: [{ id: "ws-shared", name: "Workspace ws-shared" }],
      });
      expect(billing.cancelForDeletion).not.toHaveBeenCalled();
      expect(prisma.workspace.deleteMany).not.toHaveBeenCalled();
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it("deletes the workspaces only they belong to, canceling each subscription first", async () => {
      prisma.user.findUnique.mockResolvedValue(
        account([
          membership("ws-solo", WorkspaceRole.OWNER, 1),
          membership("ws-team", WorkspaceRole.MEMBER, 4),
        ]),
      );
      const order: string[] = [];
      billing.cancelForDeletion.mockImplementation(() => {
        order.push("cancel");
        return Promise.resolve();
      });
      prisma.workspace.deleteMany.mockImplementation(() => {
        order.push("delete-workspaces");
        return Promise.resolve({ count: 1 });
      });

      await service.deleteAccount(me, { password: "right-password" });

      expect(billing.cancelForDeletion).toHaveBeenCalledTimes(1);
      expect(billing.cancelForDeletion).toHaveBeenCalledWith("ws-solo");
      expect(prisma.workspace.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["ws-solo"] } },
      });
      expect(order).toEqual(["cancel", "delete-workspaces"]);
    });

    it("deletes nothing when Stripe can't cancel a solo workspace's subscription", async () => {
      prisma.user.findUnique.mockResolvedValue(
        account([membership("ws-solo", WorkspaceRole.OWNER, 1)]),
      );
      billing.cancelForDeletion.mockRejectedValue(new BadGatewayException());

      await expect(
        service.deleteAccount(me, { password: "right-password" }),
      ).rejects.toThrow(BadGatewayException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it("refuses (409) when someone joined a solo workspace after the check", async () => {
      prisma.user.findUnique.mockResolvedValue(
        account([membership("ws-solo", WorkspaceRole.OWNER, 1)]),
      );
      prisma.membership.findMany.mockResolvedValue([
        { workspace: { id: "ws-solo", name: "Workspace ws-solo" } },
      ]);

      await expect(
        service.deleteAccount(me, { password: "right-password" }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.workspace.deleteMany).not.toHaveBeenCalled();
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it("logs leaving each shared workspace in the deletion's transaction", async () => {
      prisma.user.findUnique.mockResolvedValue(
        account([
          membership("ws-a", WorkspaceRole.MEMBER, 2),
          membership("ws-b", WorkspaceRole.ADMIN, 5),
        ]),
      );
      const order: string[] = [];
      prisma.$transaction.mockImplementation(
        async (cb: (tx: unknown) => unknown) => {
          order.push("begin");
          const result = await cb(prisma);
          order.push("commit");
          return result;
        },
      );
      prisma.auditLog.create.mockImplementation(() => {
        order.push("audit");
        return Promise.resolve({});
      });
      prisma.user.delete.mockImplementation(() => {
        order.push("delete-user");
        return Promise.resolve({});
      });

      await service.deleteAccount(me, { password: "right-password" });

      expect(order).toEqual([
        "begin",
        "audit",
        "audit",
        "delete-user",
        "commit",
      ]);
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: "ws-a",
          userId: me,
          action: "member.left",
          entityType: "MEMBER",
          entityId: me,
          metadata: {
            member: { id: me, name: "Ann" },
            role: { id: "role-ws-a-MEMBER", name: "MEMBER" },
          },
        }) as unknown,
      });
    });

    it("syncs seats in each workspace they left, after the commit", async () => {
      prisma.user.findUnique.mockResolvedValue(
        account([
          membership("ws-solo", WorkspaceRole.OWNER, 1),
          membership("ws-a", WorkspaceRole.MEMBER, 2),
          membership("ws-b", WorkspaceRole.VIEWER, 5),
        ]),
      );
      let committed = false;
      prisma.$transaction.mockImplementation(
        async (cb: (tx: unknown) => unknown) => {
          const result = await cb(prisma);
          committed = true;
          return result;
        },
      );
      billing.syncSeats.mockImplementation(() => {
        expect(committed).toBe(true);
        return Promise.resolve();
      });

      await service.deleteAccount(me, { password: "right-password" });

      expect(billing.syncSeats.mock.calls).toEqual([["ws-a"], ["ws-b"]]);
    });

    it("deletes the avatar and emails the address the account had", async () => {
      await service.deleteAccount(me, { password: "right-password" });

      expect(cloudinary.delete).toHaveBeenCalledWith(
        "taskforge/user-avatar/user-1/a",
      );
      expect(mail.sendInBackground).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "ann@example.com",
          subject: "Your TaskForge account was deleted",
        }),
      );
    });
  });

  describe("exportData", () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({
        id: me,
        name: "Ann",
        email: "ann@example.com",
        avatarUrl: null,
        emailVerifiedAt: null,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-02"),
        auths: [{ provider: "EMAIL", createdAt: new Date("2026-01-01") }],
      });
      prisma.membership.findMany.mockResolvedValue([
        {
          role: WorkspaceRole.MEMBER,
          createdAt: new Date("2026-02-01"),
          assignedRole: { id: "role-1", name: "Member" },
          workspace: { id: "ws-a", name: "Acme" },
        },
      ]);
    });

    it("reads issues and comments only in the workspaces they still belong to", async () => {
      await service.exportData(me);

      expect(prisma.issue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workspaceId: { in: ["ws-a"] },
            OR: [{ reporterId: me }, { assigneeId: me }],
          },
        }),
      );
      expect(prisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: me, issue: { workspaceId: { in: ["ws-a"] } } },
        }),
      );
    });

    it("never selects a password hash", async () => {
      await service.exportData(me);

      const [{ select }] = prisma.user.findUnique.mock.calls[0] as [
        { select: { auths: { select: object } } },
      ];
      expect(select.auths.select).not.toHaveProperty("password");
    });

    it("shapes issues with their key and whether they are the caller's", async () => {
      prisma.issue.findMany.mockResolvedValue([
        {
          id: "issue-1",
          number: 12,
          title: "Fix it",
          description: null,
          priority: "HIGH",
          type: "BUG",
          timeEstimate: null,
          reporterId: null,
          assigneeId: me,
          createdAt: new Date("2026-03-01"),
          updatedAt: new Date("2026-03-01"),
          status: { name: "To Do" },
          project: { key: "WA", name: "Web app" },
          workspace: { name: "Acme" },
        },
      ]);

      const data = await service.exportData(me);

      expect(data.memberships).toEqual([
        {
          workspace: { id: "ws-a", name: "Acme" },
          role: "Member",
          joinedAt: new Date("2026-02-01"),
        },
      ]);
      expect(data.issues[0]).toMatchObject({
        id: "issue-1",
        key: "WA-12",
        workspace: "Acme",
        project: "Web app",
        status: "To Do",
        reportedByYou: false,
        assignedToYou: true,
      });
      expect(data.profile.signInMethods).toEqual([
        { provider: "EMAIL", addedAt: new Date("2026-01-01") },
      ]);
    });
  });
});
