# Auth Module — Backend Spec

## Goal

Sign people up and in, and keep them signed in: password accounts confirmed by email, Google
accounts, and short-lived access tokens renewed with rotating refresh tokens.

## API Endpoints

Base path: `/auth`. Every route is `@Public()` except `PATCH /password`, which needs an access
token. `register`, `login`, `google`, `verify-email` and `password` each have a per-client rate
limit (`AUTH_THROTTLE`, 10 a minute); `refresh` and `logout` don't, because their tokens can't be
guessed and the web app sends them from its server for every user.

| Method | Route | Body | Does |
| --- | --- | --- | --- |
| `POST` | `/register` | `{ name, email, password }` | Starts a sign-up; `202 { email }` |
| `POST` | `/verify-email` | `{ token }` | Finishes it: creates the account, signs in |
| `POST` | `/login` | `{ email, password }` | Password sign-in |
| `POST` | `/google` | `{ idToken }` | Google sign-in or sign-up |
| `POST` | `/refresh` | `{ refreshToken }` | New token pair; the old refresh token stops working |
| `POST` | `/logout` | `{ refreshToken }` | Ends that session; `200` even for an unknown token |
| `PATCH` | `/password` | `{ currentPassword, newPassword }` | Signed in: changes the password, ends every session |

`token` and `refreshToken` are 64 hex characters. As everywhere, a body key a route doesn't declare
is a `400`.

A sign-in (`login`, `google`, `verify-email`) returns
`{ user: { id, name, email, avatarUrl }, accessToken, accessTokenExpiresAt, refreshToken }`;
`refresh` returns the last three.

## Registration and email verification

`POST /auth/register` creates **no** user. It stores a `PendingRegistration` (name, email, bcrypt
hash, the SHA-256 of a random token, 24-hour expiry) and emails a link to
`<APP_URL>/verify-email?token=…`. Its answer is the same `202` whatever the address:

- **Already has an account** (verified): nothing is stored; the address gets a "you already have an
  account" email instead. So the route doesn't reveal which addresses are registered.
- **Too many recent links:** after 3 links to one address in 15 minutes, nothing more is sent (the
  earlier links still work).
- The password is hashed first in every case, and mail is sent after the response, so timing
  doesn't tell the cases apart either. A failed send is logged.

`POST /auth/verify-email` claims the pending sign-up (deleting it, so a second click is a `400`),
deletes every other pending sign-up for the address, and:

- creates the user (verified), its `EMAIL` auth, a workspace with the built-in roles and the OWNER
  membership, then signs in; or
- if the address has an **unverified** account (registered before verification existed), sets that
  account's password and name from this sign-up, marks it verified, and revokes its refresh tokens.

Several sign-ups can be pending for one address (an impostor's and the owner's); whichever link is
followed wins, with its own password. Only the inbox owner can follow one.

| Status | Reason |
| --- | --- |
| `400` | Unknown, expired or already-used link |
| `409` | The address got an account in the meantime (a Google sign-up) |

## Password login

Starts from the `EMAIL` `Auth` row and answers every failure with the same `401` "Invalid email or
password", after a bcrypt comparison against a dummy hash when nothing matched. With the right
password, an account whose email was never verified is a `403`: only accounts registered before
verification existed can be in that state, and registering again replaces their password.

## Changing the password

`PATCH /auth/password` (signed in) takes `{ currentPassword, newPassword }`; `newPassword` follows
the sign-up rules (8–72 characters). It checks `currentPassword` against the caller's `EMAIL`
`Auth` row with bcrypt, then, in one transaction, stores the new hash and revokes every refresh
token of the user, so every session ends (this one included; access tokens already issued still
work until they expire, at most 15 minutes). The owner gets a "your password was changed" email,
sent after the response. Answers `200` with `data: null`.

The hash is replaced only if it is still the one that was checked, so of two concurrent changes the
second fails as if its current password were wrong. Failures are `400`, never `401`, because the
caller is signed in and the web app treats a `401` as a session that has ended.

| Status | Reason |
| --- | --- |
| `400` | Wrong current password (one message, "Your current password is incorrect") |
| `400` | The account has no password (Google-only) |
| `400` | The new password equals the current one, or breaks the length rules |
| `401` | No or expired access token |
| `429` | More than 10 attempts a minute from one client |

`GET /users/me` carries `hasPassword` (whether the user has an `EMAIL` sign-in method), so the web
offers the form only to accounts that have one.

## Google

`POST /auth/google` takes only Google's ID token and reads identity from its verified claims
(`GoogleTokenVerifier`). Accounts match on Google's `sub`, then link by email. Linking to an
unverified account deletes its `EMAIL` auth, marks it verified and revokes its refresh tokens, so
whoever pre-registered the address loses their way in. Without `GOOGLE_CLIENT_ID`: `503`.

## Tokens

- **Access token:** a JWT `{ sub, email }`, 15 minutes (`ACCESS_TOKEN_TTL_SECONDS`).
- **Refresh token:** 32 random bytes as hex, stored only as its SHA-256 in `RefreshToken`, 30 days
  from issue. Each sign-in starts a family; `POST /auth/refresh` marks the token replaced and issues
  the next one in the family (`RefreshTokenService`).
- **Reuse:** a replaced token presented again within 60 seconds is a race (two tabs, or the web
  app's proxy and a server render) and gets a new pair. Later, it can only be a copy: the whole
  family is revoked (`401`), and both holders must sign in again.
- **Revocation:** `logout` revokes the token's family. Changing the password, and taking over an
  unverified account (through Google or the verification link), revoke every token of that user.
- A user's expired tokens are deleted when they next refresh.

| Status (`refresh`) | Reason |
| --- | --- |
| `400` | Not a 64-character hex token |
| `401` | Unknown, expired, revoked, or reused after the grace period |
