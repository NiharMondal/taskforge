import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService } from "@/modules/auth/auth.service";
import { RegisterDto } from "@/modules/auth/dto/register.dto";
import { LoginDto } from "@/modules/auth/dto/login.dto";
import { Public } from "@/modules/auth/decorators/public.decorator";
import { sendResponse } from "@/utils/send-response";

const REFRESH_COOKIE = "refreshToken";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("register")
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto, {
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    });
    res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions);
    return sendResponse({
      statusCode: HttpStatus.CREATED,
      message: "Registered successfully",
      data: { accessToken: result.accessToken, user: result.user },
    });
  }

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, {
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    });

    if ("requiresTenantSelection" in result) {
      return sendResponse({
        statusCode: HttpStatus.OK,
        message: "Please select a tenant",
        data: result,
      });
    }

    res.cookie(REFRESH_COOKIE, result.refreshToken, cookieOptions);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Logged in successfully",
      data: { accessToken: result.accessToken, user: result.user },
    });
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!rawToken) throw new UnauthorizedException("No refresh token");

    const tokens = await this.authService.refresh(rawToken, {
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    });

    res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Tokens refreshed",
      data: { accessToken: tokens.accessToken },
    });
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (rawToken) await this.authService.logout(rawToken);
    res.clearCookie(REFRESH_COOKIE);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Logged out successfully",
      data: null,
    });
  }
}
