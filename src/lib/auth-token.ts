/**
 * Pluggable access-token source for the API client.
 *
 * The HTTP layer (`axios.ts`) must NOT know *how* auth works — that keeps it
 * decoupled from whatever session strategy we land on (Auth.js, per the
 * `spec/auth.md` plan). Instead, the auth layer registers a getter once, and
 * the request interceptor calls it on every request.
 *
 * Rules from spec/auth.md honored here:
 *   - We never read/write the token from localStorage in this module.
 *   - The token is always resolved from the registered session source.
 *
 * Wiring example (once Auth.js is added, e.g. in a client provider effect):
 *
 *   import { getSession } from "next-auth/react";
 *   registerAuthTokenGetter(async () => (await getSession())?.accessToken ?? null);
 */
type AuthTokenGetter = () => string | null | Promise<string | null>;

let tokenGetter: AuthTokenGetter = () => null;

/** Register the function used to resolve the current access token. */
export function registerAuthTokenGetter(getter: AuthTokenGetter): void {
  tokenGetter = getter;
}

/** Resolve the current access token (or null if unauthenticated). */
export async function getAuthToken(): Promise<string | null> {
  return tokenGetter();
}
