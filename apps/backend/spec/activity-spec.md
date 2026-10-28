# Issue Activity (History) — Backend Spec

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

## Out of scope (for now)

A workspace-wide audit view (all actions, all entities), history for projects, sprints and memberships, and recording issue deletion (there is nowhere to show it yet).
