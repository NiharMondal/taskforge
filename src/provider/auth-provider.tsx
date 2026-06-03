"use client";

import { SessionProvider, getSession } from "next-auth/react";

import { registerAuthTokenGetter } from "@/lib/auth-token";

/**
 * Wires the Auth.js session into the rest of the app:
 *
 *  1. `SessionProvider` makes `useSession()` available to client components.
 *  2. The token getter is registered ONCE (module load) so the axios request
 *     interceptor (src/lib/axios.ts) can attach the backend JWT as a Bearer
 *     header — without the HTTP layer ever importing next-auth.
 *
 * Honors spec/auth.md: the token is always resolved from the Auth.js session,
 * never read from or written to localStorage.
 */
registerAuthTokenGetter(async () => {
  const session = await getSession();
  return session?.accessToken ?? null;
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
