import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { MailModule } from "../mail/mail.module";
import { InvitationController } from "./invitation.controller";
import { InvitationService } from "./invitation.service";

@Module({
  imports: [MailModule, BillingModule],
  controllers: [InvitationController],
  providers: [InvitationService],
})
export class InvitationModule {}
