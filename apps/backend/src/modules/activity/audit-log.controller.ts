import { RequirePermission } from "@/common/decorators/require-permission.decorator";
import { WorkspaceId } from "@/common/decorators/workspaceId.decorator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { WorkspaceGuard } from "@/common/guards/workspace.guard";
import { sendResponse } from "@/common/utils/send-response";
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuditLogService } from "./audit-log.service";
import { QueryAuditLogDto } from "./dto/query-audit-log.dto";

/** The workspace audit log (`spec/activity-spec.md`), for `audit:read`. */
@Controller("audit-log")
@RequirePermission("audit:read")
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class AuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @WorkspaceId() workspaceId: string,
    @Query() query: QueryAuditLogDto,
  ) {
    const { data, metaData } = await this.auditLog.findAll(workspaceId, query);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Audit log fetched successfully",
      metaData,
      data,
    });
  }
}
