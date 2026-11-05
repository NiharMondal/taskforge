import { PrismaService } from "@/prisma/prisma.service";
import { AUDIT_ENTITY_TYPES } from "@taskforge/shared";
import { AuditLogService } from "./audit-log.service";

describe("AuditLogService.findAll", () => {
  let prisma: { auditLog: { findMany: jest.Mock; count: jest.Mock } };
  let service: AuditLogService;

  /** The `where` of the page query. */
  const where = () =>
    (prisma.auditLog.findMany.mock.calls[0] as [{ where: unknown }])[0].where;

  beforeEach(() => {
    prisma = {
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    service = new AuditLogService(prisma as unknown as PrismaService);
  });

  it("reads only this workspace's workspace events, never issue history", async () => {
    await service.findAll("ws-A", { page: 1, limit: 20 });

    expect(where()).toEqual({
      workspaceId: "ws-A",
      entityType: { in: [...AUDIT_ENTITY_TYPES] },
    });
    expect(AUDIT_ENTITY_TYPES).not.toContain("ISSUE");
  });

  it("narrows to one entity type, still within the workspace", async () => {
    await service.findAll("ws-A", { page: 1, limit: 20, entityType: "ROLE" });

    expect(where()).toEqual({ workspaceId: "ws-A", entityType: "ROLE" });
  });

  it("pages newest first, with the actor's name", async () => {
    await service.findAll("ws-A", { page: 3, limit: 10 });

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 10,
        orderBy: expect.arrayContaining([{ createdAt: "desc" }]) as unknown,
        select: expect.objectContaining({
          user: { select: { id: true, name: true, avatarUrl: true } },
        }) as unknown,
      }),
    );
  });
});
