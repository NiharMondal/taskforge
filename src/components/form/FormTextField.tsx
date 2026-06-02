"use client";

import { Controller, useFormContext } from "react-hook-form";
import {
  TextField,
  Label,
  Input,
  FieldError,
} from "@heroui/react";

type Props = {
  name: string;
  label?: string;
  type?: string;
  placeholder?: string;
  isRequired?:boolean
};

export function FormTextField({
  name,
  label,
  type = "text",
  placeholder,
  isRequired
}: Props) {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <TextField isInvalid={!!fieldState.error} isRequired={isRequired}>
          <Label>{label}</Label>

          <Input
            {...field}
            type={type}
            placeholder={placeholder}
          />

          <FieldError>
            {fieldState.error?.message}
          </FieldError>
        </TextField>
      )}
    />
  );
}