"use client";

import {
  Button,
  FieldError,
  Input,
  Label,
  Modal,
  TextField,
  TextArea,
} from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import type { CreateProjectDto } from "../types/project-types";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  key: z
    .string()
    .min(1, "Key is required")
    .max(8, "Key must be 8 characters or fewer")
    .regex(/^[A-Z0-9]+$/, "Key must be uppercase letters and numbers only"),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface CreateProjectModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (dto: CreateProjectDto) => Promise<void>;
  isLoading?: boolean;
}

function deriveKey(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

export default function CreateProjectModal({
  isOpen,
  onOpenChange,
  onSubmit,
  isLoading,
}: CreateProjectModalProps) {
  const {
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", key: "", description: "" },
  });

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const submit = async (values: FormValues) => {
    await onSubmit(values);
    handleClose();
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            <form onSubmit={handleSubmit(submit)}>
              <Modal.Header>
                <Modal.Heading>New Project</Modal.Heading>
                <Modal.CloseTrigger onPress={handleClose} />
              </Modal.Header>

              <Modal.Body className="flex flex-col gap-4">
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <TextField isInvalid={!!errors.name} isRequired>
                      <Label>Project Name</Label>
                      <Input
                        {...field}
                        placeholder="e.g. Engineering"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          field.onChange(e);
                          setValue("key", deriveKey(e.target.value));
                        }}
                      />
                      <FieldError>{errors.name?.message}</FieldError>
                    </TextField>
                  )}
                />

                <Controller
                  name="key"
                  control={control}
                  render={({ field }) => (
                    <TextField isInvalid={!!errors.key} isRequired>
                      <Label>Project Key</Label>
                      <Input
                        {...field}
                        placeholder="e.g. ENG"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          field.onChange(e.target.value.toUpperCase());
                        }}
                      />
                      <FieldError>{errors.key?.message}</FieldError>
                    </TextField>
                  )}
                />

                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <TextField isInvalid={!!errors.description}>
                      <Label>Description</Label>
                      <TextArea
                        {...field}
                        placeholder="Optional project description"
                        rows={3}
                      />
                      <FieldError>{errors.description?.message}</FieldError>
                    </TextField>
                  )}
                />
              </Modal.Body>

              <Modal.Footer>
                <Button variant="outline" onPress={handleClose} type="button">
                  Cancel
                </Button>
                <Button type="submit" isDisabled={isLoading}>
                  {isLoading ? "Creating…" : "Create Project"}
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
