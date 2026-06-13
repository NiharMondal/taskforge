import React from "react";
import { Modal } from "@heroui/react";
type MyModalProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	children: React.ReactNode;
	size?: "xs" | "sm" | "md" | "lg" | "cover" | "full";
	title?: string;
};
export default function MyModal({
	isOpen,
	onOpenChange,
	children,
	size = "cover",
	title,
}: MyModalProps) {
	return (
		<Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
			<Modal.Container size={size}>
				<Modal.Dialog>
					<Modal.Header>
						<Modal.Heading>{title}</Modal.Heading>
						<Modal.CloseTrigger
							onPress={() => onOpenChange(false)}
						/>
					</Modal.Header>
					<Modal.Body>{children}</Modal.Body>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}
