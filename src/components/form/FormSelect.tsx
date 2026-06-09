import { IFormSelectOption } from "@/types/common";
import { FieldError, Label, ListBox, Select } from "@heroui/react";
import { Controller, useFormContext } from "react-hook-form";

type TProps = {
	name: string;
	label?: string;
	placeholder?: string;
	isRequired?: boolean;
	options: IFormSelectOption[];
};
export default function FormSelect({
	name,
	label,
	placeholder,
	isRequired,
	options = [],
}: TProps) {
	const { control } = useFormContext();
	return (
		<Controller
			name={name}
			control={control}
			render={({ field, fieldState }) => (
				<Select
					placeholder={placeholder}
					isRequired={isRequired}
					name={field.name}
					value={field.value || null}
					onChange={(key) => field.onChange(key ?? "")}
					onBlur={field.onBlur}
					isInvalid={!!fieldState.error}
					aria-label={!label ? (placeholder ?? name) : undefined}
					fullWidth
				>
					{label && <Label>{label}</Label>}
					<Select.Trigger>
						<Select.Value />
						<Select.Indicator />
					</Select.Trigger>
					<Select.Popover>
						<ListBox>
							{options.length === 0 ? (
								<ListBox.Item
									isDisabled
									textValue="No data found"
								>
									<span className="text-default-400 text-sm italic">
										No data found
									</span>
								</ListBox.Item>
							) : (
								options.map((option) => (
									<ListBox.Item
										key={option.value}
										id={option.value}
										textValue={option.label}
									>
										{option.label}
									</ListBox.Item>
								))
							)}
						</ListBox>
					</Select.Popover>
					<FieldError>{fieldState.error?.message}</FieldError>
				</Select>
			)}
		/>
	);
}
