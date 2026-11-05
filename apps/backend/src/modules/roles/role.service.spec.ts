import { GRANTABLE_PERMISSIONS } from "@/common/permissions/permissions";
import { accessAs } from "@/common/permissions/test-access";
import { WorkspaceAccess } from "@/common/permissions/workspace-access";
import { PrismaService } from "@/prisma/prisma.service";
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { WorkspaceRole } from "generated/prisma/enums";
import { RoleService } from "./role.service";

const workspaceId = "ws-1";
const admin = accessAs(WorkspaceRole.ADMIN, { workspaceId });
/** A custom-role actor who may manage roles and labels, nothing else. */
const roleManager: WorkspaceAccess = {
  ...admin,
  systemKey: null,
  permissions: new Set(["role:manage", "label:manage"]),
};

const customRole = (overrides: Record<string, unknown> = {}) => ({
  id: "role-triage",
  workspaceId,
  name: "Triage",
  systemKey: null,
  permissions: ["issue:status"],
  ...overrides,
});

let prisma: {
  role: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  membership: { count: jest.Mock };
  invitation: { count: jest.Mock; updateMany: jest.Mock };
  $transaction: jest.Mock;
};
let service: RoleService;

beforeEach(() => {
  prisma = {
    role: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "role-new" }),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    membership: { count: jest.fn().mockResolvedValue(0) },
    invitation: {
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
    cb(prisma),
  );
  service = new RoleService(prisma as unknown as PrismaService);
});

describe("RoleService.findAll", () => {
  it("lists this workspace's roles: built-ins in order, then custom by name", async () => {
    const row = (name: string, systemKey: WorkspaceRole | null) => ({
      id: name,
      name,
      systemKey,
      permissions: [],
      _count: { memberships: 2 },
    });
    prisma.role.findMany.mockResolvedValue([
      row("Admin", WorkspaceRole.ADMIN),
      row("Auditor", null),
      row("Member", WorkspaceRole.MEMBER),
      row("Owner", WorkspaceRole.OWNER),
      row("Triage", null),
      row("Viewer", WorkspaceRole.VIEWER),
    ]);

    const roles = await service.findAll(workspaceId);

    expect(prisma.role.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId } }),
    );
    expect(roles.map((r) => r.name)).toEqual([
      "Owner",
      "Admin",
      "Member",
      "Viewer",
      "Auditor",
      "Triage",
    ]);
    expect(roles[0].memberCount).toBe(2);
  });

  it("reports the owner as holding the whole catalog, and drops unknown keys", async () => {
    prisma.role.findMany.mockResolvedValue([
      {
        id: "o",
        name: "Owner",
        systemKey: WorkspaceRole.OWNER,
        permissions: [],
        _count: { memberships: 1 },
      },
      {
        id: "c",
        name: "Custom",
        systemKey: null,
        permissions: ["issue:status", "retired:key", "issue:create"],
        _count: { memberships: 0 },
      },
    ]);

    const [owner, custom] = await service.findAll(workspaceId);

    expect(owner.permissions).toEqual([...GRANTABLE_PERMISSIONS]);
    // In catalog order, unknown keys gone.
    expect(custom.permissions).toEqual(["issue:create", "issue:status"]);
  });
});

describe("RoleService.create", () => {
  it("creates a custom role in this workspace, permissions in catalog order", async () => {
    await service.create(workspaceId, admin, {
      name: "Triage",
      permissions: ["issue:status", "issue:create"],
    });

    expect(prisma.role.create).toHaveBeenCalledWith({
      data: {
        workspaceId,
        name: "Triage",
        permissions: ["issue:create", "issue:status"],
      },
    });
  });

  it("refuses a name taken in this workspace, ignoring case (built-ins included)", async () => {
    prisma.role.findFirst.mockResolvedValue({ id: "role-admin" });

    await expect(
      service.create(workspaceId, admin, { name: "admin", permissions: [] }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.role.findFirst).toHaveBeenCalledWith({
      where: { workspaceId, name: { equals: "admin", mode: "insensitive" } },
      select: { id: true },
    });
    expect(prisma.role.create).not.toHaveBeenCalled();
  });

  it("refuses a permission the actor doesn't hold", async () => {
    await expect(
      service.create(workspaceId, roleManager, {
        name: "Deleter",
        permissions: ["issue:delete"],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.role.create).not.toHaveBeenCalled();
  });
});

describe("RoleService.update", () => {
  it("renames a custom role and replaces its permissions", async () => {
    prisma.role.findFirst
      .mockResolvedValueOnce(customRole()) // the role
      .mockResolvedValueOnce(null); // the name is free

    await service.update(workspaceId, "role-triage", admin, {
      name: "Triagers",
      permissions: ["issue:status", "comment:create"],
    });

    expect(prisma.role.findFirst).toHaveBeenNthCalledWith(1, {
      where: { id: "role-triage", workspaceId },
    });
    expect(prisma.role.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        workspaceId,
        name: { equals: "Triagers", mode: "insensitive" },
        id: { not: "role-triage" },
      },
      select: { id: true },
    });
    expect(prisma.role.update).toHaveBeenCalledWith({
      where: { id: "role-triage" },
      data: {
        name: "Triagers",
        permissions: ["issue:status", "comment:create"],
      },
    });
  });

  it("404s a role of another workspace", async () => {
    await expect(
      service.update(workspaceId, "role-of-B", admin, { name: "x" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
    WorkspaceRole.VIEWER,
  ])("refuses to change the built-in %s role", async (systemKey) => {
    prisma.role.findFirst.mockResolvedValue(customRole({ systemKey }));

    await expect(
      service.update(workspaceId, "role-x", admin, { permissions: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.role.update).not.toHaveBeenCalled();
  });

  it("refuses to change a role holding a permission the actor lacks", async () => {
    prisma.role.findFirst.mockResolvedValue(customRole());

    await expect(
      service.update(workspaceId, "role-triage", roleManager, {
        name: "Renamed",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuses to grant a permission the actor lacks", async () => {
    prisma.role.findFirst.mockResolvedValue(
      customRole({ permissions: ["label:manage"] }),
    );

    await expect(
      service.update(workspaceId, "role-triage", roleManager, {
        permissions: ["label:manage", "member:manage"],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.role.update).not.toHaveBeenCalled();
  });
});

describe("RoleService.remove", () => {
  beforeEach(() => {
    prisma.role.findFirst.mockResolvedValue(customRole());
  });

  it("deletes an unused custom role, unlinking used-up invitations", async () => {
    await service.remove(workspaceId, "role-triage", admin);

    expect(prisma.invitation.updateMany).toHaveBeenCalledWith({
      where: { roleId: "role-triage" },
      data: { roleId: null },
    });
    expect(prisma.role.delete).toHaveBeenCalledWith({
      where: { id: "role-triage" },
    });
  });

  it("refuses while members hold it", async () => {
    prisma.membership.count.mockResolvedValue(2);

    await expect(
      service.remove(workspaceId, "role-triage", admin),
    ).rejects.toThrow("2 members have this role");
    expect(prisma.role.delete).not.toHaveBeenCalled();
  });

  it("refuses while a live invitation uses it", async () => {
    prisma.invitation.count.mockResolvedValue(1);

    await expect(
      service.remove(workspaceId, "role-triage", admin),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.invitation.count).toHaveBeenCalledWith({
      where: {
        roleId: "role-triage",
        status: "PENDING",
        expiresAt: { gt: expect.any(Date) as Date },
      },
    });
    expect(prisma.role.delete).not.toHaveBeenCalled();
  });

  it("refuses a built-in role", async () => {
    prisma.role.findFirst.mockResolvedValue(
      customRole({ systemKey: WorkspaceRole.VIEWER }),
    );

    await expect(
      service.remove(workspaceId, "role-viewer", admin),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
