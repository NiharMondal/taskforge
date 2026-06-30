import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js configuration.
 *
 * This file is imported by `proxy.ts` (Next.js 16's renamed Middleware), which
 * runs on the Edge runtime. It therefore must NOT import anything Node-only
 * (axios, the Credentials provider, etc.). The Credentials provider and its
 * `authorize` call live in `auth.ts`, which composes this base config.
 *
 * Auth.js v5 split-config pattern:
 *   https://authjs.dev/guides/edge-compatibility
 */

/** Routes that render the auth UI; signed-in users are bounced away from these. */
const AUTH_ROUTES = ["/login", "/register"];

/** Public route prefixes that never require a session. */
const PUBLIC_PREFIXES = ["/login", "/register", "/api/auth"];

export const authConfig = {
  // Backend owns the database; we keep session state in a stateless JWT.
  session: { strategy: "jwt" },

  pages: {
    signIn: "/login",
  },

  // Providers are added in auth.ts (kept out of the Edge bundle).
  providers: [],

  callbacks: {
    /**
     * Persist backend identity + token into the JWT on sign-in.
     * `user` is only present on the initial sign-in call.
     *
     * On `trigger === "update"` (from `useSession().update()` after a profile
     * save) we mirror the new name/image into the token — Auth.js maps
     * `token.name`/`token.picture` back onto `session.user.name`/`.image`, so
     * the header reflects the change without a re-login.
     */
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.userId = user.id;
        token.accessToken = user.accessToken;
      }
      if (trigger === "update" && session && typeof session === "object") {
        const next = session as { name?: unknown; image?: unknown };
        if (typeof next.name === "string") token.name = next.name;
        if (typeof next.image === "string") token.picture = next.image;
        else if (next.image === null) token.picture = null;
      }
      return token;
    },

    /**
     * Expose id + accessToken to the client/server session object.
     * Token fields are read through runtime guards (see note in
     * src/types/next-auth.d.ts on why JWT isn't augmented under pnpm).
     */
    async session({ session, token }) {
      const userId = typeof token.userId === "string" ? token.userId : token.sub;
      if (userId) session.user.id = userId;
      if (typeof token.accessToken === "string") {
        session.accessToken = token.accessToken;
      }
      return session;
    },

    /**
     * Route authorization for `proxy.ts`. Returning `false` redirects to the
     * configured `signIn` page; returning a `Response` overrides the request.
     *
     * NOTE (spec/auth.md rule #4/#5): this is an OPTIMISTIC, UX-only guard.
     * The backend remains the source of truth for permissions on every API call.
     */
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      const isAuthRoute = AUTH_ROUTES.includes(pathname);
      if (isAuthRoute) {
        // Don't show login/register to already-authenticated users.
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
      if (isPublic) return true;

      // Everything else the proxy matches requires a session.
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
