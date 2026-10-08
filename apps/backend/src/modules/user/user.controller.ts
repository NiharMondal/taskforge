import { CurrentUser } from "@/common/decorators/current-user.decorator";
import type { JwtPayload } from "@/common/strategies/jwt.strategy";
import { sendResponse } from "@/common/utils/send-response";
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
} from "@nestjs/common";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UserService } from "./user.service";

/**
 * A user may only read and edit their own profile. `User` has no `workspaceId`,
 * so there is no tenant scope to fall back on: the only boundary is the JWT
 * subject. There is deliberately no list route and no delete route.
 *
 * `me` must be declared before `:id` or Express would match `me` as an id.
 */
@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get("me")
  @HttpCode(HttpStatus.OK)
  async findMe(@CurrentUser() user: JwtPayload) {
    return this.fetch(user.sub);
  }

  @Patch("me")
  @HttpCode(HttpStatus.OK)
  async updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateUserDto) {
    return this.save(user.sub, dto);
  }

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  async findOne(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    this.assertSelf(user, id);
    return this.fetch(id);
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  async update(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: UpdateUserDto,
  ) {
    this.assertSelf(user, id);
    return this.save(id, dto);
  }

  private assertSelf(user: JwtPayload, id: string) {
    if (user.sub !== id) {
      throw new ForbiddenException("You can only access your own profile");
    }
  }

  private async fetch(id: string) {
    const user = await this.userService.findOne(id);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "User fetched successfully",
      data: user,
    });
  }

  private async save(id: string, dto: UpdateUserDto) {
    const user = await this.userService.update(id, dto);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "User updated successfully",
      data: user,
    });
  }
}
