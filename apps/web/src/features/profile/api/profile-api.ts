import { api } from "@/lib/axios";

import type { ApiResponse } from "@/types/api";

import type { UpdateProfileDto, User } from "../types/profile-types";

/**
 * Profile API layer. All network access for the current user lives here
 * (AGENTS.md: never call axios directly from components).
 *
 * The backend exposes the user under `/users/:id` (there is no `/me`); the
 * caller supplies the id from the session.
 */

/** Fetch a user by id (`GET /users/:id`). */
export async function getUser(userId: string): Promise<ApiResponse<User>> {
	return api.get<User>(`/users/${userId}`);
}

/** Update the current user's editable profile fields (`PATCH /users/:id`). */
export async function updateProfile(
	userId: string,
	dto: UpdateProfileDto,
): Promise<ApiResponse<User>> {
	return api.patch<User>(`/users/${userId}`, dto);
}
