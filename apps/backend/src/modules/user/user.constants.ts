/** `GET /users/me/export`: a few downloads an hour per user — it reads every row they touch. */
export const EXPORT_THROTTLE = { default: { limit: 5, ttl: 60 * 60_000 } };

/** `DELETE /users/me`: slows guessing the password with a stolen access token. */
export const DELETE_ACCOUNT_THROTTLE = {
  default: { limit: 5, ttl: 15 * 60_000 },
};
