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

/** Fetch the current user; `queryFn` unwraps `.data` so the cache holds a plain `User`. */
export function useCurrentUser(userId: string | undefined) {
	return useQuery({
		queryKey: profileKeys.detail(userId ?? ""),
		queryFn: async () => (await getUser(userId as string)).data,
		enabled: !!userId,
	});
}

interface UpdateProfileVars {
	userId: string;
	dto: UpdateProfileDto;
}

export function useUpdateProfile() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ userId, dto }: UpdateProfileVars) =>
			updateProfile(userId, dto),
		onSuccess: (_res, { userId }) => {
			queryClient.invalidateQueries({
				queryKey: profileKeys.detail(userId),
			});
		},
	});
}
