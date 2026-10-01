"use client";

import { cn, FieldError, Input, Label, TextField } from "@heroui/react";
import { ReactNode } from "react";
import { Controller, useFormContext } from "react-hook-form";

type Props = {
	name: string;
	label?: string;
	type?: string;
	placeholder?: string;
	isRequired?: boolean;
	ornament?: ReactNode;
	ornamentAlignment?: "left" | "right";
};

export default function FormTextField({
	name,
	label,
	type = "text",
	placeholder,
	isRequired,
	ornament,
	ornamentAlignment = "right",
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

					<div className="relative">
						<Input
							ref={field.ref}
							placeholder={placeholder}
							className="w-full shadow-none"
						/>
						{ornament && (
							<span
								className={cn(
									"cursor-pointer text-muted absolute top-1/2 right-2.5 -translate-y-1/2",
									ornamentAlignment === "left" && "left-2.5",
								)}
							>
								{ornament}
							</span>
						)}
					</div>

					<FieldError>{fieldState.error?.message}</FieldError>
				</TextField>
			)}
		/>
	);
}
