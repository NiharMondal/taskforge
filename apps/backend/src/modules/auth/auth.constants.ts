/**
 * Per-client request budget for the unauthenticated auth routes (register,
 * login, google). Slows password guessing and signup spam; `ttl` is in ms.
 */
export const AUTH_THROTTLE = [{ name: "default", ttl: 60_000, limit: 10 }];
