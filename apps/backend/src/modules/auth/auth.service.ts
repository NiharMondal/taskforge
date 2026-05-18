import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "@/prisma/prisma.service";
import { UserService, SafeUser } from "@/modules/user/user.service";
import { RegisterDto } from "@/modules/auth/dto/register.dto";
import { LoginDto } from "@/modules/auth/dto/login.dto";

type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

type AuthResult = TokenPair & { user: SafeUser };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async register(
    dto: RegisterDto,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthResult> {
    const user = await this.userService.create(dto);
    const tokens = await this.issueTokens(user.id, user.email, meta);
    return { ...tokens, user };
  }

  async login(
    dto: LoginDto,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthResult> {
    const user = await this.userService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException("Invalid credentials");

    const valid = await this.userService.verifyPassword(
      dto.password,
      user.hashedPassword,
    );
    if (!valid) throw new UnauthorizedException("Invalid credentials");

    const safeUser = await this.userService.findOne(user.id);
    const tokens = await this.issueTokens(user.id, user.email, meta);
    return { ...tokens, user: safeUser };
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

    // Rotate: revoke old, issue new
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.userService.findOne(stored.userId);
    return this.issueTokens(user.id, user.email, meta);
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
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<TokenPair> {
    const accessToken = this.jwtService.sign(
      { sub: userId, email },
      {
        secret: process.env.JWT_ACCESS_SECRET!,
        expiresIn: "15m",
      },
    );

    const rawRefreshToken = randomBytes(40).toString("hex");
    const tokenHash = this.sha256(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  private sha256(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }
}
