import { api } from "@/lib/axios";

import type { ApiResponse } from "@/types/api";

import type { UpdateProfileDto, User } from "../types/profile-types";

/**
 * Profile API layer. All network access for the current user lives here
 * (AGENTS.md: never call axios directly from components).
 *
 * Both calls use `/users/me`: the backend resolves "me" from the access token.
 * `/users/<id>` is self-only too, but would need us to know the id, and the one
 * cached in the Auth.js session can disagree with the token's (then it is a 403).
 */

/** Fetch the signed-in user (`GET /users/me`). */
export async function getUser(): Promise<ApiResponse<User>> {
	return api.get<User>("/users/me");
}

/** Update the signed-in user's editable profile fields (`PATCH /users/me`). */
export async function updateProfile(
	dto: UpdateProfileDto,
): Promise<ApiResponse<User>> {
	return api.patch<User>("/users/me", dto);
}
