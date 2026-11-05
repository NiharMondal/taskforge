# Role Module — Backend Spec

## Goal

Let a workspace define who may do what beyond the four built-in roles. A role is a name and a set
of permission keys from the catalog (`GRANTABLE_PERMISSIONS` in `@taskforge/shared`); a member holds
exactly one role, and their permissions are that role's.

## Rules that hold across every route

- **Built-ins are read-only.** Owner, Admin, Member and Viewer (`Role.systemKey`) can't be renamed,
  edited or deleted. Their permissions are `DEFAULT_ROLE_PERMISSIONS`, which later migrations extend
  by `systemKey` — an edited built-in would make those migrations wrong. Copy one into a custom role
  instead.
- **The owner's role is never handed out** — not through a role change, not through an invitation.
  Ownership moves only with `POST /memberships/transfer-ownership`.
- **No escalation.** Nobody creates, edits, deletes or assigns a role holding a permission they don't
  hold themselves (`assertActorHolds`). Editing checks both the role's current keys and the new ones.
- **Tenant.** Every route goes through `WorkspaceGuard`; a role id from another workspace is a `404`.
- Names are trimmed, 1–50 characters, unique in the workspace **ignoring case** (built-in names
  included: no custom "admin").

## API Endpoints

Base path: `/roles`

| Method | Route | Who | Does |
| --- | --- | --- | --- |
| `GET` | `/` | Any member | Every role: built-ins first (Owner, Admin, Member, Viewer), then custom by name |
| `POST` | `/` | `role:manage` | Create a custom role: `{ name, permissions }` |
| `PATCH` | `/:roleId` | `role:manage` | Rename a custom role and/or replace its permissions: `{ name?, permissions? }` |
| `DELETE` | `/:roleId` | `role:manage` | Delete an unused custom role |

`GET` returns `{ id, name, systemKey, permissions, memberCount, createdAt, updatedAt }` per role.
`permissions` is in catalog order with unknown stored keys dropped; the owner's (stored empty) is
reported as the whole catalog, since the owner holds everything in code. `permissions` in a body
is a list of catalog keys without repeats (empty makes a read-only role); the owner-only keys
(`workspace:delete`, `workspace:transfer`) can't be granted.

Changing a role's permissions takes effect on its holders' next request: `WorkspaceGuard` reads the
role on every request.

### Deleting

Refused with `409` while any member holds the role ("give them another role first") or a pending,
unexpired invitation grants it ("revoke it first"). Otherwise invitations that used it (accepted,
revoked, expired) lose the link (`roleId` set to null; their enum `role` stays) and the role is
deleted, in one transaction.

| Status | Reason |
| --- | --- |
| `400` | Invalid name or permission list |
| `403` | Built-in role, or a permission the caller doesn't hold |
| `404` | No such role in this workspace |
| `409` | Name taken (ignoring case), or the role is still in use |

## Assigning a role

- `PATCH /memberships/:userId` takes `{ roleId }` (any role but the owner's) — or, for older
  clients, `{ role }` with a built-in's key. Exactly one.
- `POST /invitations` takes `roleId` the same way (or `role`); neither means Member.
- The legacy enum columns (`Membership.role`, `Invitation.role`) are written alongside: the
  built-in's key, or `MEMBER` for a custom role. Read permissions from the Role row
  (`request.access`), never from the enum; the roster, `GET /memberships/me` and invitations embed
  `assignedRole { id, name, systemKey }` for display, and `GET /invitations/validate` returns
  `roleName`.
