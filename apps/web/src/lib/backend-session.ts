import { ACCOUNT_SUSPENDED_ERROR_CODE } from "@taskforge/shared";

import type { AuthTokens } from "@/features/auth/types/auth-types";
import type { SessionEndReason } from "@/types/next-auth";

import { API_URL } from "./api-url";

/**
 * The backend's session routes, for the Auth.js callbacks. Plain `fetch`, not
 * axios: `auth.config.ts` runs on the Edge runtime inside `proxy.ts`.
 */

const post = (path: string, body: unknown) =>
	fetch(`${API_URL}${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
		cache: "no-store",
	});

/**
 * Exchange a refresh token for a new pair (the old refresh token stops
 * working). When the backend refuses it the session is over, and this says
 * why: `AccountSuspended` for a suspended account (403 `ACCOUNT_SUSPENDED`),
 * else `SessionExpired`. Throws when the backend can't be reached, so a blip
 * doesn't end the session.
 */
export async function refreshBackendTokens(
	refreshToken: string,
): Promise<AuthTokens | SessionEndReason> {
	const res = await post("/auth/refresh", { refreshToken });
	if (res.status === 400 || res.status === 401) return "SessionExpired";
	if (res.status === 403) {
		const body = (await res.json().catch(() => null)) as {
			code?: unknown;
		} | null;
		if (body?.code === ACCOUNT_SUSPENDED_ERROR_CODE) return "AccountSuspended";
	}
	if (!res.ok) throw new Error(`Refreshing the session failed: ${res.status}`);
	const { data } = (await res.json()) as { data: AuthTokens };
	return data;
}

/** Sign-out: revoke the refresh token's session. Best effort. */
export async function revokeBackendSession(refreshToken: string) {
	try {
		await post("/auth/logout", { refreshToken });
	} catch {
		// The cookie is cleared regardless; the token expires on its own.
	}
}
