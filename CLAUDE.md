# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this directory is

Taskforge, a multi-tenant issue tracker, as a **pnpm-workspace monorepo** (git remote `NiharMondal/taskforge`):

| dir             | package              | stack                                                   |
| --------------- | -------------------- | ------------------------------------------------------- |
| `apps/web/`     | `@taskforge/web`     | Next.js 16 App Router, React 19, HeroUI v3, React Query |
| `apps/backend/` | `@taskforge/backend` | NestJS 11 + Express, Prisma 7, PostgreSQL               |
| `packages/shared/` | `@taskforge/shared` | TypeScript source both apps import (see below)         |

**`@taskforge/shared`** holds what the two apps must agree on: the schema's enums as string unions (`ISSUE_STATUS_VALUES`, `IssueStatus`, …), the permission catalog and built-in role defaults, the plans' limits and `effectivePlan`, `STATUS_TRANSITIONS`, the board-rank helpers (`rankBetween`, `isValidRank`, `ranksBetween` — the only place `fractional-indexing` is a dependency), the field limits both the DTOs and the forms enforce (`MAX_NAME_LENGTH`, `MAX_ISSUE_TITLE_LENGTH`, …) and the response envelope types (`ApiResponse`, `PaginationMeta`). Put something there when both apps need the same value or rule; keep UI labels in the web and Prisma/Nest code in the backend. It ships TypeScript source with no build step: Next compiles it (`transpilePackages`), the backend's webpack bundles it (`apps/backend/webpack.config.js` allowlists `@taskforge/*` from externals), and Jest/tsx load it as source — so it must stay plain TypeScript with no path aliases, valid under both apps' compiler settings. `apps/backend/src/common/shared-enums.spec.ts` fails if an enum list there drifts from `schema.prisma`.

One git history, one `pnpm-lock.yaml` at the root, one `pnpm install`. A change that spans both apps is one commit. Both apps' pre-merge histories were preserved (rewritten into their subfolders), so `git log -- apps/backend/...` and blame reach back to the original repos. The former backend repo (`NiharMondal/multi-tenant-backend`) no longer receives new work.

**Branching: `develop` is the default branch and the PR target; `main` only receives `develop`.** Cut feature branches from `develop` and open PRs into it; never PR a feature branch straight into `main`. To release, open a `develop → main` PR. After it merges, fast-forward `develop` to `main` (`git push origin origin/main:develop`) so the merge commit lands on both and the two branches stay identical.

**Read the app-level `CLAUDE.md` before working in either app** — they carry the detail this file deliberately doesn't repeat:

- `apps/web/CLAUDE.md` (+ `apps/web/AGENTS.md`) — Next.js 16 caveats, feature structure, React Query conventions, forms, kanban board
- `apps/backend/CLAUDE.md` — auth guard chain, tenant isolation rules, `PrismaQueryBuilder`, response shape
- `apps/backend/src/modules/auth/CLAUDE.md` — module-level auth wiring

## Running the stack

Both apps must be up; the web app is useless alone.

```bash
pnpm install          # whole workspace; postinstall runs `prisma generate`
pnpm dev              # backend :5001 (prefix /api/v1) + web :3000, output prefixed per app
                      # NOTE: first kills whatever listens on :3000, :5001 and :5002 (`predev` → `free-ports`)
pnpm dev:backend      # or one at a time
pnpm dev:web
pnpm build | lint     # across both apps (`lint` runs eslint --fix in the backend)
pnpm lint:check       # non-mutating lint, as CI runs it
pnpm typecheck        # tsc --noEmit in both apps
pnpm test             # backend unit tests (mocked Prisma, no DB)
pnpm test:e2e         # backend e2e over HTTP + a real Postgres (see below)
pnpm db:migrate       # prisma migrate dev in apps/backend
docker compose up -d  # optional local Postgres on :5433 (dbs `taskforge`, `taskforge_e2e`)
pnpm --filter @taskforge/backend <script>   # any app script from the root
```

`pnpm` only, never npm/yarn. Add a dependency to one app with `pnpm --filter @taskforge/web add <pkg>` (or `pnpm add` from inside the app dir) — never at the root unless it is workspace tooling. pnpm settings (`allowBuilds`, etc.) live **only** in the root `pnpm-workspace.yaml`; pnpm ignores per-app copies.

Backend needs a reachable `DATABASE_URL` (`apps/backend/.env`); the web app reads `apps/web/.env.local`. `generated/` (Prisma client) is gitignored and rebuilt by `pnpm install` / `pnpm db:generate`. `prisma/migrations/` **is** committed: `pnpm db:migrate` builds a fresh database from it, and schema changes ship as a new migration folder in the same commit. Backend CORS origins come from `CORS_ORIGINS` (comma-separated; unset = `localhost:3000` / `:3001`). Both `.env.example` files list what the code actually reads.

CI (`.github/workflows/ci.yml`) runs on every PR and push to `main`: frozen install, `lint:check`, `typecheck`, `build`, `test`, then `prisma migrate deploy`, a `prisma migrate diff --exit-code` check that the migrated database matches `schema.prisma` (a schema edit without its migration fails the build), and `test:e2e` against a Postgres service.

Node is pinned to 24 in `.nvmrc` (CI reads it) and `engines` in the root `package.json`. `fractional-indexing` is a dependency of `@taskforge/shared` only, so both apps generate board ranks with the same version.

## The web/backend contract

The backend is the source of truth: `apps/backend/prisma/schema.prisma` for the data model, and the controllers in `apps/backend/src/modules/<name>/` for routes and payloads. Read them directly — they are in the same tree now.

There are no copies of the contract to keep in sync (the two-repo era's `apps/web/.claude/schema.prisma` and `BACK_END_API.md` were deleted after they drifted). Types in `apps/web/src/features/*/types/` are hand-written to match the backend; when you change the backend schema or a route, update those types in the same commit.

`apps/web/.claude/migrations/*.md` are historical notes from when frontend work had to hand schema changes to the backend repo (e.g. `add-issue-rank.md`, already applied). New schema changes don't need an outbox: edit `apps/backend/prisma/schema.prisma`, run `pnpm db:migrate`, and change the web code in the same commit.

Feature specs live in `apps/web/spec/*.md` (committed) and `apps/backend/spec/*.md` (both committed) and are the best statement of intended behavior — consult the relevant one before changing a feature. Never invent an API shape; if a contract is unclear, ask.

## Shared invariants

These hold on both sides of the wire — breaking one on either side breaks the other.

**Tenancy travels in a header, never in the token.** `Workspace` is the tenant root. The JWT identifies the *user* (`{ sub, email }`); the `x-workspace-id` header identifies the *tenant*. The frontend pins each scoped request to the workspace its query key names (`inWorkspace(workspaceId)` in `src/lib/axios.ts`), falling back in the interceptor to the active one from `lib/active-workspace.ts`; the backend's `WorkspaceGuard` resolves it to a `Membership` row and 403s if absent. A user in workspace A must never see workspace B's rows — on the backend that means every workspace-scoped Prisma query filters on `workspaceId`; on the frontend it means every query key includes `workspaceId` (and `projectId` where relevant) so caches never leak across tenants.

**One response envelope.** Every controller returns `sendResponse()` — `{ success, statusCode, message, metaData?, data }` — and the frontend's `api` wrapper (`src/lib/axios.ts` / `src/types/api.ts`) unwraps `.data` before it reaches the cache. Errors are shaped by `HttpExceptionFilter` into `{ success: false, message, statusCode }` and normalized to `ApiError` on the client.

**Updates are always PATCH, never PUT.** Applies to every resource.

**Board order is a shared fractional index.** `Issue.rank` is a base-62 fractional-indexing key ordering cards within a `(project, status)` lane. Both apps generate keys through `@taskforge/shared`'s rank helpers (`fractional-indexing`), so they stay compatible: the frontend computes the key on drop from the neighbors it renders and PATCHes `{ status, rank }`, and the backend stores it as sent — unless a concurrent drop into the same gap already took that key, in which case it stores one just after it (every rank write holds a per-lane lock). The backend owns the key in the two cases the client can't: `POST` appends to the end of the lane, and a `PATCH` that changes `status` without sending a rank appends to the target lane. A rank the library can't build on is a 400. Rows predating the column are `NULL` and sort last — `pnpm run backfill:issue-rank` in `apps/backend/` (or `pnpm --filter @taskforge/backend run backfill:issue-rank`) fills them.

**Routes are `/api/v1/...`** and issues are project-scoped: `/projects/:projectId/issues`, `/projects/:projectId/sprints`. There is no workspace-wide issues endpoint (the frontend's `/issues` route just redirects to `/projects`).

**Billing is per workspace, and Stripe's webhook is the only thing that changes a plan.** The workspace's owner (`billing:manage`, owner-only) pays for Pro per member through Stripe Checkout; card details never touch either app. The browser is sent to Stripe-hosted pages and polls `GET /billing` on the way back; the backend writes `Subscription` only from the signed `POST /billing/webhook`. Plan limits (`PLAN_LIMITS` in `@taskforge/shared`) are enforced by the backend as **402 `{ code: "PLAN_LIMIT", limit }`** — distinct from a 403 — and the web turns that into an upgrade prompt. The Stripe keys are optional and read lazily, like `GOOGLE_CLIENT_ID`. Spec: `apps/backend/spec/billing-spec.md`; the reasoning: `docs/billing-plan-2026-10-29.md`.

**Cloudinary uploads are two-phase.** The browser uploads directly to a `temp/` folder with an unsigned preset and posts back `{ avatarUrl, avatarPublicId }`; the backend *promotes* the asset on successful save, or deletes it. `POST /cloudinary/delete-temp` handles abandoned uploads and only deletes from the caller's own temp folder (`taskforge/temp/<kind>/<userId>/…`), so neither a saved asset nor someone else's pending upload can be destroyed through it. The backend never takes `avatarUrl` from the client; it comes from the promoted asset. The frontend never holds the API secret.

## Known gaps

- **Roles are per-workspace rows with permission keys.** Every workspace has the four read-only built-ins (`Role.systemKey`) and any custom roles made in Settings → Roles (`/roles`, `role:manage`; `apps/backend/spec/role-spec.md`). The catalog is `packages/shared/src/permissions.ts`, used by both apps; the role editor's labels for it are in `apps/web/src/features/roles/constants.ts` — a new key needs one there. Members and invitations get a role by `roleId`; `Membership.role` / `Invitation.role` (the enum) are still written (MEMBER for a custom role) but nothing should read permissions from them. The web derives its permission flags from `GET /memberships/me`, so it keeps no copy of the role rules.
- **`/users` is self-only.** There is no list or delete route; `GET`/`PATCH /users/me` (or `/users/<your own id>`) is all there is, and any other id is a 403. If you need other users' data, read it through a workspace-scoped route (memberships), not by widening `/users`.
- **Short access tokens, rotating refresh tokens.** Access tokens last 15 minutes. The refresh token (30 days, replaced on every use, reuse after a 60-second grace revokes its whole family) lives only in the encrypted Auth.js JWT cookie; the `jwt` callback renews before expiry, and a 401 triggers one forced renewal and retry before the web app signs out (`apps/backend/spec/auth-spec.md`, `apps/web/spec/auth.md`).
- **Password sign-ups are confirmed by email.** `POST /auth/register` creates nothing and answers 202 for any address; the emailed `/verify-email` link creates the account. Accounts registered before this (unverified) can't sign in with their password until they register again.
- **Unknown body and query keys are a 400** (`forbidNonWhitelisted`, `VALIDATION_PIPE_OPTIONS` in `apps/backend/src/app.setup.ts`). Send only what the DTO declares — strip form-only fields such as `confirmPassword`.
- **Google sign-in needs `GOOGLE_CLIENT_ID` on both sides, with the same value.** The web app forwards Google's `id_token` and the backend verifies it against that client ID; unset on the backend, `POST /auth/google` answers 503.
- **Test coverage is backend-only.** `pnpm test` runs Jest unit and HTTP specs against mocked Prisma — no database needed. `pnpm test:e2e` boots the real app against Postgres and needs `DATABASE_URL` pointing at a migrated database whose name has `e2e` or `test` as a whole word, e.g. `taskforge_e2e` (it refuses anything else, including names like `latest`). The frontend has no test runner at all (type-check with `pnpm typecheck`).
