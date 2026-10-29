import { PrismaService } from "@/prisma/prisma.service";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { SprintService } from "./sprint.service";

describe("SprintService", () => {
  const workspaceId = "ws-A";
  const projectId = "proj-1";
  const sprintId = "sprint-1";

  let prisma: {
    sprint: {
      findFirst: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
    project: { findFirst: jest.Mock };
    issue: { updateMany: jest.Mock };
    $transaction: jest.Mock;
    $executeRaw: jest.Mock;
  };
  let service: SprintService;

  /** The stored sprint `getSprint` finds (other `findFirst`s find nothing). */
  const storeSprint = (fields: Record<string, unknown>) => {
    prisma.sprint.findFirst.mockImplementation(
      ({ where }: { where: { id?: string; projectId?: string } }) =>
        Promise.resolve(
          where.id === sprintId && where.projectId === projectId
            ? { id: sprintId, workspaceId, projectId, ...fields }
            : null,
        ),
    );
  };

  beforeEach(() => {
    prisma = {
      sprint: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: sprintId }),
        create: jest.fn().mockResolvedValue({ id: sprintId }),
      },
      project: {
        findFirst: jest.fn().mockResolvedValue({ id: projectId, workspaceId }),
      },
      issue: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      $transaction: jest.fn(),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb(prisma),
    );
    storeSprint({ isActive: true, completedAt: null });
    service = new SprintService(prisma as unknown as PrismaService);
  });

  describe("endSprint", () => {
    it("only releases unfinished issues that belong to the caller's workspace", async () => {
      await service.endSprint(workspaceId, projectId, sprintId);

      // Unfinished by category: a project names its completed statuses.
      expect(prisma.issue.updateMany).toHaveBeenCalledWith({
        where: {
          sprintId,
          workspaceId,
          status: { category: { not: "COMPLETED" } },
        },
        data: { sprintId: null },
      });
    });

    it("marks the sprint completed", async () => {
      await service.endSprint(workspaceId, projectId, sprintId);

      const anyDate: unknown = expect.any(Date);
      expect(prisma.sprint.update).toHaveBeenCalledWith({
        where: { id: sprintId },
        data: { isActive: false, endDate: anyDate, completedAt: anyDate },
      });
    });

    it("cannot end another workspace's sprint, and writes nothing", async () => {
      prisma.sprint.findFirst.mockResolvedValue(null);

      await expect(
        service.endSprint("ws-B", projectId, sprintId),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.sprint.findFirst).toHaveBeenCalledWith({
        where: { id: sprintId, workspaceId: "ws-B", projectId },
      });
      expect(prisma.issue.updateMany).not.toHaveBeenCalled();
      expect(prisma.sprint.update).not.toHaveBeenCalled();
    });
  });

  describe("startSprint", () => {
    beforeEach(() => storeSprint({ isActive: false, completedAt: null }));

    it("starts a planned sprint under the project's lock", async () => {
      await service.startSprint(workspaceId, projectId, sprintId);

      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(prisma.sprint.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: sprintId },
          data: expect.objectContaining({ isActive: true }) as unknown,
        }),
      );
    });

    it("refuses a sprint from another project in the URL", async () => {
      await expect(
        service.startSprint(workspaceId, "proj-other", sprintId),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.sprint.update).not.toHaveBeenCalled();
    });

    it("refuses to restart a completed sprint", async () => {
      storeSprint({ isActive: false, completedAt: new Date() });

      await expect(
        service.startSprint(workspaceId, projectId, sprintId),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.sprint.update).not.toHaveBeenCalled();
    });

    it("refuses while another sprint in the project is active", async () => {
      prisma.sprint.findFirst.mockImplementation(
        ({ where }: { where: { id?: string; isActive?: boolean } }) =>
          Promise.resolve(
            where.isActive
              ? { id: "sprint-2", isActive: true }
              : { id: sprintId, workspaceId, projectId, isActive: false },
          ),
      );

      await expect(
        service.startSprint(workspaceId, projectId, sprintId),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.sprint.update).not.toHaveBeenCalled();
    });
  });

  describe("dates", () => {
    it("refuses to create a sprint that ends before it starts", async () => {
      await expect(
        service.create(workspaceId, projectId, {
          name: "S1",
          startDate: "2026-11-10T00:00:00.000Z",
          endDate: "2026-11-01T00:00:00.000Z",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.sprint.create).not.toHaveBeenCalled();
    });

    it("checks a PATCHed endDate against the stored startDate", async () => {
      storeSprint({ startDate: new Date("2026-11-10T00:00:00.000Z") });

      await expect(
        service.updateSprint(workspaceId, projectId, sprintId, {
          endDate: "2026-11-01T00:00:00.000Z",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.sprint.update).not.toHaveBeenCalled();
    });

    it("accepts a one-day sprint (same start and end)", async () => {
      await service.create(workspaceId, projectId, {
        name: "S1",
        startDate: "2026-11-10T00:00:00.000Z",
        endDate: "2026-11-10T00:00:00.000Z",
      });
      expect(prisma.sprint.create).toHaveBeenCalled();
    });

    it("accepts a PATCHed endDate that is after the stored startDate", async () => {
      storeSprint({ startDate: new Date("2026-11-10T00:00:00.000Z") });

      await service.updateSprint(workspaceId, projectId, sprintId, {
        endDate: "2026-11-15T00:00:00.000Z",
      });
      expect(prisma.sprint.update).toHaveBeenCalled();
    });
  });
});
