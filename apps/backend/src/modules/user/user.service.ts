import { CloudinaryService } from "@/cloudinary/cloudinary.service";
import { UpdateUserDto } from "@/modules/user/dto/update-user.dto";
import { PrismaService } from "@/prisma/prisma.service";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { User } from "generated/prisma/client";

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

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

    // promoteToPermanent() happily adopts any existing Cloudinary asset, and a
    // later avatar change destroys the previous one — so accepting an arbitrary
    // publicId would let a user adopt (and then delete) someone else's avatar.
    // The only ids a client may legitimately send are a fresh temp upload, or
    // its own current avatar echoed back unchanged.
    const isUnchanged = avatarPublicId === existing.avatarPublicId;
    if (
      avatarPublicId &&
      !isUnchanged &&
      !this.cloudinary.isTemp(avatarPublicId)
    ) {
      throw new BadRequestException(
        "avatarPublicId must reference a newly uploaded image",
      );
    }

    if (!avatarPublicId || isUnchanged) {
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
}
