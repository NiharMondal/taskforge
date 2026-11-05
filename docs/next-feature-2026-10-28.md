# What to build next — 2026-10-28

- **Baseline:** branch `implement-active-sprint-backlog` at `277e2bf`, 26 commits ahead of `origin/develop`.
- **Inputs:** `docs/roadmap.md`, `docs/gap-audit-2026-10-27.md`, the root and app `CLAUDE.md` files, `apps/backend/prisma/schema.prisma`, and a read of both apps' modules and features.

## Recommendation, in one line

Finish the backlog branch by wiring **issue `type` and `timeEstimate`** through the API and forms, merge it, then build **issue comments** as the next feature.

---

## Where the project stands

The hardening work is done. Every High item in the gap audit is fixed or closed by decision (H8). Almost every Medium and Low item is fixed too. CI checks lint, types, the build, unit tests, migration drift and e2e. The roadmap's Phases 0–3 are effectively complete.

Since the audit, the feature work has gone into planning and tracking issues:

| Shipped | Commit |
| --- | --- |
| Project keys and issue numbers (`WA-12`) | `1427641` |
| Sub-issues (`parentIssueId`, `SUBTASK`) | `6b44176` |
| Joining a sprint moves an issue out of `BACKLOG` | `4bc9320` |
| Project tabs: Active Sprint, Backlog, List | `3deb8dd`, `277e2bf` |
| Search, filters, `sort`, issue pagination walked by the web | earlier |

The schema still has four models that no code uses:

| Model | Backend module | Web feature |
| --- | --- | --- |
| `Comment` | none | none |
| `Label` / `IssueLabel` | none | none |
| `AuditLog` | none | none |
| `Subscription` | none | none ("Upgrade Plan" goes nowhere) |

---

## Step 1 — Finish the current branch: issue type and estimates

**Why this comes first.** The Backlog view this branch adds has an estimate column (`BacklogIssueRow.tsx:139`). That column always shows "–", because nothing can set `timeEstimate`. It isn't in `CreateIssueDto` or `UpdateIssueDto`. The same goes for `type`: the backend only ever sets `SUBTASK` automatically, for a child issue. Every other issue stays `TASK`, so the type icons the backlog shows carry no information. Both columns and the enum have been in the schema from the start, and the web `Issue` type already reads them. Only the write path is missing.

This is small, it uses no new tables, and it makes the feature this branch adds work properly. Do it on this branch, before merging.

**Backend**
- Add `type` (`IssueType`, but reject `SUBTASK` on create; a sub-issue gets it from its parent) and `timeEstimate` (`Int`, ≥ 0, with a sensible max) to `CreateIssueDto` and `UpdateIssueDto`.
- Add both fields to the field allow-list in `src/common/permissions/issue-access.ts`. They are content fields, so they fall under `issue:edit:any` / `issue:edit:own`.
- Decide what changing `type` means for an issue with sub-issues or a parent. The simplest rule: `SUBTASK` can't be set or removed by PATCH.
- Update `apps/backend/spec/issue-spec.md`.

**Web**
- A type select and an estimate input in `IssueForm` / `IssueDetailsPanel`, with the Zod schema matching the backend's limits.
- Totals in each `BacklogSection` header (sum of estimates, plus the issue count it shows already). This is what makes the estimate field useful in planning.

**Decide before coding:** is `timeEstimate` story points or hours? The column name says time; the backlog UI treats it like points. Pick one and label it clearly. Points are the usual choice for sprint planning, and you can rename the column later only with a migration.

> **Status: done (2026-10-28), not committed yet.**
> - `timeEstimate` holds **story points**: a whole number from 0 to 100, or `null`. The column keeps its name, and the UI says "Story points".
> - `type` and `timeEstimate` are on both DTOs and in the field allow-list as content fields. `SUBTASK` can't be sent; sending a `type` with `parentIssueId` is a 400, and so is changing a sub-issue's type. A sub-issue can still be estimated.
> - Web: Type and Story points fields on the create form and in the Details panel (the Type select is locked for a sub-issue). Each backlog section header shows its total, e.g. "(5 issues · 13 points)". The total counts sub-issues too, so estimate a parent or its sub-issues, not both.
> - Tests: `issue.service.spec.ts` (permissions, the sub-issue rules, writes) and a new `dto/issue-dto.spec.ts` (validation). `issue-spec.md` and `apps/backend/CLAUDE.md` are updated.
> - Not checked: e2e (needs Postgres) and the UI in a browser.

**Then:** open the PR from `implement-active-sprint-backlog` into `develop`. 26 commits is already a large review; adding more features to the branch makes it harder.

---

## Step 2 — The next feature: issue comments

### Why comments, and not something else

- **It is the biggest gap for an issue tracker.** People can create, plan and move issues, but they can't discuss them. Every decision has to happen outside the app. The roadmap ranks it first in Phase 4 for the same reason.
- **The groundwork is done.** The `Comment` model, its `issueId` index and the cascade on issue delete already exist. The rich text editor (Tiptap) and the sanitizer (`lib/sanitize-html.ts`, DOMPurify) used for descriptions can be reused as they are.
- **It is a good size.** It needs one backend module, one web panel, a permissions migration, and tests. It touches tenancy and permissions in a way that's easy to reason about.
- **Later features build on it.** Mentions, notifications and the activity feed all start from a comment thread.

### Why not the alternatives yet

| Candidate | Why it waits |
| --- | --- |
| Labels | Useful, but less important than discussion. It also brings a workspace-level management screen and filter changes. A good next step after comments. |
| Activity log (`AuditLog`) | Most valuable once there are more events to record. Comments are one of those events, so build them first. |
| Ownership transfer and leave workspace | Needed. `membership.service.ts:103` already mentions a "transferOwnership API" that doesn't exist. But few users hit it day to day. |
| Custom roles UI | Listed as a known gap. It's a large piece of work with no user-facing feature attached. Better done together with moving the web app from its own copy of the permission rules to `GET /memberships/me`. |
| Email verification and refresh tokens | Real security and session improvements (they close what is left of H1). Plan them as a security pass, not as the next feature. |
| Billing (`Subscription`) | Last. It needs Stripe, product decisions about plans, and webhooks. |

### Scope

**In:** list, add, edit and delete comments on an issue, in the issue modal and on the issue detail page.

**Out (later):** @mentions, email or in-app notifications, reactions, real-time updates, attachments, comment history.

### Backend

**Data model.** Use the existing `Comment` as it is. It has no `workspaceId`, so every query must reach the tenant through the issue:

```ts
where: { id: commentId, issue: { id: issueId, projectId, workspaceId } }
```

This follows the root `CLAUDE.md` rule that every workspace-scoped query filters on `workspaceId`. Adding a `workspaceId` column to `Comment` is optional. It's worth considering only if comments will later be queried across issues, for example in a "my recent comments" view.

**Routes**, nested under the existing project-scoped issue routes, with `WorkspaceGuard`, and returning `sendResponse()`:

| Method | Route | Who |
| --- | --- | --- |
| `GET` | `/projects/:projectId/issues/:issueId/comments` | any member (including VIEWER) |
| `POST` | `/projects/:projectId/issues/:issueId/comments` | `comment:create` |
| `PATCH` | `/projects/:projectId/issues/:issueId/comments/:commentId` | the author only |
| `DELETE` | `/projects/:projectId/issues/:issueId/comments/:commentId` | the author, or `comment:delete:any` |

- The list is oldest first. Include `user { id, name, avatarUrl }`. Return the full list for now. A long thread can be paginated later.
- `content`: non-empty after trimming, with a max length in the range of the description's 2000 (it is HTML, so the same note about formatting counting applies).
- Store HTML as sent; the web sanitizes at render, as it does for descriptions.
- Optionally add `_count: { comments }` to the issue list response, so cards and rows can show a comment count.

**Permissions.** Two new keys in `src/common/permissions/permissions.ts`:

- `comment:create` — granted to ADMIN and MEMBER.
- `comment:delete:any` — granted to ADMIN (moderation).

As the comment in `permissions.ts` says, stored roles don't pick up new keys. Ship a migration that appends the keys to the existing ADMIN and MEMBER `Role` rows, and update `DEFAULT_ROLE_PERMISSIONS` so new workspaces get them too.

**Decide before coding:** can a VIEWER comment? The proposal above says no, which keeps VIEWER strictly read-only. Many trackers let viewers comment ("commenter" roles). If you want that, give VIEWER `comment:create` in the same migration.

### Web

- A new feature folder, `src/features/comments/` (`api/`, `hooks/`, `components/`, `types/`, `schema/`), following `apps/web/CLAUDE.md`.
- Query key: `["comments", workspaceId, projectId, issueId]`. Every API call pinned with `inWorkspace(workspaceId)`.
- A `CommentsPanel` placed below `SubIssuesPanel` in `IssueDetailComponent`: the thread, then an editor to add a comment. Each comment has edit and delete for whoever is allowed.
- Reuse the Tiptap editor and `sanitizeHtml` from the description.
- Add the matching flags (`canComment`, `canDeleteAnyComment`) to `features/memberships/lib/permissions.ts`, as long as the web app keeps its own copy of the rules.
- If the backend adds `_count.comments`, show a small comment count on `BoardIssueCard` and the list rows.

### Tests

- **Unit** (`comment.service.spec.ts`): only the author can edit; author or `comment:delete:any` can delete; empty or too-long content is a 400; a comment on an issue in another project is a 404.
- **E2E**: a member of workspace B can't list, edit or delete a comment in workspace A by guessing ids (extend `test/tenancy.e2e-spec.ts`); deleting an issue removes its comments.

### Done when

- A MEMBER can comment on an issue and edit or delete their own comment. An ADMIN can delete anyone's comment. A VIEWER sees comments but no editor (unless you decide otherwise).
- `<img src=x onerror=alert(1)>` in a comment doesn't run.
- `pnpm lint:check`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e` pass, and CI's migration diff is clean.
- `apps/backend/spec/` has a comment spec, and the web types match the controller.

> **Status: done (2026-10-28) on branch `feat/issue-comments`, stacked on `implement-active-sprint-backlog` (PR #47). Not committed yet.**
> - Decided: a **VIEWER can't comment** (read-only, as proposed). Nobody, the owner included, can edit someone else's comment. An author who loses `comment:create` (e.g. demoted to Viewer) can no longer edit or delete their own comments.
> - Backend: `src/modules/comments/` with the four routes; two new permission keys; migration `20261028170000_comment_permissions` grants them to existing Admin and Member roles (applied to the local dev database: 4 workspaces, as expected). The issue list now embeds `_count.comments`. Spec: `apps/backend/spec/comment-spec.md`.
> - Web: `src/features/comments/` (`CommentsPanel` on the issue page and in the issue modal), `canComment` / `canDeleteAnyComment` flags, `userId` from `useWorkspacePermissions`, and a comment count on board cards.
> - Tests: `comment.service.spec.ts` and `comment-dto.spec.ts` (unit); the e2e tenancy spec covers isolation, authorship and the cascade on issue delete. 280 unit tests pass.
> - Not checked: the e2e run (left to CI; no local Postgres for e2e) and the UI in a browser, including the `<img src=x onerror=alert(1)>` check (comments render through the same `sanitizeHtml` as descriptions).

---

## After that

A suggested order, each as its own PR:

1. **Labels.** Workspace labels (`Label` already has `@@unique([workspaceId, name])`), a label picker on issues, a label filter in `IssueFilterBar`.
   > **Status: done (2026-10-29) on branch `feat/labels`, not committed yet.** Admins manage labels in Settings → Labels (new `label:manage` permission; migration `20261029090000_label_permissions` grants it to existing Admin roles). Issues take up to 10 labels (`labelIds`), set like any other content field, and show them on board cards, list and backlog rows. The board and the List tab filter by label (any of the picked ones). Names are unique per workspace ignoring case; colors come from a fixed palette. Spec: `apps/backend/spec/label-spec.md`. Not checked: the e2e run (left to CI) and the UI in a browser.
2. **Issue activity.** Write `AuditLog` rows for issue changes (status, assignee, sprint, comments) and show them in the issue detail, mixed with comments.
   > **Status: done (2026-10-29) on branch `feat/issue-activity-history-with-audit-log`, stacked on `feat/labels`. Not committed yet.** Every issue create and every save that changes a tracked field (title, description, status, priority, type, story points, assignee, sprint, labels) writes an `AuditLog` row in the same transaction, with names copied in; board reorders don't. A moderator deleting someone else's comment is recorded too. `GET /projects/:projectId/issues/:issueId/activity` serves it to any member. The issue page's Comments section is now **Activity** (All / Comments / History), and `CommentsPanel` is replaced by `IssueActivityPanel`. Migration `20261029120000_audit_log_entity_history_index` swaps the single-column `workspaceId` index for one that serves the timeline. Spec: `apps/backend/spec/activity-spec.md`. Not checked: the e2e run (left to CI) and the UI in a browser.
3. **Ownership transfer and leave workspace.**
   > **Status: done (2026-10-29) on branch `feat/workspace-ownership-transfer-and-leave-workspace`, stacked on `feat/issue-activity-history-with-audit-log`. Not committed yet.** `POST /memberships/transfer-ownership` (owner only, through the new owner-only `workspace:transfer` permission, so no migration) makes another member the owner and the old owner an admin, in one transaction that refuses a racing second transfer. `DELETE /memberships/me` lets anyone but the owner leave, except from their only workspace. Settings → General gains a **Transfer ownership** card (owner) and a **Leave workspace** card (everyone else). Spec: `apps/backend/spec/membership-spec.md`. Not checked: the e2e run (left to CI) and the UI in a browser. Not done: unassigning a departing member's issues (they keep the assignee, as removal already did).
4. **Security pass:** email verification at registration, refresh tokens, and the remaining `forbidNonWhitelisted` audit from the gap audit.
   > **Status: done (2026-10-29) on branch `feat/email-verification-refresh-tokens-and-strict-validation`, stacked on `feat/workspace-ownership-transfer-and-leave-workspace`. Not committed yet.**
   > - **Email verification.** `POST /auth/register` now creates nothing: it stores a `PendingRegistration` and emails a `/verify-email` link (24 hours; at most 3 per address per 15 minutes). It answers 202 for every address — a taken one gets a "you already have an account" email instead — so it no longer reveals who is registered. `POST /auth/verify-email` creates the account and signs in; the web's `/verify-email` page does that through a new Auth.js `email-verification` provider, after a click. Password accounts registered before this are unverified: their password gets a 403 until they register again.
   > - **Refresh tokens.** Access tokens last 15 minutes. Every sign-in also returns a refresh token (30 days, stored hashed, replaced on every `POST /auth/refresh`; a replaced token reused after 60 seconds revokes its whole family). `POST /auth/logout` revokes one, and Auth.js's sign-out calls it. The web keeps the refresh token in the JWT cookie only, renews 5 minutes before expiry, and on a 401 renews once and retries before signing out.
   > - **`forbidNonWhitelisted`.** On, after auditing every web request against its DTO (none sends an undeclared key). Specs share `VALIDATION_PIPE_OPTIONS`.
   > - Migration `20261029150000_email_verification_and_refresh_tokens` (two new tables; applied to the local dev database). Spec: `apps/backend/spec/auth-spec.md`; `apps/web/spec/auth.md` updated.
   > - Not checked: the e2e run (left to CI), real SMTP delivery, and the flows in a browser. Not done: password reset, email change, and `trust proxy` for the throttler (the web app's server-side login calls still share one bucket).
5. **Custom roles UI**, together with the web reading `GET /memberships/me` instead of its own copy of the rules.
   > **Status: done (2026-10-29) on branch `feat/custom-workspace-roles-and-server-driven-permissions`, stacked on `feat/email-verification-refresh-tokens-and-strict-validation`. Not committed yet.**
   > - **Backend.** `src/modules/roles/`: `GET /roles` (any member: every role with its permissions and member count), and `POST`/`PATCH`/`DELETE /roles` with `role:manage` for custom roles. The four built-ins are read-only, so the grant migrations that extend them by `systemKey` stay correct. Names are unique ignoring case. A role held by a member or a live invitation can't be deleted (409). Nobody creates, edits, deletes or hands out a role with permissions they don't hold. `PATCH /memberships/:userId` and `POST /invitations` take a `roleId` (custom roles included; the built-in `role` enum still works), and roster rows, invitations and the invite preview carry the role's name. No migration was needed. Spec: `apps/backend/spec/role-spec.md`.
   > - **Web.** Permission flags now come from `GET /memberships/me`, so the web keeps no copy of the role rules. That fixes the MEMBER drift: members see "create issue" and can edit issues they reported or are assigned to (`canEditIssue`, per issue, also in the backlog). The new **Settings → Roles** tab lists the roles. Custom roles can be created from scratch or copied from any role, then edited and deleted; built-ins are view-only, and permissions the viewer doesn't hold are greyed out. The Members tab and the invite form pick from the real role list, offering only roles the viewer could hand out and locking members with more access. `isManager` is gone, replaced by `canManageWorkspace`, `canManageMembers`, `canManageInvitations` and `canManageRoles`.
   > - Not checked: the e2e run (left to CI) and the UI in a browser.
6. **Billing.**

Still open from the gap audit, small enough to pick up alongside any of these:

- Pagination on the projects, sprints, memberships, invitations and workspaces lists.
  > **Status: done (2026-10-29) on branch `feat/paginate-list-endpoints`, stacked on `feat/custom-workspace-roles-and-server-driven-permissions`. Not committed yet.** The five list routes take `?page=` and `?limit=` (`PaginationQueryDto`: default 20, max 100, shared with `QueryIssuesDto`) and return `metaData`, through `PrismaQueryBuilder`. The builder now ends every sort with `id`, so rows sharing a `createdAt` can't repeat or go missing between pages. The roster gains an order (oldest member first; it had none). The web reads every page through the new `getAllPages` (`src/lib/get-all-pages.ts`), which `getIssues` now uses too, so no screen changes. Not done: paging controls in the UI (the Projects page, Members and Invitations could page for real instead of loading everything). Not checked: the e2e run (left to CI) and the UI in a browser.
- Whether ADMINs may demote or remove other ADMINs, and whether `GET /workspaces/:id` should stay OWNER/ADMIN only.
  > **Status: done (2026-10-29) on branch `fix/strict-member-management-and-open-workspace-read`, stacked on `feat/paginate-list-endpoints`. Not committed yet.**
  > - **Decided: no.** Changing or removing a member needs every permission they hold plus at least one more (`assertActorOutranks`). Two Admins, or two holders of the same custom role, can't demote or remove each other; the owner can, since only the owner holds `workspace:delete` and `workspace:transfer`. Handing out a role keeps the old rule, so an Admin can still make someone an Admin. The Members tab locks the same rows (`outranks`), and a row predating roles is now judged by its built-in role.
  > - **Decided: open it.** `GET /workspaces/:id` needs membership only: `GET /workspaces` already gave every member the same row. The service's second membership lookup is gone.
  > - Tests: unit tests for Admin vs Admin, owner vs Admin, custom-role peers and `WorkspaceService.findOne`; the e2e spec checks a Member can read but not edit the workspace, and an outsider gets a 403. Not checked: the e2e run (left to CI) and the UI in a browser.
- Two people dropping a card into the same gap can still get the same rank (H7's remainder).
  > **Status: done (2026-10-29) on branch `fix/rank-collision-on-concurrent-drop`, stacked on `fix/strict-member-management-and-open-workspace-read`. Not committed yet.** A PATCH that sends a `rank` now runs in its target lane's advisory lock, like appends already did, and `freeRank` checks the key under it: if another card in the lane holds it, the card goes just after that one (between it and the next card). No schema change, no web change (the board refetches after every PATCH). Not done: a unique index on `(projectId, status, rank)` as a backstop; it would need existing duplicates cleaned first, and every rank write already serializes on the lock. Not checked: the e2e run (left to CI).
- Moving shared code (rank helpers, enums, API types) into `packages/`.
  > **Status: done (2026-10-29) on branch `refactor/shared-package`, stacked on `fix/rank-collision-on-concurrent-drop`. Not committed yet.** New `packages/shared` (`@taskforge/shared`), TypeScript source with no build step: the schema's enums as string unions (checked against Prisma by `shared-enums.spec.ts`), the permission catalog and built-in defaults, `STATUS_TRANSITIONS`, the rank helpers (now the only dependent of `fractional-indexing`), the field limits both DTOs and forms enforce, and `ApiResponse`/`PaginationMeta`. Both apps import from it; the backend's `permissions.ts` and `status-transitions.ts` are gone, and the web's mirrored copies (transitions, catalog, limits, role names) with them. Wiring: Next `transpilePackages`; the backend's webpack bundles it (`webpack-node-externals` allowlist, now a direct devDependency); Jest and tsx load the source. One behaviour change: registering now needs an 8-character password on the backend too (it accepted 6, the form already asked for 8). Checked: both builds, the built backend boots, typecheck, lint and unit tests. Not checked: the e2e run (left to CI), `next dev` and the UI in a browser. Not linted: `packages/shared` has no ESLint setup of its own.
- The web app has no test runner.
