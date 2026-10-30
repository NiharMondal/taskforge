# Users: profile, data export and account deletion

`src/modules/user/` serves `/api/v1/users`. `User` has no `workspaceId`, so there is no tenant scope
to lean on: every route acts on the caller, identified by the JWT `sub`, and nothing else. There is
no list route.

| Route | What it does |
|---|---|
| `GET /users/me` (or `/users/<own id>`) | The profile, plus `hasPassword` (`spec/auth-spec.md`). |
| `PATCH /users/me` (or `/users/<own id>`) | Name and avatar (`spec/cloudinary.md` in the web app). |
| `GET /users/me/export` | Everything the account holds about the caller, as JSON. |
| `DELETE /users/me` | Deletes the caller's account. |

Any other id on `/users/:id` is a 403. `DELETE /users/:id` does not exist, not even for your own id.

## `GET /users/me/export`

Throttled per user (`EXPORT_THROTTLE`: 5 an hour; then 429). `200` with:

```jsonc
{
  "exportedAt": "2026-10-30T12:00:00.000Z",
  "profile": {
    "id": "…", "name": "Ann", "email": "ann@example.com", "avatarUrl": null,
    "emailVerifiedAt": "…", "createdAt": "…", "updatedAt": "…",
    "signInMethods": [{ "provider": "EMAIL", "addedAt": "…" }] // never a password hash
  },
  "memberships": [{ "workspace": { "id": "…", "name": "Acme" }, "role": "Member", "joinedAt": "…" }],
  "issues": [{
    "id": "…", "key": "WA-12", "title": "…", "description": "…", "priority": "HIGH", "type": "BUG",
    "timeEstimate": null, "status": "To Do", "workspace": "Acme", "project": "Web app",
    "reportedByYou": true, "assignedToYou": false, "createdAt": "…", "updatedAt": "…"
  }],
  "comments": [{
    "id": "…", "content": "<p>…</p>", "workspace": "Acme",
    "issue": { "id": "…", "key": "WA-12", "title": "…" }, "createdAt": "…", "updatedAt": "…"
  }]
}
```

Issues (reported or assigned) and comments come only from workspaces the caller **still belongs
to**: a workspace they left keeps its rows, and a former member doesn't read a tenant's data.

## `DELETE /users/me`

Throttled per user (`DELETE_ACCOUNT_THROTTLE`: 5 per 15 minutes), which slows guessing the password
with a stolen access token.

**Body** (`DeleteAccountDto`; any other key is a 400):

- an account with a password (an `EMAIL` sign-in method): `{ "password": "…" }`;
- a Google-only account: `{ "confirmEmail": "ann@example.com" }` (compared trimmed, ignoring case).

A missing or wrong confirmation is a **400** — never 401, which the web reads as a dead session.

**Workspaces the caller owns:**

- If any has another member: **409**, nothing deleted, and the body names them —
  `{ success: false, statusCode: 409, message: "You own a workspace other people use: Acme. Transfer ownership (Settings → General) or delete them first.", workspaces: [{ id, name }] }`.
- The ones only they belong to are deleted, like `DELETE /workspaces/:id`: each live subscription is
  canceled with Stripe first (`BillingService.cancelForDeletion`; a 502/503 there stops the
  deletion before anything is deleted). If someone joins one of them between the check and the
  transaction, that is a 409 too.

**Then, in one transaction:** the solo workspaces are deleted (cascading to everything in them), a
`member.left` row is written to the audit log of every other workspace they belonged to (actor =
the caller, which becomes `null` with the user; `metadata.member` keeps their name), and the `User`
is deleted. That cascades to memberships, sign-in methods (`Auth`), refresh tokens and password
resets, and sets to `null`:

- `Issue.reporterId` — issues they reported in shared workspaces stay (before this, deleting a user
  deleted them and their sub-issues);
- `Comment.userId` — their comments stay;
- `Issue.assigneeId` and `AuditLog.userId`, as before.

**After the commit:** their Cloudinary avatar is deleted (best-effort), a confirmation email goes to
the address the account had, and `BillingService.syncSeats` runs for each workspace they left.

`200` with `data: null`. The access token still verifies until it expires (up to 15 minutes), but
there is nothing behind it: `GET /users/me` is a 404 and every workspace route a 403 (no
membership). The web app signs out right away.

### A deleted user elsewhere

- An issue with `reporterId: null` and `reporter: null`; `issue:edit:own` can't match it, so only
  `issue:edit:any` edits it.
- A comment with `userId: null` and `user: null`: nobody is its author, so only
  `comment:delete:any` deletes it, and that deletion's history row has `metadata.author: null`.
- Audit and history rows with `user: null`.
