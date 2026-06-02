/**
 * Module augmentation for Auth.js (next-auth v5).
 *
 * The backend is the source of truth for identity and permissions
 * (see spec/auth.md). The frontend only carries the opaque `accessToken`
 * and a minimal user shape derived from the Prisma `User` model
 * (id, name, email, avatarUrl -> image).
 *
 * These declarations make `session.accessToken`, `session.user.id`, and the
 * matching JWT fields type-safe everywhere `auth()` / `useSession()` is used.
 */
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  /** Returned by `authorize`, persisted into the JWT. */
  interface User {
    /** Backend-issued JWT. Attached to API requests as a Bearer token. */
    accessToken?: string;
  }

  interface Session {
    /** Backend-issued JWT, mirrored from the token in the `session` callback. */
    accessToken?: string;
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

/**
 * NOTE on the JWT side: under pnpm, augmenting the JWT interface (which lives in
 * `@auth/core/jwt` and is only re-exported by `next-auth/jwt`) does not reliably
 * merge. Rather than depend on that, the `jwt`/`session` callbacks in
 * `auth.config.ts` read token fields through runtime type guards. The base JWT
 * already allows arbitrary string keys (`extends Record<string, unknown>`), so
 * writing `token.userId` / `token.accessToken` is type-safe without augmentation.
 */
