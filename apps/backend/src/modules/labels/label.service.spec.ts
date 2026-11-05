import { PrismaService } from "@/prisma/prisma.service";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { LabelService } from "./label.service";

describe("LabelService", () => {
  const workspaceId = "ws-1";
  const labelId = "label-1";

  let prisma: {
    label: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let service: LabelService;

  /** What `findFirst` answers: the label lookup, then the name check. */
  let stored: { id: string } | null;
  let nameTakenBy: { id: string } | null;

  beforeEach(() => {
    stored = { id: labelId };
    nameTakenBy = null;
    prisma = {
      label: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(({ where }: { where: { name?: unknown } }) =>
          Promise.resolve(where.name ? nameTakenBy : stored),
        ),
        create: jest.fn().mockResolvedValue({ id: labelId }),
        update: jest.fn().mockResolvedValue({ id: labelId }),
        delete: jest.fn().mockResolvedValue({ id: labelId }),
      },
    };
    service = new LabelService(prisma as unknown as PrismaService);
  });

  describe("tenant isolation", () => {
    it("lists only this workspace's labels", async () => {
      await service.findAll(workspaceId);

      expect(prisma.label.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { workspaceId } }),
      );
    });

    it("looks a label up within the workspace", async () => {
      await service.remove(workspaceId, labelId);

      expect(prisma.label.findFirst).toHaveBeenCalledWith({
        where: { id: labelId, workspaceId },
      });
    });

    it.each([
      [
        "updates",
        () => service.update(workspaceId, labelId, { color: "#000000" }),
      ],
      ["deletes", () => service.remove(workspaceId, labelId)],
    ])(
      "404s and %s nothing for another workspace's label",
      async (_label, act) => {
        stored = null;

        await expect(act()).rejects.toBeInstanceOf(NotFoundException);
        expect(prisma.label.update).not.toHaveBeenCalled();
        expect(prisma.label.delete).not.toHaveBeenCalled();
      },
    );
  });

  describe("names are unique in the workspace, ignoring case", () => {
    it("checks case-insensitively, in this workspace", async () => {
      await service.create(workspaceId, { name: "Bug", color: "#ef4444" });

      expect(prisma.label.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workspaceId,
            name: { equals: "Bug", mode: "insensitive" },
          },
        }),
      );
      expect(prisma.label.create).toHaveBeenCalledWith({
        data: { name: "Bug", color: "#ef4444", workspaceId },
      });
    });

    it("refuses a new label whose name is taken", async () => {
      nameTakenBy = { id: "label-2" };

      await expect(
        service.create(workspaceId, { name: "bug", color: "#ef4444" }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.label.create).not.toHaveBeenCalled();
    });

    it("refuses renaming onto another label's name", async () => {
      nameTakenBy = { id: "label-2" };

      await expect(
        service.update(workspaceId, labelId, { name: "BUG" }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.label.update).not.toHaveBeenCalled();
    });

    it("ignores the label itself, so its name's case can change", async () => {
      await service.update(workspaceId, labelId, { name: "BUG" });

      expect(prisma.label.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: labelId },
          }) as unknown,
        }),
      );
      expect(prisma.label.update).toHaveBeenCalledTimes(1);
    });

    it("skips the check when only the color changes", async () => {
      await service.update(workspaceId, labelId, { color: "#000000" });

      expect(prisma.label.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.label.update).toHaveBeenCalledWith({
        where: { id: labelId },
        data: { name: undefined, color: "#000000" },
      });
    });
  });
});
