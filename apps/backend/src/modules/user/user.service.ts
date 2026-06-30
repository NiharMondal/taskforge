import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import bcrypt from "bcryptjs";
import { PrismaService } from "@/prisma/prisma.service";
import { CloudinaryService } from "@/cloudinary/cloudinary.service";
import { CreateUserDto } from "@/modules/user/dto/create-user.dto";
import { UpdateUserDto } from "@/modules/user/dto/update-user.dto";
import { User } from "generated/prisma/client";

export type SafeUser = Omit<User, "passwordHash">;

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async create(dto: CreateUserDto): Promise<SafeUser> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException("Email already in use");

    const passwordHash = await this.hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        avatarUrl: dto.avatarUrl,
      },
    });

    return this.omitPassword(user);
  }

  async findAll(): Promise<SafeUser[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    });
    return users.map((u) => this.omitPassword(u));
  }

  async findOne(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return this.omitPassword(user);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async update(id: string, dto: UpdateUserDto): Promise<SafeUser> {
    const existing = await this.findOne(id);

    const { avatarPublicId, ...rest } = dto;

    // No avatar change — straight update.
    if (!avatarPublicId) {
      const user = await this.prisma.user.update({
        where: { id },
        data: rest,
      });
      return this.omitPassword(user);
    }

    // The frontend uploaded a new avatar into the temp folder. Promote it to
    // its permanent home, persist the permanent url/publicId, then remove the
    // previous avatar. The promoted url replaces whatever avatarUrl the client
    // sent, since renaming the asset changes its delivery URL.
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
      // Save failed — the just-promoted asset would be orphaned, so drop it.
      await this.cloudinary.delete(promoted.publicId);
      throw error;
    }

    // New avatar is persisted; clean up the one it replaced.
    if (
      existing.avatarPublicId &&
      existing.avatarPublicId !== promoted.publicId
    ) {
      await this.cloudinary.delete(existing?.avatarPublicId);
    }

    return this.omitPassword(user);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
    await this.cloudinary.delete(existing.avatarPublicId);
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  async verifyPassword(
    password: string,
    passwordHash: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }

  private omitPassword(user: User): SafeUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...safe } = user;
    return safe;
  }
}
