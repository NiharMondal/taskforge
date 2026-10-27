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
    });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const existing = await this.findOne(id);

    const { avatarPublicId } = dto;
    // `avatarUrl` is never taken from the client: it always comes from the
    // asset the server promoted (or Google, or null on removal), so it can't
    // point somewhere other than `avatarPublicId`.
    const rest = { name: dto.name };

    // An explicit null removes the avatar: clear both fields, then destroy the
    // stored asset (best-effort; `delete` only logs a Cloudinary failure).
    if (avatarPublicId === null) {
      const user = await this.prisma.user.update({
        where: { id },
        data: { ...rest, avatarUrl: null, avatarPublicId: null },
      });
      await this.cloudinary.delete(existing.avatarPublicId);
      return user;
    }

    // A later avatar change destroys the stored asset, so storing an arbitrary
    // publicId would let a user adopt (and then delete) someone else's avatar.
    // The only ids a client may legitimately send are a fresh temp upload
    // (which promoteToPermanent moves to a server-chosen id), or its own
    // current avatar echoed back unchanged.
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
      });
    }

    const promoted = await this.cloudinary.promoteToPermanent(
      avatarPublicId,
      `taskforge/user-avatar/${id}`,
    );

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

    return user;
  }
}
