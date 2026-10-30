# Membership Module — Backend Spec

## Goal

A workspace's roster: who is in it and with which role. Members are added through invitations (`spec/invitation-spec.md`); this module lists them, changes roles, removes them, hands the workspace to a new owner, and lets members leave.

## Rules that hold across every route

- **One owner.** Every workspace has exactly one `OWNER`. The owner holds every permission in code, can't be assigned, invited, demoted or removed, and stops being the owner only by **transferring** ownership (or deleting the workspace).
- **No escalation.** An actor can't hand out a role holding permissions the actor lacks (`assertActorHolds`).
- **Strictly more access to act on a member.** Changing a member's role or removing them needs every permission the member holds plus at least one more (`assertActorOutranks`), else `403`. So an Admin can't demote or remove another Admin (only the owner can), and the same goes for two holders of one custom role. An Admin can still make someone an Admin.
- **Roles** are the workspace's built-ins or its custom roles (`spec/role-spec.md`). Roster rows carry `assignedRole { id, name, systemKey }`; the enum `role` reads `MEMBER` for a custom role.
- **Tenant.** Every route goes through `WorkspaceGuard`; the workspace comes from `x-workspace-id`, and `:userId` is looked up in that workspace only.

## API Endpoints

Base path: `/memberships`

| Method | Route | Who | Does |
| --- | --- | --- | --- |
| `GET` | `/` | Any member | The roster, oldest member first, each row with `user { id, name, avatarUrl, email }` and its role. Paginated: `?page=` (default 1), `?limit=` (default 20, max 100), `metaData` in the response |
| `GET` | `/me` | Any member | The caller's role and the permissions it grants |
| `GET` | `/:userId` | Any member | One membership |
| `PATCH` | `/:userId` | `member:manage` | Change a member's role (`{ roleId }`, custom roles included, or a built-in's `{ role }`; never the owner's, never yourself) |
| `DELETE` | `/:userId` | `member:manage` | Remove a member (never the owner) |
| `POST` | `/transfer-ownership` | The owner (`workspace:transfer`) | Make another member the owner |
| `DELETE` | `/me` | Anyone but the owner | Leave the workspace |

### Transfer ownership

**`POST /memberships/transfer-ownership`** — body `{ "userId": "uuid" }`.

`workspace:transfer` is an owner-only permission, like `workspace:delete`: it is never stored on a role, so no role can be edited into it. In one transaction:

1. The caller steps down from `OWNER` to `ADMIN`, matched on still being the owner. If they no longer are (a second transfer racing the first), nothing changes: `409`.
2. The new owner's membership becomes `OWNER`. If they aren't in this workspace: `404`, and step 1 rolls back.
3. If the workspace is on Free, the new owner must not already own `FREE_OWNED_WORKSPACES` (2) other Free workspaces: otherwise `402` `{ code: "PLAN_LIMIT", limit: "ownedWorkspaces" }`, and steps 1 and 2 roll back. A Pro workspace isn't checked.

Both rows' `roleId` points at the workspace's matching built-in `Role`. Returns `200` with the new owner's membership.

| Status | Reason |
| --- | --- |
| `400` | Transferring to yourself, or `userId` isn't a UUID |
| `403` | The caller isn't the owner |
| `402` | A Free workspace, and the new owner already owns 2 Free workspaces (`PLAN_LIMIT`, `ownedWorkspaces`) |
| `404` | That user isn't a member of this workspace |
| `409` | The caller stopped being the owner meanwhile |

### Leave the workspace

**`DELETE /memberships/me`** — no body. Deletes the caller's own membership; their next request with this workspace's header is a `403`.

| Status | Reason |
| --- | --- |
| `400` | It's the caller's only workspace. The web app needs one to land in, as with deleting your last workspace. |
| `403` | The caller is the owner: transfer ownership or delete the workspace instead |

Leaving, like being removed, leaves the person's comments, history and issue assignments in place. Issues assigned to them keep that assignee until someone changes it.
