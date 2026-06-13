"use client";

import { Controller, useFormContext } from "react-hook-form";
import { TextField, Label, Input, FieldError } from "@heroui/react";

type Props = {
	name: string;
	label?: string;
	type?: string;
	placeholder?: string;
	isRequired?: boolean;
};

export default function FormTextField({
	name,
	label,
	type = "text",
	placeholder,
	isRequired,
}: Props) {
	const { control } = useFormContext();

	return (
		<Controller
			name={name}
			control={control}
			render={({ field, fieldState }) => (
				<TextField
					name={field.name}
					type={type}
					value={field.value ?? ""}
					onChange={field.onChange}
					onBlur={field.onBlur}
					isInvalid={!!fieldState.error}
					isRequired={isRequired}
					aria-label={!label ? (placeholder ?? name) : undefined}
				>
					{label && <Label>{label}</Label>}

					<Input ref={field.ref} placeholder={placeholder} />

					<FieldError>{fieldState.error?.message}</FieldError>
				</TextField>
			)}
		/>
	);
}
