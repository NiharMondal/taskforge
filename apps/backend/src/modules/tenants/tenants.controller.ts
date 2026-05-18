import { Body, Controller, HttpStatus, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { TenantsService } from "@/modules/tenants/tenants.service";
import { CreateTenantDto } from "@/modules/tenants/dto/create-tenant.dto";
import type { JwtPayload } from "@/modules/auth/strategies/jwt.strategy";
import { sendResponse } from "@/utils/send-response";

@Controller("tenants")
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  async create(
    @Body() dto: CreateTenantDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    const tenant = await this.tenantsService.create(dto, req.user.sub);
    return sendResponse({
      statusCode: HttpStatus.CREATED,
      message: "Tenant created. Call POST /auth/refresh to get an updated token.",
      data: tenant,
    });
  }
}
