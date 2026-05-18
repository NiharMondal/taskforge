# CLAUDE.md

## Project overview
Multi-tenant SaaS backend. NestJS 10 + Express, TypeScript strict mode.
PostgreSQL via Prisma ORM. Auth: passport + passport-jwt + @nestjs/jwt + @nestjs/passport.

## Commands
npm run start:dev      # NestJS dev server with hot reload
npm run test           # Jest unit tests
npm run test:e2e       # Supertest e2e tests
npm run build          # Production build
npx prisma migrate dev # Run DB migrations
npx prisma studio      # Open Prisma Studio

## Auth stack — critical rules
- JWT is signed with JWT_SECRET from ConfigService, NEVER hardcoded
- Access tokens expire in 15m, refresh tokens in 7d
- JwtStrategy.validate() returns { sub, email, tenantId, roles } — this becomes req.user
- NEVER trust tenantId from request body or query params — always read from req.user.tenantId
- All protected routes use @UseGuards(JwtAuthGuard) — no exceptions

## Multi-tenant rules — CRITICAL
- Every Prisma query in a service MUST include WHERE tenantId = user.tenantId
- Use TenantInterceptor to inject tenant context — never pass tenantId as a function param
- Row-level isolation: a user from tenant A must NEVER see tenant B's data
- When writing new service methods, always add a tenantId filter. Failing to do so is a
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
Preserve: current feature branch name, pending migrations, any tenant isolation
invariants being worked on, last failing test name.

## References
@src/auth/CLAUDE.md         — read before touching anything in src/auth/
@src/tenants/CLAUDE.md      — read before any service that queries the DB
@docs/DECISIONS.md          — architectural decision log

## Installation
npm install
npx prisma generate
npx prisma migrate dev