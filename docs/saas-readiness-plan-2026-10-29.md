# SaaS readiness plan — 2026-10-29

Taskforge has what makes it a SaaS application: tenancy, roles, self-serve sign-up, per-member Stripe billing and plan limits. This plan covers what it still needs before you can run it as a business: account basics, public pages, operations, and a platform (super) admin.

The steps go from easiest to hardest. Each one is one PR from `develop` and leaves the app working. A step only depends on the steps listed in its **Depends on** line, so you can skip around within that.

| # | Step | Size | Depends on |
|---|------|------|------------|
| 1 | ✅ Shared email helpers (refactor) — done | S | — |
| 2 | ✅ Health check endpoint — done | S | — |
| 3 | ✅ Close the billing known gaps — done | S | — |
| 4 | ✅ Public pages: landing, pricing, terms, privacy — done | S–M | — |
| 5 | ✅ Change password — done | M | 1 |
| 6 | ✅ Forgot / reset password — done | M | 1 |
| 7 | Scheduled cleanup jobs | M | (6, for its table) |
| 8 | Email on issue assignment | M | 1 |
| 9 | Workspace audit log | M | — |
| 10 | Account deletion and data export | M–L | 1 |
| 11 | Platform admin: foundation + read-only console | L | — |
| 12 | Platform admin: actions (suspend, revoke, delete) | L | 10, 11 |
| 13 | Production and later | — | external choices |

## Every step is done when

- The backend specs (`apps/backend/spec/*.md`) and web specs (`apps/web/spec/*.md`) describe the new behaviour. Any new route is in its controller, and the hand-written web types in `apps/web/src/features/*/types/` match it.
- A schema change ships as a new folder in `apps/backend/prisma/migrations/` in the same commit. CI's `migrate diff` check fails otherwise.
- Every new body or query key is declared in a DTO, because unknown keys are a 400. Updates use PATCH. Every response goes through `sendResponse()`.
- Values both apps need (lengths, TTLs shown in the UI, permission keys) go in `packages/shared/src/`.
- `pnpm lint:check`, `pnpm typecheck` and `pnpm test` pass. Run `pnpm test:e2e` when the step touches auth, tenancy or the database schema.
- The "Known gaps" in the root `CLAUDE.md` are updated if the step closes or changes one.

---

## Step 1 — Shared email helpers (refactor, no behaviour change) ✅

**Status: done (2026-10-30, branch `shared-email-helpers-refactor-no-behaviour-change`, commit `a3f97ea`).** `emailLayout()` and the `Email` type are in `src/modules/mail/email-layout.ts`; `MailService.sendInBackground({ to, ...email })` takes the same shape as `sendMail`; `appUrl(config, path)` is a plain helper in `src/helper`. `AuthService`, `InvitationService` (builder in `invitation-emails.ts`) and `BillingService` use them. Unit tests, typecheck and lint pass; `pnpm test:e2e` still to run.

**Why.** Steps 5, 6, 8, 10 and 12 all send email. Today the helpers they need are private or copied in more than one place:

- `AuthService.appUrl()` and `AuthService.sendInBackground()` are private (`apps/backend/src/modules/auth/auth.service.ts:425`, `:434`).
- The email `layout()` is private to `apps/backend/src/modules/auth/auth-emails.ts:8`.
- `InvitationService.sendInvitationEmail` (`apps/backend/src/modules/invitations/invitation.service.ts:332`) builds its own HTML and works out the app URL again.

**Do.**
- Move `layout()` to `apps/backend/src/modules/mail/email-layout.ts` and export it. Its `body` is not escaped, so keep the rule that callers escape their own values with `escapeHtml` from `src/helper/index.ts`.
- Add `MailService.sendInBackground(to, email)`. It sends without awaiting and logs failures.
- Move `appUrl(path)` to `src/helper` or a small `AppUrlService` that reads `APP_URL`.
- Switch `AuthService` and `InvitationService` over to them. The invitation email now uses the shared layout.

**Tests.** The existing auth and invitation specs still pass. Add a unit test that `layout()` escapes the URL.

## Step 2 — Health check endpoint ✅

**Status: done (2026-10-30).** `GET /api/v1/health` lives in `src/modules/health/` (`spec/health-spec.md`). Besides the plan, the query has a 3-second timeout (`HEALTH_DB_TIMEOUT_MS`), because the pg pool otherwise waits indefinitely for a connection, and the 503 body carries `db: "down"` while the cause is only logged. Unit tests, typecheck and lint pass.

**Why.** Hosting platforms and uptime monitors need a URL that fails when the database is down. `GET /api/v1/` only returns `"Hello from NestJs!"` (`apps/backend/src/app.controller.ts:9`).

**Do.**
- Add `@Public() GET /health` that runs `SELECT 1` through `PrismaService`.
- Return `sendResponse` with `{ status: "ok", db: "ok", uptime }`. Return 503 when the query fails.
- Don't throttle it. You don't need `@nestjs/terminus` for a single check.
- Keep `GET /` as it is, or point it at the same handler.

**Tests.** A controller spec for both cases, with `$queryRaw` mocked to succeed and to throw.

## Step 3 — Close the billing known gaps ✅

**Status: done (2026-10-30).** `assertCanAddMember` now takes the `workspace-seats:<workspaceId>` advisory lock itself, so it must run in the transaction that writes the invitation (it does). Two changes from the plan: `assertCanOwnAnotherFreeWorkspace` takes an optional `transferredWorkspaceId`, so the check runs after the new owner's membership is confirmed (an outsider is still a 404) and has its own message; and `TransferOwnershipCard` was switched to `useErrorToast`, since it didn't use it yet. Unit tests, typecheck and lint pass; the new e2e race test still has to be run.

**Why.** `apps/backend/spec/billing-spec.md` ("Known gaps") lists two small holes.

**Do.**
- **The invitation race.** In `InvitationService.sendInvitation`, run `assertCanAddMember` and the invitation insert in one `$transaction` that first takes `pg_advisory_xact_lock` on the workspace. Copy the per-lane rank lock in `issue.service.ts`, keyed on the workspace id.
- **Ownership transfer vs. the Free cap.** In `MembershipService.transferOwnership` (`apps/backend/src/modules/memberships/membership.service.ts:171`), call `assertCanOwnAnotherFreeWorkspace(tx, newOwnerId)` (`src/common/plans/plan-limits.ts:100`) when the workspace's effective plan is Free. A refusal is the usual 402 `PLAN_LIMIT` with `limit: "ownedWorkspaces"`, so the web's `useErrorToast` already handles it.
- Remove both bullets from the spec's "Known gaps".

**Tests.**
- Unit: transfer to a user who already owns 2 Free workspaces returns 402.
- e2e: two parallel invitations at 4 of 5 seats give one 201 and one 402.

## Step 4 — Public pages: landing, pricing, terms, privacy ✅

**Status: done (2026-10-30).** `(marketing)` route group with landing, pricing, terms and privacy (`apps/web/spec/marketing.md`); the old `app/page.tsx` redirect is gone. `PlanCard` is now `features/billing/components/PlanCard.tsx` (`isCurrent` prop), and the Enterprise "Contact us" link is `ContactSalesLink`, shared by both pages. Beyond the plan: `PUBLIC_PREFIXES` now matches whole path segments (it used to make `/pricingx` public, and would have done the same for any future route sharing a prefix), and the sidebar's brand is a shared `BrandLink`. Terms and Privacy are still placeholder text. Typecheck, lint and `next build` pass; the public routes were smoke-tested on a production build.

**Why.** `/` redirects to `/dashboard` (`apps/web/src/app/page.tsx:7`). Stripe and Google OAuth review expect a public site with a privacy policy and terms.

**Do (web only).**
- Add a `(marketing)` route group with `page.tsx` (landing), `pricing/page.tsx`, `terms/page.tsx` and `privacy/page.tsx`.
- The landing page sends signed-in users to `/dashboard`. Check `auth()` in the server component.
- In `apps/web/src/lib/auth.config.ts`, add `/pricing`, `/terms` and `/privacy` to `PUBLIC_PREFIXES`. Allow `/` with an **exact** `pathname === "/"` check. Adding `"/"` as a prefix would make every route public.
- **Pricing.** Move `PlanCard` out of `features/billing/components/BillingSettings.tsx` (`:265`) into its own file. Make its `billing` prop optional (or pass `isCurrent`), and render it from `PLAN_META` (`features/billing/constants.ts`). The CTA on the public page links to `/register`.
- Link Terms and Privacy from the landing footer and the register form.
- Update the routing notes in `apps/web/CLAUDE.md`.

**Note.** The legal text is yours to write, or to take from a template service. Leave placeholders until then.

## Step 5 — Change password (signed in) ✅

**Status: done (2026-10-30, branch `implement-change-password-functionality`).** `PATCH /auth/password` (`AuthService.changePassword`) and the web's `ChangePasswordCard` under Settings → Profile. Beyond the plan:
- `GET /users/me` now returns `hasPassword` (`UserService.findProfile`), so a Google-only account sees a note, not a form it can't use.
- The new hash is written only if the checked one is still stored, so of two concurrent changes the second is a 400.
- A new password equal to the current one is a 400 (and refused by the form).
- The Google-only message is "This account signs in with Google, so it has no password to change." Point it at Forgot password once step 6 exists. The "password changed" email's footer says to reply to the email; step 6 should link to the reset flow instead.

Unit tests, typecheck and lint pass. An e2e test is added (`changing the password ends every session…`) but hasn't been run yet.

**Depends on:** 1.

**Backend.**
- Add `PATCH /auth/password` with body `{ currentPassword, newPassword }` (`MIN/MAX_PASSWORD_LENGTH` from `packages/shared/src/limits.ts`). It needs a JWT, so don't mark it `@Public()`, and keep it under the auth controller's `ThrottlerGuard`.
- Find the user's `EMAIL` `Auth` row and check `currentPassword` with bcrypt. A wrong password is a 400 with one generic message.
- If there's no `EMAIL` row (Google-only account), answer 400 "This account signs in with Google. Use Forgot password to set one." That route arrives in step 6.
- In one transaction, store the new hash and call `RefreshTokenService.revokeAllForUser(userId, tx)` (`apps/backend/src/modules/auth/refresh-token.service.ts:98`). This signs out every session.
- Send a "Your password was changed" email in the background.

**Web.**
- Add a "Change password" card under the profile card in `features/settings/components/ProfileSettings.tsx`.
- Reuse the password rules and confirm-password `.refine` from `features/auth/schemas/auth-schema.ts:25-42`. Remove `confirmPassword` from the request body.
- On success, `signOut` and go to `/login?passwordChanged=1`. The login form shows a notice for that.

**Tests.**
- Wrong current password.
- Google-only account.
- Success revokes the refresh tokens.

## Step 6 — Forgot / reset password ✅

**Status: done (2026-10-30, branch `implement-change-password-functionality`, on top of step 5).** `PasswordReset` model and migration `20261030120000_password_resets`, `POST /auth/forgot-password` and `/auth/reset-password`, and the web's `/forgot-password` and `/reset-password` pages. Beyond the plan:
- `PASSWORD_RESET_TTL_MINUTES` lives in `@taskforge/shared`, since the web's notice shows it; the per-account limit (3 per 15 minutes) stays in `auth.constants.ts`.
- **Not** added to `AUTH_ROUTES`: a signed-in Google-only user has to reach both pages to set a password. Settings → Profile's Google-only card now has "Email me a link", and step 5's Google-only message and "password changed" email point at Forgot password.
- A successful reset sends the "your password was changed" email too, and the reset page signs out (harmless without a session) before landing on `/login?passwordReset=1`.
- "Forgot password?" carries the email already typed on the login form.
- Known gap (in `spec/auth-spec.md`): an unknown address answers slightly faster than a registered one.

Unit tests, typecheck and lint pass, and the pages were checked in a browser against the dev servers. The e2e tests (reset once under a race, Google-only gets an EMAIL row) are written but not yet run.

**Depends on:** 1.

**Schema.** Add a `PasswordReset` model: `{ id, userId → User (Cascade), tokenHash @unique, expiresAt, createdAt, @@index([userId]) }`.

**Backend.** Copy the email verification flow (`auth.service.ts:97-201`).
- Constants go in `auth.constants.ts`: `PASSWORD_RESET_TTL_MINUTES = 60`, plus a per-email send limit shaped like `VERIFICATION_EMAILS_PER_WINDOW`.
- **`@Public() POST /auth/forgot-password { email }`** always answers **202**, so it never reveals whether an account exists.
  - Run `normalizeEmail` first.
  - Count the recent `PasswordReset` rows for that user. Over the limit, silently do nothing.
  - Otherwise `generateToken()`, store `hashToken(token)`, and email the link `appUrl("/reset-password?token=…")`.
  - An unknown email sends nothing.
- **`@Public() POST /auth/reset-password { token, password }`:**
  - Look up the row by `hashToken`. If it's missing or expired, answer 400.
  - In one transaction:
    - claim the row with `deleteMany({ id })` and `count === 1`;
    - upsert the `EMAIL` `Auth` row with the new hash. For a Google-only account this creates one, which is safe because they proved they own the address;
    - set `emailVerifiedAt` if it's null;
    - delete the user's other reset rows;
    - call `revokeAllForUser`.
  - Answer 200. Don't sign the user in automatically; send them to the login page.

**Web.**
- Add `app/(auth)/forgot-password/page.tsx`. Reuse `features/auth/components/check-email-notice.tsx` for the "check your email" state.
- Add `app/(auth)/reset-password/page.tsx`. The form sits inside `<Suspense>` because it calls `useSearchParams`.
- Add both paths to `PUBLIC_PREFIXES` and `AUTH_ROUTES` in `lib/auth.config.ts`.
- Add a "Forgot password?" link to `login-form.tsx`.
- Update `apps/web/spec/auth.md` and `apps/backend/spec/auth-spec.md`.

**Tests.**
- Unknown email returns 202 and sends nothing.
- Hitting the rate limit still returns 202.
- An expired or used token returns 400.
- Two concurrent resets with one token: only one succeeds.
- A Google-only account gets an `EMAIL` auth row.
- All refresh tokens are revoked.

## Step 7 — Scheduled cleanup jobs

**Depends on:** nothing. Include the `PasswordReset` task only once step 6 exists.

**Why.** Rows pile up forever, and nothing runs on a schedule today:
- expired `PendingRegistration` rows
- old `RefreshToken` rows
- `PENDING` invitations past their expiry
- `StripeEvent` rows

**Do.**
- `pnpm --filter @taskforge/backend add @nestjs/schedule`. Register `ScheduleModule.forRoot()` in `app.module.ts`.
- Add `src/modules/maintenance/cleanup.service.ts` with one daily `@Cron` (pick an off-hour, e.g. 03:17 UTC).
- Wrap the run in `pg_try_advisory_lock`, so that with several backend instances only one does the work.
- Each task runs in its own try/catch and logs how many rows it changed:
  - Delete `PendingRegistration` and `PasswordReset` rows that have expired.
  - Delete `RefreshToken` rows that expired, or were revoked or replaced, more than 30 days ago.
  - Set `PENDING` invitations past `expiresAt` to `EXPIRED`. The seat count already ignores them; this tidies the list.
  - Delete `StripeEvent` rows older than 90 days. Stripe stops retrying after 3 days.
- Optional: a `pnpm run cleanup` script, so you can run it once by hand.

**Tests.** A unit test with mocked Prisma checks each task's `where` clause, and that one failing task doesn't stop the others.

## Step 8 — Email on issue assignment

**Depends on:** 1.

**Schema.** Add `User.emailNotifications Boolean @default(true)`.

**Backend.**
- `PATCH /users/me` accepts `emailNotifications` (DTO), and `GET /users/me` returns it.
- `IssueService` (`apps/backend/src/modules/issues/issue.service.ts`) gets `MailService`. Import `MailModule` in the issues module.
- In both `create` (around `:98-160`) and `update`, after the transaction commits (around `:376-384`), send an email when all of these hold:
  - the assignee is new or changed (in `update`, `issueChanges` has a `field === "assignee"` entry);
  - the assignee is not the person making the change;
  - the assignee has `emailNotifications` on.
- Send it with `sendInBackground`. Put an `issueAssignedEmail` builder in the mail module. Escape the project and issue names, and link to the issue's page; check `app/(dashboard)/projects/[projectId]/list/[slug]` for the slug format.

**Web.** Add an "Email me when I'm assigned an issue" switch to the profile settings, using the existing `profileKeys` mutation.

**Tests.**
- Self-assigning sends nothing.
- With the setting off, nothing is sent.
- A mail failure doesn't fail the request.

## Step 9 — Workspace audit log

**Why.** `AuditLog` is only written for issue activity (`apps/backend/src/modules/activity/issue-activity.ts`). Owners can't see who removed a member, changed a role or changed the plan.

**Backend.**
- Add `recordWorkspaceEvent(tx, { workspaceId, userId, action, entityType, entityId, metadata })` in `src/modules/activity/workspace-activity.ts`, mirroring `recordIssueActivity` (`issue-activity.ts:108`). Always call it with the same transaction client as the change.
- Actions, in the same dotted style as the issue ones:
  - `member.role_changed`, `member.removed`, `member.left`
  - `invitation.sent`, `invitation.revoked`, `invitation.accepted`
  - `role.created`, `role.updated`, `role.deleted`
  - `workspace.updated`, `ownership.transferred`
  - `billing.subscription_changed`, written from the webhook with `userId: null`
- Add a new permission `audit:read`:
  - Put it in `packages/shared/src/permissions.ts` and in the built-in Admin defaults.
  - Add its label to `apps/web/src/features/roles/constants.ts`.
  - Write a data-only migration that grants it to existing ADMIN roles, copying `prisma/migrations/20261028170000_comment_permissions/migration.sql`.
- Add `GET /audit-log?entityType=&page=&limit=` with `@RequirePermission("audit:read")`. It is workspace-scoped, paginated with `PrismaQueryBuilder`, excludes the `ISSUE` entity, and includes the actor's name.

**Web.**
- Add an "Audit log" tab to `SETTINGS_TABS` (`features/settings/constants.ts:23`). Show it only when `useWorkspacePermissions` grants `audit:read`.
- Add an `auditKeys` factory that includes `workspaceId`.
- Show a paginated table of time, actor, action and a readable summary.

**Tests.**
- Each listed action writes exactly one row inside its transaction.
- A user without `audit:read` gets a 403.
- Rows from another workspace are never returned.

## Step 10 — Account deletion and data export

**Depends on:** 1.

**Why.** Users must be able to leave, and privacy laws (GDPR) expect it. Today `/users` has no delete route.

**Schema (do this first; it's the risky part).**
- `Issue.reporter` is `onDelete: Cascade` (`schema.prisma:328`). Deleting a user would therefore **delete every issue they reported in shared workspaces**, and their sub-issues with them.
- Change `Issue.reporterId` to `String?` with `onDelete: SetNull`.
- Do the same for `Comment.userId` (`:363`), so conversations stay.
- Update the web types and UI so a missing reporter or author shows as "Deleted user".

**Backend.** Add `DELETE /users/me`.
- **Body:** `{ password }` for accounts with an `EMAIL` auth row, otherwise `{ confirmEmail }`. Check that `api.delete` in `apps/web/src/lib/axios.ts` passes a request body.
- **Workspaces they own:**
  - If any has other members, answer 409 and list those workspaces: "Transfer ownership (Settings → General) or delete them first."
  - Delete the ones where they are the only member, through the same steps as `WorkspaceService.delete` (`workspace.service.ts:101`), including `billing.cancelForDeletion`.
- Then:
  - delete their Cloudinary avatar;
  - delete the `User`, which cascades to memberships, auths and refresh tokens;
  - send a confirmation email;
  - after the commit, call `billing.syncSeats` for each workspace they left.
- **Export:** add `GET /users/me/export`, which returns JSON with their profile, memberships (workspace names), issues they reported or are assigned, and their comments. Throttle it.

**Web.**
- In profile settings, add a "Delete account" danger card modelled on `DeleteWorkspaceCard.tsx`: `ConfirmModal` with `typeToConfirm`, plus the password field. After deleting, call `signOut`.
- Add a "Download my data" button.

**Tests.**
- Shared issues and comments survive, with a null reporter or author.
- Owning a workspace that has other members gives 409.
- The user's solo workspace is deleted and its subscription canceled.
- A wrong password gives 400.
- Seats are synced afterwards.
- e2e for the full flow.

## Step 11 — Platform admin: foundation and read-only console

**Why.** Today you can only manage the product through the Stripe dashboard and Prisma Studio. Prisma Studio is risky and records nothing.

**Rules.**
- **The admin role lives in the database, not in the JWT.** The token keeps identifying only the user, like workspaces today. It is checked on every admin request.
- **Admin routes are the one deliberate cross-tenant exception.** Keep them in their own module, `src/modules/admin/`, with a comment at the top saying so. No `x-workspace-id`, no `WorkspaceGuard`.
- **Nobody becomes an admin through the API.** Only the script below grants the role.

**Schema.**
- `enum PlatformRole { ADMIN SUPPORT }` and `User.platformRole PlatformRole?`. SUPPORT is read-only.
- A `PlatformAuditLog` model `{ id, actorId → User (SetNull), action, targetType, targetId, metadata Json?, createdAt }`. The existing `AuditLog` requires a `workspaceId`, so it can't hold these.

**Backend.**
- Add `scripts/set-platform-role.ts <email> <ADMIN|SUPPORT|none>`, modelled on `scripts/backfill-issue-rank.ts`, with a `package.json` script `set-platform-role`.
- Add a `PlatformRoleGuard` and a `@RequirePlatformRole("ADMIN" | "SUPPORT")` decorator. The guard loads `platformRole` from the database for `req.user.sub` and answers 403 when it's missing.
- `GET /users/me` adds `platformRole`.
- **Read-only routes:**
  - `GET /admin/stats`: users (total, new in the last 7 and 30 days), workspaces by effective plan (`effectivePlan` from `@taskforge/shared`), and subscriptions by status.
  - `GET /admin/workspaces?search=&plan=&page=`: owner, member count, plan, status, seats, created.
  - `GET /admin/workspaces/:id`: members, projects and issue counts, subscription with Stripe ids.
  - `GET /admin/users?search=&page=` and `GET /admin/users/:id`: memberships, auth providers, verified, created. Never return password hashes or tokens.

**Web.**
- Add an `app/(admin)/admin/` route group with its own server `layout.tsx`. Don't put it under `(dashboard)`, which wraps everything in `WorkspaceProvider`.
  - The layout calls `auth()`, fetches `/users/me` with the session's access token, and calls `notFound()` for users without a platform role. The backend guard is still the real check.
- Pages:
  - overview (stats)
  - workspaces list and detail
  - users list and detail
- Workspace detail links to the Stripe customer (`https://dashboard.stripe.com/[test/]customers/<id>`).
- Show an "Admin" link in the sidebar only when `platformRole` is set.
- Add `features/admin/` (api, hooks with an `adminKeys` factory, types). Its keys don't include a workspace id, because the data is platform-wide.

**Tests.**
- A non-admin gets 403 on every `/admin` route.
- SUPPORT can read.
- Responses never contain secrets.
- The script sets and clears the role.

## Step 12 — Platform admin: actions

**Depends on:** 10 (deletion logic) and 11.

**Schema.** Add `User.suspendedAt DateTime?`, `User.suspendedReason String?` and the same two fields on `Workspace`.

**Enforcement.**
- **Suspended user:**
  - `login`, `google`, `refresh` and `verify-email` answer 403 with `code: "ACCOUNT_SUSPENDED"`.
  - Suspending calls `revokeAllForUser`. The current access token can still be used until it expires, at most 15 minutes. This plan accepts that delay; the alternative is a database lookup in `JwtStrategy` (`src/common/strategies/jwt.strategy.ts:21`) on every request.
- **Suspended workspace:**
  - `resolveWorkspaceAccess` (`src/common/permissions/workspace-access.ts:72`) answers 403 with `code: "WORKSPACE_SUSPENDED"`. Include the workspace in its membership query.
  - `GET /workspaces` still lists it, with a flag, so the web can explain why.
  - Suspending doesn't touch Stripe. If billing should stop, do that in Stripe.

**Routes.** All require ADMIN; SUPPORT is refused. Each one writes a `PlatformAuditLog` row in the same transaction.
- `PATCH /admin/users/:id { suspended, reason }` and `PATCH /admin/workspaces/:id { suspended, reason }`. Updates stay PATCH.
- `POST /admin/users/:id/revoke-sessions`.
- `DELETE /admin/users/:id`: reuses step 10's service. An admin may also delete sole-owner workspaces, but the "other members" rule still applies.
- `DELETE /admin/workspaces/:id`: reuses `WorkspaceService.delete`, so the Stripe subscription is canceled first.
- `GET /admin/audit-log`.
- **Guardrails:** an admin can't suspend or delete themselves or another ADMIN.
- **Free or discounted plans** are done in Stripe (a 100% coupon or a longer trial), not by writing to `Subscription`. That keeps the rule that only the Stripe webhook changes a plan.

**Web.**
- Action buttons on the admin detail pages, each with a `ConfirmModal` and a reason field.
- The login form shows a clear message for `ACCOUNT_SUSPENDED`.
- `WORKSPACE_SUSPENDED` shows a banner in the dashboard and offers to switch workspace.

**Tests.**
- A suspended user can't log in or refresh.
- A suspended workspace answers 403 on every scoped route.
- Self and other-admin actions are refused.
- Each action writes one platform audit row.
- e2e: suspend, then unsuspend.

## Step 13 — Production and later (needs your external choices)

- **Deployment.**
  - A production `Dockerfile` for the backend, or a buildpack, that runs `prisma migrate deploy` on release.
  - The web on Vercel or the same host.
  - Set `APP_URL`, `CORS_ORIGINS`, `STRIPE_*`, `SMTP_*`, `CLOUDINARY_*` and `GOOGLE_CLIENT_ID`.
  - Register the production Stripe webhook.
- **Monitoring.** Sentry (or similar) in both apps. An uptime monitor on `/api/v1/health` (step 2).
- **Frontend tests.** A Playwright smoke test of register → verify → create workspace → upgrade in Stripe test mode.
- **Admin hardening.** TOTP two-factor sign-in for platform admins. "Log in as this user" is deliberately left out; if you add it, make it read-only and record it in the platform audit log.
- **Billing extras** already marked "later" in `billing-spec.md`: yearly billing, self-serve Enterprise, and limit reminder emails.
