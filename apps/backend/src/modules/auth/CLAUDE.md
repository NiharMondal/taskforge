# Auth module rules

## Strategy wiring
JwtStrategy is registered as a provider in AuthModule and imported where needed.
The strategy reads secretOrKey from ConfigService.get('JWT_SECRET') — never process.env directly.

## Guard usage
- @UseGuards(JwtAuthGuard)         → validates JWT, populates req.user
- @UseGuards(JwtAuthGuard, RolesGuard) + @Roles('admin') → adds RBAC on top
- @Public() decorator              → skips JwtAuthGuard for open endpoints (e.g. /auth/login)

## Token payload shape
{
  sub: string,       // userId (UUID)
  email: string,
  tenantId: string,  // UUID — the source of truth for tenant scoping
  roles: string[]
}

## Refresh token pattern
- POST /auth/refresh accepts refresh token in httpOnly cookie, NOT in Authorization header
- Refresh tokens are stored hashed in the DB (refreshTokenHash column on User)
- On logout, invalidate by clearing refreshTokenHash

## What NOT to do
- Never call JwtService.sign() outside AuthService
- Never expose the raw refresh token in a JSON response body
- Never add tenantId to a JWT claim from client input — derive from DB on login only