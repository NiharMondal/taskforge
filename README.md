# Taskforge

A multi-tenant issue tracker: workspaces, projects, a kanban board, sprints, and
role-based access per workspace. It is a pnpm workspace monorepo.

| path           | what                                                         |
| -------------- | ------------------------------------------------------------ |
| `apps/web`     | Next.js 16 frontend (React 19, HeroUI v3, React Query), `:3000` |
| `apps/backend` | NestJS 11 + Prisma 7 API on PostgreSQL, `:5001/api/v1`        |
| `packages/`    | shared packages (none yet)                                   |

## Requirements

- **Node 24** (pinned in `.nvmrc`; run `nvm use`).
- **pnpm 10** (pinned in `package.json`; `corepack enable` picks it up). Never use npm or yarn here.
- **PostgreSQL.** The included `docker compose up -d` starts one on port **5433** with two
  databases, `taskforge` (dev) and `taskforge_e2e` (tests). Any other Postgres works too.

## Getting started

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/web/.env.example apps/web/.env.local
docker compose up -d     # optional: local Postgres on :5433
pnpm install             # also runs prisma generate
pnpm db:migrate          # build the database from apps/backend/prisma/migrations
pnpm dev                 # backend :5001 + web :3000
```

`pnpm dev` first **kills whatever is listening on ports 3000, 5001 and 5002**, so stop anything
else you run there.

### Environment

The backend will not boot without these in `apps/backend/.env`:

- `DATABASE_URL`. With docker compose:
  `postgresql://taskforge:taskforge@localhost:5433/taskforge?schema=public`
- `JWT_ACCESS_SECRET` (e.g. `openssl rand -base64 48`)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (invitation emails)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (avatars)

The web app needs `AUTH_SECRET` in `apps/web/.env.local`, plus
`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and `NEXT_PUBLIC_CLOUDINARY_PRESET_NAME` for avatar uploads.

"Continue with Google" is optional. It needs the **same** `GOOGLE_CLIENT_ID` in both apps, and
`GOOGLE_CLIENT_SECRET` in the web app. Both `.env.example` files describe every variable.

## Scripts (run from the repo root)

| command                          | what it does                                                  |
| -------------------------------- | ------------------------------------------------------------- |
| `pnpm dev` / `dev:web` / `dev:backend` | run both apps, or one                                    |
| `pnpm build`                     | build both apps                                               |
| `pnpm lint` / `pnpm lint:check`  | lint both apps (`lint` fixes in the backend; `lint:check` doesn't) |
| `pnpm typecheck`                 | `tsc --noEmit` in both apps                                   |
| `pnpm test`                      | backend unit tests (mocked Prisma, no database)               |
| `pnpm test:e2e`                  | backend e2e tests against a real, migrated database           |
| `pnpm db:migrate`                | `prisma migrate dev`                                          |
| `pnpm db:generate` / `db:studio` | regenerate the Prisma client / open Prisma Studio             |

The e2e suite writes real rows, so it refuses any database whose name doesn't have `e2e` or
`test` as a word:

```bash
DATABASE_URL=postgresql://taskforge:taskforge@localhost:5433/taskforge_e2e?schema=public \
  pnpm --filter @taskforge/backend exec prisma migrate deploy
DATABASE_URL=postgresql://taskforge:taskforge@localhost:5433/taskforge_e2e?schema=public \
  pnpm test:e2e
```

The web app has no test runner; `pnpm typecheck` and `pnpm build` are its checks.

## CI

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`. It does a frozen
install, `lint:check`, `typecheck`, `build` and `test`. Then it runs `prisma migrate deploy`,
checks that the migrations match `schema.prisma`, and runs `test:e2e` against a Postgres service.

## Where to read next

- `CLAUDE.md` (root) covers how the two apps fit together: tenancy, the response envelope and
  board ranks. `apps/web/CLAUDE.md` and `apps/backend/CLAUDE.md` have the per-app detail.
- The contract is `apps/backend/prisma/schema.prisma` plus the controllers in
  `apps/backend/src/modules/`.
- Feature specs live in `apps/web/spec/` and `apps/backend/spec/`.
- `docs/` holds the roadmap and the latest gap audit.
