import { passwordUtils } from "@/common/utils/password";
import { PrismaService } from "@/prisma/prisma.service";
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { WorkspaceRole } from "generated/prisma/enums";
import { GoogleAuthDto } from "./dto/google-auth.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const { name, email, password } = dto;

    const existingAuth = await this.prisma.auth.findUnique({
      where: { email },
    });

    if (existingAuth) {
      throw new ConflictException("Email already in use");
    }

    const passwordHash = await passwordUtils.hashPassword(password);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create User
      const user = await tx.user.create({
        data: {
          name,
        },
      });

      // 2. Create Auth
      const auth = await tx.auth.create({
        data: {
          email,
          password: passwordHash,
          userId: user.id,
        },
      });

      // 3. Create Workspace
      const workspace = await tx.workspace.create({
        data: {
          name: `${name}'s Workspace`,
        },
      });

      // 4. Create Membership
      await tx.membership.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: WorkspaceRole.OWNER,
        },
      });

      return {
        user,
        auth,
        workspace,
      };
    });

    return {
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.auth.email,
      },
      workspace: {
        id: result.workspace.id,
        name: result.workspace.name,
      },
    };
  }

  async signIn(dto: LoginDto) {
    const auth = await this.prisma.auth.findUnique({
      where: { email: dto.email },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!auth) throw new NotFoundException("User not found");

    if (!auth.password) {
      throw new UnauthorizedException("Password is not set for this account");
    }

    const isPasswordValid = await passwordUtils.comparePassword(
      dto.password,
      auth.password,
    );

    if (!isPasswordValid) throw new UnauthorizedException("Invalid password");

    const token = this.jwtService.sign({
      sub: auth.user.id,
      email: auth.email,
    });
    return {
      accessToken: token,
      user: {
        id: auth.user.id,
        name: auth.user.name,
        email: auth.email,
        avatarUrl: auth.user.avatarUrl,
      },
    };
  }

  async googleSignIn(dto: GoogleAuthDto) {
    const { email, name, image, googleId } = dto;

    const existingAuth = await this.prisma.auth.findUnique({
      where: { email },
      include: { user: true },
    });

    const user = existingAuth?.user;

    if (user) {
      const existingAccount = await this.prisma.oAuthAccount.findUnique({
        where: {
          provider_providerId: {
            provider: "GOOGLE",
            providerId: googleId,
          },
        },
      });

      if (!existingAccount) {
        await this.prisma.oAuthAccount.create({
          data: {
            provider: "GOOGLE",
            providerId: googleId,
            userId: user.id,
          },
        });
      }

      if (!existingAuth) {
        await this.prisma.auth.create({
          data: {
            email,
            userId: user.id,
          },
        });
      }

      const token = this.jwtService.sign({
        sub: user.id,
        email,
      });

      return {
        user: {
          id: user.id,
          name: user.name,
          email,
          avatarUrl: image ?? user.avatarUrl,
        },
        accessToken: token,
      };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          avatarUrl: image ?? null,
        },
      });

      await tx.auth.create({
        data: {
          email,
          userId: newUser.id,
        },
      });

      await tx.oAuthAccount.create({
        data: {
          provider: "GOOGLE",
          providerId: googleId,
          userId: newUser.id,
        },
      });

      const workspace = await tx.workspace.create({
        data: {
          name: `${name}'s Workspace`,
        },
      });

      await tx.membership.create({
        data: {
          userId: newUser.id,
          workspaceId: workspace.id,
          role: WorkspaceRole.OWNER,
        },
      });

      return { user: newUser, workspace };
    });

    const token = this.jwtService.sign({
      sub: result.user.id,
      email,
    });

    return {
      user: {
        id: result.user.id,
        name: result.user.name,
        email,
        avatarUrl: image ?? result.user.avatarUrl,
      },
      accessToken: token,
    };
  }
}
