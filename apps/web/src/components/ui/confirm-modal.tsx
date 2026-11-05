"use client";

import { useState, type ReactNode } from "react";

import { Button, Input, Label, TextField } from "@heroui/react";

import MyModal from "./my-modal";

type Props = {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	description: ReactNode;
	/** Button label, e.g. "Delete". */
	confirmLabel: string;
	/** Button label while `isPending`, e.g. "Deleting…". */
	pendingLabel: string;
	isPending: boolean;
	onConfirm: () => void;
	/**
	 * For actions that can't be undone and take a lot with them: the confirm
	 * button stays disabled until this exact text is typed.
	 */
	typeToConfirm?: string;
	/** Extra fields below the description, e.g. a password to re-enter. */
	children?: ReactNode;
	/** `false` keeps the confirm button disabled, e.g. until `children` are filled in. */
	canConfirm?: boolean;
};

/** Confirmation dialog for destructive actions (delete, revoke, ...). */
export default function ConfirmModal({
	isOpen,
	onClose,
	title,
	description,
	confirmLabel,
	pendingLabel,
	isPending,
	onConfirm,
	typeToConfirm,
	children,
	canConfirm = true,
}: Props) {
	const [typed, setTyped] = useState("");
	const isConfirmed =
		canConfirm && (!typeToConfirm || typed.trim() === typeToConfirm);

	const close = () => {
		setTyped("");
		onClose();
	};

	return (
		<MyModal
			isOpen={isOpen}
			onOpenChange={(open) => !open && close()}
			size="sm"
			title={title}
		>
			<div className="flex flex-col gap-4">
				<div className="text-sm text-muted">{description}</div>

				{typeToConfirm && (
					<TextField value={typed} onChange={setTyped}>
						<Label className="font-normal text-xs">
							Type{" "}
							<span className="font-medium text-foreground text-sm">
								{typeToConfirm}
							</span>{" "}
							to confirm
						</Label>
						<Input className="w-full shadow-none" />
					</TextField>
				)}

				{children}

				<div className="flex justify-end gap-2">
					<Button variant="outline" type="button" onClick={close}>
						Cancel
					</Button>
					<Button
						variant="danger"
						type="button"
						isDisabled={isPending || !isConfirmed}
						onClick={onConfirm}
					>
						{isPending ? pendingLabel : confirmLabel}
					</Button>
				</div>
			</div>
		</MyModal>
	);
}
