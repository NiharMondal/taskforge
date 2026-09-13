import { CloudinaryService } from "@/cloudinary/cloudinary.service";
import { UpdateUserDto } from "@/modules/user/dto/update-user.dto";
import { PrismaService } from "@/prisma/prisma.service";
import { Injectable, NotFoundException } from "@nestjs/common";
import { User } from "generated/prisma/client";

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async findAll() {
    return this.prisma.user.findMany({
      include: {
        auth: {
          select: {
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        auth: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.auth.findUnique({
      where: { email },
      include: {
        user: true,
      },
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const existing = await this.findOne(id);

    const { avatarPublicId, ...rest } = dto;

    if (!avatarPublicId) {
      return this.prisma.user.update({
        where: { id },
        data: rest,
        include: {
          auth: {
            select: {
              email: true,
            },
          },
        },
      });
    }

    const promoted = await this.cloudinary.promoteToPermanent(avatarPublicId);

    let user: User;

    try {
      user = await this.prisma.user.update({
        where: { id },
        data: {
          ...rest,
          avatarUrl: promoted.url,
          avatarPublicId: promoted.publicId,
        },
      });
    } catch (error) {
      await this.cloudinary.delete(promoted.publicId);
      throw error;
    }

    if (
      existing.avatarPublicId &&
      existing.avatarPublicId !== promoted.publicId
    ) {
      await this.cloudinary.delete(existing.avatarPublicId);
    }

    return this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        auth: {
          select: {
            email: true,
          },
        },
      },
    });
  }

  async remove(id: string): Promise<void> {
    const existing = await this.findOne(id);

    await this.prisma.user.delete({
      where: { id },
    });

    if (existing.avatarPublicId) {
      await this.cloudinary.delete(existing.avatarPublicId);
    }
  }
}
