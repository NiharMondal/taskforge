import { PrismaService } from "@/prisma/prisma.service";
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { PlatformRole, WorkspaceRole } from "generated/prisma/enums";
import { RefreshTokenService } from "../auth/refresh-token.service";
import { AccountService } from "../user/account.service";
import { WorkspaceService } from "../workspace/workspace.service";
import { AdminActionsService } from "./admin-actions.service";

describe("AdminActionsService", () => {
  const actor = "admin-1";
  const reason = "Chargeback fraud";
  const sam = {
    id: "user-sam",
    name: "Sam",
    email: "sam@example.com",
    platformRole: null as PlatformRole | null,
  };

  let tx: {
    user: { updateMany: jest.Mock };
    workspace: { updateMany: jest.Mock };
    membership: { findFirst: jest.Mock; count: jest.Mock };
    platformAuditLog: { create: jest.Mock };
  };
  let prisma: {
    user: { findUnique: jest.Mock };
    workspace: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let refreshTokens: { revokeAllForUser: jest.Mock };
  let accounts: { deleteAccountAsStaff: jest.Mock };
  let workspaces: { delete: jest.Mock };
  let service: AdminActionsService;

  beforeEach(() => {
    tx = {
      user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      workspace: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      membership: {
        findFirst: jest.fn().mockResolvedValue({
          user: { id: "owner-1", name: "Ann", email: "ann@example.com" },
        }),
        count: jest.fn().mockResolvedValue(3),
      },
      platformAuditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(sam) },
      workspace: {
        findUnique: jest.fn().mockResolvedValue({ id: "ws-1", name: "Acme" }),
      },
      $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
    };
    refreshTokens = { revokeAllForUser: jest.fn().mockResolvedValue(2) };
    accounts = {
      // Runs the audit hook the way AccountService does, in its transaction.
      deleteAccountAsStaff: jest.fn(
        (
          _userId: string,
          record: (client: typeof tx, deleted: unknown[]) => Promise<unknown>,
        ) => record(tx, [{ id: "ws-solo", name: "Sam's Workspace" }]),
      ),
    };
    workspaces = {
      delete: jest.fn(
        (_id: string, beforeDelete: (client: typeof tx) => Promise<unknown>) =>
          beforeDelete(tx),
      ),
    };
    service = new AdminActionsService(
      prisma as unknown as PrismaService,
      refreshTokens as unknown as RefreshTokenService,
      accounts as unknown as AccountService,
      workspaces as unknown as WorkspaceService,
    );
  });

  /** The one platform audit row written, if exactly one was. */
  const auditRow = () => {
    expect(tx.platformAuditLog.create).toHaveBeenCalledTimes(1);
    const [{ data }] = tx.platformAuditLog.create.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    return data;
  };

  describe("guardrails on user actions", () => {
    const userActions = () => [
      () => service.setUserSuspended(actor, actor, { suspended: true, reason }),
      () => service.revokeSessions(actor, actor, { reason }),
      () => service.deleteUser(actor, actor, { reason }),
    ];

    it("refuses acting on your own account, before reading anything", async () => {
      for (const act of userActions()) {
        await expect(act()).rejects.toBeInstanceOf(ForbiddenException);
      }
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(tx.platformAuditLog.create).not.toHaveBeenCalled();
    });

    it("refuses acting on another ADMIN", async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...sam,
        platformRole: PlatformRole.ADMIN,
      });

      await expect(
        service.setUserSuspended(actor, sam.id, { suspended: true, reason }),
      ).rejects.toThrow("Admins can't act on other admins");
      await expect(
        service.revokeSessions(actor, sam.id, { reason }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.deleteUser(actor, sam.id, { reason }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(accounts.deleteAccountAsStaff).not.toHaveBeenCalled();
      expect(tx.platformAuditLog.create).not.toHaveBeenCalled();
    });

    it("may act on SUPPORT staff", async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...sam,
        platformRole: PlatformRole.SUPPORT,
      });

      await service.revokeSessions(actor, sam.id, { reason });

      expect(refreshTokens.revokeAllForUser).toHaveBeenCalled();
    });

    it("404s an unknown user", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.revokeSessions(actor, "nobody", { reason }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("setUserSuspended", () => {
    it("suspends only a user who isn't, ends their sessions and records it", async () => {
      await service.setUserSuspended(actor, sam.id, {
        suspended: true,
        reason,
      });

      expect(tx.user.updateMany).toHaveBeenCalledWith({
        where: { id: sam.id, suspendedAt: null },
        data: {
          suspendedAt: expect.any(Date) as Date,
          suspendedReason: reason,
        },
      });
      expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith(sam.id, tx);
      expect(auditRow()).toEqual({
        actorId: actor,
        action: "user.suspended",
        targetType: "USER",
        targetId: sam.id,
        metadata: { name: "Sam", email: sam.email, reason },
      });
    });

    it("lifts a suspension, clearing the reason, without touching sessions", async () => {
      await service.setUserSuspended(actor, sam.id, {
        suspended: false,
        reason: "Resolved",
      });

      expect(tx.user.updateMany).toHaveBeenCalledWith({
        where: { id: sam.id, suspendedAt: { not: null } },
        data: { suspendedAt: null, suspendedReason: null },
      });
      expect(refreshTokens.revokeAllForUser).not.toHaveBeenCalled();
      expect(auditRow()).toMatchObject({ action: "user.unsuspended" });
    });

    it("409s when the user is already in that state, recording nothing", async () => {
      tx.user.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.setUserSuspended(actor, sam.id, { suspended: true, reason }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(tx.platformAuditLog.create).not.toHaveBeenCalled();
    });
  });

  it("revokeSessions records how many sessions it ended", async () => {
    await expect(
      service.revokeSessions(actor, sam.id, { reason }),
    ).resolves.toEqual({ revoked: 2 });

    expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith(sam.id, tx);
    expect(auditRow()).toMatchObject({
      action: "user.sessions_revoked",
      metadata: { name: "Sam", email: sam.email, reason, revoked: 2 },
    });
  });

  it("deleteUser deletes through AccountService, recording the solo workspaces in its transaction", async () => {
    await service.deleteUser(actor, sam.id, { reason });

    expect(accounts.deleteAccountAsStaff).toHaveBeenCalledWith(
      sam.id,
      expect.any(Function),
    );
    expect(auditRow()).toEqual({
      actorId: actor,
      action: "user.deleted",
      targetType: "USER",
      targetId: sam.id,
      metadata: {
        name: "Sam",
        email: sam.email,
        reason,
        deletedWorkspaces: [{ id: "ws-solo", name: "Sam's Workspace" }],
      },
    });
  });

  describe("workspaces", () => {
    it("suspends one that isn't and records it", async () => {
      await service.setWorkspaceSuspended(actor, "ws-1", {
        suspended: true,
        reason,
      });

      expect(tx.workspace.updateMany).toHaveBeenCalledWith({
        where: { id: "ws-1", suspendedAt: null },
        data: {
          suspendedAt: expect.any(Date) as Date,
          suspendedReason: reason,
        },
      });
      expect(auditRow()).toEqual({
        actorId: actor,
        action: "workspace.suspended",
        targetType: "WORKSPACE",
        targetId: "ws-1",
        metadata: { name: "Acme", reason },
      });
    });

    it("409s lifting a suspension that isn't there", async () => {
      tx.workspace.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.setWorkspaceSuspended(actor, "ws-1", {
          suspended: false,
          reason,
        }),
      ).rejects.toThrow("This workspace isn't suspended");
      expect(tx.platformAuditLog.create).not.toHaveBeenCalled();
    });

    it("deletes through WorkspaceService, recording owner and size before they cascade", async () => {
      await service.deleteWorkspace(actor, "ws-1", { reason });

      expect(workspaces.delete).toHaveBeenCalledWith(
        "ws-1",
        expect.any(Function),
      );
      expect(tx.membership.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: "ws-1", role: WorkspaceRole.OWNER },
        }),
      );
      expect(auditRow()).toEqual({
        actorId: actor,
        action: "workspace.deleted",
        targetType: "WORKSPACE",
        targetId: "ws-1",
        metadata: {
          name: "Acme",
          reason,
          owner: { id: "owner-1", name: "Ann", email: "ann@example.com" },
          memberCount: 3,
        },
      });
    });

    it("404s an unknown workspace", async () => {
      prisma.workspace.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteWorkspace(actor, "nope", { reason }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(workspaces.delete).not.toHaveBeenCalled();
    });
  });
});
