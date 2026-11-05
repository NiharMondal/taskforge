import { Module } from "@nestjs/common";
import { ActivityController } from "./activity.controller";
import { ActivityService } from "./activity.service";
import { AuditLogController } from "./audit-log.controller";
import { AuditLogService } from "./audit-log.service";

@Module({
  controllers: [ActivityController, AuditLogController],
  providers: [ActivityService, AuditLogService],
})
export class ActivityModule {}
