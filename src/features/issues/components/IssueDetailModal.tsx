"use client";

import { useState } from "react";

import {
	Alert,
	Button,
	Input,
	Label,
	ListBox,
	Modal,
	Select,
	TextArea,
	TextField,
} from "@heroui/react";

import type { Member } from "@/features/memberships/types/membership-types";
import { getApiErrorMessage } from "@/lib/api-error";

import Avatar from "@/components/ui/avatar";
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from "../constants";
import { useUpdateIssue } from "../hooks/use-issues";
import type { Issue, IssuePriority, IssueStatus } from "../types/issue-types";

const UNASSIGNED = "__unassigned__";

interface IssueDetailModalProps {
	/** The issue to edit; null closes the modal. */
	issue: Issue | null;
	onClose: () => void;
	members: Member[];
	workspaceId: string;
	projectId: string;
}

/**
 * Issue detail + edit panel. The form lives in an inner component seeded
 * directly from props and re-mounted per issue (via `key`), so opening a
 * different issue resets the fields without a sync effect.
 */
export default function IssueDetailModal({
	issue,
	onClose,
	members,
	workspaceId,
	projectId,
}: IssueDetailModalProps) {
	return (
		<Modal.Backdrop
			isOpen={!!issue}
			onOpenChange={(open) => !open && onClose()}
		>
			<Modal.Container>
				<Modal.Dialog className="min-w-3xl">
					{issue && (
						<IssueDetailForm
							key={issue.id}
							issue={issue}
							onClose={onClose}
							members={members}
							workspaceId={workspaceId}
							projectId={projectId}
						/>
					)}
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}

interface IssueDetailFormProps {
	issue: Issue;
	onClose: () => void;
	members: Member[];
	workspaceId: string;
	projectId: string;
}

function IssueDetailForm({
	issue,
	onClose,
	members,
	workspaceId,
	projectId,
}: IssueDetailFormProps) {
	const { mutateAsync: updateIssue, isPending } = useUpdateIssue(
		workspaceId,
		projectId,
	);

	const [title, setTitle] = useState(issue.title);
	const [description, setDescription] = useState(issue.description ?? "");
	const [status, setStatus] = useState<IssueStatus>(issue.status);
	const [priority, setPriority] = useState<IssuePriority>(issue.priority);
	const [assigneeId, setAssigneeId] = useState<string>(
		issue.assigneeId ?? UNASSIGNED,
	);
	const [error, setError] = useState<string | null>(null);

	const handleSave = async () => {
		if (!title.trim()) {
			setError("Title is required.");
			return;
		}
		setError(null);

		const nextAssignee = assigneeId === UNASSIGNED ? null : assigneeId;
		const dto = {
			...(title !== issue.title && { title }),
			...(description !== (issue.description ?? "") && {
				description: description || undefined,
			}),
			...(status !== issue.status && { status }),
			...(priority !== issue.priority && { priority }),
			...(nextAssignee !== (issue.assigneeId ?? null) && {
				assigneeId: nextAssignee,
			}),
		};

		// Nothing changed — just close.
		if (Object.keys(dto).length === 0) {
			onClose();
			return;
		}

		try {
			await updateIssue({ issueId: issue.id, dto });
			onClose();
		} catch (err) {
			setError(getApiErrorMessage(err));
		}
	};

	return (
		<>
			<Modal.Header>
				<Modal.Heading>Issue details</Modal.Heading>
				<Modal.CloseTrigger onPress={onClose} />
			</Modal.Header>

			<Modal.Body className="flex flex-col gap-4">
				{error && (
					<Alert status="danger">
						<Alert.Indicator />
						<Alert.Content>
							<Alert.Description>{error}</Alert.Description>
						</Alert.Content>
					</Alert>
				)}

				<TextField isRequired isInvalid={!title.trim()}>
					<Label>Title</Label>
					<Input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
					/>
				</TextField>

				<TextField>
					<Label>Description</Label>
					<TextArea
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						rows={4}
						placeholder="Add a description…"
					/>
				</TextField>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div className="flex flex-col gap-1.5">
						<Label>Status</Label>
						<Select
							aria-label="Status"
							selectedKey={status}
							onSelectionChange={(key) =>
								key != null &&
								setStatus(String(key) as IssueStatus)
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

					<div className="flex flex-col gap-1.5">
						<Label>Priority</Label>
						<Select
							aria-label="Priority"
							defaultValue={priority}
							onChange={(key) =>
								key != null &&
								setPriority(String(key) as IssuePriority)
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
				</div>

				<div className="flex flex-col gap-1.5">
					<Label>Assignee</Label>
					<Select
						aria-label="Assignee"
						defaultValue={assigneeId}
						onClickCapture={(key) =>
							key != null && setAssigneeId(String(key))
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
										textValue={
											m.user?.name ??
											m.user?.email ??
											m.userId
										}
									>
										<Avatar
											fallback={
												m.user?.name?.charAt(0) ??
												m.user?.email?.charAt(0) ??
												m.userId.charAt(0)
											}
											shape="circle"
										/>
										{m.user?.name ??
											m.user?.email ??
											m.userId}
									</ListBox.Item>
								))}
							</ListBox>
						</Select.Popover>
					</Select>
				</div>
			</Modal.Body>

			<Modal.Footer>
				<Button variant="outline" onPress={onClose} type="button">
					Cancel
				</Button>
				<Button onPress={handleSave} isDisabled={isPending}>
					{isPending ? "Saving…" : "Save changes"}
				</Button>
			</Modal.Footer>
		</>
	);
}
