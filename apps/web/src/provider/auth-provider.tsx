"use client";

import { SessionProvider, getSession, signOut } from "next-auth/react";

import { registerAuthTokenGetter, registerUnauthorizedHandler } from "@/lib/auth-token";

/**
 * Wires the Auth.js session into the rest of the app:
 *
 *  1. `SessionProvider` makes `useSession()` available to client components.
 *  2. The token getter is registered ONCE (module load) so the axios request
 *     interceptor (src/lib/axios.ts) can attach the backend JWT as a Bearer
 *     header — without the HTTP layer ever importing next-auth.
 *  3. The unauthorized handler is registered so a backend 401 (expired token)
 *     signs the user out — otherwise the Auth.js cookie keeps them on protected
 *     pages while every request fails.
 *
 * Honors spec/auth.md: the token is always resolved from the Auth.js session,
 * never read from or written to localStorage.
 */
registerAuthTokenGetter(async () => {
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
