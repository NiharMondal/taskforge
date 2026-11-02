import { API_URL } from "@/lib/api-url";

import type { User } from "@/features/profile/types/profile-types";

import type { PlatformRole } from "../types/admin-types";

/**
 * The signed-in user's platform role, read from `GET /users/me` on the
 * server, for the admin layout's gate. `null` when they have none, or the
 * backend won't say who they are (401/403/404). Plain `fetch`, not the axios
 * client: that one reads its token from the browser session.
 *
 * Only a UX gate — the backend's PlatformRoleGuard checks every `/admin`
 * request. Throws when the backend can't be reached or fails, so an outage
 * shows the error page instead of a misleading 404.
 */
export async function fetchPlatformRole(
	accessToken: string | undefined,
): Promise<PlatformRole | null> {
	if (!accessToken) return null;

	const res = await fetch(`${API_URL}/users/me`, {
		headers: { Authorization: `Bearer ${accessToken}` },
		cache: "no-store",
	});
	if ([401, 403, 404].includes(res.status)) return null;
	if (!res.ok) throw new Error(`Reading the profile failed: ${res.status}`);

	const { data } = (await res.json()) as { data: Pick<User, "platformRole"> };
	return data.platformRole ?? null;
}
