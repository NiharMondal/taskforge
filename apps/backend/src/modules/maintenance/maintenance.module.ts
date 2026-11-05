import { Module } from "@nestjs/common";
import { CleanupService } from "./cleanup.service";
import { MaintenanceController } from "./maintenance.controller";

@Module({
  controllers: [MaintenanceController],
  providers: [CleanupService],
})
export class MaintenanceModule {}
