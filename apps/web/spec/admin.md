# Platform admin console

`/admin`: a read-only console for platform staff (`User.platformRole` `ADMIN` or `SUPPORT`) across
every workspace and account. Backend contract: `apps/backend/spec/admin-spec.md`. Write actions
(suspend, revoke sessions, delete) arrive with step 12 of `docs/saas-readiness-plan-2026-10-29.md`.

## Who sees it

- Platform roles are granted only by the backend's `pnpm run set-platform-role <email> <ADMIN|SUPPORT|none>`,
  never from the app.
- `GET /users/me` returns `platformRole`. The sidebar shows **Admin** (`AdminNavLink`, under the main
  items) only when it is set.
- `app/(admin)/admin/layout.tsx` is a server layout. It calls `auth()` (no session, or an expired
  one, goes to `/login`), then reads `GET /users/me` with the session's access token
  (`fetchPlatformRole`, plain `fetch`). Without a platform role it calls `notFound()`, so the
  console doesn't advertise itself. A backend it can't reach throws to the error page rather than
  showing a false 404.
- All of that is UX. The backend checks the role, from the database, on every `/admin` request. A
  403 while the console is open (the role was just removed) shows "You no longer have platform
  access".

## Layout

The `(admin)` route group is deliberately **not** under `(dashboard)`. That group wraps everything in
`WorkspaceProvider`, and nothing here belongs to a workspace. `AdminShell` is its own chrome: brand,
"Platform admin" with the viewer's role, tabs (Overview, Workspaces, Users) and "Back to app"
(`/dashboard`). `app/(admin)/admin/error.tsx` keeps that chrome up when a page fails.

| Route | Shows |
|---|---|
| `/admin` | Users (total, new in 7 and 30 days, staff), workspaces by plan in force (each links to the filtered list), subscriptions by Stripe status. |
| `/admin/workspaces?search=&plan=&page=` | Name, owner, members, plan, status, seats, created. Search by name, the owner's email or id; filter by plan in force. |
| `/admin/workspaces/[workspaceId]` | Owner, counts, subscription (with links to the Stripe customer and subscription), members with roles, projects with issue and sprint counts. |
| `/admin/users?search=&page=` | Name, email, platform role, sign-in methods, verified, workspaces, joined. Search by name, email or id. |
| `/admin/users/[userId]` | Verification, sign-in methods, signed-in sessions, counts, and every workspace with role and plan. |

Names link across: a workspace's owner and members go to their user page, and a user's workspaces go
to the workspace page.

- **List state is the URL.** The server page parses `searchParams` (`parseAdminListParams`; anything
  malformed falls back to the default, never a 400) and hands it to the client list. Searching
  replaces the history entry after a 300 ms pause; filtering and paging push one. So "back" from a
  detail page returns to the same search and page.
- **Stripe links** go to `https://dashboard.stripe.com[/test]/customers/<id>` (and `subscriptions`),
  in the mode the backend reports (`stripeMode`). Unknown mode: the id is shown without a link.
- Detail pages list at most `ADMIN_DETAIL_LIST_LIMIT` (100, `@taskforge/shared`) members, projects
  or workspaces, and say "Showing the first 100 of N" when they were capped.

## Data

`features/admin/` (`api`, `hooks`, `types`, `components`, `lib`). `adminKeys` carries **no
workspace id**: the data is platform-wide, the same whichever workspace is active. Every page,
search and filter is its own key. The lists fetch one page with its `metaData` and never walk every
page. Queries refetch on mount (`staleTime: 0`). A 403 or 404 isn't retried.
