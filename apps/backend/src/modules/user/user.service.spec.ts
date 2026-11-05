import { CloudinaryService } from "@/cloudinary/cloudinary.service";
import { PrismaService } from "@/prisma/prisma.service";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { UserService } from "./user.service";

describe("UserService.update avatar handling", () => {
  const userId = "user-1";
  const ownPublicId = "taskforge/user-avatar/mine";
  const tempPublicId = "taskforge/temp/user-avatar/fresh";
  const victimPublicId = "taskforge/user-avatar/victims";

  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
  };
  let cloudinary: {
    isTemp: jest.Mock;
    promoteToPermanent: jest.Mock;
    delete: jest.Mock;
  };
  let service: UserService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: userId,
          name: "Me",
          avatarPublicId: ownPublicId,
        }),
        update: jest.fn().mockResolvedValue({ id: userId }),
      },
    };
    cloudinary = {
      isTemp: jest.fn((id: string) => id.startsWith("taskforge/temp/")),
      promoteToPermanent: jest.fn().mockResolvedValue({
        url: "https://cdn.example/user-avatar/fresh.png",
        publicId: "taskforge/user-avatar/fresh",
      }),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    service = new UserService(
      prisma as unknown as PrismaService,
      cloudinary as unknown as CloudinaryService,
    );
  });

  it("refuses to adopt another user's permanent avatar", async () => {
    await expect(
      service.update(userId, { avatarPublicId: victimPublicId }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(cloudinary.promoteToPermanent).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("never deletes an asset it did not own", async () => {
    await expect(
      service.update(userId, { avatarPublicId: victimPublicId }),
    ).rejects.toThrow();

    expect(cloudinary.delete).not.toHaveBeenCalled();
  });

  it("promotes a fresh temp upload and removes the old avatar", async () => {
    await service.update(userId, { avatarPublicId: tempPublicId });

    // The destination folder is chosen here, per user — never from the client.
    expect(cloudinary.promoteToPermanent).toHaveBeenCalledWith(
      tempPublicId,
      "taskforge/user-avatar/user-1",
    );
    const data: unknown = expect.objectContaining({
      avatarUrl: "https://cdn.example/user-avatar/fresh.png",
      avatarPublicId: "taskforge/user-avatar/fresh",
    });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data }),
    );
    expect(cloudinary.delete).toHaveBeenCalledWith(ownPublicId);
  });

  it("treats the caller's own avatar echoed back as a no-op", async () => {
    await service.update(userId, {
      name: "Renamed",
      avatarPublicId: ownPublicId,
    });

    expect(cloudinary.promoteToPermanent).not.toHaveBeenCalled();
    expect(cloudinary.delete).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: "Renamed" } }),
    );
  });

  it("removes the avatar on an explicit null and destroys the stored asset", async () => {
    await service.update(userId, { avatarPublicId: null, avatarUrl: "x" });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { avatarUrl: null, avatarPublicId: null },
    });
    expect(cloudinary.delete).toHaveBeenCalledWith(ownPublicId);
    expect(cloudinary.promoteToPermanent).not.toHaveBeenCalled();
  });

  it("ignores a client-sent avatarUrl", async () => {
    await service.update(userId, {
      name: "Me",
      avatarUrl: "https://evil.example/x.png",
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { name: "Me" },
    });
  });

  it("updates plain fields without touching Cloudinary", async () => {
    await service.update(userId, { name: "Renamed" });

    expect(cloudinary.promoteToPermanent).not.toHaveBeenCalled();
    expect(cloudinary.delete).not.toHaveBeenCalled();
  });
});

describe("UserService.findProfile", () => {
  const findUnique = jest.fn();
  const service = new UserService(
    { user: { findUnique } } as unknown as PrismaService,
    {} as CloudinaryService,
  );

  it("says whether the user has a password, without returning the auth rows", async () => {
    findUnique.mockResolvedValueOnce({ id: "u1", auths: [{ id: "a1" }] });
    await expect(service.findProfile("u1")).resolves.toEqual({
      id: "u1",
      hasPassword: true,
    });

    findUnique.mockResolvedValueOnce({ id: "u2", auths: [] });
    await expect(service.findProfile("u2")).resolves.toEqual({
      id: "u2",
      hasPassword: false,
    });
  });

  it("is a 404 for a user that no longer exists", async () => {
    findUnique.mockResolvedValueOnce(null);
    await expect(service.findProfile("gone")).rejects.toThrow(
      NotFoundException,
    );
  });
});
