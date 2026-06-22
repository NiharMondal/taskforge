"use client";

import MyModal from "@/components/ui/my-modal";
import SprintForm from "./SprintForm";
import type { TSprintFormValues } from "../schema/sprint-schema";

interface SprintFormModalProps {
	isOpen: boolean;
	closeModal: () => void;
	onSubmit: (
		values: TSprintFormValues,
	) => Promise<boolean | void> | boolean | void;
	isSubmitting?: boolean;
	defaultValues?: TSprintFormValues | null;
}

export default function SprintFormModal({
	isOpen,
	closeModal,
	onSubmit,
	isSubmitting,
	defaultValues,
}: SprintFormModalProps) {
	const isEditing = !!defaultValues;

	return (
		<MyModal
			isOpen={isOpen}
			onOpenChange={closeModal}
			width="min-w-[610px]"
			className=""
			title={isEditing ? "Edit Sprint" : "Create Sprint"}
		>
			{isOpen && (
				<SprintForm
					defaultValues={defaultValues}
					onSubmit={onSubmit}
					isSubmitting={!!isSubmitting}
					onSuccess={closeModal}
					onCancel={closeModal}
				/>
			)}
		</MyModal>
	);
}
