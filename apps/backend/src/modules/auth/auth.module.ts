import { JwtStrategy } from "@/common/strategies/jwt.strategy";
import { AuthController } from "@/modules/auth/auth.controller";
import { AuthService } from "@/modules/auth/auth.service";
import { GoogleTokenVerifier } from "@/modules/auth/google-token-verifier";
import { UserModule } from "@/modules/user/user.module";
import { PrismaModule } from "@/prisma/prisma.module";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ThrottlerModule } from "@nestjs/throttler";
import { MailModule } from "@/modules/mail/mail.module";
import { ACCESS_TOKEN_TTL_SECONDS, AUTH_THROTTLE } from "./auth.constants";
import { RefreshTokenService } from "./refresh-token.service";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_ACCESS_SECRET"),
        signOptions: { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
      }),
    }),
    ThrottlerModule.forRoot(AUTH_THROTTLE),
    UserModule,
    PrismaModule,
    MailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleTokenVerifier,
    RefreshTokenService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
