# Platform admin

`src/modules/admin/` serves `/api/v1/admin`: read-only views across **every** workspace and account,
for the people who run the product. Until now that meant the Stripe dashboard and Prisma Studio,
which is risky and records nothing. The web console is `apps/web/spec/admin.md`.

## The one deliberate cross-tenant exception

Every other route acts inside one workspace, proven by `WorkspaceGuard` from `x-workspace-id`.
These don't: they take no `x-workspace-id` (it is ignored if sent) and use no `WorkspaceGuard`. The
boundary is the caller's **platform role**, and cross-tenant reads live in this module only.

## Platform roles

`User.platformRole` is `ADMIN`, `SUPPORT` or `null` (everyone else).

| Role | May |
|---|---|
| `SUPPORT` | Read every `/admin` route. |
| `ADMIN` | Everything `SUPPORT` may. Write routes arrive with step 12 of `docs/saas-readiness-plan-2026-10-29.md`. |

- **The role lives in the database, never in the JWT.** The token keeps identifying only the user.
  `PlatformRoleGuard` reads `platformRole` for `req.user.sub` on **every** admin request, so
  removing a role takes effect at once, even for an access token that is still valid.
- `@RequirePlatformRole(role)` names the least role a route needs (ADMIN passes a SUPPORT route).
  `AdminController` requires `SUPPORT` at the class level. A caller without the role, or whose
  account is gone, gets **403** `"Platform access required"`.
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

| Action | Target | Actor | `metadata` |
|---|---|---|---|
| `platform_role.changed` | `USER` | `null` (the script) | `{ email, from, to }` (roles or `null`) |

Reads aren't logged. Step 12 adds the admin actions and `GET /admin/audit-log`.

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
  "users": { "total": 40, "newLast7Days": 3, "newLast30Days": 9, "platformStaff": 2 },
  // By the plan in force (`effectivePlan`): a lapsed subscription, or none, is FREE.
  "workspaces": { "total": 10, "byPlan": { "FREE": 5, "PRO": 4, "ENTERPRISE": 1 } },
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
`{ id, name, email, avatarUrl, emailVerifiedAt, platformRole, createdAt, signInMethods: ["EMAIL", "GOOGLE"], workspaceCount }`.

### `GET /admin/users/:id`

404 when unknown. The profile (`updatedAt` too), and:

- `signInMethods`: `[{ provider, addedAt }]`, the provider only.
- `counts`: `workspaces`, `reportedIssues`, `assignedIssues`, `comments`, and `activeSessions`
  (refresh tokens neither revoked, replaced nor expired: one per signed-in browser or device).
- `memberships`: `[{ id, role, assignedRole, isOwner, joinedAt, workspace: { id, name, plan, memberCount } }]`,
  oldest first, at most `ADMIN_DETAIL_LIST_LIMIT`.

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
- e2e (`platform admin`): a workspace owner and a user without a role get 403 everywhere; `PATCH
  /users/me` can't set a role; the script grants SUPPORT (the same token works at once), reads match
  the database and carry no credential, the audit rows are written, and clearing the role 403s the
  same token again; ADMIN reads too.
