import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { login } from "@/features/auth/api/auth-api";
import { loginSchema } from "@/features/auth/schemas/auth-schema";
import { ApiError } from "@/lib/api-error";

import { authConfig } from "./auth.config";

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
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
          const { user, accessToken } = (await login(parsed.data)).data;

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            accessToken,
          };
        } catch (error) {
          // Map expected auth rejections to a single generic credentials error:
          //   401 invalid password · 404 user not found · 400 validation.
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
  ],
  secret: process.env.AUTH_SECRET,
});
