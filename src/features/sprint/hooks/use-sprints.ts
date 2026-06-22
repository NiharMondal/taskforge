import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSprint, getSprints, updateSprint } from "../api/sprint-api";
import type { Sprint, CreateSprintDto, UpdateSprintDto } from "../types/sprint-types";

export const sprintKeys = {
	list: (workspaceId: string, projectId: string) =>
		["sprints", workspaceId, projectId] as const,
};

export function useSprints(workspaceId: string, projectId: string) {
	return useQuery({
		queryKey: sprintKeys.list(workspaceId, projectId),
		queryFn: async () => (await getSprints(projectId)).data,
		enabled: !!workspaceId && !!projectId,
	});
}

export function useCreateSprint(workspaceId: string, projectId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (dto: CreateSprintDto) => createSprint(projectId, dto),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: sprintKeys.list(workspaceId, projectId),
			});
		},
	});
}

interface UpdateSprintVars {
	sprintId: string;
	dto: UpdateSprintDto;
}

export function useUpdateSprint(workspaceId: string, projectId: string) {
	const queryClient = useQueryClient();
	const key = sprintKeys.list(workspaceId, projectId);

	return useMutation({
		mutationFn: ({ sprintId, dto }: UpdateSprintVars) =>
			updateSprint(projectId, sprintId, dto),

		onMutate: async ({ sprintId, dto }) => {
			await queryClient.cancelQueries({ queryKey: key });
			const previous = queryClient.getQueryData<Sprint[]>(key);

			queryClient.setQueryData<Sprint[]>(key, (old) =>
				old?.map((s) => (s.id === sprintId ? { ...s, ...dto } : s)),
			);

			return { previous };
		},

		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(key, context.previous);
			}
		},

		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: key });
		},
	});
}
