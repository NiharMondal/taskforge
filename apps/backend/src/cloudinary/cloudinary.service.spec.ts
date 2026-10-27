import { ConfigService } from "@nestjs/config";
import { CloudinaryService } from "./cloudinary.service";

const mockRename = jest.fn();
const mockDestroy = jest.fn();

jest.mock("cloudinary", () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      rename: (...args: unknown[]) => mockRename(...args) as unknown,
      destroy: (...args: unknown[]) => mockDestroy(...args) as unknown,
    },
  },
}));

describe("CloudinaryService", () => {
  const tempId = "taskforge/temp/user-avatar/abc";
  let service: CloudinaryService;

  beforeEach(() => {
    mockRename
      .mockReset()
      .mockImplementation((_from: string, to: string) =>
        Promise.resolve({ public_id: to, secure_url: `https://cdn/${to}.png` }),
      );
    mockDestroy.mockReset().mockResolvedValue({ result: "ok" });
    service = new CloudinaryService({
      getOrThrow: () => "x",
    } as unknown as ConfigService);
  });

  describe("isTemp", () => {
    it("accepts ids under the temp prefix", () => {
      expect(service.isTemp(tempId)).toBe(true);
    });

    it("rejects permanent ids, even with a /temp/ segment further in", () => {
      expect(service.isTemp("taskforge/user-avatar/abc")).toBe(false);
      expect(service.isTemp("taskforge/user-avatar/victim/temp/x")).toBe(false);
    });
  });

  describe("promoteToPermanent", () => {
    it("moves the upload to a fresh id in the given folder, never overwriting", async () => {
      const asset = await service.promoteToPermanent(
        tempId,
        "taskforge/user-avatar/user-1",
      );

      const [from, to, options] = mockRename.mock.calls[0] as [
        string,
        string,
        { overwrite: boolean },
      ];
      expect(from).toBe(tempId);
      expect(to).toMatch(/^taskforge\/user-avatar\/user-1\/[0-9a-f-]{36}$/);
      expect(options.overwrite).toBe(false);
      expect(asset.publicId).toBe(to);
    });

    it("does not derive the destination from the client-chosen temp id", async () => {
      // An upload named after someone else's avatar must not land on it.
      await service.promoteToPermanent(
        "taskforge/temp/user-avatar/victims-avatar",
        "taskforge/user-avatar/attacker",
      );

      const to = (mockRename.mock.calls[0] as string[])[1];
      expect(to).not.toContain("victims-avatar");
      expect(to.startsWith("taskforge/user-avatar/attacker/")).toBe(true);
    });

    it("refuses an asset that is not a temp upload", async () => {
      await expect(
        service.promoteToPermanent(
          "taskforge/user-avatar/someone",
          "taskforge/user-avatar/user-1",
        ),
      ).rejects.toThrow();
      expect(mockRename).not.toHaveBeenCalled();
    });
  });

  describe("deleteTemp", () => {
    const ownTempId = "taskforge/temp/user-avatar/user-1/abc";

    it("deletes the caller's own temp upload", async () => {
      await service.deleteTemp(ownTempId, "user-1");
      expect(mockDestroy).toHaveBeenCalledWith(ownTempId, { invalidate: true });
    });

    it("ignores another user's temp upload", async () => {
      await service.deleteTemp(ownTempId, "user-2");
      // Uploaded before per-user folders: no owner, so nobody can delete it.
      await service.deleteTemp(tempId, "user-1");
      await service.deleteTemp(tempId, "abc");
      expect(mockDestroy).not.toHaveBeenCalled();
    });

    it("ignores anything outside the temp prefix", async () => {
      await service.deleteTemp("taskforge/user-avatar/user-1/x", "user-1");
      await service.deleteTemp("taskforge/user-avatar/someone/temp/x", "temp");
      expect(mockDestroy).not.toHaveBeenCalled();
    });
  });
});
