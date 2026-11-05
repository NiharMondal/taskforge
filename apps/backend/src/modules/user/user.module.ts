import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { MailModule } from "../mail/mail.module";
import { AccountService } from "./account.service";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";

@Module({
  imports: [BillingModule, MailModule],
  controllers: [UserController],
  providers: [UserService, AccountService],
  // AccountService: platform staff delete accounts through it (AdminModule).
  exports: [UserService, AccountService],
})
export class UserModule {}
