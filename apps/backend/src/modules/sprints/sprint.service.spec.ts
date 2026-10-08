import { PrismaService } from "@/prisma/prisma.service";
import { NotFoundException } from "@nestjs/common";
import { WorkspaceRole } from "generated/prisma/enums";
import { SprintService } from "./sprint.service";

describe("SprintService.endSprint tenant isolation", () => {
  const workspaceId = "ws-A";
  const sprintId = "sprint-1";

  let prisma: {
    sprint: { findFirst: jest.Mock; update: jest.Mock };
    issue: { updateMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let service: SprintService;

  beforeEach(() => {
    prisma = {
      sprint: {
        findFirst: jest.fn().mockResolvedValue({
          id: sprintId,
          workspaceId,
          projectId: "proj-1",
          isActive: true,
        }),
        update: jest.fn().mockResolvedValue({ id: sprintId }),
      },
      issue: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb(prisma),
    );
    service = new SprintService(prisma as unknown as PrismaService);
  });

  it("only releases unfinished issues that belong to the caller's workspace", async () => {
    await service.endSprint(workspaceId, sprintId, WorkspaceRole.ADMIN);

    expect(prisma.issue.updateMany).toHaveBeenCalledWith({
      where: { sprintId, workspaceId, status: { not: "DONE" } },
      data: { sprintId: null },
    });
  });

  it("cannot end another workspace's sprint, and writes nothing", async () => {
    prisma.sprint.findFirst.mockResolvedValue(null);

    await expect(
      service.endSprint("ws-B", sprintId, WorkspaceRole.ADMIN),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.sprint.findFirst).toHaveBeenCalledWith({
      where: { id: sprintId, workspaceId: "ws-B" },
    });
    expect(prisma.issue.updateMany).not.toHaveBeenCalled();
    expect(prisma.sprint.update).not.toHaveBeenCalled();
  });
});
