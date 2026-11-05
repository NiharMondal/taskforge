# Auth module rules

## File locations
Auth constructs live outside this module:
- Guards: `src/common/guards/` (jwt-auth.guard.ts, workspace.guard.ts, permissions.guard.ts)
- Permissions: `src/common/permissions/` (catalog in permissions.ts, membership → WorkspaceAccess in workspace-access.ts, issue field rules in issue-access.ts)
- Strategy: `src/common/strategies/jwt.strategy.ts`
- Decorators: `src/common/decorators/` (public, require-permission, access, current-user, workspaceId)
- Types: `src/common/types/authenticated-request.interface.ts`

## Strategy wiring
JwtStrategy is registered as a provider in AuthModule.
Reads secretOrKey from `ConfigService.getOrThrow<string>("JWT_ACCESS_SECRET")` — never process.env directly.

## Guard usage
Only JwtAuthGuard is global (APP_GUARD in app.module.ts). Everything else is applied per controller or route.

- `@Public()`                                → skips JwtAuthGuard (every /auth/* route, GET /invitations/validate)
- `@UseGuards(JwtAuthGuard, WorkspaceGuard)` → JWT + workspace membership check (used in workspace-scoped controllers)
- `@RequirePermission("project:manage")`     → applies PermissionsGuard; 403 unless the caller's role holds every listed permission

## WorkspaceGuard
Reads `x-workspace-id` header (or `:workspaceId` param), looks up the Membership row and its Role in one query, then injects:
- `request.workspaceId` (string)
- `request.access` (WorkspaceAccess: userId, roleId, systemKey, isOwner, permissions)

Throws ForbiddenException if the user has no membership for that workspace.

## Parameter decorators
- `@CurrentUser(): JwtPayload` → injects request.user (requires JwtAuthGuard)
- `@WorkspaceId(): string`     → injects request.workspaceId (requires WorkspaceGuard to run first)
- `@Access(): WorkspaceAccess` → injects request.access (requires WorkspaceGuard)

## Token payload shape
```
JwtPayload = { sub: string, email: string }
```
workspaceId is NOT in the JWT. Workspace context is request-scoped via the x-workspace-id header + WorkspaceGuard DB lookup.
Access token expiry: 15 minutes (`ACCESS_TOKEN_TTL_SECONDS` in auth.constants.ts, used by auth.module.ts JwtModule.registerAsync).

## Refresh tokens
`RefreshTokenService` (refresh-token.service.ts) issues, rotates and revokes opaque refresh tokens; only their SHA-256 is stored (`RefreshToken`). It never signs JWTs — `AuthService.issueTokens` pairs a signed access token with a refresh token. Revoke a user's tokens (`revokeAllForUser`, inside the same transaction) whenever an account changes hands. Details: `spec/auth-spec.md`.

## Email verification
`register` stores a `PendingRegistration` and emails a link (templates in auth-emails.ts); `verifyEmail` creates the account. Tokens in links are `generateToken()` values stored as `hashToken()`.

## What NOT to do
- Never call JwtService.sign() outside AuthService
- Never store a refresh or verification token itself — only `hashToken(token)`
- Never let `register` answer differently for a taken address
- Never trust workspaceId from request body or query params — always read from request.workspaceId (injected by WorkspaceGuard)
- Never add workspaceId to a JWT claim from client input
