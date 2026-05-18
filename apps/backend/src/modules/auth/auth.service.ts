import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { Role } from "generated/prisma/client";
import { PrismaService } from "@/prisma/prisma.service";
import { RegisterDto } from "@/modules/auth/dto/register.dto";
import { LoginDto } from "@/modules/auth/dto/login.dto";

type SafeUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

type AuthResult = TokenPair & { user: SafeUser };

type TenantSelectionResult = {
  requiresTenantSelection: true;
  tenants: { id: string; name: string; slug: string }[];
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(
    dto: RegisterDto,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException("Email already in use");

    const slug = dto.tenantName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const tenantExists = await this.prisma.tenant.findUnique({
      where: { slug },
    });
    if (tenantExists) throw new ConflictException("Tenant name already taken");

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const { user, membership } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          hashedPassword,
          name: dto.name,
          avatarUrl: dto.avatarUrl,
        },
      });
      const tenant = await tx.tenant.create({
        data: { name: dto.tenantName, slug },
      });
      const membership = await tx.membership.create({
        data: { userId: user.id, tenantId: tenant.id, role: Role.ADMIN },
      });
      return { user, membership };
    });

    const tokens = await this.issueTokens(
      user.id,
      user.email,
      membership.tenantId,
      [membership.role],
      meta,
    );

    return { ...tokens, user: this.safeUser(user) };
  }

  async login(
    dto: LoginDto,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthResult | TenantSelectionResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new UnauthorizedException("Invalid credentials");

    const valid = await bcrypt.compare(dto.password, user.hashedPassword);
    if (!valid) throw new UnauthorizedException("Invalid credentials");

    const memberships = await this.prisma.membership.findMany({
      where: { userId: user.id },
      include: { tenant: { select: { id: true, name: true, slug: true } } },
    });

    if (!memberships.length)
      throw new UnauthorizedException("No tenant membership found");

    let membership: (typeof memberships)[0];

    if (dto.tenantSlug) {
      const found = memberships.find((m) => m.tenant.slug === dto.tenantSlug);
      if (!found)
        throw new UnauthorizedException("You do not belong to that tenant");
      membership = found;
    } else if (memberships.length === 1) {
      membership = memberships[0];
    } else {
      return {
        requiresTenantSelection: true,
        tenants: memberships.map((m) => ({
          id: m.tenantId,
          name: m.tenant.name,
          slug: m.tenant.slug,
        })),
      };
    }

    const tokens = await this.issueTokens(
      user.id,
      user.email,
      membership.tenantId,
      [membership.role],
      meta,
    );

    return { ...tokens, user: this.safeUser(user) };
  }

  async refresh(
    rawRefreshToken: string,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<TokenPair> {
    const tokenHash = this.sha256(rawRefreshToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token invalid or expired");
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const [user, membership] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: stored.userId } }),
      this.prisma.membership.findUnique({
        where: {
          tenantId_userId: { tenantId: stored.tenantId, userId: stored.userId },
        },
      }),
    ]);

    if (!user || !membership) throw new UnauthorizedException();

    return this.issueTokens(
      user.id,
      user.email,
      membership.tenantId,
      [membership.role],
      meta,
    );
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.sha256(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(
    userId: string,
    email: string,
    tenantId: string,
    roles: string[],
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<TokenPair> {
    const secret = this.configService.getOrThrow<string>("JWT_ACCESS_SECRET");

    const accessToken = this.jwtService.sign(
      { sub: userId, email, tenantId, roles },
      { secret, expiresIn: "15m" },
    );

    const rawRefreshToken = randomBytes(40).toString("hex");
    const tokenHash = this.sha256(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tenantId,
        tokenHash,
        expiresAt,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  private safeUser(user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): SafeUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private sha256(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }
}
