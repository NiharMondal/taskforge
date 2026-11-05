# Maintenance — Backend Spec

## Goal

Keep tables from growing forever: delete rows nothing needs any more, and tidy invitations that
expired. Nothing user-visible changes.

## The cleanup

`CleanupService` (`src/modules/maintenance/`) runs these tasks, each on its own (one failing is
logged and reported as `null`, and the rest still run), logging how many rows each changed:

| Task | Does |
| --- | --- |
| `pendingRegistrations` | Deletes sign-ups whose link has expired (24 hours) |
| `passwordResets` | Deletes reset links that have expired (60 minutes) |
| `refreshTokens` | Deletes refresh tokens that expired, or were revoked or replaced, over 30 days ago |
| `expiredInvitations` | Sets `PENDING` invitations past `expiresAt` to `EXPIRED` |
| `stripeEvents` | Deletes processed Stripe event ids older than 90 days (Stripe stops retrying after 3) |

Every task is idempotent, so a missed day or an extra run does no harm. A run holds a Postgres
advisory lock (`pg_try_advisory_xact_lock`) for its whole length; another instance that starts
meanwhile does nothing.

An invitation marked `EXPIRED` behaves as an expired `PENDING` one did: opening its link says
"Invitation has expired", and inviting the address again replaces it.

## When it runs

- **In-process:** `@Cron("17 3 * * *")`, UTC (`@nestjs/schedule`). Enough on an always-on host.
- **`POST /api/v1/maintenance/cleanup`** with `Authorization: Bearer <CRON_SECRET>`: for an external
  scheduler on hosts that sleep (Render's free tier), where the in-process cron doesn't fire. The
  repository's `.github/workflows/cleanup.yml` calls it daily once `BACKEND_URL` and `CRON_SECRET`
  are set in GitHub. Answers `200` with the per-task counts, or `data: null` when another run held
  the lock.
- **By hand:** `pnpm run cleanup` in `apps/backend` (against `DATABASE_URL`).

| Status (`POST /maintenance/cleanup`) | Reason |
| --- | --- |
| `401` | Missing or wrong secret |
| `503` | `CRON_SECRET` isn't set |

The route skips the JWT guard (`@Public()`); the secret is compared in constant time. Use a long
random value (`openssl rand -hex 32`).
