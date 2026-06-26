import React from "react";
import { cn, Modal } from "@heroui/react";
type MyModalProps = {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	children: React.ReactNode;
	size?: "xs" | "sm" | "md" | "lg" | "cover" | "full";
	title?: string;
	className?: string;
	width?: string; // 👈 new
};
export default function MyModal({
	isOpen,
	onOpenChange,
	children,
	size = "lg",
	title,
	className,
	width,
}: MyModalProps) {
	return (
		<Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
			<Modal.Container
				size={width ? undefined : size} // disable size if custom width exists
			>
				<Modal.Dialog className={cn(width, className)}>
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