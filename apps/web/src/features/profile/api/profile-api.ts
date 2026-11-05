import { api } from "@/lib/axios";

import type { ApiResponse } from "@/types/api";

import type {
	DeleteAccountDto,
	UpdateProfileDto,
	User,
} from "../types/profile-types";

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

/**
 * Delete the signed-in user's account (`DELETE /users/me`). A 409 names the
 * workspaces they own that other people use; the caller signs out on success.
 */
export async function deleteAccount(
	dto: DeleteAccountDto,
): Promise<ApiResponse<null>> {
	// axios sends a DELETE body only through `data`.
	return api.delete<null>("/users/me", { data: dto });
}

/**
 * Everything the account holds about the signed-in user
 * (`GET /users/me/export`). Saved as a file as-is, so it isn't typed here.
 */
export async function exportMyData(): Promise<ApiResponse<unknown>> {
	return api.get<unknown>("/users/me/export");
}
