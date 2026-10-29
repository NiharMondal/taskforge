# Billing for TaskForge — plan

## Context

TaskForge is a team tool, but nobody can pay for it yet. The schema already has a `Subscription` model (one per workspace, plans `FREE` / `PRO` / `ENTERPRISE`, Stripe columns), but no code reads or writes it. The web's "Upgrade Plan" button only links to `/settings`. Its "2 workspaces" limit is checked in the browser only (and counts every workspace you belong to, not the ones you own); the backend doesn't enforce it. This plan answers the basic questions (what to charge for, who pays, how they pay), then lists the build steps.

> **Revised 2026-10-29, before implementation.** The first draft predated the `@taskforge/shared` refactor, so its file references for the permission catalog and the web's owner-only list were stale; they are corrected below. The review also added: plan limits in `@taskforge/shared` (the web's plan cards show the same numbers), a status enum covering every Stripe status, webhooks that re-read the subscription from Stripe (so event order doesn't matter), one trial per workspace, a guard against a second subscription from a double checkout, and the edge cases listed under "Known gaps".

> **Status: built (2026-10-29)** on `feat/stripe-billing-with-per-seat-pro-plan`, as revised here. The implemented contract is `apps/backend/spec/billing-spec.md`; what was and wasn't verified is in `docs/next-feature-2026-10-28.md`, item 6.

---

## Part 1 — The basics

### Who is the customer: the user or the workspace?

**The workspace.** This is how team tools charge: Jira, Linear, Notion, Slack and Asana all bill the team space, not the person.

- A workspace is a team. Its **owner pays** (they already hold the owner-only powers such as delete and transfer). Members never pay, and never see a payment form.
- One person can be in several workspaces. Each workspace has its own plan: a person can be in a paid company workspace and a free side-project workspace at once.
- Billing per user would break this. If Alice pays, does Bob's workspace that she joins become Pro? It also doesn't match the existing per-workspace `Subscription` model.

### What do they pay for?

**Per seat:** a monthly price per member of the workspace (e.g. $8 per member per month; you set the number in Stripe, not in code).

- Fair to customers: a team of 3 pays little and a team of 50 pays more, in line with the value they get.
- It's what people expect from a tracker (Jira and Linear charge this way).
- Stripe handles the hard parts: when a member joins or leaves mid-month, Stripe prorates the next invoice.

### Plans

| | **Free** | **Pro** (per seat, monthly) | **Enterprise** |
| --- | --- | --- | --- |
| Members (incl. pending invites) | up to **5** | unlimited | unlimited |
| Projects, issues, sprints, labels, comments | unlimited | unlimited | unlimited |
| Custom roles | — (built-ins only) | ✓ | ✓ |
| Free workspaces you can own | **2** (existing rule, now enforced by the backend; Pro workspaces don't count) | — | — |
| How to get it | default | self-serve checkout | "Contact us" link only (set by hand) |

Why these limits:
- **Members** is the natural line for a team tool. Free is enough for a person or a small team to try it properly. A growing team hits the limit when it can afford to pay.
- **Projects and issues stay unlimited.** Limiting core work feels punishing and pushes people away before they see the value.
- **Custom roles** (just built) are a typical paid feature: only bigger teams need them.
- **The 2-free-workspaces cap** stops a 20-person team from splitting into four 5-person workspaces to avoid paying.

Optional at launch: a **14-day Pro trial** at checkout (one Stripe setting). The plan includes it; drop it if you prefer. A workspace gets the trial **once**: one that has had a Stripe subscription before checks out without it, so canceling and re-subscribing doesn't buy another free fortnight.

### How does the user pay?

With **Stripe Checkout** and the **Stripe Customer Portal**. Both are pages hosted by Stripe, so card numbers never reach our servers and Stripe handles PCI compliance, 3-D Secure, receipts and invoices.

```
Owner → Settings → Billing → "Upgrade to Pro"
   → our backend creates a Checkout Session (price = Pro, quantity = member count)
   → browser goes to Stripe's checkout page → owner enters the card
   → Stripe redirects back to /settings/billing?checkout=success
   → Stripe calls our webhook: "subscription created/active"
   → backend saves plan = PRO on that workspace → limits lift
```

- **Manage** (change card, see invoices, cancel): the "Manage billing" button opens Stripe's Customer Portal.
- **Webhooks are the source of truth.** The redirect back only shows "activating…". The plan changes only when Stripe's signed webhook arrives, so a user can't fake an upgrade by opening the success URL.
- **Member joins or leaves** a Pro workspace: the backend updates the Stripe subscription quantity, and Stripe prorates.

### What happens when…

- **A payment fails:** Stripe retries for about two weeks (`past_due`). The workspace stays Pro meanwhile, and the Billing page shows a "payment failed, update your card" banner.
- **The subscription is canceled or ends:** the workspace goes back to Free. **No data is deleted and nobody is removed.** If it is over the Free limits, nobody new can be invited until it is under them, and no new custom roles can be created. Existing members and custom roles keep working.
- **A Pro workspace is deleted:** its Stripe subscription is canceled at once, so the owner isn't charged for a workspace that no longer exists.
- **Ownership is transferred:** the new owner holds `billing:manage` from then on. The Stripe customer belongs to the workspace, so the card and invoices stay where they are; the new owner changes the card in the portal.
- **Someone checks out twice** (two tabs, or a double click before the first webhook lands): the second subscription is canceled at once by the webhook that reports it, and only the first is kept.

---

## Part 2 — Implementation

One new branch, `feat/stripe-billing-with-per-seat-pro-plan`, cut from `refactor/shared-package`: that branch already carries custom roles (which the limits depend on) and the shared package (which the limits and permission key go into).

### 0. Your one-time Stripe setup (test mode, free)

1. Create a Stripe account and stay in **Test mode**.
2. Create a product "TaskForge Pro" with a **recurring monthly, per-unit** price (e.g. $8). Copy its `price_…` id.
3. In Settings → Billing → Customer portal, turn on: update payment method, view invoices, cancel subscription.
4. Install the Stripe CLI and run `stripe listen --forward-to localhost:5001/api/v1/billing/webhook` while developing. It prints the webhook signing secret.
5. Put these in `apps/backend/.env` (and add them to `.env.example`): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`.

Like `GOOGLE_CLIENT_ID`, these are read lazily: copy the `config.get` plus `ServiceUnavailableException` pattern in `apps/backend/src/modules/auth/google-token-verifier.ts:33-38`. The backend boots without them; the checkout and portal routes answer 503, and the Free limits still apply.

### 1. Database (one migration)

`apps/backend/prisma/schema.prisma`, model `Subscription`:
- `status` becomes a nullable enum `SubscriptionStatus` that mirrors every Stripe status: `ACTIVE`, `TRIALING`, `PAST_DUE`, `UNPAID`, `CANCELED`, `INCOMPLETE`, `INCOMPLETE_EXPIRED`, `PAUSED`. `null` means a Stripe customer was created (checkout started) but no subscription exists yet. No code writes the old `String` column, so the migration drops and re-adds it.
- Add `seats Int?`, `cancelAtPeriodEnd Boolean @default(false)`, `trialEndsAt DateTime?`.
- `stripeCustomerId` and `stripeSubscriptionId` become `@unique`.
- New model `StripeEvent { id String @id; type String; processedAt DateTime @default(now()) }`, so each webhook event is applied once (Stripe may deliver one twice).
- No backfill: a workspace with no `Subscription` row is on Free.
- The new enum goes into `packages/shared/src/enums.ts` too (`SUBSCRIPTION_STATUS_VALUES`, plus `SUBSCRIPTION_PLAN_VALUES`), and into `shared-enums.spec.ts`.

### 2. Plans and limits — one place for the rules

The numbers live in **`@taskforge/shared`** (`packages/shared/src/plans.ts`), because the web's plan cards show the same limits the backend enforces:
- `PLAN_LIMITS = { FREE: { members: 5, customRoles: false }, PRO: { members: null, customRoles: true }, ENTERPRISE: …same as PRO }` and `FREE_OWNED_WORKSPACES = 2`.
- `effectivePlan(subscription)`: PRO/ENTERPRISE while the status is `ACTIVE`, `TRIALING` or `PAST_DUE`, else FREE.
- `PLAN_LIMIT_ERROR_CODE = "PLAN_LIMIT"`.

The backend's checks go in `apps/backend/src/common/plans/plan-limits.ts`: `getWorkspacePlan(db, workspaceId)` and one `assert…` per limit. A limit hit throws **HTTP 402** with `{ message, code: "PLAN_LIMIT", limit }`, so the web can tell "upgrade needed" apart from "not allowed" (403). `HttpExceptionFilter` (`apps/backend/src/lib/http-exception.filter.ts:43-52`) already spreads an object response, so `code` reaches the client unchanged.

Where the limits are checked (the existing services, each before its write):
- **Members:** `InvitationService.sendInvitation` (`invitation.service.ts:58`), counting members plus live pending invitations (not counting the invitation being replaced when an expired or revoked one is re-sent). Accepting an invitation (`acceptInvitation`, :213) is not re-checked: the invitation already reserved the seat.
- **Custom roles:** `RoleService.create` (`roles/role.service.ts:77`). Editing, deleting and assigning existing custom roles stay allowed on Free, so a workspace that drops back keeps working.
- **Owned free workspaces:** `WorkspaceService.create` (`workspace/workspace.service.ts:15`) counts OWNER memberships whose workspace is on Free. Registration and first Google sign-in (`AuthService.createAccount`, `auth.service.ts:361`) create the user's first workspace and aren't checked.

### 3. Who may manage billing

Add `billing:manage` to `OWNER_ONLY_PERMISSIONS` in `packages/shared/src/permissions.ts`. It's never stored on a role, so no migration is needed, the same as `workspace:delete`. The web picks it up from there: `OwnerOnlyPermission` and `UNRESTRICTED_PERMISSIONS` (built from `ALL_PERMISSIONS`) need no edit. Only add a `canManageBilling` flag in `permissionsFrom` (`apps/web/src/features/memberships/lib/permissions.ts:63`).

### 4. Backend module `apps/backend/src/modules/billing/`

- `stripe.service.ts`: wraps the `stripe` npm package (`pnpm --filter @taskforge/backend add stripe`) and reads the keys lazily (503 when unset). Tests mock this one class instead of Stripe.
- `billing.controller.ts` / `billing.service.ts`:

| Route | Who | Does |
| --- | --- | --- |
| `GET /billing` | any member | plan, status, seats, renewal or end date, `cancelAtPeriodEnd`, and usage against the limits (members 4/5, custom roles allowed?) |
| `POST /billing/checkout` | `billing:manage` | creates or reuses the workspace's Stripe customer (`metadata.workspaceId`), then a Checkout Session (`mode: subscription`, Pro price, `quantity` = members, 14-day trial, success and cancel URLs under `/settings/billing`); returns `{ url }`. 409 if already Pro. |
| `POST /billing/portal` | `billing:manage` | creates a Customer Portal session; returns `{ url }` |
| `POST /billing/webhook` | public, signature-checked, not throttled (only the auth routes are) | handles `checkout.session.completed`, `customer.subscription.created/updated/deleted/paused/resumed` and `invoice.payment_failed`/`invoice.paid`: skip if `StripeEvent` already has the id, otherwise update `Subscription` for the workspace named in the subscription's metadata, recording the event id in the same transaction |

- **The webhook re-reads the subscription from Stripe** (`subscriptions.retrieve`) instead of trusting the event's copy. Stripe doesn't guarantee delivery order, so an old `updated` arriving after a `deleted` would otherwise resurrect a canceled plan. Since Stripe's 2025 API versions, the period end is on the subscription *item* (`items.data[0].current_period_end`), and an invoice names its subscription under `parent.subscription_details.subscription`.
- **A second subscription** for a workspace whose stored one is still live (`ACTIVE`/`TRIALING`/`PAST_DUE`) is canceled at once instead of stored.
- An event for a workspace that no longer exists is recorded and ignored.
- The webhook needs the **raw request body** to check Stripe's signature: `NestFactory.create(AppModule, { rawBody: true })` (`apps/backend/src/main.ts:7`) and `createNestApplication({ rawBody: true })` in `test/tenancy.e2e-spec.ts:108`, then read `req.rawBody` in the webhook handler.
- **Seat sync** (`BillingService.syncSeats(workspaceId)`): after a membership is created (`InvitationService.acceptInvitation`) or removed (`MembershipService.removeMember` :142, `leave` :217), if the workspace has a live Stripe subscription, set its item quantity to the member count, with proration. It runs after the database write; a failure is logged and doesn't undo the membership. Every webhook also stores Stripe's current quantity, so a missed update shows up. (Role changes and ownership transfer don't change the count.) `BillingModule` exports `BillingService`; the invitation and membership modules import it.
- **Workspace delete:** `WorkspaceService.delete` (:76) is a plain delete that cascades to `Subscription`. If the workspace has a live Stripe subscription, it first cancels it immediately; if Stripe refuses, the delete is a 502, and if the Stripe keys aren't set, a 503, so the owner isn't left paying.
- `GET /workspaces` (`getUserWorkspaces`, :41) adds each workspace's effective `plan` (`FREE`/`PRO`/`ENTERPRISE`) so the web can show which workspaces are Pro.

### 5. Web

- `apps/web/src/features/billing/`: types, api (`getBilling`, `startCheckout`, `openPortal`), hooks (`billingKeys.detail(workspaceId)`).
- **Settings → Billing** tab (add it to `SETTINGS_TABS` in `apps/web/src/features/settings/constants.ts`; page `app/(dashboard)/settings/billing/page.tsx`):
  - A current-plan card with usage bars (members 4/5) and the renewal or end date.
  - Free/Pro/Enterprise plan cards. **Upgrade** sends the browser to the checkout `url`; Enterprise is a "Contact us" mailto.
  - **Manage billing** opens the portal.
  - Banners for `PAST_DUE` and for "cancels on <date>".
  - People who can't manage billing see the plan and "Ask the workspace owner to upgrade".
  - Back from checkout (`?checkout=success`): "Activating Pro…", re-reading `GET /billing` every 2s for up to ~30s until the webhook lands.
- **Upgrade prompts:** a 402 `PLAN_LIMIT` from inviting, creating a role or creating a workspace shows a toast with an "Upgrade" link to `/settings/billing`. The invite button and "New role" show a hint when the limit is already reached (read from `GET /billing`).
- **Workspace limit:** `CreateWorkspaceButton` stops counting in the browser (`FREE_PLAN_WORKSPACE_LIMIT` in `apps/web/src/features/workspace/constants.ts` goes; the number comes from `FREE_OWNED_WORKSPACES` in `@taskforge/shared`). The form opens as usual; a 402 from the backend shows the upgrade prompt, linking to `/settings/billing`.
- A small **Pro** badge next to Pro workspaces in `components/layout/WorkspaceSwitcher.tsx` (`GET /workspaces` gains each workspace's `plan`).

### 6. Docs

`apps/backend/spec/billing-spec.md`, a billing section in both apps' `CLAUDE.md` files and the root `CLAUDE.md`, the new env vars in `.env.example`, and a status note in `docs/next-feature-2026-10-28.md` (item 6).

---

## Verification

- **Unit tests** (`pnpm test`, `StripeService` mocked): plan limits per plan and status, the 402 shape, `billing:manage` owner-only, checkout refused when already Pro, webhook: bad signature 400, a duplicate event applied once, status mapping, seat sync called on accept/remove/leave, and cancel-on-delete.
- **e2e** (`pnpm test:e2e`, no Stripe keys): a 6th invite on Free is a 402; Free can't create a custom role; a third owned Free workspace is a 402; marking the workspace PRO directly in the database lifts all three; `/billing/checkout` answers 503 without keys.
- **Manual, Stripe test mode:**
  - Run `stripe listen …` and `pnpm dev`, upgrade with card `4242 4242 4242 4242`, and check that the workspace turns Pro and the 6th invite works.
  - Add or remove a member and check the quantity in the Stripe dashboard.
  - Cancel in the portal and check it returns to Free at period end.
  - Use card `4000 0000 0000 0341` to see the past-due banner.
- `pnpm lint:check`, `pnpm typecheck`, `pnpm build`, and CI's migration diff.

## Known gaps (accepted for launch)

- **Two invitations sent at the same moment** to a Free workspace at 4/5 can both pass the check and end at 6/5. The count isn't locked; at worst a Free workspace ends one seat over, which only blocks its next invite.
- **Ownership transfer isn't checked against the 2-free-workspaces cap**, so someone can end up owning more than two Free workspaces by receiving them. The cap is about creating workspaces, not holding them.
- **Seat sync is best-effort.** If Stripe is unreachable when a member joins, the quantity catches up at the next sync (any later join or leave) and the next webhook stores what Stripe has.

## Open numbers (easy to change later; nothing else depends on them)

Free member limit **5**, free owned workspaces **2**, trial **14 days**, Pro price set in Stripe. Yearly billing, Enterprise self-serve and usage reminder emails are left for later.
