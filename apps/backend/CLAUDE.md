# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Taskforge SaaS backend. NestJS 11 + Express, TypeScript. PostgreSQL via Prisma 7
(`@prisma/adapter-pg` driver adapter). Auth: passport + passport-jwt + @nestjs/jwt + @nestjs/passport.

Multi-tenant: `Workspace` is the tenant root. Almost every model carries a `workspaceId`, and
`Membership` (userId + workspaceId + role) is the RBAC join table.

## Commands

pnpm install
pnpm run dev # NestJS dev server, watch mode (there is NO `start:dev` script)
pnpm run start # run once, no watch
pnpm run build # nest build
pnpm run lint # eslint --fix over src, apps, libs, test
pnpm run lint:check # same, without --fix (what CI runs)
pnpm run format # prettier over src and test
pnpm run test # Jest unit tests (rootDir=src, matches *.spec.ts)
pnpm run test:e2e # Supertest e2e against a real Postgres (test/jest-e2e.json) — see Tests
pnpm run test:cov # coverage
pnpm run studio # Prisma Studio

Single test file / single test:

pnpm run test -- src/app.controller.spec.ts
pnpm run test -- -t "substring of the it() name"

Prisma:

pnpm exec prisma generate # REQUIRED after clone/schema change — see "Generated client" below
pnpm exec prisma migrate dev --name "<migration-name>"

Server listens on `PORT` (default 5001) with global prefix `api/v1`, so routes are `/api/v1/...`.
CORS allows the comma-separated `CORS_ORIGINS` (default `http://localhost:3000,http://localhost:3001`)
with credentials. The HTTP setup (helmet, CORS, filter, pipe, prefix) lives in `configureApp()`
(`src/app.setup.ts`), shared by `main.ts` and the e2e tests — add global app config there, not in `main.ts`.

## Generated Prisma client — read this first

`prisma/schema.prisma` uses the new `prisma-client` generator with `output = "../generated/prisma"`.
Consequences:

- `generated/` is gitignored. A fresh clone will not compile until `pnpm exec prisma generate` runs (`pnpm install` does it via the root `postinstall`).
- Import models/enums from the generated path, NOT from `@prisma/client`:
  - enums: `import { WorkspaceRole, StatusCategory } from "generated/prisma/enums"`
  - types: `import { User } from "generated/prisma/client"`
  - Note these are bare `generated/...` specifiers (resolved via the tsconfig `paths` entry `generated/*` → `./generated/*`; there is no `baseUrl`), not `@/`-prefixed.
- `prisma/migrations/` is committed. History starts at the `*_init` baseline (generated from the schema on 2026-10-01); earlier migrations were never tracked. Add schema changes with `pnpm exec prisma migrate dev --name <change>` and commit the new folder.
- The datasource block in `schema.prisma` has no `url`; the URL is supplied by `prisma.config.ts`
  (`DATABASE_URL`) for the CLI, and by `PrismaService` for runtime.
- `@/*` maps to `src/*` (tsconfig paths).

## Auth and request context — how a request is authorized

Three layers, applied in order. `src/modules/auth/CLAUDE.md` has module-level detail.

1. **`JwtAuthGuard` — global.** Registered once in `app.module.ts` via `APP_GUARD`. It applies to
   every route, so you do not need `@UseGuards(JwtAuthGuard)` (existing controllers still list it
   redundantly; harmless). Opt out with `@Public()` (used on every `/auth/*` route but
   `PATCH /auth/password` — `register`, `verify-email`, `login`, `google`, `refresh`, `logout` — plus
   `GET /invitations/validate`, `POST /billing/webhook`, `GET /health` and `GET /`).
   It throws `UnauthorizedException("Token not provided!")` (401) when the `authorization` header is missing.
   `JwtStrategy.validate()` returns the payload unchanged, so `req.user` is `{ sub, email }`.
2. **`WorkspaceGuard` — opt-in per controller/route.** Resolves the tenant from the
   `x-workspace-id` header, falling back to `req.params.workspaceId`; if both are present and differ
   it 403s (otherwise membership in A would authorize an action on B). Looks up the `Membership` row
   and its `Role` in one query, and 403s if absent. On success it sets `request.workspaceId` and
   `request.access` (`WorkspaceAccess`: `userId`, `roleId`, `systemKey`, `isOwner`, `permissions`).
3. **`@RequirePermission(...keys)` — per route.** Applies `PermissionsGuard`, which 403s unless the
   caller's role holds every key. It resolves the membership itself if `WorkspaceGuard` hasn't run,
   so order can't skip it; on a route that also has `@UseGuards(...)`, put `@RequirePermission`
   above it anyway (decorators apply bottom-up) to avoid a second lookup.

Parameter decorators (in `src/common/decorators/`): `@CurrentUser(): JwtPayload`,
`@WorkspaceId(): string` (throws if `WorkspaceGuard` did not run), `@Access(): WorkspaceAccess`.

Token secret is `JWT_ACCESS_SECRET`, read via `ConfigService.getOrThrow` — never `process.env`
directly and never hardcoded. Access tokens last 15 minutes (`ACCESS_TOKEN_TTL_SECONDS` in
`auth.constants.ts`). Every sign-in also returns an opaque refresh token (`RefreshTokenService`,
stored as a SHA-256 hash): `POST /auth/refresh` replaces it with the next one in its family, a
replaced token reused after 60 seconds revokes the family, and `POST /auth/logout` revokes it
(`spec/auth-spec.md`).

### Roles and permissions

Each workspace has `Role` rows (name + `permissions: String[]`); `Membership.roleId` /
`Invitation.roleId` point at one. The four built-ins carry a `systemKey` and are created by
`seedSystemRoles` (`src/modules/roles/system-roles.ts`) in every transaction that creates a
workspace. The permission catalog and the built-ins' defaults are in
`@taskforge/shared` (`packages/shared/src/permissions.ts`) — a new key needs a migration to reach existing Role rows
(as `comment_permissions` and `label_permissions` did), and the `add_workspace_roles` seed plus those grant migrations must
add up to `DEFAULT_ROLE_PERMISSIONS`.

- **OWNER holds every permission in code** (its stored list is ignored), including the
  owner-only `workspace:delete`, `workspace:transfer` and `billing:manage`, which no role can be granted. It can't be
  assigned, invited to or removed; the owner leaves the role only through
  `POST /memberships/transfer-ownership`, which swaps OWNER and ADMIN in one transaction (the
  step-down matches on still being the owner, so a racing transfer gets a 409). Any non-owner can
  leave with `DELETE /memberships/me`, except from their only workspace (`spec/membership-spec.md`).
- **Unknown stored keys are ignored**, and a membership with no `roleId` (written before roles)
  falls back to its enum's defaults.
- **Issue writes are field-level** (`src/common/permissions/issue-access.ts`): an allow-list maps
  each field to `issue:status` (`statusId`, `rank`) or the content permissions (`issue:edit:any`, or
  `issue:edit:own` when the *stored* issue's reporter or assignee is the caller). Fields missing from
  the map are refused. Moving into a `COMPLETED`-category status needs `issue:status:done`, on
  create too (`assertCanSetStatus`, called by the service once it has resolved the status).
- **No escalation:** `assertActorHolds` refuses handing out a role (role change, invitation) that
  holds a permission the actor doesn't. Changing or removing a member takes *strictly more* access
  (`assertActorOutranks`: every one of the target's permissions plus at least one more), so two
  Admins — or two holders of the same custom role — can't demote or remove each other; the OWNER,
  with the owner-only keys, outranks everyone. An Admin can still make someone an Admin.
- `GET /workspaces/:id` is open to any member (`WorkspaceGuard` only): it returns the same row
  `GET /workspaces` already lists. `PATCH` needs `workspace:manage`, `DELETE` `workspace:delete`.
- **Custom roles** (`src/modules/roles/`, `spec/role-spec.md`): `GET /roles` for any member;
  `role:manage` creates, edits and deletes custom roles. The built-ins are read-only (grant
  migrations extend them by `systemKey`), names are unique ignoring case, and a role still held by a
  member or a live invitation can't be deleted (409). Members and invitations get a role by
  `roleId` (or a built-in's `role`), resolved by `resolveAssignableRole` in `system-roles.ts`, which
  refuses the owner's.
- `Membership.role` / `Invitation.role` (enum) are still written next to `roleId` — the built-in's
  key, or MEMBER for a custom role; read permissions from `request.access`, never from the enum.

### Accounts and sign-in methods

`User.email` (unique) is the one email for a person. `Auth` holds one row per sign-in method,
`@@unique([userId, provider])`: an `EMAIL` row carries the bcrypt `password`, a `GOOGLE` row carries
Google's `sub` as `providerId` (`@@unique([provider, providerId])`). Registering creates **no**
user: it stores a `PendingRegistration` (name, email, password hash, hashed token) and emails a
link; `POST /auth/verify-email` then creates User + EMAIL auth + workspace + OWNER membership in one
transaction (`AuthService.createAccount`), and a first Google sign-in does the same with a GOOGLE
auth. Register answers 202 for any address — a taken one gets a "you already have an account" email
instead — so it doesn't reveal which emails are registered. The email column is on `User`, never on `Auth`. Password login starts from
the `EMAIL` `Auth` row, matched through its user's email (`auth.findFirst({ where: { provider:
EMAIL, user: { email } } })`), and answers every failure with the same 401 "Invalid email or
password" — after a bcrypt comparison against a dummy hash when nothing matched, so neither the
message nor the timing reveals whether an email is registered. The right password on an
unverified account (only ones registered before verification existed) is a 403; registering again
sends a link that replaces that password. A signed-in user changes their password with
`PATCH /auth/password` (`AuthService.changePassword`): wrong current password or no `EMAIL` row is
a 400 (never 401, which the web reads as a dead session), and success stores the new hash only if
the checked one is still there, revokes every refresh token in the same transaction, and emails the
owner. `GET /users/me` returns `hasPassword` (`UserService.findProfile`) so the web knows whether to
offer it.

### Google sign-in

`POST /auth/google` is `@Public()`, so it must never trust identity from the body. It accepts only
`{ idToken }`; `GoogleTokenVerifier` verifies it with `google-auth-library` (signature, expiry,
`audience = GOOGLE_CLIENT_ID`, `email_verified`) and `AuthService.googleSignIn` takes `sub`, `email`
and `picture` from the verified payload. Accounts match on Google's `sub` first, then link by
(case-insensitive) email. `User.emailVerifiedAt` records who has proven ownership (Google sign-ups
and verified registrations; every account that predates the column was backfilled as verified, so
only password accounts registered between that and email verification are null). Linking Google to
an account whose `emailVerifiedAt` is null deletes its `EMAIL` auth, sets the timestamp and revokes
its refresh tokens in one transaction — otherwise whoever pre-registered the address would keep
access to the owner's account. The auth routes are rate-limited by `@nestjs/throttler` (`AUTH_THROTTLE`:
10/min per client) — behind a reverse proxy, set Express `trust proxy` or every client shares one bucket.
`refresh` and `logout` are `@SkipThrottle()`: the web app calls them from its server for every
user. (So does `login`, through the Auth.js Credentials provider, which means today the whole web
app shares one login bucket.)

## Multi-workspace isolation — CRITICAL

Every Prisma query for a workspace-scoped model MUST filter on `workspaceId`. A user in Workspace A
must never see Workspace B's rows. Treat a missing filter as a data breach, on par with SQL injection.

The established pattern is: `WorkspaceGuard` puts the verified id on the request → the controller
pulls it with `@WorkspaceId()` → the controller **passes `workspaceId` as the first argument** to the
service method. Services take it as an explicit parameter (see `IssueService`, `MembershipService`,
`SprintService`). Do not read the tenant id from the body or query string.

Correlated writes must re-verify ownership rather than trusting ids from the client — see
`IssueService.validateProject` / `validateAssignee` / `validateSprint`, and note that `update` and
`remove` call `findOne(workspaceId, projectId, issueId)` first so the `prisma.*.update({ where: { id } })`
that follows is already proven to be in-tenant.

`User` and `Workspace` are the only models without a `workspaceId`. `UserController`
(`/api/v1/users`) therefore has no tenant scope to lean on, so it is strictly self-only: `GET`/`PATCH`
`/users/me` and `/users/:id` where `:id` must equal the JWT `sub` (anything else is 403). There is no
list and no delete route — don't add one without a tenant-scoped design.

## API response shape

Controllers return `sendResponse()` from `src/common/utils/send-response.ts`:

```ts
{ success: true, statusCode: number, message: string, metaData?: PaginationMeta, data: T }
```

Errors are shaped by the global `HttpExceptionFilter` (`src/lib/http-exception.filter.ts`), which
spreads Nest's exception response under `{ success: false, ... }` — so error bodies carry
`message` (and `statusCode`/`error` from Nest), not a top-level `error` string you set yourself.
The filter catches everything: Prisma's P2002 (unique) and P2003 (foreign key) become 409 and P2025
(record gone) 404; any other error is logged and answered with an enveloped 500 that never includes
the error's own message. Throw `HttpException`s for anything a client should see.

For an optional DTO field whose column is NOT NULL, use `@IsOptionalNonNull()`
(`src/common/decorators/`) instead of `@IsOptional()`, which lets `null` through to the database.
Keep `@IsOptional()` where the column is nullable and clients clear it with `null` (e.g. an issue's
`assigneeId`/`sprintId`, a sprint's `goal` and dates).

## Listing endpoints — PrismaQueryBuilder

`src/lib/PrismQueryBuilder.ts` (note the typo in the filename) is a chainable builder for paginated
list endpoints. Canonical use, from `IssueService.findAll`:

```ts
const qb = new PrismaQueryBuilder(query, { defaultField: "createdAt", defaultOrder: "desc", allowedFields: [...] })
  .withDefaultFilter({ workspaceId, projectId })  // tenant scope goes here
  .filter().search(["title", "description"]).paginate().sort().include({ ... });
const { data, metaData } = await qb.execute(this.prisma.issue);
```

`.execute()` runs `findMany` + `count` in parallel and returns `{ data, metaData }`; pass `metaData`
straight into `sendResponse`. Defaults: page 1, limit 10, maxLimit 100. The sort always ends with
`id` in the same direction, so rows tied on the sort field can't repeat or vanish across pages.

Besides issues, the projects, sprints, memberships, invitations and workspaces lists are paginated
this way; labels, roles, comments and activity still return everything. `GET /workspaces` is
scoped by `memberships: { some: { userId } }`, since `Workspace` has no `workspaceId`. Those five take only `PaginationQueryDto` (`src/common/dto/`: `page`,
`limit`, default 20, max 100) and never call `.filter()`; `QueryIssuesDto` extends it. Without
`?page`/`?limit` a list answers its first 20 rows — a client that needs the whole list must walk
`metaData.hasNextPage`, as the web does.

Two sharp edges: `.filter()` turns **every** unrecognized query param into a Prisma `where` clause
(reserved keys are only `search`, `page`, `limit`, `sort`), so list DTOs must be tight — the global
`ValidationPipe` has `whitelist: true` (and `forbidNonWhitelisted`, so an undeclared key is a 400),
which is what actually stops arbitrary column filtering.
And `.withDefaultFilter()` is the only thing scoping the query to a tenant, so never omit it.

## Conventions

- Controllers are thin: guards + decorators + service call + `sendResponse`. No business logic.
- DTOs use class-validator/class-transformer. Global `ValidationPipe(VALIDATION_PIPE_OPTIONS)`
  (`app.setup.ts`: `whitelist`, `forbidNonWhitelisted`, `transform`): a body or query key the DTO
  doesn't declare is a 400, not silently dropped. Controller specs build their pipe from the same
  options.
- Services throw Nest HTTP exceptions (`NotFoundException`, `ForbiddenException`, `ConflictException`).
- Prisma only, no raw SQL. Multi-step writes use `this.prisma.$transaction` (see `AuthService.verifyEmail`,
  which creates user + workspace + OWNER membership atomically through `createAccount`).
- New feature modules go in `src/modules/<name>/` as `<name>.module.ts`, `.controller.ts`, `.service.ts`, `dto/`.
  Cross-cutting pieces go in `src/common/` (`decorators/`, `guards/`, `strategies/`, `types/`, `utils/`).
- Read before editing: `src/common/decorators/`, `src/common/guards/`, `src/common/strategies/`, `prisma/schema.prisma`.

## Cloudinary upload lifecycle

Images are uploaded by the **frontend** directly to a per-user temp folder
(`taskforge/temp/<kind>/<userId>`), which posts back `{ url, publicId }`. The backend then either
`promoteToPermanent(publicId)` (renames it to a server-chosen id in the permanent folder, never
overwriting) on a successful DB save, or deletes the temp asset. `POST /cloudinary/delete-temp`
exists for abandoned uploads and only deletes from the caller's own temp folder, so neither a saved
asset nor another user's pending upload can be destroyed through it. `User` stores both
`avatarUrl` and `avatarPublicId`; `avatarUrl` is never taken from the client (it is the promoted
asset's URL, Google's picture, or `null` after `avatarPublicId: null` removes the avatar).

## Email

`src/modules/mail/`: an email is a builder returning `Email` (`{ subject, text, html }`, from
`email-layout.ts`) next to the module that sends it (`auth-emails.ts`, `invitation-emails.ts`),
rendered with `emailLayout()`. The layout escapes only the `url`; escape user-controlled text in
the HTML part yourself with `escapeHtml` (`src/helper`), and leave the subject and text part plain.
Send with `MailService.sendInBackground({ to, ...email })` — it doesn't await SMTP and logs a
failure — and build links with `appUrl(this.config, path)` from `src/helper`. Specs mock
`sendInBackground`.

## Health check

`GET /health` (`src/modules/health/`, `spec/health-spec.md`) is `@Public()` and unthrottled, for
hosting platforms and uptime monitors: it runs `SELECT 1` and answers 200 with
`{ status: "ok", db: "ok", uptime }`, or 503 when the database fails or takes longer than
`HEALTH_DB_TIMEOUT_MS` (3 s). The error is logged, never sent. `GET /` still says hello.

## Workflows

`src/modules/workflows/` serves `/projects/:projectId/workflow` (`spec/workflow-spec.md`). A
project's statuses are `WorkflowStatus` rows (name, hex color, `category`, a fractional `position`,
one `isDefault`) and its allowed moves are `WorkflowTransition` rows; `Issue.statusId` points at one
of its own project's statuses. **Never test a status by name** — read its `category`: completing
needs `issue:status:done`, `committedStatus` moves a `BACKLOG`-category issue joining a sprint to the
first `UNSTARTED` status (skipping the transition check), and `endSprint` releases everything not
`COMPLETED`. `ProjectService.create` seeds `DEFAULT_WORKFLOW_STATUSES` (`seedDefaultWorkflow`) or,
with `workflowFromProjectId` on Pro, copies another project's (`copyWorkflow`), in the project's
transaction. `WorkflowService` writes need `project:manage` and `assertCanCustomizeWorkflow` (402 on
Free; a workflow customized on Pro keeps working after a downgrade, read-only), hold a per-project
advisory lock (`workflow:<projectId>`), and refuse (409) leaving no `UNSTARTED` or `COMPLETED`
status or deleting the default. Deleting a status with issues requires `?moveTo=`; they are appended
to that lane under its lock, each with a history row. `Issue.status` is `onDelete: NoAction` (not
Restrict, so project and workspace cascades work). The `custom_workflows` migration gave every
existing project the eight statuses and moves it had.

## Issue board ordering

`Issue.rank` is a nullable fractional index (base-62 string) for ordering cards within a
`(project, statusId)` lane, backed by the `@@index([projectId, statusId, rank])`. Keys come from
`@taskforge/shared`'s `rankBetween`/`isValidRank` (`fractional-indexing`) — the same helpers the
frontend uses, so both sides generate compatible keys.

`IssueService` owns rank on writes:

- **create** ignores any client-supplied rank and appends: `appendRank()` reads the lane's current
  max rank (`lastRankInLane` in `issue-lane.ts`, filtering `rank: null`, because Postgres sorts NULLs
  *first* on `DESC`) and generates a key after it. The lane is `dto.statusId`, else the project's
  default status.
- **update** persists `dto.rank` as sent — the board computes it on drop from the neighbors the user
  actually sees, so it is authoritative — unless another issue in the target lane already holds that
  exact key (two people dropping into the same gap): `freeRank()` then stores a key between that
  issue and the next one. `validateRank` rejects a key the library can't build on with a 400 rather
  than storing junk that would break the next insert.
- **update without a rank but with a new status** (the frontend's fallback when it can't compute a
  key) appends to the *target* lane, so a card can't carry a stale rank from the lane it left.
- **Every rank write takes the lane's lock** (`inLockedLane` → `lockIssueLane`: `pg_advisory_xact_lock`
  on `issue-lane:<projectId>:<statusId>`, released at commit), so concurrent appends and drops into one
  lane queue and each sees the keys the others committed. A new rank write must go through it too.
- `rank` is *not* in `update`'s MEMBER-restricted field list: a member allowed to re-status an issue
  is allowed to position it.

`rank` is in `findAll`'s `allowedFields`, so `?sort=rank` works. The list default is still
`createdAt desc`; the board sorts client-side (un-ranked rows last).

Rows created before rank existed are `NULL`. `pnpm run backfill:issue-rank`
(`scripts/backfill-issue-rank.ts`) assigns spaced keys per lane in `createdAt` order — idempotent,
only touches `rank IS NULL`. Keep the column nullable until it's been run everywhere.

## Issue keys

Issues are shown as `<Project.key>-<Issue.number>` (e.g. `WA-12`). `Project.key` is derived from
the name on create by `deriveProjectKey` (`src/modules/projects/project-key.ts`: initials of up to 4
words, or the first 3 characters of one word; `2`, `3`, ... appended until unique in the workspace)
and is never changed afterwards. `Issue.number` comes from `Project.issueCounter`, incremented inside
the create transaction — the row lock on the project serializes concurrent creates, and
`@@unique([projectId, number])` backs it. The `project_keys_and_issue_numbers` migration backfilled
existing rows with the same key rule, so change both together.

## Sprint commitment

"Backlog" means *not in a sprint*. `committedStatus` in `IssueService` moves an issue in a
`BACKLOG`-category status to the project's first `UNSTARTED` status when it joins a sprint — on
create (including a sub-issue inheriting its parent's sprint) and on a PATCH that sets `sprintId`
without a `statusId` — because the web board shows the active sprint and has no backlog lanes. The
implied status goes through `assertCanUpdateIssue` like a sent one but not the transition check (a
workflow without that move mustn't block sprint planning), and appends to that lane. Leaving a sprint keeps the status.
The `sprint_issues_leave_backlog_status` migration converted existing rows (rank cleared).

## Sub-issues

`POST /projects/:projectId/issues` with `parentIssueId` creates a sub-issue. `validateParent`
requires the parent in the same workspace *and* project (else 403) and refuses a parent that is
itself a sub-issue (400) — nesting is one level deep. The child is typed `SUBTASK` and, without a
`sprintId`, takes the parent's sprint. `SUBTASK` comes only from this: the DTOs accept `type` as
`EPIC`/`STORY`/`TASK`/`BUG`, sending one with `parentIssueId` is a 400, and so is changing a
sub-issue's type. (`timeEstimate` holds story points, 0–100 or `null`, despite its name.) The parent can't be changed after create (`UpdateIssueDto` has
no `parentIssueId`). The list route embeds `parentIssue { id, number, title }`; the single-issue route
(`findDetail`, kept apart from the `findOne` that writes start with) also embeds `subIssues`.
Deleting a parent cascades to its sub-issues.

## Comments

`src/modules/comments/` serves `/projects/:projectId/issues/:issueId/comments` (`spec/comment-spec.md`).
`Comment` has no `workspaceId`, so every query reaches the tenant through its issue
(`issue: { workspaceId, projectId }`); a comment elsewhere is a 404. Posting and editing need
`comment:create`; only the author edits; deleting is the author (while they still hold
`comment:create`) or `comment:delete:any`. `content` is the editor's HTML, stored as sent, and must
have text once tags are stripped. The issue list embeds `_count.comments` for board cards.

## Labels

`src/modules/labels/` serves the workspace's labels at `/labels` (`spec/label-spec.md`): any member
lists them, `label:manage` creates, edits and deletes. Names are trimmed and unique per workspace
*ignoring case* (`assertNameFree`; the DB index alone is case-sensitive). Issues take `labelIds` on
create and update — a content field in `issue-access.ts`; `validateLabels` refuses one from another
workspace (403); on update the list replaces the set (`deleteMany` + `create`). Issue reads include
`LABELS_INCLUDE` and return `labels: [{ id, name, color }]` via `flattenLabels`, not the join rows.

## Issue history (AuditLog)

`src/modules/activity/` (`spec/activity-spec.md`). Issue history is `AuditLog` rows with
`entityType` "ISSUE" and `entityId` the issue; `GET /projects/:projectId/issues/:issueId/activity`
reads them for any member. They are written **in the same transaction as the change** with
`recordIssueActivity(tx, ...)`, never afterwards: `IssueService.create` records `issue.created`;
`update` diffs the stored issue against what was sent (`issueChanges`, a pure function) and, if
anything tracked changed, records one `issue.updated` row with `{ changes }` — so every `update`
path runs in a transaction now, and a rank-only reorder records nothing. `CommentService.remove`
records `comment.deleted` only when a moderator removes someone else's comment. The validators
(`validateAssignee`, `validateSprint`, `validateLabels`) return the `{ id, name }` they checked, and
those names are copied into the row so history survives renames and deletes. Adding a tracked field
means extending `IssueSnapshot`/`issueChanges` and the web's `describeChange` together.

## Billing and plan limits

`src/modules/billing/` (`spec/billing-spec.md`). The workspace is the customer; Pro is per seat
through Stripe Checkout and the Customer Portal. `GET /billing` is open to any member;
`POST /billing/checkout` and `/portal` need `billing:manage` (owner-only) and return a Stripe URL.
**The plan changes only through the webhook** (`POST /billing/webhook`, `@Public()`, signature
checked against `req.rawBody` — hence `rawBody: true` in `main.ts` and the e2e app). Each event id is
stored in `StripeEvent` in the same transaction it is applied, and the subscription is re-read from
Stripe rather than taken from the event, so duplicates and out-of-order delivery are harmless. Every
Stripe call goes through `StripeService` (mock it in tests, not the SDK).

The plan in force is `effectivePlan(subscription)` from `@taskforge/shared` (`plans.ts`, which also
holds `PLAN_LIMITS`, `FREE_OWNED_WORKSPACES`, `PRO_TRIAL_DAYS`); no row is FREE. Limits are checked
by the writing service through `src/common/plans/plan-limits.ts` and refused with a **402**
`{ code: "PLAN_LIMIT", limit }` (`PlanLimitException`) — `InvitationService.sendInvitation`
(members + live invitations; `assertCanAddMember` takes the `workspace-seats:<id>` advisory lock, so
call it in the transaction that writes the invitation), `RoleService.create` (custom roles),
`WorkflowService` and `ProjectService.create` with `workflowFromProjectId` (custom workflows),
`WorkspaceService.create` and `MembershipService.transferOwnership` of a Free workspace (owned Free
workspaces, the new owner's for a transfer). A new limit goes there, not in a guard. `BillingService.syncSeats` runs after a
membership is created or deleted (never throws); `WorkspaceService.delete` calls
`cancelForDeletion` first and is refused (502/503) if a billing subscription can't be canceled.

## Tests

`pnpm run test` runs Jest specs colocated with the code (`*.spec.ts`). They use a hand-rolled fake
`PrismaService` (and `supertest` against a Nest app with mocked services for HTTP-level checks), so
they need no database. Current coverage: `WorkspaceGuard`, `JwtAuthGuard`, `PermissionsGuard`, `IssueService`
permission rules and tenant isolation, `MembershipService` role changes/removal, `UserController`/`UserService`,
`InvitationService`/controller, register/verify/login/Google sign-in/refresh/change password (`AuthService`,
`RefreshTokenService`, `GoogleTokenVerifier`, throttling), `WorkspaceService`, `BillingService` (with `StripeService` mocked) and the plan limits, `SprintService.endSprint`, `CommentService`, `LabelService`, `ActivityService`, `RoleService` and the role DTOs, `WorkflowService`, `issueChanges`, the history rows `IssueService` writes, the health check, and the issue, comment and label DTOs.
`jest` maps `@/` and `generated/` in `package.json` and transforms the ESM-only `fractional-indexing` (a dependency of `@taskforge/shared`, which Jest loads as TypeScript source).

`pnpm run test:e2e` (`test/*.e2e-spec.ts`) boots the real `AppModule` through `configureApp()` and
drives it with supertest against Postgres: sign-up through the emailed link (read from the
mocked `MailService`), refresh-token rotation and sign-out, changing the password, unknown body keys, cross-workspace isolation, the header/path-param
check, invite → accept, MEMBER limits, comments (isolation, authorship, cascade on issue delete), labels (isolation, MEMBER limits, cascade on label delete), custom roles (create, assign by
`roleId`, enforcement, built-ins locked, delete refused while in use), workflows (the default, Free's 402s, moves along custom transitions, copying, deleting a status with issues), an issue's history, and
billing without Stripe (the three plan limits as 402s, Pro lifting them, checkout's 503, and a
webhook signed with Stripe's test helper — which proves the raw body reaches the check). `MailService` is overridden; other boot-time secrets get
placeholders in `test/setup-e2e.ts`, which also overrides the Stripe variables (placeholder key and
webhook secret, no price) so a developer's `.env` keys are never used. Rules:

- `DATABASE_URL` must point at a **migrated** database whose name has `e2e` or `test` as a whole word, e.g. `taskforge_e2e` (`latest` doesn't count)
  (`setup-e2e.ts` refuses anything else, so it can't touch a dev DB). Locally:
  `docker compose up -d` (repo root) then
  `DATABASE_URL=postgresql://taskforge:taskforge@localhost:5433/taskforge_e2e pnpm exec prisma migrate deploy`
  and the same `DATABASE_URL` for `pnpm run test:e2e`.
- Tests create uniquely-named users and delete their own rows in `afterAll`; never truncate.
- e2e compiles with `test/tsconfig.e2e.json` (`module: commonjs`): under `nodenext` the Prisma 7
  client's dynamic `import()` needs `--experimental-vm-modules`, which in turn breaks
  `fractional-indexing`.

Written feature specs live in `spec/*.md` (committed, e.g. `issue-spec.md`, `invitation-spec.md`)
and are the best statement of intended behavior for issues and invitations.

## Environment

See `.env.example`. What the code actually does with each:

- **Boot fails without** `DATABASE_URL`, `JWT_ACCESS_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
  `SMTP_PASS`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` (read with
  `getOrThrow` in constructors — which is why `test/setup-e2e.ts` gives them placeholders).
- **Optional, with defaults:** `PORT` (5001), `CORS_ORIGINS` (`localhost:3000`/`:3001`), `APP_URL`
  (`http://localhost:3000`, used in invitation and email-verification links), `MAIL_FROM` (falls back to `SMTP_USER`),
  `SMTP_SECURE` (`"true"`, or implied by port 465).
- `NODE_ENV` only switches `PrismaService` query logging on (`development`).
- `STRIPE_SECRET_KEY`, `STRIPE_PRO_PRICE_ID` and `STRIPE_WEBHOOK_SECRET` are read lazily by
  `StripeService`: the backend boots without them, the Free limits still apply, and checkout,
  portal and webhook answer 503.
- `GOOGLE_CLIENT_ID` is read lazily, only by Google sign-in (the backend boots without it;
  `POST /auth/google` then answers 503) and must match the web app's `GOOGLE_CLIENT_ID`.

## When compacting

Preserve: current feature branch name, pending migrations, any multi-workspace isolation invariants
being worked on, last failing test name.
