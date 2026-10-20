import { PrismaService } from "@/prisma/prisma.service";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { WorkspaceRole } from "generated/prisma/enums";
import { MembershipService } from "./membership.service";

describe("MembershipService.findAllByWorkspaceId", () => {
  let prisma: { membership: { findMany: jest.Mock } };
  let service: MembershipService;

  beforeEach(() => {
    prisma = { membership: { findMany: jest.fn().mockResolvedValue([]) } };
    service = new MembershipService(prisma as unknown as PrismaService);
  });

  it("scopes the roster to the caller's workspace", async () => {
    await service.findAllByWorkspaceId("ws-A");

    expect(prisma.membership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: "ws-A" } }),
    );
  });

  it("selects each member's email from User, and no credentials", async () => {
    await service.findAllByWorkspaceId("ws-A");

    expect(prisma.membership.findMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws-A" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            email: true,
          },
        },
      },
    });
  });
});

describe("MembershipService role changes and removal", () => {
  const workspaceId = "ws-A";
  const admin = "user-admin";

  let roster: Record<string, WorkspaceRole>;
  let prisma: {
    membership: { findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
  };
  let service: MembershipService;

  beforeEach(() => {
    // Rows of workspace A only; anyone else is in another workspace (or none).
    roster = {
      [admin]: WorkspaceRole.ADMIN,
      "user-owner": WorkspaceRole.OWNER,
      "user-member": WorkspaceRole.MEMBER,
    };
    prisma = {
      membership: {
        findUnique: jest.fn(
          ({
            where,
          }: {
            where: {
              userId_workspaceId: { userId: string; workspaceId: string };
            };
          }) => {
            const { userId, workspaceId: ws } = where.userId_workspaceId;
            const role = ws === workspaceId ? roster[userId] : undefined;
            return Promise.resolve(role ? { userId, role } : null);
          },
        ),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    service = new MembershipService(prisma as unknown as PrismaService);
  });

  describe("updateRole", () => {
    it("changes a member's role, keyed to this workspace", async () => {
      await service.updateRole(
        workspaceId,
        "user-member",
        admin,
        WorkspaceRole.ADMIN,
      );

      expect(prisma.membership.update).toHaveBeenCalledWith({
        where: {
          userId_workspaceId: { userId: "user-member", workspaceId },
        },
        data: { role: WorkspaceRole.ADMIN },
      });
    });

    it("404s a user who is a member of another workspace only", async () => {
      await expect(
        service.updateRole(
          workspaceId,
          "user-from-B",
          admin,
          WorkspaceRole.ADMIN,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.membership.update).not.toHaveBeenCalled();
    });

    it("refuses an actor who is only a MEMBER", async () => {
      await expect(
        service.updateRole(
          workspaceId,
          "user-owner",
          "user-member",
          WorkspaceRole.VIEWER,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.membership.update).not.toHaveBeenCalled();
    });

    it.each([
      ["their own role", admin, WorkspaceRole.VIEWER],
      ["the OWNER's role", "user-owner", WorkspaceRole.MEMBER],
      ["anyone to OWNER", "user-member", WorkspaceRole.OWNER],
    ])("refuses to change %s", async (_label, target, role) => {
      await expect(
        service.updateRole(workspaceId, target, admin, role),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.membership.update).not.toHaveBeenCalled();
    });
  });

  describe("removeMember", () => {
    it("removes the member from this workspace only", async () => {
      await service.removeMember(workspaceId, "user-member");

      expect(prisma.membership.delete).toHaveBeenCalledWith({
        where: {
          userId_workspaceId: { userId: "user-member", workspaceId },
        },
      });
    });

    it("404s a user who is not in this workspace", async () => {
      await expect(
        service.removeMember(workspaceId, "user-from-B"),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.membership.delete).not.toHaveBeenCalled();
    });

    it("refuses to remove the OWNER", async () => {
      await expect(
        service.removeMember(workspaceId, "user-owner"),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.membership.delete).not.toHaveBeenCalled();
    });
  });
});
