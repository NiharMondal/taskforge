import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpStatus,
  HttpCode,
} from "@nestjs/common";
import { UserService } from "./user.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { sendResponse } from "@/utils/send-response";

@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
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
  async findAll() {
    const user = await this.userService.findAll();
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "User fetched successfully",
      data: user,
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
