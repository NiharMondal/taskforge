"use client";

import { useState } from "react";

import { Label, TextArea, TextField } from "@heroui/react";
import { MAX_ADMIN_REASON_LENGTH } from "@taskforge/shared";

import ConfirmModal from "@/components/ui/confirm-modal";

/**
 * Confirms one admin action and asks why. The reason is required (the
 * backend refuses a blank one), goes into the platform audit log, and is
 * never shown to the user.
 */
export default function AdminActionDialog({
	isOpen,
	onClose,
	title,
	description,
	confirmLabel,
	pendingLabel,
	isPending,
	onConfirm,
	typeToConfirm,
}: {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	description: React.ReactNode;
	confirmLabel: string;
	pendingLabel: string;
	isPending: boolean;
	/** Called with the trimmed reason. */
	onConfirm: (reason: string) => void;
	/** For deletes: the confirm button waits for this exact text. */
	typeToConfirm?: string;
}) {
	const [reason, setReason] = useState("");
	const trimmed = reason.trim();

	const close = () => {
		setReason("");
		onClose();
	};

	return (
		<ConfirmModal
			isOpen={isOpen}
			onClose={close}
			title={title}
			description={description}
			confirmLabel={confirmLabel}
			pendingLabel={pendingLabel}
			isPending={isPending}
			onConfirm={() => onConfirm(trimmed)}
			typeToConfirm={typeToConfirm}
			canConfirm={trimmed.length > 0 && !isPending}
		>
			<TextField
				value={reason}
				onChange={setReason}
				maxLength={MAX_ADMIN_REASON_LENGTH}
				isRequired
			>
				<Label className="text-xs font-normal">
					Reason{" "}
					<span className="text-muted">
						(kept in the platform audit log; the user doesn’t see it)
					</span>
				</Label>
				<TextArea rows={3} className="w-full shadow-none" />
			</TextField>
		</ConfirmModal>
	);
}
