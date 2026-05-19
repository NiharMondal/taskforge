import { Body, Controller, HttpStatus, Post } from "@nestjs/common";
import { AuthService } from "@/modules/auth/auth.service";
import { RegisterDto } from "@/modules/auth/dto/register.dto";
import { Public } from "@/common/decorators/public.decorator";
import { sendResponse } from "@/common/utils/send-response";
import { LoginDto } from "./dto/login.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("register")
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return sendResponse({
      statusCode: HttpStatus.CREATED,
      message: "Registered successfully",
      data: result,
    });
  }

  @Public()
  @Post("login")
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.signIn(dto);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Login successfully",
      data: result,
    });
  }
}
