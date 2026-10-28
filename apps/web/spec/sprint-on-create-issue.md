# Sprint Management

## Summary

Sprints are project-scoped. The project tabs follow Jira's Scrum layout: **Board** is the active sprint, **Backlog** plans sprints (create / edit / start / complete, move issues between them), **List** is every issue.

"Backlog" means *not in a sprint*. An issue whose status is `BACKLOG` is moved to `TODO` by the backend when it joins a sprint (on create or on a `sprintId` PATCH), since the board has no BACKLOG lane; leaving a sprint keeps the status. When creating or editing an issue, a sprint can be assigned via a dropdown selector.

## Backend Contracts

**List sprints**
```
GET /projects/:projectId/sprints
Headers: x-workspace-id: <workspaceId>
Response: ApiResponse<Sprint[]>
```

**Create sprint**
```
POST /projects/:projectId/sprints
Body: { name, goal?, startDate?, endDate? }
Response: ApiResponse<Sprint>
```

**Update sprint**
```
PATCH /projects/:projectId/sprints/:sprintId
Body: Partial<{ name, goal, startDate, endDate }>
Response: ApiResponse<Sprint>
```

**Sprint shape**
```ts
Sprint {
  id: string
  name: string
  goal?: string | null
  startDate?: string | null   // ISO 8601
  endDate?: string | null     // ISO 8601
  isActive: boolean
  projectId: string
  workspaceId: string
  createdAt: string
}
```

## Features

### Sprint selector on issues
- Dropdown in create/edit issue form (below Assignee)
- Default: "No Sprint" → `sprintId: null`
- Populated from `GET /projects/:projectId/sprints`
- PATCH payload includes `sprintId` only when it changes

### Board (`/projects/:projectId/board`)
- Lanes hold only the active sprint's issues (`isActive`; the backend allows one per project)
- Sprint strip above the lanes (`SprintSummaryCard`): name, dates, days left / overdue, goal, done-of-total progress (Done = `DONE`, matching what the backend keeps on complete), Complete sprint for OWNER/ADMIN
- "New Issue" from the board starts in the active sprint, in To Do
- No active sprint → empty state linking to the backlog

### List (`/projects/:projectId/issues`)
- Table, newest first: Work (type, key, title), Assignee, Reporter, Priority, Status (inline select), Sprint, Created
- Search (title or key, e.g. `WA-12`), assignee avatar toggles, status and sprint ("Backlog (no sprint)" included) filters — client-side over the cached project list
- Sub-issues nest under their parent behind a chevron; when a filter hides the parent they stand alone with a `↳ WA-3` tag

### Backlog (`/projects/:projectId/backlog`)
- Sections, top to bottom: the active sprint, planned sprints (creation order), then **Backlog** — issues with no open sprint, excluding `DONE`. Completed sprints aren't shown.
- Section header: name, Active chip, dates, issue count, and to-do / in-progress / done counts (`statusCategory` in `features/issues/constants.ts`); collapsible.
- OWNER/ADMIN (`canManageSprints`): Start sprint (disabled while another is active), Complete sprint (shared confirm), edit pencil; "Create sprint" on the Backlog header.
- Rows: type icon, issue key (`WA-12`), title (links to the issue page), status, estimate, priority icon, assignee.
- Moving an issue (`canEditIssueFields`): drag a row onto another section, or the row's ⋯ "Move to" menu. Both PATCH `{ sprintId }` (`null` for the backlog) through the optimistic `useUpdateIssue`.
- Within a section rows sort by priority, then issue number, with each sub-issue kept right under its parent when both are in the section. There is no stored manual order: `rank` orders board lanes, not backlog sections.

## Files

| File | Purpose |
|------|---------|
| `src/features/sprint/types/sprint-types.ts` | Full Sprint type + CreateSprintDto / UpdateSprintDto |
| `src/features/sprint/schema/sprint-schema.ts` | Zod validation (end date ≥ start date) |
| `src/features/sprint/api/sprint-api.ts` | getSprints, createSprint, updateSprint |
| `src/features/sprint/hooks/use-sprints.ts` | useSprints, useCreateSprint, useUpdateSprint |
| `src/features/sprint/components/SprintForm.tsx` | Create/edit form (name, goal, dates) |
| `src/features/sprint/components/SprintFormModal.tsx` | Modal wrapper for SprintForm |
| `src/features/sprint/components/backlog/BacklogView.tsx` | Backlog: sections, drag-and-drop, sprint actions |
| `src/features/sprint/components/backlog/BacklogSection.tsx` | Droppable, collapsible section with header counts |
| `src/features/sprint/components/backlog/BacklogIssueRow.tsx` | Draggable issue row + ⋯ "Move to" menu |
| `src/features/sprint/hooks/use-sprint-actions.ts` | Create / edit / start handlers with toasts |
| `src/features/sprint/components/SprintSummaryCard.tsx` | Sprint strip above the board: dates, days left, progress |
| `src/features/issues/components/list/IssueTable.tsx` | List tab table with nested sub-issues |
| `src/features/issues/components/list/IssueListToolbar.tsx` | List search and filters |
| `src/features/sprint/components/EndSprintModal.tsx` | Complete-sprint confirm, shared by board and backlog |
| `src/app/(dashboard)/projects/[projectId]/backlog/page.tsx` | Backlog route |
| `src/features/projects/components/ProjectHeader.tsx` | Board / Backlog / List tabs |
| `src/features/issues/types/issue-types.ts` | CreateIssueDto / UpdateIssueDto include sprintId |
| `src/features/issues/components/IssueForm.tsx` | Sprint selector field |
| `src/features/issues/components/CreateIssueModal.tsx` | Fetches sprints, passes to IssueForm |
| `src/features/issues/components/IssueDetailComponent.tsx` | Sprint diff in update handler |
| `src/features/issues/components/IssueDetailModal.tsx` | Sprint diff in update handler |

## Sub-issues

One level deep (an issue's sub-issues can't have their own). The issue page shows a **Sub-issues** panel (`SubIssuesPanel`: progress, one row per child, and an inline "Add sub-issue" title field for `canCreateIssue`), which `POST`s `{ title, parentIssueId }`; the backend types the child `SUBTASK` and puts it in the parent's sprint. A sub-issue's page links back to its parent and has no panel. Sub-issues are ordinary rows/cards everywhere else, tagged `↳ WA-3` (`ParentTag`). Moving a parent between sprints does not move its sub-issues.
