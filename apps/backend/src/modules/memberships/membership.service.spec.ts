import { accessAs } from "@/common/permissions/test-access";
import { WorkspaceAccess } from "@/common/permissions/workspace-access";
import { PrismaService } from "@/prisma/prisma.service";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { WorkspaceRole } from "generated/prisma/enums";
import { BillingService } from "../billing/billing.service";
import { MembershipService } from "./membership.service";

/** Seat sync: billing is checked after each removal, never before. */
const billing = { syncSeats: jest.fn().mockResolvedValue(undefined) };
const asBilling = billing as unknown as BillingService;

beforeEach(() => billing.syncSeats.mockClear());

describe("MembershipService.findAllByWorkspaceId", () => {
  let prisma: { membership: { findMany: jest.Mock; count: jest.Mock } };
  let service: MembershipService;

  beforeEach(() => {
    prisma = {
      membership: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    service = new MembershipService(
      prisma as unknown as PrismaService,
      asBilling,
    );
  });

  it("scopes the roster, and its count, to the caller's workspace", async () => {
    await service.findAllByWorkspaceId("ws-A", {});

    expect(prisma.membership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: "ws-A" } }),
    );
    expect(prisma.membership.count).toHaveBeenCalledWith({
      where: { workspaceId: "ws-A" },
    });
  });

  it("pages oldest member first, with id breaking ties", async () => {
    prisma.membership.count.mockResolvedValue(45);

    const { metaData } = await service.findAllByWorkspaceId("ws-A", {
      page: 2,
      limit: 20,
    });

    expect(prisma.membership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 20,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
    );
    expect(metaData).toEqual({
      currentPage: 2,
      totalPages: 3,
      totalData: 45,
      pageSize: 20,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it("selects each member's email from User, and no credentials", async () => {
    await service.findAllByWorkspaceId("ws-A", {});

    expect(prisma.membership.findMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws-A" },
      skip: 0,
      take: 10,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            email: true,
          },
        },
        assignedRole: { select: { id: true, name: true, systemKey: true } },
      },
    });
  });
});

describe("MembershipService role changes and removal", () => {
  const workspaceId = "ws-A";
  const admin = "user-admin";
  const adminAccess = accessAs(WorkspaceRole.ADMIN, {
    workspaceId,
    userId: admin,
  });
  /** An actor whose custom role can manage members but do nothing else. */
  const memberManager: WorkspaceAccess = {
    ...adminAccess,
    userId: "user-manager",
    systemKey: null,
    permissions: new Set(["member:manage"]),
  };

  let roster: Record<string, WorkspaceRole>;
  let prisma: {
    membership: { findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
    role: { findFirst: jest.Mock };
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
      // No Role rows by default: the enum's default permissions apply.
      role: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    service = new MembershipService(
      prisma as unknown as PrismaService,
      asBilling,
    );
  });

  describe("updateRole", () => {
    it("changes a member's role, keyed to this workspace", async () => {
      await service.updateRole(workspaceId, "user-member", adminAccess, {
        role: WorkspaceRole.ADMIN,
      });

      expect(prisma.membership.update).toHaveBeenCalledWith({
        where: {
          userId_workspaceId: { userId: "user-member", workspaceId },
        },
        data: { role: WorkspaceRole.ADMIN, roleId: null },
        include: {
          assignedRole: { select: { id: true, name: true, systemKey: true } },
        },
      });
    });

    it("points the member at this workspace's matching Role row", async () => {
      prisma.role.findFirst.mockResolvedValue({
        id: "role-viewer",
        permissions: [],
      });

      await service.updateRole(workspaceId, "user-member", adminAccess, {
        role: WorkspaceRole.VIEWER,
      });

      expect(prisma.role.findFirst).toHaveBeenCalledWith({
        where: { workspaceId, systemKey: WorkspaceRole.VIEWER },
        select: { id: true, permissions: true },
      });
      expect(prisma.membership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { role: WorkspaceRole.VIEWER, roleId: "role-viewer" },
        }),
      );
    });

    describe("by roleId", () => {
      it("gives a member a custom role of this workspace", async () => {
        prisma.role.findFirst.mockResolvedValue({
          id: "role-triage",
          systemKey: null,
          permissions: ["issue:status"],
        });

        await service.updateRole(workspaceId, "user-member", adminAccess, {
          roleId: "role-triage",
        });

        expect(prisma.role.findFirst).toHaveBeenCalledWith({
          where: { id: "role-triage", workspaceId },
          select: { id: true, systemKey: true, permissions: true },
        });
        // The enum column reads MEMBER; permissions come from the Role row.
        expect(prisma.membership.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: { role: WorkspaceRole.MEMBER, roleId: "role-triage" },
          }),
        );
      });

      it("404s a role of another workspace", async () => {
        // The lookup is scoped to this workspace, so it finds nothing.
        await expect(
          service.updateRole(workspaceId, "user-member", adminAccess, {
            roleId: "role-of-B",
          }),
        ).rejects.toBeInstanceOf(NotFoundException);
        expect(prisma.membership.update).not.toHaveBeenCalled();
      });

      it("refuses the owner's role", async () => {
        prisma.role.findFirst.mockResolvedValue({
          id: "role-owner",
          systemKey: WorkspaceRole.OWNER,
          permissions: [],
        });

        await expect(
          service.updateRole(workspaceId, "user-member", adminAccess, {
            roleId: "role-owner",
          }),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });

      it("refuses a custom role with permissions the actor lacks", async () => {
        roster["user-viewer"] = WorkspaceRole.VIEWER;
        prisma.role.findFirst.mockResolvedValue({
          id: "role-labeller",
          systemKey: null,
          permissions: ["label:manage"],
        });

        await expect(
          service.updateRole(workspaceId, "user-viewer", memberManager, {
            roleId: "role-labeller",
          }),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(prisma.membership.update).not.toHaveBeenCalled();
      });

      it("400s both or neither of roleId and role", async () => {
        await expect(
          service.updateRole(workspaceId, "user-member", adminAccess, {
            roleId: "role-x",
            role: WorkspaceRole.VIEWER,
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
        await expect(
          service.updateRole(workspaceId, "user-member", adminAccess, {}),
        ).rejects.toBeInstanceOf(BadRequestException);
      });
    });

    it("404s a user who is a member of another workspace only", async () => {
      await expect(
        service.updateRole(workspaceId, "user-from-B", adminAccess, {
          role: WorkspaceRole.ADMIN,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.membership.update).not.toHaveBeenCalled();
    });

    describe("an actor may not hand out more access than their own", () => {
      it("refuses to assign a role with permissions the actor lacks", async () => {
        await expect(
          service.updateRole(workspaceId, "user-member", memberManager, {
            role: WorkspaceRole.ADMIN,
          }),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(prisma.membership.update).not.toHaveBeenCalled();
      });

      it("refuses to change a member who holds permissions the actor lacks", async () => {
        await expect(
          service.updateRole(workspaceId, "user-member", memberManager, {
            role: WorkspaceRole.VIEWER,
          }),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(prisma.membership.update).not.toHaveBeenCalled();
      });

      it("allows a change entirely within the actor's own access", async () => {
        roster["user-viewer"] = WorkspaceRole.VIEWER;

        await service.updateRole(workspaceId, "user-viewer", memberManager, {
          role: WorkspaceRole.VIEWER,
        });

        expect(prisma.membership.update).toHaveBeenCalled();
      });
    });

    it.each([
      ["their own role", admin, WorkspaceRole.VIEWER],
      ["the OWNER's role", "user-owner", WorkspaceRole.MEMBER],
      ["anyone to OWNER", "user-member", WorkspaceRole.OWNER],
    ])("refuses to change %s", async (_label, target, role) => {
      await expect(
        service.updateRole(workspaceId, target, adminAccess, { role }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.membership.update).not.toHaveBeenCalled();
    });
  });

  describe("removeMember", () => {
    it("removes the member from this workspace only", async () => {
      await service.removeMember(workspaceId, "user-member", adminAccess);

      expect(prisma.membership.delete).toHaveBeenCalledWith({
        where: {
          userId_workspaceId: { userId: "user-member", workspaceId },
        },
      });
      expect(billing.syncSeats).toHaveBeenCalledWith(workspaceId);
    });

    it("404s a user who is not in this workspace", async () => {
      await expect(
        service.removeMember(workspaceId, "user-from-B", adminAccess),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.membership.delete).not.toHaveBeenCalled();
    });

    it("refuses to remove the OWNER", async () => {
      await expect(
        service.removeMember(workspaceId, "user-owner", adminAccess),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.membership.delete).not.toHaveBeenCalled();
      expect(billing.syncSeats).not.toHaveBeenCalled();
    });
  });

  describe("acting on a member takes strictly more access", () => {
    const ownerAccess = accessAs(WorkspaceRole.OWNER, {
      workspaceId,
      userId: "user-owner",
    });

    beforeEach(() => {
      roster["user-admin-2"] = WorkspaceRole.ADMIN;
    });

    it("refuses an Admin demoting another Admin", async () => {
      await expect(
        service.updateRole(workspaceId, "user-admin-2", adminAccess, {
          role: WorkspaceRole.MEMBER,
        }),
      ).rejects.toThrow("less access than your own");
      expect(prisma.membership.update).not.toHaveBeenCalled();
    });

    it("refuses an Admin removing another Admin", async () => {
      await expect(
        service.removeMember(workspaceId, "user-admin-2", adminAccess),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.membership.delete).not.toHaveBeenCalled();
    });

    it("lets the OWNER demote and remove an Admin", async () => {
      await service.updateRole(workspaceId, "user-admin-2", ownerAccess, {
        role: WorkspaceRole.MEMBER,
      });
      await service.removeMember(workspaceId, "user-admin-2", ownerAccess);

      expect(prisma.membership.update).toHaveBeenCalled();
      expect(prisma.membership.delete).toHaveBeenCalled();
    });

    it("still lets an Admin make a member an Admin", async () => {
      await service.updateRole(workspaceId, "user-member", adminAccess, {
        role: WorkspaceRole.ADMIN,
      });

      expect(prisma.membership.update).toHaveBeenCalled();
    });

    it("refuses a peer holding the same custom role", async () => {
      prisma.membership.findUnique.mockResolvedValueOnce({
        userId: "user-manager-2",
        role: WorkspaceRole.MEMBER,
        roleId: "role-manager",
        assignedRole: { systemKey: null, permissions: ["member:manage"] },
      });

      await expect(
        service.removeMember(workspaceId, "user-manager-2", memberManager),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.membership.delete).not.toHaveBeenCalled();
    });
  });
});

describe("MembershipService ownership transfer and leaving", () => {
  const workspaceId = "ws-A";
  const owner = accessAs(WorkspaceRole.OWNER, {
    workspaceId,
    userId: "user-owner",
  });
  const member = accessAs(WorkspaceRole.MEMBER, {
    workspaceId,
    userId: "user-member",
  });

  let prisma: {
    membership: {
      updateMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      delete: jest.Mock;
    };
    role: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let service: MembershipService;

  beforeEach(() => {
    prisma = {
      membership: {
        // One row matched unless a test says otherwise.
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ userId: "user-member" }),
        count: jest.fn().mockResolvedValue(2),
        delete: jest.fn().mockResolvedValue({ userId: "user-member" }),
      },
      role: {
        findFirst: jest.fn(({ where }: { where: { systemKey: string } }) =>
          Promise.resolve({ id: `role-${where.systemKey}`, permissions: [] }),
        ),
      },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb(prisma),
    );
    service = new MembershipService(
      prisma as unknown as PrismaService,
      asBilling,
    );
  });

  describe("transferOwnership", () => {
    it("makes the member OWNER and the old owner ADMIN, in this workspace", async () => {
      await service.transferOwnership(workspaceId, owner, "user-member");

      expect(prisma.membership.updateMany).toHaveBeenNthCalledWith(1, {
        where: { workspaceId, userId: "user-owner", role: WorkspaceRole.OWNER },
        data: { role: WorkspaceRole.ADMIN, roleId: "role-ADMIN" },
      });
      expect(prisma.membership.updateMany).toHaveBeenNthCalledWith(2, {
        where: { workspaceId, userId: "user-member" },
        data: { role: WorkspaceRole.OWNER, roleId: "role-OWNER" },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it("refuses a transfer to yourself", async () => {
      await expect(
        service.transferOwnership(workspaceId, owner, "user-owner"),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.membership.updateMany).not.toHaveBeenCalled();
    });

    it("404s someone who isn't in this workspace (the step-down rolls back)", async () => {
      prisma.membership.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });

      await expect(
        service.transferOwnership(workspaceId, owner, "user-elsewhere"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("refuses when the caller is no longer the owner (a racing transfer won)", async () => {
      prisma.membership.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        service.transferOwnership(workspaceId, owner, "user-member"),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.membership.updateMany).toHaveBeenCalledTimes(1);
    });
  });

  describe("leave", () => {
    it("removes the caller's own membership in this workspace", async () => {
      await service.leave(member);

      expect(prisma.membership.delete).toHaveBeenCalledWith({
        where: {
          userId_workspaceId: { userId: "user-member", workspaceId },
        },
      });
      expect(billing.syncSeats).toHaveBeenCalledWith(workspaceId);
    });

    it("refuses the owner", async () => {
      await expect(service.leave(owner)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.membership.delete).not.toHaveBeenCalled();
    });

    it("refuses leaving your only workspace", async () => {
      prisma.membership.count.mockResolvedValue(1);

      await expect(service.leave(member)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.membership.count).toHaveBeenCalledWith({
        where: { userId: "user-member" },
      });
      expect(prisma.membership.delete).not.toHaveBeenCalled();
    });
  });
});
