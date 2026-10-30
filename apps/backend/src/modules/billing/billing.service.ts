import {
  effectivePlan,
  isLiveSubscriptionStatus,
  PLAN_LIMITS,
  PRO_TRIAL_DAYS,
} from "@taskforge/shared";
import { countSeatsTaken } from "@/common/plans/plan-limits";
import { appUrl } from "@/helper";
import type { WorkspaceAccess } from "@/common/permissions/workspace-access";
import { PrismaService } from "@/prisma/prisma.service";
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "generated/prisma/client";
import { SubscriptionPlan, SubscriptionStatus } from "generated/prisma/enums";
import type Stripe from "stripe";
import { StripeService } from "./stripe.service";
import { recordWorkspaceEvent } from "../activity/workspace-activity";

const STATUS_FROM_STRIPE: Record<string, SubscriptionStatus> = {
  active: SubscriptionStatus.ACTIVE,
  trialing: SubscriptionStatus.TRIALING,
  past_due: SubscriptionStatus.PAST_DUE,
  unpaid: SubscriptionStatus.UNPAID,
  canceled: SubscriptionStatus.CANCELED,
  incomplete: SubscriptionStatus.INCOMPLETE,
  incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
  paused: SubscriptionStatus.PAUSED,
};

/**
 * A Stripe status as ours. One Stripe adds later reads as INCOMPLETE, which
 * grants nothing, until it is mapped here.
 */
export const toSubscriptionStatus = (status: string): SubscriptionStatus =>
  STATUS_FROM_STRIPE[status] ?? SubscriptionStatus.INCOMPLETE;

/** Statuses a subscription never leaves; anything else may still bill. */
const FINAL_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.CANCELED,
  SubscriptionStatus.INCOMPLETE_EXPIRED,
];

const fromUnix = (seconds: number | null | undefined) =>
  seconds ? new Date(seconds * 1000) : null;

const idOf = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : (value?.id ?? null);

/**
 * Workspace billing (`spec/billing-spec.md`): the plan, Stripe Checkout and
 * Customer Portal sessions, the webhook that writes `Subscription`, and the
 * seat count kept in step with the roster. Limits themselves are checked by
 * the services that write (`common/plans/plan-limits.ts`).
 */
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private prisma: PrismaService,
    private stripe: StripeService,
    private config: ConfigService,
  ) {}

  /** What `GET /billing` shows any member. */
  async getBilling(workspaceId: string) {
    const [subscription, usage] = await Promise.all([
      this.prisma.subscription.findUnique({ where: { workspaceId } }),
      countSeatsTaken(this.prisma, workspaceId),
    ]);
    const plan = effectivePlan(subscription);

    return {
      plan,
      status: subscription?.status ?? null,
      seats: subscription?.seats ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      trialEndsAt: subscription?.trialEndsAt ?? null,
      /** Whether a checkout now would start with the free trial. */
      trialAvailable: !subscription?.stripeSubscriptionId,
      /** Whether "Manage billing" has a Stripe customer to open. */
      hasBillingAccount: !!subscription?.stripeCustomerId,
      /** Whether this deployment has Stripe keys (checkout answers 503 without). */
      billingEnabled: this.stripe.isConfigured(),
      limits: PLAN_LIMITS[plan],
      usage,
    };
  }

  /**
   * A Checkout Session for Pro, billed per member. `billing:manage` (the
   * owner) is checked on the route. The plan changes only when the webhook
   * reports the subscription, never on the redirect back.
   */
  async startCheckout(workspaceId: string, actor: WorkspaceAccess) {
    // Before any write, so a deployment without keys leaves no rows behind.
    if (!this.stripe.isConfigured()) {
      throw new ServiceUnavailableException("Billing is not configured");
    }

    const existing = await this.prisma.subscription.findUnique({
      where: { workspaceId },
    });
    if (effectivePlan(existing) !== SubscriptionPlan.FREE) {
      throw new ConflictException("This workspace is already on a paid plan");
    }

    const customerId =
      existing?.stripeCustomerId ??
      (await this.createCustomer(workspaceId, actor.userId));
    const seats = await this.prisma.membership.count({
      where: { workspaceId },
    });

    const url = await this.stripe.createCheckoutSession({
      workspaceId,
      customerId,
      seats: Math.max(seats, 1),
      // One trial per workspace: a past subscription, even a canceled one, rules it out.
      trialDays: existing?.stripeSubscriptionId ? undefined : PRO_TRIAL_DAYS,
      successUrl: appUrl(this.config, "/settings/billing?checkout=success"),
      cancelUrl: appUrl(this.config, "/settings/billing?checkout=canceled"),
    });
    return { url };
  }

  /** A Customer Portal session. `billing:manage` is checked on the route. */
  async openPortal(workspaceId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { workspaceId },
      select: { stripeCustomerId: true },
    });
    if (!subscription?.stripeCustomerId) {
      throw new NotFoundException(
        "This workspace has no billing account yet. Upgrade to create one.",
      );
    }

    const url = await this.stripe.createPortalSession(
      subscription.stripeCustomerId,
      appUrl(this.config, "/settings/billing"),
    );
    return { url };
  }

  /**
   * `POST /billing/webhook`. Each event is applied once (its id is recorded
   * in the same transaction), and the subscription is re-read from Stripe
   * rather than taken from the event, because Stripe doesn't guarantee
   * delivery order: an old `updated` must not resurrect a canceled plan.
   */
  async handleWebhook(rawBody: Buffer | undefined, signature: string) {
    if (!rawBody || !signature) {
      throw new BadRequestException("Missing Stripe signature");
    }
    const event = await this.stripe.constructEvent(rawBody, signature);

    const seen = await this.prisma.stripeEvent.findUnique({
      where: { id: event.id },
    });
    if (seen) return { received: true, duplicate: true };

    const subscriptionId = subscriptionIdOf(event);
    const write = subscriptionId
      ? await this.subscriptionWrite(subscriptionId)
      : undefined;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.stripeEvent.create({
          data: { id: event.id, type: event.type },
        });
        if (write) await write(tx);
      });
    } catch (error) {
      // The same event delivered twice at once: the other delivery applied it.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return { received: true, duplicate: true };
      }
      throw error;
    }
    return { received: true };
  }

  /**
   * Bill the workspace's live subscription for its current member count,
   * after a member joins or leaves. Never throws: the membership change has
   * already happened, and the next sync or webhook corrects a missed one.
   */
  async syncSeats(workspaceId: string): Promise<void> {
    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { workspaceId },
        select: { stripeSubscriptionId: true, status: true },
      });
      if (
        !subscription?.stripeSubscriptionId ||
        !isLiveSubscriptionStatus(subscription.status) ||
        !this.stripe.isConfigured()
      ) {
        return;
      }

      const members = await this.prisma.membership.count({
        where: { workspaceId },
      });
      const seats = await this.stripe.setSeats(
        subscription.stripeSubscriptionId,
        Math.max(members, 1),
      );
      await this.prisma.subscription.update({
        where: { workspaceId },
        data: { seats },
      });
    } catch (error) {
      this.logger.error(
        `Seat sync failed for workspace ${workspaceId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Before a workspace is deleted: end its subscription now, so nobody keeps
   * paying for a workspace that is gone. Stripe refusing is a 502 and missing
   * keys a 503, and either stops the delete.
   */
  async cancelForDeletion(workspaceId: string): Promise<void> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { workspaceId },
      select: { stripeSubscriptionId: true, status: true },
    });
    if (
      !subscription?.stripeSubscriptionId ||
      !subscription.status ||
      FINAL_STATUSES.includes(subscription.status)
    ) {
      return;
    }

    try {
      await this.stripe.cancelNow(subscription.stripeSubscriptionId);
    } catch (error) {
      // Ours (503: billing not configured) passes through.
      if (error instanceof HttpException) throw error;
      // Already gone on Stripe's side: nothing left to bill.
      if ((error as { code?: string }).code === "resource_missing") return;
      this.logger.error(
        `Canceling the subscription of workspace ${workspaceId} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new BadGatewayException(
        "Couldn't cancel this workspace's subscription with Stripe, so it wasn't deleted. Try again in a moment.",
      );
    }
  }

  /**
   * Reads the subscription from Stripe and returns the write that stores it,
   * or nothing when the event should only be recorded: the workspace is gone,
   * or it is a second subscription next to a live one (canceled here).
   */
  private async subscriptionWrite(subscriptionId: string) {
    const subscription = await this.stripe.retrieveSubscription(subscriptionId);
    const customerId = idOf(subscription.customer);
    const status = toSubscriptionStatus(subscription.status);

    const workspaceId =
      subscription.metadata?.workspaceId ??
      (customerId
        ? (
            await this.prisma.subscription.findUnique({
              where: { stripeCustomerId: customerId },
              select: { workspaceId: true },
            })
          )?.workspaceId
        : undefined);
    if (!workspaceId) {
      this.logger.warn(`Subscription ${subscriptionId} names no workspace`);
      return undefined;
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, subscription: true },
    });
    if (!workspace) return undefined;

    const stored = workspace.subscription;
    if (
      stored?.stripeSubscriptionId &&
      stored.stripeSubscriptionId !== subscription.id
    ) {
      if (isLiveSubscriptionStatus(stored.status)) {
        // A second checkout went through: keep the first subscription.
        if (!FINAL_STATUSES.includes(status)) {
          this.logger.warn(
            `Canceling duplicate subscription ${subscription.id} of workspace ${workspaceId}`,
          );
          await this.stripe.cancelNow(subscription.id);
        }
        return undefined;
      }
      // The stored one has ended; a finished newcomer changes nothing either.
      if (FINAL_STATUSES.includes(status)) return undefined;
    }

    const item = subscription.items.data[0];
    const data = {
      plan: SubscriptionPlan.PRO,
      status,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      seats: item?.quantity ?? null,
      currentPeriodEnd: fromUnix(item?.current_period_end),
      cancelAtPeriodEnd:
        subscription.cancel_at_period_end || !!subscription.cancel_at,
      trialEndsAt: fromUnix(subscription.trial_end),
    };

    // Many events re-send a subscription that hasn't changed in a way an
    // owner cares about; the audit log only records the ones that did.
    const from = stored && {
      plan: stored.plan,
      status: stored.status,
      cancelAtPeriodEnd: stored.cancelAtPeriodEnd,
    };
    const to = {
      plan: data.plan,
      status: data.status,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd,
    };
    const changed =
      !from ||
      from.plan !== to.plan ||
      from.status !== to.status ||
      from.cancelAtPeriodEnd !== to.cancelAtPeriodEnd;

    return async (tx: Prisma.TransactionClient) => {
      const saved = await tx.subscription.upsert({
        where: { workspaceId },
        create: { workspaceId, ...data },
        update: data,
      });
      if (changed) {
        await recordWorkspaceEvent(tx, {
          workspaceId,
          userId: null,
          action: "billing.subscription_changed",
          entityId: saved.id,
          metadata: { from, to },
        });
      }
    };
  }

  private async createCustomer(workspaceId: string, ownerId: string) {
    const [workspace, owner] = await Promise.all([
      this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true },
      }),
      this.prisma.user.findUnique({
        where: { id: ownerId },
        select: { email: true },
      }),
    ]);
    if (!workspace || !owner) {
      throw new NotFoundException("Workspace not found");
    }

    const customerId = await this.stripe.createCustomer({
      workspaceId,
      workspaceName: workspace.name,
      email: owner.email,
    });
    await this.prisma.subscription.upsert({
      where: { workspaceId },
      create: { workspaceId, stripeCustomerId: customerId },
      update: { stripeCustomerId: customerId },
    });
    return customerId;
  }
}

/** The subscription an event is about, for the events billing listens to. */
export function subscriptionIdOf(event: Stripe.Event): string | null {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      return session.mode === "subscription"
        ? idOf(session.subscription)
        : null;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      return event.data.object.id;
    case "invoice.paid":
    case "invoice.payment_failed":
      return idOf(event.data.object.parent?.subscription_details?.subscription);
    default:
      return null;
  }
}
