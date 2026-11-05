"use client";

import { useEffect } from "react";
import type { Session } from "next-auth";
import { SessionProvider, getSession, signOut, useSession } from "next-auth/react";

import {
  registerAuthTokenGetter,
  registerSessionRefresher,
  registerUnauthorizedHandler,
} from "@/lib/auth-token";

/**
 * Wires the Auth.js session into the rest of the app:
 *
 *  1. `SessionProvider` makes `useSession()` available to client components.
 *  2. The token getter is registered ONCE (module load) so the axios request
 *     interceptor (src/lib/axios.ts) can attach the backend JWT as a Bearer
 *     header — without the HTTP layer ever importing next-auth. It reads the
 *     token `SessionTokenBridge` keeps from `useSession()`.
 *  3. The session refresher is registered so a backend 401 (the 15-minute
 *     access token ran out) renews the token through `update()` — the `jwt`
 *     callback exchanges the refresh token — and the request is retried.
 *  4. The unauthorized handler is registered so a 401 that survives renewal,
 *     or a session whose refresh token was refused, signs the user out —
 *     otherwise the Auth.js cookie keeps them on protected pages while every
 *     request fails.
 *
 * Honors spec/auth.md: the token is always resolved from the Auth.js session,
 * never read from or written to localStorage.
 */
/**
 * The token from `useSession()`, kept by {@link SessionTokenBridge}.
 * `undefined` until the session has loaded. Calling `getSession()` per request
 * instead fetched `/api/auth/session` before every API call.
 */
let sessionToken: string | null | undefined;

function setSessionToken(token: string | null | undefined) {
  sessionToken = token;
}

registerAuthTokenGetter(async () => {
  if (sessionToken !== undefined) return sessionToken;
  // Requests fired before the session has loaded wait for it once.
  const session = await getSession();
  return tokenOf(session);
});

/**
 * How often an open tab re-reads its session, which renews the backend access
 * token once it is within 5 minutes of expiring (see `auth.config.ts`).
 */
const SESSION_REFETCH_SECONDS = 4 * 60;

/** The token a session carries, or null when it has none or has ended. */
const tokenOf = (session: Session | null | undefined) =>
  session?.error ? null : (session?.accessToken ?? null);

/** `useSession().update`, kept by {@link SessionTokenBridge}. */
let updateSession: ReturnType<typeof useSession>["update"] | undefined;

registerSessionRefresher(async () => {
  if (!updateSession) return null;
  const session = await updateSession({ refreshAccessToken: true });
  const token = tokenOf(session);
  setSessionToken(token);
  return token;
});

// Guard against a burst of concurrent 401s (e.g. a page firing several queries)
// triggering multiple sign-out/redirect calls.
let signingOut = false;
function signOutOnce() {
  if (signingOut) return;
  signingOut = true;
  signOut({ callbackUrl: "/login" });
}
registerUnauthorizedHandler(signOutOnce);

/**
 * Mirrors the session's access token into `sessionToken` *during render* (like
 * `WorkspaceProvider` and the workspace header), so it is current before any
 * child effect fires a request — including after sign-out or a session update.
 * Rendered before `children` so it runs first.
 */
function SessionTokenBridge() {
  const { data: session, status, update } = useSession();
  setSessionToken(status === "loading" ? undefined : tokenOf(session));

  // Only needed once a request has failed, so an effect is soon enough.
  useEffect(() => {
    updateSession = update;
  }, [update]);

  // The backend refused the refresh token (signed out elsewhere, or reused).
  const sessionEnded = session?.error === "SessionExpired";
  useEffect(() => {
    if (sessionEnded) signOutOnce();
  }, [sessionEnded]);

  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchInterval={SESSION_REFETCH_SECONDS}>
      <SessionTokenBridge />
      {children}
    </SessionProvider>
  );
}
