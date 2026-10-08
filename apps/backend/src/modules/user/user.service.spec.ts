import { CloudinaryService } from "@/cloudinary/cloudinary.service";
import { PrismaService } from "@/prisma/prisma.service";
import { BadRequestException } from "@nestjs/common";
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
      isTemp: jest.fn((id: string) => id.includes("/temp/")),
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

    expect(cloudinary.promoteToPermanent).toHaveBeenCalledWith(tempPublicId);
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

  it("updates plain fields without touching Cloudinary", async () => {
    await service.update(userId, { name: "Renamed" });

    expect(cloudinary.promoteToPermanent).not.toHaveBeenCalled();
    expect(cloudinary.delete).not.toHaveBeenCalled();
  });
});
