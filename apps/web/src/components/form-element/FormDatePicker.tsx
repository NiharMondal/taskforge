"use client";

import { Controller, useFormContext } from "react-hook-form";
import {
	DatePicker,
	DateField,
	Calendar,
	Label,
	FieldError,
} from "@heroui/react";
import type { DateValue } from "@internationalized/date";
import { X } from "lucide-react";
import { toCalendarDate } from "@/util/format-date";
type minMaxDate = DateValue | Date | string | number | null | undefined;
type Props = {
	name: string;
	label?: string;
	isRequired?: boolean;
	/** Prevent selecting any date before today. */
	disablePastDate?: boolean;
	/** Prevent selecting any date after today. */
	disableFutureDate?: boolean;
	/** Custom lower bound (combined with `disablePastDate`: the later one wins). */
	minDate?: minMaxDate;
	/** Custom upper bound (combined with `disableFutureDate`: the earlier one wins). */
	maxDate?: minMaxDate;
	/** Swap the calendar icon for a clear (X) button once a date is set. Defaults to `true`. */
	isClearable?: boolean;
};

/** A form-held `DateValue` is passed through; JS dates/strings are converted. */
const resolveBound = (value?: minMaxDate): DateValue | undefined => {
	if (value == null) return undefined;
	if (typeof value === "object" && "calendar" in value) return value;
	return toCalendarDate(value);
};

/** The tighter of two bounds: the later for a min, the earlier for a max. */
const tighterBound = (
	a: DateValue | undefined,
	b: DateValue | undefined,
	pick: "later" | "earlier",
): DateValue | undefined => {
	if (!a || !b) return a ?? b;
	const aIsLater = a.compare(b) >= 0;
	return (pick === "later") === aIsLater ? a : b;
};

export default function FormDatePicker({
	name,
	label,
	isRequired,
	disablePastDate,
	disableFutureDate,
	minDate,
	maxDate,
	isClearable = true,
}: Props) {
	const { control } = useFormContext();

	const today = toCalendarDate(new Date());

	const minValue = tighterBound(
		disablePastDate ? today : undefined,
		resolveBound(minDate),
		"later",
	);

	const maxValue = tighterBound(
		disableFutureDate ? today : undefined,
		resolveBound(maxDate),
		"earlier",
	);

	return (
		<Controller
			name={name}
			control={control}
			render={({ field, fieldState }) => (
				<DatePicker
					value={(field.value as DateValue) || null}
					onChange={field.onChange}
					minValue={minValue}
					maxValue={maxValue}
					isInvalid={!!fieldState.error}
					isRequired={isRequired}
					aria-label={!label ? name : undefined}
					className="w-full"
				>
					{label && <Label>{label}</Label>}

					{/* Input UI */}
					<DateField.Group>
						<DateField.Input>
							{(segment) => (
								<DateField.Segment segment={segment} />
							)}
						</DateField.Input>

						<DateField.Suffix>
							{/* A native button, not react-aria's: inside a DatePicker an
							    RAC Button picks up the trigger context and opens the popover. */}
							{isClearable && field.value ? (
								<button
									type="button"
									onClick={() => field.onChange(null)}
									aria-label="Clear date"
									className="flex rounded-sm text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
								>
									<X size={16} />
								</button>
							) : (
								<DatePicker.Trigger>
									<DatePicker.TriggerIndicator />
								</DatePicker.Trigger>
							)}
						</DateField.Suffix>
					</DateField.Group>

					{/* Calendar Popover */}
					<DatePicker.Popover>
						<Calendar
							aria-label="Select date"
							minValue={minValue}
							maxValue={maxValue}
						>
							<Calendar.Header>
								<Calendar.YearPickerTrigger>
									<Calendar.YearPickerTriggerHeading />
									<Calendar.YearPickerTriggerIndicator />
								</Calendar.YearPickerTrigger>

								<Calendar.NavButton slot="previous" />
								<Calendar.NavButton slot="next" />
							</Calendar.Header>

							<Calendar.Grid>
								<Calendar.GridHeader>
									{(day) => (
										<Calendar.HeaderCell>
											{day}
										</Calendar.HeaderCell>
									)}
								</Calendar.GridHeader>

								<Calendar.GridBody>
									{(date) => <Calendar.Cell date={date} />}
								</Calendar.GridBody>
							</Calendar.Grid>

							<Calendar.YearPickerGrid>
								<Calendar.YearPickerGridBody>
									{({ year }) => (
										<Calendar.YearPickerCell year={year} />
									)}
								</Calendar.YearPickerGridBody>
							</Calendar.YearPickerGrid>
						</Calendar>
					</DatePicker.Popover>

					<FieldError>{fieldState.error?.message}</FieldError>
				</DatePicker>
			)}
		/>
	);
}
