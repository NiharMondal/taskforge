import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "crypto";
import type Stripe from "stripe";

/**
 * Every call the billing module makes to Stripe, so tests mock this class
 * rather than the SDK. The keys are read lazily, like GOOGLE_CLIENT_ID: the
 * backend boots without them, and a call that needs Stripe answers 503.
 *
 * The SDK itself is loaded on first use too, never at import: every service
 * that syncs seats imports this file, and loading the SDK in each Jest worker
 * made workers crash (SIGSEGV) now and then.
 */
@Injectable()
export class StripeService {
  private stripe?: Stripe;
  private stripeKey?: string;

  constructor(private readonly config: ConfigService) {}

  /** Whether STRIPE_SECRET_KEY and STRIPE_PRO_PRICE_ID are both set. */
  isConfigured(): boolean {
    return (
      !!this.config.get<string>("STRIPE_SECRET_KEY") &&
      !!this.config.get<string>("STRIPE_PRO_PRICE_ID")
    );
  }

  async createCustomer(params: {
    workspaceId: string;
    workspaceName: string;
    email: string;
  }): Promise<string> {
    const stripe = await this.client();
    const customer = await stripe.customers.create(
      {
        email: params.email,
        name: params.workspaceName,
        metadata: { workspaceId: params.workspaceId },
      },
      // Two checkouts racing for a workspace without a customer get the same
      // one. Stripe refuses a reused key with different parameters, so the
      // key covers them all (a rename in between just makes a new customer).
      {
        idempotencyKey: `customer-${createHash("sha256")
          .update(JSON.stringify(params))
          .digest("hex")}`,
      },
    );
    return customer.id;
  }

  /** A hosted Checkout page for the Pro price; returns its URL. */
  async createCheckoutSession(params: {
    workspaceId: string;
    customerId: string;
    seats: number;
    trialDays: number | undefined;
    successUrl: string;
    cancelUrl: string;
  }): Promise<string> {
    const stripe = await this.client();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: params.customerId,
      client_reference_id: params.workspaceId,
      line_items: [{ price: this.priceId(), quantity: params.seats }],
      subscription_data: {
        // The webhook finds the workspace through this.
        metadata: { workspaceId: params.workspaceId },
        trial_period_days: params.trialDays,
      },
      metadata: { workspaceId: params.workspaceId },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });
    if (!session.url) {
      throw new ServiceUnavailableException("Stripe returned no checkout URL");
    }
    return session.url;
  }

  /** A Customer Portal session (card, invoices, cancel); returns its URL. */
  async createPortalSession(
    customerId: string,
    returnUrl: string,
  ): Promise<string> {
    const stripe = await this.client();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return session.url;
  }

  async retrieveSubscription(
    subscriptionId: string,
  ): Promise<Stripe.Subscription> {
    const stripe = await this.client();
    return stripe.subscriptions.retrieve(subscriptionId);
  }

  /** Bill for `seats` members from now on; Stripe prorates the difference. */
  async setSeats(subscriptionId: string, seats: number): Promise<number> {
    const subscription = await this.retrieveSubscription(subscriptionId);
    const item = subscription.items.data[0];
    if (!item) {
      throw new ServiceUnavailableException("Subscription has no items");
    }
    if (item.quantity === seats) return seats;

    const stripe = await this.client();
    const updated = await stripe.subscriptionItems.update(item.id, {
      quantity: seats,
      proration_behavior: "create_prorations",
    });
    return updated.quantity ?? seats;
  }

  /** Ends the subscription now, not at the period end. */
  async cancelNow(subscriptionId: string): Promise<void> {
    const stripe = await this.client();
    await stripe.subscriptions.cancel(subscriptionId);
  }

  /**
   * The verified event, or a 400 when the signature doesn't match: anyone can
   * POST to the webhook, so nothing in an unsigned body is trusted.
   */
  async constructEvent(
    rawBody: Buffer,
    signature: string,
  ): Promise<Stripe.Event> {
    const secret = this.config.get<string>("STRIPE_WEBHOOK_SECRET");
    if (!secret) {
      throw new ServiceUnavailableException("Billing is not configured");
    }
    const stripe = await this.client();
    try {
      return stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      throw new BadRequestException("Invalid Stripe signature");
    }
  }

  private priceId(): string {
    const priceId = this.config.get<string>("STRIPE_PRO_PRICE_ID");
    if (!priceId) {
      throw new ServiceUnavailableException("Billing is not configured");
    }
    return priceId;
  }

  private async client(): Promise<Stripe> {
    // Read lazily: the backend should still boot for deployments that don't
    // sell plans.
    const key = this.config.get<string>("STRIPE_SECRET_KEY");
    if (!key) {
      throw new ServiceUnavailableException("Billing is not configured");
    }
    if (this.stripe && this.stripeKey === key) return this.stripe;

    // `import()` resolves the SDK's ESM type declarations, `import type` above
    // its CommonJS ones; the class is the same, so keep one set of types.
    const sdk = await import("stripe");
    const StripeSdk = sdk.default as unknown as new (apiKey: string) => Stripe;
    const stripe = new StripeSdk(key);
    this.stripe = stripe;
    this.stripeKey = key;
    return stripe;
  }
}
