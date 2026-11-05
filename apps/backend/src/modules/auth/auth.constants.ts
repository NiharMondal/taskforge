/**
 * Per-client request budget for the unauthenticated auth routes (register,
 * login, google). Slows password guessing and signup spam; `ttl` is in ms.
 */
export const AUTH_THROTTLE = [{ name: "default", ttl: 60_000, limit: 10 }];

/** Access tokens are short-lived; the web app renews them with a refresh token. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** A refresh token's lifetime. Every refresh issues a new one, so an active session never runs out. */
export const REFRESH_TOKEN_TTL_DAYS = 30;

/**
 * How long a replaced refresh token still works. Concurrent refreshes (two
 * tabs, or the web app's proxy and a server render in one page load) present
 * the same token; within this window that is a race, not a theft.
 */
export const REFRESH_TOKEN_REUSE_GRACE_MS = 60_000;

/** How long the link in a verification email works. */
export const EMAIL_VERIFICATION_TTL_HOURS = 24;

/**
 * At most this many verification emails per address per window, so the
 * register route can't be used to flood someone's inbox.
 */
export const VERIFICATION_EMAILS_PER_WINDOW = 3;
export const VERIFICATION_EMAIL_WINDOW_MS = 15 * 60_000;
