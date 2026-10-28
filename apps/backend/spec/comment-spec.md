# Comment Module — Backend Spec

## Goal

Let workspace members discuss an issue. Every member can read an issue's comments; who may write, edit and delete them comes from their role's permissions and from authorship.

Out of scope for now: @mentions, notifications, reactions, real-time updates, attachments, edit history.

## Data model

The existing `Comment` model (`prisma/schema.prisma`): `id`, `content`, `issueId`, `userId` (the author), `createdAt`, `updatedAt`. Deleting an issue or a user cascades to their comments.

`Comment` has **no `workspaceId`**. Every query reaches the tenant through the issue:

```ts
where: { id: commentId, issueId, issue: { workspaceId, projectId } }
```

So a comment id from another workspace, project or issue is a `404`, never a `403` that would confirm it exists.

## Permissions

| Key | Built-in roles | Allows |
| --- | --- | --- |
| `comment:create` | Owner, Admin, Member | Post comments; edit and delete your own |
| `comment:delete:any` | Owner, Admin | Delete anyone's comment (moderation) |

Viewers can read comments but not write them. Owners hold every permission in code. Existing workspaces got the keys from the `comment_permissions` migration; new workspaces get them from `DEFAULT_ROLE_PERMISSIONS`.

Nobody can edit someone else's comment, not even the owner.

## API Endpoints

All endpoints require `Authorization: Bearer <token>` and `x-workspace-id`, and go through `WorkspaceGuard`. Each one first checks that the issue belongs to this workspace and project (`404 Issue not found` otherwise).

Base path: `/projects/:projectId/issues/:issueId/comments`

### 1. List comments

**`GET /`** — any member.

Returns the issue's comments oldest first, each with its author:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Comments fetched successfully",
  "data": [
    {
      "id": "uuid",
      "content": "<p>Kick-off is Monday</p>",
      "issueId": "uuid",
      "userId": "uuid",
      "user": { "id": "uuid", "name": "Alice", "avatarUrl": null },
      "createdAt": "2026-10-28T10:00:00.000Z",
      "updatedAt": "2026-10-28T10:00:00.000Z"
    }
  ]
}
```

Not paginated yet.

### 2. Add a comment

**`POST /`** — `comment:create`. Body: `{ "content": "<p>…</p>" }`. The author is the caller. `201` with the comment (same shape as above).

### 3. Edit a comment

**`PATCH /:commentId`** — `comment:create`, and only the author (`403` for anyone else). Body: `{ "content": "<p>…</p>" }`. `200` with the updated comment.

### 4. Delete a comment

**`DELETE /:commentId`** — the author while they hold `comment:create`, or anyone with `comment:delete:any` (`403` otherwise). `200` with the deleted comment.

## Validation

`content` is required on create and edit:

- a string of at most 2000 characters. It is the editor's HTML, so formatting counts toward the limit.
- it must contain some text once HTML tags, `&nbsp;` and whitespace are removed, so `<p></p>` is a `400`.

The backend stores the HTML as sent. The web app sanitizes it with `sanitizeHtml` before rendering.

## Errors

| Status | Reason |
| --- | --- |
| `400` | Missing, empty or too-long `content` |
| `403` | Missing `comment:create`, editing someone else's comment, or deleting it without `comment:delete:any` |
| `404` | Issue not in this workspace and project, or comment not on that issue |

## Issue list count

`GET /projects/:projectId/issues` includes `_count: { comments: number }` on each issue, for the comment count on board cards.
