import { Module } from "@nestjs/common";
import { TenantsController } from "@/modules/tenants/tenants.controller";
import { TenantsService } from "@/modules/tenants/tenants.service";

@Module({
  controllers: [TenantsController],
  providers: [TenantsService],
})
export class TenantsModule {}
