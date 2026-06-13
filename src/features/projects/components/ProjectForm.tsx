"use client";

import { Button } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import {
	FormTextArea,
	FormTextField,
	FormWrapper,
} from "@/components/form-element";

import {
	projectSchema,
	type TProjectFormValues,
} from "../schema/project-schema";

type Props = {
	defaultValues?: TProjectFormValues | null;
	onSubmit: (
		values: TProjectFormValues,
	) => Promise<boolean | void> | boolean | void;
	isSubmitting: boolean;
	onSuccess?: () => void;
	onCancel?: () => void;
};

export default function ProjectForm({
	defaultValues,
	onSubmit,
	isSubmitting,
	onSuccess,
	onCancel,
}: Props) {
	const isEditing = !!defaultValues;

	const methods = useForm<TProjectFormValues>({
		resolver: zodResolver(projectSchema),
		defaultValues: defaultValues ?? {
			name: "",
			description: "",
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
