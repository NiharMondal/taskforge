import { FieldError, Label, TextArea, TextField } from "@heroui/react";
import { Controller, useFormContext } from "react-hook-form";

type TProps = {
	name: string;
	label?: string;
	placeholder?: string;
	isRequired?: boolean;
};

export default function FormTextArea({
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
				<TextField
					name={field.name}
					value={field.value ?? ""}
					onChange={field.onChange}
					onBlur={field.onBlur}
					isInvalid={!!fieldState.error}
					isRequired={isRequired}
					aria-label={!label ? (placeholder ?? name) : undefined}
				>
					{label && <Label>{label}</Label>}

					<TextArea
						placeholder={placeholder}
						aria-label={!label ? (placeholder ?? name) : undefined}
					/>

					<FieldError>{fieldState.error?.message}</FieldError>
				</TextField>
			)}
		/>
	);
}
