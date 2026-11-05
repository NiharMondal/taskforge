import { Access } from "@/common/decorators/access.decorator";
import { Public } from "@/common/decorators/public.decorator";
import { RequirePermission } from "@/common/decorators/require-permission.decorator";
import { WorkspaceId } from "@/common/decorators/workspaceId.decorator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { WorkspaceGuard } from "@/common/guards/workspace.guard";
import type { WorkspaceAccess } from "@/common/permissions/workspace-access";
import { sendResponse } from "@/common/utils/send-response";
import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { BillingService } from "./billing.service";

@Controller("billing")
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class BillingController {
  constructor(private billingService: BillingService) {}

  // Any member: everyone may see the plan and how close it is to its limits.
  @Get()
  @HttpCode(HttpStatus.OK)
  async get(@WorkspaceId() workspaceId: string) {
    const billing = await this.billingService.getBilling(workspaceId);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Billing fetched successfully",
      data: billing,
    });
  }

  @Post("checkout")
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission("billing:manage")
  async checkout(
    @WorkspaceId() workspaceId: string,
    @Access() access: WorkspaceAccess,
  ) {
    const session = await this.billingService.startCheckout(
      workspaceId,
      access,
    );
    return sendResponse({
      statusCode: HttpStatus.CREATED,
      message: "Checkout started",
      data: session,
    });
  }

  @Post("portal")
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission("billing:manage")
  async portal(@WorkspaceId() workspaceId: string) {
    const session = await this.billingService.openPortal(workspaceId);
    return sendResponse({
      statusCode: HttpStatus.CREATED,
      message: "Billing portal opened",
      data: session,
    });
  }
}

/**
 * Stripe's webhook. Public — Stripe has no token — so it trusts nothing that
 * isn't signed: the signature is checked against the raw body (`rawBody: true`
 * in `main.ts`), and there is no workspace header. Not throttled: Stripe
 * retries and bursts.
 */
@Controller("billing/webhook")
export class BillingWebhookController {
  constructor(private billingService: BillingService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature: string | undefined,
  ) {
    const result = await this.billingService.handleWebhook(
      req.rawBody,
      signature ?? "",
    );
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Webhook received",
      data: result,
    });
  }
}
