"use client";

import { Button, toast } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleUserRound, Plus } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";

import { FormTextField, FormWrapper } from "@/components/form-element";
import { getApiErrorMessage } from "@/lib/api-error";

import { useCreateIssue } from "../hooks/use-issues";
import { subIssueSchema, type TSubIssueValues } from "../schema/issue-schema";
import type { Issue } from "../types/issue-types";
import IssueKey from "./IssueKey";
import StatusChip from "./StatusChip";

interface Props {
	issue: Issue;
	workspaceId: string;
	/** Shows the "Add sub-issue" field (`canCreateIssue`). */
	canCreate: boolean;
}

/**
 * The issue page's sub-issue list: progress, one line per child, and an
 * inline title field that creates a new one. Hidden on a sub-issue — nesting
 * is one level deep (the backend refuses deeper).
 */
export default function SubIssuesPanel({ issue, workspaceId, canCreate }: Props) {
	const subIssues = issue.subIssues ?? [];
	const { mutateAsync: createIssue, isPending } = useCreateIssue(
		workspaceId,
		issue.projectId,
	);
	const methods = useForm<TSubIssueValues>({
		resolver: zodResolver(subIssueSchema),
		defaultValues: { title: "" },
	});

	if (issue.parentIssueId) return null;
	if (subIssues.length === 0 && !canCreate) return null;

	const done = subIssues.filter((s) => s.status === "DONE").length;
	const percent = subIssues.length
		? Math.round((done / subIssues.length) * 100)
		: 0;

	const handleAdd = async ({ title }: TSubIssueValues) => {
		try {
			await createIssue({ title, parentIssueId: issue.id });
			methods.reset();
		} catch (error) {
			toast.danger(getApiErrorMessage(error, "Failed to add sub-issue"));
		}
	};

	return (
		<section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
			<div className="flex items-center justify-between gap-3">
				<h2 className="text-sm font-semibold">Sub-issues</h2>
				{subIssues.length > 0 && (
					<span className="text-xs text-muted">
						{done} of {subIssues.length} done
					</span>
				)}
			</div>

			{subIssues.length > 0 && (
				<>
					<div
						className="h-1.5 overflow-hidden rounded-full bg-surface-tertiary"
						role="progressbar"
						aria-label="Sub-issues done"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={percent}
					>
						<div
							className="h-full rounded-full bg-success transition-all"
							style={{ width: `${percent}%` }}
						/>
					</div>

					<ul className="flex flex-col divide-y divide-border rounded-md border border-border">
						{subIssues.map((sub) => (
							<li key={sub.id} className="flex items-center gap-3 px-3 py-2">
								<IssueKey
									issue={{ projectId: issue.projectId, number: sub.number }}
								/>
								<Link
									href={`/projects/${issue.projectId}/issues/${sub.id}`}
									className="min-w-0 flex-1 truncate text-sm hover:underline"
								>
									{sub.title}
								</Link>
								<StatusChip status={sub.status} />
								<span
									className="hidden max-w-28 items-center gap-1 truncate text-xs text-muted sm:flex"
									title={sub.assignee?.name ?? "Unassigned"}
								>
									<CircleUserRound className="size-3.5 shrink-0" />
									<span className="truncate">
										{sub.assignee?.name ?? "Unassigned"}
									</span>
								</span>
							</li>
						))}
					</ul>
				</>
			)}

			{canCreate && (
				<FormWrapper
					methods={methods}
					onSubmit={handleAdd}
					className="flex items-start gap-2 space-y-0"
				>
					<div className="flex-1">
						<FormTextField
							name="title"
							placeholder="Add a sub-issue — type a title, press Enter"
							isDisabled={isPending}
						/>
					</div>
					<Button
						type="submit"
						variant="outline"
						isDisabled={isPending}
						aria-label="Add sub-issue"
					>
						<Plus className="h-4 w-4" />
						{isPending ? "Adding…" : "Add"}
					</Button>
				</FormWrapper>
			)}
		</section>
	);
}
