"use client";

import { Button } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { FormSelect, FormWrapper } from "@/components/form-element";
import { Member } from "@/features/memberships/types/membership-types";

import { ISSUE_PRIORITIES, ISSUE_STATUSES } from "../constants";
import {
	issueDetailsSchema,
	TIssueDetailsValues,
} from "../schema/issue-schema";
import { Sprint } from "../types/issue-types";
import { NO_SPRINT, UNASSIGNED } from "./IssueForm";
import Avatar from "@/components/ui/avatar";
import { ICommonUserEntity } from "@/types/common";

type Props = {
	defaultValues: TIssueDetailsValues;
	onSubmit: (values: TIssueDetailsValues) => Promise<boolean | void>;
	isSubmitting: boolean;
	members: Member[];
	sprints: Sprint[];
	/** Read-only — the reporter is set at creation and never edited here. */
	reporter?: ICommonUserEntity;
};

/**
 * Right "Details" panel of the issue detail page: the issue's metadata
 * (status, priority, assignee, sprint) plus the read-only reporter. Saved on
 * its own, independent of the content form on the left.
 */
export default function IssueDetailsPanel({
	defaultValues,
	onSubmit,
	isSubmitting,
	members,
	sprints,
	reporter,
}: Props) {
	const methods = useForm<TIssueDetailsValues>({
		resolver: zodResolver(issueDetailsSchema),
		values: defaultValues,
		resetOptions: { keepDirtyValues: true },
	});
	const { isDirty } = methods.formState;

	const handleSubmit = async (values: TIssueDetailsValues) => {
		const success = await onSubmit(values);
		if (success === false) return;
		methods.reset(values);
	};

	return (
		<div className="flex flex-col gap-3.5 rounded-md p-4">
			<h4 className="text-sm font-semibold ">Details</h4>

			<FormWrapper methods={methods} onSubmit={handleSubmit}>
				<FormSelect
					name="status"
					label="Status"
					placeholder="Select status"
					options={ISSUE_STATUSES.map((s) => ({
						value: s.value,
						label: s.label,
					}))}
				/>
				<FormSelect
					name="priority"
					label="Priority"
					placeholder="Select priority"
					options={ISSUE_PRIORITIES.map((p) => ({
						value: p.value,
						label: p.label,
					}))}
				/>
				<FormSelect
					name="assigneeId"
					label="Assignee"
					placeholder="Select assignee"
					showAvatar
					options={[
						{ value: UNASSIGNED, label: "Unassigned" },
						...members.map((member) => ({
							value: member.userId,
							label: member?.user?.name,
							avatarUrl: member?.user?.avatarUrl || undefined,
						})),
					]}
				/>
				<FormSelect
					name="sprintId"
					label="Sprint"
					placeholder="Select sprint"
					options={[
						{ value: NO_SPRINT, label: "No Sprint" },
						...sprints.map((sprint) => ({
							value: sprint.id,
							label: sprint.name,
						})),
					]}
				/>

				<div className="flex flex-col gap-0.5">
					<span className="text-sm font-semibold">Reporter</span>
					<div className="flex items-center gap-2">
						{reporter?.avatarUrl && (
							<Avatar
								fallback={reporter.name?.charAt(0)}
								size="sm"
								src={reporter?.avatarUrl}
							/>
						)}
						<p className="text-sm">{reporter?.name ?? "--"}</p>
					</div>
				</div>

				<div className="flex justify-end">
					<Button type="submit" isDisabled={!isDirty || isSubmitting}>
						{isSubmitting ? "Saving…" : "Save"}
					</Button>
				</div>
			</FormWrapper>
		</div>
	);
}
