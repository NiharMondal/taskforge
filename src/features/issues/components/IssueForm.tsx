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

type Props = {
	defaultValues?: TIssueFormValues | null;
	onSubmit: (
		values: TIssueFormValues,
	) => Promise<boolean | void> | boolean | void;
	isSubmitting: boolean;
	onSuccess?: () => void;
	onCancel?: () => void;
	members: Member[];
};

/** Sentinel ListBox key for "no assignee" (react-aria keys can't be empty). */
const UNASSIGNED = "__unassigned__";

export default function IssueForm({
	defaultValues,
	onSubmit,
	isSubmitting,
	onSuccess,
	onCancel,
	members,
}: Props) {
	const isEditing = !!defaultValues;

	const methods = useForm<TIssueFormValues>({
		resolver: zodResolver(issueSchema),
		defaultValues: defaultValues ?? {
			title: "",
			description: "",
			assigneeId: null,
			status: "BACKLOG",
			priority: "LOW",
		},
	});

	const handleFormSubmit = async (values: TIssueFormValues) => {
		const success = await onSubmit(values);
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
							: "Create Project"}
				</Button>
			</div>
		</FormWrapper>
	);
}
