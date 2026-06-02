/**
 * Backend auth contract types.
 *
 * Derived from the Prisma `User` model (.claude/schema.prisma) and the login
 * response documented in spec/auth.md. Do NOT guess fields beyond the contract
 * (see AI_GUIDE: "Never Guess API").
 */

/** Minimal user identity returned by the backend on login. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

/**
 * Payload of a successful `POST /auth/login` — i.e. the `data` field of the
 * backend envelope (see {@link ApiResponse}):
 *
 * ```json
 * { "success": true, "data": { "accessToken": "jwt", "user": { "id", "name", "email" } } }
 * ```
 */
export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
}

/** `POST /auth/login` request body. */
export interface LoginRequest {
  email: string;
  password: string;
}

/** `POST /auth/register` request body. Registration is owned by the backend. */
export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  user: AuthUser
}