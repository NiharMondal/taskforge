# Issue Module — Backend Spec

## Goal

Build a backend issue tracking system scoped to workspace projects. Issues are the core work unit in Taskforge — they track tasks, bugs, and features within a project. Every issue belongs to a workspace and a project; optionally it can be assigned to a sprint and a member.

**Core assumptions:**
- `reporterId` is always sourced from the authenticated user's JWT (`sub`). It is never accepted from the request body.
- Issues are workspace-isolated: a user from Workspace A must never be able to read or mutate Workspace B's issues.
- Creating needs `issue:create` (OWNER, ADMIN, MEMBER by default); deleting needs `issue:delete` (OWNER, ADMIN).
- Updating is field-level (see the PATCH table). A `MEMBER` may change `status`/`rank` on any issue and edit every field of issues they reported or are assigned to, but never set `DONE`. `VIEWER` is read-only.

---

## Database Schema

### Issue model (already migrated)

```prisma
model Issue {
  id          String  @id @default(uuid())
  title       String
  description String?

  status   IssueStatus   @default(BACKLOG)
  priority IssuePriority @default(MEDIUM)

  workspaceId String
  projectId   String
  sprintId    String?

  reporterId String
  assigneeId String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  project   Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  sprint    Sprint?   @relation(fields: [sprintId], references: [id], onDelete: SetNull)

  reporter User  @relation("CreatedIssues", fields: [reporterId], references: [id], onDelete: Cascade)
  assignee User? @relation("AssignedIssues", fields: [assigneeId], references: [id], onDelete: SetNull)

  comments Comment[]
  labels   IssueLabel[]

  @@index([workspaceId, projectId])
  @@index([workspaceId, status])
  @@index([workspaceId, assigneeId])
}

enum IssueStatus {
  BACKLOG
  TODO
  IN_PROGRESS
  IN_REVIEW
  QA_REQUESTED
  QA_FAILED
  DEPLOYED
  DONE
}
// A PATCH may only move status along the workflow in
// STATUS_TRANSITIONS in @taskforge/shared (e.g. QA_REQUESTED → QA_FAILED or
// DEPLOYED); anything else is a 400. DONE is terminal.

enum IssuePriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}
```

> No migration needed — this model is already present in the schema.

---

## API Endpoints

All endpoints require:
- `Authorization: Bearer <access_token>` header
- `x-workspace-id: <workspaceId>` header (consumed by `WorkspaceGuard`)

Base path: `/projects/:projectId/issues`

---

### 1. Create Issue

**`POST /projects/:projectId/issues`**

**Auth:** Required. `issue:create` (Owner, Admin and Member by default).

**Request body:**
```json
{
  "title": "Fix login bug",
  "description": "Users are getting 500 on login when email has uppercase letters",
  "status": "BACKLOG",
  "priority": "HIGH",
  "type": "BUG",
  "timeEstimate": 3,
  "sprintId": "uuid-optional",
  "assigneeId": "uuid-optional",
  "labelIds": ["uuid", "uuid"],
  "parentIssueId": "uuid-optional"
}
```

- `type` is `EPIC`, `STORY`, `TASK` or `BUG` (default `TASK`). `SUBTASK` can't be sent: an issue created with `parentIssueId` is a sub-issue, typed `SUBTASK`, and sending `type` with `parentIssueId` is a `400`.
- `timeEstimate` holds **story points** despite its name: a whole number from 0 to 100, or `null` for not estimated.
- `labelIds`: up to 10 unique ids of this workspace's labels (`spec/label-spec.md`); one from another workspace is a `403`.

**What the backend does:**
1. Validates the request body with `CreateIssueDto`.
2. Confirms the project (`projectId`) belongs to the workspace from the header.
3. Creates the `Issue` record with `reporterId` set to the authenticated user's `sub`.

**Success:** `201 Created`
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Issue created successfully",
  "data": { /* Issue object */ }
}
```

**Errors:**
| Status | Reason |
|--------|--------|
| `400` | Validation failure (missing title, invalid enum value, etc.) |
| `404` | Project not found in this workspace |

---

### 2. List Issues

**`GET /projects/:projectId/issues`**

**Auth:** Required. Any workspace member.

**Query params (all optional):**
| Param | Type | Description |
|-------|------|-------------|
| `status` | `IssueStatus` | Filter by status |
| `priority` | `IssuePriority` | Filter by priority |
| `assigneeId` | `string` (UUID) | Filter by assignee |
| `sprintId` | `string` (UUID) | Filter by sprint |
| `page` | `number` | Page number (default: 1) |
| `limit` | `number` | Items per page (default: 20, max: 100) |

**What the backend does:**
1. Validates project exists in workspace.
2. Builds a filtered, paginated Prisma query.
3. Returns issues with pagination metadata.

**Success:** `200 OK`
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Issues fetched successfully",
  "data": [ /* Issue[] */ ],
  "metaData": {
    "currentPage": 1,
    "totalPages": 3,
    "totalData": 42,
    "pageSize": 20,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

---

### 3. Get Single Issue

**`GET /projects/:projectId/issues/:issueId`**

**Auth:** Required. Any workspace member.

**What the backend does:**
1. Finds the issue by `id`, `workspaceId`, and `projectId` — all three must match.

**Success:** `200 OK`
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Issue fetched successfully",
  "data": { /* Issue object */ }
}
```

**Errors:**
| Status | Reason |
|--------|--------|
| `404` | Issue not found in this project/workspace |

---

### 4. Update Issue

**`PATCH /projects/:projectId/issues/:issueId`**

**Auth:** Required. Any workspace member, with field-level restrictions by role.

| Role | Allowed fields | Status restriction |
|------|---------------|-------------------|
| `OWNER` / `ADMIN` | All fields | Can set any status including `DONE` |
| `MEMBER` | `status`, `rank` on any issue; all fields on issues they reported or are assigned to (as stored before the update) | Cannot set `DONE` |
| `VIEWER` | None | — |

Rules are permissions on the member's `Role` (`issue:status`, `issue:status:done`, `issue:edit:any`, `issue:edit:own`); the table shows the built-in defaults. Unlisted fields are refused.

**Request body (all fields optional):**
```json
{
  "title": "Updated title",
  "description": "Updated description",
  "status": "IN_PROGRESS",
  "priority": "URGENT",
  "type": "STORY",
  "timeEstimate": 5,
  "sprintId": "uuid-or-null",
  "assigneeId": "uuid-or-null",
  "labelIds": ["uuid"]
}
```

`labelIds` replaces the issue's labels (`[]` removes them all; leave it out to keep them) and is a content field like the title. The list and single-issue responses embed `labels: [{ id, name, color }]`.

`type` and `timeEstimate` follow the create rules and are content fields (`issue:edit:any` / `issue:edit:own`); `timeEstimate: null` clears the estimate. A sub-issue's type can't be changed (`400`), but it can be estimated.

**What the backend does:**
1. Checks the caller's role permissions (see the table above).
2. Verifies the issue exists in this workspace + project.
3. Checks each field against those permissions; for a `MEMBER`, ownership is judged on the issue as stored before the update. A field the caller may not change is a `403`.
4. If `status` changes, checks it against the workflow (`400` if not allowed).
5. Applies the partial update.

**Success:** `200 OK`
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Issue updated successfully",
  "data": { /* updated Issue object */ }
}
```

**Errors:**
| Status | Reason |
|--------|--------|
| `400` | Validation failure, a disallowed status transition, or a `type` sent for a sub-issue |
| `403` | `MEMBER` attempted to update a restricted field or set status to `DONE` |
| `404` | Issue not found in this project/workspace |

---

### 5. Delete Issue

**`DELETE /projects/:projectId/issues/:issueId`**

**Auth:** Required. `ADMIN` or `OWNER` only.

**What the backend does:**
1. Verifies the issue exists in this workspace + project.
2. Deletes the issue (cascades to comments and labels per schema).

**Success:** `200 OK`
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Issue deleted successfully",
  "data": { /* deleted Issue object */ }
}
```

**Errors:**
| Status | Reason |
|--------|--------|
| `403` | User is not `ADMIN` or `OWNER` |
| `404` | Issue not found in this project/workspace |

---

## Important Rules

- **`reporterId` is never accepted from the request body** — it is always set from the authenticated user's JWT `sub`. This prevents impersonation.
- **Every Prisma query must include `workspaceId`** — use `findFirst({ where: { id, workspaceId, projectId } })`, never `findUnique` by id alone. Omitting `workspaceId` is a data breach.
- **Validate project ownership before creating** — always confirm the `projectId` exists in the workspace before creating an issue to prevent cross-workspace data injection.
- **Create and delete** — `@RequirePermission("issue:create")` / `@RequirePermission("issue:delete")`.
- **Update** — field-level, in `IssueService` via `issue-access.ts`, using the `@Access()` the guard attached.
- **VIEWER is read-only** — the built-in Viewer role holds no issue permissions.
