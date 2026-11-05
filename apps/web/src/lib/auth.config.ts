import type { NextAuthConfig } from "next-auth";
import type { JWT } from "next-auth/jwt";

import { refreshBackendTokens } from "./backend-session";

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
const PUBLIC_PREFIXES = ["/login", "/register", "/verify-email", "/api/auth"];

/**
 * Renew the backend access token (15 minutes) once it has less than this left.
 * Longer than `SESSION_REFETCH_SECONDS` in `auth-provider.tsx`, so an open tab
 * renews it before it expires.
 */
const RENEW_BEFORE_MS = 5 * 60_000;

/**
 * The token with a usable backend access token: unchanged while it has time
 * left (unless `force`), renewed through the refresh token otherwise. A
 * refused refresh ends the session (`error`); an unreachable backend keeps
 * the old token so a blip doesn't sign anyone out.
 *
 * Runs wherever Auth.js reads the session: the proxy and `/api/auth/session`
 * save the renewed cookie, a Server Component's `auth()` can't — that render
 * spends the refresh token anyway, which the backend's reuse grace period
 * allows for.
 */
async function withFreshAccessToken(token: JWT, force: boolean): Promise<JWT> {
	// Sessions from before refresh tokens run until their access token's 401.
	if (typeof token.refreshToken !== "string") return token;
	const expiresAt =
		typeof token.accessTokenExpiresAt === "string"
			? Date.parse(token.accessTokenExpiresAt)
			: 0;
	if (!force && expiresAt - Date.now() > RENEW_BEFORE_MS) return token;

	try {
		const tokens = await refreshBackendTokens(token.refreshToken);
		if (!tokens) {
			return {
				...token,
				accessToken: undefined,
				refreshToken: undefined,
				error: "SessionExpired",
			};
		}
		return { ...token, ...tokens, error: undefined };
	} catch {
		return token;
	}
}

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
     * the header reflects the change without a re-login. An update with
     * `{ refreshAccessToken: true }` (sent after a backend 401) renews the
     * access token even if it doesn't look expired.
     *
     * The refresh token stays in this (encrypted, httpOnly) JWT; the `session`
     * callback never copies it to the client.
     */
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.userId = user.id;
        token.accessToken = user.accessToken;
        token.accessTokenExpiresAt = user.accessTokenExpiresAt;
        token.refreshToken = user.refreshToken;
        token.error = undefined;
        // Explicitly persist the avatar rather than relying on Auth.js's
        // implicit `user.image` -> `token.picture` default (which is undocumented
        // and could change on a version bump). `user.image` is seeded from the
        // backend's `avatarUrl` in auth.ts.
        token.picture = user.image ?? null;
      }
      if (trigger === "update" && session && typeof session === "object") {
        const next = session as { name?: unknown; image?: unknown };
        if (typeof next.name === "string") token.name = next.name;
        if (typeof next.image === "string") token.picture = next.image;
        else if (next.image === null) token.picture = null;
      }
      const force =
        trigger === "update" &&
        !!session &&
        typeof session === "object" &&
        (session as { refreshAccessToken?: unknown }).refreshAccessToken ===
          true;
      return withFreshAccessToken(token, force);
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
      // Mirror the avatar onto the client session explicitly (same reason as the
      // jwt callback) so `session.user.image` is always driven by our token.
      session.user.image = typeof token.picture === "string" ? token.picture : null;
      if (token.error === "SessionExpired") session.error = "SessionExpired";
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
      // A session whose refresh token was refused is over, even though its
      // cookie is still there (the client signs it out).
      const isLoggedIn = !!auth?.user && !auth.error;
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
