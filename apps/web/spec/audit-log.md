# Workspace audit log

## Summary

Settings → **Audit log** (`/settings/audit-log`) lists who changed who is in the workspace and what
they may do: member role changes and removals, members leaving, invitations (sent, revoked,
accepted), custom roles (created, edited, deleted), workspace details, ownership transfers and
subscription changes. Newest first, one page at a time. Issue history is not here — it is read per
issue in the issue's Activity panel.

Code: `src/features/audit/`. The vocabulary (`AUDIT_ENTITY_TYPES`, `AuditAction`, `AuditMetadata`,
`AuditRef`, `AuditSubscriptionState`) is `packages/shared/src/audit.ts`, which the backend writes
with.

## Gating

- Needs the grantable permission `audit:read` (Admin by default; the owner holds everything). The
  role editor labels it "View the audit log" in the Workspace group.
- The web flag is `canReadAuditLog`. Without it the tab is hidden (`SettingsTab.requires`).
- A deep link without the permission, or a 403 from the API, shows a "You can't view the audit
  log" card rather than an error. A 403 is not retried.

## Backend contract

```
GET /audit-log?entityType=&page=&limit=
Headers: x-workspace-id: <workspaceId>
Response: ApiResponse<AuditLogEntry[]> with metaData: PaginationMeta
```

`entityType` is optional, one of `MEMBER`, `INVITATION`, `ROLE`, `WORKSPACE`, `SUBSCRIPTION`.
`page` defaults to 1, `limit` to 20 (max 100).

```ts
AuditLogEntry {
  id: string
  action: AuditAction
  entityType: AuditEntityType
  entityId: string | null
  metadata: AuditMetadata[action]   // names as they were at the time
  createdAt: string                 // ISO 8601
  user: { id, name, avatarUrl } | null  // null = system (Stripe webhook) or a deleted account
}
```

## Page

- Filter: All / Members / Invitations / Roles / Workspace / Billing. Changing it returns to page 1.
- Table: time (`dd MMM yyyy, hh:mm a`), actor (avatar + name), action summary. Role rows that
  carry permissions add a muted line listing them by their role-editor labels.
- Paging: "Page X of Y · N events" with Previous / Next, from `metaData`. The previous page stays
  visible (dimmed) while the next loads.
- Loading spinner; `ErrorAlert` with retry on failure; an empty state per filter.
- The query key includes the workspace, filter, page and limit; switching workspaces starts the
  page over. The log refetches whenever the page mounts.

## Summaries

`lib/describe-audit-event.ts` (pure) gives the predicate; the actor is shown beside it.

| action | summary |
| --- | --- |
| `member.role_changed` | changed Bob's role from Member to Admin |
| `member.removed` | removed Carol (Viewer) |
| `member.left` | left the workspace |
| `invitation.sent` | invited dan@x.com as Member |
| `invitation.revoked` | revoked the invitation to dan@x.com |
| `invitation.accepted` | accepted the invitation (Member) |
| `role.created` | created the role Support |
| `role.updated` | renamed the role Support to Helpdesk / changed the role Support's permissions (+2, −1) — both joined with "and" |
| `role.deleted` | deleted the role Support |
| `workspace.updated` | renamed the workspace from A to B / updated the workspace description |
| `ownership.transferred` | transferred ownership from Alice to Bob |
| `billing.subscription_changed` | Subscription started: Pro (trial) / Subscription: Free → Pro (trial) / Subscription: Pro cancellation scheduled for the end of the period / … cancellation withdrawn |

A subscription state with no Stripe status shows just the plan. An action the build doesn't know
shows its key.

**Actor**: the user's name; with no user, "System" for subscription changes, the member's name for
`member.left`, the email for `invitation.accepted`, otherwise "Deleted user".
