"use client";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { useSingleIssue, useUpdateIssue } from "../hooks/use-issues";
import { useMemberships } from "@/features/memberships/hooks/use-memberships";
import { UpdateIssueDto } from "../types/issue-types";
import { TIssueFormValues } from "../schema/issue-schema";
import IssueForm, { UNASSIGNED } from "./IssueForm";
import { toast } from "@heroui/react";
import { getApiErrorMessage } from "@/lib/api-error";
import { useMemo } from "react";
import { useRouter } from "next/navigation";

type Props = {
	projectId: string;
	issueId: string;
};

export default function IssueDetailComponent({ projectId, issueId }: Props) {
	const router  = useRouter();
	const { activeWorkspaceId } = useWorkspace();
	const workspaceId = activeWorkspaceId ?? "";
	const { data: issue } = useSingleIssue(workspaceId, projectId, issueId);
	const { data: members = [] } = useMemberships(workspaceId);
	const onCancel = ()=>{
		router.back()
	}
	const { mutateAsync: updateIssue, isPending } = useUpdateIssue(
		workspaceId,
		projectId,
	);
	const defaultValues = useMemo(
		() =>
			issue && {
				title: issue.title,
				description: issue.description,
				status: issue.status,
				priority: issue.priority,
				// Map a null assignee onto the select's sentinel key so it
				// pre-selects "Unassigned" instead of showing the placeholder.
				assigneeId: issue.assigneeId ?? UNASSIGNED,
			},
		[issue],
	);
	const handleUpdateIssue = async (values: TIssueFormValues) => {
		if (!issue) return false;

		const nextAssignee =
			values.assigneeId === UNASSIGNED
				? null
				: (values.assigneeId ?? null);

		// PATCH only what changed.
		const dto: UpdateIssueDto = {
			...(values.title !== issue.title && { title: values.title }),
			...((values.description ?? "") !== (issue.description ?? "") && {
				description: values.description || undefined,
			}),
			...(values.status !== issue.status && { status: values.status }),
			...(values.priority !== issue.priority && {
				priority: values.priority,
			}),
			...(nextAssignee !== (issue.assigneeId ?? null) && {
				assigneeId: nextAssignee,
			}),
		};

		// Nothing changed — just close.
		if (Object.keys(dto).length === 0) return true;

		try {
			const res = await updateIssue({ issueId: issue.id, dto });
			toast.success(res?.message || "Issue updated successfully");
			return true;
		} catch (error) {
			toast.danger(getApiErrorMessage(error));
			return false;
		}
	};
	return (
		<div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
			<div className="xl:col-span-4">
				<IssueForm
					isSubmitting={isPending}
					onSubmit={handleUpdateIssue}
					members={members}
					defaultValues={defaultValues as TIssueFormValues}
					onCancel={onCancel}
				/>
			</div>
			<div className="flex flex-col gap-3.5 border p-3 rounded-md">
				<Staff designation="Reporter" value={issue?.reporter?.name} />
				<Staff designation="Assignee" value={issue?.assignee?.name} />
			</div>
		</div>
	);
}

type StaffProps = {
	designation: string;
	value: string | undefined;
};
function Staff({ designation, value }: StaffProps) {
	return (
		<div className="flex flex-col gap-0.5">
			<h5 className="font-semibold">{designation}</h5>
			<p>{value ?? "--"}</p>
		</div>
	);
}
