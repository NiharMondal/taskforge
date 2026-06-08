"use client";

import { useState } from "react";

import {
  Alert,
  Button,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { getApiErrorMessage } from "@/lib/api-error";
import type { Member } from "@/features/memberships/types/membership-types";

import { ISSUE_PRIORITIES, ISSUE_STATUSES } from "../constants";
import type { CreateIssueDto } from "../types/issue-types";

/** Sentinel ListBox key for "no assignee" (react-aria keys can't be empty). */
const UNASSIGNED = "__unassigned__";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  assigneeId: z.string(),
});

type FormValues = z.infer<typeof schema>;

interface CreateIssueModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (dto: CreateIssueDto) => Promise<void>;
  members: Member[];
  isLoading?: boolean;
}

export default function CreateIssueModal({
  isOpen,
  onOpenChange,
  onSubmit,
  members,
  isLoading,
}: CreateIssueModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      status: "BACKLOG",
      priority: "MEDIUM",
      assigneeId: UNASSIGNED,
    },
  });

  const handleClose = () => {
    reset();
    setSubmitError(null);
    onOpenChange(false);
  };

  const submit = async (values: FormValues) => {
    setSubmitError(null);
    try {
      await onSubmit({
        title: values.title,
        description: values.description || undefined,
        status: values.status,
        priority: values.priority,
        assigneeId:
          values.assigneeId === UNASSIGNED ? null : values.assigneeId,
      });
      handleClose();
    } catch (err) {
      // Keep the modal open so the user can retry without re-typing.
      setSubmitError(getApiErrorMessage(err));
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            <form onSubmit={handleSubmit(submit)}>
              <Modal.Header>
                <Modal.Heading>New Issue</Modal.Heading>
                <Modal.CloseTrigger onPress={handleClose} />
              </Modal.Header>

              <Modal.Body className="flex flex-col gap-4">
                {submitError && (
                  <Alert status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Description>{submitError}</Alert.Description>
                    </Alert.Content>
                  </Alert>
                )}

                <Controller
                  name="title"
                  control={control}
                  render={({ field }) => (
                    <TextField isInvalid={!!errors.title} isRequired>
                      <Label>Title</Label>
                      <Input
                        {...field}
                        placeholder="e.g. Login button is misaligned"
                        autoFocus
                      />
                      <FieldError>{errors.title?.message}</FieldError>
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
                        placeholder="Optional details, steps to reproduce, acceptance criteria…"
                        rows={3}
                      />
                      <FieldError>{errors.description?.message}</FieldError>
                    </TextField>
                  )}
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <div className="flex flex-col gap-1.5">
                        <Label>Status</Label>
                        <Select
                          aria-label="Status"
                          selectedKey={field.value}
                          onSelectionChange={(key) =>
                            key != null && field.onChange(String(key))
                          }
                          fullWidth
                        >
                          <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              {ISSUE_STATUSES.map((s) => (
                                <ListBox.Item
                                  key={s.value}
                                  id={s.value}
                                  textValue={s.label}
                                >
                                  {s.label}
                                </ListBox.Item>
                              ))}
                            </ListBox>
                          </Select.Popover>
                        </Select>
                      </div>
                    )}
                  />

                  <Controller
                    name="priority"
                    control={control}
                    render={({ field }) => (
                      <div className="flex flex-col gap-1.5">
                        <Label>Priority</Label>
                        <Select
                          aria-label="Priority"
                          selectedKey={field.value}
                          onSelectionChange={(key) =>
                            key != null && field.onChange(String(key))
                          }
                          fullWidth
                        >
                          <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              {ISSUE_PRIORITIES.map((p) => (
                                <ListBox.Item
                                  key={p.value}
                                  id={p.value}
                                  textValue={p.label}
                                >
                                  {p.label}
                                </ListBox.Item>
                              ))}
                            </ListBox>
                          </Select.Popover>
                        </Select>
                      </div>
                    )}
                  />
                </div>

                <Controller
                  name="assigneeId"
                  control={control}
                  render={({ field }) => (
                    <div className="flex flex-col gap-1.5">
                      <Label>Assignee</Label>
                      <Select
                        aria-label="Assignee"
                        selectedKey={field.value}
                        onSelectionChange={(key) =>
                          key != null && field.onChange(String(key))
                        }
                        fullWidth
                      >
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            <ListBox.Item
                              key={UNASSIGNED}
                              id={UNASSIGNED}
                              textValue="Unassigned"
                            >
                              Unassigned
                            </ListBox.Item>
                            {members.map((m) => (
                              <ListBox.Item
                                key={m.userId}
                                id={m.userId}
                                textValue={m.user?.name ?? m.user?.email ?? m.userId}
                              >
                                {m.user?.name ?? m.user?.email ?? m.userId}
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </div>
                  )}
                />
              </Modal.Body>

              <Modal.Footer>
                <Button variant="outline" onPress={handleClose} type="button">
                  Cancel
                </Button>
                <Button type="submit" isDisabled={isLoading}>
                  {isLoading ? "Creating…" : "Create Issue"}
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
