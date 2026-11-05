import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { MembershipController } from "./membership.controller";
import { MembershipService } from "./membership.service";

@Module({
  imports: [BillingModule],
  controllers: [MembershipController],
  providers: [MembershipService],
})
export class MembershipModule {}
