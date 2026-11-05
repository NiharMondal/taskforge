# Billing Module — Backend Spec

## Goal

Let a workspace pay for TaskForge. The **workspace** is the customer, its **owner** pays, and Pro is
billed **per member per month** through Stripe. Card details never reach TaskForge: checkout and
card management are Stripe-hosted pages (Checkout and the Customer Portal). The reasoning behind
these choices is in `docs/billing-plan-2026-10-29.md`.

## Plans and limits

The numbers live in `@taskforge/shared` (`packages/shared/src/plans.ts`), which the web's plan
cards read too.

| | Free | Pro | Enterprise |
| --- | --- | --- | --- |
| Members (incl. live pending invitations) | 5 | unlimited | unlimited |
| Custom roles (create) | — | ✓ | ✓ |
| Counts toward the owner's 2 Free workspaces | yes | no | no |
| How a workspace gets it | default | self-serve checkout | set by hand in the database |

Everything else (projects, issues, sprints, labels, comments) is unlimited on every plan.

**The plan in force** is `effectivePlan(subscription)`: the stored `plan` while `status` is
`ACTIVE`, `TRIALING` or `PAST_DUE`, else FREE. No `Subscription` row is FREE. Enterprise is a row
with `plan: ENTERPRISE, status: ACTIVE` and no Stripe ids; the webhook never touches it.

### Where the limits are checked

A limit hit is **`402`** with `{ success: false, statusCode: 402, message, code: "PLAN_LIMIT",
limit }`, where `limit` is `members`, `customRoles` or `ownedWorkspaces`. A `403` still means "not
allowed"; a `402` means "upgrade needed". The checks are in `src/common/plans/plan-limits.ts`.

- **Members** — `POST /invitations` counts members plus PENDING, unexpired invitations. Accepting an
  invitation isn't re-checked: the invitation already reserved the seat.
- **Custom roles** — `POST /roles`. Editing, assigning and deleting existing custom roles stay
  allowed, so a workspace back on Free keeps working.
- **Owned Free workspaces** — `POST /workspaces` counts the caller's OWNER memberships whose
  workspace is on Free (the one created with the account included). Sign-up isn't checked.

Going back to Free deletes nothing and removes nobody. A workspace over the limits just can't add
past them.

## Who may manage billing

`billing:manage` is **owner-only** (in `OWNER_ONLY_PERMISSIONS`, never stored on a role), like
`workspace:delete`. Transferring ownership hands it over; the Stripe customer stays with the
workspace.

## API Endpoints

Base path: `/billing`

| Method | Route | Who | Does |
| --- | --- | --- | --- |
| `GET` | `/` | Any member | The plan, status and limits, with usage |
| `POST` | `/checkout` | `billing:manage` | A Stripe Checkout Session for Pro; returns `{ url }` |
| `POST` | `/portal` | `billing:manage` | A Stripe Customer Portal session; returns `{ url }` |
| `POST` | `/webhook` | Public, Stripe-signed | Applies Stripe's subscription events |

### `GET /billing`

```ts
{
  plan: "FREE" | "PRO" | "ENTERPRISE",   // in force now
  status: SubscriptionStatus | null,      // null: never subscribed
  seats: number | null,                   // Stripe's quantity
  currentPeriodEnd: string | null,
  cancelAtPeriodEnd: boolean,
  trialEndsAt: string | null,
  trialAvailable: boolean,                // the workspace never had a subscription
  hasBillingAccount: boolean,             // a Stripe customer exists (portal works)
  billingEnabled: boolean,                // Stripe keys are set on this server
  limits: { members: number | null, customRoles: boolean },
  usage: { members: number, pendingInvitations: number },
}
```

### `POST /billing/checkout`

Creates the workspace's Stripe customer on first use (owner's email, workspace name,
`metadata.workspaceId`; stored on the `Subscription` row with `status: null`), then a Checkout
Session: `mode: subscription`, the Pro price, `quantity` = current member count,
`subscription_data.metadata.workspaceId`, a 14-day trial (`PRO_TRIAL_DAYS`) **only if the workspace
never had a subscription**, and success/cancel URLs `APP_URL/settings/billing?checkout=success|canceled`.

| Status | Reason |
| --- | --- |
| `403` | Not the owner |
| `409` | Already on a paid plan |
| `503` | `STRIPE_SECRET_KEY` or `STRIPE_PRO_PRICE_ID` unset (nothing is written) |

The redirect back changes nothing: the plan changes only when the webhook arrives, so opening the
success URL by hand can't upgrade a workspace.

### `POST /billing/portal`

`404` when the workspace has no Stripe customer yet; `503` without keys.

### `POST /billing/webhook`

`@Public()` (Stripe has no token) and not throttled. The signature in `stripe-signature` is checked
against the **raw** request body (`rawBody: true` in `main.ts` and the e2e app) with
`STRIPE_WEBHOOK_SECRET`: missing or wrong is `400`, an unset secret `503`.

Handled events: `checkout.session.completed`, `customer.subscription.created/updated/deleted/
paused/resumed`, `invoice.paid`, `invoice.payment_failed`. Each names a subscription; anything else
is recorded and ignored.

1. **Once per event.** A `StripeEvent` row with the event id is written in the same transaction as
   the change; an id already there answers `200 { received: true, duplicate: true }`, and two
   deliveries racing collide on the primary key (treated the same way).
2. **Re-read, don't trust the event.** The subscription is fetched from Stripe
   (`subscriptions.retrieve`), so delivery order doesn't matter — an old `updated` arriving after
   `deleted` stores the canceled state, not the stale one.
3. **Find the workspace** from `subscription.metadata.workspaceId`, else by `stripeCustomerId`. A
   workspace that no longer exists: recorded, ignored.
4. **One subscription per workspace.** If the stored subscription is a different one and still live,
   the newcomer (a second checkout) is canceled at once and not stored. If the stored one has ended,
   a live newcomer replaces it.
5. **Store** `plan: PRO`, `status` (Stripe's, mapped one-for-one; an unknown status maps to
   `INCOMPLETE`, which grants nothing), customer and subscription ids, `seats` (the item's
   quantity), `currentPeriodEnd` (the item's `current_period_end` — Stripe moved it off the
   subscription in its 2025 API versions), `cancelAtPeriodEnd` (`cancel_at_period_end` or a set
   `cancel_at`) and `trialEndsAt`.

## Seats

`BillingService.syncSeats(workspaceId)` runs after a membership is created
(`InvitationService.acceptInvitation`) or deleted (`MembershipService.removeMember`, `leave`). For a
live Stripe subscription it sets the item's quantity to the member count with
`proration_behavior: create_prorations` and stores it as `seats`. It runs after the commit and never
throws — a Stripe failure is logged, the membership stands, and the next sync or webhook corrects
the count. Role changes and ownership transfers don't change the count.

## Deleting a workspace

`DELETE /workspaces/:id` first cancels a subscription that may still bill (any status but `CANCELED`
and `INCOMPLETE_EXPIRED`) immediately, then deletes (the `Subscription` row cascades). Stripe
refusing is a `502` and missing keys a `503`; either way the workspace is kept, so the owner isn't
left paying for something gone. A subscription Stripe no longer has (`resource_missing`) counts as
canceled.

## Data

- `Subscription` (one per workspace): `plan`, `status SubscriptionStatus?` (`ACTIVE`, `TRIALING`,
  `PAST_DUE`, `UNPAID`, `CANCELED`, `INCOMPLETE`, `INCOMPLETE_EXPIRED`, `PAUSED`),
  `stripeCustomerId @unique`, `stripeSubscriptionId @unique`, `seats`, `currentPeriodEnd`,
  `cancelAtPeriodEnd`, `trialEndsAt`.
- `StripeEvent { id, type, processedAt }`: applied webhook events.
- `GET /workspaces` adds each workspace's `plan` (in force now).

## Configuration

Read lazily by `StripeService`, like `GOOGLE_CLIENT_ID`: the backend boots without them, the Free
limits still apply, and the routes that need Stripe answer `503`.

| Variable | Used for |
| --- | --- |
| `STRIPE_SECRET_KEY` | Every Stripe call |
| `STRIPE_PRO_PRICE_ID` | The recurring, per-unit monthly Pro price (`price_…`) |
| `STRIPE_WEBHOOK_SECRET` | The webhook's signature check (`whsec_…`) |

Local development: `stripe listen --forward-to localhost:5001/api/v1/billing/webhook` prints the
webhook secret. In the Stripe dashboard, turn on the Customer Portal's payment-method update,
invoice history and cancellation.

## Known gaps

- Two invitations sent at the same moment to a Free workspace at 4/5 can both pass (the count isn't
  locked); at worst a Free workspace ends one seat over.
- Ownership transfer isn't checked against the 2-Free-workspaces cap.
- Seat sync is best-effort (see above).
- Yearly billing, self-serve Enterprise and limit reminder emails are not built.
