import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

/** Platform admin: cross-tenant, for platform staff only (`spec/admin-spec.md`). */
@Module({
  imports: [BillingModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
