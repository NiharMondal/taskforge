# Workflow Module — Backend Spec

## Goal

Let each project choose its own board columns. Today every project has the same eight statuses
(`enum IssueStatus`) and the same allowed moves (`STATUS_TRANSITIONS`). After this, a project's
**workflow** is a set of statuses — name, color, category, order — plus the moves allowed between
them.

- **Free:** every new project gets the default workflow — five statuses, every move allowed — and
  it can't be changed.
- **Pro / Enterprise:** each project's workflow can be edited by anyone holding `project:manage`,
  from the project's **Workflow** tab at any time, and a new project can start from a copy of
  another project's workflow.

## The idea: names are the project's, categories are the code's

A status can be called anything, so no code may test a status by name. Every status has one of
four fixed **categories**, and every rule that used to name a status now reads the category:

| Category | Meaning | Rules that read it |
| --- | --- | --- |
| `BACKLOG` | Not committed to | Hidden from the board. An issue in one that joins a sprint moves to the project's first `UNSTARTED` status (replaces `committedStatus`'s BACKLOG → TODO) |
| `UNSTARTED` | Committed, not begun | Target of the move above. The board's create button starts issues in the first one |
| `STARTED` | In flight | — |
| `COMPLETED` | Finished | Moving an issue into one needs `issue:status:done` (replaces the `DONE` check). Ending a sprint keeps these issues and carries the rest back to the backlog. The board's done count |

`StatusCategory` and its values live in `@taskforge/shared` (`enums.ts`, checked against the schema
by `shared-enums.spec.ts` like the others), with the default workflow and `isAllowedTransition` in
`workflow.ts`. `IssueStatus`, `ISSUE_STATUS_VALUES` and `STATUS_TRANSITIONS` are gone.

## Database Schema

```prisma
enum StatusCategory {
  BACKLOG
  UNSTARTED
  STARTED
  COMPLETED
}

model WorkflowStatus {
  id          String         @id @default(uuid())
  workspaceId String
  projectId   String
  name        String
  color       String         // hex, like a label's
  category    StatusCategory
  // Column order: a fractional-indexing key from @taskforge/shared, like Issue.rank.
  position    String         // COLLATE "C" (set in the migration), as issue rank
  // Where an issue lands when created without a status. Exactly one per project.
  isDefault   Boolean        @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  project   Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)

  issues          Issue[]
  transitionsFrom WorkflowTransition[] @relation("TransitionFrom")
  transitionsTo   WorkflowTransition[] @relation("TransitionTo")

  @@index([workspaceId, projectId])
  @@index([projectId, position])
}

// A move an issue may make. Staying in the same status is always allowed and never stored.
model WorkflowTransition {
  projectId    String
  fromStatusId String
  toStatusId   String

  project    Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  fromStatus WorkflowStatus @relation("TransitionFrom", fields: [fromStatusId], references: [id], onDelete: Cascade)
  toStatus   WorkflowStatus @relation("TransitionTo", fields: [toStatusId], references: [id], onDelete: Cascade)

  @@id([fromStatusId, toStatusId])
  @@index([projectId])
  @@index([toStatusId])
}

model Issue {
  // status IssueStatus  → removed, with enum IssueStatus
  statusId String
  status   WorkflowStatus @relation(fields: [statusId], references: [id], onDelete: NoAction)
  // @@index([workspaceId, status])      → @@index([workspaceId, statusId])
  // @@index([projectId, status, rank])  → @@index([projectId, statusId, rank])
}
```

`NoAction` on `Issue.status`: a status is never deleted with issues still in it (see Deleting).
Not `Restrict`, which Postgres checks immediately: deleting a project or workspace cascades to
both issues and statuses, in either order. Every `WorkflowStatus` read filters on `workspaceId`
and `projectId`, like issues.

### The default workflow

`DEFAULT_WORKFLOW_STATUSES` in `@taskforge/shared` (`workflow.ts`), with every move between them
allowed. `seedDefaultWorkflow(tx, workspaceId, projectId)` (`src/modules/workflows/seed-workflow.ts`)
writes it in the transaction that creates a project — the same pattern as `seedSystemRoles`.
Kept small on purpose: richer workflows (QA, review gates, restricted moves) are what Pro is for.

| Status | Category | Color |
| --- | --- | --- |
| Backlog *(default)* | `BACKLOG` | `#6b7280` |
| To Do | `UNSTARTED` | `#8b5cf6` |
| In Progress | `STARTED` | `#3b82f6` |
| In Review | `STARTED` | `#eab308` |
| Done | `COMPLETED` | `#22c55e` |

Changing the default affects new projects only.

### Starting from another project's workflow

`POST /projects` takes an optional `workflowFromProjectId`: the new project gets a copy of that
project's statuses (new ids; same names, colors, categories, order and default) and moves, instead
of the default. Pro only (`402 customWorkflows` on Free); a project from another workspace is a
`404`. Editing after creation is the same on every project, through the routes below.

### Migration (`custom_workflows`)

One migration, in this order:

1. Create `StatusCategory`, `WorkflowStatus` and `WorkflowTransition`.
2. For every existing project, insert the eight statuses it had (Backlog, To Do, In Progress, In
   Review, QA Requested, QA Failed, Deployed, Done) and the moves `STATUS_TRANSITIONS` allowed, so
   nothing about an existing project changes.
3. Add `Issue.statusId` (nullable), set it by matching each issue's enum value to its project's
   status of that name, make it `NOT NULL`, and swap the two indexes.
4. Drop `Issue.status` and `enum IssueStatus`.

Ranks are kept: each lane maps one-to-one onto a status, so every lane's order survives.

## Rules that hold across every route

- **Plan.** Every write below is refused on Free with **402 `{ code: "PLAN_LIMIT", limit:
  "customWorkflows" }`** (`PLAN_LIMITS.customWorkflows`: false on Free, true on Pro/Enterprise;
  checked in `WorkflowService` through `plan-limits.ts`). Reads are open on every plan.
- **Going back to Free deletes nothing.** A project whose workflow was customized keeps it, and
  its issues keep moving under its transitions; it just can't be edited until the workspace is
  on Pro again.
- **Permission.** Writes need `project:manage` (Owner and Admin by default). No new permission key.
- **Tenant.** Every route goes through `WorkspaceGuard`. A project, status or transition from
  another workspace or another project is a `404`.
- **Names** are trimmed, 1–30 characters (`MAX_STATUS_NAME_LENGTH`), unique in the project
  **ignoring case**. **Colors** are hex (`#22c55e`), as for labels.
- **A workflow stays usable.** Every write is refused with `409` if it would leave the project
  with no `UNSTARTED` status or no `COMPLETED` status (`REQUIRED_STATUS_CATEGORIES`). The default
  can't be deleted (make another the default first). A project has at most 20 statuses
  (`MAX_WORKFLOW_STATUSES`).
- **One editor at a time.** Each write holds a per-project advisory lock
  (`workflow:<projectId>`), so two concurrent deletes can't each remove one of the last two
  `COMPLETED` statuses.

## API Endpoints

Base path: `/projects/:projectId/workflow`

| Method | Route | Who | Does |
| --- | --- | --- | --- |
| `GET` | `/` | Any member | The project's statuses in column order, and its transitions |
| `POST` | `/statuses` | `project:manage`, Pro | Add a status: `{ name, color, category, position? }`. Without `position`, it goes last. It starts with no transitions in or out |
| `PATCH` | `/statuses/:statusId` | `project:manage`, Pro | `{ name?, color?, category?, position?, isDefault? }`. `isDefault: true` makes it the default and clears the previous one; `false` is a `400` (pick another default instead) |
| `DELETE` | `/statuses/:statusId?moveTo=<statusId>` | `project:manage`, Pro | Delete a status. See below |
| `PATCH` | `/transitions` | `project:manage`, Pro | `{ transitions: [{ fromStatusId, toStatusId }] }` replaces every move in the project. Pairs must be distinct, within this project, and not from a status to itself |

`GET` returns:

```json
{
  "statuses": [
    { "id": "…", "name": "Backlog", "color": "#94a3b8", "category": "BACKLOG",
      "position": "a0", "isDefault": true, "issueCount": 12 }
  ],
  "transitions": [{ "fromStatusId": "…", "toStatusId": "…" }]
}
```

`position` is generated with `rankBetween` from the neighbors, as a board drop computes a card's
rank. A key the library can't build on is a `400`; one another status already holds is stored just
after it.

### Deleting a status

Without issues in it, the status and its transitions are deleted. With issues, `moveTo` is
required (`409` "move its issues first" without it): the issues are moved to that status (same
project, not the one being deleted), appended to the end of its lane under the lane lock. One
`issue.updated` history row is written per moved issue. Nothing is checked against transitions:
this is an admin action, not a move made by someone working on the issue.

| Status | Reason |
| --- | --- |
| `400` | Invalid name, color, category, position or transition list |
| `402` | The workspace is on Free |
| `403` | Caller lacks `project:manage` |
| `404` | No such project, status or `moveTo` in this project |
| `409` | Name taken (ignoring case), 20 statuses already, the change would leave no `UNSTARTED` / `COMPLETED` status, deleting the default, or `moveTo` missing for a status with issues |

## Changes to the issue routes (`issue-spec.md`)

- **Bodies:** `status` becomes `statusId` on `POST` and `PATCH`; on `GET` the list filter becomes
  `?statusId=`, and `?sort=status` is gone. A status from another project is a `400`.
- **Responses** carry `statusId` and embed `status: { id, name, color, category }`.
- **Create** without `statusId` uses the project's default status. Any status may be used on
  create, as today; moving into a `COMPLETED` one needs `issue:status:done`.
- **Update:** a `statusId` change must be a stored transition, otherwise `400`. Moving into a
  `COMPLETED` status needs `issue:status:done` (`403`).
- **Joining a sprint** moves an issue in a `BACKLOG`-category status to the project's first
  `UNSTARTED` status (on create, and on a `PATCH` that sets `sprintId` without `statusId`). It
  needs the caller's `issue:status` but **skips the transition check**: it is the sprint that
  moves the issue, and a custom workflow without a Backlog → To Do move shouldn't stop sprint
  planning. A `statusId` sent with the sprint is checked as usual.
- **Rank:** lanes are `(projectId, statusId)`, and the lane lock key becomes
  `issue-lane:<projectId>:<statusId>`. Otherwise unchanged.
- **History:** `status` changes are recorded by status **name** (copied into the row like assignee
  and sprint names), so history survives renames and deletes. Rows written before this hold the
  enum key (`IN_PROGRESS`); the web shows those through a fixed map of the eight old labels.
- **Ending a sprint** carries over issues whose status isn't `COMPLETED`
  (`status: { category: { not: COMPLETED } }`).

## Web (summary)

- `useWorkflow(projectId)`, key `["workflow", workspaceId, projectId]`, replaces `ISSUE_STATUSES`,
  `BOARD_STATUSES` and `STATUS_META`. The board's columns are the non-`BACKLOG` statuses in order.
  A drop is allowed when the move is a stored transition and, into `COMPLETED`, the viewer holds
  `issue:status:done`.
- `StatusChip`, `IssueStatusSelect`, the list's grouping and filters, the create form, the backlog
  view and history read status names and colors from the workflow (or the embedded `status`).
- **The project's Workflow tab** (`/projects/[projectId]/workflow`, `features/workflow/`): reorder
  statuses (up/down), add, rename, recolor, recategorize, make one the default; delete with a
  "move its issues to…" picker; a from × to checkbox grid for the moves, saved as a whole. On Free,
  or without `project:manage`, it is read-only with the reason (and an upgrade link on Free).
- **Creating a project** offers "Workflow: Default / Same as <project>" (locked to Default on
  Free). On Pro the success toast links to the new project's Workflow tab.

## Tests

- **Unit:** `WorkflowService` (each `409` invariant, the default swap, delete with and without
  `moveTo`, the plan and permission checks, tenant isolation); `IssueService` with status ids
  (transition refused, a `COMPLETED` move without `issue:status:done`, a status from another
  project, sprint commit skipping transitions, lane locks keyed by status id); `endSprint` by
  category.
- **e2e:** a new project gets the default workflow; Free gets 402 on every write; Pro adds a
  status and a transition and an issue moves through them; deleting a status with issues requires
  `moveTo` and moves them; another workspace's project or status is a 404.

## Not in this version

- Workspace-level workflow templates (copying one project's workflow to another).
- A `CANCELED` category ("Won't do"). For now that's a `COMPLETED` status.
- Resetting a project to the default workflow.
- Dragging columns to reorder them (the editor uses up/down buttons).
- Per-transition permissions (e.g. only QA may move to Deployed).
