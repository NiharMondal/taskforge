import { IFormSelectOption } from "@/types/common";
import {
	Description,
	FieldError,
	Label,
	Radio,
	RadioGroup,
} from "@heroui/react";
import { Controller, useFormContext } from "react-hook-form";

type TProps = {
	name: string;
	label?: string;
	description?: string;
	isRequired?: boolean;
	options: IFormSelectOption[];
};

export default function FormRadioGroup({
	name,
	label,
	description,
	isRequired,
	options,
}: TProps) {
	const { control } = useFormContext();
	return (
		<Controller
			name={name}
			control={control}
			render={({ field, fieldState }) => (
				<RadioGroup
					isRequired={isRequired}
					name={field.name}
					value={field.value ?? ""}
					onChange={field.onChange}
					onBlur={field.onBlur}
					isInvalid={!!fieldState.error}
					aria-label={!label ? name : undefined}
				>
					<Label>{label}</Label>

					{description && <Description>{description}</Description>}
					{options.length === 0 ? (
						<Radio value="" isDisabled>
							<Radio.Control>
								<Radio.Indicator />
							</Radio.Control>
							<Radio.Content>
								<span className="text-default-400 text-sm italic">
									No data found
								</span>
							</Radio.Content>
						</Radio>
					) : (
						options?.map((option) => (
							<Radio
								value={option?.value as string}
								key={option.value}
							>
								<Radio.Control>
									<Radio.Indicator />
								</Radio.Control>
								<Radio.Content>
									<Label>{option.label}</Label>
									<Description>
										{option.description}
									</Description>
								</Radio.Content>
							</Radio>
						))
					)}

					<FieldError>{fieldState.error?.message}</FieldError>
				</RadioGroup>
			)}
		/>
	);
}
