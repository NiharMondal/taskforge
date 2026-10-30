import { passwordUtils } from "@/common/utils/password";
import { appUrl, generateToken, hashToken, normalizeEmail } from "@/helper";
import { MailService } from "@/modules/mail/mail.service";
import { PrismaService } from "@/prisma/prisma.service";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { Prisma } from "generated/prisma/client";
import { seedSystemRoles } from "../roles/system-roles";
import { AuthProvider, WorkspaceRole } from "generated/prisma/enums";
import {
  alreadyRegisteredEmail,
  passwordChangedEmail,
  verificationEmail,
} from "./auth-emails";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  EMAIL_VERIFICATION_TTL_HOURS,
  VERIFICATION_EMAILS_PER_WINDOW,
  VERIFICATION_EMAIL_WINDOW_MS,
} from "./auth.constants";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { GoogleAuthDto } from "./dto/google-auth.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { GoogleTokenVerifier } from "./google-token-verifier";
import { RefreshTokenService } from "./refresh-token.service";

/**
 * A bcrypt hash (cost 12, like real ones) of a random string nobody knows.
 * Compared against when no account matches, so a miss takes as long as a
 * wrong password.
 */
const DUMMY_PASSWORD_HASH =
  "$2b$12$6MwxTD0GzVe2z674jsvmmeLb5GTNHDmOUK.7tFq.31DEnwDm1nLSq";

type SessionUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

const wrongCurrentPassword = () =>
  new BadRequestException("Your current password is incorrect");

const invalidVerificationLink = () =>
  new BadRequestException(
    "This link is invalid or has expired. Sign up again to get a new one.",
  );

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private googleTokenVerifier: GoogleTokenVerifier,
    private refreshTokens: RefreshTokenService,
    private mail: MailService,
    private config: ConfigService,
  ) {}

  /**
   * Start a password sign-up. Nothing is created yet: the address gets an
   * email whose link (`verifyEmail`) creates the account. An address that
   * already has an account gets a "you already have one" email instead, and
   * the response is the same either way, so it doesn't reveal which
   * addresses are registered.
   */
  async register(dto: RegisterDto) {
    const email = normalizeEmail(dto.email);
    // Hashed before anything else, so a taken address answers as slowly as a
    // new one.
    const passwordHash = await passwordUtils.hashPassword(dto.password);

    // Case-insensitive because rows created before emails were normalized may
    // be mixed-case.
    const existingUser = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { name: true, emailVerifiedAt: true },
    });

    if (existingUser?.emailVerifiedAt) {
      this.mail.sendInBackground({
        to: email,
        ...alreadyRegisteredEmail({
          name: existingUser.name,
          url: appUrl(this.config, "/login"),
        }),
      });
      return { email };
    }
    // An unverified `existingUser` was registered before verification existed;
    // following this sign-up's link takes it over (see `verifyEmail`).

    const now = Date.now();
    const recent = await this.prisma.pendingRegistration.count({
      where: {
        email,
        createdAt: { gt: new Date(now - VERIFICATION_EMAIL_WINDOW_MS) },
      },
    });
    if (recent >= VERIFICATION_EMAILS_PER_WINDOW) {
      // Quietly, like every other outcome; the earlier links still work.
      return { email };
    }

    const token = generateToken();
    await this.prisma.pendingRegistration.deleteMany({
      where: { email, expiresAt: { lte: new Date(now) } },
    });
    await this.prisma.pendingRegistration.create({
      data: {
        email,
        name: dto.name,
        passwordHash,
        tokenHash: hashToken(token),
        expiresAt: new Date(now + EMAIL_VERIFICATION_TTL_HOURS * 3_600_000),
      },
    });

    this.mail.sendInBackground({
      to: email,
      ...verificationEmail({
        name: dto.name,
        url: appUrl(
          this.config,
          `/verify-email?token=${encodeURIComponent(token)}`,
        ),
      }),
    });
    return { email };
  }

  /**
   * Finish a sign-up from the emailed link: create the account (user, EMAIL
   * auth, workspace, OWNER membership) with that sign-up's name and password,
   * and sign in. Following the link proves the address, so every other
   * pending sign-up for it is dropped — including one an impostor started.
   */
  async verifyEmail(token: string) {
    const pending = await this.prisma.pendingRegistration.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!pending || pending.expiresAt <= new Date()) {
      throw invalidVerificationLink();
    }

    const user = await this.prisma.$transaction(async (tx) => {
      // Claim the link: a second click (or a concurrent one) finds it gone.
      const claimed = await tx.pendingRegistration.deleteMany({
        where: { id: pending.id },
      });
      if (claimed.count === 0) throw invalidVerificationLink();
      await tx.pendingRegistration.deleteMany({
        where: { email: pending.email },
      });

      const existing = await tx.user.findFirst({
        where: { email: { equals: pending.email, mode: "insensitive" } },
      });

      if (existing?.emailVerifiedAt) {
        // Someone signed up with Google in the meantime.
        throw new ConflictException(
          "This email already has an account. Sign in instead.",
        );
      }

      if (existing) {
        // A password account registered before verification existed, by
        // whoever typed this address. Its owner has now proven it: their name
        // and password replace the old ones, and every session on it ends.
        await tx.auth.upsert({
          where: {
            userId_provider: {
              userId: existing.id,
              provider: AuthProvider.EMAIL,
            },
          },
          create: {
            provider: AuthProvider.EMAIL,
            password: pending.passwordHash,
            userId: existing.id,
          },
          update: { password: pending.passwordHash },
        });
        await this.refreshTokens.revokeAllForUser(existing.id, tx);
        return tx.user.update({
          where: { id: existing.id },
          data: { name: pending.name, emailVerifiedAt: new Date() },
        });
      }

      return this.createAccount(
        tx,
        { name: pending.name, email: pending.email },
        { provider: AuthProvider.EMAIL, password: pending.passwordHash },
      );
    });

    return this.session(user);
  }

  /**
   * Password sign-in. Starts from the EMAIL sign-in method (`Auth`), matched
   * through its user's email — the email itself lives on `User`.
   *
   * Every failure is the same 401, and an unknown email still pays for a
   * bcrypt comparison, so neither the response nor its timing tells a caller
   * whether an address is registered (or only signs in with Google).
   */
  async signIn(dto: LoginDto) {
    const auth = await this.prisma.auth.findFirst({
      where: {
        provider: AuthProvider.EMAIL,
        // Case-insensitive because rows created before emails were normalized
        // may be mixed-case.
        user: {
          email: { equals: normalizeEmail(dto.email), mode: "insensitive" },
        },
      },
      include: { user: true },
    });

    const isPasswordValid = await passwordUtils.comparePassword(
      dto.password,
      auth?.password ?? DUMMY_PASSWORD_HASH,
    );

    if (!auth?.password || !isPasswordValid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    // Only accounts registered before verification existed get here
    // unverified. Their password may not be the address owner's; registering
    // again sends a link that replaces it.
    if (!auth.user.emailVerifiedAt) {
      throw new ForbiddenException(
        "Confirm your email address first: sign up again with this email and we'll send you a link.",
      );
    }

    return this.session(auth.user);
  }

  /**
   * Sign in (or sign up) with a Google ID token.
   *
   * The endpoint is public, so identity is taken ONLY from the claims of a
   * token Google has signed — never from the request body. Accounts are matched
   * on Google's stable `sub` first; the email is only used to link a Google
   * login to an existing account, and only because Google vouched for it
   * (`email_verified`). Linking to an account whose email was never verified
   * removes its password and ends its sessions, since anyone could have
   * registered that address.
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
      return this.session(linked.user, picture);
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
      // address — not necessarily its owner (account pre-hijacking). Drop it
      // and end that person's sessions; the owner signs in with Google.
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
          await this.refreshTokens.revokeAllForUser(existingUser.id, tx);
        }

        await tx.auth.create({
          data: {
            provider: AuthProvider.GOOGLE,
            providerId: googleId,
            userId: existingUser.id,
          },
        });
      });

      return this.session(existingUser, picture);
    }

    // First time we see this person: user + GOOGLE auth + workspace + membership.
    const newUser = await this.prisma.$transaction((tx) =>
      this.createAccount(
        tx,
        { name, email, avatarUrl: picture ?? null },
        { provider: AuthProvider.GOOGLE, providerId: googleId },
      ),
    );

    return this.session(newUser, picture);
  }

  /**
   * Exchange a refresh token for a new access token and a new refresh token
   * (the old one stops working; see RefreshTokenService).
   */
  async refresh(refreshToken: string) {
    const { userId, familyId } = await this.refreshTokens.consume(refreshToken);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) {
      throw new UnauthorizedException("Your session has ended. Sign in again.");
    }
    return this.issueTokens(user, familyId);
  }

  /**
   * A signed-in user changes their password. It ends every session, this one
   * included, and emails the owner. Failures are 400s, never 401: the caller is
   * signed in, and the web app treats a 401 as a session that has ended.
   */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const auth = await this.prisma.auth.findUnique({
      where: { userId_provider: { userId, provider: AuthProvider.EMAIL } },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!auth?.password) {
      throw new BadRequestException(
        "This account signs in with Google, so it has no password to change.",
      );
    }

    const currentHash = auth.password;
    const isCurrentValid = await passwordUtils.comparePassword(
      dto.currentPassword,
      currentHash,
    );
    if (!isCurrentValid) throw wrongCurrentPassword();
    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException(
        "Choose a new password that is different from your current one",
      );
    }

    const passwordHash = await passwordUtils.hashPassword(dto.newPassword);
    await this.prisma.$transaction(async (tx) => {
      // Only replaces the hash that was checked: of two concurrent changes, the
      // second finds it gone, as if its current password were wrong.
      const replaced = await tx.auth.updateMany({
        where: { id: auth.id, password: currentHash },
        data: { password: passwordHash },
      });
      if (replaced.count === 0) throw wrongCurrentPassword();
      await this.refreshTokens.revokeAllForUser(userId, tx);
    });

    this.mail.sendInBackground({
      to: auth.user.email,
      ...passwordChangedEmail({
        name: auth.user.name,
        url: appUrl(this.config, "/login"),
      }),
    });
  }

  /** Sign out: the refresh token and every token rotated from it stop working. */
  async logout(refreshToken: string) {
    await this.refreshTokens.revoke(refreshToken);
  }

  /**
   * A new account with one sign-in method, its own workspace (with the
   * built-in roles) and the OWNER membership. Its email is verified: both
   * callers have proven it.
   */
  private async createAccount(
    tx: Prisma.TransactionClient,
    user: { name: string; email: string; avatarUrl?: string | null },
    auth: { provider: AuthProvider; password?: string; providerId?: string },
  ) {
    const newUser = await tx.user.create({
      data: { ...user, emailVerifiedAt: new Date() },
    });

    await tx.auth.create({ data: { ...auth, userId: newUser.id } });

    const workspace = await tx.workspace.create({
      data: { name: `${user.name}'s Workspace` },
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

    return newUser;
  }

  /**
   * The payload of every sign-in: the user and a fresh token pair. A stored
   * (uploaded) avatar wins over Google's picture so signing in doesn't clobber
   * a custom one.
   */
  private async session(user: SessionUser, picture?: string) {
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl ?? picture ?? null,
      },
      ...(await this.issueTokens(user)),
    };
  }

  /** An access token, and a refresh token in `familyId` (or a new family). */
  private async issueTokens(
    user: { id: string; email: string },
    familyId?: string,
  ) {
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });
    const refreshToken = await this.refreshTokens.issue(user.id, familyId);
    return {
      accessToken,
      accessTokenExpiresAt: new Date(
        Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000,
      ).toISOString(),
      refreshToken,
    };
  }
}
