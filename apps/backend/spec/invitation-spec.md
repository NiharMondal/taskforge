# Invitation Module — Backend Spec

## Goal

Build a backend invitation system that allows workspace members to invite others via email. Membership is **always** created through the `Invite → Accept` flow, never manually.

**Core assumption:** The invited person must have a TaskForge account before they can accept an invitation. If they do not have one, they register first, then use the invite link. The invitation is tracked by **email**, not `userId`. The `userId` is resolved only at the moment of acceptance.

---

## Database Schema

### Invitation model

```prisma
model Invitation {
  id          String           @id @default(cuid())
  email       String
  workspaceId String
  role        Role             @default(MEMBER)
  token       String           @unique
  status      InvitationStatus @default(PENDING)
  expiresAt   DateTime
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  workspace   Workspace        @relation(fields: [workspaceId], references: [id])

  @@index([token])
  @@index([workspaceId])
  @@unique([email, workspaceId])
}

enum InvitationStatus {
  PENDING
  ACCEPTED
  EXPIRED
  REVOKED
}
```

> No `userId` on the `Invitation` model. The invited user may not exist at creation time. Their `userId` is looked up by email at accept time.

---
## Important Rules

> CRITICAL: The invited person must have a TaskForge account before they can accept an invitation. If they do not have one, they register first, then use the invite link. The invitation is tracked by **email**, not `userId`. The `userId` is resolved only at the moment of acceptance.

---

## API Endpoints

### 1. Send Invitation

**`POST /invitations`**

**Auth:** Required. Requester must be an `ADMIN` or `OWNER` of the workspace.

**What it receives:** The email address to invite and the role to assign (`MEMBER`, `ADMIN`, etc.).

**What the backend does:**
1. Validates the email and role.
2. Confirms the requester has permission to invite in this workspace.
3. Checks that no `PENDING` invitation already exists for this email + workspace combination.
4. Checks that this email is not already a member of the workspace.
5. Creates an `Invitation` record with a secure random token and an expiry 7 days in the future.
6. Sends an invitation email containing the invite link with the token.

**Errors:**
| Status | Reason |
|--------|--------|
| `400` | Invalid email or role |
| `403` | Requester not authorized to invite |
| `409` | A pending invitation already exists for this email in this workspace |
| `409` | This email is already a member of the workspace |

---

### 2. Accept Invitation

**`POST /invitations/accept`**

**Auth:** Required. The logged-in user's email must match the invitation email.

**What it receives:** The invite token from the link.

**What the backend does:**
1. Looks up the invitation by token.
2. Checks the invitation exists, is still `PENDING`, and has not expired. If it is expired, mark it `EXPIRED` and return an error.
3. Confirms the logged-in user's email matches the invitation email. If not, reject — this invite is not for them.
4. Checks the user is not already a member of that workspace.
5. In a single database transaction: creates the `Membership` record and marks the invitation `ACCEPTED`.
6. Returns the `workspaceId` so the frontend can redirect the user into the workspace.

**Errors:**
| Status | Reason |
|--------|--------|
| `404` | Token not found |
| `400` | Invitation is already accepted, revoked, or expired |
| `403` | Logged-in user's email does not match the invitation email |
| `409` | User is already a member of this workspace |

---

### 3. Validate Token (optional, for frontend pre-check)

**`GET /invitations/validate?token=abc123`**

**Auth:** None.

**What it does:** Returns basic invitation metadata — the target email, workspace name, role, and expiry date — so the frontend can show a preview page before the user logs in or registers. Also useful to detect expired/invalid tokens early and show a friendly error instead of letting the user log in first.

**Errors:** `404` if token not found, `400` if already used or expired.

---

### 4. Revoke Invitation (optional)

**`DELETE /invitations/:id`**

**Auth:** Required. Workspace `ADMIN` or `OWNER` only.

**What it does:** Sets the invitation status to `REVOKED`. The token immediately becomes unusable.

---

### 5. List Invitations (optional)

**`GET /invitations?workspaceId=...`**

**Auth:** Required. Workspace member.

**What it does:** Returns all invitations (pending, accepted, expired, revoked) for a workspace. Useful for an admin UI that shows who has been invited and what the status is.

---

## Email

Send a transactional email immediately after the invitation record is created. Use whichever provider is already configured (Resend, SendGrid, Nodemailer, etc.).

**The email must include:**
- The inviter's name and the workspace name
- A clear call-to-action button linking to `https://yourapp.com/invite?token=<token>`
- A note that the link expires in 7 days

---

## Important Rules

- **`Invitation` never stores `userId`** — only `email`. The user may not exist yet.
- **`userId` is resolved at accept time** by matching the invitation's email against the authenticated user's email.
- **Membership is always created via `Invite → Accept`** — never insert `Membership` records directly, except for the auto `OWNER` membership created at registration.
- **Always use a database transaction** when creating the membership and marking the invitation accepted — both must succeed or neither does.
- **Tokens must be cryptographically random** — use `crypto.randomBytes`, never `Math.random`.
- **Always check both expiry and status** before accepting a token.
