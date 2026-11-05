import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BillingModule } from "../billing/billing.module";
import { UserModule } from "../user/user.module";
import { WorkspaceModule } from "../workspace/workspace.module";
import { AdminActionsService } from "./admin-actions.service";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

/**
 * Platform admin: cross-tenant, for platform staff only (`spec/admin-spec.md`).
 * Its actions reuse the services that own each change: account deletion
 * (UserModule), workspace deletion (WorkspaceModule), sessions (AuthModule).
 */
@Module({
  imports: [AuthModule, BillingModule, UserModule, WorkspaceModule],
  controllers: [AdminController],
  providers: [AdminService, AdminActionsService],
})
export class AdminModule {}
