# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this directory is

Taskforge, a multi-tenant issue tracker, as a **pnpm-workspace monorepo** (git remote `NiharMondal/task-forge`):

| dir             | package              | stack                                                   |
| --------------- | -------------------- | ------------------------------------------------------- |
| `apps/web/`     | `@taskforge/web`     | Next.js 16 App Router, React 19, HeroUI v3, React Query |
| `apps/backend/` | `@taskforge/backend` | NestJS 11 + Express, Prisma 7, PostgreSQL               |
| `packages/`     | —                    | empty; home for future shared code (types, rank helper) |

One git history, one `pnpm-lock.yaml` at the root, one `pnpm install`. A change that spans both apps is one commit. Both apps' pre-merge histories were preserved (rewritten into their subfolders), so `git log -- apps/backend/...` and blame reach back to the original repos. The former backend repo (`NiharMondal/multi-tenant-backend`) no longer receives new work.

**Read the app-level `CLAUDE.md` before working in either app** — they carry the detail this file deliberately doesn't repeat:

- `apps/web/CLAUDE.md` (+ `apps/web/AGENTS.md`) — Next.js 16 caveats, feature structure, React Query conventions, forms, kanban board
- `apps/backend/CLAUDE.md` — auth guard chain, tenant isolation rules, `PrismaQueryBuilder`, response shape
- `apps/backend/src/modules/auth/CLAUDE.md` — module-level auth wiring

## Running the stack

Both apps must be up; the web app is useless alone.

```bash
pnpm install          # whole workspace; postinstall runs `prisma generate`
pnpm dev              # backend :5001 (prefix /api/v1) + web :3000, output prefixed per app
pnpm dev:backend      # or one at a time
pnpm dev:web
pnpm build | lint     # across both apps
pnpm db:migrate       # prisma migrate dev in apps/backend
pnpm --filter @taskforge/backend <script>   # any app script from the root
```

`pnpm` only, never npm/yarn. Add a dependency to one app with `pnpm --filter @taskforge/web add <pkg>` (or `pnpm add` from inside the app dir) — never at the root unless it is workspace tooling. pnpm settings (`allowBuilds`, etc.) live **only** in the root `pnpm-workspace.yaml`; pnpm ignores per-app copies.

Backend needs a reachable `DATABASE_URL` (`apps/backend/.env`); the web app reads `apps/web/.env.local`. `generated/` (Prisma client) is gitignored and rebuilt by `pnpm install` / `pnpm db:generate`. `prisma/migrations/` **is** committed: `pnpm db:migrate` builds a fresh database from it, and schema changes ship as a new migration folder in the same commit. Backend CORS is hardcoded in `apps/backend/src/main.ts` to `localhost:3000` / `:3001`.

Env-file traps in both `.env.example` files — the examples do not match what the code reads:

- `apps/backend/.env.example` says `PORT = 5000`, but `main.ts` defaults to **5001** and that is what the web app's `NEXT_PUBLIC_API_URL` points at.
- `apps/web/.env.example` lists `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_PRESET_NAME`, but `src/lib/cloudinary.ts` reads them **with** the `NEXT_PUBLIC_` prefix.

## The web/backend contract

The backend is the source of truth: `apps/backend/prisma/schema.prisma` for the data model, and the controllers in `apps/backend/src/modules/<name>/` for routes and payloads. Read them directly — they are in the same tree now.

`apps/web/.claude/` still holds hand-maintained copies from the two-repo era (`schema.prisma`, `BACK_END_API.md`). **They drift** — e.g. the schema copy lacks `User.avatarPublicId` — so treat them as convenience summaries, never as the contract. Types in `apps/web/src/features/*/types/` are hand-written to match the backend; when you change the backend schema or a route, update those types (and the copies, if kept) in the same commit.

`apps/web/.claude/migrations/*.md` are historical notes from when frontend work had to hand schema changes to the backend repo (e.g. `add-issue-rank.md`, already applied). New schema changes don't need an outbox: edit `apps/backend/prisma/schema.prisma`, run `pnpm db:migrate`, and change the web code in the same commit.

Feature specs live in `apps/web/spec/*.md` (committed) and `apps/backend/spec/*.md` (gitignored) and are the best statement of intended behavior — consult the relevant one before changing a feature. Never invent an API shape; if a contract is unclear, ask.

## Shared invariants

These hold on both sides of the wire — breaking one on either side breaks the other.

**Tenancy travels in a header, never in the token.** `Workspace` is the tenant root. The JWT identifies the *user* (`{ sub, email }`); the `x-workspace-id` header identifies the *tenant*. The frontend attaches it in the axios interceptor (`src/lib/axios.ts`, fed by `lib/active-workspace.ts`); the backend's `WorkspaceGuard` resolves it to a `Membership` row and 403s if absent. A user in workspace A must never see workspace B's rows — on the backend that means every workspace-scoped Prisma query filters on `workspaceId`; on the frontend it means every query key includes `workspaceId` (and `projectId` where relevant) so caches never leak across tenants.

**One response envelope.** Every controller returns `sendResponse()` — `{ success, statusCode, message, metaData?, data }` — and the frontend's `api` wrapper (`src/lib/axios.ts` / `src/types/api.ts`) unwraps `.data` before it reaches the cache. Errors are shaped by `HttpExceptionFilter` into `{ success: false, message, statusCode }` and normalized to `ApiError` on the client.

**Updates are always PATCH, never PUT.** Applies to every resource.

**Board order is a shared fractional index.** `Issue.rank` is a base-62 fractional-indexing key ordering cards within a `(project, status)` lane. Both apps generate keys with the `fractional-indexing` library, so they must stay compatible: the frontend computes the key on drop from the neighbors it renders and PATCHes `{ status, rank }`, and the backend stores it verbatim. The backend owns the key in the two cases the client can't: `POST` appends to the end of the lane, and a `PATCH` that changes `status` without sending a rank appends to the target lane. A rank the library can't build on is a 400. Rows predating the column are `NULL` and sort last — `pnpm run backfill:issue-rank` in `apps/backend/` (or `pnpm --filter @taskforge/backend run backfill:issue-rank`) fills them.

**Routes are `/api/v1/...`** and issues are project-scoped: `/projects/:projectId/issues`, `/projects/:projectId/sprints`. There is no workspace-wide issues endpoint (the frontend's `/issues` route just redirects to `/projects`).

**Cloudinary uploads are two-phase.** The browser uploads directly to a `temp/` folder with an unsigned preset and posts back `{ avatarUrl, avatarPublicId }`; the backend *promotes* the asset on successful save, or deletes it. `POST /cloudinary/delete-temp` handles abandoned uploads and refuses any publicId not under `/temp/`. The frontend never holds the API secret.

## Known gaps

- **`RolesGuard` is not usable for MEMBER/VIEWER gating.** It hardcodes an OWNER-or-ADMIN check before consulting `@Roles(...)`. Enforce finer-grained rules in the service layer instead.
- **`/users` is self-only.** There is no list or delete route; `GET`/`PATCH /users/me` (or `/users/<your own id>`) is all there is, and any other id is a 403. If you need other users' data, read it through a workspace-scoped route (memberships), not by widening `/users`.
- **No refresh tokens.** Access tokens last `1d`; on a backend 401 the frontend force-signs-out, because the Auth.js cookie can outlive the backend token. A missing token is also a 401.
- **Google sign-in needs `GOOGLE_CLIENT_ID` on both sides, with the same value.** The web app forwards Google's `id_token` and the backend verifies it against that client ID; unset on the backend, `POST /auth/google` answers 503.
- **Test coverage is backend-only.** `pnpm --filter @taskforge/backend test` runs Jest unit and HTTP specs (guards, issues, users, invitations, Google sign-in, sprints) against mocked Prisma — no database needed. `test:e2e` is still the stale Nest placeholder. The frontend has no test runner at all (type-check with `npx tsc --noEmit`).
