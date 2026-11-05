# Activity (Issue History and Workspace Audit Log) — Backend Spec

## Goal

Show what happened to an issue and who did it: created, each field change, and comments removed by a moderator. The web app mixes this history with the issue's comments in one timeline.

## Storage

History rows are `AuditLog` rows (`prisma/schema.prisma`):

| Column | Value |
| --- | --- |
| `workspaceId` | The issue's workspace |
| `userId` | Who did it (`SetNull` when their account is deleted) |
| `entityType` | `"ISSUE"` |
| `entityId` | The issue's id |
| `action` | One of the actions below |
| `metadata` | JSON, depending on the action |

A row is written **in the same transaction** as the change it describes (`recordIssueActivity` in `src/modules/activity/issue-activity.ts`), so history never disagrees with the issue. Deleting the issue doesn't delete its rows; they stay with the workspace.

Index: `@@index([workspaceId, entityType, entityId, createdAt])` serves the timeline query (migration `audit_log_entity_history_index`, which also drops the now-redundant single-column `workspaceId` index).

## Actions

| `action` | When | `metadata` |
| --- | --- | --- |
| `issue.created` | An issue (or sub-issue) is created | `null` |
| `issue.updated` | A `PATCH` changes at least one tracked field | `{ changes: IssueChange[] }` |
| `comment.deleted` | Someone deletes **another person's** comment (moderation) | `{ author: { id, name } }` |

Not recorded:
- A save that changes nothing tracked. A board reorder within a lane only changes `rank`, so it writes no row. A status change from a drag does.
- An author deleting their own comment, and posting or editing comments: the thread already shows those.

### `IssueChange`

One per changed field, in this order:

```ts
| { field: "title"; from: string; to: string }
| { field: "description" }                       // the text isn't kept
| { field: "status" | "priority" | "type"; from: string; to: string }
| { field: "timeEstimate"; from: number | null; to: number | null }
| { field: "assignee" | "sprint"; from: { id, name } | null; to: { id, name } | null }
| { field: "labels"; added: { id, name, color }[]; removed: { id, name, color }[] }
```

Names are **copied at the time of the change**, so the history still reads after a sprint or label is renamed or deleted, or an assignee leaves. A value sent but equal to the stored one isn't a change; a status implied by joining a sprint (`BACKLOG` → `TODO`) is recorded like a sent one.

## API

**`GET /projects/:projectId/issues/:issueId/activity`** — any member of the workspace (`WorkspaceGuard`), like reading the issue.

- `404 Issue not found` if the issue isn't in this workspace and project.
- Returns the rows oldest first, each with who did it:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Activity fetched successfully",
  "data": [
    {
      "id": "uuid",
      "action": "issue.updated",
      "metadata": {
        "changes": [{ "field": "status", "from": "TODO", "to": "IN_PROGRESS" }]
      },
      "createdAt": "2026-10-29T10:00:00.000Z",
      "user": { "id": "uuid", "name": "Alice", "avatarUrl": null }
    }
  ]
}
```

Not paginated yet. There is no write route; history is only written beside the changes themselves.

## Workspace audit log

The same table records who changed the workspace itself. The actions, their entity types and each
one's `metadata` shape are in `@taskforge/shared` (`packages/shared/src/audit.ts`); rows are
written by `recordWorkspaceEvent(tx, …)` (`src/modules/activity/workspace-activity.ts`), always in
the transaction of the change, so a refused or rolled-back change leaves no row. Names (members,
roles) are copied as they were.

| Action | Entity | Written by | `userId` | `metadata` |
| --- | --- | --- | --- | --- |
| `member.role_changed` | MEMBER | `MembershipService.updateRole` | actor | `{ member, from, to }` |
| `member.removed` | MEMBER | `MembershipService.removeMember` | actor | `{ member, role }` |
| `member.left` | MEMBER | `MembershipService.leave` | the member | `{ member, role }` |
| `invitation.sent` | INVITATION | `InvitationService.sendInvitation` (also a re-send) | actor | `{ email, role }` |
| `invitation.revoked` | INVITATION | `InvitationService.revokeInvitation` | actor | `{ email }` |
| `invitation.accepted` | INVITATION | `InvitationService.acceptInvitation` | the new member | `{ email, role }` |
| `role.created` | ROLE | `RoleService.create` | actor | `{ role, permissions }` |
| `role.updated` | ROLE | `RoleService.update`, only if something changed | actor | `{ role, name?, permissions?: { added, removed } }` |
| `role.deleted` | ROLE | `RoleService.remove` | actor | `{ role }` |
| `workspace.updated` | WORKSPACE | `WorkspaceService.update`, only if something changed | actor | `{ name?: { from, to }, description?: true }` (the text isn't copied) |
| `ownership.transferred` | WORKSPACE | `MembershipService.transferOwnership` | old owner | `{ from, to }` |
| `billing.subscription_changed` | SUBSCRIPTION | the Stripe webhook, only when plan, status or a scheduled cancellation changed | `null` | `{ from, to }` (`from` null for the first) |

`entityId` is the member's user id, the invitation, role, workspace, or `Subscription` row id.

`GET /audit-log?entityType=&page=&limit=` (`AuditLogController`) needs `audit:read` (Admin by
default; the OWNER holds everything). It reads only the caller's workspace and only the entity
types above (never ISSUE), newest first, paginated with `PrismaQueryBuilder`, each row with
`user: { id, name, avatarUrl }` or `null`. `entityType` narrows to one of them; anything else is a
`400`. The `audit_log` migration added the `(workspaceId, createdAt)` index it reads and granted
`audit:read` to existing Admin roles.

## Out of scope (for now)

History for projects, sprints, labels and issue deletion; exporting the audit log; a retention
limit (rows are kept forever, and cascade with the workspace).
