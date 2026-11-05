# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
pnpm dev        # start dev server (localhost:3000)
pnpm build      # production build
pnpm lint       # run ESLint
pnpm add <pkg>  # install packages (always use pnpm, not npm/yarn)
```

No test runner is configured — there are no tests to run. Type-check with `pnpm typecheck` (`next typegen` then `tsc --noEmit`; plain `tsc` misses the generated route types).

Requires `.env.local` (copy `.env.example`): `NEXT_PUBLIC_API_URL` (backend base, defaults to `http://localhost:5001/api/v1`), `AUTH_SECRET`, `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (Google sign-in; without them the OAuth redirect carries `client_id=undefined`), plus `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` / `NEXT_PUBLIC_CLOUDINARY_PRESET_NAME` for avatar upload. The API base URL default lives once, in `src/lib/api-url.ts`.

Path alias: `@/*` → `./src/*`.

## Reference docs (read before designing anything)

The backend lives alongside this app at `../backend/` (see the root `CLAUDE.md`). Its `prisma/schema.prisma` (data model) and `src/modules/*/` controllers (routes and payloads) are the contract — read them directly. Types in `features/*/types/` mirror them by hand. **Every update is PATCH**, never PUT.

- `.claude/AI_GUIDE.md` — project-level architectural rules (workspace scoping, optimistic updates, no monolithic components).
- `.claude/FORM_GUIDE.md` — the canonical form pattern with a worked example.
- `.claude/migrations/` — historical schema-change notes from the two-repo era (all applied).
- `spec/` — feature specs written before implementation (`auth.md`, `layout.md`, `projects.md`, `cloudinary.md`, `sprint-on-create-issue.md`). These document backend contracts and intended UX; consult the relevant one before changing a feature.

Never invent an API shape. If a contract is unclear, ask rather than guess.

## Architecture

This is a **Next.js 16** App Router project (not Next.js 13/14/15 — APIs may differ). The file previously called `middleware.ts` is now `src/proxy.ts`. Check `node_modules/next/dist/docs/` before writing unfamiliar Next.js code.

### Multi-tenant model

Every workspace is a tenant. The active workspace is stored in `localStorage` (`taskforge.activeWorkspaceId`) and surfaced via `useWorkspace()` (from `src/features/workspace/context/workspace-context.tsx`). Every API request carries it as `x-workspace-id`. **Workspace-scoped API functions take `workspaceId` as their first argument and pass `inWorkspace(workspaceId)` (`src/lib/axios.ts`) as the request config** — the hook supplies the same id it keys the cache by, so a response can only land in the cache entry of the workspace it was fetched for. The interceptor only falls back to the active workspace for requests that don't name one. Switching workspaces invalidates nothing: the new workspace's queries load under their own keys, and invalidating would refetch the old workspace's still-mounted queries (which is how B's data once got stored under A's key).

Auth tokens identify the *user*; the workspace header identifies the *tenant*. A user belongs to many workspaces, so the header **is** the workspace switch. Issue/project query keys include both `workspaceId` and `projectId` so cache entries never leak across tenants or projects.

`WorkspaceProvider` pushes the active id into `lib/active-workspace.ts` *during render* (not in an effect) so the first scoped request already carries the right tenant.

### Routing

```
app/
  (marketing)/      — public site: landing (`/`), pricing, terms, privacy (own header/footer)
  (auth)/           — login, register, verify-email: split screen, form + brand panel, header back to `/`
  (dashboard)/      — server layout gates auth, wraps AppLayout
    dashboard/
    projects/
      [projectId]/
        active-sprint/ — the active sprint's kanban (no active sprint → empty state)
        backlog/    — sprint planning: sprint sections + unscheduled backlog, move issues between them
        list/       — every issue as a filterable table, sub-issues nested
          [slug]/   — issue detail page ([slug] is the issue id)
        workflow/   — the project's statuses and allowed moves (editable on Pro)
    settings/       — members, roles, general, labels, billing, profile
    issues/         — redirect → /projects (no workspace-wide issues endpoint)
  invitations/accept/
```

Issues are project-scoped: pages live under `/projects/[projectId]/` (`active-sprint`, `backlog`, `list`, `list/[slug]`, `workflow`); the backend route is still `/projects/:projectId/issues`. `/` is the public landing page; it sends a signed-in visitor to `/dashboard` (it reads `auth()` itself, since the proxy lets everyone through to public routes). `/pricing` renders the same `PlanCard`s as Settings → Billing (`features/billing/components/PlanCard.tsx`, from `PLAN_META`) with links to `/register`. The Terms and Privacy pages are placeholders (marked "Draft" on the page) until the real text is written; the register form links to both. "Sign out" in the workspace menu lands on `/`; a session that expires lands on `/login`. The public pages and the auth layout share `BoardPreview` (`features/marketing/components/`, a static decorative board) and the `.hero-glow`, `.grid-pattern` and `.brand-panel` backgrounds in `globals.css`.

### Feature structure

Each domain lives in `src/features/<name>/` (`activity`, `auth`, `billing`, `comments`, `dashboard`, `invitations`, `issues`, `labels`, `marketing`, `memberships`, `profile`, `projects`, `roles`, `settings`, `sprint`, `workflow`, `workspace`):

```
api/          — async functions calling `api.*` from lib/axios
components/   — React components for this feature
hooks/        — React Query hooks (useQuery / useMutation wrappers)
schema/       — Zod schemas for form validation
types/        — TypeScript interfaces matching backend shapes
constants.ts  — display metadata for enums (labels, ordering, chip colors)
```

Shared UI primitives go in `src/components/` (`ui/`, `form-element/`); layout components (sidebar, header) in `src/components/layout/`. Values the API also enforces — enums, field limits, the permission catalog, status transitions, rank helpers, the response envelope — come from `@taskforge/shared` (`packages/shared/`); import them from there rather than restating them. The feature `types/` files re-export the enum types so existing imports keep working.

Enum display metadata is centralized — e.g. `features/issues/constants.ts` owns `ISSUE_PRIORITIES`, `PRIORITY_META` and the type metadata that chips and selects read.

**Statuses are per project, not an enum.** `useWorkflow(workspaceId, projectId)` (`features/workflow/`, key `workflowKeys.detail`) returns the project's workflow and a `view` (`workflowView`): statuses in column order, `byId`, `boardStatuses` (non-`BACKLOG` categories), `defaultStatus`, `firstUnstarted`, `canMove(from, to)` and `optionsFrom(statusId)` for pickers. Issues carry `statusId` plus an embedded `status: { id, name, color, category }`; render it with `StatusChip` (a dot in the status's color). Never compare a status by name — use `status.category` (`COMPLETED` is "done"). `canSetIssueStatus(permissions, category)` gates completing. The project's **Workflow** tab (`/projects/[projectId]/workflow`, `WorkflowEditor`) edits statuses and moves on Pro with `project:manage`; read-only otherwise. A workflow mutation invalidates the workflow and the project's issues. Creating a project offers "Same as <project>" (sent as `workflowFromProjectId`, Pro only).

### API layer

Import `api` from `src/lib/axios.ts` — **never call axios directly**. The `api` object wraps the backend's `ApiResponse<T>` envelope (`{ success, statusCode, message, data }`, see `src/types/api.ts`) and ensures auth/workspace headers are always attached.

```ts
// feature api file
export const getIssues = (projectId: string) =>
  api.get<Issue[]>(`/projects/${projectId}/issues`);

// hook query function — unwrap .data so the cache holds plain domain objects
queryFn: async () => (await getIssues(projectId)).data
```

The list endpoints are the exception to that one-liner: issues, projects, sprints, memberships, invitations and workspaces are paginated (default 20, max 100), so their API functions call `getAllPages` (`src/lib/get-all-pages.ts`), which walks every page (using `metaData.hasNextPage`) and returns the full list — the board and list render the whole project, and pickers, id lookups and the workspace switcher need every row. Calling `api.get` on one of them silently gets the first 20. Walking is a stop-gap (one serial request per 100 rows); for issues the real fix is per-lane pagination.

A user's email is `User.email` (the backend's `Auth` table holds only sign-in methods: password hash or Google id). Only the profile (`/users/:id`) and the members roster select it, so `ICommonUserEntity` has no `email`; read a member's with `getMemberEmail` / `getMemberName` (`features/memberships/lib/member.ts`).

Mutations use `.message` from the envelope for toast feedback. Every rejection is normalized to `ApiError` (`src/lib/api-error.ts`) by the response interceptor — render error text with `getApiErrorMessage(error, fallback)` rather than branching on Axios internals.

**The HTTP layer must not know how auth or workspace selection works.** `lib/auth-token.ts` and `lib/active-workspace.ts` are registration seams: the auth/workspace layers register getters, and the interceptor calls them. `axios.ts` never imports `next-auth`. A backend 401 on a signed request first asks for a renewed token (`refreshAuthToken()`, deduped across concurrent failures) and retries once; if that fails it calls `notifyUnauthorized()`, whose handler (registered in `src/provider/auth-provider.tsx`) signs the user out — the Auth.js cookie can still look valid after the backend session ends.

### React Query conventions

- Each feature exports a key registry: `issueKeys`, `projectKeys`, `sprintKeys`, … Use it; don't hand-write key arrays.
- Keys scope by workspace and project: `["issues", workspaceId, projectId]`. Detail queries get their own key (`[..., issueId]`) — sharing the list key overwrote the cached array with a single object. An issue's history (`issueKeys.activity`, `[..., issueId, "activity"]`) sits under its detail key on purpose, so anything that invalidates the issue refreshes its history too.
- The issue page's **Activity** section (`features/activity/components/IssueActivityPanel`) merges comments and history into one timeline (All / Comments / History); `ActivityItem.describeChange` turns each recorded change into a sentence.
- `queryFn` unwraps `.data` — caches hold plain arrays/objects, not envelopes. Optimistic updates depend on this.
- Optimistic updates follow cancel → snapshot → mutate → rollback-on-error → invalidate-on-settle (see `useUpdateIssue` in `src/features/issues/hooks/use-issues.ts`, which also invalidates the detail key so a detail-page edit reconciles).
- Defaults live in `src/lib/query-client.ts`: `staleTime` 60s, `retry` 1, no refetch on window focus; SSR-safe client-per-request via `getQueryClient()`.

### Kanban board

`src/features/issues/components/board/` — `@dnd-kit/core` + `@dnd-kit/sortable`.

- The board is the **active sprint's**: `BoardView` filters the project issue list to `sprintId === activeSprint.id` (memoized — the resync below compares by reference) and shows `SprintSummaryCard` above the lanes, then `IssueFilterBar` (search, assignees and labels, via `filterIssues` in `lib/issue-filters.ts` — the List tab uses the same). Lanes show the filtered cards, but a drop's rank is computed against the *full* lane (`rankForPosition`), so a key never lands on a hidden card's key. With no active sprint it renders an empty state linking to the backlog. Issues outside the sprint live on the backlog and the List tab.
- Lanes are the project's workflow statuses outside the `BACKLOG` category (`workflow.boardStatuses`), keyed by status id, in column order; backlog work is triage and appears on the backlog and list views only. Columns regroup when the issues *or* the workflow change.
- Card position persists as `Issue.rank`, a fractional index computed by `rankBetween` (`@taskforge/shared`, re-exported from `features/issues/lib/rank.ts`; the API appends with the same helper). `rankBetween(prev, next)` returns `undefined` on invalid bounds so the caller can fall back to a status-only PATCH; `compareIssueRank` sorts un-ranked rows last. Moving a card is a single-row PATCH — no renumbering.
- A drag may only land back in its starting lane or in a status the project's workflow allows from it (`workflow.canMove`, i.e. `isAllowedTransition` over the project's transitions) — the same rule as the status Selects, and what the backend enforces on every `PATCH` that changes `statusId`.
- `BoardView` mirrors server data into local column state and resyncs by reference comparison during render (not an effect), so an in-progress drag is never clobbered. The stable `EMPTY_ISSUES` constant exists to keep that comparison from looping.

### Roles and permissions

The JWT has no role. `useWorkspacePermissions()` (`features/memberships/hooks/`) reads `GET /memberships/me` (`useMyMembership`, key `membershipKeys.me`, under the roster's key so invalidating the roster refreshes it) — the backend resolves the viewer's role, built-in or custom, into permission keys — and `permissionsFrom` (`features/memberships/lib/permissions.ts`) turns them into flags: `canManageWorkspace`, `canManageMembers`, `canManageInvitations`, `canManageRoles`, `canCreateIssue`, `canEditAnyIssue`, `canEditOwnIssues`, `canChangeIssueStatus`, `canMarkIssueDone`, `canDeleteIssue`, `canManageProjects`, `canManageSprints`, `canManageLabels`, `canComment`, `canDeleteAnyComment`, `canDeleteWorkspace`, `canTransferOwnership`, `canManageBilling`, `canLeaveWorkspace`, plus `granted` (the key set), `isOwner` and `userId` ("me": the backend's answer, else the access token's `sub`). There is no copy of the role rules on the web. Per-row rules are helpers: `canEditIssue(permissions, issue)` (any issue, or one you reported or are assigned to), `canSetIssueStatus`, `holdsAll(permissions, keys)` — the backend's no-escalation rule, used to offer only roles the viewer could hand out — and `outranks(permissions, keys)` — holding all of a member's keys plus one more, the backend's rule for changing or removing a member, used to lock roster rows (an Admin can't act on another Admin). Flags are all `false` *while loading*; if `/memberships/me` still can't be read afterwards the hook **fails open** (`UNRESTRICTED_PERMISSIONS`, `isRoleKnown: false`, plus a dev-only `[permissions]` console warning) so a lookup problem never locks an owner out. Hide or disable controls with these flags rather than letting users hit a 403 toast — but they are UX only; the backend is the authority.

Roles live in `features/roles/` (`useRoles`, `roleKeys.list`; `GET /roles` for any member). Settings → Roles (`RolesSettings`) creates custom roles — from scratch or copied from any role — and edits and deletes them with `role:manage`; built-ins are view-only. The role editor (`RoleForm`) lists `PERMISSION_GROUPS` from `features/roles/constants.ts`: labels and descriptions for the grantable keys in `@taskforge/shared`, each of which needs an entry there. The Members tab and the invite form pick from the same roles by `roleId`; show a role with `RoleChip` (`assignedRole`, falling back to the enum for rows predating roles). A role mutation invalidates the roles list and everything under `["memberships", workspaceId]`.

### Billing and plan limits

`features/billing/` (backend contract: `apps/backend/spec/billing-spec.md`). Settings → Billing
(`BillingSettings`, `useBilling`, key `billingKeys.detail(workspaceId)`) shows any member the plan,
usage and plan cards; the owner (`canManageBilling`) gets "Upgrade" (`POST /billing/checkout`) and
"Manage billing" (`/billing/portal`), both of which return a Stripe URL the browser is sent to.
**The plan changes only when Stripe's webhook reaches the backend**, so on return
(`?checkout=success`) the page polls `GET /billing` every 2s for up to 30s, then drops the param.
Limit numbers come from `@taskforge/shared` (`PLAN_LIMITS`, `FREE_OWNED_WORKSPACES`,
`PRO_TRIAL_DAYS`). A write the plan refuses is a **402 with `code: "PLAN_LIMIT"`**: show it with
`useErrorToast()` (`features/billing/lib/plan-limit.ts`), which adds an "Upgrade" action, instead of
a plain danger toast. The invite button and "New role" also read `useBilling` and disable
themselves with an upgrade hint when the limit is already reached; the browser never counts
workspaces itself (the create-workspace cap is the backend's 402). Mutations that change seat usage
(sending or revoking an invitation, removing a member) invalidate the billing key. `GET /workspaces`
carries each workspace's `plan`; `ProBadge` shows it in the switcher.

### Rendering user HTML

Issue descriptions and comments are stored as HTML and the backend does not sanitize them. Pass anything bound for `dangerouslySetInnerHTML` through `sanitizeHtml` (`src/lib/sanitize-html.ts`, DOMPurify with an allowlist matching what the TipTap editor can emit). It returns `""` when there is no DOM (server render) rather than passing input through.

### Error and loading UI

`src/app/error.tsx` and `src/app/(dashboard)/error.tsx` are the route error boundaries (the dashboard one sits below the layout, so the sidebar and header survive a page crash), with `loading.tsx` and `not-found.tsx` alongside. In Next 16 an error boundary receives `unstable_retry`, **not** `reset`. For a failed query use `ErrorAlert` (`components/ui/error-alert.tsx`) with `refetch` as `onRetry`, so an `isError` never renders as a blank page or an endless spinner.

### Auth (Auth.js v5)

- `src/lib/auth.ts` — full Node runtime; exports `handlers`, `auth`, `signIn`, `signOut`. The `credentials` provider delegates to the backend `/auth/login` (a 403 becomes code `email_unverified`), the `email-verification` provider posts the emailed link's token to `/auth/verify-email` (used by `/verify-email`), and `events.signOut` revokes the backend refresh token. Every provider stores the backend's `accessToken`, `accessTokenExpiresAt` and `refreshToken` in the JWT.
- Sign-up is confirmed by email: the register form shows a "check your email" notice instead of signing in, and remembers `callbackUrl` in `localStorage` for after verification (`features/auth/lib/callback-url.ts`).
- Access tokens last 15 minutes. The `jwt` callback (`auth.config.ts`) renews through the refresh token when under 5 minutes are left or when `update({ refreshAccessToken: true })` forces it, using `lib/backend-session.ts` (plain `fetch`: the proxy is Edge). `SessionProvider` refetches every 4 minutes. The refresh token never reaches the client session; a refused one sets `session.error`, which signs the user out.
- `src/lib/auth.config.ts` — Edge-safe subset (no axios, no providers); used by `proxy.ts` and the server layout. Its `authorized` callback owns the public/auth-route lists: `PUBLIC_PREFIXES` (`/login`, `/register`, `/verify-email`, `/api/auth`, `/pricing`, `/terms`, `/privacy`) match whole path segments, and `/` is matched exactly — never add `"/"` to the list, which would make every route public.
- The proxy at `src/proxy.ts` is an optimistic UX guard only; the `(dashboard)` server layout re-checks the session, and the backend is the real security boundary.
- Profile edits call `useSession().update()`, which the `jwt` callback mirrors into `token.name`/`token.picture` so the header updates without re-login.

### Providers

`src/provider/index.tsx` composes them once for the root layout: theme (`next-themes`) → auth (`SessionProvider`) → React Query. Toasts come from HeroUI — `Toast.Provider` is mounted in `src/app/layout.tsx`; call `toast.success(...)` / `toast.danger(...)`.

### Forms

All forms use React Hook Form + Zod + HeroUI. Wrap every form in the `FormWrapper` component from `src/components/form-element/Form.tsx`, which composes `HookFormProvider` with HeroUI's `<Form validationBehavior="aria">`. Without `validationBehavior="aria"`, native browser validation silently blocks `handleSubmit`.

Per-field wrappers in `src/components/form-element/` (`FormTextField`, `FormSelect`, `FormComboBox`, `FormDatePicker`, `FormRadioGroup`, `FormTextArea`, `FormRichTextEditor`, `FormImageUpload`) handle `isInvalid`/`FieldError` plumbing — import them from `@/components/form-element`. Schemas live in the feature's `schema/` folder and export both the Zod object and its inferred `T…FormValues` type. Forms take `defaultValues` / `onSubmit` / `isSubmitting` props so they serve both create and edit.

Dates: HeroUI pickers speak `@internationalized/date`. Convert with `toISO`/`fromISO` (`src/util/iso.ts`) at the API boundary and `toCalendarDate` (`src/util/format-date.ts`) for `minValue`/`maxValue`; display with `formatDate`.

Rich text is TipTap (`@tiptap/react` + `starter-kit`) via `src/components/ui/RichTextEditor.tsx`.

### Image upload (Cloudinary)

Two-phase, per `spec/cloudinary.md`: the browser uploads directly to Cloudinary via an unsigned preset into the user's own temp folder, `temp/user-avatar/<userId>` (`uploadToCloudinary` in `src/lib/cloudinary.ts`; the backend's delete-temp only accepts that folder), then sends `{ avatarUrl, avatarPublicId }` to the backend, which *promotes* the asset on save. Removing a saved avatar sends `avatarPublicId: null`, which clears both fields and deletes the stored asset. Unsaved temp assets are cleaned up through the backend's `/cloudinary/delete-temp` (best-effort; the frontend never holds the API secret).

### UI library

HeroUI v3 (`@heroui/react@^3.1.0`) — compound react-aria components with semantic token styling. It is **not** a raw Tailwind component library. Use the semantic tokens actually defined in `src/app/globals.css` rather than raw Tailwind palette colors: `bg-background` / `text-foreground`, `bg-surface` / `bg-surface-secondary` / `bg-surface-tertiary`, `text-muted`, `border-border`, `bg-overlay`, and the status colors `accent` / `danger` / `warning` / `success` (each with a `-foreground` pair). There is no `content1`-style token in this project — that's HeroUI v2 naming. Controlled modals attach `isOpen`/`onOpenChange` to `Modal.Backdrop`, not the `Modal` root.

`ahooks` (`useBoolean`) is the convention for modal open state.
