import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "@/modules/auth/auth.service";
import { RegisterDto } from "@/modules/auth/dto/register.dto";
import { LoginDto } from "@/modules/auth/dto/login.dto";
import { RefreshDto } from "@/modules/auth/dto/refresh.dto";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard";
import { sendResponse } from "@/utils/send-response";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const result = await this.authService.register(dto, {
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    });
    return sendResponse({
      statusCode: HttpStatus.CREATED,
      message: "Registered successfully",
      data: result,
    });
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const result = await this.authService.login(dto, {
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    });
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Logged in successfully",
      data: result,
    });
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    const tokens = await this.authService.refresh(dto.refreshToken, {
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    });
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Tokens refreshed",
      data: tokens,
    });
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(@Body() dto: RefreshDto) {
    await this.authService.logout(dto.refreshToken);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Logged out successfully",
      data: null,
    });
  }
}
