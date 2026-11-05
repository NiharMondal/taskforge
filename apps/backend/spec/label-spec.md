# Label Module — Backend Spec

## Goal

Workspace-wide labels ("Bug", "Frontend", "Needs design") that group issues across every project. Admins manage the label list; anyone who may edit an issue may put labels on it.

## Data model

The existing models in `prisma/schema.prisma`:

- `Label`: `id`, `name`, `color`, `workspaceId`; `@@unique([workspaceId, name])`.
- `IssueLabel`: the join row (`issueId`, `labelId`), cascading from both sides. Deleting a label takes it off every issue; deleting an issue drops its rows.

No schema change was needed. Migration `label_permissions` only grants the new permission to existing Admin roles.

## Permissions

| Action | Needs |
| --- | --- |
| List labels | Any member |
| Create, rename, recolor, delete a label | `label:manage` (Owner and Admin by default) |
| Put labels on an issue, or take them off | The issue's content permissions: `issue:edit:any`, or `issue:edit:own` on an issue you reported or are assigned to |

## API Endpoints

All require `Authorization: Bearer <token>` and `x-workspace-id`, through `WorkspaceGuard`. A label id from another workspace is a `404`.

Base path: `/labels`

### 1. List labels

**`GET /labels`** — any member. Alphabetical, each with how many issues carry it:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Labels fetched successfully",
  "data": [
    { "id": "uuid", "name": "Bug", "color": "#ef4444", "workspaceId": "uuid", "_count": { "issues": 3 } }
  ]
}
```

### 2. Create a label

**`POST /labels`** — `label:manage`. Body: `{ "name": "Bug", "color": "#ef4444" }`. `201` with the label.

### 3. Update a label

**`PATCH /labels/:labelId`** — `label:manage`. Body: either or both of `name`, `color`. `200` with the label.

### 4. Delete a label

**`DELETE /labels/:labelId`** — `label:manage`. Removes it from every issue. `200` with the deleted label.

## Validation

- `name`: trimmed, then 1–30 characters. Unique in the workspace **ignoring case** ("Bug" and "bug" can't both exist): a clash is a `409` with the existing name in the message.
- `color`: a 6-digit hex color, `#rrggbb`. The web app offers a fixed palette; the API accepts any hex.
- On update, `null` for either field is a `400`.

## Labels on issues

The issue routes (`spec/issue-spec.md`) carry them:

- `POST` and `PATCH /projects/:projectId/issues[/:issueId]` accept `labelIds: string[]`: up to 10 unique label ids of this workspace. A label from another workspace refuses the whole write with `403 Invalid label`.
- On `PATCH` the list **replaces** the issue's labels; `[]` removes them all, and leaving `labelIds` out leaves them alone.
- The list and single-issue responses embed `labels: [{ id, name, color }]`, alphabetically.

Filtering issues by label happens in the web app over the cached issue list; the API has no label query parameter.

## Errors

| Status | Reason |
| --- | --- |
| `400` | Missing or invalid `name` / `color`; bad `labelIds` (not an array, not UUIDs, duplicates, more than 10) |
| `403` | No `label:manage`; editing an issue's labels without its content permissions; a label from another workspace |
| `404` | Label not in this workspace |
| `409` | A label with that name (ignoring case) already exists |
