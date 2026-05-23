# CLAUDE.md

## Project overview

Taskforge SaaS backend. NestJS 10 + Express, TypeScript strict mode.
PostgreSQL via Prisma ORM. Auth: passport + passport-jwt + @nestjs/jwt + @nestjs/passport.

## Commands

pnpm run start:dev # NestJS dev server with hot reload
pnpm run test # Jest unit tests
pnpm run test:e2e # Supertest e2e tests
pnpm run build # Production build
npx prisma migrate dev --name "<migration-name>" # Run DB migrations
npx prisma studio # Open Prisma Studio

## Auth stack — critical rules

- JWT is signed with JWT_SECRET from ConfigService, NEVER hardcoded
- Access tokens expire in 15m, refresh tokens in 7d
- JwtStrategy.validate() returns { sub, email, workspaceId, roles } — this becomes req.user
- NEVER trust workspaceId from request body or query params — always read from req.user.workspaceId
- All protected routes use @UseGuards(JwtAuthGuard) — no exceptions

## Multi-workspace rules — CRITICAL

- Every Prisma query in a service MUST include WHERE workspaceId = user.workspaceId
- Use WorkspaceGuard to inject workspace context — never pass workspaceId as a function param
- Row-level isolation: a user from Workspace A must NEVER see Workspace B's data
- When writing new service methods, always add a workspaceId filter. Failing to do so is a
  data breach — treat it with the same severity as a SQL injection.

## API response shape

Always return: { success: boolean, data: T | null, error: string | null }
Use GlobalExceptionFilter for consistent error responses.

## Conventions

- DTOs validated with class-validator + class-transformer (use ValidationPipe globally)
- Services are injectable, controllers are thin (no business logic)
- Decorators go in src/auth/decorators/ or src/common/decorators/
- No raw SQL — Prisma only. Exceptions require a DECISIONS.md entry.

## When compacting

Preserve: current feature branch name, pending migrations, any multi-workspace isolation
invariants being worked on, last failing test name.

## References

@prisma/schema.prisma — prisma schema, critical for understanding database structure
@src/auth/CLAUDE.md — read before touching anything in src/auth/
@src/workspace/CLAUDE.md — read before any service that queries the DB
@docs/DECISIONS.md — architectural decision log

## Installation

Use pnpm as package manager.
pnpm add <package_name>
npx prisma generate
npx prisma migrate dev
