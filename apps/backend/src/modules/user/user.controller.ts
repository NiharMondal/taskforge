import { sendResponse } from "@/common/utils/send-response";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UserService } from "./user.service";

@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateUserDto) {
    const user = await this.userService.create(dto);
    return sendResponse({
      statusCode: HttpStatus.CREATED,
      message: "User created successfully",
      data: user,
    });
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  // @Roles(Role.ADMIN, Role.MANAGER)
  async findAll() {
    const users = await this.userService.findAll();
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Users fetched successfully",
      data: users,
    });
  }

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  async findOne(@Param("id") id: string) {
    const user = await this.userService.findOne(id);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "User fetched successfully",
      data: user,
    });
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  async update(@Param("id") id: string, @Body() dto: UpdateUserDto) {
    const user = await this.userService.update(id, dto);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "User updated successfully",
      data: user,
    });
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  async remove(@Param("id") id: string) {
    await this.userService.remove(id);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "User deleted successfully",
      data: null,
    });
  }
}
