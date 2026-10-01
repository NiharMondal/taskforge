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

/**
 * Pluggable "session no longer valid" callback.
 *
 * The backend `accessToken` lives *inside* the Auth.js session and can expire
 * independently of the session cookie. When the backend rejects a request with
 * 401, the cookie may still look valid — so the proxy keeps the user on
 * protected pages while every API call fails. The HTTP layer signals that here
 * and the auth layer (auth-provider) registers a handler that signs the user
 * out. Kept decoupled for the same reason as the token getter: axios.ts must
 * never import next-auth.
 */
type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler = () => {};

/** Register the function invoked when the backend reports an expired session. */
export function registerUnauthorizedHandler(handler: UnauthorizedHandler): void {
  unauthorizedHandler = handler;
}

/** Signal that the backend rejected the current session (HTTP 401). */
export function notifyUnauthorized(): void {
  unauthorizedHandler();
}
