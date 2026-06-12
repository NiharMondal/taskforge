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
	workspaceSchema,
	type TWorkspaceFormValues,
} from "../schema/workspace-schema";

type Props = {
	defaultValues?: TWorkspaceFormValues | null;
	onSubmit: (
		values: TWorkspaceFormValues,
	) => Promise<boolean | void> | boolean | void;
	isSubmitting: boolean;
	onSuccess?: () => void;
	onCancel?: () => void;
};

export default function WorkspaceForm({
	defaultValues,
	onSubmit,
	isSubmitting,
	onSuccess,
	onCancel,
}: Props) {
	const isEditing = !!defaultValues;

	const methods = useForm<TWorkspaceFormValues>({
		resolver: zodResolver(workspaceSchema),
		defaultValues: defaultValues ?? {
			name: "",
			description: "",
		},
	});

	const handleFormSubmit = async (values: TWorkspaceFormValues) => {
		const success = await onSubmit(values);
		if (success === false) return;
		methods.reset();
		onSuccess?.();
	};

	return (
		<FormWrapper methods={methods} onSubmit={handleFormSubmit}>
			<FormTextField
				name="name"
				label="Workspace Name"
				placeholder="e.g. Acme Inc"
				isRequired
			/>

			<FormTextArea
				name="description"
				label="Description"
				placeholder="Optional workspace description"
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
							: "Create Workspace"}
				</Button>
			</div>
		</FormWrapper>
	);
}
