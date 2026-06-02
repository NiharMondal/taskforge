"use client";

import { FieldError, Input, Label, TextField } from "@heroui/react";
import {
  useController,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form";

/**
 * RHF-bound text field built on HeroUI's (react-aria) TextField primitives.
 *
 * Keeps login/register forms declarative and consistent: one component owns
 * label + input + inline validation error, wired to React Hook Form via
 * `useController`. HeroUI's `onChange` yields the string value directly.
 */
interface FormTextFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  type?: "text" | "email" | "password";
  placeholder?: string;
  autoComplete?: string;
  isDisabled?: boolean;
}

export function FormTextField<T extends FieldValues>({
  control,
  name,
  label,
  type = "text",
  placeholder,
  autoComplete,
  isDisabled,
}: FormTextFieldProps<T>) {
  const {
    field: { ref, value, onChange, onBlur, name: fieldName },
    fieldState: { error, invalid },
  } = useController({ control, name });

  return (
    <TextField
      name={fieldName}
      type={type}
      value={(value as string | undefined) ?? ""}
      onChange={onChange}
      onBlur={onBlur}
      isInvalid={invalid}
      isDisabled={isDisabled}
      isRequired
      className="flex flex-col gap-1.5"
    >
      <Label className="text-sm font-medium">{label}</Label>
      <Input ref={ref} placeholder={placeholder} autoComplete={autoComplete} />
      {error?.message && (
        <FieldError className="text-sm text-danger">{error.message}</FieldError>
      )}
    </TextField>
  );
}
