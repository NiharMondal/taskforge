import { toast } from "@heroui/react";

import { getApiErrorMessage } from "@/lib/api-error";
import { toISO } from "@/util/iso";

import type { TSprintFormValues } from "../schema/sprint-schema";
import type { CreateSprintDto, Sprint } from "../types/sprint-types";
import {
	useCreateSprint,
	useStartSprint,
	useUpdateSprint,
} from "./use-sprints";

/** Form values → API payload: empty goal is "no goal", dates go to ISO. */
const toDto = (values: TSprintFormValues): CreateSprintDto => ({
	...values,
	goal: values.goal || null,
	startDate: toISO(values.startDate),
	endDate: toISO(values.endDate),
});

/**
 * Sprint planning actions with their toasts: create, edit, start. The form
 * handlers resolve to `true` on success so `SprintForm` knows to close.
 * (Ending a sprint lives in `EndSprintModal`, which confirms first.)
 */
export function useSprintActions(workspaceId: string, projectId: string) {
	const create = useCreateSprint(workspaceId, projectId);
	const update = useUpdateSprint(workspaceId, projectId);
	const start = useStartSprint(workspaceId, projectId);

	const createSprint = async (values: TSprintFormValues) => {
		try {
			const res = await create.mutateAsync(toDto(values));
			toast.success(res.message || "Sprint created");
			return true;
		} catch (error) {
			toast.danger(getApiErrorMessage(error));
			return false;
		}
	};

	const updateSprint = async (sprint: Sprint, values: TSprintFormValues) => {
		try {
			const res = await update.mutateAsync({
				sprintId: sprint.id,
				dto: toDto(values),
			});
			toast.success(res.message || "Sprint updated");
			return true;
		} catch (error) {
			toast.danger(getApiErrorMessage(error));
			return false;
		}
	};

	const startSprint = async (sprint: Sprint) => {
		try {
			const res = await start.mutateAsync(sprint.id);
			toast.success(res.message || "Sprint started");
		} catch (error) {
			toast.danger(getApiErrorMessage(error, "Failed to start sprint"));
		}
	};

	return {
		createSprint,
		updateSprint,
		startSprint,
		isCreating: create.isPending,
		isUpdating: update.isPending,
		/** The sprint whose start request is in flight, if any. */
		startingSprintId: start.isPending ? start.variables : undefined,
	};
}
