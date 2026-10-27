# @taskforge/backend

The Taskforge API: NestJS 11 + Express, Prisma 7 and PostgreSQL. It serves `/api/v1` on
port 5001.

Run it from the repo root:

```bash
pnpm dev:backend
pnpm test         # unit tests, no database needed
pnpm test:e2e     # needs a migrated *_e2e database; see the root README
pnpm db:migrate   # prisma migrate dev
```

- Setup and environment: the root [README](../../README.md).
- Guards and tenant isolation, roles and permissions, `PrismaQueryBuilder`, the response shape and
  board ranks: [CLAUDE.md](CLAUDE.md).
- The data model is in [`prisma/schema.prisma`](prisma/schema.prisma); feature specs are in
  [`spec/`](spec/).
