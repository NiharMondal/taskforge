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
  - enums: `import { WorkspaceRole, IssueStatus } from "generated/prisma/enums"`
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
   redundantly; harmless). Opt out with `@Public()` (used on `POST /auth/register`, `POST /auth/login`, `POST /auth/google`,
   `GET /invitations/validate` and `GET /`).
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
directly and never hardcoded. Access token expiry is `1d` (`auth.module.ts`). There is currently
**no refresh token implementation**.

### Roles and permissions

Each workspace has `Role` rows (name + `permissions: String[]`); `Membership.roleId` /
`Invitation.roleId` point at one. The four built-ins carry a `systemKey` and are created by
`seedSystemRoles` (`src/modules/roles/system-roles.ts`) in every transaction that creates a
workspace. The permission catalog and the built-ins' defaults are
`src/common/permissions/permissions.ts` — a new key needs a migration to reach existing Role rows,
and the `add_workspace_roles` migration's seed must match `DEFAULT_ROLE_PERMISSIONS`.

- **OWNER holds every permission in code** (its stored list is ignored), including
  `workspace:delete`, which no role can be granted. It can't be assigned, invited to or removed.
- **Unknown stored keys are ignored**, and a membership with no `roleId` (written before roles)
  falls back to its enum's defaults.
- **Issue writes are field-level** (`src/common/permissions/issue-access.ts`): an allow-list maps
  each field to `issue:status` (`status`, `rank`) or the content permissions (`issue:edit:any`, or
  `issue:edit:own` when the *stored* issue's reporter or assignee is the caller). Fields missing from
  the map are refused. DONE needs `issue:status:done`, on create too.
- **No escalation:** `assertActorHolds` refuses a role change, removal or invitation that involves
  a permission the actor doesn't hold.
- `Membership.role` / `Invitation.role` (enum) are still written next to `roleId` for older code and
  the web app; read permissions from `request.access`, never from the enum.

### Accounts and sign-in methods

`User.email` (unique) is the one email for a person. `Auth` holds one row per sign-in method,
`@@unique([userId, provider])`: an `EMAIL` row carries the bcrypt `password`, a `GOOGLE` row carries
Google's `sub` as `providerId` (`@@unique([provider, providerId])`). Registering creates User +
EMAIL auth + workspace + OWNER membership in one transaction; a first Google sign-in does the same
with a GOOGLE auth. The email column is on `User`, never on `Auth`. Password login starts from
the `EMAIL` `Auth` row, matched through its user's email (`auth.findFirst({ where: { provider:
EMAIL, user: { email } } })`), and answers every failure with the same 401 "Invalid email or
password" — after a bcrypt comparison against a dummy hash when nothing matched, so neither the
message nor the timing reveals whether an email is registered.

### Google sign-in

`POST /auth/google` is `@Public()`, so it must never trust identity from the body. It accepts only
`{ idToken }`; `GoogleTokenVerifier` verifies it with `google-auth-library` (signature, expiry,
`audience = GOOGLE_CLIENT_ID`, `email_verified`) and `AuthService.googleSignIn` takes `sub`, `email`
and `picture` from the verified payload. Accounts match on Google's `sub` first, then link by
(case-insensitive) email. Registration does not verify email, so `User.emailVerifiedAt` records
who has proven ownership (Google sign-ups; every account that predates the column was backfilled
as verified). Linking Google to an account whose `emailVerifiedAt` is null deletes its `EMAIL` auth
and sets the timestamp in one transaction — otherwise whoever pre-registered the address would
keep password access to the owner's account. The auth routes are rate-limited by `@nestjs/throttler` (`AUTH_THROTTLE`:
10/min per client) — behind a reverse proxy, set Express `trust proxy` or every client shares one bucket.

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
{ success: true, statusCode: number, message: string, metaData?: IPaginationMeta, data: T }
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
straight into `sendResponse`. Defaults: page 1, limit 10, maxLimit 100.

Two sharp edges: `.filter()` turns **every** unrecognized query param into a Prisma `where` clause
(reserved keys are only `search`, `page`, `limit`, `sort`), so list DTOs must be tight — the global
`ValidationPipe` has `whitelist: true`, which is what actually stops arbitrary column filtering.
And `.withDefaultFilter()` is the only thing scoping the query to a tenant, so never omit it.

## Conventions

- Controllers are thin: guards + decorators + service call + `sendResponse`. No business logic.
- DTOs use class-validator/class-transformer. Global `ValidationPipe({ whitelist: true, transform: true })`.
- Services throw Nest HTTP exceptions (`NotFoundException`, `ForbiddenException`, `ConflictException`).
- Prisma only, no raw SQL. Multi-step writes use `this.prisma.$transaction` (see `AuthService.register`,
  which creates user + workspace + OWNER membership atomically).
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

## Issue board ordering

`Issue.rank` is a nullable fractional index (base-62 string) for ordering cards within a
`(project, status)` lane, backed by the `@@index([projectId, status, rank])`. Keys come from
`fractional-indexing` — the same library the frontend uses, so both sides generate compatible keys.

`IssueService` owns rank on writes:

- **create** ignores any client-supplied rank and appends: `appendRank()` reads the lane's current
  max rank (filtering `rank: null`, because Postgres sorts NULLs *first* on `DESC`) and generates a
  key after it. The lane is `dto.status ?? BACKLOG`, mirroring the schema default.
- **update** persists `dto.rank` verbatim — the board computes it on drop from the neighbors the user
  actually sees, so it is authoritative. `validateRank` rejects a key the library can't build on with
  a 400 rather than storing junk that would break the next insert.
- **update without a rank but with a new status** (the frontend's fallback when it can't compute a
  key) appends to the *target* lane, so a card can't carry a stale rank from the lane it left.
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

"Backlog" means *not in a sprint*. `committedStatus` in `IssueService` moves a `BACKLOG`-status issue
to `TODO` when it joins a sprint — on create (including a sub-issue inheriting its parent's sprint)
and on a PATCH that sets `sprintId` without a `status` — because the web board shows the active
sprint and has no BACKLOG lane. The implied status goes through `assertCanUpdateIssue` and the
transition check like a sent one, and appends to the TODO lane. Leaving a sprint keeps the status.
The `sprint_issues_leave_backlog_status` migration converted existing rows (rank cleared).

## Sub-issues

`POST /projects/:projectId/issues` with `parentIssueId` creates a sub-issue. `validateParent`
requires the parent in the same workspace *and* project (else 403) and refuses a parent that is
itself a sub-issue (400) — nesting is one level deep. The child is typed `SUBTASK` and, without a
`sprintId`, takes the parent's sprint. The parent can't be changed after create (`UpdateIssueDto` has
no `parentIssueId`). The list route embeds `parentIssue { id, number, title }`; the single-issue route
(`findDetail`, kept apart from the `findOne` that writes start with) also embeds `subIssues`.
Deleting a parent cascades to its sub-issues.

## Tests

`pnpm run test` runs Jest specs colocated with the code (`*.spec.ts`). They use a hand-rolled fake
`PrismaService` (and `supertest` against a Nest app with mocked services for HTTP-level checks), so
they need no database. Current coverage: `WorkspaceGuard`, `JwtAuthGuard`, `PermissionsGuard`, `IssueService`
permission rules and tenant isolation, `MembershipService` role changes/removal, `UserController`/`UserService`,
`InvitationService`/controller, register/login/Google sign-in (`AuthService`, `GoogleTokenVerifier`,
throttling), `WorkspaceService` and `SprintService.endSprint`.
`jest` maps `@/` and `generated/` in `package.json` and transforms the ESM-only `fractional-indexing`.

`pnpm run test:e2e` (`test/*.e2e-spec.ts`) boots the real `AppModule` through `configureApp()` and
drives it with supertest against Postgres: sign-up, cross-workspace isolation, the header/path-param
check, invite → accept, and MEMBER limits. `MailService` is overridden; other boot-time secrets get
placeholders in `test/setup-e2e.ts`. Rules:

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
  (`http://localhost:3000`, used in invitation links), `MAIL_FROM` (falls back to `SMTP_USER`),
  `SMTP_SECURE` (`"true"`, or implied by port 465).
- `NODE_ENV` only switches `PrismaService` query logging on (`development`).
- `GOOGLE_CLIENT_ID` is read lazily, only by Google sign-in (the backend boots without it;
  `POST /auth/google` then answers 503) and must match the web app's `GOOGLE_CLIENT_ID`.

## When compacting

Preserve: current feature branch name, pending migrations, any multi-workspace isolation invariants
being worked on, last failing test name.
