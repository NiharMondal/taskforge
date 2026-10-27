"use client";

import { SessionProvider, getSession, signOut, useSession } from "next-auth/react";

import { registerAuthTokenGetter, registerUnauthorizedHandler } from "@/lib/auth-token";

/**
 * Wires the Auth.js session into the rest of the app:
 *
 *  1. `SessionProvider` makes `useSession()` available to client components.
 *  2. The token getter is registered ONCE (module load) so the axios request
 *     interceptor (src/lib/axios.ts) can attach the backend JWT as a Bearer
 *     header — without the HTTP layer ever importing next-auth. It reads the
 *     token `SessionTokenBridge` keeps from `useSession()`.
 *  3. The unauthorized handler is registered so a backend 401 (expired token)
 *     signs the user out — otherwise the Auth.js cookie keeps them on protected
 *     pages while every request fails.
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
  return session?.accessToken ?? null;
});

// Guard against a burst of concurrent 401s (e.g. a page firing several queries)
// triggering multiple sign-out/redirect calls.
let signingOut = false;
registerUnauthorizedHandler(() => {
  if (signingOut) return;
  signingOut = true;
  signOut({ callbackUrl: "/login" });
});

/**
 * Mirrors the session's access token into `sessionToken` *during render* (like
 * `WorkspaceProvider` and the workspace header), so it is current before any
 * child effect fires a request — including after sign-out or a session update.
 * Rendered before `children` so it runs first.
 */
function SessionTokenBridge() {
  const { data: session, status } = useSession();
  setSessionToken(
    status === "loading" ? undefined : (session?.accessToken ?? null),
  );
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SessionTokenBridge />
      {children}
    </SessionProvider>
  );
}
