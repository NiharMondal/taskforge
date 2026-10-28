import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

import { login, verifyEmail } from "@/features/auth/api/auth-api";
import { loginSchema } from "@/features/auth/schemas/auth-schema";
import type { LoginResponse } from "@/features/auth/types/auth-types";
import { ApiError } from "@/lib/api-error";

import { API_URL } from "./api-url";
import { authConfig } from "./auth.config";
import { revokeBackendSession } from "./backend-session";

/**
 * Auth.js v5 entrypoint (Node runtime).
 *
 * Composes the Edge-safe base (`authConfig`) with the Credentials provider,
 * which delegates user/password validation and JWT issuance to the backend
 * (spec/auth.md). Exposes the four primitives the rest of the app uses:
 *
 *   - `handlers` -> re-exported by app/api/auth/[...nextauth]/route.ts
 *   - `auth`     -> session in Server Components, Route Handlers, and proxy.ts
 *   - `signIn` / `signOut` -> server actions (client uses next-auth/react)
 */

/** Thrown by `authorize` so the login form can show a generic message. */
class InvalidCredentials extends CredentialsSignin {
  code = "invalid_credentials";
}

/** The right password on an account whose email was never confirmed (403). */
class EmailUnverified extends CredentialsSignin {
  code = "email_unverified";
}

/** A verification link that is malformed, expired or already used. */
class InvalidVerificationLink extends CredentialsSignin {
  code = "invalid_link";
}

/** The address got an account (e.g. through Google) after the link was sent. */
class EmailTaken extends CredentialsSignin {
  code = "email_taken";
}

/**
 * What a sign-in hands Auth.js: the user, plus the backend token pair the
 * `jwt` callback stores. `image` is seeded from the backend's `avatarUrl`
 * (Auth.js copies it into `token.picture` -> `session.user.image`).
 */
function toAuthUser({ user, ...tokens }: LoginResponse) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.avatarUrl ?? null,
    accessToken: tokens.accessToken,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt,
    refreshToken: tokens.refreshToken,
  };
}

/**
 * Exchange Google's signed ID token for a backend session.
 *
 * Only the `id_token` is forwarded — never the profile fields. `POST /auth/google`
 * is public, so the backend verifies the token's signature and audience with
 * Google and reads email/sub/picture from it; anything we asserted ourselves
 * would let a caller sign in as whoever they claimed to be.
 */
async function googleProfile(idToken: string | undefined) {
  if (!idToken) throw new Error("Google did not return an ID token");

  const res = await fetch(`${API_URL}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google auth failed: ${res.status} ${text}`);
  }

  const { data } = (await res.json()) as { data: LoginResponse };

  return toAuthUser(data);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,

      // Auth.js passes the token set as the second argument.
      async profile(_profile, tokens) {
        return googleProfile(tokens.id_token);
      },
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        // Validate before touching the network (never trust input).
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) throw new InvalidCredentials();

        try {
          return toAuthUser((await login(parsed.data)).data);
        } catch (error) {
          // Only reachable with the right password, so saying why is safe.
          if (error instanceof ApiError && error.status === 403) {
            throw new EmailUnverified();
          }
          // Map expected auth rejections to a single generic credentials error:
          //   401 bad email/password (the backend never says which) · 400
          //   validation. 404 is kept for older backends that reported an
          //   unknown email separately.
          // Anything else (500, network) is a real fault — rethrow so it
          // surfaces as a server error instead of "wrong password".
          if (
            error instanceof ApiError &&
            [400, 401, 404].includes(error.status)
          ) {
            throw new InvalidCredentials();
          }
          throw error;
        }
      },
    }),
    // The link in a verification email: `/verify-email` posts its token here,
    // the backend creates the account, and the person is signed in.
    Credentials({
      id: "email-verification",
      name: "Email verification",
      credentials: { token: {} },

      async authorize(credentials) {
        const token = credentials?.token;
        if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) {
          throw new InvalidVerificationLink();
        }

        try {
          return toAuthUser((await verifyEmail({ token })).data);
        } catch (error) {
          if (error instanceof ApiError && error.status === 400) {
            throw new InvalidVerificationLink();
          }
          if (error instanceof ApiError && error.status === 409) {
            throw new EmailTaken();
          }
          throw error;
        }
      },
    }),
  ],
  events: {
    // End the backend session too, so the refresh token can't outlive the
    // cookie it was in.
    async signOut(message) {
      const refreshToken =
        "token" in message ? message.token?.refreshToken : undefined;
      if (typeof refreshToken === "string") {
        await revokeBackendSession(refreshToken);
      }
    },
  },
  secret: process.env.AUTH_SECRET,
});
