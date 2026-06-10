"use client";

import { Button, Modal, toast } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { getApiErrorMessage } from "@/lib/api-error";
import type { Member } from "@/features/memberships/types/membership-types";

import { ISSUE_PRIORITIES, ISSUE_STATUSES } from "../constants";
import type { CreateIssueDto } from "../types/issue-types";
import {
	FormRichTextEditor,
	FormSelect,
	FormTextField,
	FormWrapper,
} from "@/components/form-element";

/** Sentinel ListBox key for "no assignee" (react-aria keys can't be empty). */
const UNASSIGNED = "__unassigned__";

const schema = z.object({
	title: z.string().min(1, "Title is required"),
	description: z.string().optional(),
	status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]),
	priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
	assigneeId: z.string(),
});

type FormValues = z.infer<typeof schema>;

interface CreateIssueModalProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (dto: CreateIssueDto) => Promise<void>;
	members: Member[];
	isLoading?: boolean;
}

export default function CreateIssueModal({
	isOpen,
	onOpenChange,
	onSubmit,
	members,
	isLoading,
}: CreateIssueModalProps) {
	const methods = useForm({
		resolver: zodResolver(schema),
		defaultValues: {
			title: "",
			description: "",
			status: "BACKLOG",
			priority: "MEDIUM",
			assigneeId: UNASSIGNED,
		},
	});
	const handleClose = () => {
		methods.reset();
		onOpenChange(false);
	};

	const submit = async (values: FormValues) => {
		try {
			await onSubmit({
				title: values.title,
				description: values.description || undefined,
				status: values.status,

				assigneeId:
					values.assigneeId === UNASSIGNED ? null : values.assigneeId,
			});
			toast.success("Issue created successfully");
			handleClose();
		} catch (err) {
			toast.danger(getApiErrorMessage(err) || "Failed to create issue");
		}
	};

	return (
		<Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
			<Modal.Container size="cover">
				<Modal.Dialog>
					<FormWrapper methods={methods} onSubmit={submit}>
						<Modal.Header>
							<Modal.Heading>New Issue</Modal.Heading>
							<Modal.CloseTrigger onPress={handleClose} />
						</Modal.Header>
						<Modal.Body className="flex flex-col gap-4">
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
								options={[
									{ value: UNASSIGNED, label: "Unassigned" },
									...members.map((member) => ({
										value: member.userId,
										label: member?.user?.name,
									})),
								]}
							/>
						</Modal.Body>
						<Modal.Footer>
							<Button
								variant="outline"
								onPress={handleClose}
								type="button"
							>
								Cancel
							</Button>
							<Button type="submit" isDisabled={isLoading}>
								{isLoading ? "Creating…" : "Create Issue"}
							</Button>
						</Modal.Footer>
					</FormWrapper>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}


