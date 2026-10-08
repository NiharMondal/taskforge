# Taskforge: what to do next

## Context

Taskforge (NestJS backend + Next.js web, pnpm monorepo) is feature-complete for its core loop: auth, workspaces, projects, issues, kanban board, sprints, members and invitations. The monorepo consolidation (1 Oct) and the baseline Prisma migration are done, and the current branch (`removed-baseurl-and-fixed-port-issue`) is one small dev-experience commit ahead of `origin/main`.

The project is not ready to build more features on. A code audit found several **security holes**, a **broken invitation flow**, a few **frontend/backend contract bugs that make the UI show wrong data**, and **no safety net** (no CI, no working tests). The recommendation is to harden and stabilise first, then build features. The phases are ordered by risk, and each one should be its own PR.

Findings marked (V) were re-checked directly in the code. The rest come from the exploration agents' code reading and were not run.

## Phase 0: Land the current branch (about 15 min)

- `git pull` on `main` (local `main` is 3 commits behind `origin/main`).
- Before merging, fix two stale statements this branch made false:
  - [apps/backend/CLAUDE.md:48](apps/backend/CLAUDE.md#L48) still says `generated/...` resolves via `baseUrl: "."`. It now resolves through tsconfig `paths`.
  - [apps/backend/.env.example](apps/backend/.env.example) says `PORT = 5000`, but `main.ts` defaults to 5001.
- Fix the missing space in the root `package.json` `"dev":"pnpm ...` script.
- Merge, then delete the merged stale branches (`chore/monorepo`, `feat/implement-settings-page`, `implement-oauth-functionality`, `improve-date-picker-controller`).

## Phase 1: Backend security and correctness (do first, one PR)

Write a regression test with each fix. The jest path mapping in Phase 3 is a prerequisite, so do that bit first.

1. **Google sign-in account takeover (V).** `POST /auth/google` is `@Public()` and signs a JWT for whatever `{email, googleId}` the caller sends ([auth.service.ts:130-183](apps/backend/src/modules/auth/auth.service.ts#L130-L183)).
   - Fix: the web server forwards Google's `id_token`, and the backend verifies it with `google-auth-library`. Take `email`, `sub` and `picture` from the verified payload and never from the body. Add `GOOGLE_CLIENT_ID` to the backend env.
   - Web change: [apps/web/src/lib/auth.ts:31-57](apps/web/src/lib/auth.ts#L31-L57). Confirm the exact Auth.js v5 hook that exposes `id_token` when implementing (the `profile(profile, tokens)` callback or the `jwt` callback).
   - Also: lowercase emails, make `GoogleAuthDto.image` `@IsOptional()`, delete the unreachable `if (!existingAuth)` branch.
2. **`/users` is open to every logged-in user.**
   - `GET /users` lists all users across all tenants.
   - `PATCH` and `DELETE /users/:id` work on anyone.
   - `avatarPublicId` can be pointed at another user's asset.
   - `emailVerified` in `update-user.dto.ts` is not a column, so sending it returns a 500.
   - Fix: remove the list route and restrict `:id` routes to `req.user.sub`. The web profile page only calls them with the user's own id, so this is compatible. Add `GET /users/me`. Drop `DELETE`, or make it self-only. Remove `emailVerified` from the DTO.
3. **A VIEWER can edit any issue field (V).** `IssueService.update` only restricts `MEMBER` ([issue.service.ts:110](apps/backend/src/modules/issues/issue.service.ts#L110)). Add a VIEWER → 403 check, as the service does for MEMBER (not `@Roles`, which can't gate lower roles; see the RolesGuard gotcha in the backend CLAUDE.md).
4. **Invitation accept is broken (V).**
   - [invitation.service.ts:172](apps/backend/src/modules/invitations/invitation.service.ts#L172) looks up `auth` by `User.id` (the JWT `sub`). It needs `where: { userId }`. Nobody can currently join a workspace through an invitation.
   - [invitation.service.ts:44-52](apps/backend/src/modules/invitations/invitation.service.ts#L44-L52) uses `Auth.id` as a membership `userId`, so the "already a member" check never fires.
   - Related fixes in the same file:
     - Reject `OWNER` in `SendInvitationDto`.
     - Stop returning `token` from `GET /invitations`.
     - HTML-escape names in the email body.
     - Require the `token` query param on `/invitations/validate`.
     - Lowercase emails when matching.
     - Treat an expired PENDING invite as re-invitable.
5. **`WorkspaceGuard` prefers the header over the path param** ([workspace.guard.ts:23-26](apps/backend/src/common/guards/workspace.guard.ts#L23-L26)). `DELETE /workspaces/B` with header A deletes A. Require the two to match when both are present.
6. **Hardening:**
   - Add `@nestjs/throttler` on auth routes and `helmet`.
   - Return 401 rather than 403 for a missing token ([jwt-auth.guard.ts:27](apps/backend/src/common/guards/jwt-auth.guard.ts#L27)).
   - Add `enableShutdownHooks()`.
   - Add `onDelete` rules for `Auth`, `OAuthAccount` and `Invitation` via a new migration.
   - Add the missing `workspaceId` filter to `sprint.service.ts:108-116`.
   - Replace the realistic JWT secret in `.env.example` with a placeholder.

## Phase 2: Fix the web/backend contract and visible bugs (one PR, web-heavy)

1. **Issues are capped at 20 per project (V).**
   - The backend paginates (`limit` defaults to 20, max 100) and the web sends no params ([issue-api.ts:25-29](apps/web/src/features/issues/api/issue-api.ts#L25-L29)). The board and list silently drop everything older than the newest 20.
   - Stop-gap: `getIssues` loops pages until `metaData` says it is done, and `metaData` is added to the `ApiResponse` type ([apps/web/src/types/api.ts](apps/web/src/types/api.ts)).
   - Proper fix, later: per-lane pagination on the board.
2. **Stored XSS (V).** [IssueContentForm.tsx:116](apps/web/src/features/issues/components/IssueContentForm.tsx#L116) renders issue-description HTML with `dangerouslySetInnerHTML` and there is no sanitizer dependency. Add DOMPurify at render time. Also remove the stray `role="button"` on the read-only div.
3. **Data that never shows or never saves:**
   - Workspace `description` is dropped by the backend DTOs.
   - The profile email is read from `user.email`, but the API returns `user.auth.email`.
   - Member emails are never selected ([membership.service.ts:15-21](apps/backend/src/modules/memberships/membership.service.ts#L15-L21)).
   - Clearing an issue description sends `{}` and shows a success toast.
   - Fix the DTOs, selects and types together, and update the hand-written types in `apps/web/src/features/*/types/`.
4. **Sprint lifecycle is unreachable.** Add Start and End actions to `SprintsView` (the endpoints exist). Switch the sprint PATCH to `UpdateSprintDto` (name is currently required on every update).
5. **Role-aware UI.** Hide or disable "New Issue", edit controls and board drag for roles the backend will reject (VIEWER everywhere, MEMBER on admin-only fields). Today users get a 403 toast.
6. **Small behaviour bugs:**
   - `login-form.tsx:48-54` shows "Logged in successfully" for any non-`invalid_credentials` failure.
   - `getApiErrorMessage(error || "fallback")` misuse in 6 files.
   - Board "New Issue" creates BACKLOG issues the board hides.
   - Optimistic toast fires before the PATCH resolves.
   - `ProjectCard` edit modal is titled "Create New Project".
   - `bg-content1` and `text-default-400` are not defined tokens.
   - Invalidate `projectKeys` after creating an issue or sprint.
   - Navigate away from `/projects/<id>/...` when the workspace switches.
7. **Error boundaries.** Add `error.tsx`, `not-found.tsx` and `loading.tsx` under `src/app`. Add `isError` handling to the hooks listed in the audit (ProjectComponent, SprintsView, IssueDetail*, GeneralSettings, ProfileSettings).

## Phase 3: Safety net: tests, CI and config (one PR)

- **Fix jest:** add `moduleNameMapper` for `^@/(.*)$` and `^generated/(.*)$` in both the `package.json` jest block and `test/jest-e2e.json`. Fix the stale "Hello World!" assertions, which don't match "Hello from NestJs!".
- **Tests worth having first:** the guard chain (`WorkspaceGuard`, `RolesGuard`), tenant isolation on issues, sprints and memberships, the issue role rules, and invitation send and accept. The e2e tests need a Postgres service, so add `docker-compose.yml` with one.
- **CI:** add `.github/workflows/ci.yml` running `pnpm install`, `prisma generate`, lint (check-only), `tsc --noEmit` for web, build both apps and test. Root `pnpm lint` currently runs `eslint --fix`, so add a non-mutating script for CI.
- **Config hygiene:**
  - Sync both `.env.example` files with what the code reads: port 5001, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, the `NEXT_PUBLIC_CLOUDINARY_*` prefix, and the "multi-tennant" typo.
  - Make CORS origins an env var in `main.ts`.
  - Dedupe the API URL default in `lib/auth.ts` and `lib/axios.ts`.
  - Remove the unused `api.put` so PATCH-only stays enforced.
  - Remove unused `cookie-parser` and `slugify`.

## Phase 4: Features (after the above; needs your product call)

The schema already has models with no code: `Comment`, `Label` and `IssueLabel`, `AuditLog` and `Subscription`. Suggested order:

1. **Comments**, which is the most visible gap for an issue tracker.
2. **Labels.**
3. **Issue `type`, `parentIssueId` (sub-issues) and `timeEstimate`.** These are in the schema but absent from the DTOs and web types.
4. **Workspace ownership transfer and leave-workspace.** An error message already refers to a transfer endpoint that doesn't exist.
5. **Refresh tokens** (tokens last 1 day and the web force-signs-out on 401).
6. **Audit log**, then billing (`Subscription`). The "Upgrade Plan" button currently goes nowhere.

## Phase 5: Docs cleanup (can ride along with any PR)

- [apps/backend/CLAUDE.md](apps/backend/CLAUDE.md) claims `?sort=rank` works, but `QueryIssuesDto` has no `sort` field, so the whitelist pipe strips it. This comes from code reading and should be confirmed with a live request. Also fix the `baseUrl` line.
- [apps/backend/src/modules/auth/CLAUDE.md](apps/backend/src/modules/auth/CLAUDE.md) lines 15 and 19: `RolesGuard` is not global, and it throws rather than deferring.
- `apps/web/.claude/schema.prisma` and `BACK_END_API.md` have drifted badly (no `Auth`, `OAuthAccount`, `avatarPublicId` and so on). Regenerate them or delete them so nothing treats them as the contract.
- `apps/web/spec/projects.md` is stale (mock data), and `layout.md` describes a workspace-switch endpoint that was deliberately not built.
- Backend specs (`apps/backend/spec/`) are gitignored, so they vanish on a fresh clone even though the root CLAUDE.md points readers to them. Commit them or move the content into tracked docs. `issue-spec.md` also lists 5 statuses where the schema has 8.
- Replace the boilerplate READMEs in both apps. Add a LICENSE.

## Verification

- **Phase 1:** run the new tests for each fix.
  - Forge a body to `POST /auth/google` and confirm it is rejected.
  - Call `GET /users` and `PATCH /users/<other id>` and confirm 403 or 404.
  - Send `PATCH /issues/:id` as a VIEWER and confirm 403.
  - Send, then accept, an invitation as the invited user, and confirm a Membership row is created.
  - Send `DELETE /workspaces/B` with header A and confirm it is rejected.
- **Phase 2:**
  - Seed more than 20 issues in one project and confirm that the board and list show all of them.
  - Put `<img src=x onerror=alert(1)>` in a description and confirm it does not execute.
  - Confirm that the workspace description persists and that profile and member emails render.
  - Confirm a sprint can go through start and end.
  - Confirm a VIEWER sees no edit controls.
- **Phase 3:** CI is green on a PR, and `pnpm --filter @taskforge/backend test` and `test:e2e` pass locally.
- **All phases:** `pnpm build`, `pnpm lint`, and `npx tsc --noEmit` in `apps/web`. Then smoke-test the stack with `pnpm dev` (register, create a workspace, project, issue and sprint, invite a member).
