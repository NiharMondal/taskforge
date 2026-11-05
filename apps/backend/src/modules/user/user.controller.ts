import { CurrentUser } from "@/common/decorators/current-user.decorator";
import type { JwtPayload } from "@/common/strategies/jwt.strategy";
import { sendResponse } from "@/common/utils/send-response";
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AccountService } from "./account.service";
import { DeleteAccountDto } from "./dto/delete-account.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { DELETE_ACCOUNT_THROTTLE, EXPORT_THROTTLE } from "./user.constants";
import { UserService } from "./user.service";
import { UserThrottlerGuard } from "./user-throttler.guard";

/**
 * A user may only read, edit, export and delete their own account. `User` has
 * no `workspaceId`, so there is no tenant scope to fall back on: the only
 * boundary is the JWT subject. There is deliberately no list route, and
 * deleting is `/users/me` only.
 *
 * `me` (and `me/export`) must be declared before `:id` or Express would match
 * `me` as an id.
 */
@Controller("users")
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly accountService: AccountService,
  ) {}

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

  /** Everything the account holds about the caller, as JSON (`spec/user-spec.md`). */
  @Get("me/export")
  @HttpCode(HttpStatus.OK)
  @Throttle(EXPORT_THROTTLE)
  @UseGuards(UserThrottlerGuard)
  async exportMe(@CurrentUser() user: JwtPayload) {
    const data = await this.accountService.exportData(user.sub);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Your data is ready",
      data,
    });
  }

  /**
   * Delete the caller's account, confirmed with their password (or, for a
   * Google-only account, their email). 409 while they own a workspace other
   * people use.
   */
  @Delete("me")
  @HttpCode(HttpStatus.OK)
  @Throttle(DELETE_ACCOUNT_THROTTLE)
  @UseGuards(UserThrottlerGuard)
  async deleteMe(
    @CurrentUser() user: JwtPayload,
    @Body() dto: DeleteAccountDto,
  ) {
    await this.accountService.deleteAccount(user.sub, dto);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Your account was deleted",
      data: null,
    });
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
    const user = await this.userService.findProfile(id);
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
