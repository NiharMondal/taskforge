import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth.config";

/**
 * Route protection via Next.js 16 Proxy (formerly Middleware — renamed in v16,
 * same functionality; see node_modules/next/dist/docs/.../16-proxy.md).
 *
 * We initialize a SEPARATE NextAuth instance from the Edge-safe `authConfig`
 * (no Credentials provider, no axios) so this stays Edge-compatible. The
 * `authorized` callback in auth.config.ts decides redirects.
 *
 * This is an optimistic UX guard only. Per spec/auth.md, the backend is the
 * source of truth — protected data is still gated server-side on every request.
 */
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  /**
   * Run on everything except Next internals and static assets. Auth API routes
   * are matched but treated as public by the `authorized` callback so the
   * session/callback endpoints keep working.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)"],
};
