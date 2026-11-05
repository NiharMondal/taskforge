/**
 * Backend auth contract types.
 *
 * Derived from the Prisma `User` model (apps/backend/prisma/schema.prisma) and the login
 * response documented in spec/auth.md. Do NOT guess fields beyond the contract
 * (see AI_GUIDE: "Never Guess API").
 */

/** Minimal user identity returned by the backend on login. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  /** Persisted avatar URL, mapped to `session.user.image` */
  avatarUrl?: string | null;
}

/**
 * The backend's token pair. The access token lasts 15 minutes; the refresh
 * token is exchanged for a new pair (`POST /auth/refresh`) and is replaced
 * every time. Both live only in the Auth.js JWT cookie — the refresh token is
 * never copied into the client-visible session.
 */
export interface AuthTokens {
  accessToken: string;
  /** ISO timestamp when `accessToken` stops working. */
  accessTokenExpiresAt: string;
  refreshToken: string;
}

/**
 * Payload of a successful sign-in (`POST /auth/login`, `/auth/google` and
 * `/auth/verify-email`) — i.e. the `data` field of the backend envelope.
 */
export interface LoginResponse extends AuthTokens {
  user: AuthUser;
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

/**
 * `POST /auth/register` answers 202 with only the (normalized) address,
 * whether or not it was new: the account is created when the emailed link is
 * followed (`POST /auth/verify-email`).
 */
export interface RegisterResponse {
  email: string;
}

/** `POST /auth/verify-email` request body: the token from the emailed link. */
export interface VerifyEmailRequest {
  token: string;
}

/**
 * `POST /auth/google` takes only Google's signed ID token; the backend verifies
 * it and reads email/name/picture/sub from it.
 */
export interface GoogleAuthRequest {
  idToken: string;
}

export type GoogleAuthResponse = LoginResponse;