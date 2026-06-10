"use client";

import { Label } from "@heroui/react";
import { Controller, useFormContext } from "react-hook-form";

import RichTextEditor from "@/components/ui/RichTextEditor";

type TProps = {
	name: string;
	label?: string;
	placeholder?: string;
	isRequired?: boolean;
};

export default function FormRichTextEditor({
	name,
	label,
	placeholder,
	isRequired,
}: TProps) {
	const { control } = useFormContext();
	return (
		<Controller
			name={name}
			control={control}
			render={({ field, fieldState }) => (
				<div className="flex flex-col gap-1">
					{label && (
						<Label>
							{label}
							{isRequired && (
								<span className="text-danger"> *</span>
							)}
						</Label>
					)}
					<RichTextEditor
						value={field.value ?? ""}
						onChange={field.onChange}
						onBlur={field.onBlur}
						isInvalid={!!fieldState.error}
						placeholder={placeholder}
						aria-label={!label ? (placeholder ?? name) : undefined}
					/>
					{fieldState.error && (
						<span className="text-danger text-sm">
							{fieldState.error.message}
						</span>
					)}
				</div>
			)}
		/>
	);
}
