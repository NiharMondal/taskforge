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

No test runner is configured — there are no tests to run. Type-check with `npx tsc --noEmit`.

Requires `.env.local` (copy `.env.example`): `NEXT_PUBLIC_API_URL` (backend base, defaults to `http://localhost:5001/api/v1`), `AUTH_SECRET`, plus `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` / `NEXT_PUBLIC_CLOUDINARY_PRESET_NAME` for avatar upload. Note `.env.example` lists the Cloudinary keys **without** the `NEXT_PUBLIC_` prefix the code actually reads.

Path alias: `@/*` → `./src/*`.

## Reference docs (read before designing anything)

The backend lives in a separate repo; this repo carries its contracts:

- `.claude/schema.prisma` — the backend data model. Types in `features/*/types/` mirror it.
- `.claude/BACK_END_API.md` — endpoint map. **Every update is PATCH**, never PUT.
- `.claude/AI_GUIDE.md` — project-level architectural rules (workspace scoping, optimistic updates, no monolithic components).
- `.claude/FORM_GUIDE.md` — the canonical form pattern with a worked example.
- `.claude/migrations/` — schema changes that must be applied in the backend repo.
- `spec/` — feature specs written before implementation (`auth.md`, `layout.md`, `projects.md`, `cloudinary.md`, `sprint-on-create-issue.md`). These document backend contracts and intended UX; consult the relevant one before changing a feature.

Never invent an API shape. If a contract is unclear, ask rather than guess.

## Architecture

This is a **Next.js 16** App Router project (not Next.js 13/14/15 — APIs may differ). The file previously called `middleware.ts` is now `src/proxy.ts`. Check `node_modules/next/dist/docs/` before writing unfamiliar Next.js code.

### Multi-tenant model

Every workspace is a tenant. The active workspace is stored in `localStorage` (`taskforge.activeWorkspaceId`) and surfaced via `useWorkspace()` (from `src/features/workspace/context/workspace-context.tsx`). Every API request carries it as `x-workspace-id` — the axios interceptor in `src/lib/axios.ts` attaches it automatically. Switching workspaces calls `queryClient.invalidateQueries()` to drop all cached server data.

Auth tokens identify the *user*; the workspace header identifies the *tenant*. A user belongs to many workspaces, so the header **is** the workspace switch. Issue/project query keys include both `workspaceId` and `projectId` so cache entries never leak across tenants or projects.

`WorkspaceProvider` pushes the active id into `lib/active-workspace.ts` *during render* (not in an effect) so the first scoped request already carries the right tenant.

### Routing

```
app/
  (auth)/           — login, register (no shell)
  (dashboard)/      — server layout gates auth, wraps AppLayout
    dashboard/
    projects/
      [projectId]/
        board/      — kanban
        issues/
          [slug]/   — issue detail page ([slug] is the issue id)
        sprints/
    settings/       — general, members, profile
    issues/         — redirect → /projects (no workspace-wide issues endpoint)
  invitations/accept/
```

Issues are project-scoped: always under `/projects/[projectId]/issues` or `/projects/[projectId]/board`. `/` redirects to `/dashboard`.

### Feature structure

Each domain lives in `src/features/<name>/` (`auth`, `dashboard`, `invitations`, `issues`, `memberships`, `profile`, `projects`, `settings`, `sprint`, `workspace`):

```
api/          — async functions calling `api.*` from lib/axios
components/   — React components for this feature
hooks/        — React Query hooks (useQuery / useMutation wrappers)
schema/       — Zod schemas for form validation
types/        — TypeScript interfaces matching backend shapes
constants.ts  — display metadata for enums (labels, ordering, chip colors)
```

Shared UI primitives go in `src/components/` (`ui/`, `form-element/`); layout components (sidebar, header) in `src/components/layout/`.

Enum display metadata is centralized — e.g. `features/issues/constants.ts` owns `ISSUE_STATUSES`, `BOARD_STATUSES`, `ISSUE_PRIORITIES`, and the `STATUS_META`/`PRIORITY_META` lookups that chips, selects, and grouped lists all read. Add a status there, not inline.

### API layer

Import `api` from `src/lib/axios.ts` — **never call axios directly**. The `api` object wraps the backend's `ApiResponse<T>` envelope (`{ success, statusCode, message, data }`, see `src/types/api.ts`) and ensures auth/workspace headers are always attached.

```ts
// feature api file
export const getIssues = (projectId: string) =>
  api.get<Issue[]>(`/projects/${projectId}/issues`);

// hook query function — unwrap .data so the cache holds plain domain objects
queryFn: async () => (await getIssues(projectId)).data
```

Mutations use `.message` from the envelope for toast feedback. Every rejection is normalized to `ApiError` (`src/lib/api-error.ts`) by the response interceptor — render error text with `getApiErrorMessage(error, fallback)` rather than branching on Axios internals.

**The HTTP layer must not know how auth or workspace selection works.** `lib/auth-token.ts` and `lib/active-workspace.ts` are registration seams: the auth/workspace layers register getters, and the interceptor calls them. `axios.ts` never imports `next-auth`. A backend 401 calls `notifyUnauthorized()`, whose handler (registered in `src/provider/auth-provider.tsx`) signs the user out — the Auth.js cookie can still look valid after the backend token expires.

### React Query conventions

- Each feature exports a key registry: `issueKeys`, `projectKeys`, `sprintKeys`, … Use it; don't hand-write key arrays.
- Keys scope by workspace and project: `["issues", workspaceId, projectId]`. Detail queries get their own key (`[..., issueId]`) — sharing the list key overwrote the cached array with a single object.
- `queryFn` unwraps `.data` — caches hold plain arrays/objects, not envelopes. Optimistic updates depend on this.
- Optimistic updates follow cancel → snapshot → mutate → rollback-on-error → invalidate-on-settle (see `useUpdateIssue` in `src/features/issues/hooks/use-issues.ts`, which also invalidates the detail key so a detail-page edit reconciles).
- Defaults live in `src/lib/query-client.ts`: `staleTime` 60s, `retry` 1, no refetch on window focus; SSR-safe client-per-request via `getQueryClient()`.

### Kanban board

`src/features/issues/components/board/` — `@dnd-kit/core` + `@dnd-kit/sortable`.

- Lane order comes from `BOARD_STATUSES` (all statuses except `BACKLOG`; backlog is triage and appears on the list view only).
- Card position persists as `Issue.rank`, a fractional index (`fractional-indexing`) computed by `features/issues/lib/rank.ts`. `rankBetween(prev, next)` returns `undefined` on invalid bounds so the caller can fall back to a status-only PATCH; `compareIssueRank` sorts un-ranked rows last. Moving a card is a single-row PATCH — no renumbering.
- A drag may only cross to an **adjacent** lane, measured from the lane the drag started in.
- `BoardView` mirrors server data into local column state and resyncs by reference comparison during render (not an effect), so an in-progress drag is never clobbered. The stable `EMPTY_ISSUES` constant exists to keep that comparison from looping.

### Auth (Auth.js v5)

- `src/lib/auth.ts` — full Node runtime; exports `handlers`, `auth`, `signIn`, `signOut`. The Credentials provider delegates to the backend `/auth/login` and stores the returned `accessToken` in the JWT.
- `src/lib/auth.config.ts` — Edge-safe subset (no axios, no providers); used by `proxy.ts` and the server layout. Its `authorized` callback owns the public/auth-route lists.
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

Two-phase, per `spec/cloudinary.md`: the browser uploads directly to Cloudinary via an unsigned preset into a `temp/` folder (`uploadToCloudinary` in `src/lib/cloudinary.ts`), then sends `{ avatarUrl, avatarPublicId }` to the backend, which *promotes* the asset on save. Unsaved temp assets are cleaned up through the backend's `/cloudinary/delete-temp` (best-effort; the frontend never holds the API secret).

### UI library

HeroUI v3 (`@heroui/react@^3.1.0`) — compound react-aria components with semantic token styling. It is **not** a raw Tailwind component library. Use the semantic tokens actually defined in `src/app/globals.css` rather than raw Tailwind palette colors: `bg-background` / `text-foreground`, `bg-surface` / `bg-surface-secondary` / `bg-surface-tertiary`, `text-muted`, `border-border`, `bg-overlay`, and the status colors `accent` / `danger` / `warning` / `success` (each with a `-foreground` pair). There is no `content1`-style token in this project — that's HeroUI v2 naming. Controlled modals attach `isOpen`/`onOpenChange` to `Modal.Backdrop`, not the `Modal` root.

`ahooks` (`useBoolean`) is the convention for modal open state.
