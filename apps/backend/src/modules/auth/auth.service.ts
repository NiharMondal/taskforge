import bcryptjs from "bcryptjs";
import { PrismaService } from "@/prisma/prisma.service";
import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { generateSlug } from "@/common/utils/generate-slug";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const { name, email, password } = dto;

    // 1. Check existing user
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException("Email already in use");
    }

    // 2. Hash password
    const passwordHash = await bcryptjs.hash(password, 12);

    const workspaceSlug = generateSlug(dto.name);

    // 3. Transaction (VERY IMPORTANT)
    const result = await this.prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
        },
      });

      // Create workspace
      const workspace = await tx.workspace.create({
        data: {
          name: `${name}'s Workspace`,
          slug: workspaceSlug,
        },
      });

      // Create membership (OWNER)
      await tx.membership.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: "OWNER",
        },
      });

      return { user, workspace };
    });

    // 4. Generate JWT
    const token = this.jwtService.sign({
      sub: result.user.id,
      email: result.user.email,
    });

    return {
      accessToken: token,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
      workspace: {
        id: result.workspace.id,
        name: result.workspace.name,
      },
    };
  }

  async signIn(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new NotFoundException("User not found");

    const isPasswordValid = await bcryptjs.compare(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) throw new UnauthorizedException("Invalid password");

    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });
    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }
}
