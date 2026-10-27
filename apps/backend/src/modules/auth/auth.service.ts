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
import { seedSystemRoles } from "../roles/system-roles";
import { AuthProvider, WorkspaceRole } from "generated/prisma/enums";
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
    const { name, password } = dto;
    const email = normalizeEmail(dto.email);

    // Case-insensitive because rows created before emails were normalized may
    // be mixed-case.
    const existingUser = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });

    if (existingUser) {
      throw new ConflictException("Email already in use");
    }

    const passwordHash = await passwordUtils.hashPassword(password);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create User
      const user = await tx.user.create({
        data: {
          name,
          email,
        },
      });

      // 2. Create the EMAIL sign-in method
      await tx.auth.create({
        data: {
          provider: AuthProvider.EMAIL,
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

      // 4. Seed its roles and make the user the OWNER
      const roleIds = await seedSystemRoles(tx, workspace.id);
      await tx.membership.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: WorkspaceRole.OWNER,
          roleId: roleIds[WorkspaceRole.OWNER],
        },
      });

      return {
        user,
        workspace,
      };
    });

    return {
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
      },
      workspace: {
        id: result.workspace.id,
        name: result.workspace.name,
      },
    };
  }

  async signIn(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: normalizeEmail(dto.email), mode: "insensitive" },
      },
      include: {
        auths: { where: { provider: AuthProvider.EMAIL } },
      },
    });

    if (!user) throw new NotFoundException("User not found");

    // A Google-only account has no EMAIL row, so there is no password to check.
    const password = user.auths[0]?.password;
    if (!password) {
      throw new UnauthorizedException("Password is not set for this account");
    }

    const isPasswordValid = await passwordUtils.comparePassword(
      dto.password,
      password,
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
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  /**
   * Sign in (or sign up) with a Google ID token.
   *
   * The endpoint is public, so identity is taken ONLY from the claims of a
   * token Google has signed — never from the request body. Accounts are matched
   * on Google's stable `sub` first; the email is only used to link a Google
   * login to an existing account, and only because Google vouched for it
   * (`email_verified`). Linking to an account whose email was never verified
   * removes its password, since anyone could have registered that address.
   */
  async googleSignIn(dto: GoogleAuthDto) {
    const identity = await this.googleTokenVerifier.verify(dto.idToken);
    const { sub: googleId, name, picture } = identity;
    const email = normalizeEmail(identity.email);

    // Returning Google user. `sub` never changes, whereas the email can.
    const linked = await this.prisma.auth.findUnique({
      where: {
        provider_providerId: {
          provider: AuthProvider.GOOGLE,
          providerId: googleId,
        },
      },
      include: { user: true },
    });

    if (linked) {
      return this.googleSession(linked.user, picture);
    }

    // An account with this (Google-verified) email already exists: link it.
    // Case-insensitive because rows created before emails were normalized may
    // be mixed-case.
    const existingUser = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      include: { auths: { where: { provider: AuthProvider.GOOGLE } } },
    });

    if (existingUser) {
      // One Google login per user. A different Google account claiming this
      // email must not take over the link that is already there.
      if (existingUser.auths.length > 0) {
        throw new ConflictException(
          "This account is already linked to a different Google account",
        );
      }

      // Google has just proven this person owns the email. If nobody had
      // before, the account's password was set by whoever registered the
      // address — not necessarily its owner (account pre-hijacking). Drop it so
      // that person can't keep a way in; the owner signs in with Google.
      const emailWasUnverified = !existingUser.emailVerifiedAt;

      await this.prisma.$transaction(async (tx) => {
        if (emailWasUnverified) {
          await tx.auth.deleteMany({
            where: { userId: existingUser.id, provider: AuthProvider.EMAIL },
          });
          await tx.user.update({
            where: { id: existingUser.id },
            data: { emailVerifiedAt: new Date() },
          });
        }

        await tx.auth.create({
          data: {
            provider: AuthProvider.GOOGLE,
            providerId: googleId,
            userId: existingUser.id,
          },
        });
      });

      return this.googleSession(existingUser, picture);
    }

    // First time we see this person: user + GOOGLE auth + workspace + membership.
    const result = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          avatarUrl: picture ?? null,
          emailVerifiedAt: new Date(),
        },
      });

      await tx.auth.create({
        data: {
          provider: AuthProvider.GOOGLE,
          providerId: googleId,
          userId: newUser.id,
        },
      });

      const workspace = await tx.workspace.create({
        data: {
          name: `${name}'s Workspace`,
        },
      });

      const roleIds = await seedSystemRoles(tx, workspace.id);
      await tx.membership.create({
        data: {
          userId: newUser.id,
          workspaceId: workspace.id,
          role: WorkspaceRole.OWNER,
          roleId: roleIds[WorkspaceRole.OWNER],
        },
      });

      return { user: newUser, workspace };
    });

    return this.googleSession(result.user, picture);
  }

  /**
   * The session payload for a Google sign-in. A stored (uploaded) avatar wins
   * over Google's picture so signing in doesn't clobber a custom one.
   */
  private googleSession(
    user: { id: string; name: string; email: string; avatarUrl: string | null },
    picture?: string,
  ) {
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl ?? picture ?? null,
      },
      accessToken: this.jwtService.sign({ sub: user.id, email: user.email }),
    };
  }
}
