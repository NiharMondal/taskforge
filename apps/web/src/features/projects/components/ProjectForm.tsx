"use client";

import { Button } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import {
	FormSelect,
	FormTextArea,
	FormTextField,
	FormWrapper,
} from "@/components/form-element";

import {
	DEFAULT_WORKFLOW,
	projectSchema,
	type TProjectFormValues,
} from "../schema/project-schema";
import type { Project } from "../types/project-types";

type Props = {
	defaultValues?: TProjectFormValues | null;
	onSubmit: (
		values: TProjectFormValues,
	) => Promise<boolean | void> | boolean | void;
	isSubmitting: boolean;
	onSuccess?: () => void;
	onCancel?: () => void;
	/**
	 * Create only: projects whose workflow the new one can copy. Shows the
	 * workflow picker; `canCopyWorkflow` false (Free) shows it locked to the
	 * default.
	 */
	workflowSources?: Project[];
	canCopyWorkflow?: boolean;
};

export default function ProjectForm({
	defaultValues,
	onSubmit,
	isSubmitting,
	onSuccess,
	onCancel,
	workflowSources,
	canCopyWorkflow = false,
}: Props) {
	const isEditing = !!defaultValues;

	const methods = useForm<TProjectFormValues>({
		resolver: zodResolver(projectSchema),
		defaultValues: defaultValues ?? {
			name: "",
			description: "",
			workflowFrom: DEFAULT_WORKFLOW,
		},
	});

	const handleFormSubmit = async (values: TProjectFormValues) => {
		const success = await onSubmit(values);
		if (success === false) return;
		methods.reset();
		onSuccess?.();
	};

	return (
		<FormWrapper methods={methods} onSubmit={handleFormSubmit}>
			<FormTextField
				name="name"
				label="Project Name"
				placeholder="e.g. Engineering"
				isRequired
			/>

			<FormTextArea
				name="description"
				label="Description"
				placeholder="Optional project description"
			/>

			{!isEditing && workflowSources && (
				<div className="flex flex-col gap-1">
					<FormSelect
						name="workflowFrom"
						label="Workflow"
						isDisabled={!canCopyWorkflow || workflowSources.length === 0}
						options={[
							{
								value: DEFAULT_WORKFLOW,
								label: "Default (Backlog, To Do, In Progress, In Review, Done)",
							},
							...workflowSources.map((p) => ({
								value: p.id,
								label: `Same as ${p.name}`,
							})),
						]}
					/>
					<p className="text-xs text-muted">
						{canCopyWorkflow
							? "You can change the statuses any time from the project’s Workflow tab."
							: "Every project on Free uses the default workflow. Upgrade to Pro to customize it per project."}
					</p>
				</div>
			)}

			<div className="mt-2 flex justify-end gap-2">
				{onCancel && (
					<Button variant="outline" type="button" onClick={onCancel}>
						Cancel
					</Button>
				)}
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
