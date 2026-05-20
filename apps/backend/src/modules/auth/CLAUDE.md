# Auth module rules

## File locations
Auth constructs live outside this module:
- Guards: `src/common/guards/` (jwt-auth.guard.ts, workspace.guard.ts, roles.guard.ts)
- Strategy: `src/common/strategies/jwt.strategy.ts`
- Decorators: `src/common/decorators/` (public, roles, current-user, workspaceId)
- Types: `src/common/types/authenticated-request.interface.ts`

## Strategy wiring
JwtStrategy is registered as a provider in AuthModule.
Reads secretOrKey from `ConfigService.getOrThrow<string>("JWT_ACCESS_SECRET")` — never process.env directly.

## Guard usage
JwtAuthGuard and RolesGuard are registered globally via APP_GUARD in app.module.ts — no need to apply them per-controller.

- `@Public()`                                → skips JwtAuthGuard (e.g. /auth/login, /auth/register)
- `@UseGuards(JwtAuthGuard, WorkspaceGuard)` → JWT + workspace membership check (used in workspace-scoped controllers)
- `@Roles(WorkspaceRole.ADMIN)`              → declares intent only; enforcement is in the service layer (RolesGuard always defers to services)

## WorkspaceGuard
Reads `x-workspace-id` header, looks up Membership row in DB, then injects:
- `request.workspaceId` (string)
- `request.membershipRole` (WorkspaceRole)

Throws ForbiddenException if the user has no membership for that workspace.

## Parameter decorators
- `@CurrentUser(): JwtPayload` → injects request.user (requires JwtAuthGuard)
- `@WorkspaceId(): string`     → injects request.workspaceId (requires WorkspaceGuard to run first)

## Token payload shape
```
JwtPayload = { sub: string, email: string }
```
workspaceId is NOT in the JWT. Workspace context is request-scoped via the x-workspace-id header + WorkspaceGuard DB lookup.
Token expiry: 1d (configured in auth.module.ts JwtModule.registerAsync).

## What NOT to do
- Never call JwtService.sign() outside AuthService
- Never trust workspaceId from request body or query params — always read from request.workspaceId (injected by WorkspaceGuard)
- Never add workspaceId to a JWT claim from client input
