# Taskforge

Multi-tenant issue tracker — pnpm workspace monorepo.

| path            | what                                          |
| --------------- | --------------------------------------------- |
| `apps/web`      | Next.js 16 frontend (`:3000`)                 |
| `apps/backend`  | NestJS 11 + Prisma 7 API (`:5001/api/v1`)     |
| `packages/`     | shared packages (none yet)                    |

## Getting started

```bash
cp apps/backend/.env.example apps/backend/.env   # set DATABASE_URL, PORT=5001
cp apps/web/.env.example apps/web/.env.local     # note: Cloudinary keys need NEXT_PUBLIC_ prefix
pnpm install                                     # also runs prisma generate
pnpm db:migrate                                  # needs migrations: prisma/migrations is not in git yet
pnpm dev                                         # starts backend + web
```

Other root scripts: `pnpm dev:web`, `pnpm dev:backend`, `pnpm build`, `pnpm lint`, `pnpm db:generate`, `pnpm db:studio`.
