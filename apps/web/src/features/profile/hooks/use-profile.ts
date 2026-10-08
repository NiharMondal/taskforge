import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getUser, updateProfile } from "../api/profile-api";
import type { UpdateProfileDto } from "../types/profile-types";

/**
 * Query keys for the current user. Scoped by user id (identity is global, not
 * per-workspace, so unlike issues/projects these keys carry no workspaceId).
 */
export const profileKeys = {
	all: ["user"] as const,
	detail: (userId: string) => [...profileKeys.all, userId] as const,
};

/**
 * Fetch the current user; `queryFn` unwraps `.data` so the cache holds a plain
 * `User`. `userId` only scopes the cache entry (and gates the query until
 * signed in) — the request itself is `/users/me`, resolved from the token.
 */
export function useCurrentUser(userId: string | undefined) {
	return useQuery({
		queryKey: profileKeys.detail(userId ?? ""),
		queryFn: async () => (await getUser()).data,
		enabled: !!userId,
	});
}

export function useUpdateProfile() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (dto: UpdateProfileDto) => updateProfile(dto),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: profileKeys.all });
		},
	});
}
