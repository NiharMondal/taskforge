"use client";

import { Button } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import {
	FormRichTextEditor,
	FormSelect,
	FormTextField,
	FormWrapper,
} from "@/components/form-element";
import { issueSchema, TIssueFormValues } from "../schema/issue-schema";
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from "../constants";
import { Member } from "@/features/memberships/types/membership-types";
import { Sprint } from "../types/issue-types";

type Props = {
	defaultValues?: TIssueFormValues | undefined;
	onSubmit: (
		values: TIssueFormValues,
	) => Promise<boolean | void> | boolean | void;
	isSubmitting: boolean;
	onSuccess?: () => void;
	onCancel?: () => void;
	members: Member[];
	sprints: Sprint[];
};

/** Sentinel ListBox key for "no assignee" (react-aria keys can't be empty). */
export const UNASSIGNED = "__unassigned__";

/** Sentinel key for "no sprint assigned". */
export const NO_SPRINT = "__no_sprint__";

export default function IssueForm({
	defaultValues,
	onSubmit,
	isSubmitting,
	onSuccess,
	onCancel,
	members,
	sprints,
}: Props) {
	const isEditing = !!defaultValues;

	const methods = useForm<TIssueFormValues>({
		resolver: zodResolver(issueSchema),
		defaultValues: {
			title: "",
			description: "",
			assigneeId: null,
			status: "BACKLOG",
			priority: "LOW",
			sprintId: null,
		},
		// `defaultValues` is only read once on mount. When editing, the issue is
		// fetched async, so feed it through `values` to keep the form in sync once
		// the data arrives. `keepDirtyValues` avoids clobbering edits if a slow
		// fetch resolves after the user has started typing.
		values: defaultValues,
		resetOptions: { keepDirtyValues: true },
	});

	const handleFormSubmit = async (values: TIssueFormValues) => {
		const normalized: TIssueFormValues = {
			...values,
			assigneeId:
				values.assigneeId === UNASSIGNED ? null : values.assigneeId,
			sprintId: values.sprintId === NO_SPRINT ? null : values.sprintId,
		};
		const success = await onSubmit(normalized);
		if (success === false) return;
		methods.reset();
		onSuccess?.();
	};

	return (
		<FormWrapper methods={methods} onSubmit={handleFormSubmit}>
			<FormTextField
				name="title"
				label="Title"
				placeholder="e.g. Login button is misaligned"
				isRequired
			/>
			<FormRichTextEditor
				name="description"
				label="Description"
				placeholder="Optional details, steps to reproduce, acceptance criteria…"
			/>
			<div className="flex items-center justify-between gap-5 min-w-full">
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
			</div>
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
			<div className="mt-2 flex justify-end gap-2">
				<Button variant="outline" type="button" onClick={onCancel}>
					Cancel
				</Button>

				<Button type="submit" isDisabled={isSubmitting}>
					{isSubmitting
						? isEditing
							? "Saving…"
							: "Creating…"
						: isEditing
							? "Save Changes"
							: "Create Issue"}
				</Button>
			</div>
		</FormWrapper>
	);
}
