import { Module } from "@nestjs/common";
import { MailModule } from "../mail/mail.module";
import { InvitationController } from "./invitation.controller";
import { InvitationService } from "./invitation.service";

@Module({
  imports: [MailModule],
  controllers: [InvitationController],
  providers: [InvitationService],
})
export class InvitationModule {}
