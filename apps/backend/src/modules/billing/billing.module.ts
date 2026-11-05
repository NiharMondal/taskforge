import { Module } from "@nestjs/common";
import {
  BillingController,
  BillingWebhookController,
} from "./billing.controller";
import { BillingService } from "./billing.service";
import { StripeService } from "./stripe.service";

@Module({
  controllers: [BillingController, BillingWebhookController],
  providers: [BillingService, StripeService],
  // Seat sync on join/leave, and cancel-before-delete for workspaces.
  exports: [BillingService],
})
export class BillingModule {}
