# Auth Module Upgrade — SPEC

## Goals
Bring the auth module fully in line with the rules in `src/modules/auth/CLAUDE.md` and
the root `CLAUDE.md`. Every gap listed below has a concrete fix.

---

## Current issues

### 1. JWT payload is missing `tenantId` and `roles`
**Files**: [jwt.strategy.ts:6-8](src/modules/auth/strategies/jwt.strategy.ts#L6-L8), [auth.service.ts:87-93](src/modules/auth/auth.service.ts#L87-L93)

`JwtPayload` only carries `{ sub, email }`. `issueTokens()` never reads Membership,
so tokens contain no tenant or role data. `req.user` can't be used for tenant scoping.

### 2. `process.env` used directly instead of `ConfigService`
**Files**: [jwt.strategy.ts:17](src/modules/auth/strategies/jwt.strategy.ts#L17), [auth.service.ts:90](src/modules/auth/auth.service.ts#L90), [auth.module.ts:14](src/modules/auth/auth.module.ts#L14)

All three hard-code `process.env.JWT_ACCESS_SECRET`. `ConfigModule` is not wired up
anywhere. Auth CLAUDE.md says "never process.env directly."

### 3. Refresh token accepted in request body
**Files**: [auth.controller.ts:49-56](src/modules/auth/auth.controller.ts#L49-L56), [auth.controller.ts:63-69](src/modules/auth/auth.controller.ts#L63-L69)

`/auth/refresh` and `/auth/logout` read `refreshToken` from `RefreshDto` (JSON body).
Auth CLAUDE.md requires it in an httpOnly cookie.

### 4. `JwtAuthGuard` has no `@Public()` support
**File**: [jwt-auth.guard.ts](src/modules/auth/guards/jwt-auth.guard.ts)

No `@Public()` decorator exists. Login/register are only unprotected by omission —
a typo adding the guard would silently break them.

### 5. No `RolesGuard` or `@Roles()` decorator
Auth CLAUDE.md documents `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles('admin')`
but neither exists.

### 6. `ConfigModule` absent from `AppModule`
**File**: [app.module.ts](src/app.module.ts)

`@nestjs/config` is never imported, so `ConfigService` is unavailable globally.

### 7. `register()` creates a bare `User` with no `Tenant` or `Membership`
**Files**: [auth.service.ts:24-30](src/modules/auth/auth.service.ts#L24-L30), [user.service.ts:18-35](src/modules/user/user.service.ts#L18-L35)

Every user must belong to a tenant (`Membership`), but registration skips both.
The resulting user can never pass a tenantId-scoped auth check.

### 8. Login never fetches tenant context
`login()` calls `issueTokens(userId, email)` without looking up `Membership`,
so even existing users with tenants get tokens without `tenantId`/`roles`.

---

## Planned changes

### New files

| File | Purpose |
|------|---------|
| `src/modules/auth/decorators/public.decorator.ts` | `@Public()` — `SetMetadata(IS_PUBLIC_KEY, true)` |
| `src/modules/auth/decorators/roles.decorator.ts` | `@Roles(...roles)` — `SetMetadata(ROLES_KEY, roles)` |
| `src/modules/auth/guards/roles.guard.ts` | Reads `roles` from `req.user`, compares to `@Roles()` metadata |

---

### Modified files

#### `src/app.module.ts`
- Add `ConfigModule.forRoot({ isGlobal: true })`.

#### `src/modules/auth/auth.module.ts`
- Replace `JwtModule.register(...)` → `JwtModule.registerAsync(...)` reading
  `JWT_ACCESS_SECRET` via `ConfigService`.

#### `src/modules/auth/strategies/jwt.strategy.ts`
- Inject `ConfigService`; use `configService.getOrThrow('JWT_ACCESS_SECRET')` for
  `secretOrKey` (throws at boot if missing — fast-fail).
- Expand `JwtPayload` to `{ sub, email, tenantId, roles }`.
- `validate()` returns the payload fields directly (no extra DB hit).
  `req.user` shape becomes `{ sub, email, tenantId, roles }`.

#### `src/modules/auth/auth.service.ts`
- Inject `ConfigService`; remove all `process.env` references.
- `issueTokens()` gains `tenantId: string` and `roles: string[]` parameters and
  embeds them in the JWT.
- `register()` — wrap User + Tenant + Membership creation in a single Prisma
  transaction. New user gets `Role.ADMIN` on the new tenant. Derive `tenantSlug`
  from `tenantName` automatically.
- `login()` — look up Membership after credential check to get `tenantId`/`role`.
  If `tenantSlug` is provided in `LoginDto`, validate the user belongs to that tenant.
  If omitted and the user has one membership, use it. If omitted and they have several,
  return their tenant list with a `requiresTenantSelection: true` flag instead of tokens.
- `refresh()` — after rotating the token, re-fetch Membership so `tenantId`/`roles`
  stay current.

#### `src/modules/auth/auth.controller.ts`
- `register()` / `login()`: set refresh token as an httpOnly `Secure` cookie in the
  response; **do not** return it in the JSON body.
- `refresh()`: read `req.cookies.refreshToken` (no body DTO needed); return new
  access token in body, set new refresh-token cookie.
- `logout()`: read `req.cookies.refreshToken`; clear the cookie after revoking.
- Add `cookie-parser` wiring note (see `main.ts` section below).

#### `src/main.ts`
- Add `app.use(cookieParser())` so `req.cookies` is populated.

#### `src/modules/auth/guards/jwt-auth.guard.ts`
- Override `canActivate()`: if `IS_PUBLIC_KEY` metadata is set, return `true` without
  calling super. Otherwise delegate to `AuthGuard('jwt')`.

#### `src/modules/auth/dto/register.dto.ts`
- Add `tenantName: string` (required, `@MinLength(2)`).

#### `src/modules/auth/dto/login.dto.ts`
- Add optional `tenantSlug?: string` (`@IsOptional()`, `@IsString()`).

#### `src/modules/auth/dto/refresh.dto.ts`
- Delete — `refreshToken` moves to a cookie; the DTO is no longer used.

---

## Design decisions

### Active tenant selection on login
A user can belong to multiple tenants. The token carries exactly one `tenantId`.

**Chosen approach (Option A — Slack-style picker):**
`LoginDto` gains an optional `tenantSlug`. If supplied, the login validates the user's
membership in that tenant and embeds it. If omitted:
- 1 membership → use it silently.
- 2+ memberships → return `{ requiresTenantSelection: true, tenants: [...] }` with
  HTTP 200, no tokens. The client re-submits with a `tenantSlug`.

This avoids silent surprises for multi-tenant users and matches common SaaS UX.

### Refresh-token transport
`POST /auth/refresh` and `POST /auth/logout` read `refreshToken` exclusively from
`req.cookies.refreshToken` (httpOnly, `Secure` in production, `SameSite=Strict`).
The raw token is never returned in a JSON response body — only set as a cookie.

### Registration tenant creation
`register()` creates `User` + `Tenant` + `Membership(role: ADMIN)` atomically via
`prisma.$transaction`. `tenantSlug` is derived as
`tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')`.
A `ConflictException` is thrown if the slug is already taken.

---

## Out of scope
- Email verification flow (emailVerified flag exists; implementation is future work).
- Invitation acceptance (separate flow, separate spec).
- RolesGuard is wired up but no route uses `@Roles()` yet — that's per-feature work.
