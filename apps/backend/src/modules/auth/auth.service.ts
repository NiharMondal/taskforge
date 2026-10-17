import { passwordUtils } from "@/common/utils/password";
import { normalizeEmail } from "@/helper";
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
import { GoogleTokenVerifier } from "./google-token-verifier";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private googleTokenVerifier: GoogleTokenVerifier,
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

  /**
   * Sign in (or sign up) with a Google ID token.
   *
   * The endpoint is public, so identity is taken ONLY from the claims of a
   * token Google has signed — never from the request body. Accounts are matched
   * on Google's stable `sub` first; the email is only used to link a Google
   * login to an existing password account, and only because Google vouched for
   * it (`email_verified`).
   */
  async googleSignIn(dto: GoogleAuthDto) {
    const identity = await this.googleTokenVerifier.verify(dto.idToken);
    const { sub: googleId, name, picture } = identity;
    const email = normalizeEmail(identity.email);

    // Returning Google user. `sub` never changes, whereas the email can.
    const linked = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerId: { provider: "GOOGLE", providerId: googleId },
      },
      include: { user: { include: { auth: true } } },
    });

    if (linked) {
      return this.googleSession(
        linked.user,
        linked.user.auth?.email ?? email,
        picture,
      );
    }

    // An account with this (Google-verified) email already exists: link it.
    // Case-insensitive because rows created before emails were normalized may
    // be mixed-case.
    const existingAuth = await this.prisma.auth.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      include: { user: true },
    });

    if (existingAuth) {
      await this.prisma.oAuthAccount.create({
        data: {
          provider: "GOOGLE",
          providerId: googleId,
          userId: existingAuth.userId,
        },
      });

      return this.googleSession(existingAuth.user, existingAuth.email, picture);
    }

    // First time we see this person: user + auth + oauth link + workspace.
    const result = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          avatarUrl: picture ?? null,
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

    return this.googleSession(result.user, email, picture);
  }

  /**
   * The session payload for a Google sign-in. A stored (uploaded) avatar wins
   * over Google's picture so signing in doesn't clobber a custom one.
   */
  private googleSession(
    user: { id: string; name: string; avatarUrl: string | null },
    email: string,
    picture?: string,
  ) {
    return {
      user: {
        id: user.id,
        name: user.name,
        email,
        avatarUrl: user.avatarUrl ?? picture ?? null,
      },
      accessToken: this.jwtService.sign({ sub: user.id, email }),
    };
  }
}
