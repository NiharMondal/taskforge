import { PRO_TRIAL_DAYS } from "@taskforge/shared";
import { accessAs } from "@/common/permissions/test-access";
import { PrismaService } from "@/prisma/prisma.service";
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "generated/prisma/client";
import { WorkspaceRole } from "generated/prisma/enums";
import type Stripe from "stripe";
import {
  BillingService,
  subscriptionIdOf,
  toSubscriptionStatus,
} from "./billing.service";
import { StripeService } from "./stripe.service";

const workspaceId = "ws-1";
const owner = accessAs(WorkspaceRole.OWNER, { workspaceId, userId: "user-1" });
const raw = Buffer.from("{}");

/** A Stripe subscription as `subscriptions.retrieve` returns it. */
const stripeSubscription = (
  overrides: Partial<Record<string, unknown>> = {},
): Stripe.Subscription =>
  ({
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    metadata: { workspaceId },
    cancel_at_period_end: false,
    cancel_at: null,
    trial_end: null,
    items: {
      data: [{ id: "si_1", quantity: 3, current_period_end: 1_900_000_000 }],
    },
    ...overrides,
  }) as unknown as Stripe.Subscription;

const event = (type: string, object: object, id = "evt_1") =>
  ({ id, type, data: { object } }) as unknown as Stripe.Event;

let prisma: {
  subscription: {
    findUnique: jest.Mock;
    upsert: jest.Mock;
    update: jest.Mock;
  };
  membership: { count: jest.Mock };
  invitation: { count: jest.Mock };
  workspace: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock };
  stripeEvent: { findUnique: jest.Mock; create: jest.Mock };
  auditLog: { create: jest.Mock };
  $transaction: jest.Mock;
};
let stripe: {
  isConfigured: jest.Mock;
  createCustomer: jest.Mock;
  createCheckoutSession: jest.Mock;
  createPortalSession: jest.Mock;
  retrieveSubscription: jest.Mock;
  setSeats: jest.Mock;
  cancelNow: jest.Mock;
  constructEvent: jest.Mock;
};
let service: BillingService;

beforeEach(() => {
  prisma = {
    subscription: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({ id: "subrow-1" }),
      update: jest.fn().mockResolvedValue({}),
    },
    membership: { count: jest.fn().mockResolvedValue(3) },
    invitation: { count: jest.fn().mockResolvedValue(1) },
    workspace: {
      findUnique: jest.fn().mockResolvedValue({
        id: workspaceId,
        name: "Acme",
        subscription: null,
      }),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ email: "a@acme.test" }) },
    stripeEvent: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
    cb(prisma),
  );
  stripe = {
    isConfigured: jest.fn().mockReturnValue(true),
    createCustomer: jest.fn().mockResolvedValue("cus_1"),
    createCheckoutSession: jest
      .fn()
      .mockResolvedValue("https://checkout.stripe.test/s"),
    createPortalSession: jest
      .fn()
      .mockResolvedValue("https://billing.stripe.test/p"),
    retrieveSubscription: jest.fn().mockResolvedValue(stripeSubscription()),
    setSeats: jest.fn((_id: string, seats: number) => Promise.resolve(seats)),
    cancelNow: jest.fn().mockResolvedValue(undefined),
    constructEvent: jest.fn(),
  };
  service = new BillingService(
    prisma as unknown as PrismaService,
    stripe as unknown as StripeService,
    { get: () => "https://app.test/" } as unknown as ConfigService,
  );
});

describe("BillingService.getBilling", () => {
  it("is Free with its limits and usage when there is no subscription", async () => {
    const billing = await service.getBilling(workspaceId);

    expect(billing).toMatchObject({
      plan: "FREE",
      status: null,
      trialAvailable: true,
      hasBillingAccount: false,
      billingEnabled: true,
      limits: { members: 5, customRoles: false },
      usage: { members: 3, pendingInvitations: 1 },
    });
    expect(prisma.subscription.findUnique).toHaveBeenCalledWith({
      where: { workspaceId },
    });
    expect(prisma.membership.count).toHaveBeenCalledWith({
      where: { workspaceId },
    });
  });

  it.each([
    ["ACTIVE", "PRO"],
    ["TRIALING", "PRO"],
    ["PAST_DUE", "PRO"],
    ["UNPAID", "FREE"],
    ["CANCELED", "FREE"],
    ["INCOMPLETE", "FREE"],
    ["PAUSED", "FREE"],
  ])("a PRO subscription that is %s gives %s", async (status, plan) => {
    prisma.subscription.findUnique.mockResolvedValue({
      plan: "PRO",
      status,
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
    });

    const billing = await service.getBilling(workspaceId);

    expect(billing.plan).toBe(plan);
    expect(billing.trialAvailable).toBe(false);
  });
});

describe("BillingService.startCheckout", () => {
  it("creates the customer, then a checkout for every member with the trial", async () => {
    await expect(service.startCheckout(workspaceId, owner)).resolves.toEqual({
      url: "https://checkout.stripe.test/s",
    });

    expect(stripe.createCustomer).toHaveBeenCalledWith({
      workspaceId,
      workspaceName: "Acme",
      email: "a@acme.test",
    });
    expect(prisma.subscription.upsert).toHaveBeenCalledWith({
      where: { workspaceId },
      create: { workspaceId, stripeCustomerId: "cus_1" },
      update: { stripeCustomerId: "cus_1" },
    });
    expect(stripe.createCheckoutSession).toHaveBeenCalledWith({
      workspaceId,
      customerId: "cus_1",
      seats: 3,
      trialDays: PRO_TRIAL_DAYS,
      successUrl: "https://app.test/settings/billing?checkout=success",
      cancelUrl: "https://app.test/settings/billing?checkout=canceled",
    });
  });

  it("reuses the customer, and gives no second trial", async () => {
    prisma.subscription.findUnique.mockResolvedValue({
      plan: "PRO",
      status: "CANCELED",
      stripeCustomerId: "cus_old",
      stripeSubscriptionId: "sub_old",
    });

    await service.startCheckout(workspaceId, owner);

    expect(stripe.createCustomer).not.toHaveBeenCalled();
    expect(stripe.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: "cus_old", trialDays: undefined }),
    );
  });

  it("409s a workspace already on a paid plan", async () => {
    prisma.subscription.findUnique.mockResolvedValue({
      plan: "PRO",
      status: "PAST_DUE",
    });

    await expect(
      service.startCheckout(workspaceId, owner),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(stripe.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("503s, writing nothing, when Stripe isn't configured", async () => {
    stripe.isConfigured.mockReturnValue(false);

    await expect(
      service.startCheckout(workspaceId, owner),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.subscription.upsert).not.toHaveBeenCalled();
  });
});

describe("BillingService.openPortal", () => {
  it("opens the portal for the workspace's customer", async () => {
    prisma.subscription.findUnique.mockResolvedValue({
      stripeCustomerId: "cus_1",
    });

    await expect(service.openPortal(workspaceId)).resolves.toEqual({
      url: "https://billing.stripe.test/p",
    });
    expect(stripe.createPortalSession).toHaveBeenCalledWith(
      "cus_1",
      "https://app.test/settings/billing",
    );
  });

  it("404s a workspace that never checked out", async () => {
    await expect(service.openPortal(workspaceId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe("BillingService.handleWebhook", () => {
  it("400s without a signature or body, before reading the event", async () => {
    await expect(
      service.handleWebhook(undefined, "sig"),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.handleWebhook(raw, "")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(stripe.constructEvent).not.toHaveBeenCalled();
  });

  it("passes on the 400 for a bad signature, writing nothing", async () => {
    stripe.constructEvent.mockImplementation(() => {
      throw new BadRequestException("Invalid Stripe signature");
    });

    await expect(service.handleWebhook(raw, "sig")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.subscription.upsert).not.toHaveBeenCalled();
  });

  it("stores the subscription as Stripe has it now, with the event id", async () => {
    stripe.constructEvent.mockReturnValue(
      event("customer.subscription.updated", { id: "sub_1" }),
    );
    stripe.retrieveSubscription.mockResolvedValue(
      stripeSubscription({
        status: "trialing",
        trial_end: 1_800_000_000,
        cancel_at_period_end: true,
      }),
    );

    await service.handleWebhook(raw, "sig");

    expect(stripe.retrieveSubscription).toHaveBeenCalledWith("sub_1");
    const data = {
      plan: "PRO",
      status: "TRIALING",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      seats: 3,
      currentPeriodEnd: new Date(1_900_000_000 * 1000),
      cancelAtPeriodEnd: true,
      trialEndsAt: new Date(1_800_000_000 * 1000),
    };
    expect(prisma.subscription.upsert).toHaveBeenCalledWith({
      where: { workspaceId },
      create: { workspaceId, ...data },
      update: data,
    });
    expect(prisma.stripeEvent.create).toHaveBeenCalledWith({
      data: { id: "evt_1", type: "customer.subscription.updated" },
    });
  });

  it("records billing.subscription_changed once, as the system", async () => {
    stripe.constructEvent.mockReturnValue(
      event("customer.subscription.updated", { id: "sub_1" }),
    );
    stripe.retrieveSubscription.mockResolvedValue(
      stripeSubscription({ status: "trialing" }),
    );

    await service.handleWebhook(raw, "sig");

    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        workspaceId,
        userId: null,
        action: "billing.subscription_changed",
        entityType: "SUBSCRIPTION",
        entityId: "subrow-1",
        metadata: {
          from: null,
          to: { plan: "PRO", status: "TRIALING", cancelAtPeriodEnd: false },
        },
      },
    });
  });

  it("records nothing when the plan, status and cancellation are unchanged", async () => {
    stripe.constructEvent.mockReturnValue(
      event("customer.subscription.updated", { id: "sub_1" }),
    );
    prisma.workspace.findUnique.mockResolvedValue({
      id: workspaceId,
      subscription: {
        stripeSubscriptionId: "sub_1",
        plan: "PRO",
        status: "ACTIVE",
        cancelAtPeriodEnd: false,
      },
    });

    await service.handleWebhook(raw, "sig");

    expect(prisma.subscription.upsert).toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("applies an event delivered twice only once", async () => {
    stripe.constructEvent.mockReturnValue(
      event("customer.subscription.updated", { id: "sub_1" }),
    );
    prisma.stripeEvent.findUnique.mockResolvedValue({ id: "evt_1" });

    await expect(service.handleWebhook(raw, "sig")).resolves.toEqual({
      received: true,
      duplicate: true,
    });
    expect(stripe.retrieveSubscription).not.toHaveBeenCalled();
    expect(prisma.subscription.upsert).not.toHaveBeenCalled();
  });

  it("treats a concurrent duplicate (unique clash on the event id) as applied", async () => {
    stripe.constructEvent.mockReturnValue(
      event("customer.subscription.updated", { id: "sub_1" }),
    );
    prisma.stripeEvent.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    await expect(service.handleWebhook(raw, "sig")).resolves.toEqual({
      received: true,
      duplicate: true,
    });
  });

  it("finds the workspace by customer when the metadata lacks it", async () => {
    stripe.constructEvent.mockReturnValue(
      event("customer.subscription.deleted", { id: "sub_1" }),
    );
    stripe.retrieveSubscription.mockResolvedValue(
      stripeSubscription({ metadata: {}, status: "canceled" }),
    );
    prisma.subscription.findUnique.mockResolvedValue({ workspaceId });

    await service.handleWebhook(raw, "sig");

    expect(prisma.subscription.findUnique).toHaveBeenCalledWith({
      where: { stripeCustomerId: "cus_1" },
      select: { workspaceId: true },
    });
    expect(prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: "CANCELED" }) as object,
      }),
    );
  });

  it("records, and otherwise ignores, an event for a deleted workspace", async () => {
    stripe.constructEvent.mockReturnValue(
      event("customer.subscription.deleted", { id: "sub_1" }),
    );
    prisma.workspace.findUnique.mockResolvedValue(null);

    await service.handleWebhook(raw, "sig");

    expect(prisma.subscription.upsert).not.toHaveBeenCalled();
    expect(prisma.stripeEvent.create).toHaveBeenCalled();
  });

  it("cancels a second live subscription instead of storing it", async () => {
    stripe.constructEvent.mockReturnValue(
      event("checkout.session.completed", {
        mode: "subscription",
        subscription: "sub_2",
      }),
    );
    stripe.retrieveSubscription.mockResolvedValue(
      stripeSubscription({ id: "sub_2" }),
    );
    prisma.workspace.findUnique.mockResolvedValue({
      id: workspaceId,
      subscription: { stripeSubscriptionId: "sub_1", status: "ACTIVE" },
    });
    const warn = jest
      .spyOn(service["logger"], "warn")
      .mockImplementation(() => undefined);

    await service.handleWebhook(raw, "sig");

    expect(stripe.cancelNow).toHaveBeenCalledWith("sub_2");
    expect(warn).toHaveBeenCalled();
    expect(prisma.subscription.upsert).not.toHaveBeenCalled();
  });

  it("stores a new subscription once the old one has ended", async () => {
    stripe.constructEvent.mockReturnValue(
      event("customer.subscription.created", { id: "sub_2" }),
    );
    stripe.retrieveSubscription.mockResolvedValue(
      stripeSubscription({ id: "sub_2" }),
    );
    prisma.workspace.findUnique.mockResolvedValue({
      id: workspaceId,
      subscription: { stripeSubscriptionId: "sub_1", status: "CANCELED" },
    });

    await service.handleWebhook(raw, "sig");

    expect(stripe.cancelNow).not.toHaveBeenCalled();
    expect(prisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          stripeSubscriptionId: "sub_2",
          status: "ACTIVE",
        }) as object,
      }),
    );
  });

  it("records events it doesn't act on", async () => {
    stripe.constructEvent.mockReturnValue(
      event("customer.created", { id: "cus_1" }),
    );

    await service.handleWebhook(raw, "sig");

    expect(stripe.retrieveSubscription).not.toHaveBeenCalled();
    expect(prisma.stripeEvent.create).toHaveBeenCalled();
  });
});

describe("subscriptionIdOf", () => {
  it.each([
    [
      "checkout.session.completed",
      { mode: "subscription", subscription: "sub_1" },
      "sub_1",
    ],
    [
      "checkout.session.completed",
      { mode: "payment", subscription: null },
      null,
    ],
    ["customer.subscription.deleted", { id: "sub_1" }, "sub_1"],
    [
      "invoice.payment_failed",
      { parent: { subscription_details: { subscription: "sub_1" } } },
      "sub_1",
    ],
    ["invoice.paid", { parent: null }, null],
    ["customer.updated", { id: "cus_1" }, null],
  ])("%s", (type, object, expected) => {
    expect(subscriptionIdOf(event(type, object))).toBe(expected);
  });
});

describe("toSubscriptionStatus", () => {
  it("maps Stripe's statuses, and an unknown one to a status granting nothing", () => {
    expect(toSubscriptionStatus("past_due")).toBe("PAST_DUE");
    expect(toSubscriptionStatus("incomplete_expired")).toBe(
      "INCOMPLETE_EXPIRED",
    );
    expect(toSubscriptionStatus("something_new")).toBe("INCOMPLETE");
  });
});

describe("BillingService.syncSeats", () => {
  it("bills a live subscription for the current member count", async () => {
    prisma.subscription.findUnique.mockResolvedValue({
      stripeSubscriptionId: "sub_1",
      status: "ACTIVE",
    });
    prisma.membership.count.mockResolvedValue(7);

    await service.syncSeats(workspaceId);

    expect(stripe.setSeats).toHaveBeenCalledWith("sub_1", 7);
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { workspaceId },
      data: { seats: 7 },
    });
  });

  it("does nothing for a Free workspace or a lapsed subscription", async () => {
    await service.syncSeats(workspaceId);
    prisma.subscription.findUnique.mockResolvedValue({
      stripeSubscriptionId: "sub_1",
      status: "CANCELED",
    });
    await service.syncSeats(workspaceId);

    expect(stripe.setSeats).not.toHaveBeenCalled();
  });

  it("logs a Stripe failure instead of throwing", async () => {
    prisma.subscription.findUnique.mockResolvedValue({
      stripeSubscriptionId: "sub_1",
      status: "ACTIVE",
    });
    stripe.setSeats.mockRejectedValue(new Error("Stripe is down"));
    const log = jest
      .spyOn(service["logger"], "error")
      .mockImplementation(() => undefined);

    await expect(service.syncSeats(workspaceId)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
  });
});

describe("BillingService.cancelForDeletion", () => {
  beforeEach(() => {
    prisma.subscription.findUnique.mockResolvedValue({
      stripeSubscriptionId: "sub_1",
      status: "ACTIVE",
    });
  });

  it("ends the subscription now", async () => {
    await service.cancelForDeletion(workspaceId);

    expect(stripe.cancelNow).toHaveBeenCalledWith("sub_1");
  });

  it("does nothing for a subscription that has already ended", async () => {
    prisma.subscription.findUnique.mockResolvedValue({
      stripeSubscriptionId: "sub_1",
      status: "CANCELED",
    });

    await service.cancelForDeletion(workspaceId);

    expect(stripe.cancelNow).not.toHaveBeenCalled();
  });

  it("is fine when Stripe no longer has the subscription", async () => {
    stripe.cancelNow.mockRejectedValue(
      Object.assign(new Error("No such subscription"), {
        code: "resource_missing",
      }),
    );

    await expect(
      service.cancelForDeletion(workspaceId),
    ).resolves.toBeUndefined();
  });

  it("502s when Stripe refuses", async () => {
    stripe.cancelNow.mockRejectedValue(new Error("Stripe is down"));
    jest.spyOn(service["logger"], "error").mockImplementation(() => undefined);

    await expect(service.cancelForDeletion(workspaceId)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it("passes on the 503 when Stripe isn't configured", async () => {
    stripe.cancelNow.mockRejectedValue(new ServiceUnavailableException());

    await expect(service.cancelForDeletion(workspaceId)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

describe("billing:manage", () => {
  it("is the owner's alone: no role holds it, Admin included", () => {
    expect(owner.permissions.has("billing:manage")).toBe(true);
    for (const role of [
      WorkspaceRole.ADMIN,
      WorkspaceRole.MEMBER,
      WorkspaceRole.VIEWER,
    ]) {
      expect(accessAs(role).permissions.has("billing:manage")).toBe(false);
    }
  });
});
