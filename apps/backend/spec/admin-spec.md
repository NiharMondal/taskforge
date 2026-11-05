# Platform admin

`src/modules/admin/` serves `/api/v1/admin`: views across **every** workspace and account, and the
actions platform staff take on them (suspend, sign out, delete), for the people who run the product.
Until now that meant the Stripe dashboard and Prisma Studio, which is risky and records nothing. The
web console is `apps/web/spec/admin.md`.

## The one deliberate cross-tenant exception

Every other route acts inside one workspace, proven by `WorkspaceGuard` from `x-workspace-id`.
These don't: they take no `x-workspace-id` (it is ignored if sent) and use no `WorkspaceGuard`. The
boundary is the caller's **platform role**, and cross-tenant reads live in this module only.

## Platform roles

`User.platformRole` is `ADMIN`, `SUPPORT` or `null` (everyone else).

| Role | May |
|---|---|
| `SUPPORT` | Read the views (stats, workspaces, users). |
| `ADMIN` | Everything `SUPPORT` may, every action below, and the platform audit log. |

- **The role lives in the database, never in the JWT.** The token keeps identifying only the user.
  `PlatformRoleGuard` reads `platformRole` for `req.user.sub` on **every** admin request, so
  removing a role takes effect at once, even for an access token that is still valid.
- `@RequirePlatformRole(role)` names the least role a route needs (ADMIN passes a SUPPORT route).
  `AdminController` requires `SUPPORT` at the class level and `ADMIN` on each action and on
  `GET /admin/audit-log`. A caller without the role, whose account is gone, or who is suspended
  (their access token may still be valid) gets **403** `"Platform access required"`.
- **Nobody becomes platform staff through the API.** No DTO accepts `platformRole` (sending it is
  the usual 400). Only the script grants or removes it:

  ```bash
  pnpm run set-platform-role <email> <ADMIN|SUPPORT|none>   # in apps/backend
  ```

  The email matches ignoring case. An unknown email exits 1 and changes nothing; setting the role
  someone already has writes nothing. Each change is one `PlatformAuditLog` row, in the same
  transaction as the update (below).
- `GET /users/me` returns `platformRole`, so the web knows whether to show the console.

## Platform audit log

`PlatformAuditLog { id, actorId → User (SetNull), action, targetType, targetId, metadata, createdAt }`.
The workspace `AuditLog` can't hold these: it requires a `workspaceId`. Rows are written with
`recordPlatformEvent(tx, …)` (`platform-audit.ts`), in the transaction of the change.

The actions, their target types and each one's `metadata` are in `@taskforge/shared` (`admin.ts`:
`PlatformAuditMetadata`, `PLATFORM_AUDIT_ACTION_TARGET`), which the web reads them with. Names are
copied in, so a row still reads after its target is deleted; `targetId` stays.

| Action | Target | Actor | `metadata` |
|---|---|---|---|
| `platform_role.changed` | `USER` | `null` (the script) | `{ email, from, to }` (roles or `null`) |
| `user.suspended` / `user.unsuspended` | `USER` | the admin | `{ name, email, reason }` |
| `user.sessions_revoked` | `USER` | the admin | `{ name, email, reason, revoked }` (sessions still usable) |
| `user.deleted` | `USER` | the admin | `{ name, email, reason, deletedWorkspaces: [{ id, name }] }` |
| `workspace.suspended` / `workspace.unsuspended` | `WORKSPACE` | the admin | `{ name, reason }` |
| `workspace.deleted` | `WORKSPACE` | the admin | `{ name, reason, owner: { id, name, email } \| null, memberCount }` |

Reads aren't logged.

## Suspension

`User` and `Workspace` carry `suspendedAt` and `suspendedReason` (migration
`20261102150000_suspensions`). Both are cleared when a suspension is lifted. **The reason is an
internal staff note**: only `/admin` routes return it. `GET`/`PATCH /users/me` and the workspace
routes strip it (`withoutStaffNote`), and the 403 bodies never carry it.

**A suspended account** (`AccountSuspendedException`, 403
`{ code: "ACCOUNT_SUSPENDED", message: "This account has been suspended. Contact support…" }`):

- `POST /auth/login` checks the password first: a wrong one is still the generic 401, so only the
  account's owner learns it is suspended.
- `POST /auth/google` refuses a linked account, and won't link Google to an existing suspended one.
- `POST /auth/refresh` refuses. Suspending revokes every refresh token in the same transaction, so
  in practice a refresh is a 401; the 403 catches a token issued in a race.
- `POST /auth/verify-email` refuses a link that would take over an existing (pre-verification)
  suspended account.
- The current **access token stays valid until it expires (at most 15 minutes)**. That delay is
  accepted; the alternative is a database read in `JwtStrategy` on every request.
  `PlatformRoleGuard` does read the user, so suspended staff lose `/admin` at once.
- `POST /auth/forgot-password`/`reset-password` still work (no sign-in follows).

**A suspended workspace** (`WorkspaceSuspendedException`, 403 `{ code: "WORKSPACE_SUSPENDED" }`):

- `resolveWorkspaceAccess` (WorkspaceGuard/PermissionsGuard) refuses every workspace-scoped request,
  owner included, after confirming membership (only members learn it is suspended).
- `POST /invitations/accept` refuses to join it.
- `GET /workspaces` still lists it, with `suspended: true` and `suspendedAt`, so the web can explain.
- Stripe is untouched: billing continues unless it is stopped in Stripe. The webhook keeps working.

## Actions (ADMIN only)

Every action takes `{ reason }` (trimmed, 1–500 characters, `MAX_ADMIN_REASON_LENGTH`); a missing or
blank one is a 400, as is any undeclared key. Each writes **one** `PlatformAuditLog` row in the
transaction of the change (`AdminActionsService`). **Guardrails:** an admin can't act on their own
account (403, checked before anything is read) or on another `ADMIN` (403); SUPPORT staff can be
acted on.

| Route | Body | Does |
|---|---|---|
| `PATCH /admin/users/:id` | `{ suspended: boolean, reason }` | Suspends (and revokes every refresh token) or lifts it. 409 if already in that state. Answers with the user's detail. |
| `POST /admin/users/:id/revoke-sessions` | `{ reason }` | Revokes every refresh token; answers `{ revoked }` (how many were still usable). |
| `DELETE /admin/users/:id` | `{ reason }` | `AccountService.deleteAccountAsStaff`: the steps of `DELETE /users/me` without the owner's confirmation. Still **409** while the user owns a workspace other people use (delete that workspace first); their solo workspaces are deleted with them, subscriptions canceled first. The user is emailed (`accountDeletedByStaffEmail`, no reason). |
| `PATCH /admin/workspaces/:id` | `{ suspended: boolean, reason }` | Suspends or lifts it. 409 if already in that state. Answers with the workspace's detail. |
| `DELETE /admin/workspaces/:id` | `{ reason }` | `WorkspaceService.delete`: the subscription is canceled with Stripe first (502/503 and nothing deleted if that fails); the audit row, with the owner and member count read before they cascade, is written in the deleting transaction (`beforeDelete`). |

Suspending and lifting are conditional updates (`suspendedAt: null` / `{ not: null }`), so of two
admins acting at once one gets the 409. Unknown ids are 404s.

**Plans are never changed here.** A free or discounted plan is made in Stripe (a 100% coupon or a
longer trial), so the webhook stays the only writer of `Subscription`.

### `GET /admin/audit-log?targetType=&targetId=&page=&limit=`

ADMIN only. Newest first, paginated. `targetType` is `USER` or `WORKSPACE`; `targetId` narrows to
one target's history. Rows: `{ id, action, targetType, targetId, metadata, createdAt, actor: { id, name, email } | null }`.

## Routes

All `GET`, `SUPPORT` or `ADMIN`, enveloped by `sendResponse()`. Lists are paginated with
`PrismaQueryBuilder` (`page`, `limit`: default 20, max 100) and return `metaData`; an undeclared
query key is a 400. `search` is trimmed (blank means none), at most 200 characters.

**No secrets.** Every query lists its columns (`select`, never a whole row), so no password hash,
refresh or reset token, or Google account id can reach a response. The only Stripe values returned
are the customer and subscription ids.

### `GET /admin/stats`

```jsonc
{
  "users": { "total": 40, "newLast7Days": 3, "newLast30Days": 9, "platformStaff": 2, "suspended": 1 },
  // By the plan in force (`effectivePlan`): a lapsed subscription, or none, is FREE.
  "workspaces": { "total": 10, "byPlan": { "FREE": 5, "PRO": 4, "ENTERPRISE": 1 }, "suspended": 0 },
  // Workspaces with a Subscription row, by Stripe status; `noStatus`: a checkout was
  // started (a Stripe customer exists) but nothing was subscribed.
  "subscriptions": { "total": 8, "byStatus": { "ACTIVE": 3, "TRIALING": 1, "...": 0 }, "noStatus": 1 }
}
```

### `GET /admin/workspaces?search=&plan=&page=&limit=`

Newest first. `search` matches part of the name or of the **owner's** email (ignoring case), or a
whole workspace id. `plan` (`FREE`/`PRO`/`ENTERPRISE`) filters on the plan **in force**, the same rule
as `effectivePlan` (`effectivePlanWhere`): Pro means a stored PRO with a live status; Free means no
subscription, a stored FREE, no status, or a status that isn't live. Each row:

```jsonc
{
  "id": "…", "name": "Acme", "slug": "…", "createdAt": "…",
  "owner": { "id": "…", "name": "Ann", "email": "ann@example.com" }, // null if none
  "memberCount": 3,
  "plan": "FREE", // in force now
  "suspendedAt": null, "suspendedReason": null,
  "subscription": { "plan": "PRO", "status": "CANCELED", "seats": 3, "cancelAtPeriodEnd": false, "currentPeriodEnd": null } // or null
}
```

The owner is the membership whose `role` is `OWNER` (kept in step with the Owner role row).

### `GET /admin/workspaces/:id`

404 when unknown. The workspace (`description`, `updatedAt` too), `plan`, `owner`, and:

- `subscription`: `plan`, `status`, `stripeCustomerId`, `stripeSubscriptionId`, `seats`,
  `currentPeriodEnd`, `cancelAtPeriodEnd`, `trialEndsAt`, `createdAt`, `updatedAt`, or `null`.
- `stripeMode`: `"test"`, `"live"` or `null`. It comes from the backend's `STRIPE_SECRET_KEY` prefix
  (`StripeService.mode()`). Stripe ids exist only in the mode they were made in, so the console
  links to that half of Stripe's dashboard.
- `counts`: `members`, `projects`, `issues`, `sprints`, `labels`, `customRoles`, and
  `pendingInvitations` (`PENDING` and not yet expired).
- `members`: `[{ id, role, assignedRole: { id, name, systemKey } | null, isOwner, joinedAt, user: { id, name, email, avatarUrl } }]`.
- `projects`: `[{ id, name, key, createdAt, issueCount, sprintCount }]`.

`members` and `projects` are oldest first, at most `ADMIN_DETAIL_LIST_LIMIT` (100,
`@taskforge/shared`); `counts` has the totals.

### `GET /admin/users?search=&page=&limit=`

Newest first. `search` matches part of the name or email (ignoring case), or a whole user id. Each row:
`{ id, name, email, avatarUrl, emailVerifiedAt, platformRole, suspendedAt, suspendedReason, createdAt, signInMethods: ["EMAIL", "GOOGLE"], workspaceCount }`.

Both detail routes also return `suspendedAt` and `suspendedReason`.

### `GET /admin/users/:id`

404 when unknown. The profile (`updatedAt` too), and:

- `signInMethods`: `[{ provider, addedAt }]`, the provider only.
- `counts`: `workspaces`, `reportedIssues`, `assignedIssues`, `comments`, and `activeSessions`
  (refresh tokens neither revoked, replaced nor expired: one per signed-in browser or device).
- `memberships`: `[{ id, role, assignedRole, isOwner, joinedAt, workspace: { id, name, plan, memberCount } }]`,
  oldest first, at most `ADMIN_DETAIL_LIST_LIMIT`.

## Known gaps

- A member of a suspended workspace can't leave it (`DELETE /memberships/me` is workspace-scoped), and
  its owner can't transfer or delete it. An admin lifts the suspension or deletes it.
- An account deletion is refused (409) while the user owns a suspended workspace others use, since
  ownership can't be transferred out of it. An admin deletes the workspace first.

## Tests

- `platform-role.guard.spec.ts`: role read per request by the token's subject; no role or a gone
  account is 403; ADMIN passes SUPPORT routes, SUPPORT is kept out of ADMIN ones.
- `admin.controller.spec.ts` (HTTP, real guard): every route 403s without a role; SUPPORT and ADMIN
  read them all; `x-workspace-id` is ignored; undeclared or invalid query keys are 400; no write
  routes exist.
- `admin.service.spec.ts`: the stats arithmetic; `effectivePlanWhere` matches exactly what
  `effectivePlan` returns for every plan × status; row shapes; 404s; no query selects a credential.
- `set-platform-role.spec.ts`: argument parsing; grant, clear, no-op and unknown email, with the
  audit row.
- `admin-actions.service.spec.ts`: guardrails (self, other ADMIN, SUPPORT allowed, 404); each action
  writes exactly one audit row in its transaction; suspend revokes sessions, lift doesn't; 409 on no
  change; deletes go through `AccountService`/`WorkspaceService` with the row in their transaction.
- `admin.controller.spec.ts` also: every action and the audit log 403 for SUPPORT and the role-less;
  bodies need a reason and a boolean `suspended`, no undeclared keys.
- `AuthService` (suspended sign-in after the password, Google linked and unlinked, refresh,
  verify-email), `WorkspaceGuard` (`WORKSPACE_SUSPENDED`), invitation accept, `withoutStaffNote` on
  the user and workspace routes, `RefreshTokenService.revokeAllForUser`'s count,
  `AccountService.deleteAccountAsStaff`, `StripeService.mode`.
- e2e (`platform admin`): a workspace owner and a user without a role get 403 everywhere; `PATCH
  /users/me` can't set a role; the script grants SUPPORT (the same token works at once), reads match
  the database and carry no credential, the audit rows are written, and clearing the role 403s the
  same token again; ADMIN reads too. **Actions:** SUPPORT, self and another ADMIN refused; suspend a
  user (login 403 `ACCOUNT_SUSPENDED` without the reason, sessions revoked, a surviving refresh token
  403s, suspending twice 409) then lift it; suspend a workspace (scoped routes 403
  `WORKSPACE_SUSPENDED`, still listed without the reason) then lift it; revoke sessions; delete a
  workspace (owner recorded) and then the account (solo workspace with it); one audit row per action,
  read back through `GET /admin/audit-log`.
