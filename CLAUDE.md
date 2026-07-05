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

No test runner is configured. Type-check with `tsc --noEmit` if needed.

## Architecture

This is a **Next.js 16** App Router project (not Next.js 13/14/15 — APIs may differ). The file previously called `middleware.ts` is now `src/proxy.ts`. Check `node_modules/next/dist/docs/` before writing unfamiliar Next.js code.

### Multi-tenant model

Every workspace is a tenant. The active workspace is stored in `localStorage` (`taskforge.activeWorkspaceId`) and surfaced via `useWorkspace()` (from `src/features/workspace/context/workspace-context.tsx`). Every API request carries it as `x-workspace-id` — the axios interceptor in `src/lib/axios.ts` attaches it automatically. Switching workspaces calls `queryClient.invalidateQueries()` to drop all cached server data.

Auth tokens identify the *user*; the workspace header identifies the *tenant*. Issue/project query keys include both `workspaceId` and `projectId` so cache entries never leak across tenants or projects.

### Routing

```
app/
  (auth)/           — login, register (no shell)
  (dashboard)/      — server layout gates auth, wraps AppLayout
    dashboard/
    projects/
      [projectId]/
        issues/
          [slug]/   — issue detail page
    settings/
    issues/
  invitations/accept/
```

Issues are project-scoped: always under `/projects/[projectId]/issues` or `/projects/[projectId]/board`. There is no global issues list.

### Feature structure

Each domain lives in `src/features/<name>/`:

```
api/          — async functions calling `api.*` from lib/axios
components/   — React components for this feature
hooks/        — React Query hooks (useQuery / useMutation wrappers)
schema/       — Zod schemas for form validation
types/        — TypeScript interfaces matching backend shapes
```

Shared UI primitives go in `src/components/`. Layout components (sidebar, header) go in `src/components/layout/`.

### API layer

Import `api` from `src/lib/axios.ts` — **never call axios directly**. The `api` object wraps the backend's `ApiResponse<T>` envelope and ensures auth/workspace headers are always attached.

```ts
// feature api file
export const getIssues = (projectId: string) =>
  api.get<Issue[]>(`/projects/${projectId}/issues`);

// hook query function — unwrap .data so the cache holds plain domain objects
queryFn: async () => (await getIssues(projectId)).data
```

Mutations use `.message` from the envelope for toast feedback. Errors are normalized to `ApiError` by the response interceptor.

### React Query conventions

- Query keys always scope by workspace and project: `["issues", workspaceId, projectId]`
- `queryFn` unwraps `.data` — caches hold plain arrays/objects, not envelopes
- Optimistic updates follow the cancel → snapshot → mutate → rollback-on-error → invalidate-on-settle pattern (see `useUpdateIssue` in `src/features/issues/hooks/use-issues.ts`)

### Auth (Auth.js v5)

- `src/lib/auth.ts` — full Node runtime; exports `handlers`, `auth`, `signIn`, `signOut`
- `src/lib/auth.config.ts` — Edge-safe subset (no axios); used by proxy.ts and the server layout
- The proxy at `src/proxy.ts` is an optimistic UX guard only; the backend is the real security boundary

### Forms

All forms use React Hook Form + Zod + HeroUI. Wrap every form in the `FormWrapper` component from `src/components/form-element/Form.tsx`, which composes `HookFormProvider` with HeroUI's `<Form validationBehavior="aria">`. Without `validationBehavior="aria"`, native browser validation silently blocks `handleSubmit`.

Per-field wrappers in `src/components/form-element/` (`FormTextField`, `FormSelect`, `FormComboBox`, etc.) handle `isInvalid`/`FieldError` plumbing.

### UI library

HeroUI v3 (`@heroui/react@^3.1.0`) — compound react-aria components with semantic token styling. It is **not** a raw Tailwind component library. Use semantic color tokens (e.g. `text-foreground`, `bg-content1`) from globals.css rather than raw Tailwind palette colors. Controlled modals attach `isOpen`/`onOpenChange` to `Modal.Backdrop`, not the `Modal` root.

- `src/app/globals.css` - full Tailwind palette colors.


Drag-and-drop on the board uses `@dnd-kit/core` + `@dnd-kit/sortable`.