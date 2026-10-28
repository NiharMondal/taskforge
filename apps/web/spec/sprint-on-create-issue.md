# Sprint Management

## Summary

Sprints are project-scoped. The **Current Sprint** tab shows the running sprint and its issues; sprints are planned (created / edited / started / completed) and issues moved between them on the **Backlog** tab. When creating or editing an issue, a sprint can be assigned via a dropdown selector.

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

### Current sprint page (`/projects/:projectId/sprint`)
- The project's active sprint (`isActive`; the backend allows one per project)
- Summary card: name, goal, date range, days left / overdue, done-of-total progress (Done = `DONE`, matching what the backend keeps on end)
- End sprint button (OWNER/ADMIN) → shared confirm dialog
- The sprint's issues, filtered client-side from the cached project issue list and grouped by status (`IssueList`)
- No active sprint → empty state; admins get a link to the backlog

### Backlog (`/projects/:projectId/backlog`)
- Sections, top to bottom: the active sprint, planned sprints (creation order), then **Backlog** — issues with no open sprint, excluding `DONE`. Completed sprints aren't shown.
- Section header: name, Active chip, dates, issue count, and to-do / in-progress / done counts (`statusCategory` in `features/issues/constants.ts`); collapsible.
- OWNER/ADMIN (`canManageSprints`): Start sprint (disabled while another is active), Complete sprint (shared confirm), edit pencil; "Create sprint" on the Backlog header.
- Rows: type icon, issue key (`WA-12`), title (links to the issue page), status, estimate, priority icon, assignee.
- Moving an issue (`canEditIssueFields`): drag a row onto another section, or the row's ⋯ "Move to" menu. Both PATCH `{ sprintId }` (`null` for the backlog) through the optimistic `useUpdateIssue`.
- Within a section rows sort by priority, then issue number. There is no stored manual order: `rank` orders board lanes, not backlog sections.

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
| `src/features/sprint/components/CurrentSprintView.tsx` | Active sprint + its issues |
| `src/features/sprint/components/SprintSummaryCard.tsx` | Active sprint header: dates, days left, progress |
| `src/features/sprint/components/EndSprintModal.tsx` | End-sprint confirm, shared by both pages |
| `src/app/(dashboard)/projects/[projectId]/sprint/page.tsx` | Current sprint route |
| `src/app/(dashboard)/projects/[projectId]/backlog/page.tsx` | Backlog route |
| `src/features/projects/components/ProjectHeader.tsx` | "Current Sprint" and "Backlog" tabs |
| `src/features/issues/types/issue-types.ts` | CreateIssueDto / UpdateIssueDto include sprintId |
| `src/features/issues/components/IssueForm.tsx` | Sprint selector field |
| `src/features/issues/components/CreateIssueModal.tsx` | Fetches sprints, passes to IssueForm |
| `src/features/issues/components/IssueDetailComponent.tsx` | Sprint diff in update handler |
| `src/features/issues/components/IssueDetailModal.tsx` | Sprint diff in update handler |
