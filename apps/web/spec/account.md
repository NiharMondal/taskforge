# Account: download your data, delete your account

Backend contract: `apps/backend/spec/user-spec.md`. Both live on Settings → Profile, below
`ChangePasswordCard` (`features/settings/components/`).

## Download my data — `DownloadDataCard`

"Download my data" calls `GET /users/me/export` (`exportMyData` in `features/profile/api/`,
`useExportMyData` — a mutation, so each click fetches fresh and nothing is cached) and saves the
response's `data` as `taskforge-data-<YYYY-MM-DD>.json` (`features/profile/lib/download-json.ts`).
The button reads "Preparing…" meanwhile. The backend allows 5 downloads an hour; a 429 or any other
failure is a danger toast with the backend's message.

## Delete account — `DeleteAccountCard`

A "Danger zone" card modelled on `DeleteWorkspaceCard`. It explains what goes (the account, and
every workspace only the user belongs to) and what stays (their issues and comments in shared
workspaces, shown as by "Deleted user").

"Delete account" opens `ConfirmModal` with `typeToConfirm` = the user's email. An account with a
password (`hasPassword` from `GET /users/me`) also fills in a password field, passed as the modal's
`children`; the button stays disabled (`canConfirm`) until it isn't empty. The request is
`DELETE /users/me` (`deleteAccount`; axios sends a DELETE body through `config.data`) with
`{ password }`, or `{ confirmEmail }` for a Google-only account.

- **Success:** `signOut({ redirectTo: "/login?accountDeleted=1" })`; the login form shows "Account
  deleted".
- **409** (they own a workspace other people use — the message names it and says to transfer or
  delete it), **400** (wrong password) or anything else: a danger toast with the backend's message,
  and the modal stays open.

## "Deleted user"

Issues and comments outlive their authors, so the web types allow it: `Issue.reporterId` /
`reporter`, `IssueComment.userId` / `user` and the `comment.deleted` history row's `author` can be
`null`. They render as "Deleted user" (`DELETED_USER_NAME` in `src/types/common.ts`, also used by
the audit log's `auditActorName`): the issue list's Reporter column, the issue page's Reporter, the
comment header (muted, with a "?" avatar) and "deleted a comment by deleted user" in the history.
`canEditIssue` never matches a null reporter, and nobody is the author of a null-author comment, so
only `canDeleteAnyComment` offers to delete it.
