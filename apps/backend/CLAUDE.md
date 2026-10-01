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
pnpm run format # prettier over src and test
pnpm run test # Jest unit tests (rootDir=src, matches *.spec.ts)
pnpm run test:e2e # Supertest e2e (test/jest-e2e.json)
pnpm run test:cov # coverage
pnpm run studio # Prisma Studio

Single test file / single test:

pnpm run test -- src/app.controller.spec.ts
pnpm run test -- -t "substring of the it() name"

Prisma:

npx prisma generate # REQUIRED after clone/schema change — see "Generated client" below
npx prisma migrate dev --name "<migration-name>"

Server listens on `PORT` (default 5001) with global prefix `api/v1`, so routes are `/api/v1/...`.
CORS is hardcoded in `src/main.ts` to `http://localhost:3000` and `:3001` with credentials.

## Generated Prisma client — read this first

`prisma/schema.prisma` uses the new `prisma-client` generator with `output = "../generated/prisma"`.
Consequences:

- `generated/` is gitignored. A fresh clone will not compile until `npx prisma generate` runs.
- Import models/enums from the generated path, NOT from `@prisma/client`:
  - enums: `import { WorkspaceRole, IssueStatus } from "generated/prisma/enums"`
  - types: `import { User } from "generated/prisma/client"`
  - Note these are bare `generated/...` specifiers (resolved via `baseUrl: "."`), not `@/`-prefixed.
- `prisma/migrations/` is also gitignored, so migration history is local-only.
- The datasource block in `schema.prisma` has no `url`; the URL is supplied by `prisma.config.ts`
  (`DATABASE_URL`) for the CLI, and by `PrismaService` for runtime.
- `@/*` maps to `src/*` (tsconfig paths).

## Auth and request context — how a request is authorized

Three layers, applied in order. `src/modules/auth/CLAUDE.md` has module-level detail.

1. **`JwtAuthGuard` — global.** Registered once in `app.module.ts` via `APP_GUARD`. It applies to
   every route, so you do not need `@UseGuards(JwtAuthGuard)` (existing controllers still list it
   redundantly; harmless). Opt out with `@Public()` (used on `/auth/register`, `/auth/login`, `GET /`).
   It throws `ForbiddenException("Token not provided!")` when the `authorization` header is missing.
   `JwtStrategy.validate()` returns the payload unchanged, so `req.user` is `{ sub, email }`.
2. **`WorkspaceGuard` — opt-in per controller/route.** Resolves the tenant from the
   `x-workspace-id` header, falling back to `req.params.workspaceId`. Looks up the `Membership` row
   and 403s if absent. On success it sets `request.workspaceId` and `request.membershipRole`.
3. **`RolesGuard` — opt-in per route,** always combined with `@Roles(...)`. Must run after
   `WorkspaceGuard` because it reads `request.membershipRole`.

Parameter decorators (in `src/common/decorators/`): `@CurrentUser(): JwtPayload`,
`@WorkspaceId(): string` (throws if `WorkspaceGuard` did not run), `@MembershipRole(): WorkspaceRole`.

Token secret is `JWT_ACCESS_SECRET`, read via `ConfigService.getOrThrow` — never `process.env`
directly and never hardcoded. Access token expiry is `1d` (`auth.module.ts`). There is currently
**no refresh token implementation** despite leftover refresh-token migrations.

### RolesGuard gotcha

`RolesGuard` hardcodes a check that `membershipRole` is `OWNER` or `ADMIN` *before* consulting the
`@Roles(...)` list. So `@Roles(WorkspaceRole.MEMBER)` can never pass, and `@Roles()` with any
non-privileged role is effectively OWNER/ADMIN-only. If you need MEMBER- or VIEWER-level gating,
enforce it in the service (as `IssueService.update` does) rather than through `@Roles`.

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

`User` and `Workspace` are the only models without a `workspaceId`. Be aware that `UserController`
(`/api/v1/users`) is authenticated but otherwise ungated: `GET /users` returns every user in the
database across all tenants. Treat it as an unfinished admin surface — don't build on it and don't
copy its shape.

## API response shape

Controllers return `sendResponse()` from `src/common/utils/send-response.ts`:

```ts
{ success: true, statusCode: number, message: string, metaData?: IPaginationMeta, data: T }
```

Errors are shaped by the global `HttpExceptionFilter` (`src/lib/http-exception.filter.ts`), which
spreads Nest's exception response under `{ success: false, ... }` — so error bodies carry
`message` (and `statusCode`/`error` from Nest), not a top-level `error` string you set yourself.
The filter only `@Catch(HttpException)`; unhandled non-HTTP errors fall through to Nest's default 500.

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

Images are uploaded by the **frontend** directly to a temp folder (`taskforge/temp/<kind>`), which
posts back `{ url, publicId }`. The backend then either `promoteToPermanent(publicId)` (strips the
`/temp/` segment) on a successful DB save, or deletes the temp asset. `POST /cloudinary/delete-temp`
exists for abandoned uploads and refuses any publicId not under `/temp/`, so a saved asset cannot be
destroyed through it. `User` stores both `avatarUrl` and `avatarPublicId`.

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

## Tests

Only `src/app.controller.spec.ts` exists today; there is no meaningful test suite yet. Written
feature specs live in `spec/*.md` (gitignored, e.g. `issue-spec.md`, `invitation-spec.md`) and are
the best statement of intended behavior for issues and invitations.

## Environment

See `.env.example`. Required: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `NODE_ENV`, `PORT`,
SMTP vars (`SMTP_HOST/PORT/SECURE/USER/PASS`, `MAIL_FROM`) for invitation email, `APP_URL` for
invitation links, and `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET`. `PrismaService` logs queries when
`NODE_ENV === "development"`.

## When compacting

Preserve: current feature branch name, pending migrations, any multi-workspace isolation invariants
being worked on, last failing test name.
