"use client";

import { Button } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import {
	FormTextArea,
	FormTextField,
	FormWrapper,
} from "@/components/form-element";
import { sprintSchema, type TSprintFormValues } from "../schema/sprint-schema";
import FormDatePicker from "@/components/form-element/FormDatePicker";

type Props = {
	defaultValues?: TSprintFormValues | null;
	onSubmit: (
		values: TSprintFormValues,
	) => Promise<boolean | void> | boolean | void;
	isSubmitting: boolean;
	onSuccess?: () => void;
	onCancel?: () => void;
};

export default function SprintForm({
	defaultValues,
	onSubmit,
	isSubmitting,
	onSuccess,
	onCancel,
}: Props) {
	const isEditing = !!defaultValues;

	const methods = useForm<TSprintFormValues>({
		resolver: zodResolver(sprintSchema),
		defaultValues: defaultValues ?? {
			name: "",
			goal: "",
			startDate: null,
			endDate: null,
		},
	});

	const handleFormSubmit = async (values: TSprintFormValues) => {
		const normalized: TSprintFormValues = {
			...values,
			goal: values.goal || null,
			startDate: values.startDate || null,
			endDate: values.endDate || null,
		};
		const success = await onSubmit(normalized);
		if (success === false) return;
		methods.reset();
		onSuccess?.();
	};

	return (
		<FormWrapper methods={methods} onSubmit={handleFormSubmit}>
			<FormTextField
				name="name"
				label="Sprint Name"
				placeholder="e.g. Sprint 1"
				isRequired
			/>
			<FormTextArea
				name="goal"
				label="Goal"
				placeholder="What should this sprint achieve?"
			/>
			<div className="flex items-center gap-4 w-full">
				<FormDatePicker name="startDate" label="Start Date" />
				<FormDatePicker name="endDate" label="End Date" />
			</div>
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
							: "Create Sprint"}
				</Button>
			</div>
		</FormWrapper>
	);
}
