"use client";

import MyModal from "@/components/ui/my-modal";

import type { TProjectFormValues } from "../schema/project-schema";
import ProjectForm from "./ProjectForm";

interface ProjectFormModalProps {
	isOpen: boolean;
	closeModal: () => void;
	onSubmit: (
		values: TProjectFormValues,
	) => Promise<boolean | void> | boolean | void;
	isSubmitting?: boolean;
	defaultValues?: TProjectFormValues | null;
}

export default function ProjectFormModal({
	isOpen,
	closeModal,
	onSubmit,
	isSubmitting,
	defaultValues,
}: ProjectFormModalProps) {
	const isEditing = !!defaultValues;

	return (
		<MyModal
			isOpen={isOpen}
			onOpenChange={closeModal}
			size="md"
			title={isEditing ? "Edit Project" : "Create New Project"}
		>
			{isOpen && (
				<ProjectForm
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
