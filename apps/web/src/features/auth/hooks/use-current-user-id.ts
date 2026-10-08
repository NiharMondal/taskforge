"use client";

import { useSession } from "next-auth/react";

import { getUserIdFromAccessToken } from "@/lib/auth-token";

/**
 * The signed-in user's backend id.
 *
 * Prefers the `sub` inside the backend access token — the identity every API
 * call is actually authorized as — over `session.user.id`, a copy cached in the
 * Auth.js cookie that can disagree with it (e.g. after a Google sign-in) and
 * then makes `/users/<id>` answer 403 and roster lookups come up empty.
 */
export function useCurrentUserId(): string | undefined {
	const { data: session } = useSession();
	return getUserIdFromAccessToken(session?.accessToken) ?? session?.user?.id;
}
