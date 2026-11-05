import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Public } from "@/common/decorators/public.decorator";
import type { JwtPayload } from "@/common/strategies/jwt.strategy";
import { sendResponse } from "@/common/utils/send-response";
import { AuthService } from "@/modules/auth/auth.service";
import { RegisterDto } from "@/modules/auth/dto/register.dto";
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { SkipThrottle, ThrottlerGuard } from "@nestjs/throttler";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { GoogleAuthDto } from "./dto/google-auth.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";

@Controller("auth")
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Starts a sign-up: 202 whether or not the address is new (see
   * AuthService.register). The account is created by `verify-email`.
   */
  @Post("register")
  @HttpCode(HttpStatus.ACCEPTED)
  @Public()
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return sendResponse({
      statusCode: HttpStatus.ACCEPTED,
      message: "Check your email for a link to finish signing up",
      data: result,
    });
  }

  @Post("verify-email")
  @HttpCode(HttpStatus.OK)
  @Public()
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    const result = await this.authService.verifyEmail(dto.token);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Email confirmed",
      data: result,
    });
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Public()
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.signIn(dto);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Login successfully",
      data: result,
    });
  }

  @Post("google")
  @HttpCode(HttpStatus.OK)
  @Public()
  async google(@Body() dto: GoogleAuthDto) {
    const result = await this.authService.googleSignIn(dto);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Google login successfully",
      data: result,
    });
  }

  /**
   * The one auth route that needs a signed-in user (no `@Public()`). Throttled
   * like the others, which slows guessing the current password with a stolen
   * access token. Signs out every session, this one included.
   */
  @Patch("password")
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(user.sub, dto);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Password changed. Sign in again with your new password.",
      data: null,
    });
  }

  // Refresh and logout carry a 256-bit random token, so there is nothing to
  // guess; and the web app sends them from its server for every user, which
  // would share one per-client budget.
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @Public()
  @SkipThrottle()
  async refresh(@Body() dto: RefreshTokenDto) {
    const result = await this.authService.refresh(dto.refreshToken);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Session refreshed",
      data: result,
    });
  }

  /** Revokes the refresh token's session. 200 even for an unknown token. */
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @Public()
  @SkipThrottle()
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Signed out",
      data: null,
    });
  }
}
