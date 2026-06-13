import { IFormSelectOption } from "@/types/common";
import { FieldError, Label, ListBox, Select } from "@heroui/react";
import { Controller, useFormContext } from "react-hook-form";
import Avatar from "../ui/avatar";

type TProps = {
	name: string;
	label?: string;
	placeholder?: string;
	isRequired?: boolean;
	options: IFormSelectOption[];
	showAvatar?: boolean;
};
export default function FormSelect({
	name,
	label,
	placeholder,
	isRequired,
	options = [],
	showAvatar,
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
										<span className="flex items-center gap-2.5">
											{showAvatar && (
												<Avatar
													fallback={option.label?.charAt(
														0,
													)}
													size="sm"
													src={option.url}
													customSize
												/>
											)}
											{option.label}
										</span>
										<ListBox.ItemIndicator />
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
