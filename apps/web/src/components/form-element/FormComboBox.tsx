import { Controller, useFormContext } from "react-hook-form";
import { ComboBox, FieldError, Input, Label, ListBox } from "@heroui/react";
import { IFormSelectOption } from "@/types/common";

type TProps = {
	name: string;
	label?: string;
	placeholder?: string;
	isRequired?: boolean;
	options: IFormSelectOption[];
};

export default function FormComboBox({
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
				<ComboBox
					className="w-auto"
					name={field.name}
					value={field.value || null}
					onChange={(key) => field.onChange(key ?? "")}
					onBlur={field.onBlur}
					isRequired={isRequired}
					isInvalid={!!fieldState.error}
					aria-label={!label ? (placeholder ?? name) : undefined}
				>
					{label && <Label>{label}</Label>}
					<ComboBox.InputGroup>
						<Input placeholder={placeholder} />
						<ComboBox.Trigger />
					</ComboBox.InputGroup>
					<ComboBox.Popover>
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
										<ListBox.ItemIndicator />
									</ListBox.Item>
								))
							)}
						</ListBox>
					</ComboBox.Popover>
					<FieldError>{fieldState.error?.message}</FieldError>
				</ComboBox>
			)}
		/>
	);
}
